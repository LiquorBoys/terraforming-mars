'use strict';
// Game-end forecast from CAPACITY (what each player can do to the global tracks), not from past pace.
// Per player: heat (+ energy, which turns into heat at production) -> temperature, plants -> greenery/oxygen, cash ->
// standard projects, blue-card global actions, hidden hand plays (assumed), WGT. Simulated gen by gen per track.

// Blue-card actions that move a global. rate = steps per gen (resource-cycling actions like "remove 2 microbes" = 0.5).
const ACTIONS = {
  'Aquifer Pumping': ['oceans', 1], 'Water Import From Europa': ['oceans', 1], 'Comet Aiming': ['oceans', 0.5],
  'Icy Impactors': ['oceans', 0.5], 'Directed Impactors': ['temperature', 0.5], 'Rotator Impacts': ['venus', 0.5],
  'GHG Producing Bacteria': ['temperature', 0.5], 'Palladin Shipping': ['temperature', 1],
  'Regolith Eaters': ['oxygen', 0.5], 'Ironworks': ['oxygen', 1], 'Steelworks': ['oxygen', 1], 'Ore Processor': ['oxygen', 1],
  'Water Splitting Plant': ['oxygen', 1], 'Voltagon': ['oxygen', 0.5], 'Robin Haulings': ['oxygen', 0.3],
  'Extractor Balloons': ['venus', 0.5], 'Forced Precipitation': ['venus', 0.5], 'Jet Stream Microscrappers': ['venus', 0.5],
  'World Government Advisor': ['any', 1], // prelude: 1 global step/gen, no TR (the only WG source in our games)
  'Thermophiles': ['venus', 0.5], 'Venus Magnetizer': ['venus', 1], 'Venus Shuttles': ['venus', 1], 'Cultivation of Venus': ['venus', 1],
};
const SP = {temperature: 14, oceans: 18, oxygen: 23}; // cheapest SP per step on each Mars track

function clock(T) {
  const v = T.v, g = v.game, me = v.thisPlayer.color;
  const left = {temperature: Math.max(0, (8 - g.temperature) / 2), oxygen: Math.max(0, 14 - g.oxygenLevel), oceans: Math.max(0, 9 - g.oceans)};
  const wgt = !!g.gameOptions?.solarPhaseOption;
  // Stock is usable later this gen in drafting/research too (production already ran); only passed players are out, and only during the action phase.
  const actionPhase = ['action', 'drafting', 'research'].includes(g.phase);
  const passed = new Set(g.passedPlayers || []);
  const P = v.players.map((o) => {
    const acts = o.tableau.map((c) => [c.name, ACTIONS[c.name]]).filter(([, a]) => a);
    const flow = {heat: o.heatProduction + o.energyProduction, plants: o.plantProduction, cash: o.megacreditProduction + o.terraformRating};
    // Stock usable in the rest of THIS gen (0 if they already passed); next gens run on flow.
    const now = actionPhase && !(g.phase === 'action' && passed.has(o.color)) ? {heat: o.heat, plants: o.plants, cash: o.megacredits} : {heat: 0, plants: 0, cash: 0};
    return {o, acts, flow, now, hand: o.color === me ? 0 : (o.cardsInHandNbr ?? 0)};
  });
  const L = [];
  L.push(`CLOCK gen ${g.generation} ${g.phase}: steps left temp ${left.temperature} o2 ${left.oxygen} oceans ${left.oceans} = ${left.temperature + left.oxygen + left.oceans}` +
    `${wgt ? ' | WGT OPTION ON (+1 step/gen)' : ' | WGT option off'} | venus ${g.venusScaleLevel}% (not needed to end)`);
  L.push('capacity per player (this gen from stock | each later gen from production):');
  for (const p of P) {
    const s = (x) => `temp ${Math.floor(x.heat / 8)} o2 ${Math.floor(x.plants / 8)} SP-cash ${x.cash}`;
    L.push(`  ${p.o.name} (${p.o.color}${p.o.color === me ? ', us' : ''}): now ${s(p.now)} | per gen ${s(p.flow)}` +
      `${p.acts.length ? ' | actions ' + p.acts.map(([n, [k, r]]) => `${n}:${k}${r < 1 ? ' ' + r + '/gen' : ''}`).join(', ') : ''}` +
      `${p.hand ? ` | hand ${p.hand}` : ''}`);
  }
  // Simulate: each gen, heat/plants/actions/WGT + ~1 hidden hand step per opponent with cards. Cash never goes to
  // standard projects before the final gen (cards beat SPs until then); it only decides whether the table can CLOSE
  // what's left in a gen (share of the table's cash spent on the cheapest open SPs that gen).
  const sim = (cashShare) => {
    const l = {...left};
    const stock = P.map((p) => ({heat: p.now.heat, plants: p.now.plants})); // leftovers carry into the next gen
    for (let k = 0; k < 12; k++) {
      const first = k === 0;
      let heat = 0, plants = 0, cash = 0, hand = 0;
      const act = {temperature: 0, oxygen: 0, oceans: 0};
      P.forEach((p, i) => {
        const st = stock[i];
        if (!first) { st.heat += p.flow.heat; st.plants += p.flow.plants; }
        const h = Math.floor(st.heat / 8), q = Math.floor(st.plants / 8);
        heat += h; plants += q; st.heat -= 8 * h; st.plants -= 8 * q;
        cash += first ? p.now.cash : p.flow.cash;
        if (!first || (actionPhase && !passed.has(p.o.color))) {
          for (const [, [t, r]] of p.acts) if (act[t] !== undefined) act[t] += r; else if (t === 'any') hand += r;
          if (p.hand) hand += first ? 0.5 : 1;
        }
      });
      const o2Before = l.oxygen, tBefore = l.temperature;
      l.temperature -= heat + act.temperature; l.oxygen -= plants + act.oxygen; l.oceans -= act.oceans;
      if (o2Before > 6 && l.oxygen <= 6) l.temperature -= 1; // 8% oxygen bonus step
      if (tBefore > 4 && l.temperature <= 4) l.oceans -= 1; // 0°C ocean bonus
      if (wgt && !first) hand += 1;
      const order = () => Object.keys(l).filter((t) => l[t] > 0).sort((a, b) => SP[a] - SP[b]);
      for (; hand >= 1 && order().length; hand -= 1) { const t = Object.keys(l).sort((a, b) => l[b] - l[a])[0]; l[t] -= 1; }
      const closeCost = order().reduce((sum, t) => sum + Math.ceil(l[t]) * SP[t], 0);
      if (closeCost <= cash * cashShare) return g.generation + k;
    }
    return null;
  };
  const fmt = (x) => x ?? '>+12';
  const earliest = sim(1), likely = sim(0.5), slow = sim(0);
  L.push(`FORECAST last gen: earliest ${fmt(earliest)} (whole table's cash closes the rest with SPs that gen) | likely ${fmt(likely)}` +
    ` (half the table's cash: only players who gain from ending spend it) | slowest ${fmt(slow)} (no SPs at all)`);
  L.push('  SP cash counts only in the closing gen. Production growth and our own plays are not modelled: err early.');
  return L.join('\n');
}

module.exports = {clock};
