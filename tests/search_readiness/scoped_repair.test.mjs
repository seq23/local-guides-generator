import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
  for (const [pack, slug] of [['pi', 'settlement-calculator-red-flags'], ['neuro', 'adhd-therapy-after-an-evaluation'], ['trt', 'trt-first-90-days']]) {
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
    fs.renameSync(path.join(root, pack, 'guides', slug), path.join(root, pack, 'guides', 'unrelated-guide'));
    assert.match(run(), new RegExp(`not in the rendered pack:.*${slug}`));
  }
});
