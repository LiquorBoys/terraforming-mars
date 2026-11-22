#!/usr/bin/env node
// Terraforming Mars Claude runner.
//
// Accepts signed "seat" requests from the Slack bot and starts one supervisor (run-seat.sh) per
// seat. Listens on localhost only; `tailscale funnel` is what makes it reachable from Vercel.
// Node built-ins only, so it runs from a bare checkout.
//
//   POST /seat    {playerUrl, gameName, hostUserId, gameId}   signed, see sign.mjs
//   POST /game    {gameId, spectatorId, name, seed, players}   signed; every game the bot creates
//   GET  /health  {ok, running, maxConcurrent}                 unsigned, reveals nothing about games
//
// /game feeds the league collector (league.mjs): once a minute it looks at each game it was told
// about through the spectator id, and when one has ended it saves the record to the league
// checkout and pushes it. No model is involved, so this covers games Claude is not in.
//
// State is the filesystem: $TM_RUNNER_HOME/games/<playerId>/job.json exists from acceptance, and
// a `done` file appears when its supervisor has finished for good. A game with a job and no
// `done` is live; on startup every live game gets its supervisor back, which resumes the session.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {verify} from './sign.mjs';
import {buildFull, buildSummary, fetchGame, personKey} from './league.mjs';

const env = process.env;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = env.TM_RUNNER_HOME || path.join(os.homedir(), 'tm-claude');
const GAMES = path.join(HOME, 'games');
const PORT = Number(env.TM_RUNNER_PORT || 8787);
const ORIGIN = (env.TM_ALLOWED_ORIGIN || 'https://terraforming-mars.herokuapp.com').replace(/\/+$/, '');
const MAX_CONCURRENT = Number(env.TM_MAX_CONCURRENT || 2);
const MAX_PER_DAY = Number(env.TM_MAX_PER_DAY || 8);
// One model, or a comma-separated list. With a list, each game gets whichever model has played the
// fewest games so far, with ties broken at random: a coin flip per game leaves the arms of a
// small comparison lopsided (15 against 9 in one test of 24 draws).
const MODELS = (env.TM_MODEL || 'opus').split(',').map((m) => m.trim()).filter(Boolean);
const SECRET_FILE = env.TM_RUNNER_SECRET_FILE || path.join(HOME, 'runner-secret');
const MAX_BODY = 16 * 1024;
const LEAGUE = env.TM_LEAGUE_DIR || path.join(HOME, 'league');
const PENDING = path.join(HOME, 'league-pending');
const COLLECT_EVERY_MS = Number(env.TM_COLLECT_SECONDS || 60) * 1000;
const FORGET_AFTER_DAYS = 14; // the TM server purges games after about ten

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
fs.mkdirSync(PENDING, {recursive: true});
fs.mkdirSync(path.join(LEAGUE, 'games'), {recursive: true});

// Salt for the public per-person keys. Separate from the shared secret so that rotating the
// secret does not give everyone a new identity in the stats.
const SALT_FILE = path.join(HOME, 'league-salt');
if (!fs.existsSync(SALT_FILE)) fs.writeFileSync(SALT_FILE, crypto.randomBytes(32).toString('hex') + '\n', {mode: 0o600});
const salt = fs.readFileSync(SALT_FILE, 'utf8').trim();

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

function pickModel(all) {
  const played = (m) => all.filter((j) => j.job.model === m).length;
  const fewest = Math.min(...MODELS.map(played));
  const candidates = MODELS.filter((m) => played(m) === fewest);
  return candidates[crypto.randomInt(candidates.length)];
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
    gameId: /^g[0-9a-f]{6,40}$/.test(req.gameId ?? '') ? req.gameId : undefined,
    acceptedAt: new Date().toISOString(),
    // Chosen here, once, so a restarted supervisor keeps the game's model.
    model: pickModel(all),
  };
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify(job, null, 1), {mode: 0o600});
  log(`accepted ${short(playerId)} on ${job.model}`);
  supervise(playerId, dir);
  return [202, {accepted: true}];
}

// ---- league: games to collect ----

function acceptGame(body) {
  let req;
  try { req = JSON.parse(body); } catch { return [400, {error: 'body is not JSON'}]; }
  if (!/^g[0-9a-f]{6,40}$/.test(req?.gameId ?? '') || !/^s[0-9a-f]{6,40}$/.test(req?.spectatorId ?? '')) return [400, {error: 'gameId or spectatorId missing or malformed'}];
  if (!Array.isArray(req.players) || req.players.length === 0) return [400, {error: 'players missing'}];
  const file = path.join(PENDING, req.gameId + '.json');
  if (fs.existsSync(file)) return [200, {accepted: true, duplicate: true}];
  const meta = {
    gameId: req.gameId,
    spectatorId: req.spectatorId,
    name: String(req.name ?? '').slice(0, 200),
    seed: typeof req.seed === 'number' ? req.seed : null,
    createdAt: new Date().toISOString(),
    players: req.players.slice(0, 8).map((p) => ({
      color: String(p.color),
      name: String(p.name ?? '').slice(0, 80),
      ...(p.claude === true ? {claude: true} : {key: typeof p.slackUserId === 'string' && p.slackUserId !== '' ? personKey(salt, p.slackUserId) : `name_${String(p.name ?? '')}`}),
    })),
  };
  fs.writeFileSync(file, JSON.stringify(meta, null, 1));
  return [202, {accepted: true}];
}

