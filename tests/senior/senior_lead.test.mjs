import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, PII, FAKE_POSTAL, WEBHOOK_SECRET, TICK, FACILITIES, ZIPS } from './harness.mjs';
import { teaserFields } from '../../lib/senior/lead.mjs';
import { composeEmail, FOOTER_COMPANY_LINE, UMBRELLA_CONTACT } from '../../lib/senior/email.mjs';
import { signForTest } from '../../lib/senior/stripe.mjs';
import M from '../../assets/senior-match.js';

const ALL_SENT = [];
function world(opts) {
  const w = makeWorld(opts);
  w.sent.push = (...items) => { ALL_SENT.push(...items); return Array.prototype.push.apply(w.sent, items); };
  return w;
}
const ACTIVE_SEAT = { active: true, facility_id: 'mc-east', start: '2026-10-01', end: '2027-03-31' };
const hours = (iso, h) => new Date(Date.parse(iso) + h * 3600000).toISOString();

test('teaser body contains no PII', async () => {
  const w = world();
  const r = await w.lead();
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'open_round');
  const teasers = w.teasers();
  assert.ok(teasers.length > 0, 'a fixture lead must produce teasers, or this test proves nothing');
  const digits = PII.phone.replace(/\D/g, '');
  for (const t of teasers) {
    const all = `${t.subject}\n${t.text}\n${t.html}`;
    for (const v of [PII.name, PII.email, PII.senior_first_name, 'Zelda', 'Fixturename', PII.phone, digits, '555-0142']) {
      assert.ok(!all.includes(v), `teaser to ${t.to} leaks ${v}`);
    }
    assert.ok(!all.replace(/\D/g, '').includes(digits), 'teaser leaks phone digits');
  }
  const lead = w.db.q('SELECT * FROM leads')[0];
  assert.deepEqual(Object.keys(teaserFields(lead)).sort(), ['area', 'budget_band', 'care_tier', 'memory_care', 'timeline', 'who_for']);
  assert.match(teaserFields(lead).area, /381xx/);
});

test('open round sends only to fitting facilities', async () => {
  const w = world();
  const r = await w.lead();
  const got = w.teasers().map((t) => t.to[0]).sort();
  // memory care + $3,000-4,500: mc-east (3500-5200), mc-collierville (rate unknown), x1, x2, x3.
  assert.deepEqual(got, ['mc-collierville@example.org', 'mc-east@example.org', 'x1@example.org', 'x2@example.org', 'x3@example.org']);
  for (const bad of ['al-downtown@', 'nofee@', 'pricey@', 'mc-germantown@', 'tunica@']) assert.ok(!got.some((a) => a.startsWith(bad)), `${bad} must not get a teaser`);
  const order = w.db.q('SELECT facility_id FROM teasers WHERE lead_id = ? ORDER BY id', r.body.lead_id).map((x) => x.facility_id);
  assert.equal(order[0], 'mc-east', 'nearest first');
  assert.ok(w.db.q('SELECT * FROM teasers').every((t) => t.sent_at), 'every teaser is time-stamped as sent');
});

