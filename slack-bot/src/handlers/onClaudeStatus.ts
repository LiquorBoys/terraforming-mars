/**
 * What the Claude runner reports back about a seat it took (see
 * claude-runner/notify.mjs), turned into Slack messages.
 *
 *   failed: Claude stopped playing while the game was live. The host is DMed
 *           the reason and Claude's seat link, so a person can take it over.
 *   ended:  the game finished. The host is DMed where Claude placed.
 *
 * Both also go to the shared log channel when one is configured.
 */

import type {WebClient} from '@slack/web-api';
import {postLog} from '../slack/log.js';

export interface ClaudeStanding {
  name: string;
  color: string;
  vp: number | null;
}

export interface ClaudeStatus {
  event: 'ended' | 'failed';
  gameName: string;
  hostUserId: string;
  detail: string;
  /** Present on `failed` only. */
  playerUrl?: string;
  claudeColor?: string;
  standings?: Array<ClaudeStanding>;
}

const SLACK_USER_ID = /^[UW][A-Z0-9]{6,}$/;

/** Returns undefined for anything that is not a well-formed status payload. */
export function parseClaudeStatus(raw: string): ClaudeStatus | undefined {
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return undefined; }
  if (typeof v !== 'object' || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (o.event !== 'ended' && o.event !== 'failed') return undefined;
  if (typeof o.gameName !== 'string' || typeof o.hostUserId !== 'string') return undefined;
  const standings = Array.isArray(o.standings) ?
    o.standings.flatMap((s): Array<ClaudeStanding> => {
      if (typeof s !== 'object' || s === null) return [];
      const r = s as Record<string, unknown>;
      if (typeof r.name !== 'string' || typeof r.color !== 'string') return [];
      return [{name: r.name, color: r.color, vp: typeof r.vp === 'number' ? r.vp : null}];
    }) :
    undefined;
  return {
    event: o.event,
    gameName: o.gameName,
    hostUserId: o.hostUserId,
    detail: typeof o.detail === 'string' ? o.detail : '',
    ...(typeof o.playerUrl === 'string' ? {playerUrl: o.playerUrl} : {}),
    ...(typeof o.claudeColor === 'string' ? {claudeColor: o.claudeColor} : {}),
    ...(standings !== undefined ? {standings} : {}),
  };
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

/** The message for the host. `withSeatLink` is false for the shared log channel. */
export function formatClaudeStatus(s: ClaudeStatus, withSeatLink: boolean): string {
  const game = `*${escapeMrkdwn(s.gameName !== '' ? s.gameName : 'your game')}*`;
  if (s.event === 'failed') {
    const why = s.detail !== '' ? escapeMrkdwn(s.detail) : 'no reason was reported';
    const takeover = withSeatLink && s.playerUrl !== undefined ?
      `\nIts seat is here if someone wants to take it over: ${s.playerUrl}` :
      '';
    return `:warning: Claude has stopped playing in ${game}: ${why}.${takeover}`;
  }
  const standings = s.standings ?? [];
  const place = standings.findIndex((p) => p.color === s.claudeColor);
  const claude = place >= 0 ? standings[place] : undefined;
  if (claude === undefined || claude.vp === null) {
    return `:checkered_flag: ${game} is over. Claude played to the end${s.detail !== '' ? ` (${escapeMrkdwn(s.detail)})` : ''}.`;
  }
  const winner = standings[0];
  const rest = place === 0 || winner === undefined || winner.vp === null ?
    '' :
    `; ${escapeMrkdwn(winner.name)} won with ${winner.vp}`;
  return `:checkered_flag: ${game} is over. Claude finished ${ORDINALS[place] ?? `#${place + 1}`} of ${standings.length} with ${claude.vp} VP${rest}.`;
}

export async function onClaudeStatus(client: WebClient, s: ClaudeStatus): Promise<void> {
  if (SLACK_USER_ID.test(s.hostUserId)) {
    try {
      const dm = await client.conversations.open({users: s.hostUserId});
      const channel = dm.channel?.id;
      if (channel !== undefined) {
        await client.chat.postMessage({channel, text: formatClaudeStatus(s, true), unfurl_links: false, unfurl_media: false});
      }
    } catch (err) {
      console.error('[slack-bot] Claude status DM failed', {hostUserId: s.hostUserId, error: err instanceof Error ? err.message : String(err)});
    }
  }
  await postLog(client, {kind: 'claude_seat', text: formatClaudeStatus(s, false)});
}

function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
