import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { brandedTitle, clarityEligible } = require('../../scripts/lib/search_readiness_policy');
const PUBLICATIONS = Object.values(require('../../scripts/lib/pack_site_config').PACK_SITE_CONFIG)
  .filter((p) => !p.siteUrl.includes('pages.dev'));

test('all six publications identify themselves; existing branding stays once', () => {
  for (const { siteUrl, brandName: brand } of PUBLICATIONS) {
    const host = new URL(siteUrl).hostname;
    assert.equal(brandedTitle('What to ask', `https://${host}`, brand), `What to ask | ${brand}`);
    assert.equal(brandedTitle(`${brand}: What to ask`, `https://${host}`, brand), `${brand}: What to ask`);
  }
  assert.equal(brandedTitle('Existing title', 'https://local-guides-generator.pages.dev', 'LKG Training Pack'), 'Existing title');
});

test('a contact CTA, fake form or prose about checkout is not a conversion page', () => {
  for (const html of ['<a href="/request-assistance/">Ask</a>', '<!-- <form> -->', '<script>const s="<form>"</script>', '<p>Go to /checkout/</p>']) {
    for (const { siteUrl } of PUBLICATIONS) {
      assert.equal(clarityEligible(html, siteUrl), false);
    }
  }
});

test('real forms and buy links retain recording, including relative and quoted links', () => {
  for (const html of ['<form action="/api/lead">', '<a href="https://brand.gumroad.com/l/guide">Buy</a>', "<a href='/checkout/'>Buy</a>", '<a href=/booking/>Book</a>']) {
    for (const { siteUrl } of PUBLICATIONS) assert.equal(clarityEligible(html, siteUrl), true);
  }
  const { intakeSlotForSite } = require('../../scripts/lib/senior_living');
  const intake = intakeSlotForSite();
  assert.match(intake, /<form\b[^>]*id="senior-intake"/);
  assert.match(intake, /<\/form><script src="\/assets\/senior-intake.js"/);
  assert.equal(clarityEligible(intake, 'https://memphisseniorcarehomes.com'), true);
});

test('the installer removes old blanket tags, preserves real conversion tags, and is idempotent', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-clarity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts/lib', 'data', 'dist']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const file of ['scripts/install_clarity.js', 'scripts/lib/search_readiness_policy.js', 'data/search_title_copy.json']) {
    fs.copyFileSync(new URL(`../../${file}`, import.meta.url), path.join(root, file));
  }
  fs.writeFileSync(path.join(root, 'data/clarity_projects.json'), JSON.stringify({ projects: { 'memphisseniorcarehomes.com': 'yxahwpnfgl' } }));
  fs.writeFileSync(path.join(root, 'data/site.json'), JSON.stringify({ siteUrl: 'https://memphisseniorcarehomes.com' }));
  const tag = '<script data-clarity-loader src="/assets/clarity-loader.js" defer></script>';
  const pages = {
    'info.html': `<head>${tag}</head><body><a href="/request-assistance/">Ask</a></body>`,
    'old-inline.html': '<head><script data-clarity-loader>old()</script></head><body>Information</body>',
    'form.html': '<head></head><body><form action="/api/lead"></form></body>',
    'buy.html': `<head>${tag}</head><body><a href="https://brand.gumroad.com/l/guide">Buy</a></body>`,
  };
  for (const [file, html] of Object.entries(pages)) fs.writeFileSync(path.join(root, 'dist', file), html);
  const run = () => execFileSync(process.execPath, [path.join(root, 'scripts/install_clarity.js')], {
    cwd: root, env: { ...process.env, PAGES_OUT_DIR: path.join(root, 'dist') }, encoding: 'utf8',
  });
  run();
  const read = (file) => fs.readFileSync(path.join(root, 'dist', file), 'utf8');
  assert.doesNotMatch(read('info.html'), /data-clarity-loader/);
  assert.doesNotMatch(read('old-inline.html'), /data-clarity-loader/);
  assert.match(read('form.html'), /data-clarity-loader/);
  assert.equal(read('buy.html'), pages['buy.html']);
  const after = Object.keys(pages).map(read);
  run();
  assert.deepEqual(Object.keys(pages).map(read), after);
});

