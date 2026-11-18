import {afterEach, describe, expect, it, vi} from 'vitest';
import type {WebClient} from '@slack/web-api';
import {
  dispatchClaudeSeat,
  runnerConfig,
  signRunnerRequest,
  verifyRunnerSignature,
} from '../src/runner.js';
import {
  formatClaudeStatus,
  onClaudeStatus,
  parseClaudeStatus,
} from '../src/handlers/onClaudeStatus.js';
import {buildHostSummaryFromGameModel, dmHostSummary} from '../src/slack/notify.js';

const SECRET = 's'.repeat(64);
const NOW = 1_800_000_000;
const SEAT = {playerUrl: 'https://tm.example/player?id=pc0ffee', gameName: 'Mars-42', hostUserId: 'U0HOST123'};

afterEach(() => {
  delete process.env.CLAUDE_RUNNER_URL;
  delete process.env.CLAUDE_RUNNER_SECRET;
  delete process.env.SLACK_LOG_CHANNEL;
});

describe('runner config', () => {
  it('needs both the URL and the secret', () => {
    expect(runnerConfig()).toBeUndefined();
    process.env.CLAUDE_RUNNER_URL = 'https://runner.example/';
    expect(runnerConfig()).toBeUndefined();
    process.env.CLAUDE_RUNNER_SECRET = SECRET;
    expect(runnerConfig()).toEqual({url: 'https://runner.example', secret: SECRET});
  });
});

describe('request signing', () => {
  it('produces the same signature as the runner implementation', async () => {
    // The runner is plain JavaScript outside the TypeScript project; load it by path.
    const path = '../claude-runner/sign.mjs';
    const runner = await import(/* @vite-ignore */ path) as {
      sign: (secret: string, ts: string, body: string) => string;
      verify: (secret: string, ts: string, sig: string, body: string, now: number) => string | undefined;
    };
    const body = JSON.stringify(SEAT);
    const ours = signRunnerRequest(SECRET, String(NOW), body);
    expect(ours).toBe(runner.sign(SECRET, String(NOW), body));
    expect(runner.verify(SECRET, String(NOW), ours, body, NOW)).toBeUndefined();
    expect(verifyRunnerSignature(SECRET, String(NOW), runner.sign(SECRET, String(NOW), body), body, NOW)).toBeUndefined();
  });

  it('rejects a wrong secret, a changed body, an old timestamp and missing headers', () => {
    const body = '{"a":1}';
    const sig = signRunnerRequest(SECRET, String(NOW), body);
    expect(verifyRunnerSignature(SECRET, String(NOW), sig, body, NOW)).toBeUndefined();
    expect(verifyRunnerSignature('x'.repeat(64), String(NOW), sig, body, NOW)).toBe('signature does not match');
    expect(verifyRunnerSignature(SECRET, String(NOW), sig, '{"a":2}', NOW)).toBe('signature does not match');
    expect(verifyRunnerSignature(SECRET, String(NOW), sig, body, NOW + 301)).toMatch(/more than 300s/);
    expect(verifyRunnerSignature(SECRET, undefined, sig, body, NOW)).toMatch(/X-TM-Timestamp/);
    expect(verifyRunnerSignature(SECRET, String(NOW), undefined, body, NOW)).toMatch(/X-TM-Signature/);
  });
});

describe('dispatchClaudeSeat', () => {
  const cfg = {url: 'https://runner.example', secret: SECRET};

  it('POSTs a verifiable request to /seat', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{"accepted":true}', {status: 202}));
    expect(await dispatchClaudeSeat(cfg, SEAT, fetchImpl as unknown as typeof fetch)).toEqual({ok: true});
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://runner.example/seat');
    const headers = init!.headers as Record<string, string>;
    const body = init!.body as string;
    expect(JSON.parse(body)).toEqual(SEAT);
    expect(verifyRunnerSignature(SECRET, headers['X-TM-Timestamp'], headers['X-TM-Signature'], body)).toBeUndefined();
  });

  it("passes the runner's own reason through when it declines", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"Claude is already playing 2 games, which is the limit."}', {status: 429}));
    expect(await dispatchClaudeSeat(cfg, SEAT, fetchImpl as unknown as typeof fetch))
      .toEqual({ok: false, reason: 'Claude is already playing 2 games, which is the limit.'});
  });

  it('reports an unreachable runner instead of throwing', async () => {
    const fetchImpl = vi.fn(async () => { throw Object.assign(new TypeError('fetch failed'), {cause: {code: 'ECONNREFUSED'}}); });
    expect(await dispatchClaudeSeat(cfg, SEAT, fetchImpl as unknown as typeof fetch))
      .toEqual({ok: false, reason: "Claude's machine could not be reached (ECONNREFUSED)"});
  });
});

