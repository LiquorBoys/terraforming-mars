#!/usr/bin/env node
// Cost of a Claude Code session: main thread + each subagent, at list prices.
// Usage: node cost.js <session.jsonl>   (subagents are read from <session>/subagents/*.jsonl)
// Default: newest .jsonl in ~/.claude/projects/*/ when no arg is given.
const fs = require('fs'), path = require('path'), os = require('os');

// $ per Mtok: input, output, cache read, cache write 5m, cache write 1h
const PRICE = {
  opus: [5, 25, 0.5, 6.25, 10],
  sonnet: [3, 15, 0.3, 3.75, 6],
  haiku55: [0.1, 0.5, 0.01, 0.125, 0.2],
  haiku: [1, 5, 0.1, 1.25, 2],
};
function family(m = '') {
  if (m.includes('haiku-5')) return 'haiku55';
  for (const f of ['opus', 'sonnet', 'haiku']) if (m.includes(f)) return f;
  return 'opus';
}

function analyze(file) {
  const seen = new Set(), t = { calls: 0, out: 0, read: 0, write: 0, cold: 0, maxCtx: 0, cost: 0, models: new Set() };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    const m = j.message;
    if (j.type !== 'assistant' || !m || !m.usage || seen.has(m.id)) continue;
    seen.add(m.id);
    const u = m.usage, f = family(m.model), p = PRICE[f];
    const w = u.cache_creation_input_tokens || 0, w1h = (u.cache_creation && u.cache_creation.ephemeral_1h_input_tokens) || 0;
    const inp = u.input_tokens || 0, out = u.output_tokens || 0, rd = u.cache_read_input_tokens || 0;
    t.calls++; t.out += out; t.read += rd; t.write += w; t.models.add(f);
    if (w > 30000) t.cold++;
    t.maxCtx = Math.max(t.maxCtx, inp + rd + w);
    t.cost += (inp * p[0] + out * p[1] + rd * p[2] + (w - w1h) * p[3] + w1h * p[4]) / 1e6;
  }
  return t;
}

let file = process.argv[2];
if (!file) {
  const root = path.join(os.homedir(), '.claude', 'projects');
  const all = fs.readdirSync(root).flatMap(d => {
    const dir = path.join(root, d);
    return fs.statSync(dir).isDirectory() ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => path.join(dir, f)) : [];
  });
  file = all.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}
const k = n => (n / 1000).toFixed(0) + 'k';
const row = (label, t) => console.log(
  `${label.padEnd(26)} ${[...t.models].join('/').padEnd(8)} calls ${String(t.calls).padStart(4)}  ` +
  `read ${k(t.read).padStart(7)}  write ${k(t.write).padStart(6)}  cold ${String(t.cold).padStart(2)}  ` +
  `out ${k(t.out).padStart(5)}  maxCtx ${k(t.maxCtx).padStart(5)}  $${t.cost.toFixed(2)}`);

console.log(file);
const main = analyze(file);
row('MAIN', main);
let sub = 0;
const sd = file.replace(/\.jsonl$/, '') + path.sep + 'subagents';
if (fs.existsSync(sd)) for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.jsonl'))) {
  const t = analyze(path.join(sd, f)); sub += t.cost; row(f.replace(/\.jsonl$/, ''), t);
}
console.log(`TOTAL $${(main.cost + sub).toFixed(2)}  (main $${main.cost.toFixed(2)}, subagents $${sub.toFixed(2)})`);
console.log('avg main context per call:', k(main.calls ? (main.read + main.write) / main.calls : 0));
