/**
 * Hand-off of the "Claude plays" seat to a machine that plays it unattended
 * (see claude-runner/).
 *
 * When CLAUDE_RUNNER_URL and CLAUDE_RUNNER_SECRET are both set, the bot POSTs
 * Claude's player link to the runner instead of DMing it to a human operator.
 * If the runner cannot be reached or declines the seat, the caller falls back
 * to the operator DM, so a dead runner degrades to the manual flow.
 *
 * Requests in both directions are signed (claude-runner/sign.mjs is the other
 * implementation of the same scheme):
 *
 *   X-TM-Timestamp: <unix seconds>
 *   X-TM-Signature: v1=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
 */

import crypto from 'node:crypto';

export const MAX_SKEW_SECONDS = 300;
const DISPATCH_TIMEOUT_MS = 8000;

export interface RunnerConfig {
  /** Origin of the runner, e.g. https://machine.tailnet.ts.net (no trailing slash). */
  url: string;
  secret: string;
}

/** The runner settings, or undefined when the hand-off is not configured. */
export function runnerConfig(): RunnerConfig | undefined {
  const url = process.env.CLAUDE_RUNNER_URL?.trim().replace(/\/+$/, '');
  const secret = process.env.CLAUDE_RUNNER_SECRET?.trim();
  if (url === undefined || url === '' || secret === undefined || secret === '') return undefined;
  return {url, secret};
}

export function signRunnerRequest(secret: string, timestamp: string, body: string): string {
  return 'v1=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Returns undefined when the request is authentic, otherwise the reason it is not. */
export function verifyRunnerSignature(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  body: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string | undefined {
  if (timestamp === undefined || !/^\d{1,12}$/.test(timestamp)) return 'missing or malformed X-TM-Timestamp';
  if (signature === undefined) return 'missing X-TM-Signature';
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return `timestamp is more than ${MAX_SKEW_SECONDS}s from this server's clock`;
  }
  const expected = Buffer.from(signRunnerRequest(secret, timestamp, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return 'signature does not match';
  return undefined;
}

export interface ClaudeSeatRequest {
  playerUrl: string;
  gameName: string;
  hostUserId: string;
  /** Lets the runner connect the seat to the game's league record. */
  gameId: string;
}

/** A game the bot created, for the runner's league collector (claude-runner/league.mjs). */
export interface GameCreatedNotice {
  gameId: string;
  spectatorId: string;
  name: string;
  /** Only the bot knows the seed: the TM server does not show it to spectators. */
  seed: number;
  players: Array<{color: string; name: string; slackUserId?: string; claude?: true}>;
}

export type DispatchResult = {ok: true} | {ok: false; reason: string};

/** Ask the runner to play a seat. Never throws; a failure carries the reason. */
export function dispatchClaudeSeat(
  cfg: RunnerConfig,
  seat: ClaudeSeatRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<DispatchResult> {
  return post(cfg, '/seat', seat, fetchImpl);
}

/**
 * Tell the runner a game exists so that it records the result when the game
 * ends. Sent for every game, with or without Claude. Never throws.
 */
export function notifyGameCreated(
  cfg: RunnerConfig,
  game: GameCreatedNotice,
  fetchImpl: typeof fetch = fetch,
): Promise<DispatchResult> {
  return post(cfg, '/game', game, fetchImpl);
}

async function post(cfg: RunnerConfig, path: string, payload: unknown, fetchImpl: typeof fetch): Promise<DispatchResult> {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const res = await fetchImpl(`${cfg.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TM-Timestamp': timestamp,
        'X-TM-Signature': signRunnerRequest(cfg.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    if (res.ok) return {ok: true};
    const text = await res.text().catch(() => '');
    let said = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as {error?: unknown};
      if (typeof parsed.error === 'string') said = parsed.error;
    } catch { /* not JSON: keep the raw text */ }
    return {ok: false, reason: said !== '' ? said : `HTTP ${res.status}`};
  } catch (err) {
    const cause = err instanceof Error ? ((err.cause as {code?: string} | undefined)?.code ?? err.name) : String(err);
    return {ok: false, reason: `Claude's machine could not be reached (${cause})`};
  }
}
