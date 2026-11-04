// The lead gate (security sweep, 3 Nov 2026; lib/lead_guard.mjs). Both public lead
// endpoints refuse a post without a Turnstile token (400) or with a rejected one (403),
// refuse over the per-IP or per-site daily limit (429), fail closed without the secret
// (503), and let a real person through with Airtable/Resend mocked. A new senior lead
// is held until the family confirms: no follow-up, seat offer or teaser before the click.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRequestAssistance, GUARD_ENV, GUARD_HEADERS, makeKV, withSiteverify } from './load_endpoint.mjs';
import { makeWorld, PII } from '../senior/harness.mjs';
import { LIMITS } from '../../lib/lead_guard.mjs';

const RA_BODY = { provider_type: 'Personal Injury Attorney', email: 'synthetic@example.test', consent: 'yes' };

async function postRA(mod, { headers = GUARD_HEADERS, env = {}, ip = '203.0.113.7', host = 'theaccidentguides.com', body = RA_BODY } = {}) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = withSiteverify(async (url) => {
    calls.push(String(url));
    if (String(url).includes('airtable')) return new Response(JSON.stringify({ records: [{ id: 'rec1' }] }), { status: 200 });
    if (String(url).includes('resend')) return new Response(JSON.stringify({ id: 'em1' }), { status: 200 });
    throw new Error(`unexpected fetch ${url}`);
  });
  try {
    const req = new Request(`https://${host}/api/request-assistance`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers }, body: JSON.stringify(body) });
    const res = await mod.onRequestPost({ request: req, env: { AIRTABLE_BASE_ID: 'app', AIRTABLE_TABLE_NAME: 'Leads', AIRTABLE_API_TOKEN: 't', RESEND_API_KEY: 'r', LEAD_TO: 'leads@example.test', ...GUARD_ENV, ...env } });
    return { status: res.status, body: await res.json(), calls };
  } finally {
    globalThis.fetch = real;
  }
}

const vendors = (calls) => calls.filter((u) => u.includes('airtable') || u.includes('resend'));

test('request-assistance: no token 400, bad token 403, no secret 503, nothing stored or sent', async () => {
  const mod = await loadRequestAssistance('ra-guard-');
  const none = await postRA(mod, { headers: {} });
  assert.equal(none.status, 400);
  assert.equal(none.body.error, 'bot_check');
  assert.equal(vendors(none.calls).length, 0);
  const bad = await postRA(mod, { headers: { 'x-turnstile-token': 'forged' } });
  assert.equal(bad.status, 403);
  assert.equal(vendors(bad.calls).length, 0);
  const unset = await postRA(mod, { env: { LOCAL_GUIDES_TURNSTILE_SECRET_KEY: '' } });
  assert.equal(unset.status, 503, 'fails closed without the secret');
  assert.equal(vendors(unset.calls).length, 0);
  // The live lead-path probe posts {} and must still read 400 (canonical_loop.mjs).
  assert.equal((await postRA(mod, { headers: {}, body: {} })).status, 400);
});

test('request-assistance: valid token passes; per-IP and per-site daily limits answer 429', async () => {
  const mod = await loadRequestAssistance('ra-guard-lim-');
  const kv = makeKV();
  const { perIp, daily } = LIMITS['request-assistance'];
  for (let i = 0; i < perIp; i += 1) {
    const ok = await postRA(mod, { env: { LEAD_LIMITS: kv } });
    assert.equal(ok.status, 200, `lead ${i + 1} of ${perIp} from one IP`);
    assert.deepEqual(ok.body, { ok: true, storage: 'airtable' });
    assert.ok(ok.calls.some((u) => u.includes('airtable')) && ok.calls.some((u) => u.includes('resend')));
  }
  const over = await postRA(mod, { env: { LEAD_LIMITS: kv } });
  assert.equal(over.status, 429);
  assert.match(over.body.message, /hello@theindustryguides\.com/);
  assert.equal(vendors(over.calls).length, 0, 'over the limit nothing is stored or sent');
  assert.equal((await postRA(mod, { env: { LEAD_LIMITS: kv }, ip: '198.51.100.9' })).status, 200, 'another IP still gets through');
  // A typo (400 after the gate) does not use up the allowance.
  const kv2 = makeKV();
  for (let i = 0; i < perIp + 2; i += 1) assert.equal((await postRA(mod, { env: { LEAD_LIMITS: kv2 }, body: { ...RA_BODY, consent: '' } })).status, 400);
  assert.equal((await postRA(mod, { env: { LEAD_LIMITS: kv2 } })).status, 200);
  // Per-site daily ceiling across many IPs.
  const kv3 = makeKV();
  const today = new Date().toISOString().slice(0, 10);
  await kv3.put(`day:request-assistance:theaccidentguides.com:${today}`, String(daily));
  const ceiling = await postRA(mod, { env: { LEAD_LIMITS: kv3 }, ip: '192.0.2.44' });
  assert.equal(ceiling.status, 429);
  assert.equal(vendors(ceiling.calls).length, 0);
  assert.equal((await postRA(mod, { env: { LEAD_LIMITS: kv3 }, host: 'uscisexam.com', body: { ...RA_BODY, provider_type: 'USCIS Medical Exam Provider' } })).status, 200, 'the ceiling is per site');
});