const git = (...args) => execFileSync('git', ['-C', LEAGUE, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();

// Same lock directory the supervisors take in run-seat.sh before touching the league checkout.
const LOCK = path.join(HOME, 'league.lock');
function withLeagueLock(fn) {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 120; i++) {
    try { fs.mkdirSync(LOCK); break; } catch { Atomics.wait(pause, 0, 0, 1000); }
    if (i === 119) log('league lock held for 2 minutes; taking it');
  }
  try { return fn(); } finally { fs.rmSync(LOCK, {recursive: true, force: true}); }
}

function saveRecord(summary, full) {
  fs.writeFileSync(path.join(LEAGUE, 'games', summary.id + '.json.gz'), zlib.gzipSync(JSON.stringify(full)));
  const index = path.join(LEAGUE, 'games.json');
  let all = [];
  try { all = JSON.parse(fs.readFileSync(index, 'utf8')); } catch { /* first game */ }
  all = all.filter((g) => g.id !== summary.id).concat(summary).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  fs.writeFileSync(index, JSON.stringify(all));
  if (!fs.existsSync(path.join(LEAGUE, '.git'))) { log(`league: saved ${summary.id} locally (${LEAGUE} is not a git checkout)`); return; }
  try {
    git('add', 'games.json', 'games');
    git('-c', 'user.name=TM league collector', '-c', 'user.email=noreply@anthropic.com', 'commit', '-q', '-m', `game: ${summary.name} (${summary.players.length} players, ${summary.generations} generations)`);
    try { git('pull', '-q', '--rebase'); git('push', '-q'); log(`league: saved and pushed ${summary.id}`); } catch (err) { log(`league: saved ${summary.id}, committed locally, push failed: ${String(err.stderr || err.message).trim().slice(0, 300)}`); }
  } catch (err) {
    log(`league: saved ${summary.id}, commit failed: ${String(err.stderr || err.message).trim().slice(0, 300)}`);
  }
}

let collecting = false;
async function collect() {
  if (collecting) return;
  collecting = true;
  try {
    for (const f of fs.readdirSync(PENDING).filter((x) => x.endsWith('.json'))) {
      const file = path.join(PENDING, f);
      const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
      try {
        const got = await fetchGame(ORIGIN, meta.spectatorId);
        if (got.gone || Date.now() - Date.parse(meta.createdAt) > FORGET_AFTER_DAYS * 86400e3) {
          log(`league: giving up on ${meta.gameId}: ${got.gone ? 'the server no longer has it (' + got.why + ')' : 'not finished after ' + FORGET_AFTER_DAYS + ' days'}`);
          fs.rmSync(file); continue;
        }
        if (!got.ended) continue;
        // Claude's seat is "Claude" to the table; which model played it is only recorded here.
        const model = jobs().find((j) => j.job.gameId === meta.gameId)?.job.model;
        for (const p of meta.players) if (p.claude) { p.claudeModel = model ?? 'unknown'; p.key = `claude-${p.claudeModel}`; }
        const summary = buildSummary(meta, got.spec, got.endedAt, got.logs);
        const full = buildFull(summary, got.spec, got.logs);
        withLeagueLock(() => saveRecord(summary, full));
        fs.rmSync(file);
      } catch (err) {
        log(`league: ${meta.gameId} not collected this round: ${err.message}`);
      }
    }
  } finally { collecting = false; }
}
setInterval(collect, COLLECT_EVERY_MS).unref();

const server = http.createServer((req, res) => {
  const send = (status, obj) => { res.writeHead(status, {'Content-Type': 'application/json'}); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url === '/health') {
    return send(200, {ok: true, running: jobs().filter((j) => !j.done).length, maxConcurrent: MAX_CONCURRENT});
  }
  if (req.method !== 'POST' || (req.url !== '/seat' && req.url !== '/game')) return send(404, {error: 'not found'});
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { send(413, {error: 'body too large'}); req.destroy(); } else chunks.push(c); });
  req.on('end', () => {
    if (size > MAX_BODY) return;
    const body = Buffer.concat(chunks).toString('utf8');
    const why = verify(secret, req.headers['x-tm-timestamp'], req.headers['x-tm-signature'], body);
    if (why) { log(`rejected ${req.url}: ${why}`); return send(401, {error: why}); }
    let status, obj;
    try { [status, obj] = req.url === '/seat' ? accept(body) : acceptGame(body); } catch (err) { log('accept failed:', err); return send(500, {error: `runner error: ${err.message}`}); }
    log(`${req.url} -> ${status}`, obj.error ?? (obj.duplicate ? 'duplicate' : 'accepted'));
    send(status, obj);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on 127.0.0.1:${PORT}; home ${HOME}; seats on ${ORIGIN}; limits ${MAX_CONCURRENT} at once, ${MAX_PER_DAY} per day; models ${MODELS.join(' | ')}`);
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
