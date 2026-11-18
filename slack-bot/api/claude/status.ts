/**
 * Vercel function the Claude runner calls to report on a seat it took.
 *
 * Deployment URL: https://<your-vercel-domain>/api/claude/status
 *
 * The runner signs the request with CLAUDE_RUNNER_SECRET (see src/runner.ts)
 * and sends the JSON as text/plain, so that the body reaches us as the exact
 * bytes that were signed rather than re-serialised by a JSON body parser.
 */

import type {IncomingMessage, ServerResponse} from 'node:http';
import {getApp} from '../../src/app.js';
import {readRawBody} from '../../src/receiver.js';
import {runnerConfig, verifyRunnerSignature} from '../../src/runner.js';
import {onClaudeStatus, parseClaudeStatus} from '../../src/handlers/onClaudeStatus.js';

const header = (req: IncomingMessage, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reply = (status: number, text: string) => {
    res.statusCode = status;
    res.setHeader('content-type', 'text/plain');
    res.end(text);
  };
  if (req.method !== 'POST') return reply(405, 'POST only');
  const cfg = runnerConfig();
  if (cfg === undefined) return reply(503, 'CLAUDE_RUNNER_URL and CLAUDE_RUNNER_SECRET are not both set');
  const raw = await readRawBody(req);
  const why = verifyRunnerSignature(cfg.secret, header(req, 'x-tm-timestamp'), header(req, 'x-tm-signature'), raw);
  if (why !== undefined) return reply(401, why);
  const status = parseClaudeStatus(raw);
  if (status === undefined) return reply(400, 'not a status payload');
  await onClaudeStatus(getApp().client, status);
  reply(200, 'ok');
}