test('senior-lead: no token 400, bad token 403, over the per-IP limit 429', async () => {
  const w = makeWorld();
  const none = await w.submit({}, { headers: { 'x-turnstile-token': '' } });
  assert.equal(none.status, 400);
  const bad = await w.submit({}, { headers: { 'x-turnstile-token': 'forged' } });
  assert.equal(bad.status, 403);
  assert.equal(w.db.q('SELECT COUNT(*) n FROM leads')[0].n, 0);
  assert.equal(w.sent.length, 0);
  const { perIp } = LIMITS['senior-lead'];
  for (let i = 0; i < perIp; i += 1) assert.equal((await w.submit({}, { headers: { 'cf-connecting-ip': '203.0.113.8' } })).status, 200);
  const over = await w.submit({}, { headers: { 'cf-connecting-ip': '203.0.113.8' } });
  assert.equal(over.status, 429);
  assert.equal(w.db.q('SELECT COUNT(*) n FROM leads')[0].n, perIp, 'the refused post stored nothing');
});

test('senior-lead: nothing is routed and no follow-up is scheduled before the family confirms', async () => {
  const w = makeWorld({ seat: { active: true, facility_id: 'mc-east', start: '2026-10-01', end: '2027-03-31' } });
  const r = await w.submit();
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'pending_confirm');
  assert.equal(r.body.confirm, 'email');
  const id = r.body.lead_id;
  assert.equal(w.db.q('SELECT COUNT(*) n FROM followups')[0].n, 0, 'no follow-ups before confirmation');
  assert.equal(w.db.q('SELECT COUNT(*) n FROM seat_events')[0].n, 0, 'no seat offer before confirmation');
  assert.equal(w.db.q('SELECT COUNT(*) n FROM teasers')[0].n, 0, 'no teaser before confirmation');
  const toFamily = w.to(PII.email);
  assert.equal(toFamily.length, 1, 'the family gets exactly one email: the confirmation');
  const tok = w.db.q('SELECT confirm_token FROM leads WHERE id = ?', id)[0].confirm_token;
  assert.ok(toFamily[0].text.includes(`/api/senior-confirm?t=${tok}`));
  assert.ok(w.sent.every((s) => s.to[0] === PII.email || s.to[0] === 'owner@example.net'), 'no community is emailed');
  // The tick must not route or follow up a pending lead either.
  w.now = new Date(Date.parse(w.now) + 31 * 86400000).toISOString();
  await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': 'tick-fixture-token' } });
  assert.equal(w.db.q('SELECT status FROM leads WHERE id = ?', id)[0].status, 'pending_confirm');
  assert.equal(w.to(PII.email).length, 1);
  w.now = '2026-10-14T12:00:00.000Z';
  // A link prefetch (GET) confirms nothing.
  const get = await w.call('handleConfirm', 'GET', `/api/senior-confirm?t=${tok}`);
  assert.equal(get.status, 200);
  assert.match(get.body, /Confirm my request/);
  assert.equal(w.db.q('SELECT status FROM leads WHERE id = ?', id)[0].status, 'pending_confirm');
  assert.equal((await w.call('handleConfirm', 'POST', '/api/senior-confirm?t=forged')).status, 404);
  // The click routes it: follow-ups scheduled, the seat holder offered the lead, once.
  assert.equal((await w.confirm(id)).status, 200);
  await w.confirm(id);
  const row = w.db.q('SELECT status, confirmed_at FROM leads WHERE id = ?', id)[0];
  assert.equal(row.status, 'seat_offered');
  assert.ok(row.confirmed_at);
  assert.equal(w.db.q('SELECT COUNT(*) n FROM followups')[0].n, 3);
  assert.equal(w.db.q("SELECT COUNT(*) n FROM seat_events WHERE event = 'offered'")[0].n, 1, 'a double click offers once');
  assert.equal(w.to('mc-east@example.org').length, 1);
});

test('senior-lead: a phone-only lead waits for the owner, who gets the confirm link', async () => {
  const w = makeWorld();
  const r = await w.submit({ email: '' });
  assert.equal(r.body.status, 'pending_confirm');
  assert.equal(r.body.confirm, 'call');
  const tok = w.db.q('SELECT confirm_token FROM leads WHERE id = ?', r.body.lead_id)[0].confirm_token;
  const notice = w.to('owner@example.net');
  assert.equal(notice.length, 1);
  assert.match(notice[0].text, /NOT ROUTED YET/);
  assert.ok(notice[0].text.includes(`/api/senior-confirm?t=${tok}`));
  assert.equal(w.teasers().length, 0);
  await w.confirm(r.body.lead_id);
  assert.equal(w.db.q('SELECT status FROM leads WHERE id = ?', r.body.lead_id)[0].status, 'open_round');
  assert.ok(w.teasers().length > 0);
  assert.equal(w.db.q('SELECT COUNT(*) n FROM followups')[0].n, 0, 'no email, so no follow-up');
});