describe('host summary when a runner is configured', () => {
  const players = [
    {id: 'pALICE', name: 'Alice', color: 'red' as const},
    {id: 'pCLAUDE', name: 'Claude', color: 'orange' as const},
  ];
  const claude = {color: 'orange' as const, operatorUserId: 'U_OP'};
  const summaryFor = (claudeResult: Parameters<typeof buildHostSummaryFromGameModel>[2][number]) =>
    buildHostSummaryFromGameModel(players, {red: 'U_ALICE'}, [{slackUserId: 'U_ALICE', ok: true, color: 'red'}, claudeResult],
      'https://tm.example', 'Mars-42', 'https://tm.example/game?id=g1', undefined, undefined, claude);
  const hostText = async (summary: ReturnType<typeof summaryFor>) => {
    const posted: Array<{blocks: unknown}> = [];
    const client = {
      conversations: {open: async () => ({channel: {id: 'D1'}})},
      chat: {postMessage: async (a: {blocks: unknown}) => { posted.push(a); return {ok: true}; }},
    } as unknown as WebClient;
    await dmHostSummary(client, 'U_HOST', summary);
    return JSON.stringify(posted[0]!.blocks);
  };

  it('says Claude is joining on its own when the runner took the seat', async () => {
    const summary = summaryFor({slackUserId: 'U_OP', ok: true, color: 'orange', viaRunner: true});
    expect(summary.players.find((p) => p.color === 'orange')).toMatchObject({isClaude: true, claudeAuto: true, dmFailed: false});
    const text = await hostText(summary);
    expect(text).toContain('joining on its own');
    expect(text).not.toContain('link sent to');
  });

  it('says why the runner declined when the seat fell back to the operator', async () => {
    const summary = summaryFor({slackUserId: 'U_OP', ok: true, color: 'orange', runnerNote: 'Claude is already playing 2 games, which is the limit.'});
    expect(summary.players.find((p) => p.color === 'orange')!.claudeAuto).toBeUndefined();
    const text = await hostText(summary);
    expect(text).toContain('Claude could not join on its own: Claude is already playing 2 games');
    expect(text).toContain('link sent to <@U_OP>');
  });
});

describe('status reports from the runner', () => {
  const standings = [
    {name: 'Alice', color: 'red', vp: 80},
    {name: 'Claude', color: 'orange', vp: 71},
    {name: 'Bob', color: 'blue', vp: 60},
  ];

  it('parses well-formed payloads and rejects the rest', () => {
    expect(parseClaudeStatus('nope')).toBeUndefined();
    expect(parseClaudeStatus('{"event":"joined","gameName":"g","hostUserId":"U1"}')).toBeUndefined();
    expect(parseClaudeStatus('{"event":"failed","gameName":"g"}')).toBeUndefined();
    expect(parseClaudeStatus(JSON.stringify({event: 'failed', gameName: 'g', hostUserId: 'U0HOST123', detail: 'd', playerUrl: 'https://tm.example/player?id=p1'})))
      .toEqual({event: 'failed', gameName: 'g', hostUserId: 'U0HOST123', detail: 'd', playerUrl: 'https://tm.example/player?id=p1'});
  });

  it('gives the host the reason and the seat link on failure, and keeps the link out of the log', () => {
    const s = {event: 'failed' as const, gameName: 'Mars <42>', hostUserId: 'U0HOST123', detail: 'the per-game budget of $300 was reached', playerUrl: 'https://tm.example/player?id=p1'};
    const dm = formatClaudeStatus(s, true);
    expect(dm).toContain('Claude has stopped playing in *Mars &lt;42&gt;*: the per-game budget of $300 was reached.');
    expect(dm).toContain('https://tm.example/player?id=p1');
    expect(formatClaudeStatus(s, false)).not.toContain('player?id=');
  });

  it("reports Claude's place and the winner at the end", () => {
    const s = {event: 'ended' as const, gameName: 'Mars-42', hostUserId: 'U0HOST123', detail: '', claudeColor: 'orange', standings};
    expect(formatClaudeStatus(s, true)).toBe(':checkered_flag: *Mars-42* is over. Claude finished 2nd of 3 with 71 VP; Alice won with 80.');
    expect(formatClaudeStatus({...s, claudeColor: 'red'}, true)).toBe(':checkered_flag: *Mars-42* is over. Claude finished 1st of 3 with 80 VP.');
    expect(formatClaudeStatus({...s, standings: undefined}, true)).toBe(':checkered_flag: *Mars-42* is over. Claude played to the end.');
  });

  it('DMs the host and posts to the log channel', async () => {
    process.env.SLACK_LOG_CHANNEL = 'C_LOG';
    const posted: Array<{channel: string; text: string}> = [];
    const client = {
      conversations: {open: vi.fn(async ({users}: {users: string}) => ({channel: {id: `D_${users}`}}))},
      chat: {postMessage: vi.fn(async (a: {channel: string; text: string}) => { posted.push(a); return {ok: true}; })},
    } as unknown as WebClient;
    await onClaudeStatus(client, {event: 'failed', gameName: 'Mars-42', hostUserId: 'U0HOST123', detail: 'boom', playerUrl: 'https://tm.example/player?id=p1'});
    expect(posted.map((p) => p.channel)).toEqual(['D_U0HOST123', 'C_LOG']);
    expect(posted[0]!.text).toContain('player?id=p1');
    expect(posted[1]!.text).not.toContain('player?id=');

    posted.length = 0;
    await onClaudeStatus(client, {event: 'failed', gameName: 'test', hostUserId: 'not-a-slack-id', detail: 'boom'});
    expect(posted.map((p) => p.channel)).toEqual(['C_LOG']);
  });
});
