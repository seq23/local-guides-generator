// Negative proofs for the authority fix (30 Oct 2026):
//   scripts/validation/entity_graph_contract.js (validate_entity_graph)
//   scripts/entity_backlink_watch.mjs (weekly watch + self-heal)
// Each hostile fixture must fail; the shipped data must pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { checkStatic, checkRendered } = require('../../scripts/validation/entity_graph_contract.js');
const eg = require('../../scripts/lib/entity_graph.js');
const { watchEntity, runWatch } = await import('../../scripts/entity_backlink_watch.mjs');

const PS = 'data/page_sets/examples/uscis_medical_v1.json';

function entityCopy(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entity-'));
  for (const key of eg.publicationKeys()) {
    fs.mkdirSync(path.join(root, key), { recursive: true });
    for (const f of ['entity.json', 'reviewers.json']) fs.copyFileSync(path.join(eg.ENTITY_ROOT, key, f), path.join(root, key, f));
  }
  if (mutate) mutate(root);
  return root;
}
const edit = (root, key, file, fn) => {
  const p = path.join(root, key, file);
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  fn(d);
  fs.writeFileSync(p, JSON.stringify(d));
};

test('shipped entity files pass and ship with no reviewers', () => {
  const r = checkStatic({ repoRoot: ROOT });
  assert.equal(r.publications, 6);
  assert.equal(r.reviewers, 0);
});

for (const [name, fn, re] of [
  ['self-referential sameAs (own host)', (d) => { d.sameAs = ['https://uscisexam.com/about/']; }, /self-reference/],
  ['umbrella hub as sameAs', (d) => { d.sameAs = ['https://theindustryguides.com/uscis-medical/']; }, /self-reference/],
  ['sibling publication as sameAs', (d) => { d.sameAs = ['https://dentistryguides.com/']; }, /self-reference/],
  ['non-https sameAs', (d) => { d.sameAs = ['http://example.org/x']; }, /not an https URL/],
  ['same URL in sameAs and pending', (d) => { d.sameAs = ['https://example.org/x']; d.profiles_pending = [{ url: 'https://example.org/x' }]; }, /both sameAs and profiles_pending/],
  ['wrong parent', (d) => { d.parentOrganization['@id'] = 'https://example.org/#org'; }, /parentOrganization @id/],
  ['name drift', (d) => { d.name = 'USCIS Guides'; }, /not the pack brandName/],
  ['missing description', (d) => { d.description = ''; }, /description/],
]) {
  test(`static: ${name} fails`, () => {
    const entityRoot = entityCopy((root) => edit(root, 'uscis_medical', 'entity.json', fn));
    assert.throws(() => checkStatic({ repoRoot: ROOT, entityRoot }), re);
  });
}

test('static: a reviewer without written consent fails', () => {
  const entityRoot = entityCopy((root) => edit(root, 'neuro', 'reviewers.json', (d) => { d.reviewers = [{ name: 'A Person', credential: 'PhD', url: 'https://example.org/' }]; }));
  assert.throws(() => checkStatic({ repoRoot: ROOT, entityRoot }), /no written consent/);
});

test('static: missing entity.json fails', () => {
  const entityRoot = entityCopy((root) => fs.rmSync(path.join(root, 'trt', 'entity.json')));
  assert.throws(() => checkStatic({ repoRoot: ROOT, entityRoot }), /entity\.json missing/);
});

// Rendered fixtures: a tiny dist for uscis_medical.
function dist(pages) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'entity-dist-'));
  for (const [rel, html] of Object.entries(pages)) {
    fs.mkdirSync(path.join(root, rel), { recursive: true });
    fs.writeFileSync(path.join(root, rel, 'index.html'), html);
  }
  return root;
}
const ld = (...nodes) => nodes.map((n) => `<script type="application/ld+json">${JSON.stringify(n)}</script>`).join('');
const org = () => { process.env.PAGE_SET_FILE = PS; return eg.organizationNode('uscis_medical'); };
const page = (head, byline = eg.bylineHtml('uscis_medical')) => `<html><head>${head}</head><body><main id="main-content">body${byline}</main></body></html>`;

test('rendered: good page passes', () => {
  const r = checkRendered({ repoRoot: ROOT, distRoot: dist({ 'guide': page(ld(org())) }) });
  assert.equal(r.orgNodes, 1);
  assert.equal(r.bylined, 1);
});

