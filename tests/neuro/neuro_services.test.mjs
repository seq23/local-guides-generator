// Fixtures for scripts/validation/neuro_services_contract.js and the neuro
// evaluation-and-therapy split (owner decision, 16 Oct 2026): provider records
// carry two booleans, cards show a service tag, the homepage names both and
// has two primary buttons, and the callback's evaluation / therapy / both
// choice reaches the lead record and the lead email.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ns = require('../../scripts/lib/neuro_services.js');
const homeV2 = require('../../scripts/lib/homepage_v2.js');
const contract = require('../../scripts/validation/neuro_services_contract.js');

test('service tag follows the two booleans', () => {
  assert.equal(ns.serviceTag({ offers_evaluation: true, offers_therapy: false }), 'Evaluation');
  assert.equal(ns.serviceTag({ offers_evaluation: false, offers_therapy: true }), 'Therapy');
  assert.equal(ns.serviceTag({ offers_evaluation: true, offers_therapy: true }), 'Evaluation and therapy');
  assert.equal(ns.serviceTag({ offers_evaluation: false, offers_therapy: false }), '');
  assert.equal(ns.serviceTag({ offers_therapy: true }), 'Therapy', 'a missing boolean is not true');
});

test('a neuro record needs both booleans and at least one true', () => {
  assert.equal(ns.recordProblem({ name: 'X', offers_evaluation: true, offers_therapy: false }), '');
  assert.match(ns.recordProblem({ name: 'X', offers_therapy: true }), /offers_evaluation/);
  assert.match(ns.recordProblem({ name: 'X', offers_evaluation: true }), /offers_therapy/);
  assert.match(ns.recordProblem({ name: 'X', offers_evaluation: 'yes', offers_therapy: true }), /offers_evaluation/);
  assert.match(ns.recordProblem({ name: 'X', offers_evaluation: false, offers_therapy: false }), /neither/);
});

test('every neuro provider record in the repo is well formed', () => {
  const dir = path.join(ROOT, 'data', 'example_providers', 'neuro');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'no neuro provider files: this test would prove nothing');
  let n = 0;
  for (const f of files) {
    for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      assert.equal(ns.recordProblem(p), '', `${f}: ${p && p.name}`);
      n += 1;
    }
  }
  assert.ok(n >= 300, `expected the full neuro dataset, read ${n} records`);
});

