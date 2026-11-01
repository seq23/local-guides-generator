import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { makeD1 } from './harness.mjs';
import { handleBinderDownload, sourcePage } from '../../lib/senior/binders.mjs';
import { handleFunnel } from '../../lib/senior/funnel.mjs';
const require = createRequire(import.meta.url);
const B = require('../../scripts/lib/senior_binders');
const ROOT = new URL('../../', import.meta.url).pathname;
const NOW = '2026-11-01T12:00:00.000Z';
const PDF = fs.readFileSync(path.join(ROOT, 'assets/binders/parent-binder.pdf'));
function context(query = '?binder=parent&from=%2Fguides%2Ffixture%2F', options = {}) {
  return {
    request: new Request('https://memphisseniorcarehomes.com/api/senior-binder-download' + query, options),
    env: { SENIOR_DB: makeD1(), ASSETS: { fetch: async (r) => new Response(r.method === 'HEAD' ? null : PDF, { headers: { 'content-type': 'application/pdf' } }) } }
  };
}

test('canonical worksheets generate deterministic, valid PDF objects and one printable sheet per page', () => {
  const doc = B.load();
  B.verifyPdfs();
  for (const [i, b] of doc.binders.entries()) {
    const pdf = B.pdfs(doc)[i].bytes.toString();
    assert.equal(pdf, B.makePdf(b, doc.disclaimer).toString());
    assert.ok(pdf.startsWith('%PDF-1.4'));
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, b.sheets.length);
    const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
    assert.equal(pdf.slice(xref, xref + 4), 'xref');
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
    offsets.forEach((n, i) => assert.ok(pdf.slice(n).startsWith(`${i + 1} 0 obj`)));
    const html = B.printable(b.id, doc);
    assert.equal((html.match(/data-binder-sheet=/g) || []).length, b.sheets.length);
    assert.doesNotMatch(html, /<input|<form|clarity-loader/);
    assert.match(html, /data-binder-print/);
    const link = html.match(/data-binder-download="([^"]+)" href="([^"]+)"/);
    assert.equal(link[1], b.id);
    assert.equal(new URL(link[2].replaceAll('&amp;', '&'), 'https://example.org').searchParams.get('binder'), b.id);
  }
});

test('generation refuses an overflowing final worksheet before overwriting either PDF', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'binder-prewrite-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const f of ['scripts/lib/senior_binders.js', 'scripts/generate_binders.js', 'data/binders/binders.json', 'assets/binders/parent-binder.pdf', 'assets/binders/move-in-binder.pdf']) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(root, f));
  }
  const doc = B.load();
  doc.binders[1].sheets.at(-1).blocks.push({ type: 'table', columns: ['A', 'B'], rows: 100 });
  fs.writeFileSync(path.join(root, 'data/binders/binders.json'), JSON.stringify(doc));
  const before = doc.binders.map((b) => fs.readFileSync(path.join(root, `assets/binders/${b.id}-binder.pdf`)));
  const r = spawnSync(process.execPath, ['scripts/generate_binders.js'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  doc.binders.forEach((b, i) => assert.deepEqual(fs.readFileSync(path.join(root, `assets/binders/${b.id}-binder.pdf`)), before[i]));
  // An edited static asset also fails the pre-build consistency check.
  fs.copyFileSync(path.join(ROOT, 'data/binders/binders.json'), path.join(root, 'data/binders/binders.json'));
  fs.appendFileSync(path.join(root, 'assets/binders/parent-binder.pdf'), 'changed');
  assert.notEqual(spawnSync(process.execPath, ['scripts/generate_binders.js', '--check'], { cwd: root }).status, 0);
});

