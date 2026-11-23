// Abuse gate for the senior endpoints that cost money or fill a table (security sweep,
// 23 Nov 2026; lib/abuse_guard.mjs). Seat checkout: per-IP and daily caps reserved before
// Stripe is called, an outage of the cap store refuses (503) and never reaches Stripe, a
// Stripe outage is 502, a retry reuses the same Stripe idempotency key. Funnel events: caps,
// a body limit, and a cap-store outage inserts nothing. Admin tokens: constant-time and never
// open when unset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, TICK, WEBHOOK_SECRET } from './harness.mjs';
import { signForTest } from '../../lib/senior/stripe.mjs';
import { CAPS, MAX_BODY_BYTES } from '../../lib/abuse_guard.mjs';

const checkout = (w, json, ip = '198.51.100.7') =>
  w.call('handleSeatCheckout', 'POST', '/api/senior-seat-checkout', { json, headers: { 'cf-connecting-ip': ip } });
const sessions = (w) => w.stripeCalls.filter((c) => c.path === 'checkout/sessions');
const SESS = 'cd'.repeat(12);
const event = (w, ip = '198.51.100.8', over = {}) =>
  w.call('handleEvent', 'POST', '/api/senior-event', { json: { session: SESS, event: 'screen', screen: 1, ...over }, headers: { 'cf-connecting-ip': ip } });
const events = (w) => w.db.q('SELECT COUNT(*) n FROM funnel_events')[0].n;

function brokenKv(mode) {
  return {
    async get() { if (mode === 'get') throw new Error('kv get down'); return null; },
    async put() { if (mode === 'put') throw new Error('kv put down'); }
  };
}

