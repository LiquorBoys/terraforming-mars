#!/usr/bin/env node
// Tells the Slack bot what happened to a seat, so it can tell the people in the game.
// Usage: node notify.mjs <gameDir> <ended|failed> [detail]
//
// Never fails the caller: a seat's outcome must not depend on Slack being reachable. Every path
// prints one line saying what was sent or why nothing was.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sign} from './sign.mjs';

const [gameDir, event, detail = ''] = process.argv.slice(2);
const env = process.env;
const HOME = env.TM_RUNNER_HOME || path.join(os.homedir(), 'tm-claude');
const statusUrl = env.TM_STATUS_URL;
const read = (f) => { try { return fs.readFileSync(f, 'utf8').trim(); } catch { return undefined; } };

const job = JSON.parse(fs.readFileSync(path.join(gameDir, 'job.json'), 'utf8'));
const payload = {event, gameName: job.gameName, hostUserId: job.hostUserId, detail};
// Only a failure hands the seat link back: it lets a person take the seat over.
if (event === 'failed') payload.playerUrl = job.playerUrl;

if (event === 'ended') {
  try {
    const u = new URL(job.playerUrl);
    const r = await fetch(`${u.origin}/api/player?id=${u.searchParams.get('id')}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = await r.json();
    payload.claudeColor = v.thisPlayer?.color;
    payload.standings = v.players
      .map((p) => ({name: p.name, color: p.color, vp: p.victoryPointsBreakdown?.total ?? null}))
      .sort((a, b) => (b.vp ?? -1) - (a.vp ?? -1));
  } catch (err) {
    payload.detail = `${detail} (final standings unavailable: ${err.message})`.trim();
  }
}

if (!statusUrl) { console.log(`notify ${event}: TM_STATUS_URL is not set, nothing sent. Payload: ${JSON.stringify({...payload, playerUrl: payload.playerUrl ? '<seat link>' : undefined})}`); process.exit(0); }
const secret = read(env.TM_RUNNER_SECRET_FILE || path.join(HOME, 'runner-secret'));
if (!secret) { console.log(`notify ${event}: no shared secret readable, nothing sent`); process.exit(0); }

// Sent as text/plain: a JSON content type would let the receiving platform parse and re-serialise
// the body, and the signature is over these exact bytes.
const body = JSON.stringify(payload);
const ts = String(Math.floor(Date.now() / 1000));
try {
  const r = await fetch(statusUrl, {method: 'POST', headers: {'Content-Type': 'text/plain; charset=utf-8', 'X-TM-Timestamp': ts, 'X-TM-Signature': sign(secret, ts, body)}, body, signal: AbortSignal.timeout(20000)});
  console.log(`notify ${event}: bot answered HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
} catch (err) {
  console.log(`notify ${event}: could not reach the bot: ${err.cause?.code ?? err.message}`);
}
