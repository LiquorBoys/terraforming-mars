// Draws the league page. All numbers come from compute.js; this file only lays them out.
// Names and game titles are other people's text, so they only ever reach the page through
// textContent, never as HTML.
import {computeLeague, START_RATING} from './compute.js';

const DATA_URL = 'https://raw.githubusercontent.com/LiquorBoys/tm-league/main/games.json';
// ?data=some-file.json loads a file that sits next to this page instead (for previews).
const override = new URLSearchParams(location.search).get('data');
const source = override && /^[\w.-]+\.json$/.test(override) ? `./${override}` : DATA_URL;

const SVG = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, ...children) {
  const svg = ['svg', 'path', 'line', 'circle', 'text', 'rect', 'g'].includes(tag);
  const node = svg ? document.createElementNS(SVG, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c) node.append(c);
  return node;
}
const fmt = (n, digits = 0) => n.toLocaleString(undefined, {minimumFractionDigits: digits, maximumFractionDigits: digits});
const signed = (n, digits = 0) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), digits);
const day = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : '');
const seriesColor = (p) => (p.claudeModel === 'opus' ? 'var(--series-1)' : p.claudeModel === 'sonnet' ? 'var(--series-2)' : 'var(--context)');

// ---- one tooltip for the whole page: values lead, labels follow ----
const tip = document.getElementById('tip');
function showTip(evt, title, rows) {
  tip.replaceChildren();
  if (title) tip.append(el('div', {class: 'k', text: title}));
  for (const r of rows) {
    tip.append(el('div', {},
      r.color ? el('span', {class: 'ln', style: `border-color:${r.color}`}) : null,
      el('span', {class: 'v', text: r.value}), ' ', el('span', {class: 'k', text: r.label})));
  }
  tip.style.display = 'block';
  const box = tip.getBoundingClientRect();
  const at = evt.clientX !== undefined ? {x: evt.clientX, y: evt.clientY} : (() => { const b = evt.target.getBoundingClientRect(); return {x: b.left + b.width / 2, y: b.top}; })();
  tip.style.left = Math.max(8, Math.min(window.innerWidth - box.width - 8, at.x + 14)) + 'px';
  tip.style.top = Math.max(8, Math.min(window.innerHeight - box.height - 8, at.y + 14)) + 'px';
}
const hideTip = () => { tip.style.display = 'none'; };
/** Same details on hover and on keyboard focus. */
function withTip(node, title, rows) {
  node.setAttribute('tabindex', '0');
  node.addEventListener('pointermove', (e) => showTip(e, title, rows));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focus', (e) => showTip(e, title, rows));
  node.addEventListener('blur', hideTip);
  return node;
}

function tile(label, value, note) {
  return el('div', {class: 'tile'}, el('div', {class: 'label', text: label}), el('div', {class: 'value', text: value}), note ? el('div', {class: 'note', text: note}) : null);
}

