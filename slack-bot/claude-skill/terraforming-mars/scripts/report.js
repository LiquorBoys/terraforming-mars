'use strict';
// Mechanical lessons checks (no model needed): `stocks` = every stockpile with its VP sink, `races` = opponent corps
// (incl. forced first actions) + milestone/award races measured as distance to threshold.

// Full card text (description + action/effect rows from renderData), same as the brief shows.
const desc = (T, name) => T.cardText(T.cardDef(name), 2000) || '';

// Stock -> sink table for us. Flags stock with no sink and plants >= 8 (never hold a removable pile).
function stocks(T) {
  const v = T.v, g = v.game, p = v.thisPlayer;
  const hand = (v.cardsInHand || []).map((c) => ({name: c.name, cost: c.calculatedCost ?? T.cardDef(c.name)?.cost ?? 0,
    tags: T.cardDef(c.name)?.tags || [], type: T.cardDef(c.name)?.type}));
  const tableau = p.tableau.map((c) => c.name);
  const open = {temp: g.temperature < 8, o2: g.oxygenLevel < 14, oceans: g.oceans < 9, venus: g.venusScaleLevel < 30};
  const fleetsFree = Math.max(0, (p.fleetSize || 0) - (p.tradesThisGeneration || 0));
  const usesOf = (res) => tableau.filter((n) => new RegExp(`spend \\d+ ${res}|${res} may be used`, 'i').test(desc(T, n)));
  const L = [`STOCKS gen ${g.generation} ${g.phase} (sink = what turns it into VP before the end)`];
  const row = (label, amt, prod, sinks, warn) =>
    L.push(`  ${label.padEnd(7)} ${String(amt).padStart(3)} (+${prod})  ${sinks.length ? sinks.join('; ') : 'NO SINK'}${warn ? '  !! ' + warn : ''}`);

  const mcSinks = [];
  const playable = hand.filter((c) => c.cost <= p.megacredits + p.steel * p.steelValue + p.titanium * p.titaniumValue);
  if (playable.length) mcSinks.push('cards: ' + playable.map((c) => `${c.name} ${c.cost}`).join(', '));
  if (open.o2) mcSinks.push('greenery SP 23 (+TR)'); else mcSinks.push('greenery SP 23 (no TR)');
  if (open.temp) mcSinks.push('asteroid SP 14'); if (open.oceans) mcSinks.push('aquifer SP 18'); if (open.venus) mcSinks.push('air scrapping 15');
  row('M€', p.megacredits, p.megacreditProduction, mcSinks);

  const steelCards = hand.filter((c) => c.tags.includes('building')).map((c) => c.name).concat(usesOf('steel'));
  row('steel', p.steel, p.steelProduction, steelCards, p.steel + p.steelProduction > 0 && !steelCards.length ? 'steel with no building card' : '');

  const tiCards = hand.filter((c) => c.tags.includes('space')).map((c) => c.name).concat(usesOf('titanium'));
  if (fleetsFree) tiCards.push(`trade fee (3 Ti, ${fleetsFree} fleet free)`);
  row('ti', p.titanium, p.titaniumProduction, tiCards, p.titanium + p.titaniumProduction > 0 && !tiCards.length ? 'titanium with no space card' : '');

  const plantSinks = open.o2 ? ['greenery at 8 (+TR)'] : ['greenery at 8 (no TR, still tile VP)'];
  row('plants', p.plants, p.plantProduction, plantSinks, p.plants >= 8 ? 'CONVERT NOW (8+ plants is a removal target)' : '');

  const enSinks = usesOf('energy');
  if (fleetsFree) enSinks.push(`trade (3 energy, ${fleetsFree} fleet free)`);
  row('energy', p.energy, p.energyProduction, enSinks.length ? enSinks : ['becomes heat at production']);

  const heatSinks = open.temp ? ['temperature at 8 (+TR)'] : usesOf('heat');
  row('heat', p.heat, p.heatProduction, heatSinks, !open.temp && !heatSinks.length && p.heat + p.heatProduction > 0 ? 'temperature maxed' : '');

  const dead = hand.filter((c) => c.cost > 0 && !playable.includes(c));
  if (dead.length) L.push(`  unaffordable now: ${dead.map((c) => `${c.name} ${c.cost}`).join(', ')} (sell 1 M€ each if they can't be played before the end)`);
  return L.join('\n');
}

