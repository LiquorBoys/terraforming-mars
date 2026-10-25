import {afterEach, describe, expect, it, vi} from 'vitest';
import type {WebClient} from '@slack/web-api';
import {formatLogEntry, logChannel, postLog, type LogEntry} from '../src/slack/log.js';

type PostArgs = {channel: string; text: string};

function fakeClient(opts: {fails?: boolean} = {}) {
  const posted: Array<PostArgs> = [];
  const client = {
    chat: {
      postMessage: vi.fn(async (args: PostArgs) => {
        if (opts.fails) throw new Error('not_in_channel');
        posted.push(args);
        return {ok: true};
      }),
    },
  };
  return {client: client as unknown as WebClient, posted};
}

const created: LogEntry = {
  kind: 'created',
  hostUserId: 'U_HOST',
  gameName: 'g-Olympus',
  hostDashboardUrl: 'https://tm.example/game?id=g1',
  players: [
    {name: 'Alice', slackUserId: 'U_ALICE', dmFailed: false},
    {name: 'Bob', slackUserId: 'U_BOB', dmFailed: true},
    {name: 'Claude', dmFailed: false},
  ],
};

const failed: LogEntry = {
  kind: 'failed',
  hostUserId: 'U_HOST',
  message: 'Terraforming Mars rejected the request (HTTP 500). Internal server error',
  status: 500,
  responseBody: "Internal server error: Cannot read properties of undefined (reading 'length')",
  attempt: {playerCount: 3, board: 'random all', expansions: ['corpera', 'venus']},
};

afterEach(() => {
  delete process.env.SLACK_LOG_CHANNEL;
  delete process.env.VERCEL_GIT_COMMIT_SHA;
});

describe('logChannel', () => {
  it('is undefined when unset or blank', () => {
    expect(logChannel()).toBeUndefined();
    process.env.SLACK_LOG_CHANNEL = '   ';
    expect(logChannel()).toBeUndefined();
  });

  it('trims the configured value', () => {
    process.env.SLACK_LOG_CHANNEL = ' C123 ';
    expect(logChannel()).toBe('C123');
  });
});

describe('postLog', () => {
  it('does nothing when no channel is configured', async () => {
    const {client, posted} = fakeClient();
    expect(await postLog(client, created)).toBe(false);
    expect(posted).toHaveLength(0);
  });

  it('posts to the configured channel', async () => {
    process.env.SLACK_LOG_CHANNEL = 'C_LOG';
    const {client, posted} = fakeClient();
    expect(await postLog(client, created, {requestId: 'iad1::abc'})).toBe(true);
    expect(posted).toHaveLength(1);
    expect(posted[0]!.channel).toBe('C_LOG');
    expect(posted[0]!.text).toContain('g-Olympus');
  });

  it('reports failure instead of throwing when the post is rejected', async () => {
    process.env.SLACK_LOG_CHANNEL = 'C_LOG';
    const {client} = fakeClient({fails: true});
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(postLog(client, failed)).resolves.toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('formatLogEntry', () => {
  it('names the host and every seat, flagging failed DMs and unlinked seats', () => {
    const text = formatLogEntry(created);
    expect(text).toContain('<@U_HOST>');
    expect(text).toContain('<@U_ALICE>');
    expect(text).toContain('<@U_BOB> :warning: DM failed');
    expect(text).toContain('Claude');
    expect(text).toContain('3 seats');
    expect(text).toContain('https://tm.example/game?id=g1');
  });

  it('carries the server status and body plus what was requested on failure', () => {
    const text = formatLogEntry(failed, {requestId: 'iad1::abc'});
    expect(text).toContain(':x:');
    expect(text).toContain('HTTP 500');
    expect(text).toContain("reading 'length'");
    expect(text).toContain('3 players');
    expect(text).toContain('random all');
    expect(text).toContain('corpera, venus');
    expect(text).toContain('request `iad1::abc`');
  });

  it('escapes mrkdwn control characters from server-supplied text', () => {
    const text = formatLogEntry({...failed, responseBody: '<script>&'});
    expect(text).toContain('&lt;script&gt;&amp;');
    expect(text).not.toContain('<script>');
  });

  it('adds the deploy SHA when Vercel supplies one, and omits the meta line otherwise', () => {
    expect(formatLogEntry(created)).not.toMatch(/deploy|request/);
    process.env.VERCEL_GIT_COMMIT_SHA = 'a53ba4a65deadbeef';
    expect(formatLogEntry(created)).toContain('deploy `a53ba4a`');
  });
});