test('accepts cap at five and later clicks are late', async () => {
  const w = world();
  const r = await w.lead({ budget_band: '4500_6000' });
  const ids = w.db.q('SELECT facility_id FROM teasers WHERE lead_id = ? ORDER BY id', r.body.lead_id).map((x) => x.facility_id);
  assert.equal(ids.length, 6, 'fixture needs six fitting communities');
  for (const id of ids.slice(0, 5)) {
    const g = await w.call('handleAccept', 'GET', `/api/senior-accept?t=${w.tokenFor(r.body.lead_id, id)}&o=rent`);
    assert.equal(g.status, 200);
    assert.equal(w.db.q('SELECT COUNT(*) n FROM accepts WHERE facility_id = ?', id)[0].n, 0, 'a GET (mail scanner prefetch) never accepts');
    const p = await w.call('handleAccept', 'POST', `/api/senior-accept?t=${w.tokenFor(r.body.lead_id, id)}&o=rent`);
    assert.match(p.body, /Accepted/);
    const rel = w.to(FACILITIES.find((f) => f.id === id).email).find((s) => /Family lead details/.test(s.subject));
    assert.ok(rel && rel.text.includes(PII.phone) && rel.text.includes(PII.name), 'release carries the full lead');
    assert.match(rel.text, /Terms accepted .*one month's rent/);
  }
  const sixth = ids[5];
  const p6 = await w.call('handleAccept', 'POST', `/api/senior-accept?t=${w.tokenFor(r.body.lead_id, sixth)}&o=rent`);
  assert.match(p6.body, /This lead has been taken/);
  const f6 = await w.call('handleAccept', 'POST', `/api/senior-accept?t=${w.tokenFor(r.body.lead_id, sixth)}&o=flat`);
  assert.match(f6.body, /This lead has been taken/);
  const acc = w.db.q('SELECT status, COUNT(*) n FROM accepts GROUP BY status');
  assert.deepEqual(acc, [{ status: 'late', n: 2 }, { status: 'released', n: 5 }]);
  assert.equal(w.to(FACILITIES.find((f) => f.id === sixth).email).filter((s) => /Family lead details/.test(s.subject)).length, 0);
});

test('flat payment releases once and a payment after the cap is refunded and late', async () => {
  const w = world();
  const r = await w.lead({ budget_band: '4500_6000' });
  const ids = w.db.q('SELECT facility_id, token FROM teasers WHERE lead_id = ? ORDER BY id', r.body.lead_id);
  const start = await w.call('handleAccept', 'POST', `/api/senior-accept?t=${ids[0].token}&o=flat`);
  assert.equal(start.status, 303);
  assert.match(start.headers.get('location'), /checkout\.stripe\.com/);
  assert.ok(w.stripeCalls.some((c) => c.path === 'checkout/sessions' && c.body.includes('senior_lead_flat')));
  const session = (fid, tok, id) => ({ id, payment_status: 'paid', payment_intent: `pi_${id}`, metadata: { kind: 'senior_lead_flat', lead_id: r.body.lead_id, facility_id: fid, teaser_token: tok } });
  const ev = (s) => JSON.stringify({ type: 'checkout.session.completed', data: { object: s } });
  const send = async (s) => { const raw = ev(s); return w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw, headers: { 'stripe-signature': await signForTest(WEBHOOK_SECRET, raw) } }); };
  assert.equal((await send(session(ids[0].facility_id, ids[0].token, 'cs_a'))).body.state, 'released');
  assert.equal((await send(session(ids[0].facility_id, ids[0].token, 'cs_a'))).body.duplicate, true, 'webhook retries are idempotent');
  for (const t of ids.slice(1, 5)) await w.call('handleAccept', 'POST', `/api/senior-accept?t=${t.token}&o=rent`);
  const late = await send(session(ids[5].facility_id, ids[5].token, 'cs_late'));
  assert.equal(late.body.state, 'taken');
  assert.ok(late.body.refundId, 'late payment is refunded');
  assert.ok(w.stripeCalls.some((c) => c.path === 'refunds' && c.body.includes('pi_cs_late')));
  assert.equal(w.db.q("SELECT status FROM accepts WHERE stripe_session_id = 'cs_late'")[0].status, 'late');
  assert.equal(w.db.q("SELECT COUNT(*) n FROM accepts WHERE status = 'released'")[0].n, 5);
});

test('webhook signature rejects a bad signature', async () => {
  const w = world();
  const raw = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_x', metadata: { kind: 'senior_seat', facility_id: 'mc-east' } } } });
  const bad = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw, headers: { 'stripe-signature': await signForTest('whsec_wrong', raw) } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'bad_signature');
  const none = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw });
  assert.equal(none.status, 400);
  const stale = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw, headers: { 'stripe-signature': await signForTest(WEBHOOK_SECRET, raw, Math.floor(Date.now() / 1000) - 3600) } });
  assert.equal(stale.body.error, 'timestamp_out_of_tolerance');
  const tampered = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw: raw.replace('mc-east', 'mc-x1'), headers: { 'stripe-signature': await signForTest(WEBHOOK_SECRET, raw) } });
  assert.equal(tampered.status, 400);
  assert.equal(w.db.q('SELECT COUNT(*) n FROM seat_events')[0].n, 0, 'nothing recorded from a rejected event');
  const good = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw: JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_y', subscription: 'sub_1', metadata: { kind: 'senior_seat', facility_id: 'mc-east' } } } }), headers: {} }).catch(() => null);
  assert.equal(good.status, 400);
});