test('the coverage runtime contract rejects a neuro record missing offers_evaluation', () => {
  // Proven against the real contract: copy the repo's data into a temp tree,
  // strip one boolean, and the contract must exit non-zero naming the flags.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'neuro-rt-'));
  for (const rel of ['scripts/validation/coverage_runtime_support_contract.js', 'scripts/lib/neuro_services.js']) {
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel));
  }
  fs.cpSync(path.join(ROOT, 'data'), path.join(tmp, 'data'), { recursive: true });
  const cp = require('node:child_process');
  const ok = cp.spawnSync(process.execPath, [path.join(tmp, 'scripts/validation/coverage_runtime_support_contract.js')], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const f = path.join(tmp, 'data/example_providers/neuro/boston-ma__adhd_eval.json');
  const rows = JSON.parse(fs.readFileSync(f, 'utf8'));
  delete rows[0].offers_evaluation;
  fs.writeFileSync(f, JSON.stringify(rows));
  const bad = cp.spawnSync(process.execPath, [path.join(tmp, 'scripts/validation/coverage_runtime_support_contract.js')], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /offers_evaluation and offers_therapy/);
  rows[0].offers_evaluation = false; rows[0].offers_therapy = false;
  fs.writeFileSync(f, JSON.stringify(rows));
  const neither = cp.spawnSync(process.execPath, [path.join(tmp, 'scripts/validation/coverage_runtime_support_contract.js')], { encoding: 'utf8' });
  assert.notEqual(neither.status, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// --- Homepage ---------------------------------------------------------------

function renderHome(verticalKey) {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/page_sets/examples', verticalKey + '_v1.json'), 'utf8'));
  const dir = path.join(ROOT, pack.globalPagesDir);
  const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const home = pages.find((p) => p.route === '/');
  const guides = pages.filter((g) => /^\/guides\/.+/.test(String(g.route || ''))).map((g) => ({ route: g.route, title: g.title }));
  const label = verticalKey === 'neuro' ? ns.NEURO_PROVIDER_TYPE : 'Dentist (Cosmetic, Implant, or General Care)';
  const main = homeV2.render({
    verticalKey, brandName: 'Fixture Guides', homeMainHtml: home.main_html,
    faqItems: pack.faq.global.slice(0, 12), guides,
    states: [{ abbr: 'MA', name: 'Massachusetts' }], topStates: [],
    providerCards: [{ name: 'Fixture Clinic', category: 'ADHD provider', city: 'Boston', state: 'MA', serviceTag: verticalKey === 'neuro' ? 'Evaluation and therapy' : '' }],
    rankedLinks: [], providerTypeLabel: label, providerTypeOptions: [label], verticalParam: verticalKey, buildIso: '2026-10-16T00:00:00.000Z'
  });
  return `<html><head><title>${home.meta_title}</title><meta name="description" content="${home.meta_description}" /></head><body><main>${main}</main></body></html>`;
}

test('the neuro homepage names evaluation and therapy, with two primary buttons to the finder', () => {
  const html = renderHome('neuro');
  assert.deepEqual(contract.checkNeuroHomepage(html), []);
  assert.match(html, /data-home-hero-cta="true">Find an evaluator<\/a>/);
  assert.match(html, /data-home-hero-cta="true">Find ADHD or autism therapy<\/a>/);
  assert.match(html, /data-provider-service-tag="Evaluation and therapy"/);
  for (const q of ['Do I need a diagnosis to start ADHD therapy?', 'Does insurance cover ADHD therapy?', 'Therapy, coaching or medication: which comes first for ADHD?']) {
    assert.ok(html.includes('<h3>' + q.replace(/,/g, ',') + '</h3>'), `therapy question missing from the homepage: ${q}`);
  }
});

test('the evaluation-only homepage fails the neuro check', () => {
  const html = renderHome('neuro');
  const old = html
    .replace(/<h1>[^<]*<\/h1>/, '<h1>Getting an evaluation: which kind you need, who can do it, what it costs, and how long you will wait.</h1>')
    .replace(/<a class="hp-btn hp-btn--primary" href="#states" data-home-hero-cta="true">Find ADHD or autism therapy<\/a>/, '');
  const problems = contract.checkNeuroHomepage(old);
  assert.ok(problems.some((p) => /H1 does not name/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /no therapy button/.test(p)), problems.join('\n'));
  const toCallback = html.replace('href="#states" data-home-hero-cta="true">Find an evaluator', 'href="#match" data-home-hero-cta="true">Find an evaluator');
  assert.ok(contract.checkNeuroHomepage(toCallback).some((p) => /not the state and city finder/.test(p)));
  const noChoice = html.replace(/<label data-neuro-service-field="true">[\s\S]*?<\/label>/, '');
  assert.ok(contract.checkNeuroHomepage(noChoice).some((p) => /first field is not/.test(p)));
  const oldTitle = html.replace(/<title>[^<]*<\/title>/, '<title>Neuro Evaluation Guides: ADHD, Autism and Neuropsych Testing</title>');
  assert.ok(contract.checkNeuroHomepage(oldTitle).some((p) => /<title>/.test(p)));
});

test('other sites keep one hero button to the callback band and no service choice', () => {
  const html = renderHome('dentistry');
  const hero = html.match(/<section class="hero" data-home-hero="true">[\s\S]*?<\/section>/)[0];
  assert.equal((hero.match(/data-home-hero-cta="true"/g) || []).length, 1);
  assert.match(hero, /href="#match" data-home-hero-cta="true"/);
  assert.ok(!html.includes('service_needed'));
  assert.ok(!html.includes('data-provider-service-tag'));
});

// --- Request page and for-providers ----------------------------------------

const sharedRequestPage = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/global_pages/request-assistance.json'), 'utf8')).main_html;

test('the neuro request page asks evaluation / therapy / both first', () => {
  const neuro = ns.applyToRequestAssistanceHtml(sharedRequestPage);
  assert.deepEqual(contract.checkNeuroRequestPage(neuro), []);
  assert.ok(contract.checkNeuroRequestPage(sharedRequestPage).length > 0, 'the unchanged shared page must fail the neuro check');
});

test('the neuro for-providers page welcomes both kinds of practice', () => {
  const shared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/global_pages/for-providers.json'), 'utf8')).main_html;
  const neuro = ns.applyToForProvidersHtml(shared);
  assert.deepEqual(contract.checkNeuroForProviders(neuro), []);
  assert.ok(contract.checkNeuroForProviders(shared).length > 0);
  assert.match(neuro, /Services%20%28evaluation%2C%20therapy%2C%20or%20both%29/);
});

// --- Lead endpoint ----------------------------------------------------------

const fnSrc = fs.readFileSync(path.join(ROOT, 'functions/api/request-assistance.js'), 'utf8');

test('the endpoint and the build agree on the neuro label and the choices', () => {
  assert.ok(fnSrc.includes(`const NEURO_PROVIDER_TYPE = '${ns.NEURO_PROVIDER_TYPE}';`));
  const values = fnSrc.match(/const SERVICE_NEEDED_VALUES = new Set\(\[([^\]]*)\]\)/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(values, ns.SERVICE_CHOICES.map(([v]) => v));
  assert.ok(fnSrc.includes(`'${ns.NEURO_PROVIDER_TYPE}',`), 'the new label is not in ALLOWED_PROVIDER_TYPES');
  assert.ok(fnSrc.includes(`'${ns.LEGACY_NEURO_PROVIDER_TYPE}',`), 'the old label must stay accepted');
});

async function loadEndpoint() {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'neuro-fn-')), 'request-assistance.mjs');
  fs.writeFileSync(tmp, fnSrc);
  return import(pathToFileURL(tmp).href);
}

