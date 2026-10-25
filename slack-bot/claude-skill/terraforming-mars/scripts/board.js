// Deprecated: use `tm.sh <pid> board [id ...]` (local hex graph in tm.js, cached to cache/maps/<board>.json).
// Kept so old notes still work: node board.js <pid> [color] -> same output as `tm.sh <pid> board`.
const {execFileSync} = require('child_process');
process.stdout.write(execFileSync(process.execPath, ['--use-system-ca', require('path').join(__dirname, 'tm.js'), process.argv[2], 'board'], {encoding: 'utf8'}));
