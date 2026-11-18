// Request signing shared by the Slack bot and the runner, in both directions.
//
//   X-TM-Timestamp: <unix seconds>
//   X-TM-Signature: v1=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
//
// The timestamp is part of the signed string, so a captured request stops working after
// MAX_SKEW_SECONDS. slack-bot/src/runner.ts implements the same scheme for the bot.
import crypto from 'node:crypto';

export const MAX_SKEW_SECONDS = 300;

export function sign(secret, timestamp, body) {
  return 'v1=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Returns undefined when the request is authentic, otherwise the reason it is not. */
export function verify(secret, timestamp, signature, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp)) return 'missing or malformed X-TM-Timestamp';
  if (typeof signature !== 'string') return 'missing X-TM-Signature';
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return `timestamp is more than ${MAX_SKEW_SECONDS}s from this machine's clock`;
  const expected = Buffer.from(sign(secret, timestamp, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return 'signature does not match';
  return undefined;
}