async function post(mod, body) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (String(url).includes('airtable')) return new Response(JSON.stringify({ records: [{ id: 'rec1' }] }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  try {
    const req = new Request('https://neuroevalguides.com/api/request-assistance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const res = await mod.onRequestPost({ request: req, env: { AIRTABLE_BASE_ID: 'app', AIRTABLE_TABLE_NAME: 'Leads', AIRTABLE_API_TOKEN: 't', RESEND_API_KEY: 'r', LEAD_TO: 'leads@example.com' } });
    return { status: res.status, json: await res.json(), calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const base = { email: 'parent@example.com', consent: 'on', vertical_key: 'neuro', market_slug: 'boston-ma' };

test('the callback service choice reaches the lead record and the lead email', async () => {
  const mod = await loadEndpoint();
  const r = await post(mod, { ...base, provider_type: ns.NEURO_PROVIDER_TYPE, service_needed: 'therapy' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const airtable = r.calls.find((c) => c.url.includes('airtable'));
  assert.equal(airtable.body.records[0].fields.service_needed, 'therapy');
  const mail = r.calls.find((c) => c.url.includes('resend'));
  assert.match(mail.body.subject, /\(therapy\)/);
  assert.match(mail.body.text, /service_needed: therapy/);
});

test('the endpoint refuses a neuro lead without the choice, or with a made-up one', async () => {
  const mod = await loadEndpoint();
  const missing = await post(mod, { ...base, provider_type: ns.NEURO_PROVIDER_TYPE });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.error, 'service_needed');
  assert.equal(missing.calls.length, 0);
  const bogus = await post(mod, { ...base, provider_type: ns.NEURO_PROVIDER_TYPE, service_needed: 'surgery' });
  assert.equal(bogus.status, 400);
  const legacy = await post(mod, { ...base, provider_type: ns.LEGACY_NEURO_PROVIDER_TYPE });
  assert.equal(legacy.status, 200, 'the old label from other sites stays accepted');
  assert.ok(!('service_needed' in legacy.calls.find((c) => c.url.includes('airtable')).body.records[0].fields), 'no empty column sent when nothing was asked');
});

// ── Therapy practices (16 Oct 2026): therapy-only practices per metro ────────
const goodTherapy = () => ({
  name: 'Example ABA', offers_evaluation: false, offers_therapy: true, therapy_focus: 'autism',
  evidence_url: 'https://example.org/locations/city', evidence_note: 'ABA therapy; no diagnostic evaluations listed.', evidence_checked: '2026-10-16'
});

test('a therapy record without an evidence URL is rejected', () => {
  assert.equal(ns.therapyRecordProblem(goodTherapy()), '');
  for (const bad of [undefined, '', '   ', 'example.org/x', 'http://example.org/x', 'https://localhost/x', 'not a url']) {
    const r = goodTherapy();
    if (bad === undefined) delete r.evidence_url; else r.evidence_url = bad;
    assert.notEqual(ns.therapyRecordProblem(r), '', `evidence_url ${JSON.stringify(bad)} was accepted`);
  }
  assert.match(ns.therapyListProblem([{ ...goodTherapy(), evidence_url: '' }]), /evidence_url/);
});

test('a therapy record must offer therapy, carry provenance, and no ratings', () => {
  assert.match(ns.therapyRecordProblem({ ...goodTherapy(), offers_therapy: false, offers_evaluation: true }), /offers_therapy/);
  assert.match(ns.therapyRecordProblem({ ...goodTherapy(), therapy_focus: 'speech' }), /therapy_focus/);
  assert.match(ns.therapyRecordProblem({ ...goodTherapy(), evidence_note: '' }), /evidence_note/);
  assert.match(ns.therapyRecordProblem({ ...goodTherapy(), evidence_checked: 'today' }), /evidence_checked/);
  assert.match(ns.therapyRecordProblem({ ...goodTherapy(), rating: 4.9 }), /rating/);
  assert.match(ns.therapyListProblem([]), /1 to 3/);
  assert.match(ns.therapyListProblem([goodTherapy(), goodTherapy()]), /duplicate/);
  assert.match(ns.therapyListProblem([{ ...goodTherapy(), name: 'Zed' }, { ...goodTherapy(), name: 'Abe' }]), /alphabetized/);
});

test('every neuro therapy dataset in the repo passes, and coverage meets the floor', () => {
  const dir = path.join(ROOT, 'data', 'example_providers', 'neuro');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('__therapy.json'));
  assert.ok(files.length >= ns.THERAPY_MIN_METROS, `only ${files.length} metros with therapy practices (floor ${ns.THERAPY_MIN_METROS})`);
  let therapyOnly = 0;
  for (const f of files) {
    const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    assert.equal(ns.therapyListProblem(list), '', f);
    if (list.some((r) => ns.serviceTag(r) === ns.TAG_THERAPY)) therapyOnly += 1;
  }
  assert.ok(therapyOnly >= ns.THERAPY_MIN_METROS, `only ${therapyOnly} metros with a therapy-only practice`);
});

test('a built neuro metro with therapy data renders at least one "Therapy" tag', () => {
  const dist = path.join(ROOT, 'dist');
  const dir = path.join(ROOT, 'data', 'example_providers', 'neuro');
  const slug = 'chicago-il';
  const records = JSON.parse(fs.readFileSync(path.join(dir, `${slug}__therapy.json`), 'utf8'));
  // Rendered from the real section renderer's shape, so the check is exercised
  // even without a dist build; the built page is checked too when present.
  const card = (r) => '<article class="provider-card" data-provider-card="true"><h3 class="provider-card__name">' + r.name + '</h3>' + ns.serviceTagHtml(ns.serviceTag(r)) + '</article>';
  const page = ns.addTherapyJumpToHero('<main><section class="hero"><h1>Chicago</h1></section>' +
    '<section class="section" data-provider-directory="true" id="therapy-practices" data-neuro-therapy-practices="true"><h2>Therapy practices</h2>' + records.map(card).join('') + '</section></main>', 'Chicago, IL');
  assert.deepEqual(ns.cityTherapyProblems(page, records), []);
  // Negative: tag flipped to evaluation, block missing, hero link missing.
  assert.match(ns.cityTherapyProblems(page.split('data-provider-service-tag="Therapy">Therapy').join('data-provider-service-tag="Evaluation">Evaluation'), records).join(' '), /Therapy/);
  assert.match(ns.cityTherapyProblems(page.replace(/<section class="section" data-provider-directory[\s\S]*<\/section>/, ''), records).join(' '), /no therapy practices block/);
  assert.match(ns.cityTherapyProblems(page.replace(/<p class="hero-therapy-jump"[\s\S]*?<\/p>/, ''), records).join(' '), /#therapy-practices/);
  const built = path.join(dist, slug, 'index.html');
  if (fs.existsSync(built) && /neuro/i.test(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'))) {
    const html = fs.readFileSync(built, 'utf8');
    assert.deepEqual(ns.cityTherapyProblems(html, records), []);
    assert.ok(/data-neuro-therapy-practices="true"[\s\S]*data-provider-service-tag="Therapy"/.test(html), 'built page has no "Therapy" tag in its therapy block');
  }
});
