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

// Every Mars board is the same 61-hex grid: ids 03..63 in rows of 5,6,7,8,9,8,7,6,5 (the same
// geometry the skill's tm.js uses). The API gives no coordinates, so adjacency comes from the id.
const ROWS = [5, 6, 7, 8, 9, 8, 7, 6, 5];
const XY = {}; const AT = {};
{ let id = 3; ROWS.forEach((n, y) => { for (let p = 0; p < n; p++) { const k = String(id++).padStart(2, '0'); XY[k] = [p + Math.abs(4 - y), y]; AT[XY[k].join(',')] = k; } }); }
export function neighbours(id) {
  if (!XY[id]) return [];
  const [x, y] = XY[id];
  const diagonal = y < 4 ? [[x, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x, y + 1]] :
    y === 4 ? [[x, y - 1], [x + 1, y - 1], [x, y + 1], [x + 1, y + 1]] :
      [[x - 1, y - 1], [x, y - 1], [x, y + 1], [x + 1, y + 1]];
  return [[x - 1, y], [x + 1, y], ...diagonal].map((c) => AT[c.join(',')]).filter(Boolean);
}

/**
 * Where the Mars Nomads ended the game, and whether they were boxed in: no adjacent space they
 * could still move to (the card moves them to an adjacent, non-reserved, empty land area).
 * sealedBy is whoever placed the last tile next to them. Undefined when nobody played the card.
 */
export function nomadsAtEnd(spec, logsByGeneration = []) {
  const spaces = spec.game.spaces ?? [];
  const at = spaces.find((s) => s.nomads);
  if (!at) return undefined;
  const open = (s) => ['land', 'cove', 'deflection'].includes(s.spaceType) && s.tileType === undefined &&
    s.color === undefined && s.cube === undefined && s.highlight !== 'noctis';
  const around = neighbours(at.id);
  const boxedIn = !around.some((id) => { const s = spaces.find((x) => x.id === id); return s && open(s); });
  const owner = spec.players.find((p) => p.tableau.some((c) => c.name === 'Mars Nomads'))?.color ?? null;
  let sealedBy = null;
  if (boxedIn) {
    for (const m of logsByGeneration.flat()) {
      const where = m.data?.find((d) => d.type === 13)?.value; // 13 is a space id in the game log
      if (where !== undefined && around.includes(String(where)) && m.data[0]?.type === 2) sealedBy = m.data[0].value;
    }
  }
  return {space: at.id, owner, boxedIn, sealedBy};
}

/**
 * A player's corporations. The tableau lists cards in the order they were played and does not say
 * which are corporations, so: the first one (two in the two-corporations variant), plus the card
 * played straight after the Merger prelude, which is the corporation it merged in.
 */
export function corporationsOf(tableau, twoCorpsVariant) {
  const names = tableau.slice(0, twoCorpsVariant ? 2 : 1).map((c) => c.name);
  const merger = tableau.findIndex((c) => c.name === 'Merger');
  if (merger >= 0 && tableau[merger + 1] && !names.includes(tableau[merger + 1].name)) names.push(tableau[merger + 1].name);
  return names;
}

/**
 * One compact entry for games.json.
 * meta: {gameId, name, createdAt, seed, players: [{color, name, key}]} as stored when the game was created.
 * spec: the /api/spectator response of the finished game.
 */
export function buildSummary(meta, spec, endedAt, logsByGeneration = []) {
  const g = spec.game;
  const players = spec.players.map((p) => {
    const corps = corporationsOf(p.tableau, g.gameOptions.twoCorpsVariant);
    const m = meta.players.find((x) => x.color === p.color) ?? {};
    const b = p.victoryPointsBreakdown;
    const parts = Object.fromEntries(VP_PARTS.map((k) => [k, b[k] ?? 0]));
    return {
      key: m.key ?? `name_${p.name}`,
      name: m.name ?? p.name,
      color: p.color,
      ...(m.claudeModel ? {claudeModel: m.claudeModel} : {}),
      corps,
      vp: b.total,
      vpParts: {...parts, other: b.total - VP_PARTS.reduce((s, k) => s + (b[k] ?? 0), 0)},
      vpByGeneration: p.victoryPointsByGeneration,
      tr: p.terraformRating,
      megacredits: p.megacredits,
      megacreditProduction: p.megacreditProduction,
      // Every card in the tableau, in the order played: achievements and future stats read these.
      cards: p.tableau.map((c) => c.name),
      // The final state is read after the last production phase, so the stock a player actually
      // left unspent is what is here minus one round of production.
      steel: p.steel, steelValue: p.steelValue, steelProduction: p.steelProduction,
      titanium: p.titanium, titaniumValue: p.titaniumValue, titaniumProduction: p.titaniumProduction,
      cardsInHand: p.cardsInHandNbr,
      cardsPlayed: p.tableau.length - corps.length,
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
    ...(nomadsAtEnd(spec, logsByGeneration) ? {nomads: nomadsAtEnd(spec, logsByGeneration)} : {}),
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