function sparkline(p) {
  const pts = [{rating: START_RATING}, ...p.history];
  const w = 120, h = 26, pad = 5;
  const lo = Math.min(...pts.map((d) => d.rating)), hi = Math.max(...pts.map((d) => d.rating));
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, pts.length - 1);
  const y = (v) => (hi === lo ? h / 2 : h - pad - ((v - lo) * (h - 2 * pad)) / (hi - lo));
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(q.rating).toFixed(1)}`).join('');
  const last = pts.length - 1;
  return el('svg', {width: w, height: h, role: 'img', 'aria-label': `Rating over ${p.games} games, now ${Math.round(p.rating)}`},
    el('path', {d, fill: 'none', stroke: 'var(--text-muted)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}),
    el('circle', {cx: x(last), cy: y(pts[last].rating), r: 4, fill: p.claudeModel ? seriesColor(p) : 'var(--text-secondary)', stroke: 'var(--surface-1)', 'stroke-width': 2}));
}

function ratingsCard(league) {
  const rows = league.players.map((p, i) => el('tr', {},
    el('td', {class: 'num muted', text: i + 1}),
    el('td', {}, el('span', {class: 'key', style: `background:${seriesColor(p)}`}), el('span', {text: p.name})),
    el('td', {class: 'num', text: fmt(Math.round(p.rating))}),
    el('td', {class: 'num muted', text: signed(Math.round(p.lastDelta))}),
    el('td', {class: 'num', text: p.games}),
    el('td', {class: 'num', text: p.wins}),
    el('td', {}, sparkline(p))));
  return el('section', {class: 'card'},
    el('h2', {text: 'Ratings'}),
    el('div', {class: 'scroll'}, el('table', {},
      el('thead', {}, el('tr', {}, ...[['#', 'num'], ['Player'], ['Rating', 'num'], ['Last game', 'num'], ['Games', 'num'], ['Wins', 'num'], ['History']].map(([t, c]) => el('th', {class: c, text: t})))),
      el('tbody', {}, rows))));
}

// ---- Opus v Sonnet: the two Claudes are the subject, everyone else is context ----
function claudeChart(league) {
  const claudes = league.players.filter((p) => p.claudeModel === 'opus' || p.claudeModel === 'sonnet');
  const card = el('section', {class: 'card'},
    el('h2', {text: 'Opus v Sonnet'}));
  if (claudes.length === 0) { card.append(el('p', {class: 'muted', text: 'Claude has not finished a recorded game yet.'})); return card; }

  const total = league.games.length;
  // Drawn at the width it is shown at, so the text stays its real size on a phone.
  const W = Math.max(300, Math.min(1000, document.getElementById('app').clientWidth - 42)), H = 280;
  const m = {l: 44, r: W < 520 ? 96 : 120, t: 12, b: 30};
  const all = league.players.flatMap((p) => p.history.map((h) => h.rating)).concat(START_RATING);
  const step = 50;
  const lo = Math.floor((Math.min(...all) - 10) / step) * step, hi = Math.ceil((Math.max(...all) + 10) / step) * step;
  const x = (g) => m.l + (g * (W - m.l - m.r)) / Math.max(1, total);
  const y = (v) => m.t + ((hi - v) * (H - m.t - m.b)) / (hi - lo);
  const path = (p) => [{game: 0, rating: START_RATING}, ...p.history].map((h, i) => `${i ? 'L' : 'M'}${x(h.game).toFixed(1)},${y(h.rating).toFixed(1)}`).join('');

  const svg = el('svg', {width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Ratings of Claude on Opus and Claude on Sonnet over time, with every other player in grey'});
  for (let v = lo; v <= hi; v += step) {
    svg.append(el('line', {x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === START_RATING ? 'var(--axis)' : 'var(--grid)', 'stroke-width': 1}));
    svg.append(el('text', {x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', text: fmt(v)}));
  }
  const ticks = [...new Set([1, Math.round(total / 2), total].filter((g) => g >= 1))];
  for (const g of ticks) svg.append(el('text', {x: x(g), y: H - 10, 'text-anchor': 'middle', text: `game ${g}`}));
  for (const p of league.players.filter((q) => !claudes.includes(q))) {
    svg.append(el('path', {d: path(p), fill: 'none', stroke: 'var(--context)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
  }
  // Direct labels at the line ends, pushed apart with a leader line when the two end close together.
  const ends = claudes.map((p) => ({p, x: x(p.history.at(-1).game), y: y(p.rating), ly: y(p.rating)})).sort((a, b) => a.y - b.y);
  if (ends.length === 2 && ends[1].ly - ends[0].ly < 16) { const mid = (ends[0].ly + ends[1].ly) / 2; ends[0].ly = mid - 8; ends[1].ly = mid + 8; }
  for (const e of ends) {
    svg.append(el('path', {d: path(e.p), fill: 'none', stroke: seriesColor(e.p), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}));
    const lx = W - m.r + 12;
    if (Math.abs(e.ly - e.y) > 1 || e.x < W - m.r - 1) svg.append(el('line', {x1: e.x + 6, y1: e.y, x2: lx - 4, y2: e.ly, stroke: 'var(--axis)', 'stroke-width': 1}));
    svg.append(el('circle', {cx: e.x, cy: e.y, r: 4, fill: seriesColor(e.p), stroke: 'var(--surface-1)', 'stroke-width': 2}));
    svg.append(el('text', {class: 'direct', x: lx, y: e.ly + 4, text: `${e.p.claudeModel === 'opus' ? 'Opus' : 'Sonnet'} ${fmt(Math.round(e.p.rating))}`}));
  }
  // Crosshair: aim at a game, read both models.
  const hair = el('line', {y1: m.t, y2: H - m.b, stroke: 'var(--text-muted)', 'stroke-width': 1, visibility: 'hidden'});
  const ratingAt = (p, g) => { let r = START_RATING; for (const h of p.history) if (h.game <= g) r = h.rating; return r; };
  const hit = el('rect', {x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent'});
  hit.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const g = Math.max(1, Math.min(total, Math.round(((e.clientX - box.left) * (W / box.width) - m.l) / ((W - m.l - m.r) / Math.max(1, total)))));
    hair.setAttribute('x1', x(g)); hair.setAttribute('x2', x(g)); hair.setAttribute('visibility', 'visible');
    const game = league.games[g - 1];
    showTip(e, `Game ${g} · ${game.name} · ${day(game.createdAt)}`, claudes.map((p) => ({value: fmt(Math.round(ratingAt(p, g))), label: p.name, color: seriesColor(p)})));
  });
  hit.addEventListener('pointerleave', () => { hair.setAttribute('visibility', 'hidden'); hideTip(); });
  svg.append(hair, hit);

  const legend = el('div', {class: 'legend'},
    ...claudes.map((p) => el('span', {}, el('span', {class: 'line', style: `border-color:${seriesColor(p)}`}), el('span', {text: `${p.name} · ${p.games} game${p.games === 1 ? '' : 's'}`}))),
    el('span', {}, el('span', {class: 'line', style: 'border-color:var(--context)'}), el('span', {text: 'Everyone else'})));
  const tableRows = league.games.filter((g) => g.players.some((p) => p.claudeModel)).map((g) => {
    const c = g.players.find((p) => p.claudeModel);
    return el('tr', {}, el('td', {class: 'num', text: g.index}), el('td', {text: day(g.createdAt)}), el('td', {text: c.displayName}),
      el('td', {class: 'num', text: `${c.rank} of ${g.players.length}`}), el('td', {class: 'num', text: fmt(Math.round(c.ratingBefore + c.ratingDelta))}), el('td', {class: 'num', text: signed(Math.round(c.ratingDelta))}));
  });
  card.append(legend, el('div', {class: 'scroll'}, svg), el('details', {}, el('summary', {text: 'Table view'}),
    el('div', {class: 'scroll'}, el('table', {}, el('thead', {}, el('tr', {}, ...[['Game', 'num'], ['Date'], ['Model'], ['Finish', 'num'], ['Rating', 'num'], ['Change', 'num']].map(([t, c]) => el('th', {class: c, text: t})))), el('tbody', {}, tableRows)))));
  return card;
}

function corporationsCard(league) {
  const scale = Math.max(0.05, ...league.corporations.map((c) => Math.abs(c.score)));
  const rows = league.corporations.map((c) => {
    const bar = el('div', {class: 'div'}, el('span', {class: c.score >= 0 ? 'pos' : 'neg', style: `width:${(Math.abs(c.score) / scale) * 50}%${c.thin ? ';opacity:0.45' : ''}`}));
    withTip(bar, c.name, [
      {value: signed(c.score, 2), label: 'against expectation, adjusted for sample size'},
      {value: signed(c.surpriseSum / c.plays, 2), label: 'raw average'},
      {value: `${c.plays}`, label: c.plays === 1 ? 'play' : 'plays'},
    ]);
    return el('tr', {class: c.thin ? 'thin' : undefined},
      el('td', {text: c.name}), el('td', {class: 'num', text: c.plays}), el('td', {class: 'num', text: c.wins}),
      el('td', {class: 'num', text: fmt(c.avgRank, 1)}), el('td', {}, bar), el('td', {class: 'num', text: signed(c.score, 2)}));
  });
  return el('section', {class: 'card'},
    el('h2', {text: 'Corporations'}),
    el('div', {class: 'scroll'}, el('table', {},
      el('thead', {}, el('tr', {}, ...[['Corporation'], ['Plays', 'num'], ['Wins', 'num'], ['Avg finish', 'num'], ['Against expectation'], ['', 'num']].map(([t, c]) => el('th', {class: c, text: t})))),
      el('tbody', {}, rows))));
}

/** A ranked list: a name, a bar and a figure per row, bars on one baseline, one hue. */
function rankedList(title, sub, items) {
  const card = el('section', {class: 'card'}, el('h2', {text: title}), el('p', {class: 'sub', text: sub}));
  if (items.length === 0) { card.append(el('p', {class: 'muted', text: 'Nothing recorded yet.'})); return card; }
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const rows = el('div', {class: 'rows'});
  for (const i of items.slice(0, 10)) {
    const row = el('div', {class: 'row'},
      el('span', {class: 'name', title: i.name, text: i.name}),
      el('div', {class: 'bar'}, el('span', {style: `width:${Math.max(0, (i.value / max) * 100)}%`})),
      el('span', {class: 'num', text: i.figure}));
    withTip(row.children[1], i.name, i.detail);
    rows.append(row);
  }
  card.append(rows);
  return card;
}

function sillyCards(league) {
  const ps = league.players;
  const warehouse = ps.filter((p) => p.games > 0).sort((a, b) => b.unspentAvg - a.unspentAvg).map((p) => ({
    name: p.name, value: p.unspentAvg, figure: `${fmt(p.unspentAvg)} M€`,
    detail: [{value: `${fmt(p.unspentAvg)} M€`, label: `per game over ${p.games}`}, ...(p.unspentMaxGame ? [{value: `${fmt(p.unspentMax)} M€`, label: `worst: ${p.unspentMaxGame}`}] : [])],
  }));
  const givers = ps.filter((p) => p.awardsFunded > 0).sort((a, b) => b.awardsGifted - a.awardsGifted || a.awardsFunded - b.awardsFunded).map((p) => ({
    name: p.name, value: p.awardsGifted, figure: `${p.awardsGifted} of ${p.awardsFunded}`,
    detail: [{value: `${p.awardsGifted}`, label: 'awards paid for and not won'}, {value: `${p.awardsFunded}`, label: 'awards funded in all'}],
  }));
  const clock = ps.filter((p) => p.secondsPerAction !== null).sort((a, b) => b.secondsPerAction - a.secondsPerAction).map((p) => ({
    name: p.name, value: p.secondsPerAction, figure: `${fmt(p.secondsPerAction)} s`,
    detail: [{value: `${fmt(p.secondsPerAction)} s`, label: 'per action'}, {value: `${fmt(p.clockMs / 60000)} min`, label: `on the clock over ${p.games} game${p.games === 1 ? '' : 's'}`}],
  }));
  return el('div', {class: 'lists'},
    rankedList('Left in the warehouse', 'Steel and titanium still unspent when the last generation ended, at what it was worth to them, per game.', warehouse),
    rankedList('Philanthropist', 'Awards they paid to fund and then did not win.', givers),
    rankedList('On the clock', 'Seconds of their own clock per action taken.', clock));
}

function gamesCard(league) {
  const rows = [...league.games].reverse().map((g) => el('tr', {},
    el('td', {class: 'num muted', text: g.index}),
    el('td', {class: 'nowrap', text: day(g.createdAt)}),
    el('td', {text: g.name}),
    el('td', {class: 'num', text: g.generations}),
    el('td', {class: 'players'}, ...g.players.flatMap((p, i) => [i ? ' · ' : '', el('span', {},
      el('span', {text: `${p.rank}. ${p.displayName} ${p.vp}`}), ' ', el('span', {class: 'muted', text: `${(p.corps ?? []).join(' + ')} ${signed(Math.round(p.ratingDelta))}`}))]))));
  return el('section', {class: 'card'},
    el('h2', {text: 'Games'}),
    el('div', {class: 'scroll'}, el('table', {},
      el('thead', {}, el('tr', {}, ...[['#', 'num'], ['Date'], ['Game'], ['Gens', 'num'], ['Result']].map(([t, c]) => el('th', {class: c, text: t})))),
      el('tbody', {}, rows))));
}

async function main() {
  const lede = document.getElementById('lede'), app = document.getElementById('app');
  let games;
  try {
    const res = await fetch(source, {cache: 'no-cache'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    games = await res.json();
  } catch (err) {
    lede.textContent = `Could not load the game records from ${source}: ${err.message}`;
    return;
  }
  if (!Array.isArray(games) || games.length === 0) {
    lede.textContent = 'No finished games have been recorded yet. Games created with /tm-newgame appear here when they end.';
    return;
  }
  const league = computeLeague(games);
  const last = league.games.at(-1);
  lede.textContent = `${league.games.length} game${league.games.length === 1 ? '' : 's'} recorded, most recently ${last.name} on ${day(last.endedAt ?? last.createdAt)}.`;
  const gens = league.games.reduce((s, g) => s + g.generations, 0) / league.games.length;
  const leader = league.players[0];
  app.replaceChildren(
    el('div', {class: 'tiles'},
      tile('Games', fmt(league.games.length)),
      tile('Players', fmt(league.players.length)),
      tile('Top rating', fmt(Math.round(leader.rating)), leader.name),
      tile('Generations per game', fmt(gens, 1))),
    ratingsCard(league), claudeChart(league), corporationsCard(league), sillyCards(league), gamesCard(league));
}
main();
