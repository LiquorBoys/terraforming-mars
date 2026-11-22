// Everything the stats page shows is computed here, in the browser, from games.json in the league
// data repository (see claude-runner/league.mjs for the shape of an entry). Adding a statistic
// means adding it here and drawing it in stats.js; it then applies to every game ever recorded.

export const START_RATING = 1500;
export const K = 32;
/** A corporation with fewer plays than this is shown, but marked as too thin to mean anything. */
export const THIN_PLAYS = 5;
/** Pseudo-plays at "exactly as expected" mixed into each corporation's score, so one lucky game does not top the table. */
export const SHRINK = 5;

const expected = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));
/** 1 if a finished ahead of b, 0.5 if level, 0 if behind. */
const outcome = (a, b) => (a.rank < b.rank ? 1 : a.rank > b.rank ? 0 : 0.5);

export function displayName(p) {
  if (p.claudeModel) return `Claude (${p.claudeModel[0].toUpperCase()}${p.claudeModel.slice(1)})`;
  return p.name;
}

/**
 * Elo over every pair of players in a game: each player's result against each opponent is
 * compared with what their ratings predicted, and the average surprise moves the rating by up
 * to K. `surprise` is that average, between -1 and 1: positive means they did better than
 * their rating said they would.
 */
export function rateGame(players, ratingOf) {
  const n = players.length;
  return players.map((p) => {
    if (n < 2) return {key: p.key, before: ratingOf(p.key), surprise: 0, delta: 0};
    let sum = 0;
    for (const o of players) if (o !== p) sum += outcome(p, o) - expected(ratingOf(p.key), ratingOf(o.key));
    const surprise = sum / (n - 1);
    return {key: p.key, before: ratingOf(p.key), surprise, delta: K * surprise};
  });
}

/**
 * Achievements. Each has a test over one player's line in one game's record; `needs` on a card
 * means it only counts toward a set when that expansion was in the game.
 */
const EVERY_CARD_CHEAPER = [{card: 'Research Outpost'}, {card: 'Earth Catapult'}, {card: 'Anti-Gravity Technology'},
  {card: 'Sky Docks', needs: 'colonies'}, {card: 'Moon Tether', needs: 'moon'}, {card: 'Friends in High Places', needs: 'underworld'}];
const METAL_WORTH_MORE = [{card: 'Advanced Alloys'}, {card: 'Rego Plastics', needs: 'promo'}, {card: 'Mercurian Alloys', needs: 'promo'},
  {card: 'Lunar Steel', needs: 'moon'}];
const ownsAll = (set, p, g) => {
  const wanted = set.filter((c) => !c.needs || (g.expansions ?? []).includes(c.needs)).map((c) => c.card);
  return Array.isArray(p.cards) && wanted.every((c) => p.cards.includes(c));
};
export const ACHIEVEMENTS = [
  {id: 'tycoon', name: 'Tycoon', text: 'End a game with M€ production of 50 or more.',
    earned: (p) => (p.megacreditProduction ?? 0) >= 50},
  {id: 'bulk-buyer', name: 'Bulk buyer', text: 'Own every card that makes all cards cheaper: Research Outpost, Earth Catapult, Anti-Gravity Technology and Sky Docks.',
    earned: (p, g) => ownsAll(EVERY_CARD_CHEAPER, p, g)},
  {id: 'metallurgist', name: 'Metallurgist', text: 'Own every card that makes steel or titanium worth more: Advanced Alloys, Rego Plastics and Mercurian Alloys.',
    earned: (p, g) => ownsAll(METAL_WORTH_MORE, p, g)},
  {id: 'fence-builder', name: 'Fence builder', text: "Place the tile that leaves someone else's Mars Nomads with nowhere to go.",
    earned: (p, g) => g.nomads?.boxedIn === true && g.nomads.sealedBy === p.color && g.nomads.owner !== p.color},
];

/** Who topped an award, as the game scores it: everyone level on the highest score. */
function awardWinners(award) {
  const top = Math.max(...award.scores.map((s) => s.score));
  return award.scores.filter((s) => s.score === top).map((s) => s.color);
}