// Opponent corps (effect + forced first action) and every open race in distance-to-threshold form.
function races(T) {
  const v = T.v, g = v.game, me = v.thisPlayer.color;
  const L = ['CORPS (read before any race):'];
  for (const o of v.players) {
    const corp = o.tableau.find((c) => T.cardDef(c.name)?.type === 'corporation');
    if (!corp) continue;
    const d = desc(T, corp.name);
    const first = /first action/i.test(d) ? '  [FORCED FIRST ACTION: ' + (d.match(/first action[^.|]*/i) || [''])[0] + ']' : '';
    L.push(`  ${o.color}${o.color === me ? ' (us)' : ''}: ${corp.name} — ${d.slice(0, 160)}${first}`);
  }
  const claimed = g.milestones.filter((m) => m.color).length;
  L.push(`MILESTONES (${claimed}/3 claimed)` + (claimed >= 3 ? ': all gone' : ':'));
  if (claimed < 3) for (const m of g.milestones.filter((x) => !x.color)) {
    const need = Number(((T.ma?.[m.name] || '').match(/\d+/) || [])[0]);
    const rows = m.scores.map((s) => ({c: s.color, s: s.score, d: Number.isFinite(need) ? Math.max(0, need - s.score) : '?', ok: s.claimable}))
      .sort((a, b) => (a.d === '?' ? 99 : a.d) - (b.d === '?' ? 99 : b.d));
    L.push(`  ${m.name} (need ${Number.isFinite(need) ? need : '?'}): ` + rows.map((r) => `${r.c}${r.c === me ? '*' : ''} ${r.s}${r.ok ? '!' : ` (-${r.d})`}`).join(', '));
  }
  const funded = g.awards.filter((a) => a.color).length;
  L.push(`AWARDS (${funded}/3 funded, next costs ${[8, 14, 20][funded] ?? '-'} M€):`);
  for (const a of g.awards) {
    const s = [...(a.scores || [])].sort((x, y) => y.score - x.score);
    if (!s.length) { L.push(`  ${a.name}${a.color ? ' [FUNDED ' + a.color + ']' : ''}: no scores`); continue; }
    const mine = a.scores.find((x) => x.color === me)?.score ?? 0;
    const lead = s[0].score, rank = 1 + s.filter((x) => x.score > mine).length;
    const margin = rank === 1 ? mine - (s.find((x) => x.color !== me)?.score ?? 0) : mine - lead;
    L.push(`  ${a.name}${a.color ? ' [FUNDED ' + a.color + ']' : ''}: ` + s.map((x) => `${x.color}${x.color === me ? '*' : ''} ${x.score}`).join(', ') +
      ` | us rank ${rank}, margin ${margin >= 0 ? '+' : ''}${margin}`);
  }
  return L.join('\n');
}


// Per-rival threat view for planning: engines in play (actions, VP accumulators with their resources), top tags,
// VP-card share, and the cards WE passed them in the draft (likely in hand) that carry VP or feed their engines.
function rivals(T) {
  const fs = require('fs'), path = require('path');
  const v = T.v, me = v.thisPlayer.color, L = [];
  let passed = '';
  try { passed = fs.readFileSync(path.join(__dirname, '..', 'cache', 'live', `${v.game.spectatorId}-${me}`, 'passed.md'), 'utf8'); } catch { /* none */ }
  const inPlay = new Set(v.players.flatMap((o) => (o.tableau || []).map((c) => c.name)));
  const tagsOf = (o) => (Array.isArray(o.tags) ? Object.fromEntries(o.tags.map((t) => [t.tag, t.count])) : {...(o.tags || {})});
  for (const o of v.players.filter((x) => x.color !== me)) {
    const b = o.victoryPointsBreakdown || {}, tg = tagsOf(o);
    const top = Object.entries(tg).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([t, n]) => `${t}${n}`).join(' ');
    L.push(`${o.color} ${o.tableau?.[0]?.name || ''}: VP ${b.total} (TR ${b.terraformRating} cards ${b.victoryPoints} aw ${b.awards} ms ${b.milestones} tiles ${(b.greenery || 0) + (b.city || 0)}) | MC ${o.megacredits}(+${o.megacreditProduction}) pl ${o.plants}(+${o.plantProduction}) he ${o.heat}(+${o.heatProduction}) ti ${o.titanium} | hand ${o.cardsInHandNbr} | ${top}`);
    const eng = (o.tableau || []).map((c) => ({c, d: T.cardDef(c.name)})).filter(({c, d}) => d && (typeof d.victoryPoints === 'object' || d.hasAction || c.resources))
      .map(({c, d}) => `${c.name}${c.resources ? `[${c.resources}]` : ''}${typeof d.victoryPoints === 'object' ? ' VP/res' : ''}${d.hasAction ? ' act' : ''}`);
    if (eng.length) L.push(`  engines: ${eng.join(', ')}`);
    const got = [...passed.matchAll(new RegExp(`-> ${o.color}: ([^(\n]*)`, 'g'))].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean))
      .filter((n) => !inPlay.has(n));
    const hot = got.filter((n) => { const d = T.cardDef(n); return d && (d.victoryPoints || (d.tags || []).some((t) => (tg[t] || 0) >= 2)); });
    if (got.length) L.push(`  passed to them (may have been passed on), not in play (${got.length}): ${hot.length ? 'VP/tag-fit: ' + hot.join(', ') : 'none with VP/tag fit'}`);
  }
  return L.join('\n');
}

module.exports = {stocks, races, rivals};
