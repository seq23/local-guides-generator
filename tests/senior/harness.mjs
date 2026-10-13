/**
 * Test harness: a D1-compatible database over node:sqlite running the real migration,
 * a fake fetch that captures every Resend send and answers Stripe, and fixture data.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as HL from '../../lib/senior/handlers.mjs';
import * as FN from '../../lib/senior/funnel.mjs';

const H = { ...HL, ...FN };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ZIPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/senior-zips.json'), 'utf8')).zips;
export const FAKE_POSTAL = 'PO Box 0000, Testville, TN 00000';
export const WEBHOOK_SECRET = 'whsec_test_fixture_secret';
export const TICK = 'tick-fixture-token';

export function makeD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(path.join(ROOT, 'migrations/senior')).filter((n) => n.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(ROOT, 'migrations/senior', f), 'utf8'));
  const norm = (a) => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));
  class Stmt {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...a) { return new Stmt(this.sql, a); }
    async run() { const r = db.prepare(this.sql).run(...norm(this.args)); return { meta: { changes: Number(r.changes) } }; }
    async first() { const r = db.prepare(this.sql).get(...norm(this.args)); return r ? { ...r } : null; }
    async all() { return { results: db.prepare(this.sql).all(...norm(this.args)).map((r) => ({ ...r })) }; }
  }
  return {
    prepare: (sql) => new Stmt(sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    q: (sql, ...a) => db.prepare(sql).all(...a).map((r) => ({ ...r }))
  };
}

// Downtown Memphis 38103; East Memphis 38117; Germantown 38138; Collierville 38017; Tunica MS 38676 (far).
export const FACILITIES = [
  { id: 'mc-east', name: 'Memory Gardens East', phone: '901-555-1001', email: 'mc-east@example.org', zip: '38117', memory_care: true, rate_min: 3500, rate_max: 5200 },
  { id: 'al-downtown', name: 'Downtown Assisted Living', phone: '901-555-1002', email: 'al-downtown@example.org', zip: '38103', memory_care: false, rate_min: 2800, rate_max: 4200 },
  { id: 'mc-germantown', name: 'Germantown Memory Care', phone: '901-555-1003', email: 'mc-germantown@example.org', zip: '38138', care_types: ['assisted living', 'memory care'], rate_min: 4800, rate_max: 6500 },
  { id: 'mc-collierville', name: 'Collierville Commons', phone: '901-555-1004', email: 'mc-collierville@example.org', zip: '38017', memory_care: true },
  { id: 'mc-nofee', name: 'No Fee Manor', phone: '901-555-1005', email: 'nofee@example.org', zip: '38117', memory_care: true, no_teasers: true },
  { id: 'mc-noemail', name: 'No Email House', phone: '901-555-1006', zip: '38117', memory_care: true },
  { id: 'mc-pricey', name: 'Pricey Place', phone: '901-555-1007', email: 'pricey@example.org', zip: '38117', memory_care: true, rate_min: 9000, rate_max: 11000 },
  { id: 'al-tunica', name: 'Tunica Assisted Living', phone: '662-555-1008', email: 'tunica@example.org', zip: '38676', memory_care: false, rate_min: 3000, rate_max: 4000 },
  { id: 'mc-x1', name: 'Extra Memory One', phone: '901-555-1009', email: 'x1@example.org', zip: '38119', memory_care: true },
  { id: 'mc-x2', name: 'Extra Memory Two', phone: '901-555-1010', email: 'x2@example.org', zip: '38120', memory_care: true },
  { id: 'mc-x3', name: 'Extra Memory Three', phone: '901-555-1011', email: 'x3@example.org', zip: '38018', memory_care: true }
];

export const PII = { name: 'Zelda Fixturename', phone: '901-555-0142', email: 'zelda.fixture@example.com', senior_first_name: 'Opalina' };

export function familyBody(over = {}) {
  return {
    kind: 'family', who_for: 'parent', zip: '38117', radius: '30', adl_tasks: ['bathing', 'dressing', 'medications'],
    dementia: 'yes', wanders: 'yes', budget_band: '3000_4500', payers: ['savings', 'va'], timeline: 'within_30', tags: ['pets'],
    ...PII, consent_contact: true, consent_health: true, website: '', shown_ids: ['mc-east', 'mc-collierville'], ...over
  };
}

export function makeWorld({ seat = { active: false }, start = '2026-10-13T12:00:00.000Z' } = {}) {
  const sent = [];
  const stripeCalls = [];
  const world = { sent, stripeCalls, now: start, seat };
  const env = {
    SENIOR_DB: makeD1(), RESEND_API_KEY: 're_test', LEAD_TO: 'owner@example.net', SENIOR_POSTAL_ADDRESS: FAKE_POSTAL,
    STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, SENIOR_TICK_TOKEN: TICK, SENIOR_SITE_ORIGIN: 'https://memphisseniorcarehomes.com'
  };
  world.env = env;
  let n = 0;
  world.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.resend.com/emails')) {
      const p = JSON.parse(init.body);
      sent.push(p);
      return new Response(JSON.stringify({ id: `em_${++n}` }), { status: 200 });
    }
    if (u.startsWith('https://api.stripe.com/v1/')) {
      const p = u.slice('https://api.stripe.com/v1/'.length);
      stripeCalls.push({ method: init.method, path: p, body: init.body ? String(init.body) : '' });
      if (p.startsWith('prices')) return new Response(JSON.stringify({ data: [{ id: p.includes('seat') ? 'price_seat' : 'price_flat' }] }));
      if (p.startsWith('checkout/sessions') && init.method === 'POST') return new Response(JSON.stringify({ id: `cs_test_${++n}`, url: `https://checkout.stripe.com/c/pay/cs_test_${n}` }));
      if (p.startsWith('refunds')) return new Response(JSON.stringify({ id: `re_${++n}` }));
      if (p.startsWith('subscriptions/')) return new Response(JSON.stringify({ id: p.split('/')[1] }));
      return new Response(JSON.stringify({ error: { message: 'unmocked' } }), { status: 400 });
    }
    throw new Error(`unexpected fetch ${u}`);
  };
  globalThis.fetch = world.fetch;
  world.deps = () => ({ seat: world.seat, zips: ZIPS, facilities: FACILITIES, now: () => world.now });
  world.call = async (handler, method, pathQ, { json, form, headers = {}, raw } = {}) => {
    const init = { method, headers: { ...headers } };
    if (json) { init.body = JSON.stringify(json); init.headers['content-type'] = 'application/json'; }
    if (form) { init.body = new URLSearchParams(form).toString(); init.headers['content-type'] = 'application/x-www-form-urlencoded'; }
    if (raw !== undefined) init.body = raw;
    const res = await H[handler]({ request: new Request(`https://memphisseniorcarehomes.com${pathQ}`, init), env: world.env }, world.deps());
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch (_) { /* html */ }
    return { status: res.status, body, headers: res.headers };
  };
  world.lead = (over) => world.call('handleLead', 'POST', '/api/senior-lead', { json: familyBody(over) });
  world.db = env.SENIOR_DB;
  world.to = (addr) => sent.filter((s) => s.to.includes(addr));
  world.teasers = () => sent.filter((s) => /Family looking for senior living/.test(s.subject));
  world.tokenFor = (leadId, facilityId) => env.SENIOR_DB.q('SELECT token FROM teasers WHERE lead_id = ? AND facility_id = ?', leadId, facilityId)[0].token;
  return world;
}
