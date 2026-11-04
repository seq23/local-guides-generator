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
 *   2. Per-IP daily limit and a per-site daily ceiling, counted in the LEAD_LIMITS KV
 *      namespace (IP stored only as a salted day hash). Over either -> 429 with a calm
 *      message naming the email address, so a real person still reaches us.
 *      The counters only move for a lead that passed validation (`count()`), so a typo
 *      never uses up a family's allowance.
 *
 * Env: LOCAL_GUIDES_TURNSTILE_SECRET_KEY (Pages secret; vault, same name), LEAD_LIMITS
 * (KV binding). The widget's site key is public and lives in assets/lead-guard.js.
 * A missing LEAD_LIMITS binding is logged as LEAD_LIMITS_UNBOUND and Turnstile still
 * gates every post (lead capture keeps working); scripts/senior/bind_pages.sh documents it.
 */

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TOKEN_HEADER = 'x-turnstile-token';
export const CONTACT = 'hello@theindustryguides.com';

// Real volume is a handful a day per site; these leave a wide margin for people while
// capping what one script, or a botnet that solves Turnstile, can push through.
export const LIMITS = {
  'request-assistance': { perIp: 6, daily: 150 },
  'senior-lead': { perIp: 8, daily: 60 }
};

const BUSY = `Too many requests from here today. Please email ${CONTACT} and we will help you directly.`;

export function clientIp(request) {
  const h = request.headers;
  return String(h.get('cf-connecting-ip') || String(h.get('x-forwarded-for') || '').split(',')[0] || '').trim() || 'unknown';
}

function hostOf(request) {
  try { return new URL(request.url).host.toLowerCase().replace(/^www\./, ''); } catch (_) { return 'unknown'; }
}

export function tokenFrom(request, body) {
  const b = body || {};
  return String(request.headers.get(TOKEN_HEADER) || b['cf-turnstile-response'] || b.turnstile_token || '').trim().slice(0, 4096);
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function day(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

async function readCount(kv, key) {
  const v = await kv.get(key);
  return Number(v || 0) || 0;
}

/**
 * Check one lead POST. Returns { ok: true, count } or { ok: false, status, body }.
 * Call `count()` once the lead passed validation and is about to be stored.
 */
export async function guardLead({ request, env, body, scope, now = Date.now(), fetchImpl = fetch }) {
  const e = env || {};
  const limits = LIMITS[scope];
  if (!limits) throw new Error(`lead_guard: unknown scope ${scope}`);
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

  const kv = e.LEAD_LIMITS;
  const noop = async () => {};
  if (!kv || typeof kv.get !== 'function') {
    console.error(`LEAD_LIMITS_UNBOUND ${scope}: no LEAD_LIMITS KV binding on this Pages project; per-IP and daily limits are off (Turnstile still gates).`);
    return { ok: true, count: noop };
  }
  const d = day(now);
  const host = hostOf(request);
  const ipKey = `ip:${scope}:${d}:${await sha(`${d}|${ip}|${scope}`)}`;
  const dayKey = `day:${scope}:${host}:${d}`;
  try {
    const [ipN, dayN] = await Promise.all([readCount(kv, ipKey), readCount(kv, dayKey)]);
    if (ipN >= limits.perIp || dayN >= limits.daily) {
      if (dayN >= limits.daily) console.error(`lead_guard ${scope}: daily ceiling ${limits.daily} reached on ${host}`);
      return { ok: false, status: 429, body: { ok: false, error: 'rate_limited', message: BUSY }, headers: { 'retry-after': '3600' } };
    }
    let counted = false;
    const count = async () => {
      if (counted) return;
      counted = true;
      const ttl = { expirationTtl: 60 * 60 * 48 };
      try {
        await Promise.all([kv.put(ipKey, String(ipN + 1), ttl), kv.put(dayKey, String(dayN + 1), ttl)]);
      } catch (err) {
        console.error(`lead_guard ${scope}: LEAD_LIMITS write failed`, String((err && err.message) || err));
      }
    };
    return { ok: true, count };
  } catch (err) {
    console.error(`lead_guard ${scope}: LEAD_LIMITS read failed`, String((err && err.message) || err));
    return { ok: true, count: noop };
  }
}
