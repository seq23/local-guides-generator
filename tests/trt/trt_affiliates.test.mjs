// Fixtures for scripts/validation/trt_affiliate_links_contract.js and the
// hormonesivhair.com affiliate programs (owner decision, 16 Oct 2026): Ulta Lab
// Tests linked directly to our microsite, PrescribedRX with our ref param, an
// FTC disclosure next to every link, rel="sponsored noopener", and the women's
// HRT callback option mirrored in the Cloudflare function. Each check is proven
// to fail on the shape it guards against.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const aff = require('../../scripts/lib/trt_affiliates.js');
const contract = require('../../scripts/validation/trt_affiliate_links_contract.js');

const page = (body) => '<html><head><title>T</title></head><body><main>' + body + '</main></body></html>';
const labs = aff.labsBlockHtml();
const online = aff.onlineBlockHtml('/#match');

test('the rendered blocks pass', () => {
  assert.deepEqual(contract.checkTrtPage(page(labs + online)), []);
  assert.equal(contract.affiliateAnchors(page(labs + online)).length, 4);
});

test('a link without the disclosure fails', () => {
  const bad = labs.replace(/<p class="affiliate-disclosure"[\s\S]*?<\/p>/, '');
  assert.match(contract.checkTrtPage(page(bad)).join('\n'), /no FTC disclosure/);
});

test('a disclosure that comes before the link, not after it, fails', () => {
  const disc = labs.match(/<p class="affiliate-disclosure"[\s\S]*?<\/p>/)[0];
  const bad = labs.replace(disc, '').replace('<ul>', disc + '<ul>');
  assert.match(contract.checkTrtPage(page(bad)).join('\n'), /disclosure does not follow/);
});

test('a link outside a labelled block fails', () => {
  const bare = '<p><a href="' + aff.ULTA_LINKS.testosterone.href + '" rel="sponsored noopener" target="_blank" data-affiliate-link="ulta">x</a></p>';
  assert.match(contract.checkTrtPage(page(bare)).join('\n'), /outside a labelled affiliate block/);
  assert.match(contract.checkTrtPage(page(labs.replace(aff.LABEL, 'Partner'))).join('\n'), /not labelled/);
});

test('rel and target are enforced', () => {
  assert.match(contract.checkTrtPage(page(labs.replace(/rel="sponsored noopener"/, 'rel="nofollow"'))).join('\n'), /rel="nofollow"/);
  assert.match(contract.checkTrtPage(page(online.replace(/ target="_blank"/, ''))).join('\n'), /new tab/);
});

test('an Ulta link behind a redirect wrapper or off the microsite fails', () => {
  const wrapped = labs.replace(aff.ULTA_LINKS.testosterone.href, '/go/?u=' + encodeURIComponent(aff.ULTA_LINKS.testosterone.href));
  assert.match(contract.checkTrtPage(page(wrapped)).join('\n'), /not a direct link/);
  const offsite = labs.replace(aff.ULTA_LINKS.testosterone.href, 'https://www.ultalabtests.com/test/testosterone-free-bioavailable-and-total-test');
  assert.match(contract.checkTrtPage(page(offsite)).join('\n'), /not a direct link/);
  const relative = labs.replace(aff.ULTA_LINKS.testosterone.href, '/go/ulta-testosterone');
  assert.match(contract.checkTrtPage(page(relative)).join('\n'), /not a direct link/);
  const shortener = labs.replace(aff.ULTA_LINKS.testosterone.href, 'https://bit.ly/ultalabtests');
  assert.match(contract.checkTrtPage(page(shortener)).join('\n'), /not a direct link/);
});

test('PrescribedRX needs the exact ref param', () => {
  assert.match(contract.checkTrtPage(page(online.replace('ref=sequoialtaylor23', 'ref=sequoiataylor23'))).join('\n'), /lacks \?ref=sequoialtaylor23/);
  assert.match(contract.checkTrtPage(page(online.replace('?ref=sequoialtaylor23', ''))).join('\n'), /lacks \?ref=/);
});

test('ranking language in a block fails', () => {
  assert.match(contract.checkTrtPage(page(online.replace('is an online clinic', 'is the best online clinic'))).join('\n'), /ranking language/);
});

test('the homepage must name TRT and menopause HRT and welcome women\'s HRT', () => {
  const opt = '<form data-home-callback-form="true"><select><option>Hormone / Wellness Clinic</option><option>' + aff.WOMENS_HRT_PROVIDER_TYPE.replace("'", '&#39;') + '</option></select></form>';
  const good = '<html><head><title>Guides: TRT, Menopause HRT</title><meta name="description" content="TRT and menopause HRT explained."></head><body><h1>TRT and menopause HRT</h1>' + labs + online + opt + '</body></html>';
  assert.deepEqual(contract.checkTrtHomepage(good), []);
  assert.match(contract.checkTrtHomepage(good.replace('<h1>TRT and menopause HRT</h1>', '<h1>TRT explained</h1>')).join('\n'), /H1 does not name menopause HRT/);
  assert.match(contract.checkTrtHomepage(good.replace(online, '')).join('\n'), /no prescribedrx affiliate link/);
  assert.match(contract.checkTrtHomepage(good.replace(/<option>Menopause[^<]*<\/option>/, '')).join('\n'), /callback has no/);
});

test('dist: zero affiliate links on the hormone site fails; any on another site fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trt-aff-'));
  fs.writeFileSync(path.join(dir, 'index.html'), page('<p>nothing</p>'));
  assert.match(contract.checkDist(dir, true).problems.join('\n'), /zero affiliate links/);
  assert.deepEqual(contract.checkDist(dir, false).problems, []);
  fs.writeFileSync(path.join(dir, 'index.html'), page(labs));
  assert.match(contract.checkDist(dir, false).problems.join('\n'), /site with no affiliate program/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyToPageHtml leaves other sites byte-identical and throws on a lost anchor', () => {
  const html = '<html><body><section class="section" data-guide-opening="true"><h2>x</h2></section></body></html>';
  assert.equal(aff.applyToPageHtml(html, { verticalKey: 'neuro', kind: 'global', route: 'guides/trt-pricing-and-labs' }), html);
  const out = aff.applyToPageHtml(html, { verticalKey: 'trt', kind: 'global', route: 'guides/trt-pricing-and-labs' });
  assert.ok(out.includes('data-affiliate-block="ulta"') && out.includes('data-affiliate-block="prescribedrx"') && out.includes('data-affiliate-click-log'));
  assert.throws(() => aff.applyToPageHtml('<html><body></body></html>', { verticalKey: 'trt', kind: 'global', route: 'guides/trt-pricing-and-labs' }), /anchor/);
});

test('women\'s HRT option: the request page gains it and the Cloudflare function accepts it', () => {
  const shared = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'global_pages', 'request-assistance.json'), 'utf8')).main_html;
  const out = aff.applyToRequestAssistanceHtml(shared);
  assert.ok(out.includes('<option>' + aff.WOMENS_HRT_PROVIDER_TYPE + '</option>'));
  assert.ok(!shared.includes(aff.WOMENS_HRT_PROVIDER_TYPE), 'the shared page (other sites) stays unchanged');
  const fn = fs.readFileSync(path.join(ROOT, 'functions', 'api', 'request-assistance.js'), 'utf8');
  const allowed = fn.match(/ALLOWED_PROVIDER_TYPES = new Set\(\[([\s\S]*?)\]\)/)[1];
  assert.ok(allowed.includes(JSON.stringify(aff.WOMENS_HRT_PROVIDER_TYPE)), 'functions/api/request-assistance.js must accept the women\'s HRT option exactly');
});