test('seat checkout completion sets a six-month cancel_at and records seat events', async () => {
  const w = world();
  const raw = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_seat', subscription: 'sub_123', metadata: { kind: 'senior_seat', facility_id: 'mc-east' } } } });
  const r = await w.call('handleWebhook', 'POST', '/api/senior-stripe-webhook', { raw, headers: { 'stripe-signature': await signForTest(WEBHOOK_SECRET, raw) } });
  assert.equal(r.body.state, 'recorded');
  const call = w.stripeCalls.find((c) => c.path === 'subscriptions/sub_123');
  const cancelAt = Number(new URLSearchParams(call.body).get('cancel_at'));
  assert.equal(new Date(cancelAt * 1000).toISOString().slice(0, 10), '2027-04-13');
  assert.deepEqual(w.db.q('SELECT event FROM seat_events ORDER BY id').map((e) => e.event), ['checkout_completed', 'subscription_cancel_at_set']);
  const co = await w.call('handleSeatCheckout', 'POST', '/api/senior-seat-checkout', { json: { facility_id: 'mc-east' } });
  assert.equal(co.body.ok, true);
  const body = new URLSearchParams(w.stripeCalls.filter((c) => c.path === 'checkout/sessions').pop().body);
  assert.equal(body.get('mode'), 'subscription');
  assert.equal(body.get('subscription_data[trial_period_days]'), '60');
});

test('seat-active routing sends only to the seat holder', async () => {
  const w = world({ seat: ACTIVE_SEAT });
  const r = await w.lead();
  assert.equal(r.body.status, 'seat_offered');
  assert.equal(w.teasers().length, 0, 'no teaser while the seat holder has the lead');
  const nonOwner = w.sent.filter((s) => s.to[0] !== 'owner@example.net');
  assert.deepEqual(nonOwner.map((s) => s.to[0]), ['mc-east@example.org']);
  assert.ok(nonOwner[0].text.includes(PII.phone), 'the seat holder gets the full lead');
  assert.match(nonOwner[0].text, /Working it: .*a=working/);
  assert.match(nonOwner[0].text, /Pass: .*a=pass/);
  // A lead the seat holder does not fit goes straight to the open round.
  const w2 = world({ seat: { ...ACTIVE_SEAT, facility_id: 'al-downtown' } });
  const r2 = await w2.lead();
  assert.equal(r2.body.status, 'open_round');
  assert.ok(!w2.sent.some((s) => s.to[0] === 'al-downtown@example.org'));
  // An expired seat is not active.
  const w3 = world({ seat: { ...ACTIVE_SEAT, end: '2026-10-01', start: '2026-04-01' } });
  assert.equal((await w3.lead()).body.status, 'open_round');
});

test('seat pass reaches the open round', async () => {
  const w = world({ seat: ACTIVE_SEAT });
  const r = await w.lead();
  const tok = w.db.q("SELECT token FROM seat_events WHERE event = 'offered'")[0].token;
  const g = await w.call('handleSeat', 'GET', `/api/senior-seat?t=${tok}&a=pass`);
  assert.equal(g.status, 200);
  assert.equal(w.db.q('SELECT status FROM leads')[0].status, 'seat_offered', 'GET never passes');
  w.now = hours(w.now, 2);
  await w.call('handleSeat', 'POST', `/api/senior-seat?t=${tok}&a=pass`, { form: { why: 'No availability' } });
  assert.equal(w.db.q('SELECT status FROM leads')[0].status, 'open_round');
  const got = w.teasers().map((t) => t.to[0]);
  assert.ok(got.length >= 3 && !got.includes('mc-east@example.org'), 'open round excludes the seat holder who passed');
  const notice = w.to('owner@example.net').find((s) => /Seat pass/.test(s.subject));
  assert.ok(notice, 'owner is emailed on a pass');
  assert.match(notice.text, /Memory Gardens East/);
  assert.match(notice.text, /No availability/);
  assert.match(notice.text, /Open round sent: 2026-10-13T14/);
  assert.deepEqual(w.db.q('SELECT event FROM seat_events ORDER BY id').map((e) => e.event), ['offered', 'pass']);
});

