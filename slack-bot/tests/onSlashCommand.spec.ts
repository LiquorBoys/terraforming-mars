import {afterEach, describe, expect, it, vi} from 'vitest';
import {onSlashCommand} from '../src/handlers/onSlashCommand.js';

function makeArgs(opts: {openError?: unknown; respondFails?: boolean} = {}) {
  const posted: Array<{channel: string; text: string}> = [];
  const client = {
    views: {
      open: vi.fn(async () => {
        if (opts.openError !== undefined) throw opts.openError;
        return {ok: true};
      }),
    },
    chat: {
      postMessage: vi.fn(async (a: {channel: string; text: string}) => {
        posted.push(a);
        return {ok: true};
      }),
    },
  };
  const ack = vi.fn(async () => {});
  const respond = vi.fn(async () => {
    if (opts.respondFails) throw new Error('response_url dead');
  });
  const logger = {error: vi.fn()};
  const args = {
    ack,
    respond,
    client,
    logger,
    context: {requestId: 'iad1::req'},
    body: {trigger_id: 'T1', user_id: 'U_HOST', channel_id: 'C_CHAN'},
  };
  // The handler only touches these fields of Bolt's args.
  return {args: args as unknown as Parameters<typeof onSlashCommand>[0], client, ack, respond, logger, posted};
}

afterEach(() => {
  delete process.env.SLACK_LOG_CHANNEL;
});

describe('onSlashCommand', () => {
  it('acks then opens the modal without responding on success', async () => {
    const {args, client, ack, respond} = makeArgs();
    await onSlashCommand(args);
    expect(ack).toHaveBeenCalledOnce();
    expect(client.views.open).toHaveBeenCalledOnce();
    expect(respond).not.toHaveBeenCalled();
  });

  it('tells the user and logs the Slack error code when views.open fails', async () => {
    process.env.SLACK_LOG_CHANNEL = 'C_LOG';
    const {args, respond, posted} = makeArgs({openError: Object.assign(new Error('An API error occurred: expired_trigger_id'), {data: {error: 'expired_trigger_id'}})});
    await onSlashCommand(args);
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({
      response_type: 'ephemeral',
      text: expect.stringContaining('expired_trigger_id'),
    }));
    expect(posted).toHaveLength(1);
    expect(posted[0]!.channel).toBe('C_LOG');
    expect(posted[0]!.text).toContain('expired_trigger_id');
  });

  it('still logs when respond() also fails, and never throws', async () => {
    process.env.SLACK_LOG_CHANNEL = 'C_LOG';
    const {args, posted, logger} = makeArgs({openError: new Error('boom'), respondFails: true});
    await expect(onSlashCommand(args)).resolves.toBeUndefined();
    expect(posted).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
