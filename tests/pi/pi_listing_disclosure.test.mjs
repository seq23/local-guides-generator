// Fixtures for the R-LEAD-05 / R-LEAD-06 part of scripts/validation/pi_trust_tone_contract.js
// (her call 27 Nov 2026, "Free for now"): every built theaccidentguides.com page carries
// "We do not endorse or recommend any lawyer. Listings are free for now; firms may pay to be
// listed later." word for word, and no sentence says a firm pays a referral or per-case fee.
// The protective lines ("not ... a referral service", the fee-split questions on
// /guides/personal-injury-fees-explained/) must keep passing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const contract = require('../../scripts/validation/pi_trust_tone_contract.js');
const home = require('../../scripts/lib/homepage_v2.js');
const piOffer = require('../../scripts/lib/pi_offer.js');

const HER_SENTENCE = 'We do not endorse or recommend any lawyer. Listings are free for now; firms may pay to be listed later.';
const OLD_LINE = 'We do not rank providers. Providers may pay a listing or referral fee; that never changes the guides.';
const PROTECTIVE = '<p>It is not a law firm, medical provider, or referral service.</p>' +
  '<p>And where a case is handled by more than one firm, the fee is normally divided between them, so ask whether any referral or co-counsel arrangement changes your total at all.</p>' +
  '<li>Not a referral service. We do not collect referral fees or commissions for contacting providers.</li>' +
  '<p>Most personal injury lawyers are paid a percentage of the recovery, often 33%.</p>';

const page = (body) => '<html><head><title>T</title></head><body><main>' + body + '</main></body></html>';

function distWith(t, pages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-listing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, html] of Object.entries(pages)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), html);
  }
  return dir;
}

test('a built PI page with her sentence and the protective lines passes', (t) => {
  const dir = distWith(t, { 'index.html': page(PROTECTIVE + '<footer><p>We do not guarantee outcomes. ' + HER_SENTENCE + '</p></footer>') });
  assert.deepEqual(contract.checkBuiltPiPages(dir), []);
});

test('the old footer (endorse line only) fails: her sentence is missing', (t) => {
  const dir = distWith(t, { 'guides/x/index.html': page(PROTECTIVE + '<footer><p>We do not guarantee outcomes, and we do not endorse or recommend any lawyer.</p></footer>') });
  const issues = contract.checkBuiltPiPages(dir);
  assert.equal(issues.length, 1, issues.join('\n'));
  assert.match(issues[0], /missing the R-LEAD-06 sentence/);
});

test('a near-miss of her sentence fails (word for word, not similar)', (t) => {
  const near = 'We do not endorse or recommend any lawyer. Firms pay to be listed.';
  const dir = distWith(t, { 'index.html': page('<p>' + near + '</p>') });
  assert.ok(contract.checkBuiltPiPages(dir).some((i) => /missing the R-LEAD-06 sentence/.test(i)));
});

test('the old "listing or referral fee" line fails even next to her sentence', (t) => {
  const dir = distWith(t, { 'index.html': page('<p class="hp-band-note">' + OLD_LINE + '</p><footer><p>' + HER_SENTENCE + '</p></footer>') });
  const issues = contract.checkBuiltPiPages(dir);
  assert.equal(issues.length, 1, issues.join('\n'));
  assert.match(issues[0], /says a firm pays a referral or per-case fee: "Providers may pay a listing or referral fee;/);
});

test('per-case and share-of-fee payments to us fail; negated and client-pays sentences pass', () => {
  assert.deepEqual(contract.feeSentences('Firms pay a referral fee for each case.'), ['Firms pay a referral fee for each case.']);
  assert.deepEqual(contract.feeSentences('Law firms pay us 10% of their fee.'), ['Law firms pay us 10% of their fee.']);
  assert.deepEqual(contract.feeSentences('Attorneys pay per signed case.'), ['Attorneys pay per signed case.']);
  assert.deepEqual(contract.feeSentences('Firms never pay a referral fee.'), []);
  assert.deepEqual(contract.feeSentences('Most lawyers are paid a percentage of the recovery.'), []);
  assert.deepEqual(contract.feeSentences(HER_SENTENCE), []);
});

test('the renderer uses her sentence on the PI site and no fee line anywhere else', () => {
  assert.equal(piOffer.PI_LISTING_DISCLOSURE, HER_SENTENCE);
  assert.equal(home.SITES.pi.neutrality, HER_SENTENCE);
  for (const [key, cfg] of Object.entries(home.SITES)) {
    const line = cfg.neutrality || home.NEUTRALITY;
    assert.deepEqual(contract.feeSentences(line), [], key + ': ' + line);
  }
  // hormonesivhair.com shows affiliate links, so its line names the commission (R-END-01).
  assert.match(home.SITES.trt.neutrality, /commission/);
});
