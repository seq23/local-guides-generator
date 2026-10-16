// Pins: a 403/404 for ONE model is that model's refusal (try the next $0 model);
// only 401, 402, a key-shaped message, or a failed key check stops the route as a
// credential. 16 Oct 2026: thinkingmachines/inkling:free answered 403 "only
// available on agentic harnesses" on a live key and the old router stopped the
// whole route as "key disabled or invalid".
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRouting, freeModelIds, chatFree, chatOnce, CostViolation, KEY_REFUSED_STOP, NO_FREE_MODEL_STOP } from '../../scripts/lib/free_llm_router.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = loadRouting(ROOT);
const ids = freeModelIds(cfg);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

let n = 0;
const freshKey = () => `sk-or-test-${process.pid}-${++n}`; // the key check is memoised per key

/** chat: model id -> {status, body}; auth: {status, body}. Records every call. */
function mockFetch({ chat, auth = { status: 200, body: { data: { label: 'test', limit: 0, usage: 0 } } } }) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/auth/key')) { calls.push({ kind: 'auth' }); return new Response(JSON.stringify(auth.body), { status: auth.status }); }
    const model = JSON.parse(init.body).model;
    calls.push({ kind: 'chat', model });
    const r = chat(model);
    return new Response(JSON.stringify(r.body), { status: r.status });
  };
  return calls;
}
const answer = (model) => ({ status: 200, body: { id: 'gen-1', model, choices: [{ message: { content: 'ok' } }], usage: { cost: 0 } } });
const harness403 = { status: 403, body: { error: { code: 403, message: 'This model is only available on agentic harnesses' } } };
const msgs = [{ role: 'user', content: 'ping' }];

test('roster has at least two models (fall-through is testable) and inkling is not in it', () => {
  assert.ok(ids.length >= 2);
  assert.ok(!ids.some((id) => /inkling/i.test(id)), 'thinkingmachines/inkling:free must not be in config/llm_routing.json');
});

test('a 403 with a model-scoped message falls through to the next model and answers', async () => {
  const calls = mockFetch({ chat: (m) => (m === ids[0] ? harness403 : answer(m)) });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.ok, true);
  assert.equal(r.model, ids[1]);
  assert.equal(r.cost, 0);
  assert.deepEqual(r.attempts, [{ model: ids[0], error: harness403.body.error.message, status: 403 }]);
  assert.equal(calls.filter((c) => c.kind === 'auth').length, 1, 'the 403 is confirmed against the key exactly once');
});

test('a 404 for one model falls through the same way', async () => {
  mockFetch({ chat: (m) => (m === ids[0] ? { status: 404, body: { error: { message: 'No endpoints found for this model' } } } : answer(m)) });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.ok, true);
  assert.equal(r.model, ids[1]);
});

test('every model 403 on a live key is NO_FREE_MODEL_STOP, not a credential stop, with one key check', async () => {
  const calls = mockFetch({ chat: () => harness403 });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.ok, false);
  assert.equal(r.stop, NO_FREE_MODEL_STOP);
  assert.equal(r.attempts.length, ids.length);
  assert.equal(calls.filter((c) => c.kind === 'auth').length, 1);
});

test('a 401 still stops the whole route as a credential stop after one attempt', async () => {
  const calls = mockFetch({ chat: () => ({ status: 401, body: { error: { message: 'No cookie auth credentials found' } } }) });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.ok, false);
  assert.equal(r.stop, KEY_REFUSED_STOP);
  assert.equal(r.attempts.length, 1);
  assert.equal(calls.filter((c) => c.kind === 'chat').length, 1, 'no further model is tried after a 401');
});

test('a 402 stops as a credential stop', async () => {
  mockFetch({ chat: () => ({ status: 402, body: { error: { message: 'Insufficient credits' } } }) });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.stop, KEY_REFUSED_STOP);
  assert.equal(r.attempts.length, 1);
});

test('a 403 with a key-shaped message stops without needing the key check', async () => {
  const calls = mockFetch({ chat: () => ({ status: 403, body: { error: { message: 'Key limit exceeded' } } }) });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.stop, KEY_REFUSED_STOP);
  assert.equal(r.attempts.length, 1);
  assert.equal(calls.filter((c) => c.kind === 'auth').length, 0);
});

test('a 403 whose key check also fails is a credential stop (fail closed)', async () => {
  mockFetch({ chat: () => harness403, auth: { status: 401, body: { error: { message: 'User not found' } } } });
  const r = await chatFree(cfg, { messages: msgs, key: freshKey() });
  assert.equal(r.stop, KEY_REFUSED_STOP);
  assert.equal(r.attempts.length, 1);
});

test('chatOnce marks a live-key 403 as model_refused, not credential_refused (the probe path)', async () => {
  mockFetch({ chat: () => harness403 });
  const r = await chatOnce(cfg, { model: ids[0], messages: msgs, key: freshKey() });
  assert.equal(r.ok, false);
  assert.equal(r.credential_refused, false);
  assert.equal(r.model_refused, true);
});

test('$0 guarantee intact: a non-zero reported cost after a fall-through still throws', async () => {
  mockFetch({ chat: (m) => (m === ids[0] ? harness403 : { status: 200, body: { choices: [{ message: { content: 'x' } }], usage: { cost: 0.0001 } } }) });
  await assert.rejects(chatFree(cfg, { messages: msgs, key: freshKey() }), CostViolation);
});
