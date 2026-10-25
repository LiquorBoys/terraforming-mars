/**
 * Operational log posted to a shared Slack channel.
 *
 * Vercel's Hobby plan has one member and keeps runtime logs for about an
 * hour, so the only durable, shareable record of what the bot did is one
 * it writes itself. When SLACK_LOG_CHANNEL is set, every game creation and
 * every failure is posted there. The bot must be a member of the channel
 * (`/invite @terraforming-mars`); `chat:write` covers the rest.
 *
 * Posting is best-effort and never throws - a broken log channel must not
 * take game creation down with it.
 */

import type {WebClient} from '@slack/web-api';

export interface LogPlayer {
  name: string;
  /** Undefined for seats not tied to a Slack user. */
  slackUserId?: string;
  dmFailed: boolean;
}

/** What the host asked for, for the failure record. */
export interface LogAttempt {
  playerCount: number;
  board: string;
  expansions: Array<string>;
}

export type LogEntry =
  | {
    kind: 'created';
    hostUserId: string;
    gameName: string;
    players: Array<LogPlayer>;
    hostDashboardUrl: string;
  }
  | {
    kind: 'failed';
    hostUserId: string;
    attempt: LogAttempt;
    /** Human-readable summary, as DMed to the host. */
    message: string;
    /** From the TM server, when the failure was an HTTP response. */
    status?: number;
    responseBody?: string;
  };

/** Deploy-side context attached to every entry. */
export interface LogContext {
  /** Vercel's x-vercel-id header, for finding the invocation in Vercel's own logs while they last. */
  requestId?: string;
}

/** Channel id or name from SLACK_LOG_CHANNEL; undefined disables logging. */
export function logChannel(): string | undefined {
  const raw = process.env.SLACK_LOG_CHANNEL?.trim();
  return raw === undefined || raw === '' ? undefined : raw;
}

export async function postLog(
  client: WebClient,
  entry: LogEntry,
  ctx: LogContext = {},
): Promise<boolean> {
  const channel = logChannel();
  if (channel === undefined) return false;
  const text = formatLogEntry(entry, ctx);
  try {
    await client.chat.postMessage({channel, text, unfurl_links: false, unfurl_media: false});
    return true;
  } catch (err) {
    // Likely not_in_channel (bot not invited) or channel_not_found.
    console.error('[slack-bot] postLog failed', {channel, error: err instanceof Error ? err.message : String(err)});
    return false;
  }
}

export function formatLogEntry(entry: LogEntry, ctx: LogContext = {}): string {
  const lines: Array<string> = [];
  if (entry.kind === 'created') {
    const seats = entry.players
      .map((p) => {
        const who = p.slackUserId !== undefined ? `<@${p.slackUserId}>` : escapeMrkdwn(p.name);
        return p.dmFailed ? `${who} :warning: DM failed` : who;
      })
      .join(', ');
    lines.push(`:white_check_mark: *${escapeMrkdwn(entry.gameName)}* created by <@${entry.hostUserId}> — ${entry.players.length} seats: ${seats}`);
    lines.push(`<${entry.hostDashboardUrl}|host dashboard>`);
  } else {
    const {attempt} = entry;
    lines.push(`:x: Game creation failed for <@${entry.hostUserId}>`);
    lines.push(`*Error:* ${escapeMrkdwn(entry.message)}`);
    if (entry.status !== undefined) {
      const body = (entry.responseBody ?? '').trim();
      lines.push(`*TM server:* HTTP ${entry.status}${body !== '' ? ` — \`${escapeMrkdwn(body.slice(0, 500))}\`` : ''}`);
    }
    lines.push(`*Requested:* ${attempt.playerCount} players, board \`${attempt.board}\`, expansions ${attempt.expansions.length > 0 ? attempt.expansions.join(', ') : 'none'}`);
  }
  const meta = [
    ctx.requestId !== undefined ? `request \`${ctx.requestId}\`` : undefined,
    deploySha() !== undefined ? `deploy \`${deploySha()}\`` : undefined,
  ].filter((s): s is string => s !== undefined);
  if (meta.length > 0) lines.push(`_${meta.join(' · ')}_`);
  return lines.join('\n');
}

/** Short git SHA of the running deploy, from Vercel's system env. */
function deploySha(): string | undefined {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  return sha === undefined || sha === '' ? undefined : sha.slice(0, 7);
}

function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