test('both PDF downloads record the named event and public source path, and protected readback aggregates them', async () => {
  const c = context();
  c.env.SENIOR_TICK_TOKEN = 'fixture-read-token';
  for (const id of ['parent', 'parent', 'move-in']) {
    c.request = new Request(`https://memphisseniorcarehomes.com/api/senior-binder-download?binder=${id}&from=%2Fguides%2Ffixture%2F%3Femail%3Dprivate%40example.org%23secret`);
    const r = await handleBinderDownload(c, { now: () => NOW });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('X-Binder-Counted'), '1');
    assert.match(r.headers.get('cache-control'), /no-store/);
    assert.equal(r.headers.get('content-disposition'), `attachment; filename="${id}-binder.pdf"`);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), PDF);
  }
  const rows = c.env.SENIOR_DB.q('SELECT event, detail FROM seat_events');
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.equal(r.event, 'binder_download');
    assert.deepEqual(Object.keys(JSON.parse(r.detail)).sort(), ['binder_id', 'source_page']);
    assert.equal(JSON.parse(r.detail).source_page, '/guides/fixture/');
  }
  c.request = new Request('https://example.org/api/senior-funnel?days=42');
  assert.equal((await handleFunnel(c, {})).status, 401);
  c.request = new Request('https://example.org/api/senior-funnel?days=42', { headers: { 'x-senior-tick-token': 'fixture-read-token' } });
  const result = await (await handleFunnel(c, { now: () => NOW })).json();
  assert.deepEqual(result.binder_downloads, [
    { binder_id: 'parent', source_page: '/guides/fixture/', downloads: 2 },
    { binder_id: 'move-in', source_page: '/guides/fixture/', downloads: 1 }
  ]);
});

test('invalid IDs, missing bindings, failed assets, HEAD and prefetch never create download events', async () => {
  for (const id of ['missing', '__proto__', 'constructor', '../parent', '']) {
    const c = context('?binder=' + encodeURIComponent(id));
    assert.equal((await handleBinderDownload(c)).status, 404);
    assert.equal(c.env.SENIOR_DB.q('SELECT * FROM seat_events').length, 0);
  }
  const c = context();
  assert.equal((await handleBinderDownload({ ...c, env: {} })).status, 404);
  for (const options of [{ method: 'HEAD' }, { headers: { purpose: 'prefetch' } }, { headers: { 'sec-purpose': 'prefetch;prerender' } }]) {
    const c = context('?binder=parent', options);
    assert.equal((await handleBinderDownload(c)).status, 200);
    assert.equal(c.env.SENIOR_DB.q('SELECT * FROM seat_events').length, 0);
  }
  c.env.ASSETS.fetch = async () => new Response('missing', { status: 404 });
  assert.equal((await handleBinderDownload(c)).status, 503);
  assert.equal(c.env.SENIOR_DB.q('SELECT * FROM seat_events').length, 0);
  assert.equal((await handleBinderDownload(context('?binder=parent', { method: 'POST' }))).status, 405);
});

test('a storage failure preserves the free PDF and reports that it was not counted', async () => {
  const c = context();
  c.env.SENIOR_DB.prepare = () => { throw new Error('fixture storage outage'); };
  const r = await handleBinderDownload(c);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-Binder-Counted'), '0');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), PDF);
});

test('browser download links carry source-page attribution and print opens the browser dialog', () => {
  const a = { href: 'https://example.org/api/senior-binder-download?binder=parent' };
  let printHandler, prints = 0;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets/binders/binders.js'), 'utf8'), {
    URL, URLSearchParams, location: new URL('https://example.org/resources/binders/?from=%2Fguides%2Ffixture%2F'),
    document: { referrer: '', querySelectorAll: () => [a], querySelector: () => ({ addEventListener: (event, fn) => { printHandler = fn; } }) },
    window: { print: () => { prints++; } }
  });
  assert.equal(new URL(a.href).searchParams.get('from'), '/guides/fixture/');
  printHandler(); assert.equal(prints, 1);
  for (const s of ['https://other.example/path/', '//other.example/', '/?email=fixture@example.org', '/resources/binders/?email=fixture@example.org']) {
    assert.ok(!sourcePage(s).includes('@'));
    assert.ok(!sourcePage(s).includes('?'));
  }
});

