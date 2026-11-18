import {describe, expect, it} from 'vitest';

// The stats page is plain JavaScript served as-is from public/; load it by path.
type Player = Record<string, unknown> & {key: string; rank: number};
type Game = {id: string; name: string; createdAt: string; generations: number; players: Array<Player>; awards?: Array<unknown>};
type League = {
  games: Array<{index: number; players: Array<{key: string; ratingDelta: number; displayName: string}>}>;
  players: Array<{key: string; name: string; rating: number; games: number; wins: number; unspentAvg: number; unspentMax: number;
    awardsFunded: number; awardsGifted: number; secondsPerAction: number | null; history: Array<{rating: number}>}>;
  corporations: Array<{name: string; plays: number; wins: number; score: number; thin: boolean; surpriseSum: number}>;
};
const load = async () => {
  const path = '../public/stats/compute.js';
  return await import(/* @vite-ignore */ path) as {
    computeLeague: (games: Array<Game>) => League; START_RATING: number; K: number; THIN_PLAYS: number; SHRINK: number;
    rateGame: (players: Array<Player>, ratingOf: (key: string) => number) => Array<{key: string; delta: number; surprise: number}>;
  };
};

const p = (key: string, rank: number, extra: Record<string, unknown> = {}): Player => ({
  key, name: key, color: key, rank, vp: 100 - rank * 10, corps: ['Corp ' + key], megacredits: 0,
  steel: 0, steelValue: 2, titanium: 0, titaniumValue: 3, actions: 100, clockMs: 100_000, ...extra,
});
const game = (n: number, players: Array<Player>, awards: Array<unknown> = []): Game =>
  ({id: 'g' + n, name: 'Game ' + n, createdAt: `2026-11-${String(n).padStart(2, '0')}T00:00:00.000Z`, generations: 10, players, awards});

describe('ratings', () => {
  it('moves equal-rated players by rank and sums to zero', async () => {
    const {rateGame, K} = await load();
    const rows = rateGame([p('a', 1), p('b', 2), p('c', 3)], () => 1500);
    expect(rows.map((r) => Math.round(r.delta))).toEqual([K / 2, 0, -K / 2]);
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBeCloseTo(0);
  });

  it('gives a favourite less for winning than an underdog, and nothing in a one-player game', async () => {
    const {rateGame} = await load();
    const ratings: Record<string, number> = {strong: 1700, weak: 1300};
    const favouriteWins = rateGame([p('strong', 1), p('weak', 2)], (k) => ratings[k]!);
    const upset = rateGame([p('strong', 2), p('weak', 1)], (k) => ratings[k]!);
    expect(favouriteWins[0]!.delta).toBeGreaterThan(0);
    expect(upset[1]!.delta).toBeGreaterThan(favouriteWins[0]!.delta * 5);
    expect(rateGame([p('solo', 1)], () => 1500)[0]!.delta).toBe(0);
  });

  it('plays games in date order whatever order they arrive in, and treats level finishes as draws', async () => {
    const {computeLeague, START_RATING} = await load();
    const league = computeLeague([game(2, [p('a', 1), p('b', 1)]), game(1, [p('a', 1), p('b', 2)])]);
    expect(league.games.map((g) => g.index)).toEqual([1, 2]);
    const a = league.players.find((x) => x.key === 'a')!;
    expect(a.history).toHaveLength(2);
    // After winning game 1, a level finish against a lower-rated player costs a little.
    expect(a.history[0]!.rating).toBeGreaterThan(START_RATING);
    expect(a.history[1]!.rating).toBeLessThan(a.history[0]!.rating);
    expect(a.wins).toBe(2);
  });

  it('rates Claude separately per model and names the seat by it', async () => {
    const {computeLeague} = await load();
    const league = computeLeague([
      game(1, [p('u_x', 2, {name: 'Alice'}), p('claude-opus', 1, {name: 'Claude', claudeModel: 'opus'})]),
      game(2, [p('u_x', 1, {name: 'Alice B'}), p('claude-sonnet', 2, {name: 'Claude', claudeModel: 'sonnet'})]),
    ]);
    expect(league.players.map((x) => x.name).sort()).toEqual(['Alice B', 'Claude (Opus)', 'Claude (Sonnet)']);
    expect(league.players.find((x) => x.key === 'claude-opus')!.games).toBe(1);
  });
});

describe('corporations', () => {
  it('shrinks small samples toward zero and marks them thin', async () => {
    const {computeLeague, THIN_PLAYS, SHRINK} = await load();
    const league = computeLeague([game(1, [p('a', 1, {corps: ['Helion']}), p('b', 2, {corps: ['Ecoline']})])]);
    const helion = league.corporations.find((c) => c.name === 'Helion')!;
    expect(helion).toMatchObject({plays: 1, wins: 1, thin: true});
    expect(helion.score).toBeCloseTo(helion.surpriseSum / (1 + SHRINK));
    expect(helion.score).toBeGreaterThan(0);
    expect(league.corporations[0]!.name).toBe('Helion');
    expect(THIN_PLAYS).toBeGreaterThan(1);
  });
});

describe('the silly ones', () => {
  it('values leftover steel and titanium at what they were worth to that player', async () => {
    const {computeLeague} = await load();
    const league = computeLeague([
      game(1, [p('a', 1, {steel: 10, steelValue: 3, titanium: 2, titaniumValue: 4}), p('b', 2)]),
      game(2, [p('a', 1), p('b', 2)]),
    ]);
    const a = league.players.find((x) => x.key === 'a')!;
    expect(a.unspentMax).toBe(38);
    expect(a.unspentAvg).toBe(19);
  });

  it('counts an award as given away only when its funder is not level on the top score', async () => {
    const {computeLeague} = await load();
    const awards = [
      {name: 'Banker', fundedBy: 'a', scores: [{color: 'a', score: 3}, {color: 'b', score: 9}]},
      {name: 'Miner', fundedBy: 'a', scores: [{color: 'a', score: 5}, {color: 'b', score: 5}]},
      {name: 'Scientist', fundedBy: 'b', scores: [{color: 'a', score: 1}, {color: 'b', score: 4}]},
    ];
    const league = computeLeague([game(1, [p('a', 1), p('b', 2)], awards)]);
    expect(league.players.find((x) => x.key === 'a')).toMatchObject({awardsFunded: 2, awardsGifted: 1});
    expect(league.players.find((x) => x.key === 'b')).toMatchObject({awardsFunded: 1, awardsGifted: 0});
  });

  it('measures the clock per action, and leaves out anyone without one', async () => {
    const {computeLeague} = await load();
    const league = computeLeague([game(1, [p('a', 1, {clockMs: 300_000, actions: 60}), p('b', 2, {clockMs: null})])]);
    expect(league.players.find((x) => x.key === 'a')!.secondsPerAction).toBe(5);
    expect(league.players.find((x) => x.key === 'b')!.secondsPerAction).toBeNull();
  });
});