for (const [name, build, re] of [
  ['old umbrella sameAs on the page', () => page(ld({ ...org(), sameAs: ['https://theindustryguides.com/uscis-medical/'] })), /sameAs/],
  ['no parentOrganization', () => { const o = org(); delete o.parentOrganization; return page(ld(o)); }, /parentOrganization/],
  ['description drift', () => page(ld({ ...org(), description: 'Something else entirely, long enough to count.' })), /description/],
  ['content page without byline', () => page(ld(org()), ''), /no editorial byline/],
  ['fabricated Person', () => page(ld(org(), { '@context': 'https://schema.org', '@type': 'WebPage', reviewedBy: { '@type': 'Person', name: 'Dr Invented' } })), /Person "Dr Invented"/],
  ['reviewer byline with empty reviewers.json', () => page(ld(org()), '\n    <p class="page-byline" data-page-byline="reviewed">Reviewed by Dr Invented, MD · <a href="/editorial-policy/">How we verify</a></p>'), /names a reviewer/],
  ['zero Organization nodes', () => page(''), /zero Organization nodes/],
]) {
  test(`rendered: ${name} fails`, () => {
    process.env.PAGE_SET_FILE = PS;
    // A second, correct page keeps the zero-item guards from masking the defect.
    const pages = name === 'zero Organization nodes' ? { guide: build() } : { guide: build(), ok: page(ld(org())) };
    assert.throws(() => checkRendered({ repoRoot: ROOT, distRoot: dist(pages) }), re);
  });
}

// The watch, with a fake network.
const fakeFetch = (map) => async (url) => {
  const v = map[url];
  if (v instanceof Error) throw v;
  return v || { status: 404, body: '' };
};
const base = () => ({ name: 'X Guides', url: 'https://x.example/', sameAs: [], profiles_pending: [], watch_log: [] });

test('watch: dead sameAs is removed and logged', async () => {
  const e = { ...base(), sameAs: ['https://www.facebook.com/xguides', 'https://www.youtube.com/@xguides'] };
  const r = await watchEntity('k', e, 'x.example', fakeFetch({ 'https://www.youtube.com/@xguides': { status: 200, body: 'see x.example' } }), '2026-10-30');
  assert.deepEqual(r.entity.sameAs, ['https://www.youtube.com/@xguides']);
  assert.equal(r.entity.watch_log[0].action, 'removed_from_sameAs');
  assert.ok(r.findings.some((f) => f.state === 'DEAD'));
  assert.ok(r.findings.some((f) => f.state === 'LINKED_BACK'));
});

test('watch: missing link-back is a named stop naming the field', async () => {
  const e = { ...base(), sameAs: ['https://www.facebook.com/xguides'] };
  const r = await watchEntity('k', e, 'x.example', fakeFetch({ 'https://www.facebook.com/xguides': { status: 200, body: 'no site here' } }));
  const f = r.findings.find((x) => x.state === 'NO_LINK_BACK');
  assert.ok(f && f.stop && /Edit Page info > Website/.test(f.detail));
  assert.equal(r.changed, false);
});

test('watch: JS-rendered profile is UNVERIFIABLE, never a pass', async () => {
  const e = { ...base(), sameAs: ['https://www.instagram.com/xguides/'] };
  const r = await watchEntity('k', e, 'x.example', fakeFetch({ 'https://www.instagram.com/xguides/': { status: 200, body: 'x.example' } }));
  assert.ok(r.findings.some((f) => f.state === 'UNVERIFIABLE'));
  assert.ok(!r.findings.some((f) => f.state === 'LINKED_BACK'));
});

test('watch: pending profile is promoted only when it resolves AND links back', async () => {
  const e = { ...base(), profiles_pending: [{ url: 'https://www.pinterest.com/xguides/' }, { url: 'https://github.com/xguides' }] };
  const r = await watchEntity('k', e, 'x.example', fakeFetch({
    'https://www.pinterest.com/xguides/': { status: 200, body: 'https://x.example/' },
    'https://github.com/xguides': { status: 200, body: 'soft 200, nothing about the site' },
  }));
  assert.deepEqual(r.entity.sameAs, ['https://www.pinterest.com/xguides/']);
  assert.deepEqual(r.entity.profiles_pending, [{ url: 'https://github.com/xguides' }]);
  assert.ok(r.findings.some((f) => f.state === 'PROMOTED'));
});

test('watch: no external profile is a named stop', async () => {
  const r = await watchEntity('k', base(), 'x.example', fakeFetch({}));
  assert.ok(r.findings.some((f) => f.state === 'NO_EXTERNAL_PROFILE' && f.stop));
});

test('watch: zero publications fails', async () => {
  await assert.rejects(runWatch({ keys: [], fetcher: fakeFetch({}) }), /zero publications/);
});

test('watch: shipped data runs over all six publications', async () => {
  const r = await runWatch({ fetcher: fakeFetch({}) });
  assert.equal(r.publications, 6);
  assert.equal(r.findings.filter((f) => f.state === 'NO_EXTERNAL_PROFILE').length, 6);
});

test('byline is stripped from the lastmod content hash', () => {
  const { contentHash } = require('../../scripts/lib/lastmod_ledger.js');
  const bare = '<html><main id="main-content">same body\n  </main></html>';
  const withByline = `<html><main id="main-content">same body${eg.bylineHtml('uscis_medical')}\n  </main></html>`;
  assert.equal(contentHash(withByline), contentHash(bare));
});