test('the senior search action, site navigation and printable routes resolve to free binders', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'search-loop.config.json')));
  const s = cfg.sites.find((x) => x.vertical === 'senior-living');
  assert.equal(new URL(s.action.url).pathname, '/resources/binders/');
  assert.equal(new URL(s.lead.page_url).pathname, '/request-assistance/');
  const H = require('../../scripts/lib/homepage_v2');
  for (const home of [true, false]) {
    const header = H.renderHeaderHtml('senior_living', 'Fixture Guides', { home });
    assert.match(header, /class="hp-nav-cta" href="\/resources\/binders\/"/);
  }
  for (const [file, token] of [['binders', '%%SENIOR_BINDERS%%'], ['binders_parent', '%%SENIOR_BINDER_PARENT%%'], ['binders_move-in', '%%SENIOR_BINDER_MOVE_IN%%']]) {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, `data/page_sets/examples/senior_living_global_pages/${file}.json`)));
    assert.ok(p.main_html.includes(token));
  }
  const landing = B.landing();
  assert.equal((landing.match(/data-binder-download=/g) || []).length, 2);
  assert.doesNotMatch(landing, /<form|<input|clarity-loader/);
});

test('PDF selection survives query cleanup without JavaScript while unknown query keys stay removed', () => {
  const { splitQuery } = require('../../scripts/lib/internal_query_policy');
  for (const id of ['parent', 'move-in']) {
    const result = splitQuery('/api/senior-binder-download', `binder=${id}&amp;from=%2Fresources%2Fbinders%2F&amp;secret=fixture`, ROOT);
    const q = new URLSearchParams(result.keep.replaceAll('&amp;', '&'));
    assert.equal(q.get('binder'), id);
    assert.equal(q.get('from'), '/resources/binders/');
    assert.equal(q.get('secret'), null);
    assert.equal(result.carry, 'secret=fixture');
  }
});

test('the senior homepage contract requires the binder destination to exist and rejects the former callback action', (t) => {
  const { run } = require('../../scripts/validation/homepage_sponsorship_parity_contract');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'binder-home-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(path.join(root, 'dist/resources/binders'), { recursive: true });
  const home = '<p data-primary-conversion-cta="true"><a href="/resources/binders/" data-home-hero-cta="true">Download</a></p><section id="match" data-home-callback="true"><form id="senior-intake"></form></section>';
  const siteFile = path.join(root, 'data/site.json');
  const homeFile = path.join(root, 'dist/index.html');
  fs.writeFileSync(siteFile, JSON.stringify({ pageSetFile: 'data/page_sets/examples/senior_living_v1.json' }));
  fs.writeFileSync(homeFile, home);
  fs.writeFileSync(path.join(root, 'dist/resources/binders/index.html'), B.landing());
  assert.doesNotThrow(() => run({ repoRoot: root }));
  fs.writeFileSync(homeFile, home.replace('/resources/binders/', '#match'));
  assert.throws(() => run({ repoRoot: root }));
  fs.writeFileSync(homeFile, home);
  fs.rmSync(path.join(root, 'dist/resources/binders/index.html'));
  assert.throws(() => run({ repoRoot: root }));
  fs.writeFileSync(path.join(root, 'dist/resources/binders/index.html'), B.landing());
  fs.writeFileSync(siteFile, JSON.stringify({ pageSetFile: 'data/page_sets/examples/pi_v1.json' }));
  assert.throws(() => run({ repoRoot: root }));
});

test('senior search-path actions also lead to the binder while other verticals retain their existing paths', () => {
  const { buildFanoutCluster } = require('../../scripts/helpers/fanout');
  const ctx = { pageKind: 'guide-detail', route: '/guides/fixture/', title: 'Fixture guide' };
  const items = (verticalKey) => buildFanoutCluster({ ...ctx, verticalKey }, {}).groups.flatMap((g) => g.items);
  for (const vk of ['senior_living', 'senior-living']) {
    assert.ok(items(vk).some((x) => x.href === '/resources/binders/'));
    assert.ok(!items(vk).some((x) => x.href === '/request-assistance/'));
  }
  assert.ok(items('pi').some((x) => x.href === '/guides/what-to-do-after-an-accident/'));
  assert.ok(!items('pi').some((x) => x.href === '/resources/binders/'));
});
