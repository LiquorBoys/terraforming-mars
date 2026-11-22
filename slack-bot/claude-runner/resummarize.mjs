#!/usr/bin/env node
// Rebuilds games.json, and the summary inside each full record, from the full records in games/.
// Run it in the league checkout after league.mjs changes what a summary contains, so the change
// applies to every game already recorded.
// Usage: node resummarize.mjs <league directory>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {buildSummary} from './league.mjs';

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, 'games'))) { console.error('usage: node resummarize.mjs <league directory>'); process.exit(1); }
const all = [];
for (const f of fs.readdirSync(path.join(dir, 'games')).filter((x) => x.endsWith('.json.gz')).sort()) {
  const file = path.join(dir, 'games', f);
  const full = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const old = full.summary;
  // Everything the collector was told when the game was created is carried in the old summary.
  const meta = {gameId: old.id, name: old.name, createdAt: old.createdAt, seed: old.seed,
    players: old.players.map((p) => ({color: p.color, name: p.name, key: p.key, ...(p.claudeModel ? {claudeModel: p.claudeModel} : {})}))};
  full.summary = buildSummary(meta, full.final, old.endedAt);
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(full)));
  all.push(full.summary);
  console.log(`${old.id} ${old.name}: ${full.summary.players.map((p) => `${p.name} [${p.corps.join(' + ')}]`).join(', ')}`);
}
all.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
fs.writeFileSync(path.join(dir, 'games.json'), JSON.stringify(all));
console.log(`rewrote games.json with ${all.length} game(s)`);
