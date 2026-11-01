// The canonical search loop (scripts/search_loop/canonical_loop.mjs): behaviour, not wording.
// Runs against the engine checked out at .search-loop-engine (SEARCH_LOOP_ENGINE_DIR); the
// validate workflow checks it out at v1 before this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = process.cwd();
const ENGINE_DIR = process.env.SEARCH_LOOP_ENGINE_DIR || path.join(REPO, '.search-loop-engine');
if (!fs.existsSync(path.join(ENGINE_DIR, 'src', 'check.mjs'))) {
  throw new Error(`NAMED STOP [ENGINE_MISSING] check out seq23/search-loop@v1 at ${ENGINE_DIR} (or set SEARCH_LOOP_ENGINE_DIR) before this test`);
}

// A throwaway root with only what the loop reads, so nothing in the repo is written.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-loop-'));
for (const rel of ['search-loop.config.json', 'data/contracts/velocity_vertical_aliases.json', 'data/cadence/policy.json', 'scripts/validation/pi_trust_tone_contract.js', 'scripts/validation/vertical_guide_depth_contract.js']) {
  fs.mkdirSync(path.dirname(path.join(TMP, rel)), { recursive: true });
  fs.copyFileSync(path.join(REPO, rel), path.join(TMP, rel));
}
const PI_DIR = 'data/page_sets/examples/pi_global_pages';
fs.mkdirSync(path.join(TMP, PI_DIR), { recursive: true });
fs.writeFileSync(path.join(TMP, PI_DIR, 'brain-injury.json'), JSON.stringify({ route: '/guides/brain-injury/', title: 'Brain Injury Claims and Records', main_html: '<p>brain injury claims records timeline</p>' }));
process.env.SEARCH_LOOP_ROOT = TMP;
process.env.SEARCH_LOOP_ENGINE_DIR = ENGINE_DIR;

const L = await import(path.join(REPO, 'scripts/search_loop/canonical_loop.mjs'));
const E = await L.loadEngine(ENGINE_DIR);
const RAW = JSON.parse(fs.readFileSync(path.join(TMP, 'search-loop.config.json'), 'utf8'));
const { sites, problems } = L.siteConfigs(E, RAW, TMP);
const PI = sites.find((s) => s.site === 'theaccidentguides.com');

const para = (n, w = 'claim') => Array.from({ length: n }, (_, i) => `${w}${i % 7} step`).join(' ');
function goodDraft(query, extra = {}) {
  return {
    title: 'What a Police Report Means for Your Accident Claim',
    meta_title: 'What a police report means for a claim',
    meta_description: 'How a police report fits into an accident claim, how to request one, what to check in it and what to do when it contains a mistake.',
    answer: `A police report is ${para(50, 'record').split(' ').slice(0, 46).join(' ')}.`,
    context: 'Short context.',
    sections: Array.from({ length: 8 }, (_, i) => ({ id: ['when-to-call', 'cost', 'evidence', 'questions', 'red-flags'][i] || '', heading: `Question ${i + 1} about the report?`, paragraphs: [`Act early, keep records and avoid pressure. ${para(80, `s${i}a`)}`, para(80, `s${i}b`)] })),
    checklist: ['Request the report', 'Check names', 'Check the diagram', 'Note errors', 'Keep a copy'],
    faq: [1, 2, 3, 4].map((i) => ({ q: `Question ${i}?`, a: para(24, `faq${i}`) })),
    next_step: 'Keep the report with your records.',
    sources: [{ url: 'https://www.nhtsa.gov/a', title: 'NHTSA', supports: 'x' }, { url: 'https://www.usa.gov/b', title: 'USA.gov', supports: 'y' }, { url: 'https://example.com/c', title: 'not an authority' }],
    ...extra,
  };
}
const okFetch = async (url) => ({ status: 200, ok: true, headers: { get: () => null }, text: async () => 'x'.repeat(800) });

test('every canonical site config passes the engine\'s own config check, and new pages are missing guides only', () => {
  assert.deepEqual(problems, []);
  assert.equal(sites.length, 6);
  assert.equal(RAW.new_pages, 'missing_guides_only');
  const bad = L.siteConfigs(E, { ...RAW, new_pages: 'daily' }, TMP);
  assert.ok(bad.problems.some((p) => /missing_guides_only/.test(p)));
});

test('the velocity list is read in any of its accepted shapes and mapped to the right site', () => {
  for (const payload of [[{ query: 'police report after a crash', vertical: 'personal_injury' }], { items: [{ topic: 'police report after a crash', site: 'theaccidentguides.com' }] }, { missing: ['police report after a crash'] }]) {
    const list = L.parseMissingList(payload);
    assert.equal(list.length, 1);
    assert.equal(list[0].query, 'police report after a crash');
  }
  assert.equal(L.siteFor({ query: 'x', vertical: 'personal_injury' }, sites).site, 'theaccidentguides.com');
  assert.equal(L.siteFor({ query: 'x', site: 'https://uscisexam.com/' }, sites).site, 'uscisexam.com');
});

