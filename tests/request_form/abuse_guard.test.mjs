// Abuse gate for click tracking and the click readback (security sweep, 23 Nov 2026;
// lib/abuse_guard.mjs). POST /api/track-connection-click: per-IP and per-site daily caps,
// repeat clicks deduped for CLICK_DEDUPE_SECONDS, never more Airtable writes than the cap,
// a body over the limit refused, a cap store or Airtable outage answered 'unknown' while the
// page still gets 200. GET /api/cta-clicks: totals only in public, detail behind the token.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFunction } from './load_endpoint.mjs';
import { CAPS, CLICK_DEDUPE_SECONDS, MAX_BODY_BYTES, safeEqual, secretMatches } from '../../lib/abuse_guard.mjs';

const AIRTABLE_ENV = { AIRTABLE_BASE_ID: 'appTEST', AIRTABLE_CLICKS_TABLE_NAME: 'Lead Clicks', AIRTABLE_API_TOKEN: 'patTEST' };
const CLICK = { provider_type: 'cta:dentistry-license-get-listed', button_source: 'dentistry-license-get-listed', page_slug: '/california/', source_domain: 'dentistryguides.com', intent_type: 'cta_ref', page_kind: 'state' };

/** KV fake with expiry on a clock the test moves; `fail` makes get or put throw. */
function makeKV(clock) {
  const m = new Map();
  const kv = {
    map: m,
    fail: { get: false, put: false },
    async get(k) {
      if (kv.fail.get) throw new Error('kv get down');
      const e = m.get(k);
      if (!e) return null;
      if (e.exp && clock.now >= e.exp) { m.delete(k); return null; }
      return e.v;
    },
    async put(k, v, opts = {}) {
      if (kv.fail.put) throw new Error('kv put down');
      m.set(k, { v: String(v), exp: opts.expirationTtl ? clock.now + opts.expirationTtl * 1000 : 0 });
    }
  };
  return kv;
}

function world({ airtable = 'ok' } = {}) {
  const clock = { now: Date.parse('2026-11-23T15:00:00Z') };
  const w = { clock, kv: makeKV(clock), writes: [], airtableCalls: 0 };
  w.fetch = async (url, init) => {
    const u = String(url);
    if (!u.startsWith('https://api.airtable.com/')) throw new Error(`unexpected fetch ${u}`);
    w.airtableCalls += 1;
    if (airtable === 'down') throw new Error('connect ECONNREFUSED');
    if (airtable === '500') return new Response('{"error":"SERVER_ERROR"}', { status: 500 });
    if (init && init.method === 'POST') {
      w.writes.push(JSON.parse(init.body).records[0].fields);
      return new Response(JSON.stringify({ records: [{ id: `rec${w.writes.length}` }] }), { status: 200 });
    }
    return new Response(JSON.stringify(w.list || { records: [] }), { status: 200 });
  };
  return w;
}

async function run(w, fn) {
  const realFetch = globalThis.fetch;
  const realNow = Date.now;
  globalThis.fetch = w.fetch;
  Date.now = () => w.clock.now;
  try { return await fn(); } finally { globalThis.fetch = realFetch; Date.now = realNow; }
}

async function click(mod, w, { ip = '198.51.100.1', host = 'dentistryguides.com', body = CLICK, env = {}, raw, headers = {} } = {}) {
  return run(w, async () => {
    const req = new Request(`https://${host}/api/track-connection-click`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers },
      body: raw !== undefined ? raw : JSON.stringify(body),
      ...(raw instanceof ReadableStream ? { duplex: 'half' } : {})
    });
    const res = await mod.onRequestPost({ request: req, env: { ...AIRTABLE_ENV, LEAD_LIMITS: w.kv, ...env } });
    return { status: res.status, body: await res.json() };
  });
}

test('click: one IP is capped at CAPS perIp writes a day, forged x-forwarded-for does not reset it', async () => {
  const mod = await loadFunction('track-connection-click', 'click-ip-');
  const w = world();
  const { perIp } = CAPS['connection-click'];
  for (let i = 0; i < perIp + 5; i += 1) {
    const r = await click(mod, w, { body: { ...CLICK, page_slug: `/page-${i}/` }, headers: { 'x-forwarded-for': `10.0.0.${i}` } });
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true, 'the page never sees a failure');
    assert.equal(r.body.state, i < perIp ? 'stored' : 'over', `click ${i + 1}`);
  }
  assert.equal(w.writes.length, perIp, 'never more Airtable writes than the per-IP cap');
});