test('seat 72h timeout reaches the open round', async () => {
  const w = world({ seat: ACTIVE_SEAT });
  await w.lead();
  const tick = () => w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': TICK } });
  assert.equal((await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': 'nope' } })).status, 401);
  w.now = hours(w.now, 71);
  assert.equal((await tick()).body.timed_passes, 0);
  assert.equal(w.teasers().length, 0);
  w.now = hours(w.now, 2);
  assert.equal((await tick()).body.timed_passes, 1);
  assert.equal(w.db.q('SELECT status FROM leads')[0].status, 'open_round');
  assert.ok(w.teasers().length >= 3);
  assert.ok(w.to('owner@example.net').some((s) => /Seat timed pass/.test(s.subject) && /no click within 72 hours/.test(s.text)));
  assert.equal((await tick()).body.timed_passes, 0, 'a timed pass happens once');
});

test('seat working then day-30 not placed reaches the open round', async () => {
  const w = world({ seat: ACTIVE_SEAT });
  await w.lead();
  const tok = w.db.q("SELECT token FROM seat_events WHERE event = 'offered'")[0].token;
  await w.call('handleSeat', 'POST', `/api/senior-seat?t=${tok}&a=working`);
  assert.equal(w.db.q('SELECT status FROM leads')[0].status, 'seat_working');
  w.now = hours(w.now, 100);
  await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': TICK } });
  assert.equal(w.teasers().length, 0, 'working it stops the 72h clock');
  w.now = hours(w.now, 30 * 24);
  const t = await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': TICK } });
  assert.equal(t.body.followups_sent, 1);
  const fu = w.to(PII.email).find((s) => /Did you choose a community/.test(s.subject));
  assert.ok(fu && /Not yet: /.test(fu.text) && /Memory Gardens East: /.test(fu.text));
  const ftok = w.db.q('SELECT token FROM followups WHERE day = 30')[0].token;
  await w.call('handleFollowup', 'POST', `/api/senior-followup?t=${ftok}&a=not_yet`);
  assert.equal(w.db.q('SELECT status FROM leads')[0].status, 'open_round');
  assert.ok(w.teasers().length >= 3 && !w.teasers().some((s) => s.to[0] === 'mc-east@example.org'));
  assert.ok(w.db.q("SELECT 1 FROM seat_events WHERE event = 'not_placed'").length === 1);
});

test('off-ramp leads are stored unsellable and still emailed', async () => {
  const w = world({ seat: ACTIVE_SEAT });
  const tier3 = await w.lead({ adl_tasks: ['bathing', 'dressing', 'transferring', 'medications', 'mobility'] });
  assert.equal(tier3.body.status, 'unsellable');
  assert.equal(tier3.body.unsellable_reason, 'tier3_skilled_nursing');
  const medicaid = await w.lead({ payers: ['medicaid'] });
  assert.equal(medicaid.body.unsellable_reason, 'medicaid_only');
  const anon = await w.lead({ name: '', phone: '', email: '', senior_first_name: '', consent_contact: false, consent_health: false, payers: ['medicaid'] });
  assert.equal(anon.status, 200, 'an anonymous off-ramp is still stored');
  assert.equal(anon.body.status, 'unsellable');
  const rows = w.db.q('SELECT status, unsellable_reason FROM leads');
  assert.equal(rows.length, 3);
  assert.ok(rows.every((x) => x.status === 'unsellable' && x.unsellable_reason));
  assert.equal(w.teasers().length, 0);
  assert.equal(w.sent.filter((s) => s.to[0] !== 'owner@example.net').length, 0, 'nothing goes to any community');
  assert.equal(w.to('owner@example.net').filter((s) => /unsellable/.test(s.subject)).length, 3);
  const add = await w.call('handleLead', 'POST', '/api/senior-lead', { json: { kind: 'family', who_for: 'parent', payers: ['medicaid'], name: 'Late Caller', phone: '9015550199', consent_contact: true, lead_id: anon.body.lead_id, edit_token: anon.body.edit_token } });
  assert.equal(add.body.ok, true);
  assert.ok(w.to('owner@example.net').some((s) => /contact added/.test(s.subject)));
});

test('guide attribution is kept on the lead', async () => {
  const w = world();
  const q = { src: 'guide', intent: 'find_care', button: 'hero_cta', vertical: 'senior-living', page_kind: 'guide', page_slug: 'guides/assisted-living-cost-memphis', market: 'memphis-tn' };
  const r = await w.lead(q);
  const row = w.db.q('SELECT src, intent_type, button_source, vertical_key, page_kind, page_slug, market_slug FROM leads WHERE id = ?', r.body.lead_id)[0];
  assert.deepEqual(row, { src: 'guide', intent_type: 'find_care', button_source: 'hero_cta', vertical_key: 'senior-living', page_kind: 'guide', page_slug: 'guides/assisted-living-cost-memphis', market_slug: 'memphis-tn' });
  const notice = w.to('owner@example.net')[0];
  assert.match(notice.text, /page_kind: guide/);
  assert.match(notice.text, /page_slug: guides\/assisted-living-cost-memphis/);
});

test('honeypot, consent and contact are enforced', async () => {
  const w = world();
  const bot = await w.lead({ website: 'http://spam' });
  assert.deepEqual(bot.body, { ok: true });
  assert.equal(w.db.q('SELECT COUNT(*) n FROM leads')[0].n, 0, 'honeypot stores nothing');
  assert.equal((await w.lead({ consent_contact: false })).body.error, 'consent');
  assert.equal((await w.lead({ consent_health: false })).body.error, 'consent_health');
  assert.equal((await w.lead({ email: '', phone: '' })).body.error, 'contact_required');
  assert.equal((await w.lead({ email: 'not-an-email' })).body.error, 'email');
  assert.equal((await w.call('handleLead', 'POST', '/api/senior-lead', { form: { a: 1 } })).status, 415);
  const pro = await w.call('handleLead', 'POST', '/api/senior-lead', { json: { kind: 'professional', care_tier: 2, memory_care: 'yes', payer: 'savings', discharge_date: '2026-10-20', email: 'planner@hospital.example', consent_contact: true, consent_health: true } });
  assert.equal(pro.body.status, 'open_round');
  const prow = w.db.q('SELECT who_for, name, phone, senior_first_name FROM leads WHERE id = ?', pro.body.lead_id)[0];
  assert.deepEqual(prow, { who_for: 'professional', name: '', phone: '', senior_first_name: '' });
  const off = { ...w.env };
  delete off.SENIOR_DB;
  const H = await import('../../lib/senior/handlers.mjs');
  const res = await H.handleLead({ request: new Request('https://dentistryguides.com/api/senior-lead', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }), env: off }, w.deps());
  assert.equal(res.status, 404, 'other guides projects (no SENIOR_DB) answer 404');
});

test('follow-up move-in emails the owner with the invoice line', async () => {
  const w = world();
  const r = await w.lead();
  const tok = w.tokenFor(r.body.lead_id, 'mc-collierville');
  await w.call('handleAccept', 'POST', `/api/senior-accept?t=${tok}&o=rent`);
  w.now = hours(w.now, 24 * 31);
  await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': TICK } });
  const ftok = w.db.q('SELECT token FROM followups WHERE day = 30')[0].token;
  await w.call('handleFollowup', 'GET', `/api/senior-followup?t=${ftok}&a=moved_in&f=mc-collierville`);
  assert.equal(w.db.q('SELECT outcome FROM leads')[0].outcome, null, 'GET never records an answer');
  await w.call('handleFollowup', 'POST', `/api/senior-followup?t=${ftok}&a=moved_in&f=mc-collierville`);
  const lead = w.db.q('SELECT outcome, outcome_facility_id FROM leads')[0];
  assert.deepEqual(lead, { outcome: 'moved_in', outcome_facility_id: 'mc-collierville' });
  const inv = w.to('owner@example.net').find((s) => /Move-in reported/.test(s.subject));
  assert.match(inv.text, /INVOICE: Collierville Commons accepted on rent terms/);
  w.now = hours(w.now, 24 * 31);
  const t2 = await w.call('handleTick', 'POST', '/api/senior-tick', { headers: { 'x-senior-tick-token': TICK } });
  assert.equal(t2.body.followups_sent, 0, 'no more follow-ups after a move-in');
  const ut = w.db.q('SELECT token FROM recipients WHERE email = ?', PII.email)[0].token;
  await w.call('handleUnsubscribe', 'POST', `/api/senior-unsubscribe?t=${ut}`, { raw: 'List-Unsubscribe=One-Click' });
  assert.ok(w.db.q('SELECT unsubscribed_at FROM recipients WHERE email = ?', PII.email)[0].unsubscribed_at);
});

test('every outgoing email carries the footer', async () => {
  assert.ok(ALL_SENT.length >= 40, `the flows above must have sent mail to check (saw ${ALL_SENT.length})`);
  for (const s of ALL_SENT) {
    assert.equal(s.from, 'The Industry Guides <hello@theindustryguides.com>');
    for (const part of [s.text, s.html]) {
      assert.ok(part.includes(FOOTER_COMPANY_LINE), `footer company line missing: ${s.subject}`);
      assert.ok(part.includes(UMBRELLA_CONTACT), 'company contact missing');
      assert.ok(part.includes(FAKE_POSTAL), 'postal address missing');
      assert.match(part, /https:\/\/memphisseniorcarehomes\.com\/api\/senior-unsubscribe\?t=[0-9a-f]{32}/);
    }
    assert.match(s.headers['List-Unsubscribe'], /^<https:\/\/memphisseniorcarehomes\.com\/api\/senior-unsubscribe\?t=/);
    assert.equal(s.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  }
  assert.throws(() => composeEmail({ env: {}, to: 'a@b.co', subject: 's', text: 't', unsubToken: 'x', postalAddress: '' }), /postal address/);
  assert.throws(() => composeEmail({ env: {}, to: 'a@b.co', subject: 's', text: 't', unsubToken: '', postalAddress: FAKE_POSTAL }), /unsubscribe/);
  const w = world();
  w.env.SENIOR_POSTAL_ADDRESS = '';
  const r = await w.lead();
  assert.equal(r.body.ok, true, 'the lead is still stored in D1');
  assert.equal(w.sent.length, 0, 'no email leaves without the postal address');
  assert.ok(w.db.q('SELECT error FROM sends').every((x) => /refused/.test(x.error)));
});

test('matcher: tiers, radius and the full list', () => {
  assert.equal(M.tierFromAdl([]), 1);
  assert.equal(M.tierFromAdl(['bathing']), 1);
  assert.equal(M.tierFromAdl(['bathing', 'dressing']), 2);
  assert.equal(M.tierFromAdl(['bathing', 'dressing', 'transferring', 'medications']), 2);
  assert.equal(M.tierFromAdl(['bathing', 'dressing', 'transferring', 'medications', 'mobility']), 3);
  const fac = M.facilityList(FACILITIES);
  const lead = { zip: '38117', radius: '10', care_tier: 2, memory_care: 1, budget_band: '3000_4500' };
  const r = M.results(fac, lead, ZIPS);
  assert.equal(r.matches.length + r.others.length, fac.length, 'the family always sees every community');
  assert.ok(r.matches.every((f) => f.distance <= 10));
  assert.ok(!r.matches.some((f) => f.id === 'mc-collierville'), 'Collierville is beyond 10 miles of 38117');
  assert.ok(r.matches.some((f) => f.id === 'mc-nofee'), 'no_teasers only stops emails, never the family\'s list');
  // The directory file (data/listings/senior-living/facilities.json) has no id column: the
  // licence number is the id, and rows without one fall back to name + ZIP, never dropped.
  const dir = M.facilityList({ facilities: [
    { name: 'Licensed Place', license_number: 'AL-0042', zip: '38117', lat: 35.1, lng: -89.9, memory_care: true, email: '' },
    { name: 'Unlicensed Name', zip: '38103', memory_care: false }
  ] });
  assert.deepEqual(dir.map((f) => f.id), ['AL-0042', 'unlicensed-name-38103']);
});
