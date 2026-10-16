// Fixtures for scripts/validation/link_audit.js: the dead-URL list, the
// /cdn-cgi/l/email-protection href ban and the bare-email fence rule each
// fail on a page that breaks them and pass on one that does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { run } = require('../../scripts/validation/link_audit.js');
const REAL_DEAD_LIST = JSON.parse(fs.readFileSync(new URL('../../config/dead_outbound_urls.json', import.meta.url), 'utf8'));

function fixture(body, deadList = REAL_DEAD_LIST) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'link-audit-'));
  fs.mkdirSync(path.join(root, 'dist', 'about'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'dead_outbound_urls.json'), JSON.stringify(deadList));
  fs.writeFileSync(path.join(root, 'config', 'internal_query_allowlist.json'), JSON.stringify({ prefixes: [] }));
  fs.writeFileSync(path.join(root, 'dist', 'about', 'index.html'), '<p>about</p>');
  fs.writeFileSync(
    path.join(root, 'dist', 'index.html'),
    `<html><body><a href="/about/">About</a> <a href="https://www.dhp.virginia.gov/">VA board</a> ${body}</body></html>`
  );
  return { repoRoot: root };
}

test('clean page passes', () => {
  const r = run(fixture('<p>Contact: <!--email_off--><a href="mailto:hello@theindustryguides.com">hello@theindustryguides.com</a><!--/email_off--> or <!--email_off-->renew@clinic.org<!--/email_off--></p><script type="application/ld+json">{"email":"a@b.org"}</script>'));
  assert.equal(r.outboundExamined, 1);
});

test('every checked-in dead URL fails the build', () => {
  assert.ok(REAL_DEAD_LIST.entries.length >= 8);
  for (const e of REAL_DEAD_LIST.entries) {
    assert.throws(() => run(fixture(`<a href="${e.url}">x</a>`)), /listed dead/, e.url);
  }
});

test('a host-dead entry blocks any path on that host', () => {
  assert.throws(() => run(fixture('<a href="https://member.vsb.org/vsbportal/">x</a>')), /listed dead/);
});

test('a /cdn-cgi/l/email-protection href fails', () => {
  assert.throws(() => run(fixture('<a href="/cdn-cgi/l/email-protection" class="__cf_email__">[email protected]</a>')), /cdn-cgi\/l\/email-protection/);
});

test('a bare email address in text outside a fence fails', () => {
  assert.throws(() => run(fixture('<dd>Send documents by email to renew@clinic.org first.</dd>')), /Bare email addresses/);
});

test('an unfenced mailto anchor still fails', () => {
  assert.throws(() => run(fixture('<a href="mailto:x@y.org">write</a>')), /Unfenced mailto/);
});

test('an empty dead list is refused, not passed', () => {
  assert.throws(() => run(fixture('', { entries: [] })), /zero entries/);
});

function sitemapFixture(cityHtml) {
  const ctx = fixture('<a href="/x-ca/">City</a>');
  const dist = path.join(ctx.repoRoot, 'dist');
  fs.mkdirSync(path.join(dist, 'x-ca', 'next-steps'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'x-ca', 'index.html'), cityHtml);
  fs.writeFileSync(path.join(dist, 'x-ca', 'next-steps', 'index.html'), '<a href="/x-ca/">back</a>');
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), '<sitemapindex><sitemap><loc>https://e.com/sitemap-core.xml</loc></sitemap></sitemapindex>');
  fs.writeFileSync(path.join(dist, 'sitemap-core.xml'), ['/', '/about/', '/x-ca/', '/x-ca/next-steps/'].map((u) => `<url><loc>https://e.com${u}</loc></url>`).join(''));
  return ctx;
}

test('a sitemap page linked only by a ?query tracked CTA is an orphan', () => {
  assert.throws(
    () => run(sitemapFixture('<a href="/x-ca/next-steps/?src=%2Fx-ca%2F&amp;intent=decision_hub">Next</a>')),
    /Orphan pages: 1 [\s\S]*\/x-ca\/next-steps\//
  );
});

test('a sitemap page with a clean inbound link passes the orphan check', () => {
  const r = run(sitemapFixture('<a href="/x-ca/next-steps/">Next steps</a>'));
  assert.equal(r.sitemapPagesExamined, 3);
});

