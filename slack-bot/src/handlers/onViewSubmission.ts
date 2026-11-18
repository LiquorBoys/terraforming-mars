/**
 * tm_newgame_modal view_submission handler.
 *
 * 1. Parse view.state.values into a typed shape.
 * 2. Validate. If errors, ack with response_action='errors' (keeps modal open).
 * 3. Otherwise ack() to close the modal.
 * 4. Schedule background work via waitUntil:
 *    - Look up each Slack user's display name (users.info).
 *    - Build the NewGameConfig.
 *    - POST it to /api/creategame.
 *    - DM each player their link, then DM the host a summary. The summary
 *      carries a "New game, same settings" button holding this submission.
 *    - If Claude plays and a runner is configured (src/runner.ts), its link
 *      goes to the runner, which plays the seat unattended. Without a
 *      runner, or if the runner declines, the link goes to the Claude
 *      operator instead (env id/name, else DEFAULT_CLAUDE_OPERATOR resolved
 *      by name, else the host).
 *    - On failure, DM the host the error.
 *    - Either way, post a line to SLACK_LOG_CHANNEL if configured.
 */

import type {
  AllMiddlewareArgs,
  SlackViewMiddlewareArgs,
  ViewSubmitAction,
} from '@slack/bolt';
import {waitUntil} from '@vercel/functions';

import {decodePrivateMetadata} from '../views/newGameView.js';
import {
  isErrors,
  parseSubmission,
  toNewGameConfig,
  toPrefill,
} from './parseSubmission.js';
import {encodePrefill} from '../views/prefill.js';
import {
  createGame,
  hostGameUrl,
  playerUrl,
  spectatorUrl,
  tmBaseUrl,
  TmApiError,
} from '../tm/createGame.js';
import {
  buildHostSummaryFromGameModel,
  dmClaudeSeat,
  dmHostError,
  dmHostSummary,
  dmPlayerLink,
  lookupDisplayName,
  type ClaudeSeat,
  type PlayerDmResult,
} from '../slack/notify.js';
import {claudePlayerName, resolveClaudeOperator} from '../claude.js';
import {postLog} from '../slack/log.js';
import {dispatchClaudeSeat, notifyGameCreated, runnerConfig} from '../runner.js';

export {VIEW_CALLBACK_ID} from '../views/newGameView.js';

export async function onViewSubmission(
  args: SlackViewMiddlewareArgs<ViewSubmitAction> & AllMiddlewareArgs,
): Promise<void> {
  const {ack, view, client, logger, context} = args;
  const requestId = typeof context.requestId === 'string' ? context.requestId : undefined;

  const state = view.state.values as Record<string, Record<string, unknown>>;
  const parsed = parseSubmission(state);

  if (isErrors(parsed)) {
    await ack({response_action: 'errors', errors: parsed.errors});
    return;
  }

  await ack();

  const meta = decodePrivateMetadata(view.private_metadata);

  waitUntil(
    (async () => {
      try {
        // Look up display names in parallel.
        const lookups = await Promise.all(
          parsed.slots.map(async (s) => {
            const name = await lookupDisplayName(client, s.slackUserId);
            return [s.slackUserId, name] as const;
          }),
        );
        const nameMap = new Map<string, string | undefined>(lookups);

        const claudeName = claudePlayerName();
        const {config, slackUserIdByColor, claudeColor} =
          toNewGameConfig(parsed, (id) => nameMap.get(id), claudeName);
        const claude: ClaudeSeat | undefined = claudeColor !== undefined ?
          {color: claudeColor, operatorUserId: await resolveClaudeOperator(client, meta.hostUserId)} :
          undefined;

        const game = await createGame(config);
        const base = tmBaseUrl();

        const dmResults: Array<PlayerDmResult> = await Promise.all(
          game.players.map(async (player) => {
            const url = playerUrl(base, player.id);
            if (claude !== undefined && player.color === claude.color) {
              const runner = runnerConfig();
              let runnerNote: string | undefined;
              if (runner !== undefined) {
                const sent = await dispatchClaudeSeat(runner, {playerUrl: url, gameName: game.name, hostUserId: meta.hostUserId, gameId: game.id});
                if (sent.ok) return {slackUserId: claude.operatorUserId, ok: true, color: player.color, viaRunner: true};
                logger.warn('[slack-bot] Claude runner did not take the seat, falling back to the operator DM', {reason: sent.reason});
                runnerNote = sent.reason;
              }
              const dm = await dmClaudeSeat(
                client,
                claude.operatorUserId,
                player.name,
                game.name,
                url,
                meta.hostUserId,
                player.color,
              );
              return runnerNote !== undefined ? {...dm, runnerNote} : dm;
            }
            const slackUserId = slackUserIdByColor[player.color] ?? '';
            const result = await dmPlayerLink(client, slackUserId, player.name, game.name, url);
            return {...result, color: player.color};
          }),
        );

        // Every game goes into the league record, with or without Claude. Without
        // a spectator id there is nothing the collector could read later.
        const runner = runnerConfig();
        if (runner !== undefined && game.spectatorId !== undefined) {
          const noted = await notifyGameCreated(runner, {
            gameId: game.id,
            spectatorId: game.spectatorId,
            name: game.name,
            seed: config.seed,
            players: game.players.map((p) => claude !== undefined && p.color === claude.color ?
              {color: p.color, name: p.name, claude: true as const} :
              {color: p.color, name: p.name, slackUserId: slackUserIdByColor[p.color] ?? ''}),
          });
          if (!noted.ok) logger.warn('[slack-bot] game not registered with the league collector', {reason: noted.reason});
        }

        const summary = buildHostSummaryFromGameModel(
          game.players,
          slackUserIdByColor,
          dmResults,
          base,
          game.name,
          hostGameUrl(base, game.id),
          game.spectatorId !== undefined ? spectatorUrl(base, game.spectatorId) : undefined,
          encodePrefill(toPrefill(parsed)),
          claude,
        );
        await dmHostSummary(client, meta.hostUserId, summary);
        await postLog(client, {
          kind: 'created',
          hostUserId: meta.hostUserId,
          gameName: game.name,
          hostDashboardUrl: summary.hostDashboardUrl,
          players: summary.players.map((p) => ({
            name: p.name,
            slackUserId: p.isClaude === true ? undefined : p.slackUserId,
            dmFailed: p.dmFailed,
          })),
        }, {requestId});
      } catch (err) {
        const message = formatBackgroundError(err);
        logger.error('[slack-bot] background work failed', err);
        await dmHostError(client, meta.hostUserId, message);
        await postLog(client, {
          kind: 'failed',
          hostUserId: meta.hostUserId,
          message,
          ...(err instanceof TmApiError ? {status: err.status, responseBody: err.responseBody} : {}),
          attempt: {
            playerCount: parsed.slots.length,
            board: parsed.board,
            expansions: Object.entries(parsed.expansions).filter(([, on]) => on).map(([k]) => k),
          },
        }, {requestId});
      }
    })(),
  );
}

function formatBackgroundError(err: unknown): string {
  if (err instanceof TmApiError) {
    if (err.status === 429) {
      return 'The Terraforming Mars server is rate-limiting new games for now. Try again in a few minutes.';
    }
    return `Terraforming Mars rejected the request (HTTP ${err.status}). ${err.responseBody.slice(0, 200)}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
