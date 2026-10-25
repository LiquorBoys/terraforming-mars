import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

/**
 * src/tm/types.ts is a hand-maintained copy of the TM server's request
 * types. When the server changes shape underneath us the failure mode is an
 * opaque HTTP 500 at game-creation time (Oct 2026: `board` became `boards`
 * and every /tm-newgame died with "Cannot read properties of undefined").
 *
 * This compares the top-level field names of both `NewGameConfig`s. It only
 * catches drift once the parent checkout has pulled the upstream change, so
 * it's a tripwire for "sync the fork" rather than a guarantee about the
 * deployed server.
 */
function topLevelFields(source: string, typeName: string): Array<string> {
  const start = source.search(new RegExp(`export (?:type|interface) ${typeName}\\b[^{]*\\{`));
  if (start < 0) throw new Error(`${typeName} not found`);
  const body = source.slice(source.indexOf('{', start) + 1);
  const fields: Array<string> = [];
  let depth = 0;
  for (const line of body.split('\n')) {
    if (depth === 0 && line.startsWith('}')) break;
    const m = depth === 0 ? /^ {2}([A-Za-z0-9_]+)\??:/.exec(line) : null;
    if (m) fields.push(m[1]!);
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  return fields.sort();
}

describe('NewGameConfig stays in sync with the TM server source', () => {
  it('has the same top-level fields as src/common/game/NewGameConfig.ts', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const serverSrc = readFileSync(`${here}/../../src/common/game/NewGameConfig.ts`, 'utf8');
    const botSrc = readFileSync(`${here}/../src/tm/types.ts`, 'utf8');
    expect(topLevelFields(botSrc, 'NewGameConfig')).toEqual(topLevelFields(serverSrc, 'NewGameConfig'));
  });
});
