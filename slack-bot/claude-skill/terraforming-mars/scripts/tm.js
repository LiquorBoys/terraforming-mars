#!/usr/bin/env node
// Terraforming Mars agent helper for the open-source app (github.com/terraforming-mars/terraforming-mars).
// Talks to the JSON API directly: the player id in the URL is the only credential, no cookies needed.
//
// CLI (preferred):  node --use-system-ca tm.js [<player-url>] <command> [args...]
//   Passing a player URL saves it as the current seat (cache/session.json); later calls can omit it.
//   Run `node tm.js help` for commands.
// Browser fallback: paste this file into javascript_tool on the TM host -> defines window.TM (same methods, async,
//   returning text). The extension truncates output at ~1000 chars and blocks text containing '=', so prefer the CLI.
(function tmInit() {
  const isNode = typeof window === 'undefined';
  const T = isNode ? {} : (window.TM = window.TM || {});

  const PAY_KEYS = ['megacredits', 'heat', 'steel', 'titanium', 'plants', 'microbes', 'floaters', 'lunaArchivesScience',
    'spireScience', 'seeds', 'auroraiData', 'graphene', 'kuiperAsteroids'];
  const BONUS = ['ti', 'steel', 'plant', 'card', 'heat', 'OCEAN', 'mc', 'animal', 'microbe', 'energy', 'data', 'science',
    'energyProd', 'temp', 'restricted', 'asteroid', 'delegate', 'colony', 'temp4mc'];
  // Colony tiles: build bonus / trade track (index = trackPosition) / colony bonus to owners when anyone trades
  const COLONY = {
    Luna: ['+2 MC prod', 'MC 1,2,4,7,10,13,17', '2 MC'], Ceres: ['+1 steel prod', 'steel 1,2,3,4,6,8,10', '2 steel'],
    Io: ['+1 heat prod', 'heat 2,3,4,6,8,10,13', '2 heat'], Europa: ['place ocean', 'prod MC,MC,en,en,pl,pl,pl', '1 MC'],
    Ganymede: ['+1 plant prod', 'plants 0,1,2,3,4,5,6', '1 plant'], Callisto: ['+1 energy prod', 'energy 0,2,3,5,7,10,13', '3 energy'],
    Triton: ['3 ti', 'ti 0,1,1,2,3,4,5', '1 ti'], Titan: ['3 floaters', 'floaters 0,1,1,2,3,3,4', '1 floater'],
    Enceladus: ['3 microbes', 'microbes 0,1,2,3,4,4,5', '1 microbe'], Miranda: ['1 animal', 'animals 0,1,1,2,2,3,3', '1 card'],
    Pluto: ['draw 2 cards', 'cards 0,1,2,2,3,3,4', 'draw 1 discard 1'],
  };
  T.colonyLine = (c) => {
    const i = COLONY[c.name];
    if (T.compact) { // name, owners, visitor, current trade value only
      const cur = i ? `${i[1].split(' ')[0]} ${i[1].split(' ')[1].split(',')[c.trackPosition] ?? '?'}` : `track:${c.trackPosition}`;
      return `${c.name}${c.isActive === false ? ' INACTIVE' : ''} ${c.colonies.join('/') || '-'}${c.visitor ? ' visited:' + c.visitor : ''} trade ${cur}`;
    }
    const trade = i ? i[1].replace(/^(\S+ )(.*)$/, (_, k, v) => k + v.split(',').map((x, j) => (j === c.trackPosition ? `[${x}]` : x)).join(',')) : '';
    return `${c.name}${c.isActive === false ? ' INACTIVE' : ''} colonies:${c.colonies.join('/') || '-'}${c.visitor ? ' visited:' + c.visitor : ''}` +
      (i ? ` | build ${i[0]}; trade ${trade}; owner bonus ${i[2]}` : ` track:${c.trackPosition}`);
  };
  const isCity = (s) => s.tileType === 2 || s.tileType === 3;
  const isOcean = (s) => s.tileType === 1;
  const isGreen = (s) => s.tileType === 0;

  T.msg = (t) => (t == null ? '' : typeof t === 'string' ? t : t.message.replace(/\$\{(\d+)\}/g, (_, i) => t.data?.[i]?.value ?? ''));
  T.payment = (p = {}) => Object.fromEntries(PAY_KEYS.map((k) => [k, p[k] ?? 0]));

  // ---------- HTTP ----------
  T.base = isNode ? '' : location.origin;
  if (!isNode) {
    const id = new URLSearchParams(location.search).get('id');
    if (!T.pid && id?.startsWith('p')) T.pid = id;
  }
  T.get = async (path) => {
    const r = await fetch(T.base + path);
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();
  };
  // Every official board is the same 61-hex grid: ids 03..63 in rows of 5,6,7,8,9,8,7,6,5, x = index + |4 - row|.
  // Some servers omit space x/y, so fill them from the id (the graph is static; only tiles change).
  T.geo = (v) => {
    const L = [5, 6, 7, 8, 9, 8, 7, 6, 5], xy = {};
    let id = 3; L.forEach((n, y) => { for (let p = 0; p < n; p++) xy[String(id++).padStart(2, '0')] = [p + Math.abs(4 - y), y]; });
    for (const sp of v?.game?.spaces || []) if (sp.x == null) { const g = xy[sp.id]; [sp.x, sp.y] = g || [-1, -1]; }
    return v;
  };
  T.state = async (pid = T.pid) => (T.v = T.geo(await T.get(`/api/player?id=${pid}`)));
  T.seats = async () => {
    const v = T.v || await T.state();
    return v.players.map((p) => `${p.name} (${p.color})${p.color === v.thisPlayer.color ? ' <- this seat' : ''}`).join('\n') +
      `\ngame "${v.game.name}", spectator link: ${T.base}/spectator?id=${v.game.spectatorId}`;
  };

  // Poll the tiny /api/waitingfor endpoint; the full player state is re-fetched only when it reports GO/REFRESH
  // (passing runId matters: without it newer servers answer REFRESH every time). stop(v) returns a result string to
  // finish, or falsy to keep polling. Returns null on timeout. T.lastW = last waitingfor reply. Network blips are retried.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  T.poll = async (maxSec, ms, stop) => {
    const t0 = Date.now();
    if (!T.v) await T.state();
    for (;;) {
      const r = await stop(T.v); if (r) return r; // stop may submit input (T.send updates T.v)
      if (Date.now() - t0 > maxSec * 1000) return null;
      await sleep(ms);
      try {
        const v = T.v, g = v.game;
        T.lastW = await T.get(`/api/waitingfor?id=${T.pid}&gameAge=${g.gameAge}&undoCount=${g.undoCount}${v.runId ? '&runId=' + v.runId : ''}`);
        if (T.lastW.result !== 'WAIT') await T.state();
      } catch { /* transient network error: try again next tick */ }
    }
  };
  // Poll until this seat has an input (or the game ended). Like the old loop (where the server's GO short-circuited
  // the optional check), an optional input counts as GO too.
  T.wait = async (maxSec = 25, ms = 3000) => {
    await T.state();
    return await T.poll(maxSec, ms, (v) => (v.waitingFor ? 'GO' : v.game.phase === 'end' ? 'END' : null)) ??
      `WAIT (still waiting on: ${T.lastW?.waitingFor?.join(',') || '?'}; phase ${T.v.game.phase})`;
  };

  // POST a raw InputResponse. Returns 'OK' + the next pending input, or 'ERROR: ...' (server state unchanged).
  T.send = async (resp) => {
    const r = await fetch(`${T.base}/player/input?id=${T.pid}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(resp)});
    const body = await r.json().catch(() => ({message: `HTTP ${r.status}`}));
    if (!r.ok) return `ERROR: ${body.message}${body.id ? ' (' + body.id + ')' : ''}\nsent: ${JSON.stringify(resp).slice(0, 600)}`;
    T.v = T.geo(body);
    return 'OK\n' + (body.waitingFor ? T.render(body.waitingFor) : '(no input pending - waiting for others; use `wait`)');
  };

  // ---------- Card database (tags/cost/requirements/text; the API only gives names) ----------
  // The client bundle embeds data as JSON.parse('...') string literals: the card DB and milestone/award descriptions.
  const jsonBlobs = function* (src) {
    const re = /JSON\.parse\('((?:[^'\\]|\\.)*)'\)/g;
    let m;
    while ((m = re.exec(src))) {
      try { yield JSON.parse(Function(`return '${m[1]}'`)()); } catch { /* not JSON */ }
    }
  };
  // Returns {cards: ClientCard[], ma: {name: description}} (either may be missing).
  T.fetchDb = async () => {
    const main = await (await fetch(`${T.base}/main.js`)).text();
    let urls = ['/main.js', ...new Set([...main.matchAll(/\.e\((\d+)\)/g)].map((m) => `/chunks/${m[1]}.js`))];
    if (!isNode) urls = [...new Set([...performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname).filter((n) => n.includes('/chunks/')), ...urls])];
    const out = {cards: undefined, ma: {}};
    for (const url of urls) {
      let src;
      try { src = url === '/main.js' ? main : await (await fetch(T.base + url)).text(); } catch { continue; } // nonexistent chunk ids 404 (some proxies mangle those)
      if (!src.includes('startingMegaCredits') && !src.includes('"description"')) continue;
      for (const blob of jsonBlobs(src)) {
        if (!Array.isArray(blob) || !blob.length || typeof blob[0] !== 'object') continue;
        if (blob[0].metadata?.cardNumber !== undefined || blob.some((c) => c.startingMegaCredits !== undefined)) out.cards = blob;
        else if (blob.every((x) => typeof x.name === 'string' && typeof x.description === 'string')) blob.forEach((x) => { out.ma[x.name] = x.description; });
      }
    }
    return out;
  };
  T.setDb = (arr) => { T.db = new Map(arr.map((c) => [c.name, c])); };
  T.loadDb = async () => {
    if (T.db) return `card db cached (${T.db.size})`;
    const {cards, ma} = await T.fetchDb();
    T.ma = ma;
    if (!cards) return 'card db NOT found (card details unavailable)';
    T.setDb(cards);
    return `card db loaded: ${T.db.size} cards, ${Object.keys(ma).length} milestone/award descriptions`;
  };
  T.cardDef = (name) => T.db?.get(name) ?? T.db?.get(String(name).replace(/:SP$/, ''));
  const reqText = (reqs) => (reqs || []).map((r) => {
    const cnt = r.count ?? 1;
    const op = r.max ? '<=' : '>=';
    if (r.tag) return `${r.tag}tag${op}${cnt}`;
    const k = Object.keys(r).find((x) => !['count', 'max', 'all', 'nextTo', 'text'].includes(x));
    if (!k) return JSON.stringify(r);
    if (typeof r[k] === 'string') return `${r[k]}-${k}${op}${cnt}`; // e.g. {production:'titanium'} -> titanium-production>=1
    return `${k}${op}${typeof r[k] === 'number' ? r[k] : cnt}`;
  }).join(',');
  const vpText = (vp) => (vp == null ? '' : typeof vp === 'number' ? `${vp}VP` : vp === 'special' ? 'VP*' :
    vp.per ? `1VP/${vp.per}${vp.resourcesHere ? 'res' : vp.tag ? vp.tag : ''}` : 'VP*');
  T.cardText = (d, max = T.compact ? 90 : 240) => {
    if (!d) return '';
    const desc = d.metadata?.description;
    const out = [];
    (function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (typeof x.text === 'string') out.push(x.text);
      if (Array.isArray(x)) x.forEach((e) => typeof e === 'string' && out.push(e)); // "Effect: …"/"Action: …" rows
      Object.values(x).forEach(walk);
    })(d.metadata?.renderData);
    const s = [desc ? (typeof desc === 'string' ? desc : desc.text) : '', ...new Set(out)].filter(Boolean).join(' | ');
    return s.length > max ? s.slice(0, max - 3) + '...' : s;
  };
  // One line per card: name, cost, tags, requirements, VP, resources, text
  T.cardLine = (c, max) => {
    const name = typeof c === 'string' ? c : c.name;
    const d = T.cardDef(name);
    const cost = typeof c === 'object' && c.calculatedCost != null ? c.calculatedCost : d?.cost;
    const parts = [name];
    if (cost != null && d?.type !== 'corporation' && d?.type !== 'prelude') parts.push(`$${cost}`);
    if (d?.type && !['automated', 'standard_project'].includes(d.type)) parts.push(`(${d.type})`);
    if (d?.tags?.length) parts.push(`[${d.tags.join(',')}]`);
    if (d?.requirements?.length) parts.push(`req:${reqText(d.requirements)}`);
    if (d && vpText(d.victoryPoints)) parts.push(vpText(d.victoryPoints));
    if (typeof c === 'object' && c.resources) parts.push(`res:${c.resources}`);
    if (typeof c === 'object' && c.isDisabled) parts.push('DISABLED');
    const txt = T.cardText(d, max);
    return parts.join(' ') + (txt ? ` — ${txt}` : '');
  };
  T.cards = (...names) => names.flat().map((n) => T.cardLine(n, 600)).join('\n');

  // ---------- Board ----------
  const xyIndex = new WeakMap();
  T.neighbors = (s, spaces = T.v.game.spaces) => {
    if (s.x < 0) return [];
    let idx = xyIndex.get(spaces); // (x,y) -> space, built once per spaces array instead of a linear scan per lookup
    if (!idx) {
      idx = new Map();
      for (const o of spaces) { const k = `${o.x},${o.y}`; if (!String(o.id).startsWith('m') && !idx.has(k)) idx.set(k, o); } // first match wins, as find() did
      xyIndex.set(spaces, idx);
    }
    const at = (x, y) => idx.get(`${x},${y}`);
    const {x, y} = s;
    const c = y < 4 ? [[x, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x, y + 1]] :
      y === 4 ? [[x, y - 1], [x + 1, y - 1], [x, y + 1], [x + 1, y + 1]] :
        [[x - 1, y - 1], [x, y - 1], [x, y + 1], [x + 1, y + 1]];
    return [[x - 1, y], [x + 1, y], ...c].map(([a, b]) => at(a, b)).filter(Boolean);
  };
  // Describe a candidate space: bonuses and what is adjacent (for placement decisions)
  T.spaceLine = (id) => {
    const sp = T.v.game.spaces;
    const s = sp.find((o) => o.id === id);
    if (!s) return id;
    const me = T.v.thisPlayer.color;
    const n = T.neighbors(s, sp);
    const cnt = (f) => n.filter(f).length;
    const bits = [`${id}(${s.x},${s.y}) ${s.spaceType}`];
    if (s.bonus?.length) bits.push('bonus:' + s.bonus.map((b) => BONUS[b] ?? b).join('+'));
    const adj = [];
    const oc = cnt(isOcean); if (oc) adj.push(`ocean×${oc}(+${2 * oc}mc)`);
    const myC = cnt((o) => isCity(o) && o.color === me); if (myC) adj.push(`MYcity×${myC}`);
    const opC = n.filter((o) => isCity(o) && o.color !== me).map((o) => o.color || 'neutral'); if (opC.length) adj.push(`city:${opC.join('/')}`);
    const myG = cnt((o) => isGreen(o) && o.color === me); if (myG) adj.push(`MYgreen×${myG}`);
    const opG = cnt((o) => isGreen(o) && o.color !== me); if (opG) adj.push(`green(opp)×${opG}`);
    const other = n.filter((o) => o.tileType != null && !isCity(o) && !isOcean(o) && !isGreen(o)).map((o) => `tile${o.tileType}:${o.color || '-'}`); if (other.length) adj.push(other.join('/'));
    const empty = n.filter((o) => o.tileType == null && (o.spaceType === 'land' || o.spaceType === 'deflection')).length; adj.push(`emptyLand×${empty}`);
    const oslot = n.filter((o) => o.tileType == null && o.spaceType === 'ocean').length; if (oslot) adj.push(`oceanSlot×${oslot}`);
    return bits.join(' ') + ' | adj ' + adj.join(', ');
  };
  // Placement view from the local hex graph (no browser): our tiles, rivals' tiles, ranked greenery and city spots.
  // ids given: one adjacency line per id. Also saves the static graph (type, bonus, x, y, neighbors) to cache/maps.
  T.board = async (ids = []) => {
    if (!T.v) await T.state();
    const sp = T.v.game.spaces.filter((s) => s.x >= 0 && !String(s.id).startsWith('m'));
    const N = (s) => T.neighbors(s, T.v.game.spaces);
    T.graph = {board: T.v.game.gameOptions?.boardName, nodes: Object.fromEntries(sp.map((s) => [s.id, {type: s.spaceType, bonus: s.bonus, x: s.x, y: s.y, nbrs: N(s).map((o) => o.id)}]))};
    if (ids.length) return ids.map((id) => T.spaceLine(id)).join('\n');
    const me = T.v.thisPlayer.color, free = (s) => s.tileType == null && (s.spaceType === 'land' || s.spaceType === 'deflection');
    const tag = (s) => s.id + (isCity(s) ? 'C' : isGreen(s) ? 'G' : isOcean(s) ? 'O' : '#');
    const mine = sp.filter((s) => s.color === me), myCities = mine.filter(isCity);
    const L = [T.mapText(), 'ours: ' + mine.map(tag).join(' ')];
    const opp = {}; sp.filter((s) => s.color && s.color !== me).forEach((s) => (opp[s.color] = opp[s.color] || []).push(tag(s)));
    L.push('rivals: ' + Object.entries(opp).map(([c, t]) => c + ' ' + t.join(' ')).join(' | '));
    const score = (s) => { const n = N(s); return {s, mine: n.filter((o) => o.color === me).length, myC: n.filter((o) => isCity(o) && o.color === me).length,
      oc: n.filter(isOcean).length, city: n.filter(isCity).length, empty: n.filter(free).length, bon: (s.bonus || []).length}; };
    const cand = sp.filter(free).map(score);
    L.push('GREENERY (touches our tiles; by our cities, ocean refund, bonus):');
    cand.filter((c) => c.mine).sort((a, b) => b.myC - a.myC || b.oc - a.oc || b.bon - a.bon).slice(0, 8).forEach((c) => L.push('  ' + T.spaceLine(c.s.id)));
    // city: no adjacent city; prefer a one-space gap to one of our cities (the shared empty space is a 2-city greenery)
    const gap = (c) => myCities.filter((m) => N(m).some((x) => free(x) && N(c.s).some((y) => y.id === x.id))).map((m) => m.id);
    L.push('CITY (no adjacent city; gap = shares an empty neighbor with our city):');
    cand.filter((c) => !c.city).map((c) => ({...c, g: gap(c)})).sort((a, b) => b.g.length - a.g.length || b.mine - a.mine || b.empty + b.oc - a.empty - a.oc || b.bon - a.bon)
      .slice(0, 8).forEach((c) => L.push('  ' + T.spaceLine(c.s.id) + (c.g.length ? ' | gap to ' + c.g.join(',') : '')));
    const open = sp.filter((s) => s.spaceType === 'ocean' && s.tileType == null);
    L.push('OCEAN slots open: ' + open.map((s) => s.id + (score(s).mine ? '*' : '')).join(' ') + '  (* touches our tiles)');
    return L.join('\n');
  };
  // ASCII map. Each hex: id + symbol + bonus letters
  T.map = async () => { if (!T.v) await T.state(); return T.mapText(); };
  T.mapText = () => {
    const me = T.v.thisPlayer.color;
    const B = {0: 't', 1: 's', 2: 'p', 3: 'c', 4: 'h', 5: 'o', 6: 'm', 9: 'e'};
    const rows = [];
    for (let y = 0; y < 9; y++) {
      const row = T.v.game.spaces.filter((s) => s.y === y && s.x >= 0 && !String(s.id).startsWith('m')).sort((a, b) => a.x - b.x);
      const cell = (s) => {
        const mine = s.color === me;
        let sym;
        if (isCity(s)) sym = mine ? 'C' : 'c';
        else if (isGreen(s)) sym = mine ? 'G' : 'g';
        else if (isOcean(s)) sym = 'O';
        else if (s.tileType != null) sym = '#';
        else sym = s.spaceType === 'ocean' ? '~' : s.spaceType === 'deflection' ? 'd' : '.';
        const bon = s.tileType == null ? (s.bonus || []).map((b) => B[b] ?? '*').join('') : '';
        return `${s.id}${sym}${bon}`.padEnd(7);
      };
      rows.push(' '.repeat(Math.abs(4 - y) * 4) + row.map(cell).join(' '));
    }
    const owners = [...new Set(T.v.game.spaces.filter((s) => s.color && s.color !== me).map((s) => s.color))];
    return rows.join('\n') + `\nlegend: C/c city mine/other(${owners.join(',')}), G/g greenery mine/other, O ocean, ~ empty ocean slot, # special tile, . empty land, d empty deflection land (yellow zone: plants of a player whose tiles are ALL in it can't be removed); bonus letters t=ti s=steel p=plant c=card h=heat o=ocean m=mc e=energy *=other`;
  };

  // ---------- Rendering the pending input ----------
  T.render = (wf, path = '', depth = 0) => {
    const pad = '  '.repeat(depth);
    const L = [];
    const head = `${pad}${path || 'root'} <${wf.type}> "${T.msg(wf.title)}"${wf.optional ? ' (optional)' : ''}`;
    switch (wf.type) {
      case 'or':
        L.push(head + ' — respond {type:"or",index:i,response:...}');
        wf.options.forEach((o, i) => L.push(T.render(o, `${path}[${i}]`, depth + 1)));
        break;
      case 'and':
        L.push(head + ' — respond {type:"and",responses:[one per option]}');
        wf.options.forEach((o, i) => L.push(T.render(o, `${path}&${i}`, depth + 1)));
        break;
      case 'initialCards':
        L.push(head + ' — use `initial`');
        wf.options.forEach((o, i) => L.push(T.render(o, `${path}#${i}`, depth + 1)));
        break;
      case 'card': {
        const title = T.msg(wf.title);
        L.push(`${head} pick ${wf.min}-${wf.max}${wf.selectBlueCardAction ? ' (blue card action)' : ''}`);
        if (depth > 0 && /sell patents/i.test(title)) { L.push(`${pad}  (any cards from hand)`); break; }
        wf.cards.forEach((c) => L.push(`${pad}  - ${T.cardLine(c)}`));
        break;
      }
      case 'projectCard': {
        L.push(head);
        const std = /standard project/i.test(T.msg(wf.title));
        wf.cards.forEach((c) => L.push(`${pad}  - ${std ? `${c.name} $${c.calculatedCost}${c.isDisabled ? ' DISABLED' : ''}` : T.cardLine(c)}`));
        const po = Object.entries(wf.paymentOptions || {}).filter(([, v]) => v).map(([k]) => k);
        const extra = ['microbes', 'floaters', 'seeds', 'graphene', 'lunaArchivesScience', 'spireScience', 'kuiperAsteroids'].filter((k) => wf[k]).map((k) => `${k}:${wf[k]}`);
        if (po.length || extra.length) L.push(`${pad}  payment options: ${[...po, ...extra].join(', ')}`);
        break;
      }
      case 'space':
        L.push(`${head} ${wf.spaces.length} legal spaces:`);
        if (T.v) wf.spaces.forEach((id) => L.push(`${pad}  - ${T.spaceLine(id)}`));
        else L.push(pad + '  ' + wf.spaces.join(','));
        break;
      case 'amount': L.push(`${head} min ${wf.min} max ${wf.max}`); break;
      case 'player': L.push(`${head} players: ${wf.players.join(',')}`); break;
      case 'delegate': L.push(`${head} players: ${wf.players.join(',')}`); break;
      case 'party': L.push(`${head} parties: ${wf.parties.join(', ')}`); break;
      case 'payment': L.push(`${head} amount ${wf.amount} options ${JSON.stringify(wf.paymentOptions || {})}`); break;
      case 'colony':
        L.push(head);
        (wf.coloniesModel || []).forEach((c) => L.push(`${pad}  - ${T.colonyLine(c)}`));
        break;
      case 'productionToLose': L.push(`${head} lose ${wf.payProduction.cost} production`); break;
      case 'resource': L.push(`${head} choose one of ${wf.include.join(',')}`); break;
      case 'resources': L.push(`${head} total ${wf.count}`); break;
      case 'option': L.push(head + (wf.warnings?.length ? ` warnings:${wf.warnings}` : '')); break;
      default: L.push(`${head} ${JSON.stringify(wf).slice(0, 400)}`);
    }
    return L.join('\n');
  };

  // ---------- Full briefing ----------
  T.brief = async ({hand = true, opp = true} = {}) => {
    if (!T.db) await T.loadDb();
    const v = await T.state();
    const g = v.game, p = v.thisPlayer, ex = g.gameOptions?.expansions || {};
    const L = [];
    const steps = (8 - g.temperature) / 2 + (14 - g.oxygenLevel) + (9 - g.oceans);
    const venus = ex.venus ? ` venus ${g.venusScaleLevel}%` : '';
    L.push(`GEN ${g.generation} phase ${g.phase} | temp ${g.temperature}C o2 ${g.oxygenLevel}% oceans ${g.oceans}/9${venus} | ${steps} global steps left (excl. venus) | deck ${g.deckSize}${g.isTerraformed ? ' | TERRAFORMED' : ''}`);
    const res = (o) => `MC ${o.megacredits}(+${o.megacreditProduction}) St ${o.steel}(+${o.steelProduction}) Ti ${o.titanium}(+${o.titaniumProduction}) Pl ${o.plants}(+${o.plantProduction}) En ${o.energy}(+${o.energyProduction}) He ${o.heat}(+${o.heatProduction})`;
    const tags = (o) => Object.entries(o.tags || {}).filter(([, n]) => n).map(([t, n]) => `${t}${n}`).join(' ');
    const vp = (o) => {
      const b = o.victoryPointsBreakdown;
      if (b?.total == null) return '';
      return ` VP ${b.total} (TR ${b.terraformRating} ms ${b.milestones} aw ${b.awards} green ${b.greenery} city ${b.city} cards ${b.victoryPoints})`;
    };
    const tableau = (o) => o.tableau.map((c) => c.name + (c.resources ? `[${c.resources}]` : '')).join(', ');
    L.push(`ME ${p.name} (${p.color}) TR ${p.terraformRating}${vp(p)}`);
    L.push(`  ${res(p)} | steel worth ${p.steelValue} ti worth ${p.titaniumValue} | cities ${p.citiesCount}${ex.colonies ? ` colonies ${p.coloniesCount} fleet ${p.fleetSize} trades ${p.tradesThisGeneration}` : ''}`);
    L.push(`  tags: ${tags(p)} | actions taken this turn ${p.actionsTakenThisRound} | blue actions used: ${p.actionsThisGeneration.join(', ') || '-'}`);
    L.push(`  tableau: ${tableau(p)}`);
    if (hand) {
      L.push(`HAND (${v.cardsInHand.length}):`);
      v.cardsInHand.forEach((c) => L.push('  - ' + T.cardLine(c)));
      if (v.preludeCardsInHand?.length) L.push('PRELUDES IN HAND: ' + v.preludeCardsInHand.map((c) => c.name).join(', '));
      if (v.draftedCards?.length) L.push('DRAFTED SO FAR: ' + v.draftedCards.map((c) => c.name).join(', '));
    }
    if (opp) {
      v.players.filter((o) => o.color !== p.color).forEach((o) => {
        L.push(`OPP ${o.name} (${o.color}) TR ${o.terraformRating}${vp(o)}${o.isActive ? ' ACTIVE' : ''}${g.passedPlayers.includes(o.color) ? ' PASSED' : ''}`);
        L.push(`  ${res(o)} | hand ${o.cardsInHandNbr} | cities ${o.citiesCount}${ex.colonies ? ` colonies ${o.coloniesCount}` : ''}`);
        if (T.compact) L.push(`  tags: ${tags(o)} | tableau ${o.tableau.length} cards`);
        else { L.push(`  tags: ${tags(o)}`); L.push(`  tableau: ${tableau(o)}`); }
      });
    }
    L.push('MILESTONES (8 MC, 5VP; ! = claimable): ' + g.milestones.map((m) => `${m.name}${m.color ? ' CLAIMED by ' + m.color : ' {' + m.scores.map((s) => `${s.color}:${s.score}${s.claimable ? '!' : ''}`).join(' ') + '}'}`).join('; '));
    L.push('AWARDS (8/14/20 MC; 5VP 1st, 2VP 2nd): ' + g.awards.map((a) => `${a.name}${a.color ? ' FUNDED by ' + a.color : ''} {${a.scores.map((s) => `${s.color}:${s.score}`).join(' ')}}`).join('; '));
    if (g.colonies?.length) { L.push('COLONIES ([x] = current trade value):'); g.colonies.forEach((c) => L.push('  ' + T.colonyLine(c))); }
    if (g.turmoil) {
      const t = g.turmoil;
      L.push(`TURMOIL: ruling ${t.ruling} dominant ${t.dominant} chairman ${t.chairman} | my influence ${p.influence} | lobby ${t.lobby.join(',')}`);
      L.push('  parties: ' + t.parties.map((pt) => `${pt.name}(leader ${pt.partyLeader || '-'}: ${pt.delegates.map((d) => d.color + d.number).join(' ')})`).join('; '));
      L.push(`  events: current ${t.current || '-'}, coming ${t.coming || '-'}, distant ${t.distant || '-'}`);
    }
    L.push('');
    L.push(v.waitingFor ? 'PENDING INPUT:\n' + T.render(v.waitingFor) : 'PENDING INPUT: none (waiting for others) — use `wait`');
    return L.join('\n');
  };

  // Milestones/awards of THIS game with descriptions (they are randomized; never assume the map's defaults).
  T.maText = async () => {
    const v = T.v || await T.state();
    const g = v.game;
    const d = (n) => T.ma?.[n] ?? '(no description found)';
    const L = ['MILESTONES (claim: 8 M€ -> 5 VP; max 3 claimed per game; first to qualify and pay wins it):'];
    g.milestones.forEach((m) => L.push(`  - ${m.name}: ${d(m.name)} | ${m.color ? 'CLAIMED by ' + m.color : m.scores.map((s) => `${s.color}:${s.score}${s.claimable ? ' (claimable!)' : ''}`).join(' ')}`));
    L.push('AWARDS (fund: 8/14/20 M€, max 3 funded; at game end 1st = 5 VP, 2nd = 2 VP (no 2nd place VP in 2-player games); anyone can win a funded award):');
    g.awards.forEach((a) => L.push(`  - ${a.name}: ${d(a.name)} | ${a.color ? 'FUNDED by ' + a.color + ' | ' : ''}${a.scores.map((s) => `${s.color}:${s.score}`).join(' ')}`));
    return L.join('\n');
  };

  // log [n] | log gen <N> | log all  — the server keeps the full history per generation.
  T.log = async (n = 25, gen) => {
    const fmt = (logs) => logs.map((l) => T.msg({message: l.message, data: l.data.map((d) => ({value: d.value}))}));
    if (gen === 'all') {
      const cur = (await T.get(`/api/player?id=${T.pid}`)).game.generation;
      const out = [];
      for (let g = 1; g <= cur; g++) {
        const logs = await T.get(`/api/game/logs?id=${T.pid}&generation=${g}`);
        out.push(`--- generation ${g} ---`, ...fmt(logs));
      }
      return out.join('\n');
    }
    const logs = await T.get(`/api/game/logs?id=${T.pid}${gen ? `&generation=${gen}` : ''}`);
    return (gen ? fmt(logs) : fmt(logs).slice(-n)).join('\n');
  };

  // ---------- Response builders (main action menu) ----------
  const top = () => {
    const wf = T.v?.waitingFor;
    if (!wf) throw new Error('no pending input (waiting for others?) — use `wait`');
    return wf;
  };
  const t = (o) => T.msg(o.title);
  const menuIdx = (pred, what) => {
    const wf = top();
    if (wf.type !== 'or') throw new Error(`pending input is <${wf.type}> "${t(wf)}", not the action menu`);
    const i = wf.options.findIndex(pred);
    if (i < 0) throw new Error(`option not available: ${what}. Options: ${wf.options.map(t).join(' | ')}`);
    return i;
  };
  // If the pending input already is the thing (not wrapped in the menu), respond directly.
  const wrap = (pred, what, inner) => {
    const wf = top();
    if (wf.type !== 'or' && pred(wf)) return inner;
    return {type: 'or', index: menuIdx(pred, what), response: inner};
  };
  const inputFor = (pred, what) => {
    const wf = top();
    return wf.type !== 'or' && pred(wf) ? wf : wf.options[menuIdx(pred, what)];
  };

  // Auto payment: steel for building tags, titanium for space tags (no overpay unless short on M€), rest M€.
  T.autoPay = (cardName, cost, inp = {}) => {
    const p = T.v.thisPlayer, d = T.cardDef(cardName), tags = d?.tags || [];
    const pay = {};
    let left = cost;
    const use = (key, have, val) => {
      if (!have || left <= 0) return;
      let n = Math.min(have, Math.floor(left / val));
      if (left - n * val > p.megacredits && n < have) n = Math.min(have, Math.ceil(left / val));
      pay[key] = n; left -= n * val;
    };
    if (tags.includes('building') || inp.paymentOptions?.steel === true && !d) use('steel', p.steel, p.steelValue);
    if (tags.includes('space')) use('titanium', p.titanium, p.titaniumValue);
    pay.megacredits = Math.max(0, left);
    return T.payment(pay);
  };
  const findCard = (inp, name) => {
    const c = inp.cards.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!c) throw new Error(`"${name}" not in list: ${inp.cards.map((x) => x.name).join(', ')}`);
    if (c.isDisabled) throw new Error(`${c.name} is disabled (unaffordable/unplayable right now)`);
    return c;
  };
  const isPlayMenu = (o) => o.type === 'projectCard' && !/standard project/i.test(t(o));
  const isSpMenu = (o) => o.type === 'projectCard' && /standard project/i.test(t(o));
  T.play = (name, pay) => {
    const inp = inputFor(isPlayMenu, 'Play project card');
    const c = findCard(inp, name);
    return T.send(wrap(isPlayMenu, 'Play project card', {type: 'projectCard', card: c.name, payment: pay ? T.payment(pay) : T.autoPay(c.name, c.calculatedCost, inp)}));
  };
  // Standard project: 'Power Plant:SP','Asteroid:SP','Aquifer','Greenery','City','Air Scrapping','Build Colony'
  T.sp = (name, pay) => {
    const inp = inputFor(isSpMenu, 'Standard projects');
    const c = findCard(inp, name);
    return T.send(wrap(isSpMenu, 'Standard projects', {type: 'projectCard', card: c.name, payment: pay ? T.payment(pay) : T.payment({megacredits: c.calculatedCost})}));
  };
  T.action = (card) => T.send(wrap((o) => o.type === 'card' && o.selectBlueCardAction, 'Perform an action from a played card', {type: 'card', cards: [card]}));
  T.pass = () => T.send(wrap((o) => o.type === 'option' && /^pass/i.test(t(o)), 'Pass', {type: 'option'}));
  T.endTurn = () => T.send(wrap((o) => o.type === 'option' && /end turn/i.test(t(o)), 'End Turn', {type: 'option'}));
  T.undo = () => T.send(wrap((o) => o.type === 'option' && /undo/i.test(t(o)), 'Undo', {type: 'option'}));
  T.heat = () => T.send(wrap((o) => o.type === 'option' && /heat/i.test(t(o)), 'Convert heat', {type: 'option'}));
  T.greenery = (spaceId) => T.send(wrap((o) => o.type === 'space' && /greenery|plants/i.test(t(o)), 'Convert plants', {type: 'space', spaceId: String(spaceId).padStart(2, '0')}));
  T.sell = (...names) => T.send(wrap((o) => o.type === 'card' && /sell/i.test(t(o)), 'Sell patents', {type: 'card', cards: names.flat()}));
  const subPick = (re, what, name) => {
    const i = menuIdx((o) => o.type === 'or' && re.test(t(o)), what);
    const j = top().options[i].options.findIndex((o) => t(o).toLowerCase().includes(name.toLowerCase()));
    if (j < 0) throw new Error(`${what}: "${name}" not available. Choices: ${top().options[i].options.map(t).join(' | ')}`);
    return T.send({type: 'or', index: i, response: {type: 'or', index: j, response: {type: 'option'}}});
  };
  T.claim = (milestone) => subPick(/milestone/i, 'Claim a milestone', milestone);
  T.fund = (award) => subPick(/award/i, 'Fund an award', award);
  // Trade with a colony. `fee` matches the title of the fee option (e.g. 'M€', 'energy', 'titanium'); default first.
  T.trade = (colonyName, fee) => {
    const i = menuIdx((o) => o.type === 'and' || /trade/i.test(t(o)), 'Trade with a colony');
    const and = top().options[i];
    const responses = and.options.map((o) => {
      if (o.type === 'colony') return {type: 'colony', colonyName};
      if (o.type === 'or') {
        const k = fee ? o.options.findIndex((x) => t(x).toLowerCase().includes(fee.toLowerCase())) : 0;
        if (k < 0) throw new Error(`fee "${fee}" not available: ${o.options.map(t).join(' | ')}`);
        return {type: 'or', index: k, response: {type: 'option'}};
      }
      return {type: 'option'};
    });
    return T.send({type: 'or', index: i, response: {type: 'and', responses}});
  };
  // Any menu option by title regex, with an inner response
  T.menu = (re, inner = {type: 'option'}) => T.send({type: 'or', index: menuIdx((o) => new RegExp(re, 'i').test(t(o)), String(re)), response: inner});

  // ---------- Follow-up input builders (when the pending input itself is the input) ----------
  T.space = (spaceId) => T.send({type: 'space', spaceId: String(spaceId).padStart(2, '0')});
  T.pick = (...names) => T.send({type: 'card', cards: names.flat()});
  T.amount = (n) => T.send({type: 'amount', amount: Number(n)});
  T.player = (color) => T.send({type: 'player', player: color});
  T.option = () => T.send({type: 'option'});
  T.or = (index, inner = {type: 'option'}) => T.send({type: 'or', index: Number(index), response: inner});
  T.colony = (colonyName) => T.send({type: 'colony', colonyName});
  T.party = (partyName) => T.send({type: 'party', partyName});
  T.delegate = (player) => T.send({type: 'delegate', player});
  T.pay = (p) => T.send({type: 'payment', payment: T.payment(typeof p === 'object' ? p : {megacredits: Number(p)})});
  T.initial = ({corp, preludes = [], projects = [], ceo}) => {
    const wf = top();
    if (wf.type !== 'initialCards') throw new Error(`pending input is <${wf.type}>, not initialCards`);
    const responses = wf.options.map((o) => {
      const title = t(o).toLowerCase();
      if (title.includes('corporation')) return {type: 'card', cards: [corp]};
      if (title.includes('prelude')) return {type: 'card', cards: preludes};
      if (title.includes('ceo')) return {type: 'card', cards: ceo ? [ceo] : []};
      return {type: 'card', cards: projects};
    });
    return T.send({type: 'initialCards', responses});
  };

  if (!isNode) {
    // Browser fallback: the extension blocks output containing '=' (looks like query strings).
    const clean = (s) => (typeof s === 'string' ? s.replace(/=/g, ':') : s);
    for (const k of ['brief', 'send', 'log', 'wait', 'map', 'cards', 'seats', 'loadDb', 'render', 'spaceLine', 'cardLine']) {
      const f = T[k];
      T[k] = (...a) => { const r = f(...a); return r instanceof Promise ? r.then(clean) : clean(r); };
    }
    return `TM helper ready. pid ${T.pid ?? '(none: set TM.pid)'}. Start with: await TM.brief()`;
  }

  // ---------------- Node CLI ----------------
  const fs = require('fs');
  const path = require('path');
  const CACHE = path.join(__dirname, '..', 'cache');
  fs.mkdirSync(CACHE, {recursive: true});
  const SESSION = path.join(CACHE, 'session.json');

  const HELP = `usage: tm.sh <player-url | player-id> <command> [args]
  (Always pass the seat. A URL is also saved as the default seat; a bare p... id is used for this call only.)
State:
  brief [--nohand] [--noopp]    full state + pending input (loads card db)
  pending                       just the pending input
  map                           ASCII board (hex graph built from space ids, no browser needed)
  board [id ...]                map + our/rival tiles + ranked greenery/city spots + open oceans; ids: adjacency lines
  log [n]                       last n game log lines
  cards "Name" ["Name"...]      full card details
  clock                         game-end forecast from each player's capacity (heat, plants, cash->SPs, global actions,
                                hand, WGT): earliest / likely / slowest last gen
  synergy ["Card"...]           no args: payoffs for our tags, tag-req unlocks, resource links, steel/Ti sinks, hunt.md
                                status. With cards: what in the remaining pool links to them (draft/hunt checks).
  seats                         list seats (when available)
  plan                          path + contents of this seat's game plan file (cache/plans/)
  ma                            this game's milestones/awards with descriptions + scores
  stocks                        every stockpile with its VP sink (flags NO SINK, 8+ plants)
  rivals                        per rival: VP mix, engines in play (actions, VP/resource), top tags, passed cards likely in hand
  races                         corps + forced first actions, milestone distances, award rank/margin
  refreshdb                     re-download card db + milestone/award descriptions (after a server deploy)
  wait [seconds]                block until this seat must act (GO/END/WAIT). Default 540.
  --compact                     (any command) shorter card text, opp tableau as a count, one-line colonies
  turn [n]                      STATE (4 lines) + LOG n + PENDING (25 lines) in one call (used by turn.sh)
Watchers (one long-lived process, polls the tiny /api/waitingfor endpoint):
  waitturn [maxSec] [ms]        GO as soon as any input is pending, else TIMEOUT (autogo.sh)
  prewatch <color> [maxSec] [ms]  PRE-TURN: <color> active | GO | PHASE: a -> b | TIMEOUT (prewatch.sh)
  watch [maxSec] [ms]           exits on any game change (EVENT + new log lines) or GO
  watch-go <file.json> [maxSec] [ms] [--decline-offers]  wait for our action menu, run the batch steps in file
                                (renamed *.used.json); other prompts -> UNKNOWN PROMPT; exit 3 = no file
  autopilot <tree.json> [maxSec] [ms]  run the per-gen decision tree (draft/buy/guarded rules) until it has no
                                answer or a wake event: NEEDS DECISION | EVENT | NEW GEN | FOLLOW-UP | GAME END
  batch '<json steps>'          steps: [cmd,args..] | ["if-pending","re",cmd,..] | ["guard","js expr"]; "a|b" = alternatives
  use <player-url>              set current seat (saved)
Actions (main menu):
  play "Card" ['{"steel":2,"megacredits":5}']   play project card (auto-pays steel/ti if omitted)
  sp "City"|"Greenery"|"Aquifer"|"Asteroid:SP"|"Power Plant:SP"|"Air Scrapping"|"Build Colony" [payjson]
  action "Card"                 blue card action     claim "Milestone"   fund "Award"
  heat                          8 heat -> temp       greenery <spaceId>  8 plants -> greenery
  trade "Colony" [feeMatch]     trade (fee option matched by text, e.g. "M€", "energy", "titanium")
  sell "Card" ...               sell patents         pass | endturn | undo
  menu <titleRegex> [innerJson] any other menu option
Follow-ups (pending input is itself the prompt):
  space <id> | pick "Card" ... | amount <n> | player <color> | option | or <i> [innerJson]
  colony "Name" | party "Name" | delegate <color|NEUTRAL> | pay <mc|json>
  initial '{"corp":"X","preludes":["A","B"],"projects":["C","D"]}'
  send '<raw InputResponse json>'`;

  // Several Claude sessions may run this concurrently: shared files are written atomically (tmp + rename), and a
  // bare player id argument never touches the shared session file.
  const writeAtomic = (f, data) => {
    const tmp = `${f}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, f);
  };
  const readSession = () => { try { return JSON.parse(fs.readFileSync(SESSION, 'utf8')); } catch { return {}; } };
  const setUrl = (u) => {
    const url = new URL(u);
    const id = url.searchParams.get('id');
    if (!id || !id.startsWith('p')) throw new Error('need a player URL like https://host/player?id=p...');
    writeAtomic(SESSION, JSON.stringify({base: url.origin, pid: id}, null, 1));
    return {base: url.origin, pid: id};
  };
  const dbFile = () => path.join(CACHE, `cards-${new URL(T.base).host.replace(/[^\w.-]/g, '_')}.json`);
  T.loadDb = async (refresh = false) => {
    if (T.db && !refresh) return 'cached';
    const f = dbFile();
    if (fs.existsSync(f) && !refresh) {
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (c.cards) { T.setDb(c.cards); T.ma = c.ma || {}; return `card db from cache (${T.db.size})`; }
    }
    const {cards, ma} = await T.fetchDb();
    if (!cards) return 'card db NOT found';
    writeAtomic(f, JSON.stringify({fetched: new Date().toISOString(), cards, ma}));
    T.setDb(cards); T.ma = ma;
    return `card db downloaded (${T.db.size} cards, ${Object.keys(ma).length} milestone/award descriptions)`;
  };

  (async () => {
    let args = process.argv.slice(2);
    if (!args.length || args[0] === 'help') { console.log(HELP); return; }
    let sess = readSession();
    if (/^https?:\/\//.test(args[0])) { sess = setUrl(args[0]); args = args.slice(1); if (!args.length) args = ['brief']; }
    else if (/^p[0-9a-f]{6,}$/.test(args[0])) {
      // Bare id: use it for this call only (don't overwrite the shared session). Host: saved one or the public server.
      sess = {base: sess.base || 'https://terraforming-mars.herokuapp.com', pid: args[0]};
      args = args.slice(1);
      if (!args.length) args = ['brief'];
    }
    const [cmd, ...a] = args;
    if (cmd === 'use') { sess = setUrl(a[0]); console.log(`seat set: ${sess.base} ${sess.pid}`); return; }
    if (!sess.pid) throw new Error('no seat set; pass a player URL first');
    T.base = sess.base; T.pid = sess.pid;
    const J = (s) => (s ? JSON.parse(s) : undefined);
    // --compact (any command): shorter card text, opponent tableaus as counts, one-line colonies.
    if (a.includes('--compact')) { T.compact = true; a.splice(a.indexOf('--compact'), 1); }
    const needState = !['brief', 'wait', 'log', 'cards', 'help', 'refreshdb', 'turn', 'waitturn', 'prewatch', 'watch'].includes(cmd);
    // The card db (~700 KB JSON) is only needed to render cards; skip it for commands that never do.
    if (!['log', 'wait', 'waitturn', 'prewatch', 'watch', 'map', 'board', 'seats', 'plan'].includes(cmd)) await T.loadDb();
    if (needState) await T.state();
    const pendingText = () => (T.v.waitingFor ? T.render(T.v.waitingFor) : 'no pending input (waiting for others)');
    // Variables for ["guard","<js expr>"] batch steps, e.g. 'gen==7 && phase=="action" && mc>=14 && hand.includes("Bushes")'
    const guardEnv = (v) => {
      const g = v.game, p = v.thisPlayer;
      return {v, g, p, gen: g.generation, phase: g.phase, temp: g.temperature, o2: g.oxygenLevel, oceans: g.oceans,
        venus: g.venusScaleLevel, tr: p.terraformRating, mc: p.megacredits, st: p.steel, ti: p.titanium, pl: p.plants,
        en: p.energy, he: p.heat, mcp: p.megacreditProduction, hand: (v.cardsInHand || []).map((c) => c.name),
        pending: v.waitingFor ? T.render(v.waitingFor) : ''};
    };
    const dispatch = async (cmd, a) => {
    let out;
    switch (cmd) {
      case 'batch': {
        // batch '[["play","X"],["space","58|20|62"],["or","0"]]' — one process, one connection.
        // "a|b|c" in the first arg = try alternatives until one succeeds. Stops at the first unrecoverable error.
        // A step may be ["if-pending","<regex>", ...cmd] to run only when the pending prompt matches,
        // or ["guard","<js expr>"] to stop (GUARD FAILED + BATCH STOPPED) unless the expression is true.
        // State is fetched once up front; every submitted input returns the fresh state, so no re-fetch per step.
        const steps = typeof a[0] === 'string' ? J(a[0]) : a[0]; const log = [];
        for (const st of steps) {
          let [c, ...rest] = st;
          if (c === 'guard') {
            const env = guardEnv(T.v);
            let pass;
            try { pass = Function(...Object.keys(env), `return (${rest[0]});`)(...Object.values(env)); } catch (e) { pass = false; log.push(`guard error: ${e.message}`); }
            if (!pass) { log.push(`GUARD FAILED: ${rest[0]}`); out = log.join('\n') + '\nBATCH STOPPED'; return out; }
            log.push(`guard ok: ${rest[0]}`); continue;
          }
          if (c === 'if-pending') {
            const re = new RegExp(rest[0]); rest = rest.slice(1); c = rest.shift();
            const pend = T.v.waitingFor ? T.render(T.v.waitingFor) : '';
            if (!re.test(pend)) { log.push(`skip ${c} (pending doesn't match)`); continue; }
          }
          const alts = rest.length && String(rest[0]).includes('|') ? String(rest[0]).split('|') : [rest[0]];
          let ok = false, lastErr = '';
          for (const alt of alts) {
            try {
              const r = await dispatch(c, alt === undefined ? rest : [alt, ...rest.slice(1)]);
              if (/^ERROR/.test(String(r))) throw new Error(String(r).split('\n')[0]); // server rejected: its state is unchanged
              log.push(`${c} ${alt ?? ''}: ${String(r).split('\n')[0]}`); ok = true; break;
            } catch (e) {
              lastErr = e.message;
              if (e.name !== 'Error') await T.state(); // network/other failure: outcome unknown, re-sync
            }
          }
          if (!ok) { log.push(`ERROR at ${c}: ${lastErr}`); out = log.join('\n') + '\nBATCH STOPPED'; return out; }
        }
        out = log.join('\n') + '\n' + (T.v.waitingFor ? 'PENDING: ' + T.render(T.v.waitingFor).split('\n')[0] : 'no input pending');
        break;
      }
      case 'turn': { // turn.sh's STATE/LOG/PENDING sections in one process; state + log fetched in parallel
        const [b, lg] = await Promise.all([T.brief({hand: false, opp: false}), T.log(Number(a[0] || 5))]);
        out = `=== STATE ===\n${b.split('\n').slice(0, 4).join('\n')}\n=== LOG ===\n${lg}\n=== PENDING ===\n${pendingText().split('\n').slice(0, 25).join('\n')}`;
        break;
      }
      case 'waitturn': { // block until this seat has ANY pending input (what autogo's `pending | grep ^root` tested)
        await T.state();
        out = await T.poll(Number(a[0] || 3000), Number(a[1] || 1000), (v) => (v.waitingFor ? 'GO' : null)) ?? 'TIMEOUT';
        break;
      }
      case 'prewatch': { // same outputs as the old prewatch.sh loop, in one process
        const prev = a[0]; const v0 = await T.state(); const phase0 = v0.game.phase;
        out = await T.poll(Number(a[1] || 3000), Number(a[2] || 3000), (v) => {
          if (v.players.some((o) => o.color === prev && o.color !== v.thisPlayer.color && o.isActive)) return `PRE-TURN: ${prev} active`;
          if (v.waitingFor) return 'GO';
          if (v.game.phase !== phase0) return `PHASE: ${phase0} -> ${v.game.phase}`;
          return null;
        }) ?? 'TIMEOUT';
        break;
      }
      case 'watch': { // exit on any game change (new log lines) or when we must act
        const [v0, logs0] = await Promise.all([T.state(), T.get(`/api/game/logs?id=${T.pid}`)]);
        const age0 = v0.game.gameAge;
        const r = await T.poll(Number(a[0] || 3000), Number(a[1] || 2000), (v) => (v.waitingFor ? 'GO' : v.game.gameAge !== age0 ? 'EVENT' : null));
        if (!r) { out = 'TIMEOUT'; break; }
        const logs = await T.get(`/api/game/logs?id=${T.pid}`);
        const g = T.v.game;
        out = [`${r} | GEN ${g.generation} phase ${g.phase} | waiting on: ${T.lastW?.waitingFor?.join(',') || '-'}`,
          ...logs.slice(Math.max(logs0.length, logs.length - 10)).map((l) => T.msg({message: l.message, data: l.data.map((d) => ({value: d.value}))}))].join('\n');
        break;
      }
      case 'watch-go': {
        // autogo.sh's loop in ONE long-lived process: poll until our action menu, then run the batch steps in <file>
        // (JSON array, same format as `batch`; put ["guard",...] steps first) with no process start or state fetch.
        // Any prompt that isn't "Take your first/next action" hands back (UNKNOWN PROMPT -> manual); with
        // --decline-offers, off-turn "Do not buy a card" offers are declined instead and waiting continues.
        // The file is renamed to *.used.json before running so it never runs twice.
        // Exit code 3 = at the action menu but no file (autogo.sh then falls back to go.sh).
        const declineOffers = a.includes('--decline-offers');
        a = a.filter((x) => x !== '--decline-offers');
        const file = a[0];
        await T.state();
        const r = await T.poll(Number(a[1] || 3000), Number(a[2] || 1000), async (v) => {
          if (!v.waitingFor) return null;
          const pend = T.render(v.waitingFor);
          if (declineOffers && /Do not buy a card/.test(pend)) {
            const n = pend.match(/\[(\d+)\] <option> "Do not buy a card"/)?.[1] ?? '1';
            try { await T.or(n); console.log('declined off-turn card offer'); } catch { /* retried next tick */ }
            return null;
          }
          if (/Take your (first|next) action/.test(pend)) return 'GO';
          return `UNKNOWN PROMPT -> manual\n${pend.split('\n').slice(0, 10).join('\n')}`;
        });
        if (!r) { out = 'TIMEOUT'; break; }
        if (r !== 'GO') { out = r; break; }
        if (!file || !fs.existsSync(file)) { out = 'GO (no go file)'; process.exitCode = 3; break; }
        const used = file.replace(/(\.json)?$/, '.used.json');
        fs.renameSync(file, used);
        let steps;
        try { steps = JSON.parse(fs.readFileSync(used, 'utf8')); } catch (e) { out = `GUARD FAILED -> manual (bad go file: ${e.message})`; break; }
        const res = await dispatch('batch', [steps]);
        if (/BATCH STOPPED/.test(res)) { out = `${res}\nGUARD FAILED -> manual`; break; }
        const pend = T.v.waitingFor ? T.render(T.v.waitingFor) : '';
        out = `${res}\nAUTO-PLAYED\n${await T.log(6)}` +
          (/^root/.test(pend) ? `\nFOLLOW-UP PENDING -> manual\n${pend.split('\n').slice(0, 8).join('\n')}` : '');
        break;
      }
      case 'autopilot': {
        // autopilot <tree.json> [maxSec] [ms]: run a per-gen decision tree with NO model wake-ups until the tree has
        // no answer. One long-lived process; every input it handles is logged, the model reads only the exit summary.
        // tree.json: {"until": <last gen this tree covers>,
        //   "draft": {"want": [names in order], "deny": [names in order], "else": "first"|"wake"},
        //   "buy":   {"cards": [names], "max": n, "keep": <min M€ to keep after buying>} (absent -> wake at research),
        //   "rules": [{"id": "unmi", "when": "<js guard>", "do": [batch steps], "repeat": false}, ...],
        //   "goals": [{"id","desc","ok":"<guard>"}], "assume": [{"id","ok":"<guard>"}], "watchCards": [names],
        //   "wake":  ["<regex on rivals' log lines>", ...]  (default: funded|claimed)}
        // goals/assume/watchCards are re-tested after every game change (rivals' turns too); the first failure exits.
        // At our action menu the FIRST rule whose guard is true and that hasn't run this gen (unless repeat) runs as a
        // batch. Guard vars: gen phase temp o2 oceans venus tr mc st ti pl en he mcp hand pending steps vp done(id)
        // opp.<color>.{mc,vp,tr,pl,hand} acts (actions taken this turn). No rule -> exit NEEDS DECISION.
        // Exits: NEEDS DECISION | EVENT | NEW GEN | UNKNOWN PROMPT | FOLLOW-UP | BATCH STOPPED | GAME END | TIMEOUT.
        const file = a[0];
        if (!file || !fs.existsSync(file)) { out = 'ERROR: autopilot needs a tree file'; break; }
        let tree;
        try { tree = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { out = `ERROR: bad tree file: ${e.message}`; break; }
        const stFile = file.replace(/(\.json)?$/, '.state.json');
        let st = {gen: 0, done: []};
        try { st = JSON.parse(fs.readFileSync(stFile, 'utf8')); } catch { /* fresh */ }
        const save = () => fs.writeFileSync(stFile, JSON.stringify(st));
        const acted = []; const me = () => T.v.thisPlayer.color;
        const wakeRe = (tree.wake || ['funded', 'claimed']).map((r) => new RegExp(r, 'i'));
        await T.state();
        let age = T.v.game.gameAge;
        let nlog = (await T.get(`/api/game/logs?id=${T.pid}`)).length;
        const env = () => {
          const e = guardEnv(T.v), g = T.v.game;
          if (st.gen !== g.generation) { st = {gen: g.generation, done: []}; save(); }
          e.steps = Math.max(0, (8 - g.temperature) / 2) + Math.max(0, 14 - g.oxygenLevel) + Math.max(0, 9 - g.oceans);
          e.vp = T.v.thisPlayer.victoryPointsBreakdown?.total;
          e.acts = T.v.thisPlayer.actionsThisGeneration?.length ?? 0;
          e.done = (id) => st.done.includes(id);
          const grn = {}; for (const sp of g.spaces || []) if (sp.color && sp.tileType === 0) grn[sp.color] = (grn[sp.color] || 0) + 1;
          const tagsOf = (o) => (Array.isArray(o.tags) ? Object.fromEntries(o.tags.map((t) => [t.tag, t.count])) : {...(o.tags || {})});
          e.played = (T.v.thisPlayer.tableau || []).map((c) => c.name); e.tags = tagsOf(T.v.thisPlayer);
          e.grn = grn[me()] || 0; e.cities = T.v.thisPlayer.citiesCount;
          e.opp = Object.fromEntries(T.v.players.filter((o) => o.color !== me()).map((o) => [o.color,
            {mc: o.megacredits, vp: o.victoryPointsBreakdown?.total, tr: o.terraformRating, pl: o.plants, plp: o.plantProduction,
              he: o.heat, mcp: o.megacreditProduction, hand: o.cardsInHandNbr, grn: grn[o.color] || 0, cities: o.citiesCount,
              cards: (o.tableau || []).map((c) => c.name), tags: tagsOf(o)}]));
          e.maxOpp = (k) => Math.max(...Object.values(e.opp).map((o) => o[k] ?? 0));
          return e;
        };
        const test = (expr) => { const e = env(); try { return !!Function(...Object.keys(e), `return (${expr});`)(...Object.values(e)); } catch (err) { acted.push(`guard error ${expr}: ${err.message}`); return false; } };
        // Plan health: goals (long/short term) and assumptions are re-tested after EVERY game change (rivals' turns too);
        // the first one to fail wakes us to re-plan. watchCards: wake when a rival puts one of these cards into play.
        const checks = [...(tree.goals || []).map((x) => ({...x, kind: 'GOAL AT RISK'})), ...(tree.assume || []).map((x) => ({...x, kind: 'ASSUMPTION BROKEN'}))];
        const watch = new Set(tree.watchCards || []);
        const seen = () => new Set(T.v.players.filter((o) => o.color !== me()).flatMap((o) => (o.tableau || []).map((c) => `${o.color}:${c.name}`)));
        let seen0 = seen(); const rivalLog = [];
        const health = () => {
          for (const c of checks) if (!test(c.ok)) return `${c.kind}: ${c.id}${c.desc ? ' (' + c.desc + ')' : ''}`;
          for (const k of seen()) if (!seen0.has(k)) { seen0.add(k); const [col, n] = k.split(':'); if (watch.has(n)) return `EVENT: ${col} played ${n}`; }
          return null;
        };
        const h0 = health(); if (h0) { out = `${h0} (already at start: re-plan before running)`; break; }
        const r = await T.poll(Number(a[1] || 3000), Number(a[2] || 1500), async (v) => {
          const g = v.game;
          if (g.phase === 'end') return 'GAME END';
          if (tree.until && g.generation > tree.until) return 'NEW GEN';
          if (g.gameAge !== age) { // something happened: scan rivals' new log lines for wake events
            age = g.gameAge;
            const logs = await T.get(`/api/game/logs?id=${T.pid}`);
            for (const l of logs.slice(nlog)) {
              const m = T.msg({message: l.message, data: l.data.map((d) => ({value: d.value}))});
              if (!m.startsWith(me())) rivalLog.push(m);
              if (!m.startsWith(me()) && wakeRe.some((re) => re.test(m))) { nlog = logs.length; return `EVENT: ${m}`; }
            }
            nlog = logs.length;
            const hb = health(); if (hb) return hb;
          }
          const wf = v.waitingFor; if (!wf) return null;
          const pend = T.render(wf); const title = wf.title ? T.msg(wf.title) : '';
          if (/change your selection/i.test(title)) return null; // draft pick already made, others still choosing
          if (wf.type === 'card' && /keep and pass/i.test(title)) { // draft
            const names = wf.cards.filter((c) => !c.isDisabled).map((c) => c.name);
            const d = tree.draft || {};
            const pick = (d.want || []).find((n) => names.includes(n)) || (d.deny || []).find((n) => names.includes(n)) ||
              (d.else === 'first' ? names[0] : null);
            if (!pick) return `NEEDS DECISION (draft)\n${pend.split('\n').slice(0, 8).join('\n')}`;
            await dispatch('pick', [pick]); acted.push(`draft: ${pick} (from ${names.join(', ')})`); return null;
          }
          if (wf.type === 'card' && /to buy/i.test(title)) { // research
            const b = tree.buy; if (!b) return `NEEDS DECISION (buy)\n${pend.split('\n').slice(0, 8).join('\n')}`;
            const names = wf.cards.map((c) => c.name); let mc = v.thisPlayer.megacredits; const buy = [];
            for (const n of b.cards || []) if (names.includes(n) && buy.length < (b.max ?? wf.max) && mc - 3 >= (b.keep ?? 0)) { buy.push(n); mc -= 3; }
            await dispatch('pick', buy); acted.push(`buy: ${buy.join(', ') || 'none'} (offered ${names.join(', ')})`); return null;
          }
          if (/Take your (first|next) action/.test(pend)) {
            const rule = (tree.rules || []).find((ru) => (ru.repeat || !st.done.includes(ru.id)) && test(ru.when || 'true'));
            if (!rule) return `NEEDS DECISION (no rule matches)\n${pend.split('\n').slice(0, 12).join('\n')}`;
            if (!rule.repeat) { st.done.push(rule.id); save(); }
            const res = await dispatch('batch', [rule.do]);
            acted.push(`rule ${rule.id}: ${res.split('\n').filter((x) => !/^guard ok/.test(x)).join(' | ')}`);
            if (/BATCH STOPPED/.test(res)) return `BATCH STOPPED (rule ${rule.id})`;
            const p2 = T.v.waitingFor ? T.render(T.v.waitingFor) : '';
            if (p2 && !/Take your (first|next) action/.test(p2)) return `FOLLOW-UP (rule ${rule.id})\n${p2.split('\n').slice(0, 10).join('\n')}`;
            return null;
          }
          return `UNKNOWN PROMPT\n${pend.split('\n').slice(0, 10).join('\n')}`;
        });
        const p = T.v.thisPlayer, g = T.v.game;
        // Snapshot for the re-plan: what rivals did since the tree started + every goal's status (read this, not logs).
        try {
          const st2 = checks.map((c) => `${test(c.ok) ? 'ok ' : 'OFF'} ${c.kind === 'GOAL AT RISK' ? 'goal' : 'assume'} ${c.id}: ${c.ok}`);
          fs.writeFileSync(file.replace(/(\.json)?$/, '.snap.md'), [`exit: ${r ?? 'TIMEOUT'}`, ...st2, 'rival log since start (last 40):',
            ...rivalLog.filter((m) => !/^(\w+) (gained|lost) \d+ (M€|plant|steel|titanium|energy|heat)/.test(m)).slice(-40)].join('\n'));
        } catch { /* snapshot is best-effort */ }
        out = [`${r ?? 'TIMEOUT'}`, ...acted.map((x) => `  ${x}`),
          `GEN ${g.generation} ${g.phase} | temp ${g.temperature} o2 ${g.oxygenLevel} oceans ${g.oceans} | TR ${p.terraformRating} VP ${p.victoryPointsBreakdown?.total} MC ${p.megacredits}(+${p.megacreditProduction}) pl ${p.plants} he ${p.heat}`].join('\n');
        break;
      }
      case 'brief': out = await T.brief({hand: !a.includes('--nohand'), opp: !a.includes('--noopp')}); break;
      case 'pending': out = pendingText(); break;
      case 'map': out = await T.map(); break;
      case 'board': {
        out = await T.board(a);
        if (T.graph?.board) {
          const dir = path.join(CACHE, 'maps'), gf = path.join(dir, T.graph.board.replace(/[^\w.-]+/g, '_') + '.json');
          if (!fs.existsSync(gf)) { fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(gf, JSON.stringify(T.graph)); }
        }
        break;
      }
      case 'log': out = a[0] === 'all' ? await T.log(0, 'all') : a[0] === 'gen' ? await T.log(0, a[1]) : await T.log(Number(a[0] || 25)); break;
      case 'cards': out = T.cards(a); break;
      case 'clock': out = require('./clock.js').clock(T); break; // capacity-based game-end forecast
      case 'stocks': out = require('./report.js').stocks(T); break; // every stockpile with its VP sink
      case 'races': out = require('./report.js').races(T); break;
      case 'rivals': out = require('./report.js').rivals(T); break; // per-rival engines, VP mix, likely hand (passed.md) // opponent corps + milestone/award distances
      case 'synergy': { // prebuilt card-synergy index (scripts/synergy.js), cached per db; filtered to this game
        const S = require('./synergy.js');
        const sf = dbFile().replace(/cards-/, 'synergy-');
        const dbT = Math.max(fs.statSync(dbFile()).mtimeMs, fs.statSync(path.join(__dirname, 'synergy.js')).mtimeMs);
        if (fs.existsSync(sf) && fs.statSync(sf).mtimeMs >= dbT) T.syn = JSON.parse(fs.readFileSync(sf, 'utf8'));
        else { T.syn = S.buildIndex([...T.db.values()]); writeAtomic(sf, JSON.stringify(T.syn)); }
        out = S.query(T, a, path.join(CACHE, 'live', `${T.v.game.spectatorId}-${T.v.thisPlayer.color}`));
        break;
      }
      case 'seats': out = await T.seats(); break;
      case 'ma': out = await T.maText(); break;
      case 'plan': {
        const dir = path.join(CACHE, 'plans');
        fs.mkdirSync(dir, {recursive: true});
        const f = path.join(dir, `${T.v.game.spectatorId}-${T.v.thisPlayer.color}.md`);
        out = fs.existsSync(f) ?
          `PLAN FILE: ${f}

${fs.readFileSync(f, 'utf8')}` :
          `PLAN FILE: ${f}
(no plan yet — write one with the Write tool; see SKILL.md "Game plan")`;
        break;
      }
      case 'refreshdb': out = await T.loadDb(true); break;
      case 'wait': out = await T.wait(Number(a[0] || 540)); break;
      case 'play': out = await T.play(a[0], J(a[1])); break;
      case 'sp': out = await T.sp(a[0], J(a[1])); break;
      case 'action': out = await T.action(a[0]); break;
      case 'claim': out = await T.claim(a[0]); break;
      case 'fund': out = await T.fund(a[0]); break;
      case 'heat': out = await T.heat(); break;
      case 'greenery': out = await T.greenery(a[0]); break;
      case 'trade': out = await T.trade(a[0], a[1]); break;
      case 'sell': out = await T.sell(a); break;
      case 'pass': out = await T.pass(); break;
      case 'endturn': out = await T.endTurn(); break;
      case 'undo': out = await T.undo(); break;
      case 'menu': out = await T.menu(a[0], J(a[1])); break;
      case 'space': out = await T.space(a[0]); break;
      case 'pick': {
        // Draft memory: record the cards we pass (free, no extra request).
        try {
          const wf = T.v && T.v.waitingFor;
          const title = wf?.title ? T.msg(wf.title) : '';
          const m = /pass the rest to (\w+)/i.exec(title);
          if (m && Array.isArray(wf.cards)) {
            const passed = wf.cards.map((c) => c.name).filter((n) => !a.includes(n));
            const dir = path.join(CACHE, 'live', `${T.v.game.spectatorId}-${T.v.thisPlayer.color}`);
            fs.mkdirSync(dir, {recursive: true});
            fs.appendFileSync(path.join(dir, 'passed.md'),
              `gen ${T.v.game.generation} -> ${m[1]}: ${passed.join(', ')} (kept: ${a.join(', ')})\n`);
          }
        } catch (e) { /* never block a pick on bookkeeping */ }
        out = await T.pick(a); break;
      }
      case 'amount': out = await T.amount(a[0]); break;
      case 'player': out = await T.player(a[0]); break;
      case 'option': out = await T.option(); break;
      case 'or': out = await T.or(a[0], J(a[1])); break;
      case 'colony': out = await T.colony(a[0]); break;
      case 'party': out = await T.party(a[0]); break;
      case 'delegate': out = await T.delegate(a[0]); break;
      case 'pay': out = await T.pay(/^\{/.test(a[0]) ? J(a[0]) : a[0]); break;
      case 'initial': out = await T.initial(J(a[0])); break;
      case 'send': out = await T.send(J(a[0])); break;
      default: out = `unknown command ${cmd}\n\n${HELP}`;
    }
    return out;
    };
    console.log(await dispatch(cmd, a));
  })().catch((e) => { console.log('ERROR: ' + e.message); process.exitCode = 1; });
})();