test('the senior wizard prevents native form submission even if its matcher cannot load', () => {
  const handlers = {};
  const root = { addEventListener: (name, fn) => { handlers[name] = fn; } };
  const document = {
    readyState: 'complete', currentScript: null,
    getElementById: () => root,
    querySelector: () => null,
    createElement: () => ({ setAttribute() {} }),
    head: { appendChild: (el) => { if (el.onerror) el.onerror(); } },
  };
  const code = fs.readFileSync(new URL('../../assets/senior-intake.js', import.meta.url), 'utf8');
  vm.runInNewContext(code, { document, window: {} });
  assert.match(root.textContent, /This form could not load/);
  let prevented = false;
  handlers.submit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, 'native submission must not put contact fields in the URL');
});

test('a semantic intake mount keeps editorial dates without hiding content or market changes', () => {
  const { contentHash } = require('../../scripts/lib/lastmod_ledger');
  const { intakeSlotForSite } = require('../../scripts/lib/senior_living');
  const current = '<main><h1>Care options</h1>' + intakeSlotForSite() + '</main>';
  const previous = current.replace('<form id="senior-intake" aria-label="Senior care matching"', '<div id="senior-intake"').replace('</form>', '</div>');
  assert.equal(contentHash(current), contentHash(previous));
  for (const changed of [current.replace('Care options', 'New care options'), current.replace('38104', '38117'),
    current.replace('</form>', '<p>New form content</p></form>'), '<main><form id="another-form"></form></main>']) {
    assert.notEqual(contentHash(current), contentHash(changed));
  }
});

test('reviewed search titles retain topic and brand within the existing length budget', () => {
  const copy = require('../../data/search_title_copy.json');
  for (const { siteUrl, brandName } of PUBLICATIONS) {
    for (const [route, title] of Object.entries(copy[new URL(siteUrl).hostname] || {})) {
      const result = brandedTitle('Full editorial heading', siteUrl, brandName, route);
      assert.equal(result, `${title} | ${brandName}`);
      assert.ok(result.length >= 30 && result.length <= 65, `${route}: ${result}`);
    }
  }
});

test('each repaired guide must remain rendered and above the word floor', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-guide-floor-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = new URL('../../scripts/validation/guide_word_floor_contract.js', import.meta.url).pathname;
  for (const [pack, slug] of [
    ['pi', 'settlement-calculator-red-flags'],
    ['neuro', 'adhd-therapy-after-an-evaluation'],
    ['neuro', 'neuropsych-testing-children-vs-adults'],
    ['trt', 'trt-first-90-days'],
    ['pi', 'questions-to-ask-a-personal-injury-lawyer'],
    ['trt', 'peptides-vs-iv-therapy'],
    ['uscis_medical', 'brooklyn-i693-medical-exam-prices'],
    ['dentistry', 'ocala-dental-new-patient-specials-compared'],
    ['neuro', 'neuropsych-evaluation-cost-estimator'],
    ['neuro', 'neuro-provider-red-flags'],
  ]) {
    const dir = path.join(root, pack, 'guides', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>Short guide</p>');
    const run = () => {
      try {
        execFileSync(process.execPath, [script], { env: { ...process.env, LKG_VALIDATE_DIST: '1',
          PAGE_SET_FILE: `data/page_sets/examples/${pack}_v1.json`, PAGES_OUT_DIR: path.join(root, pack) }, stdio: 'pipe' });
        assert.fail('word-floor gate accepted a broken guide');
      } catch (error) {
        assert.equal(error.status, 1);
        return error.stderr.toString();
      }
    };
    assert.match(run(), new RegExp(`${slug}/.*2 words`));
    fs.renameSync(path.join(root, pack, 'guides', slug), path.join(root, pack, 'guides', `unrelated-${slug}`));
    assert.match(run(), new RegExp(`not in the rendered pack:.*${slug}`));
  }
});

