// Blocked lead domains (owner, 26 Oct 2026): a public form submission whose
// email domain is on BLOCKED_LEAD_DOMAINS (Pages env var, comma-separated) is
// dropped quietly: no Airtable write, no lead email, no D1 row, one
// BLOCKED_LEAD log line, and the same { ok: true } the honeypot gets. The real
// list lives only in the env var; these fixtures use reserved .test domains.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRequestAssistance } from './load_endpoint.mjs';
import { blockedDomainFor, parseBlockedDomains } from '../../lib/blocked_lead_domains.mjs';
import { makeWorld } from '../senior/harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIST = ' Blocked-Example.test , other.test,,';

const loadEndpoint = () => loadRequestAssistance('ra-blk-');

async function withCapture(fn) {
  const calls = [];
  const logs = [];
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('airtable')) return new Response(JSON.stringify({ records: [{ id: 'rec1' }] }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  console.log = (...a) => { logs.push(a.join(' ')); };
  try {
    const out = await fn();
    return { out, calls, logs };
  } finally {
    globalThis.fetch = realFetch;
    console.log = realLog;
  }
}

const ENV = { AIRTABLE_BASE_ID: 'app', AIRTABLE_TABLE_NAME: 'Leads', AIRTABLE_API_TOKEN: 't', RESEND_API_KEY: 'r', LEAD_TO: 'leads@example.com' };
const body = (email) => ({ provider_type: 'Personal Injury Attorney', email, consent: 'yes', vertical_key: 'pi' });

async function postRA(mod, email, list) {
  const req = new Request('https://theaccidentguides.com/api/request-assistance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body(email)) });
  const res = await mod.onRequestPost({ request: req, env: { ...ENV, ...(list === undefined ? {} : { BLOCKED_LEAD_DOMAINS: list }) } });
  return { status: res.status, json: await res.json() };
}

test('matcher: exact domain and subdomains, case-insensitive; look-alikes pass', () => {
  assert.deepEqual(parseBlockedDomains(LIST), ['blocked-example.test', 'other.test']);
  assert.equal(blockedDomainFor('A@BLOCKED-EXAMPLE.TEST', LIST), 'blocked-example.test');
  assert.equal(blockedDomainFor('a@mail.blocked-example.test', LIST), 'blocked-example.test');
  assert.equal(blockedDomainFor('a@notblocked-example.test', LIST), '');
  assert.equal(blockedDomainFor('a@blocked-example.test.evil.test', LIST), '');
  assert.equal(blockedDomainFor('a@fine.test', LIST), '');
  assert.equal(blockedDomainFor('a@blocked-example.test', ''), '');
  assert.equal(blockedDomainFor('a@blocked-example.test', undefined), '');
  assert.equal(blockedDomainFor('', LIST), '');
});

test('request-assistance: blocked domain writes nothing, sends nothing, logs one line, answers ok', async () => {
  const mod = await loadEndpoint();
  for (const email of ['lead@blocked-example.test', 'Lead@Sub.Blocked-Example.TEST']) {
    const { out, calls, logs } = await withCapture(() => postRA(mod, email, LIST));
    assert.equal(out.status, 200);
    assert.deepEqual(out.json, { ok: true }, 'same answer as the honeypot, no storage field');
    assert.deepEqual(calls, [], 'no Airtable write and no Resend email');
    const lines = logs.filter((l) => l.startsWith('BLOCKED_LEAD'));
    assert.deepEqual(lines, ['BLOCKED_LEAD domain=blocked-example.test source=theaccidentguides.com']);
    assert.ok(!logs.join('\n').includes('@'), 'the address itself is never logged');
  }
});

test('request-assistance: unlisted domain and unset/empty list still store and email', async () => {
  const mod = await loadEndpoint();
  for (const [email, list] of [['lead@fine.test', LIST], ['lead@blocked-example.test', undefined], ['lead@blocked-example.test', '']]) {
    const { out, calls, logs } = await withCapture(() => postRA(mod, email, list));
    assert.deepEqual(out.json, { ok: true, storage: 'airtable' }, `${email} / ${list}`);
    assert.ok(calls.some((u) => u.includes('airtable')), 'Airtable write');
    assert.ok(calls.some((u) => u.includes('resend')), 'lead email');
    assert.ok(!logs.some((l) => l.startsWith('BLOCKED_LEAD')));
  }
});

test('senior-lead: blocked domain creates no lead and sends nothing; unlisted still does', async () => {
  const blockedWorld = makeWorld();
  blockedWorld.env.BLOCKED_LEAD_DOMAINS = LIST;
  const b = await withCapture(() => blockedWorld.lead({ email: 'family@mail.blocked-example.test' }));
  assert.equal(b.out.status, 200);
  assert.deepEqual(b.out.body, { ok: true });
  assert.equal(blockedWorld.db.q('SELECT COUNT(*) n FROM leads')[0].n, 0, 'no D1 row');
  assert.equal(blockedWorld.sent.length, 0, 'no email');
  assert.deepEqual(b.logs.filter((l) => l.startsWith('BLOCKED_LEAD')), ['BLOCKED_LEAD domain=blocked-example.test source=memphisseniorcarehomes.com']);

  const okWorld = makeWorld();
  okWorld.env.BLOCKED_LEAD_DOMAINS = LIST;
  const o = await withCapture(() => okWorld.lead({ email: 'family@fine.test' }));
  assert.equal(o.out.body.ok, true);
  assert.ok(o.out.body.lead_id, 'an unlisted domain still becomes a lead');
  assert.equal(okWorld.db.q('SELECT COUNT(*) n FROM leads')[0].n, 1);
});
