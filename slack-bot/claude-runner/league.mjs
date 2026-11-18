// League records: what gets saved about every finished game, for the stats page.
//
// Everything here is read with the game's spectator id once the game is over, so it works for
// games Claude is not in. The one thing a spectator cannot see is the seed, which the bot sends
// when it creates the game. Pure functions plus one fetch helper; server.mjs does the scheduling
// and the git work.
import crypto from 'node:crypto';

/** Stable public key for a person: a keyed hash, so Slack member ids never reach the public repo. */
export function personKey(salt, slackUserId) {
  return 'u_' + crypto.createHmac('sha256', salt).update(slackUserId).digest('hex').slice(0, 12);
}

const VP_PARTS = ['terraformRating', 'milestones', 'awards', 'greenery', 'city', 'victoryPoints'];

/**
 * One compact entry for games.json.
 * meta: {gameId, name, createdAt, seed, players: [{color, name, key}]} as stored when the game was created.
 * spec: the /api/spectator response of the finished game.
 */
export function buildSummary(meta, spec, endedAt) {
  const g = spec.game;
  const corps = g.gameOptions.twoCorpsVariant ? 2 : 1;
  const players = spec.players.map((p) => {
    const m = meta.players.find((x) => x.color === p.color) ?? {};
    const b = p.victoryPointsBreakdown;
    const parts = Object.fromEntries(VP_PARTS.map((k) => [k, b[k] ?? 0]));
    return {
      key: m.key ?? `name_${p.name}`,
      name: m.name ?? p.name,
      color: p.color,
      ...(m.claudeModel ? {claudeModel: m.claudeModel} : {}),
      corps: p.tableau.slice(0, corps).map((c) => c.name),
      vp: b.total,
      vpParts: {...parts, other: b.total - VP_PARTS.reduce((s, k) => s + (b[k] ?? 0), 0)},
      vpByGeneration: p.victoryPointsByGeneration,
      tr: p.terraformRating,
      megacredits: p.megacredits,
      steel: p.steel, steelValue: p.steelValue,
      titanium: p.titanium, titaniumValue: p.titaniumValue,
      cardsInHand: p.cardsInHandNbr,
      cardsPlayed: p.tableau.length - corps,
      actions: p.actionsTakenThisGame,
      clockMs: p.timer?.sumElapsed ?? null,
    };
  });
  // Final standing as the game scores it: most VP, ties broken by M€. Equal on both share a rank.
  const order = [...players].sort((a, b) => b.vp - a.vp || b.megacredits - a.megacredits);
  for (const p of players) p.rank = 1 + order.findIndex((o) => o.vp === p.vp && o.megacredits === p.megacredits);
  return {
    id: meta.gameId,
    name: g.name ?? meta.name,
    createdAt: meta.createdAt,
    endedAt,
    seed: meta.seed ?? null,
    generations: g.generation,
    board: g.gameOptions.boardName,
    expansions: Object.entries(g.gameOptions.expansions ?? {}).filter(([, on]) => on).map(([k]) => k),
    options: {
      draft: g.gameOptions.draftVariant, solarPhase: g.gameOptions.solarPhaseOption,
      twoCorps: g.gameOptions.twoCorpsVariant, randomMA: g.gameOptions.randomMA,
    },
    players,
    awards: g.awards.filter((a) => a.color).map((a) => ({name: a.name, fundedBy: a.color, scores: a.scores})),
    milestones: g.milestones.filter((m) => m.color).map((m) => ({name: m.name, claimedBy: m.color})),
  };
}

/** The full record kept per game: the summary, the whole public log and the final public state. */
export function buildFull(summary, spec, logsByGeneration) {
  // Once a game is over the server shows every seat's player id. They are dead credentials by
  // then, but they have no business in a public file.
  const strip = ({id, ...rest}) => rest;
  return {summary, log: logsByGeneration, final: {game: spec.game, players: spec.players.map(strip)}};
}

/**
 * Reads a game through its spectator id. Returns {ended: false} while it is being played,
 * {gone: true, why} when the server no longer has it, otherwise {ended: true, spec, logs, endedAt}.
 */
export async function fetchGame(origin, spectatorId, fetchImpl = fetch) {
  const get = async (path) => {
    const r = await fetchImpl(origin + path, {signal: AbortSignal.timeout(30000)});
    return {status: r.status, body: r.ok ? await r.json() : await r.text().catch(() => '')};
  };
  const s = await get(`/api/spectator?id=${spectatorId}`);
  if (s.status === 404) return {gone: true, why: `HTTP 404 ${String(s.body).slice(0, 100)}`};
  if (s.status !== 200) throw new Error(`spectator read failed: HTTP ${s.status} ${String(s.body).slice(0, 100)}`);
  const spec = s.body;
  if (spec.game.phase !== 'end') return {ended: false, generation: spec.game.generation};
  const logs = [];
  for (let gen = 1; gen <= spec.game.generation; gen++) {
    const l = await get(`/api/game/logs?id=${spectatorId}&generation=${gen}`);
    if (l.status !== 200) throw new Error(`log read failed for generation ${gen}: HTTP ${l.status}`);
    logs.push(l.body);
  }
  const stamps = logs.flat().map((m) => m.timestamp).filter((t) => typeof t === 'number');
  return {ended: true, spec, logs, endedAt: stamps.length > 0 ? new Date(Math.max(...stamps)).toISOString() : null};
}
