/**
 * /tm-newgame slash command handler. Opens the new-game modal.
 *
 * Bolt invokes this with `{ack, body, client}`. We ack first (clears the
 * "command sent" hourglass in Slack), then open the view.
 */

import type {
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from '@slack/bolt';
import {buildNewGameView} from '../views/newGameView.js';
import {postLog} from '../slack/log.js';

export const SLASH_COMMAND = '/tm-newgame';

export async function onSlashCommand(
  args: SlackCommandMiddlewareArgs & AllMiddlewareArgs,
): Promise<void> {
  const {ack, body, client, logger, respond, context} = args;
  await ack();

  try {
    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildNewGameView({
        hostUserId: body.user_id,
        channelId: body.channel_id,
      }),
    });
  } catch (err) {
    const code = slackErrorCode(err);
    logger.error('[slack-bot] views.open failed', err);
    // The hourglass is already cleared by ack(), so without this the user
    // sees nothing at all. respond() uses the command's response_url, which
    // works in channels the bot hasn't joined.
    try {
      await respond({
        response_type: 'ephemeral',
        text: `:warning: Couldn't open the new-game form (\`${code}\`). Please try /tm-newgame again.`,
      });
    } catch (respondErr) {
      logger.error('[slack-bot] slash command respond failed', respondErr);
    }
    await postLog(client, {
      kind: 'modal_failed',
      hostUserId: body.user_id,
      channelId: body.channel_id,
      errorCode: code,
    }, {requestId: typeof context.requestId === 'string' ? context.requestId : undefined});
  }
}

/** Slack's error string (e.g. `expired_trigger_id`) when present, else the message. */
function slackErrorCode(err: unknown): string {
  const data = (err as {data?: {error?: unknown}} | undefined)?.data;
  if (typeof data?.error === 'string') return data.error;
  return err instanceof Error ? err.message : String(err);
}