test('a topic a canonical guide already serves is not rebuilt', () => {
  const guides = L.guidesIn(PI_DIR);
  assert.ok(L.coveredBy(E, 'brain injury claims records', guides));
  assert.equal(L.coveredBy(E, 'police report after a crash', guides), null);
});

test('the gate passes a full sourced guide and refuses thin, unsourced and PI-superlative drafts', () => {
  const site = { ...PI, min_words: 1200, min_verified_sources: 2 };
  const d = goodDraft('police report after a crash');
  d.sources.forEach((s, i) => { s.verified = i < 2; });
  d.main_html = L.renderGuide(PI, d);
  assert.deepEqual(L.gateGuide(E, d, { site, existing: [] }), []);
  assert.match(d.main_html, /Educational only\. Not legal advice\. No endorsements or rankings\./);
  for (const id of ['definition', 'when-to-call', 'cost', 'evidence', 'questions', 'red-flags', 'next-steps']) assert.ok(d.main_html.includes(`id="${id}"`), `renders #${id}`);
  const noShape = { ...d, sections: d.sections.map((x) => ({ ...x, id: '' })) }; noShape.main_html = L.renderGuide(PI, noShape);
  assert.ok(L.gateGuide(E, noShape, { site, existing: [] }).some((p) => /missing #when-to-call/.test(p)), 'a guide without the vertical\'s sections is refused');
  assert.equal(L.fullTitle(PI, 'Police reports | The Accident Guides'), 'Police reports | The Accident Guides');

  const thin = { ...d, sections: d.sections.slice(0, 2) }; thin.main_html = L.renderGuide(PI, thin);
  assert.ok(L.gateGuide(E, thin, { site, existing: [] }).some((p) => /sections|words/.test(p)));
  const unsourced = { ...d, sources: d.sources.map((s) => ({ ...s, verified: false })) };
  assert.ok(L.gateGuide(E, unsourced, { site, existing: [] }).some((p) => /verified sources/.test(p)));
  const sup = { ...d, faq: [...d.faq.slice(0, 3), { q: 'Who is the best personal injury lawyer?', a: para(40) }] };
  assert.ok(L.gateGuide(E, sup, { site, existing: [] }).some((p) => /superlative/.test(p)));
  const stat = { ...d, faq: [...d.faq.slice(0, 3), { q: 'How often?', a: `Studies show 70% of claims ${para(36)}` }] };
  assert.ok(L.gateGuide(E, stat, { site, existing: [] }).some((p) => /statistic/.test(p)));
  assert.ok(L.gateGuide(E, d, { site, existing: [{ route: '/guides/x/', text: d.main_html.replace(/<[^>]+>/g, ' ') + ' ' + d.faq.map((f) => `${f.q} ${f.a}`).join(' ') }] }).some((p) => /near-duplicate/.test(p)));
});

test('a listed missing guide is written as a page-set guide and recorded; the weekly cadence cap holds the rest', async () => {
  process.env.MISSING_GUIDES_FILE = path.join(TMP, 'missing.json');
  const topics = Array.from({ length: 8 }, (_, i) => `police report question number ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][i]} after a crash`);
  fs.writeFileSync(process.env.MISSING_GUIDES_FILE, JSON.stringify({ items: [...topics.map((q) => ({ query: q, vertical: 'personal_injury' })), { query: 'brain injury claims records', vertical: 'personal_injury' }] }));
  let n = 0;
  const chatImpl = async (messages) => {
    const q = messages[1].content.match(/answering: "([^"]+)"/)[1];
    n++;
    const d = goodDraft(q);
    d.sections = d.sections.map((s, i) => ({ ...s, paragraphs: [`Act early, keep records and avoid pressure. ${para(80, `u${n}x${i}a`)}`, para(80, `u${n}x${i}b`)] }));
    d.faq = d.faq.map((f, i) => ({ ...f, a: para(24, `u${n}f${i}`) }));
    return { ok: true, text: JSON.stringify(d) };
  };
  const notes = [];
  const r = await L.missingGuides(E, sites, RAW, { mode: 'normal', notes, publish: false, fetchImpl: okFetch, chatImpl });
  const cap = JSON.parse(fs.readFileSync(path.join(TMP, 'data/cadence/policy.json'), 'utf8')).new_pages_per_week;
  assert.equal(r.covered, 1, 'the topic an existing guide serves is skipped');
  assert.equal(r.built, Math.min(cap, 8));
  assert.equal(r.held, 8 - r.built);
  const file = path.join(TMP, r.written[0]);
  const page = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.match(page.route, /^\/guides\/police-report-question-number-one-after-a-crash\/$/);
  assert.ok(page.search_strengthening.faq.length >= 3);
  assert.ok(!/example\.com/.test(page.main_html), 'a source outside public authorities is not cited');
  const book = JSON.parse(fs.readFileSync(path.join(TMP, 'data/search-loop/theaccidentguides.com/pages.json'), 'utf8'));
  assert.equal(book.pages.filter((p) => p.source === 'missing-guide').length, r.built);
  // The next run inside the same week builds nothing more: the cap counts what is already built.
  const again = await L.missingGuides(E, sites, RAW, { mode: 'normal', notes: [], publish: false, fetchImpl: okFetch, chatImpl });
  assert.equal(again.built, 0);
  // Off builds nothing at all.
  const off = await L.missingGuides(E, sites, RAW, { mode: 'off', notes: [], publish: false, fetchImpl: okFetch, chatImpl });
  assert.equal(off.built, 0);
  delete process.env.MISSING_GUIDES_FILE;
});

test('a draft that fails the gate twice is dropped and not retried inside 28 days', async () => {
  process.env.MISSING_GUIDES_FILE = path.join(TMP, 'missing2.json');
  fs.writeFileSync(process.env.MISSING_GUIDES_FILE, JSON.stringify([{ query: 'uscis vaccine waiver questions', site: 'uscisexam.com' }]));
  const chatImpl = async () => ({ ok: true, text: JSON.stringify(goodDraft('x', { sections: [] })) });
  const r = await L.missingGuides(E, sites, RAW, { mode: 'normal', notes: [], publish: false, fetchImpl: okFetch, chatImpl });
  assert.equal(r.dropped, 1);
  const again = await L.missingGuides(E, sites, RAW, { mode: 'normal', notes: [], publish: false, fetchImpl: okFetch, chatImpl: async () => { throw new Error('must not draft a dropped topic again'); } });
  assert.equal(again.dropped, 0);
  delete process.env.MISSING_GUIDES_FILE;
});

test('the weekly report for every site passes the engine\'s search-loop-week-v1 check', () => {
  const out = path.join(TMP, 'reports');
  const files = L.reports(E, sites, { mode: 'normal', notes: ['x'], did: { check: { per_site: {} } }, out });
  assert.equal(files.length, 6);
  for (const f of files) assert.deepEqual(E.report.checkReport(JSON.parse(fs.readFileSync(f, 'utf8'))), []);
});

test('strengthening is refused when the title does not match the search or PI wording slips in', () => {
  const page = { title: 'Brain Injury Claims and Records', route: '/guides/brain-injury/' };
  const ok = { query: 'brain injury claims records', definition: para(22), faq: [{ q: 'a?', a: para(22) }, { q: 'b?', a: para(22) }] };
  assert.deepEqual(L.gateStrengthening(E, PI, page, ok), []);
  assert.ok(L.gateStrengthening(E, PI, page, { ...ok, query: 'car accident settlement' }).some((p) => /not aligned/.test(p)));
  assert.ok(L.gateStrengthening(E, PI, page, { ...ok, faq: [...ok.faq, { q: 'Who are the best brain injury lawyers?', a: para(40) }] }).some((p) => /superlative/.test(p)));
});

test('a free-model outage defers the topic to the next run; it is not dropped', async () => {
  process.env.MISSING_GUIDES_FILE = path.join(TMP, 'missing3.json');
  fs.writeFileSync(process.env.MISSING_GUIDES_FILE, JSON.stringify([{ query: 'dentures versus implants for one missing tooth', site: 'dentistryguides.com' }]));
  const notes = [];
  const r = await L.missingGuides(E, sites, RAW, { mode: 'normal', notes, publish: false, fetchImpl: okFetch, chatImpl: async () => ({ ok: false, reason: 'no free model answered' }) });
  assert.equal(r.dropped, 0);
  assert.equal(r.deferred, 1);
  assert.ok(notes.some((n) => /FREE_MODEL_UNAVAILABLE/.test(n)));
  const state = JSON.parse(fs.readFileSync(path.join(TMP, 'data/search-loop/dentistryguides.com/missing-guides.json'), 'utf8'));
  assert.equal(state.dropped.length, 0);
  delete process.env.MISSING_GUIDES_FILE;
});

test('a download action keeps the lead health probe on its separate form page', async () => {
  const senior = sites.find((s) => s.vertical === 'senior-living');
  const fixture = { ...senior, site: 'fixture-download.example', base_url: 'https://fixture-download.example',
    action: { label: 'Download', url: 'https://fixture-download.example/resources/binders/' },
    lead: { ...senior.lead, page_url: 'https://fixture-download.example/request-assistance/' },
    ledger_dir: 'data/search-loop/fixture-download.example' };
  const seen = [];
  const fetchImpl = async (url, options = {}) => {
    seen.push(String(url));
    const api = options.method === 'POST';
    return { status: api ? 400 : 200, ok: !api, headers: { get: () => null },
      text: async () => api ? '{}' : `<form ${senior.lead.form_marker}></form>` };
  };
  const r = await L.checkRepair(E, [fixture], { mode: 'normal', notes: [], fetchImpl });
  assert.equal(r.lead_paths_ok, 1);
  assert.ok(seen.includes(fixture.lead.page_url));
  assert.ok(!seen.includes(fixture.action.url));
});