test('repaired local guides reject duplicate H1s, missing answers, missing tables and broken attribution', () => {
  const { shapeProblems } = require('../../scripts/validation/guide_word_floor_contract');
  for (const slug of ['brooklyn-i693-medical-exam-prices', 'ocala-dental-new-patient-specials-compared', 'neuropsych-evaluation-cost-estimator', 'neuro-provider-red-flags']) {
    const good = `<h1>Guide topic</h1><h2 id="quick-answer">Quick answer</h2><table><tr><td>Comparison</td></tr></table>` +
      `<section data-search-faq="true"><h2>Frequently asked questions</h2><h3>What is included?</h3><p>Ask for itemized scope.</p></section>` +
      `<script type="application/ld+json">{"@type":"FAQPage"}</script>` +
      `<a href="/request-assistance/?vertical=example&amp;page_kind=guide&amp;page_slug=guides/${slug}">Ask</a>`;
    assert.deepEqual(shapeProblems(good, slug), []);
    assert.match(shapeProblems(good.replace('</h1>', '</h1><section><h1>Nested title</h1></section>'), slug).join(), /expected one H1, found 2/);
    assert.match(shapeProblems(good.replace(/<h1>.*?<\/h1>/, ''), slug).join(), /expected one H1, found 0/);
    // Wording, so a note; the generator seats the H2 (scripts/lib/answer_shape_seat.js).
    const { shapeNotes } = require('../../scripts/validation/guide_word_floor_contract');
    const { seatAnswerShape } = require('../../scripts/lib/answer_shape_seat');
    const h3 = good.replace('<h2 id="quick-answer">Quick answer</h2>', '<h3 id="quick-answer">Quick answer</h3>');
    assert.deepEqual(shapeProblems(h3, slug), []);
    assert.deepEqual(shapeNotes(h3), ['no Quick answer H2']);
    assert.deepEqual(shapeNotes(seatAnswerShape(`<main>${h3}</main>`, `guides/${slug}`)), []);
    assert.match(shapeProblems(good.replace('page_kind=guide', 'page_kind=city'), slug).join(), /no intake CTA/);
    assert.match(shapeProblems(good.replace(`guides/${slug}`, 'guides/another-guide'), slug).join(), /no intake CTA/);
    assert.match(shapeProblems(good + '<script>{"@type":"FAQPage"}</script>', slug).join(), /more than one FAQPage/);
    assert.match(shapeProblems(good.replace('data-search-faq="true"', ''), slug).join(), /no visible FAQ/);
    assert.match(shapeProblems(good.replace('"FAQPage"', '"WebPage"'), slug).join(), /no FAQPage/);
    const withoutTable = shapeProblems(good.replace(/<table>.*?<\/table>/, ''), slug);
    assert.equal(withoutTable.includes('comparison has no table'), slug === 'ocala-dental-new-patient-specials-compared');
  }
});

test('Search Console query history retains dropped queries without summing overlapping windows', () => {
  const script = new URL('../../scripts/search_intelligence/collect_gsc.py', import.meta.url).pathname;
  execFileSync('python3', ['-c', `
import runpy
merge = runpy.run_path(${JSON.stringify(script)})['query_history']
def export(at, rows):
    return dict(collected_at=at, start_date='2026-10-01', end_date='2026-10-28', by_query=rows)
a = export('2026-10-31', [dict(query='dropped', impressions=5), dict(query='stays', impressions=7)])
b = export('2026-11-04', [dict(query='stays', impressions=3)])
h = merge(None, [a, b])
r = {x['query']: x for x in h['queries']}
assert len(r) == 2
assert r['dropped']['impressions'] == 5 and r['dropped']['last_seen'] == '2026-10-31'
assert r['stays']['impressions'] == 3 and r['stays']['first_seen'] == '2026-10-31'
assert merge(h, [a, b]) == h
assert merge(h, [a]) == h
`], { stdio: 'pipe' });
});

test('source-driven scoped guides seat their existing answer without duplicating it', () => {
  const { seatAnswerShape } = require('../../scripts/lib/answer_shape_seat');
  for (const slug of ['settlement-calculator-red-flags', 'neuropsych-testing-cost-by-state', 'adhd-therapy-vs-medication-vs-coaching']) {
    const html = '<main><h1>Topic</h1><h2 id="citation-summary">What should you know?</h2>' +
      '<p data-citation-summary-answer="true">An authored answer with its source.</p></main>';
    const result = seatAnswerShape(html, `guides/${slug}`);
    assert.match(result, /<h2 id="citation-summary">Quick answer<\/h2>/);
    assert.equal((result.match(/An authored answer/g) || []).length, 1);
    assert.equal(seatAnswerShape(result, `guides/${slug}`), result);
  }
});

