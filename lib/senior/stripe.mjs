/**
 * Stripe over plain fetch (no SDK in a Pages Function). Prices are found by lookup_key,
 * so the same code runs against test and live keys; scripts/senior/stripe_setup.mjs
 * creates them idempotently.
 */
export const FLAT_LOOKUP_KEY = 'senior_lead_flat_800';
export const SEAT_LOOKUP_KEY = 'senior_seat_memphis_249';
export const FLAT_PRODUCT_NAME = 'Senior family lead (flat)';
export const SEAT_PRODUCT_NAME = 'Exclusive lead routing — Memphis';
export const SEAT_TRIAL_DAYS = 60;
export const SEAT_TERM_MONTHS = 6;
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(env, method, path, params) {
  const key = String(env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('missing_stripe_key');
  const init = { method, headers: { authorization: `Bearer ${key}` } };
  let url = `https://api.stripe.com/v1/${path}`;
  if (params && method === 'GET') url += `?${form(params).toString()}`;
  else if (params) {
    init.headers['content-type'] = 'application/x-www-form-urlencoded';
    init.body = form(params).toString();
  }
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`stripe_${res.status}: ${(data.error && data.error.message) || ''}`.slice(0, 200));
  return data;
}

export async function priceId(env, lookupKey) {
  const r = await stripe(env, 'GET', 'prices', { 'lookup_keys[]': lookupKey, active: 'true', limit: 1 });
  const p = (r.data || [])[0];
  if (!p) throw new Error(`price_missing:${lookupKey}`);
  return p.id;
}

function hex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Stripe-Signature check: t=<ts>,v1=<hmac(secret, `${t}.${body}`)>, within tolerance. */
export async function verifyStripeSignature(secret, header, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  const parts = String(header || '').split(',').map((p) => p.trim().split('='));
  const t = (parts.find(([k]) => k === 't') || [])[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v || '');
  if (!t || !sigs.length) return { ok: false, reason: 'malformed_header' };
  if (Math.abs(nowSeconds - Number(t)) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp_out_of_tolerance' };
  const expected = await hmacHex(secret, `${t}.${body}`);
  return sigs.some((s) => safeEqual(s, expected)) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

export async function signForTest(secret, body, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`;
}