test('seat checkout: a real buyer gets one Stripe session, with an idempotency key a retry reuses', async () => {
  const w = makeWorld();
  const a = await checkout(w, { facility_id: 'mc-east', email: 'buyer@example.org' });
  assert.equal(a.status, 200);
  assert.match(a.body.url, /^https:\/\/checkout\.stripe\.com\//);
  const b = await checkout(w, { facility_id: 'mc-east', email: 'buyer@example.org' });
  assert.equal(b.status, 200);
  const [s1, s2] = sessions(w);
  assert.ok(s1.headers['idempotency-key'], 'the session call carries an idempotency key');
  assert.equal(s1.headers['idempotency-key'], s2.headers['idempotency-key'], 'a double click or retry is the same Stripe request');
  assert.equal(new URLSearchParams(s1.body).get('customer_email'), 'buyer@example.org');
  await checkout(w, { facility_id: 'al-downtown', email: 'buyer@example.org' });
  assert.notEqual(sessions(w)[2].headers['idempotency-key'], s1.headers['idempotency-key'], 'another community is another checkout');
  w.now = '2026-10-14T12:00:00.000Z';
  await checkout(w, { facility_id: 'mc-east', email: 'buyer@example.org' });
  assert.notEqual(sessions(w)[3].headers['idempotency-key'], s1.headers['idempotency-key'], 'a new day is a fresh session, not an expired one');
});

test('seat checkout: a typed value that is not an email never reaches Stripe; the listed email is used', async () => {
  const w = makeWorld();
  const r = await checkout(w, { facility_id: 'mc-east', email: 'not an email <script>' });
  assert.equal(r.status, 200);
  assert.equal(new URLSearchParams(sessions(w)[0].body).get('customer_email'), 'mc-east@example.org');
  assert.equal((await checkout(w, { facility_id: 'made-up' })).status, 400);
  assert.equal(sessions(w).length, 1, 'an unknown community never reaches Stripe');
});

test('seat checkout: per-IP and daily caps stop before Stripe, forged forwarding headers do not help', async () => {
  const { perIp, daily } = CAPS['seat-checkout'];
  const w = makeWorld();
  for (let i = 0; i < perIp + 3; i += 1) {
    const r = await w.call('handleSeatCheckout', 'POST', '/api/senior-seat-checkout', { json: { facility_id: 'mc-east' }, headers: { 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': `10.1.1.${i}` } });
    assert.equal(r.status, i < perIp ? 200 : 429, `checkout ${i + 1}`);
  }
  assert.equal(sessions(w).length, perIp, 'never more Stripe sessions than the per-IP cap');
  const d = makeWorld();
  for (let i = 0; i < daily + 5; i += 1) await checkout(d, { facility_id: 'mc-east' }, `192.0.2.${i}`);
  assert.equal(sessions(d).length, daily, 'rotating IPs stop at the daily cap');
});

test('seat checkout: a cap store that is missing or failing refuses and never reaches Stripe', async () => {
  for (const mode of ['unbound', 'get', 'put']) {
    const w = makeWorld();
    w.env.LEAD_LIMITS = mode === 'unbound' ? undefined : brokenKv(mode);
    const r = await checkout(w, { facility_id: 'mc-east' });
    assert.equal(r.status, 503, mode);
    assert.equal(w.stripeCalls.length, 0, `${mode}: no Stripe call without a counted slot`);
  }
});

test('seat checkout: Stripe down is a 502 and a huge body is refused before anything', async () => {
  const w = makeWorld();
  w.stripeDown = true;
  const r = await checkout(w, { facility_id: 'mc-east' });
  assert.equal(r.status, 502);
  assert.equal(r.body.url, undefined, 'no checkout link when Stripe did not answer');
  w.stripeDown = false;
  const before = w.stripeCalls.length;
  const big = await w.call('handleSeatCheckout', 'POST', '/api/senior-seat-checkout', { raw: JSON.stringify({ facility_id: 'mc-east', pad: 'x'.repeat(MAX_BODY_BYTES['seat-checkout']) }), headers: { 'content-type': 'application/json' } });
  assert.equal(big.status, 413);
  assert.equal(w.stripeCalls.length, before, 'a refused body never reaches Stripe');
});

test('funnel events: per-IP and daily caps, body limit, and a cap-store outage inserts nothing', async () => {
  const { perIp, daily } = CAPS['senior-event'];
  const w = makeWorld();
  assert.equal((await event(w, undefined, { event: 'nope' })).status, 400, 'an invalid event is refused');
  for (let i = 0; i < perIp + 2; i += 1) {
    const r = await event(w, '198.51.100.8', { screen: i % 99 });
    assert.equal(r.status, i < perIp ? 200 : 429, `event ${i + 1}`);
  }
  const afterIp = events(w);
  assert.ok(afterIp > 0 && afterIp <= perIp, 'inserts stop at the per-IP cap');
  const ipKeys = [...w.env.LEAD_LIMITS.map.keys()].filter((k) => k.startsWith('ip:senior-event:'));
  assert.equal(ipKeys.length, 1, 'the invalid event spent no slot');
  w.env.LEAD_LIMITS.map.set([...w.env.LEAD_LIMITS.map.keys()].find((k) => k.startsWith('day:senior-event:')), String(daily));
  assert.equal((await event(w, '192.0.2.77')).status, 429, 'a fresh IP is refused once the site is at the daily cap');
  const big = await w.call('handleEvent', 'POST', '/api/senior-event', { raw: JSON.stringify({ session: SESS, event: 'screen', screen: 1, pad: 'x'.repeat(MAX_BODY_BYTES['senior-event']) }), headers: { 'content-type': 'application/json' } });
  assert.equal(big.status, 413);
  for (const mode of ['unbound', 'get', 'put']) {
    const o = makeWorld();
    o.env.LEAD_LIMITS = mode === 'unbound' ? undefined : brokenKv(mode);
    assert.equal((await event(o)).status, 503, mode);
    assert.equal(events(o), 0, `${mode}: nothing inserted without a counted slot`);
  }
});

test('admin token: a near miss or an unset token never opens tick or funnel', async () => {
  const w = makeWorld();
  const near = TICK.slice(0, -1) + (TICK.endsWith('n') ? 'm' : 'n');
  for (const [handler, method, p] of [['handleTick', 'POST', '/api/senior-tick'], ['handleFunnel', 'GET', '/api/senior-funnel?days=7']]) {
    assert.equal((await w.call(handler, method, p, { headers: { 'x-senior-tick-token': near } })).status, 401, `${handler} near miss`);
    assert.equal((await w.call(handler, method, p, { headers: { 'x-senior-tick-token': TICK } })).status, 200, `${handler} real token`);
  }
  w.env.SENIOR_TICK_TOKEN = '';
  assert.equal((await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': '' } })).status, 401, 'unset token is never open');
  assert.equal((await w.call('handleFunnel', 'GET', '/api/senior-funnel?days=7')).status, 401);
});

test('admin token and webhook signature are compared through the constant-time HMAC path', async () => {
  const w = makeWorld();
  const realSign = crypto.subtle.sign;
  let signs = 0;
  crypto.subtle.sign = function (...a) { signs += 1; return realSign.apply(this, a); };
  try {
    for (const [handler, method, p] of [['handleTick', 'POST', '/api/senior-tick'], ['handleFunnel', 'GET', '/api/senior-funnel?days=7']]) {
      signs = 0;
      await w.call(handler, method, p, { headers: { 'x-senior-tick-token': 'x'.repeat(TICK.length) } });
      assert.ok(signs >= 2, `${handler}: the token is HMAC-compared, never with === (${signs} signs)`);
    }
    const raw = JSON.stringify({ type: 'ping', data: { object: {} } });
    const good = await signForTest(WEBHOOK_SECRET, raw);
    const bad = good.replace(/v1=([0-9a-f])/, (_, c) => `v1=${c === '0' ? '1' : '0'}`);
    signs = 0;
    const r = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw, headers: { 'stripe-signature': bad } });
    assert.equal(r.status, 400);
    assert.ok(signs >= 3, `webhook: the signature is HMAC-compared, never with === (${signs} signs)`);
  } finally {
    crypto.subtle.sign = realSign;
  }
});