test('a self-link does not rescue an orphan', () => {
  const ctx = sitemapFixture('<a href="/x-ca/next-steps/?src=a">Next</a>');
  fs.writeFileSync(path.join(ctx.repoRoot, 'dist', 'x-ca', 'next-steps', 'index.html'), '<a href="/x-ca/next-steps/">self</a><a href="/x-ca/">back</a>');
  assert.throws(() => run(ctx), /Orphan pages/);
});

test('an internal link carrying a query string fails, relative or absolute on the site host', () => {
  assert.throws(() => run(sitemapFixture('<a href="/x-ca/next-steps/">Next</a> <a href="/faq/?intent=self_serve&amp;market=x">FAQ</a>')), /Internal links with a query string: 1 [\s\S]*\/faq\//);
  assert.throws(() => run(sitemapFixture('<a href="/x-ca/next-steps/">Next</a> <a href="https://e.com/about/?src=x">About</a>')), /Internal links with a query string/);
});

test('attribution in data-attr-qs passes when the destination loads attr-carry, fails when it does not', () => {
  const ctx = sitemapFixture('<a href="/x-ca/next-steps/" data-attr-qs="src=%2Fx-ca%2F&amp;intent=decision_hub">Next</a>');
  assert.throws(() => run(ctx), /do not load \/assets\/attr-carry\.js[\s\S]*\/x-ca\/next-steps\//);
  fs.writeFileSync(path.join(ctx.repoRoot, 'dist', 'x-ca', 'next-steps', 'index.html'), '<head><script src="/assets/attr-carry.js" data-attr-carry="true"></script></head><a href="/x-ca/">back</a>');
  fs.mkdirSync(path.join(ctx.repoRoot, 'dist', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(ctx.repoRoot, 'dist', 'assets', 'attr-carry.js'), '');
  run(ctx);
});

test('an allow-listed path may carry a query', () => {
  const ctx = sitemapFixture('<a href="/x-ca/next-steps/">Next</a> <a href="/search/?q=x">Search</a>');
  fs.writeFileSync(path.join(ctx.repoRoot, 'config', 'internal_query_allowlist.json'), JSON.stringify({ prefixes: ['/search/'] }));
  fs.mkdirSync(path.join(ctx.repoRoot, 'dist', 'search'), { recursive: true });
  fs.writeFileSync(path.join(ctx.repoRoot, 'dist', 'search', 'index.html'), 'x');
  run(ctx);
});

test('attr-carry.js restores the clicked link attribution on the destination page only', () => {
  const src = fs.readFileSync(new URL('../../assets/attr-carry.js', import.meta.url), 'utf8');
  const store = new Map();
  function page(pathname, search) {
    const listeners = [];
    const loc = { pathname, search, hash: '' };
    const win = {
      location: loc,
      history: { state: null, replaceState: (_s, _t, url) => { const u = new URL(url, 'https://e.com'); loc.search = u.search; } }
    };
    const doc = { addEventListener: (_t, fn) => listeners.push(fn) };
    const ss = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    new Function('window', 'document', 'sessionStorage', src)(win, doc, ss);
    return { loc, click: (a) => listeners.forEach((fn) => fn({ target: { closest: () => a } })) };
  }
  const city = page('/x-ca/', '');
  city.click({ pathname: '/request-assistance/', getAttribute: () => 'pt=Dentist&src=%2Fx-ca%2F&intent=direct_match' });
  const other = page('/faq/', '');
  assert.equal(other.loc.search, '', 'a different page must not receive the attribution');
  const dest = page('/request-assistance/', '');
  assert.equal(dest.loc.search, '?pt=Dentist&src=%2Fx-ca%2F&intent=direct_match');
  const again = page('/request-assistance/', '');
  assert.equal(again.loc.search, '', 'attribution is used once');
  city.click({ pathname: '/request-assistance/', getAttribute: () => 'src=a' });
  const campaign = page('/request-assistance/', '?utm_source=x');
  assert.equal(campaign.loc.search, '?utm_source=x', 'an existing query (external campaign link) is never overwritten');
});