test('every guide gets the Quick answer H2, not only the ones a brief named', () => {
  const { seatAnswerShape, QUICK_ANSWER_GUIDES } = require('../../scripts/lib/answer_shape_seat');
  const slug = 'beauty-peptides-after-35';
  assert.equal(QUICK_ANSWER_GUIDES.has(slug), false);
  const html = '<main><h1>Beauty peptides after 35</h1><h2 id="citation-summary">Beauty peptides after 35: what should you know before you decide?</h2>' +
    '<p data-citation-summary-answer="true">An authored answer.</p></main>';
  const result = seatAnswerShape(html, `guides/${slug}`);
  assert.match(result, /<h2 id="citation-summary">Quick answer<\/h2>/);
  assert.equal(seatAnswerShape(result, `guides/${slug}`), result);
  // Not a guide: untouched.
  assert.equal(seatAnswerShape(html, 'memphis-tn'), html);
});

test('newly measured demand is a named note, never a block on the daily Search Console commit', (t) => {
  const repo = new URL('../..', import.meta.url).pathname;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lgg-families-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // Copied, not linked: a validator resolves its ROOT from its real path.
  fs.cpSync(path.join(repo, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
  fs.cpSync(path.join(repo, 'data'), path.join(dir, 'data'), { recursive: true });
  // A host with no search site, so the run checks sources and skips dist.
  fs.writeFileSync(path.join(dir, 'data/site.json'), JSON.stringify({ siteUrl: 'https://example.invalid' }));
  // Any guide family the committed data serves today; the daily measurement
  // moves the families, so the test picks one rather than naming it.
  const siDir = path.join(dir, 'data/search_intelligence');
  let host = null; let route = null;
  for (const h of fs.readdirSync(siDir)) {
    const f = path.join(siDir, h, 'demand_families.json');
    if (!fs.existsSync(f)) continue;
    const fam = JSON.parse(fs.readFileSync(f, 'utf8')).families.find((x) => x.status === 'strengthened' && x.page_kind === 'guide');
    if (fam) { host = h; route = fam.page; break; }
  }
  assert.ok(host, 'no served guide family in the committed data to unserve');
  const spFile = path.join(dir, 'data/search_intelligence/strengthened_pages.json');
  const sp = JSON.parse(fs.readFileSync(spFile, 'utf8'));
  sp.pages = sp.pages.filter((p) => !(p.host === host && p.route === route));
  fs.writeFileSync(spFile, JSON.stringify(sp, null, 2));
  // Rebuild that site's families the way build_search_plan does, from the copied tree.
  const rebuild = `const DF=require(${JSON.stringify(path.join(dir, 'scripts/search_intelligence/demand_families.js'))});` +
    `const fs=require('fs');const sites=require(${JSON.stringify(path.join(dir, 'data/search_intelligence/sites.json'))}).sites;` +
    `const s=sites.find(x=>x.host===${JSON.stringify(host)});const d=${JSON.stringify(path.join(dir, 'data/search_intelligence', host))};` +
    `const doc=DF.buildDocument(s,JSON.parse(fs.readFileSync(d+'/gsc_search_analytics_export.json','utf8')));` +
    `fs.writeFileSync(d+'/demand_families.json',JSON.stringify(doc,null,2)+'\\n');` +
    `console.log(doc.families.find(f=>f.page===${JSON.stringify(route)}).status);`;
  const run = (args) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
  const built = run(['-e', rebuild]);
  assert.equal(built.stdout.trim(), 'not_strengthened', built.stderr);
  const ok = run(['scripts/validation/demand_families_contract.js']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(ok.stdout.split('\n').some((l) => l.startsWith(`NAMED NOTE [FAMILY_NOT_SERVED] ${host} family`) && l.includes(route)), ok.stdout);
  // Still strict on everything else: a hand-edited families file fails.
  const famFile = path.join(dir, 'data/search_intelligence', host, 'demand_families.json');
  const fam = JSON.parse(fs.readFileSync(famFile, 'utf8'));
  fam.families[0].impressions += 1;
  fs.writeFileSync(famFile, JSON.stringify(fam, null, 2));
  const bad = run(['scripts/validation/demand_families_contract.js']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /DEMAND FAMILIES FAIL: .*differs from what demand_families\.js computes/);
});
