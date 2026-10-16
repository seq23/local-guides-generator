// Pins: an empty answer is never an answer. 16 Oct 2026, WPP-llm #42/#43 (same
// router shape): a timeout that fired while the BODY downloaded was swallowed
// into ok:true content '', nemotron :free spent max_tokens on its reasoning trace
// and answered '', and the --ping selftest asked with max_tokens 5, which a
// reasoning model always answers empty. Each test replays one failure on a
// stubbed fetch and fails on the pre-fix router.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRouting, freeModelIds, chatFree, chatOnce, CostViolation, NO_FREE_MODEL_STOP } from '../../scripts/lib/free_llm_router.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cfg = loadRouting(ROOT);
const ids = freeModelIds(cfg);
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const res = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (n) => headers[n.toLowerCase()] ?? null }, json: async () => body });
const answer = (content, finish_reason = 'stop') => res(200, { choices: [{ message: { content }, finish_reason }], usage: { cost: 0 } });
// Headers arrive, then the body read hangs until the router's own abort fires.
const bodyHangs = (init) => ({ ok: true, status: 200, headers: { get: () => null }, json: () => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })))) });

/** handler(model, body, init, nthCallForModel) -> response. Records every request body. */
function stub(handler) {
  const bodies = [];
  const per = new Map();
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/key')) return res(200, { data: { label: 't', limit: 0, usage: 0 } });
    const body = JSON.parse(init.body);
    bodies.push(body);
    per.set(body.model, (per.get(body.model) || 0) + 1);
    return handler(body.model, body, init, per.get(body.model));
  };
  return bodies;
}
const opts = { messages: [{ role: 'user', content: 'ping' }], key: 'sk-or-test-empty' };

test('body read times out after headers: an error with elapsed ms, never an empty answer; next model answers', async () => {
  stub((m, b, init) => (m === ids[0] ? bodyHangs(init) : answer('ok')));
  const r = await chatFree(cfg, { ...opts, timeoutMs: 50 });
  assert.equal(r.ok, true);
  assert.equal(r.model, ids[1]);
  assert.equal(r.content, 'ok');
  assert.match(r.attempts[0].error, /^timeout after \d+ ms reading the response body/);
  const once = await chatOnce(cfg, { ...opts, model: ids[0], timeoutMs: 50 });
  assert.equal(once.ok, false, 'chatOnce must not report ok:true for a body that never arrived');
});

test('a 2xx with an unreadable body is an error, not an empty answer', async () => {
  stub((m) => (m === ids[0] ? { ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } } : answer('ok')));
  const r = await chatFree(cfg, opts);
  assert.equal(r.model, ids[1]);
  assert.match(r.attempts[0].error, /^unreadable response body after \d+ ms/);
});

test('200 with no choices is no_choices and falls through', async () => {
  stub((m) => (m === ids[0] ? res(200, { usage: { cost: 0 } }) : answer('ok')));
  const r = await chatFree(cfg, opts);
  assert.equal(r.ok, true);
  assert.equal(r.model, ids[1]);
  assert.deepEqual(r.attempts, [{ model: ids[0], error: 'no_choices', status: 200 }]);
});

test('reasoning is requested low; an empty length-cut answer is retried once with reasoning off on the same model', async () => {
  const bodies = stub((m, b, init, n) => (m === ids[0] && n === 1 ? answer('', 'length') : answer('ok')));
  const r = await chatFree(cfg, opts);
  assert.equal(r.ok, true);
  assert.equal(r.model, ids[0]);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].reasoning?.effort, 'low');
  assert.deepEqual(bodies[1].reasoning, { enabled: false });
  assert.equal(bodies[1].model, ids[0]);
});

test('empty twice on one model: exactly one retry, then the next model, not an ok:true empty answer', async () => {
  const bodies = stub((m) => (m === ids[0] ? answer('', 'length') : answer('ok')));
  const r = await chatFree(cfg, opts);
  assert.equal(r.model, ids[1]);
  assert.equal(bodies.filter((b) => b.model === ids[0]).length, 2);
  assert.equal(r.attempts[0].error, 'empty');
});

test('empty with finish_reason stop is not retried; it falls through', async () => {
  const bodies = stub((m) => (m === ids[0] ? answer('   ', 'stop') : answer('ok')));
  const r = await chatFree(cfg, opts);
  assert.equal(r.model, ids[1]);
  assert.equal(bodies.filter((b) => b.model === ids[0]).length, 1);
});

test('every model empty is the named stop, never ok:true', async () => {
  stub(() => answer('', 'stop'));
  const r = await chatFree(cfg, opts);
  assert.equal(r.ok, false);
  assert.equal(r.stop, NO_FREE_MODEL_STOP);
  assert.equal(r.attempts.length, ids.length);
});

test('429 with Retry-After <= 30 s is waited out once on the same model', async () => {
  const waits = [];
  stub((m, b, init, n) => (m === ids[0] && n === 1 ? res(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '2' }) : answer('ok')));
  const r = await chatFree(cfg, { ...opts, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(r.model, ids[0]);
  assert.deepEqual(waits, [2000]);
});

test('429 Retry-After in OpenRouter error metadata is honoured; a second 429 moves on', async () => {
  const waits = [];
  const bodies = stub((m) => (m === ids[0] ? res(429, { error: { message: 'rate limited upstream', metadata: { headers: { 'Retry-After': '1' } } } }) : answer('ok')));
  const r = await chatFree(cfg, { ...opts, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(r.model, ids[1]);
  assert.deepEqual(waits, [1000], 'waited exactly once for the model');
  assert.equal(bodies.filter((b) => b.model === ids[0]).length, 2);
});

test('429 Retry-After over 30 s, or past the route budget, is not waited', async () => {
  const waits = [];
  stub((m) => (m === ids[0] ? res(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '45' }) : answer('ok')));
  let r = await chatFree(cfg, { ...opts, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(r.model, ids[1]);
  stub((m) => (m === ids[0] ? res(429, { error: { message: 'Rate limit exceeded' } }, { 'retry-after': '20' }) : answer('ok')));
  r = await chatFree(cfg, { ...opts, totalBudgetMs: 5000, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(r.model, ids[1]);
  assert.deepEqual(waits, []);
});

test('a spent total budget sends nothing and is the named stop', async () => {
  const bodies = stub(() => answer('ok'));
  const r = await chatFree(cfg, { ...opts, totalBudgetMs: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.stop, NO_FREE_MODEL_STOP);
  assert.equal(bodies.length, 0);
  assert.ok(r.attempts.every((a) => /budget/.test(a.error)));
});

test('$0 guarantees hold on the retry path: listed models only, no plugins, a non-zero cost on the retry throws', async () => {
  const bodies = stub((m, b, init, n) => (n === 1 ? answer('', 'length') : res(200, { choices: [{ message: { content: 'ok' } }], usage: { cost: 0.001 } })));
  await assert.rejects(chatFree(cfg, opts), CostViolation);
  assert.ok(bodies.every((b) => ids.includes(b.model) && !b.plugins));
});

test('--ping asks with a realistic budget (max_tokens 5 is always empty on a reasoning model)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/lib/free_llm_router.mjs'), 'utf8');
  const ping = src.slice(src.indexOf("argv.includes('--ping')"));
  const m = ping.match(/chatFree\(cfg, \{[^}]*\}\], max_tokens: (\d+)/);
  assert.ok(m, 'the --ping chatFree call is found');
  assert.ok(Number(m[1]) >= 100, `--ping max_tokens is ${m[1]}`);
});