test('click: rotating IPs stop at the per-site daily cap; the next day counts again', async () => {
  const mod = await loadFunction('track-connection-click', 'click-day-');
  const w = world();
  const { daily } = CAPS['connection-click'];
  for (let i = 0; i < daily + 10; i += 1) {
    await click(mod, w, { ip: `203.0.${Math.floor(i / 250)}.${i % 250}` });
  }
  assert.equal(w.writes.length, daily, 'never more Airtable writes than the daily cap');
  const other = await click(mod, w, { ip: '192.0.2.200', host: 'uscisexam.com' });
  assert.equal(other.body.state, 'stored', 'the cap is per site: another site still records');
  w.clock.now += 24 * 3600 * 1000;
  assert.equal((await click(mod, w, { ip: '192.0.2.201' })).body.state, 'stored', 'a new day starts a new count');
});

test('click: a repeat inside the dedupe window is one click; real clicks are all kept', async () => {
  const mod = await loadFunction('track-connection-click', 'click-dup-');
  const w = world();
  assert.equal((await click(mod, w)).body.state, 'stored');
  assert.equal((await click(mod, w)).body.state, 'duplicate', 'a replay from the same IP is not a second click');
  assert.equal(w.writes.length, 1);
  assert.equal((await click(mod, w, { ip: '198.51.100.2' })).body.state, 'stored', 'a second person is a second click');
  assert.equal((await click(mod, w, { body: { ...CLICK, page_slug: '/texas/' } })).body.state, 'stored', 'the same person on another page is another click');
  assert.equal((await click(mod, w, { body: { ...CLICK, provider_type: 'cta:uscis-field-office-civil-surgeon', button_source: 'uscis-field-office-civil-surgeon' } })).body.state, 'stored', 'another CTA is another click');
  w.clock.now += (CLICK_DEDUPE_SECONDS + 1) * 1000;
  assert.equal((await click(mod, w)).body.state, 'stored', 'the same person coming back after the window counts again');
  assert.equal(w.writes.length, 5);
  assert.equal(w.writes[0].provider_type, CLICK.provider_type, 'the stored record is the click itself');
});

test('click: cap store missing or failing writes nothing and answers unknown; the page still gets 200', async () => {
  const mod = await loadFunction('track-connection-click', 'click-kv-');
  for (const mode of ['unbound', 'get', 'put']) {
    const w = world();
    const env = mode === 'unbound' ? { LEAD_LIMITS: undefined } : {};
    if (mode !== 'unbound') w.kv.fail[mode] = true;
    const r = await click(mod, w, { env });
    assert.equal(r.status, 200, mode);
    assert.deepEqual(r.body, { ok: true, stored: false, state: 'unknown' }, mode);
    assert.equal(w.airtableCalls, 0, `${mode}: no Airtable write without a counted slot`);
  }
});

test('click: Airtable down or refusing is unknown, never stored; the page still gets 200', async () => {
  const mod = await loadFunction('track-connection-click', 'click-at-');
  for (const airtable of ['down', '500']) {
    const w = world({ airtable });
    const r = await click(mod, w);
    assert.equal(r.status, 200, airtable);
    assert.deepEqual(r.body, { ok: true, stored: false, state: 'unknown' }, airtable);
  }
  const w = world();
  const r = await click(mod, w, { env: { AIRTABLE_API_TOKEN: '' } });
  assert.deepEqual(r.body, { ok: true, stored: false, state: 'not_configured' });
  assert.equal(w.kv.map.size, 0, 'no cap slot spent where there is nowhere to write');
});

