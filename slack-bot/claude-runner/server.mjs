#!/usr/bin/env node
// Terraforming Mars Claude runner.
//
// Accepts signed "seat" requests from the Slack bot and starts one supervisor (run-seat.sh) per
// seat. Listens on localhost only; `tailscale funnel` is what makes it reachable from Vercel.
// Node built-ins only, so it runs from a bare checkout.
//
//   POST /seat    {playerUrl, gameName, hostUserId}   signed, see sign.mjs
//   GET  /health  {ok, running, maxConcurrent}        unsigned, reveals nothing about games
//
// State is the filesystem: $TM_RUNNER_HOME/games/<playerId>/job.json exists from acceptance, and
// a `done` file appears when its supervisor has finished for good. A game with a job and no
// `done` is live; on startup every live game gets its supervisor back, which resumes the session.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verify} from './sign.mjs';

const env = process.env;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = env.TM_RUNNER_HOME || path.join(os.homedir(), 'tm-claude');
const GAMES = path.join(HOME, 'games');
const PORT = Number(env.TM_RUNNER_PORT || 8787);
const ORIGIN = (env.TM_ALLOWED_ORIGIN || 'https://terraforming-mars.herokuapp.com').replace(/\/+$/, '');
const MAX_CONCURRENT = Number(env.TM_MAX_CONCURRENT || 2);
const MAX_PER_DAY = Number(env.TM_MAX_PER_DAY || 8);
const SECRET_FILE = env.TM_RUNNER_SECRET_FILE || path.join(HOME, 'runner-secret');
const MAX_BODY = 16 * 1024;

const log = (...a) => console.log(new Date().toISOString(), ...a);
// A player id is the credential for its seat, so logs only ever carry a prefix of it.
const short = (playerId) => playerId.slice(0, 5) + '…';

let secret;
try {
  secret = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} catch (err) {
  console.error(`Cannot read the shared secret at ${SECRET_FILE}: ${err.message}`);
  process.exit(1);
}
if (secret.length < 32) {
  console.error(`The shared secret in ${SECRET_FILE} is ${secret.length} characters; it must be at least 32.`);
  process.exit(1);
}
fs.mkdirSync(GAMES, {recursive: true});

const supervisors = new Map(); // playerId -> ChildProcess

function jobs() {
  return fs.readdirSync(GAMES).flatMap((id) => {
    const dir = path.join(GAMES, id);
    try {
      const job = JSON.parse(fs.readFileSync(path.join(dir, 'job.json'), 'utf8'));
      return [{id, dir, job, done: fs.existsSync(path.join(dir, 'done'))}];
    } catch {
      return []; // not a game directory
    }
  });
}

function supervise(id, dir) {
  if (supervisors.has(id)) return;
  const out = fs.openSync(path.join(dir, 'supervisor.out'), 'a');
  const child = spawn('/bin/bash', [path.join(HERE, 'run-seat.sh'), dir], {stdio: ['ignore', out, out], env: {...env, TM_RUNNER_HOME: HOME}});
  fs.closeSync(out);
  supervisors.set(id, child);
  child.on('exit', (code, signal) => {
    supervisors.delete(id);
    log(`supervisor for ${short(id)} exited`, signal ? `on ${signal}` : `with code ${code}`);
  });
  log(`supervisor for ${short(id)} started, pid ${child.pid}`);
}

/** Returns {playerId} for a URL that is a seat on the allowed server, otherwise {error}. */
function parseSeat(playerUrl) {
  let u;
  try { u = new URL(playerUrl); } catch { return {error: 'playerUrl is not a URL'}; }
  if (u.origin !== ORIGIN) return {error: `playerUrl is not on ${ORIGIN}`};
  if (u.pathname !== '/player') return {error: 'playerUrl path is not /player'};
  const playerId = u.searchParams.get('id') ?? '';
  if (!/^p[0-9a-f]{6,40}$/.test(playerId) || [...u.searchParams.keys()].length !== 1) return {error: 'playerUrl does not carry exactly one well-formed player id'};
  return {playerId};
}

function accept(body) {
  let req;
  try { req = JSON.parse(body); } catch { return [400, {error: 'body is not JSON'}]; }
  const seat = parseSeat(req?.playerUrl);
  if (seat.error) return [400, {error: seat.error}];
  const {playerId} = seat;
  const all = jobs();
  if (all.some((j) => j.id === playerId)) return [200, {accepted: true, duplicate: true}];
  const running = all.filter((j) => !j.done).length;
  if (running >= MAX_CONCURRENT) return [429, {error: `Claude is already playing ${running} game${running === 1 ? '' : 's'}, which is the limit.`}];
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const today = all.filter((j) => Date.parse(j.job.acceptedAt) > dayAgo).length;
  if (today >= MAX_PER_DAY) return [429, {error: `Claude has joined ${today} games in the last 24 hours, which is the limit.`}];

  const dir = path.join(GAMES, playerId);
  fs.mkdirSync(dir, {recursive: true});
  const job = {
    playerUrl: `${ORIGIN}/player?id=${playerId}`,
    gameName: String(req.gameName ?? '').slice(0, 200),
    hostUserId: String(req.hostUserId ?? '').slice(0, 40),
    acceptedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job, null, 1), {mode: 0o600});
  supervise(playerId, dir);
  return [202, {accepted: true}];
}

const server = http.createServer((req, res) => {
  const send = (status, obj) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/health') {
    return send(200, {ok: true, running: jobs().filter((j) => !j.done).length, maxConcurrent: MAX_CONCURRENT});
  }
  if (req.method !== 'POST' || req.url !== '/seat') return send(404, {error: 'not found'});
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { send(413, {error: 'body too large'}); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (size > MAX_BODY) return;
    const body = Buffer.concat(chunks).toString('utf8');
    const why = verify(secret, req.headers['x-tm-timestamp'], req.headers['x-tm-signature'], body);
    if (why) { log(`rejected /seat: ${why}`); return send(401, {error: why}); }
    let status, obj;
    try { [status, obj] = accept(body); } catch (err) { log('accept failed:', err); return send(500, {error: `runner error: ${err.message}`}); }
    log(`/seat -> ${status}`, obj.error ?? (obj.duplicate ? 'duplicate' : 'accepted'));
    send(status, obj);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on 127.0.0.1:${PORT}; home ${HOME}; seats on ${ORIGIN}; limits ${MAX_CONCURRENT} at once, ${MAX_PER_DAY} per day`);
  for (const j of jobs()) if (!j.done) { log(`resuming live game ${short(j.id)}`); supervise(j.id, j.dir); }
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    log(`${sig}: stopping ${supervisors.size} supervisor(s); live games resume on the next start`);
    for (const c of supervisors.values()) c.kill('SIGTERM');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