export function computeLeague(games) {
  const sorted = [...games].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const players = new Map();
  const corps = new Map();
  const earned = new Map(ACHIEVEMENTS.map((a) => [a.id, new Map()])); // achievement -> player key -> {count, lastGame}
  const person = (p) => {
    if (!players.has(p.key)) {
      players.set(p.key, {
        key: p.key, name: displayName(p), claudeModel: p.claudeModel ?? null,
        rating: START_RATING, lastDelta: 0, games: 0, wins: 0, history: [],
        unspentTotal: 0, unspentMax: 0, unspentMaxGame: null,
        awardsFunded: 0, awardsGifted: 0, clockMs: 0, clockActions: 0,
      });
    }
    const s = players.get(p.key);
    s.name = displayName(p); // the most recent name wins
    return s;
  };

  const rated = sorted.map((g, index) => {
    const rows = rateGame(g.players, (key) => players.get(key)?.rating ?? START_RATING);
    const out = g.players.map((p, i) => {
      const s = person(p);
      const r = rows[i];
      s.rating = r.before + r.delta;
      s.lastDelta = r.delta;
      s.games += 1;
      if (p.rank === 1) s.wins += 1;
      s.history.push({game: index + 1, gameId: g.id, date: g.createdAt, rating: s.rating, delta: r.delta});

      // Stock left when the last generation ended. The record is taken after the final production
      // phase, so one round of production is taken back off; that income was never theirs to spend.
      const left = (stock, production) => Math.max(0, (stock ?? 0) - Math.max(0, production ?? 0));
      const unspent = left(p.steel, p.steelProduction) * (p.steelValue ?? 2) + left(p.titanium, p.titaniumProduction) * (p.titaniumValue ?? 3);
      s.unspentTotal += unspent;
      if (unspent > s.unspentMax) { s.unspentMax = unspent; s.unspentMaxGame = g.name; }
      if (typeof p.clockMs === 'number' && p.actions > 0) { s.clockMs += p.clockMs; s.clockActions += p.actions; }

      for (const a of ACHIEVEMENTS) {
        if (!a.earned(p, g)) continue;
        const who = earned.get(a.id);
        who.set(p.key, {count: (who.get(p.key)?.count ?? 0) + 1, lastGame: g.name, lastDate: g.createdAt});
      }

      for (const corp of p.corps ?? []) {
        if (!corps.has(corp)) corps.set(corp, {name: corp, plays: 0, wins: 0, rankSum: 0, surpriseSum: 0});
        const c = corps.get(corp);
        c.plays += 1; c.rankSum += p.rank; c.surpriseSum += r.surprise;
        if (p.rank === 1) c.wins += 1;
      }
      return {...p, displayName: s.name, ratingBefore: r.before, ratingDelta: r.delta};
    });

    for (const award of g.awards ?? []) {
      const funder = g.players.find((p) => p.color === award.fundedBy);
      if (!funder || !award.scores?.length) continue;
      const s = players.get(funder.key);
      s.awardsFunded += 1;
      if (!awardWinners(award).includes(award.fundedBy)) s.awardsGifted += 1;
    }
    return {...g, index: index + 1, players: out.sort((a, b) => a.rank - b.rank)};
  });

  const people = [...players.values()].map((s) => ({
    ...s,
    unspentAvg: s.games ? s.unspentTotal / s.games : 0,
    secondsPerAction: s.clockActions ? s.clockMs / 1000 / s.clockActions : null,
  })).sort((a, b) => b.rating - a.rating);

  const corporations = [...corps.values()].map((c) => ({
    ...c,
    avgRank: c.rankSum / c.plays,
    // Average surprise, pulled toward zero by SHRINK pseudo-plays.
    score: c.surpriseSum / (c.plays + SHRINK),
    thin: c.plays < THIN_PLAYS,
  })).sort((a, b) => b.score - a.score || b.plays - a.plays);

  const achievements = ACHIEVEMENTS.map(({id, name, text}) => ({
    id, name, text,
    holders: [...earned.get(id)].map(([key, v]) => ({key, name: players.get(key).name, ...v})).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }));

  return {games: rated, players: people, corporations, achievements};
}
