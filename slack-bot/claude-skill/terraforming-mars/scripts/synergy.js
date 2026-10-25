'use strict';
// Card-synergy index (node only; required by tm.js).
// buildIndex() derives each card's synergy features from the card db once; tm.js caches the result next to the db
// (cache/synergy-<host>.json) and rebuilds it only when the db is refreshed. query() filters it for one game.
const fs = require('fs');

const TAGS = ['building', 'space', 'science', 'power', 'earth', 'jovian', 'venus', 'plant', 'microbe', 'animal', 'city',
  'event', 'wild', 'moon', 'mars', 'crime'];
const STOCK = ['steel', 'titanium', 'heat', 'energy', 'plants', 'megacredits'];
const PROJECT = new Set(['automated', 'active', 'event']);
// Colony tiles that put resources on cards (trade and/or colony bonus). Not cards, so not in the db.
// Standard project per global step: [track units per step, M€, name].
const SP_STEP = {temperature: [2, 14, 'Asteroid SP'], oxygen: [1, 23, 'Greenery SP'], oceans: [1, 18, 'Aquifer SP'], venus: [2, 15, 'Air Scrapping']};
const COLONY_RES = {Miranda: 'Animal', Titan: 'Floater', Enceladus: 'Microbe'};

function strings(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => strings(v, out));
  return out;
}
function rowsOf(x, out = []) {
  if (!x || typeof x !== 'object') return out;
  if (Array.isArray(x.rows)) x.rows.forEach((r) => Array.isArray(r) && out.push(r));
  Object.values(x).forEach((v) => rowsOf(v, out));
  return out;
}
function effectBlocks(x, out = []) {
  if (!x || typeof x !== 'object') return out;
  if (x.is === 'effect' && Array.isArray(x.rows)) out.push(x);
  Object.values(x).forEach((v) => effectBlocks(v, out));
  return out;
}

function features(d) {
  const rd = d.metadata?.renderData;
  const text = strings([d.metadata?.description, rd]).join(' | ');
  const f = {};
  const scales = new Set();
  if (d.victoryPoints?.tag) scales.add(d.victoryPoints.tag);
  for (const r of rowsOf(rd)) {
    let slash = false;
    for (const it of r) {
      if (it?.is === 'symbol' && it.type === '/') slash = true;
      else if (slash && it?.type === 'tag' && it.tag) scales.add(it.tag);
    }
  }
  for (const m of text.matchAll(/(?:for each|per|every) (\w+) tag/gi)) if (TAGS.includes(m[1].toLowerCase())) scales.add(m[1].toLowerCase());
  const triggers = new Set(), uses = new Set();
  for (const e of effectBlocks(rd)) {
    const first = (e.rows[0] || []).filter((it) => it && typeof it === 'object');
    for (const it of first) {
      if (it.type === 'tag' && it.tag) triggers.add(it.tag);
      if (STOCK.includes(it.type) && it.type !== 'megacredits') uses.add(it.type);
    }
  }
  for (const m of text.matchAll(/when (?:you|any player) plays? an? (\w+) tag/gi)) if (TAGS.includes(m[1].toLowerCase())) triggers.add(m[1].toLowerCase());
  if (/each steel you have is worth/i.test(text)) uses.add('steel');
  if (/each titanium you have is worth/i.test(text)) uses.add('titanium');
  const feeds = new Set();
  for (const r of rowsOf(rd)) for (const it of r) {
    if (it?.type === 'resource' && it.resource && (it.resource !== d.resourceType || /any card|another card|to ANY/i.test(text)) &&
      new RegExp(`add[^|.]*${it.resource}`, 'i').test(text)) feeds.add(it.resource); // skip removers (Virus, Predators)
  }
  for (const m of text.matchAll(/add (?:\d+|an?|one|two|three|four) (animal|microbe|floater|science|fighter|asteroid|data|disease)s? (?:resources? )?to (?:any|another)/gi)) {
    feeds.add(m[1][0].toUpperCase() + m[1].slice(1).toLowerCase());
  }
  const req = {};
  const glob = [];
  for (const r of d.requirements || []) {
    if (r.tag && !r.max) req[r.tag] = r.count ?? 1;
    for (const k of ['temperature', 'oxygen', 'oceans', 'venus']) if (r[k] !== undefined || (r.global && r.global === k)) glob.push([k, r.count ?? r[k], r.max ? 'max' : 'min']);
  }
  if (glob.length) f.glob = glob;
  if (scales.size) f.scales = [...scales];
  if (triggers.size) f.triggers = [...triggers];
  if (uses.size) f.uses = [...uses];
  if (feeds.size) f.feeds = [...feeds];
  if (Object.keys(req).length) f.req = req;
  if (d.resourceType) f.host = d.resourceType;
  return f;
}

