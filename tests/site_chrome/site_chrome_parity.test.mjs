// Fixtures for scripts/validation/site_chrome_parity_contract.js: an inner page
// with the pre-14-Oct header/footer must fail; one with the homepage's must pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkSite } = require('../../scripts/validation/site_chrome_parity_contract.js');

const NAV = '<a href="/guides/costs/">Costs</a><a href="/guides/">Guides</a><a href="/faq/">FAQ</a>';
const header = (cta) => `<header class="site-header hp-header" data-site-chrome="header"><a class="hp-brand" href="/"><span class="hp-wordmark">Example Guides</span><span class="hp-parent">Part of The Industry Guides</span></a><nav>${NAV}<a class="hp-nav-cta" href="${cta}">Find a clinic</a></nav></header>`;
const FOOTER = '<footer data-site-chrome="footer" class="site-footer"><div class="footer-inner"><p>Advertising disclosure.</p><div class="footer-meta">&copy; 2026 Example Guides · Contact: <a href="mailto:hello@theindustryguides.com">hello@theindustryguides.com</a></div><nav><a href="/methodology/">Methodology</a></nav><p class="hp-footer-line">Educational content, not medical advice.</p></div></footer>';
const OLD_HEADER = '<header class="site-header"><div class="container header-inner"><a class="brand" href="/">Example Guides</a><nav class="top-nav"><a href="/guides/">Guides</a><a href="/faq/">FAQ</a><a href="/methodology/">Methodology</a><a href="/for-providers/">Advertising &amp; Provider Info</a><a href="/contact/">Contact</a></nav></div></header>';
const OLD_FOOTER = '<footer class="site-footer"><div class="footer-inner"><p>Advertising disclosure.</p></div></footer>';
const page = (h, f) => `<!doctype html><html><head></head><body>${h}<main><h1>x</h1></main>${f}</body></html>`;

function site(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-'));
  for (const [rel, html] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), html);
  }
  return dir;
}
const HOME = page(header('#match'), FOOTER);

test('every page with the homepage header and footer passes (#match on home == /#match inside)', () => {
  const r = checkSite(site({ 'index.html': HOME, 'faq/index.html': page(header('/#match'), FOOTER), 'states/TN/index.html': page(header('/#match'), FOOTER) }));
  assert.deepEqual(r.problems, []);
  assert.equal(r.pages, 3);
});

test('negative: an inner page with the pre-change header and footer fails', () => {
  const r = checkSite(site({ 'index.html': HOME, 'faq/index.html': page(OLD_HEADER, OLD_FOOTER) }));
  assert.ok(r.problems.some((p) => /faq\/index\.html: no site header/.test(p)), r.problems.join('\n'));
});

test('negative: new header but the old footer fails', () => {
  const r = checkSite(site({ 'index.html': HOME, 'guides/a/index.html': page(header('/#match'), OLD_FOOTER) }));
  assert.ok(r.problems.some((p) => /no site footer/.test(p)), r.problems.join('\n'));
});

test('negative: a missing nav item or a different button target fails', () => {
  const short = header('/#match').replace('<a href="/faq/">FAQ</a>', '');
  const r1 = checkSite(site({ 'index.html': HOME, 'a/index.html': page(short, FOOTER) }));
  assert.ok(r1.problems.some((p) => /nav differ/.test(p)), r1.problems.join('\n'));
  const r2 = checkSite(site({ 'index.html': HOME, 'a/index.html': page(header('/request-assistance/'), FOOTER) }));
  assert.ok(r2.problems.some((p) => /nav differ/.test(p)), r2.problems.join('\n'));
});

test('negative: a footer line that differs fails', () => {
  const r = checkSite(site({ 'index.html': HOME, 'a/index.html': page(header('/#match'), FOOTER.replace('not medical advice', 'not legal advice')) }));
  assert.ok(r.problems.some((p) => /footerLines differ/.test(p)), r.problems.join('\n'));
});

test('negative: a homepage without the chrome, or a site with no inner pages, fails (Rule 0)', () => {
  assert.ok(checkSite(site({ 'index.html': page(OLD_HEADER, OLD_FOOTER) })).problems.length > 0);
  assert.ok(checkSite(site({ 'index.html': HOME })).problems.some((p) => /only 1 rendered page/.test(p)));
});