test('click: a body over the limit is refused unread, whatever length it claims', async () => {
  const mod = await loadFunction('track-connection-click', 'click-big-');
  const w = world();
  const max = MAX_BODY_BYTES['connection-click'];
  const big = JSON.stringify({ ...CLICK, pad: 'x'.repeat(max) });
  assert.equal((await click(mod, w, { raw: big })).status, 413);
  const chunk = new TextEncoder().encode('x'.repeat(1024));
  let sent = 0;
  const stream = new ReadableStream({ pull(c) { if (sent >= max * 4) { c.close(); return; } sent += chunk.byteLength; c.enqueue(chunk); } });
  const r = await click(mod, w, { raw: stream });
  assert.equal(r.status, 413, 'a streamed body with no content-length is cut off at the limit');
  assert.ok(sent <= max + 2 * chunk.byteLength, `stopped reading early (read ${sent} bytes)`);
  assert.equal(w.airtableCalls, 0);
  assert.equal((await click(mod, w, { body: {} })).body.state, 'ignored', 'a post naming nothing is not a click');
  assert.equal(w.airtableCalls, 0);
});

async function ctaGet(mod, w, { ref = 'dentistry-license-get-listed', headers = {}, env = {} } = {}) {
  return run(w, async () => {
    const req = new Request(`https://dentistryguides.com/api/cta-clicks?ref=${encodeURIComponent(ref)}`, { headers });
    const res = await mod.onRequestGet({ request: req, env: { ...AIRTABLE_ENV, SENIOR_TICK_TOKEN: 'ops-fixture-token', ...env } });
    return { status: res.status, body: await res.json() };
  });
}

test('cta-clicks: the public answer is the total only; the detail needs the ops token', async () => {
  const mod = await loadFunction('cta-clicks', 'cta-');
  const w = world();
  w.list = { records: [
    { fields: { provider_type: 'cta:dentistry-license-get-listed' } },
    { fields: { button_source: 'dentistry-license-get-listed' } },
    { fields: { provider_type: 'cta:other' } }
  ] };
  const pub = await ctaGet(mod, w);
  assert.deepEqual(pub.body, { ok: true, ref: 'dentistry-license-get-listed', state: 'OK', window_days: 28, clicks: 2, truncated: false });
  const wrong = await ctaGet(mod, w, { headers: { 'x-senior-tick-token': 'ops-fixture-tokeX' } });
  assert.equal(wrong.body.scanned, undefined, 'a wrong token gets the public answer');
  const unset = await ctaGet(mod, w, { headers: { 'x-senior-tick-token': '' }, env: { SENIOR_TICK_TOKEN: '' } });
  assert.equal(unset.body.scanned, undefined, 'no token configured never opens the detail');
  const ops = await ctaGet(mod, w, { headers: { 'x-senior-tick-token': 'ops-fixture-token' } });
  assert.equal(ops.body.clicks, 2);
  assert.equal(ops.body.scanned, 3, 'the ops token gets the detail');
  const unknown = await ctaGet(mod, w, { ref: 'guess' });
  assert.equal(unknown.status, 400);
  assert.deepEqual(unknown.body, { ok: false, error: 'unknown_ref' }, 'an unknown ref never lists the registered ones');
});

test('cta-clicks: an Airtable outage is a NAMED_STOP with a code in public, never a count', async () => {
  const mod = await loadFunction('cta-clicks', 'cta-down-');
  for (const airtable of ['down', '500']) {
    const w = world({ airtable });
    const pub = await ctaGet(mod, w);
    assert.equal(pub.body.ok, false, airtable);
    assert.equal(pub.body.state, 'NAMED_STOP');
    assert.equal(pub.body.clicks, undefined);
    assert.match(pub.body.reason, /^airtable_(unreachable|500)$/, 'public reason is a code only');
    const ops = await ctaGet(mod, w, { headers: { 'x-senior-tick-token': 'ops-fixture-token' } });
    assert.ok(ops.body.reason.length > pub.body.reason.length, 'the ops answer carries the vendor detail');
  }
});

test('safeEqual and secretMatches: equal only when equal, never on an empty secret', async () => {
  assert.equal(await safeEqual('abc', 'abc'), true);
  assert.equal(await safeEqual('abc', 'abd'), false);
  assert.equal(await safeEqual('abc', 'abcd'), false, 'a prefix is not a match');
  assert.equal(await secretMatches('s3cret', 's3cret'), true);
  assert.equal(await secretMatches('', ''), false, 'no secret configured never matches');
  assert.equal(await secretMatches('s3cret', ''), false);
  assert.equal(await secretMatches(undefined, 'undefined'), false);
});