function buildIndex(cards) {
  const idx = {};
  for (const d of cards) {
    const f = features(d);
    idx[d.name] = {m: d.module, type: d.type, tags: d.tags || [], cost: d.cost, compat: d.compatibility || [], ...f};
  }
  return idx;
}

// Pieces we already own or hold, split by kind, for "does X link to us".
function ours(idx, names) {
  const o = {hosts: new Set(), feeds: new Set(), scales: new Set(), triggers: new Set(), uses: new Set()};
  for (const n of names) {
    const c = idx[n]; if (!c) continue;
    if (c.host) o.hosts.add(c.host);
    (c.feeds || []).forEach((x) => o.feeds.add(x));
    (c.scales || []).forEach((x) => o.scales.add(x));
    (c.triggers || []).forEach((x) => o.triggers.add(x));
    (c.uses || []).forEach((x) => o.uses.add(x));
  }
  return o;
}

function query(T, args, liveDir) {
  const v = T.v, g = v.game, p = v.thisPlayer, idx = T.syn;
  const ex = g.gameOptions?.expansions || {};
  const mods = new Set(['base', ...Object.keys(ex).filter((k) => ex[k])]);
  if (mods.has('prelude')) mods.add('prelude2');
  const banned = new Set(g.gameOptions?.bannedCards || []);
  const inPlay = new Set(v.players.flatMap((o) => o.tableau.map((c) => c.name)));
  const hand = (v.cardsInHand || []).map((c) => c.name);
  let passed = '';
  try { passed = fs.readFileSync(`${liveDir}/passed.md`, 'utf8'); } catch { /* no draft yet */ }
  const inGame = (n, c) => PROJECT.has(c.type) && mods.has(c.m) && c.compat.every((x) => mods.has(x)) && !banned.has(n);
  const status = (n) => (inPlay.has(n) ? 'IN PLAY' : hand.includes(n) ? 'IN HAND' : passed.includes(n) ? 'passed (opp hand/discard)' : 'unseen');
  const pool = Object.entries(idx).filter(([n, c]) => inGame(n, c) && !inPlay.has(n) && !hand.includes(n));
  const myTags = p.tags || {};
  const t = (k) => myTags[k] || 0;
  const seenPerGen = g.gameOptions?.draftVariant ? 10 : 4;
  const L = [];
  const cols = (g.colonies || []).filter((c) => COLONY_RES[c.name]);
  const colonyLinks = (res) => cols.filter((c) => COLONY_RES[c.name] === res)
    .map((c) => `  colony ${T.colonyLine ? T.colonyLine(c) : c.name}${c.isActive === false ? ' (activates when someone plays a ' + res.toLowerCase() + ' card)' : ''}` +
      ` — trade/colony there feeds ${res.toLowerCase()} hosts; fleets: ours ${p.fleetSize ?? 0}`);
  const cur = {temperature: g.temperature, oxygen: g.oxygenLevel, oceans: g.oceans, venus: g.venusScaleLevel};
  const line = (n, why) => { const c = idx[n]; L.push(`  ${n} $${c.cost} [${c.tags.join(',')}] ${why} — ${status(n)}`); };
  L.push(`deck ${g.deckSize}: a given unseen card reaches our draft/research ~${Math.min(100, Math.round(100 * seenPerGen / Math.max(1, g.deckSize)))}%/gen (+ own draws)`);

  if (args.length) { // pair mode: what links to these cards
    for (const n of args) {
      const c = idx[n]; if (!c) { L.push(`${n}: not in db`); continue; }
      L.push(`== ${n} [${c.tags.join(',')}]${c.scales ? ' scales:' + c.scales : ''}${c.triggers ? ' triggers:' + c.triggers : ''}` +
        `${c.req ? ' req:' + JSON.stringify(c.req) : ''}${c.host ? ' host:' + c.host : ''}${c.feeds ? ' feeds:' + c.feeds : ''}${c.uses ? ' uses:' + c.uses : ''}`);
      const pay = [...(c.scales || []), ...(c.triggers || [])].map((x) => `${x} (we have ${t(x)})`);
      if (pay.length) L.push(`  pays off on: ${pay.join(', ')}`);
      if (c.req) L.push(`  needs: ${Object.entries(c.req).map(([k, n2]) => `${k} ${t(k)}/${n2}`).join(', ')}`);
      for (const [k, n2, mm] of c.glob || []) { // min reqs we could buy toward with standard projects
        const [step, cost, sp] = SP_STEP[k];
        const steps = mm === 'min' ? Math.ceil(Math.max(0, n2 - cur[k]) / step) : 0;
        if (steps) L.push(`  SP route: ${steps} x ${sp} = ${steps * cost} M€ (also +${steps} TR, and other players' pushes may cover part)`);
      }
      if (c.glob) L.push(`  global req: ${c.glob.map(([k, n2, mm]) => `${k} ${mm === 'max' ? '<=' : '>='}${n2} (now ${cur[k]}${mm === 'max' ? (cur[k] > n2 ? ', EXPIRED' : '') : (cur[k] >= n2 ? ', met' : `, ${n2 - cur[k]} to go`)})`).join(', ')}`);
      if (c.host) colonyLinks(c.host).forEach((x) => L.push(x));
      const hits = [];
      for (const [m, d] of pool) {
        if (m === n) continue;
        const why = [];
        const tg = d.tags.filter((x) => (c.scales || []).includes(x) || (c.triggers || []).includes(x));
        if (tg.length) why.push(`feeds its ${tg.join('/')}`, 'w');
        const back = c.tags.filter((x) => (d.scales || []).includes(x) || (d.triggers || []).includes(x));
        if (back.length) why.push(`scales on its ${back.join('/')}`);
        if (c.host && (d.feeds || []).includes(c.host)) why.push(`adds ${c.host}`);
        if (d.host && (c.feeds || []).includes(d.host)) why.push(`hosts ${d.host}`);
        if (c.req && d.tags.some((x) => c.req[x])) why.push('tag toward req');
        if ((c.uses || []).includes('energy') && d.tags.includes('power')) why.push('power tag (energy)');
        if (why.length) hits.push([m, why.filter((x) => x !== 'w').join('; '), why.length]);
      }
      hits.sort((a, b) => b[2] - a[2]).slice(0, 12).forEach(([m, why]) => line(m, why));
    }
    return L.join('\n');
  }

  const mine = ours(idx, [...inPlay].filter((n) => p.tableau.some((c) => c.name === n)).concat(hand));
  L.push('PAYOFFS (scale/trigger on tags we have >=2):');
  pool.filter(([, c]) => [...(c.scales || []), ...(c.triggers || [])].some((x) => t(x) >= 2))
    .map(([n, c]) => [n, [...new Set([...(c.scales || []), ...(c.triggers || [])])].filter((x) => t(x) >= 2)])
    .sort((a, b) => Math.max(...b[1].map(t)) - Math.max(...a[1].map(t))).slice(0, 12)
    .forEach(([n, xs]) => line(n, xs.map((x) => `${x}x${t(x)}`).join(' ')));
  L.push('UNLOCKS (tag requirements >=2, within 2 of our count, tag already started):');
  pool.filter(([, c]) => c.req && Object.entries(c.req).every(([k, n]) => n - t(k) <= 2 && t(k) >= 1) && Object.values(c.req).some((n) => n >= 2))
    .map(([n, c]) => [n, Object.entries(c.req).map(([k, m]) => `${k} ${t(k)}/${m}`).join(' '), Object.entries(c.req).reduce((s, [k, m]) => s + Math.max(0, m - t(k)), 0)])
    .sort((a, b) => a[2] - b[2]).slice(0, 12).forEach(([n, why, gap]) => line(n, `${why}${gap ? '' : ' READY'}`));
  L.push('RESOURCE LINKS (feeders for our hosts, hosts for our feeders):');
  [...mine.hosts].forEach((r) => colonyLinks(r).forEach((x) => L.push(x)));
  pool.filter(([, c]) => (c.feeds || []).some((r) => mine.hosts.has(r)) || (c.host && mine.feeds.has(c.host)))
    .slice(0, 12).forEach(([n, c]) => line(n, (c.feeds || []).some((r) => mine.hosts.has(r)) ? `adds ${c.feeds.filter((r) => mine.hosts.has(r))}` : `hosts ${c.host}`));
  const stock = [['steel', p.steel, p.steelProduction, 'building'], ['titanium', p.titanium, p.titaniumProduction, 'space']];
  for (const [r, n, prod, tag] of stock) {
    if (n < 4 && prod < 1) continue;
    L.push(`${r.toUpperCase()} SINKS (we have ${n}, +${prod}): converters, and ${tag}-tag VP/city cards`);
    pool.filter(([, c]) => (c.uses || []).includes(r)).slice(0, 6).forEach(([m]) => line(m, `uses ${r}`));
    pool.filter(([, c]) => c.tags.includes(tag) && (c.tags.includes('city') || c.scales)).slice(0, 8).forEach(([m]) => line(m, `${tag} tag`));
  }
  let hunt = '';
  try { hunt = fs.readFileSync(`${liveDir}/hunt.md`, 'utf8'); } catch { /* none yet */ }
  const names = [...hunt.matchAll(/^- ([^—:(\n]+?)\s*(?:[—:(]|$)/gm)].map((m) => m[1].trim()).filter((n) => idx[n]);
  if (names.length) { L.push('HUNT LIST (hunt.md):'); names.forEach((n) => line(n, '')); }
  return L.join('\n');
}

module.exports = {buildIndex, query};
