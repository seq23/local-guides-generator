/**
 * The one gate in front of every public lead form (functions/api/request-assistance.js
 * and POST /api/senior-lead). Security sweep, 3 Nov 2026: both took anonymous posts
 * behind a honeypot only, so a script could flood the owner's inbox and the senior
 * backend would mail any typed address and offer fake families to paying communities.
 *
 *   1. Cloudflare Turnstile. The page's /assets/lead-guard.js adds a token to every
 *      lead POST (header x-turnstile-token). No token -> 400; a token Cloudflare
 *      rejects -> 403. No secret configured -> 503 and a NAMED STOP log line: the gate
 *      fails closed, never open.
 *   2. Per-IP daily limit and a per-site daily ceiling (lib/abuse_guard.mjs checkCaps, the
 *      one cap table for every guarded endpoint), counted in the LEAD_LIMITS KV namespace
 *      (IP stored only as a salted day hash). Over either -> 429 with a calm
 *      message naming the email address, so a real person still reaches us.
 *      The counters only move for a lead that passed validation (`count()`), so a typo
 *      never uses up a family's allowance.
 *
 * Env: LOCAL_GUIDES_TURNSTILE_SECRET_KEY (Pages secret; vault, same name), LEAD_LIMITS
 * (KV binding). The widget's site key is public and lives in assets/lead-guard.js.
 * A missing LEAD_LIMITS binding is logged as LEAD_LIMITS_UNBOUND and Turnstile still
 * gates every post (lead capture keeps working); scripts/senior/bind_pages.sh documents it.
 */

import { CAPS, checkCaps, clientIp } from './abuse_guard.mjs';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TOKEN_HEADER = 'x-turnstile-token';
export const CONTACT = 'hello@theindustryguides.com';

const BUSY = `Too many requests from here today. Please email ${CONTACT} and we will help you directly.`;

export function tokenFrom(request, body) {
  const b = body || {};
  return String(request.headers.get(TOKEN_HEADER) || b['cf-turnstile-response'] || b.turnstile_token || '').trim().slice(0, 4096);
}

/**
 * Check one lead POST. Returns { ok: true, count } or { ok: false, status, body }.
 * Call `count()` once the lead passed validation and is about to be stored.
 */
export async function guardLead({ request, env, body, scope, now = Date.now(), fetchImpl = fetch }) {
  const e = env || {};
  if (!CAPS[scope]) throw new Error(`lead_guard: unknown scope ${scope}`);
  const token = tokenFrom(request, body);
  if (!token) return { ok: false, status: 400, body: { ok: false, error: 'bot_check', message: `Please reload the page and try again, or email ${CONTACT}.` } };
  const secret = String(e.LOCAL_GUIDES_TURNSTILE_SECRET_KEY || '').trim();
  if (!secret) {
    console.error(`NAMED STOP [TURNSTILE_SECRET_MISSING] ${scope}: LOCAL_GUIDES_TURNSTILE_SECRET_KEY is not set on this Pages project; lead posts are refused until it is (vault: LOCAL_GUIDES_TURNSTILE_SECRET_KEY).`);
    return { ok: false, status: 503, body: { ok: false, error: 'bot_check_unavailable', message: `The form is unavailable right now. Please email ${CONTACT}.` } };
  }
  const ip = clientIp(request);
  let verdict;
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip !== 'unknown') form.set('remoteip', ip);
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    verdict = await res.json();
  } catch (err) {
    console.error(`lead_guard ${scope}: Turnstile siteverify unreachable`, String((err && err.message) || err));
    return { ok: false, status: 503, body: { ok: false, error: 'bot_check_unavailable', message: `Please try again in a minute, or email ${CONTACT}.` } };
  }
  if (!verdict || verdict.success !== true) {
    return { ok: false, status: 403, body: { ok: false, error: 'bot_check', message: `Please reload the page and try again, or email ${CONTACT}.` } };
  }

  // Turnstile already passed, so a cap store that is missing or failing lets the lead
  // through (lead capture keeps working) and says so in the log.
  const noop = async () => {};
  const caps = await checkCaps({ kv: e.LEAD_LIMITS, scope, request, now });
  if (caps.state === 'unknown') {
    console.error(`${caps.reason} ${scope}: per-IP and daily limits are off for this post (Turnstile still gates).`);
    return { ok: true, count: noop };
  }
  if (caps.state === 'over') {
    return { ok: false, status: 429, body: { ok: false, error: 'rate_limited', message: BUSY }, headers: { 'retry-after': '3600' } };
  }
  return { ok: true, count: async () => { await caps.take(); } };
}
