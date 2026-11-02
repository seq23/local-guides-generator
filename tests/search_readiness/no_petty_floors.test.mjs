// Owner ruling 2 Nov 2026: over a length limit never fails; under a floor fails
// only below 75% of it; tone wording is a note; the weekly cap holds publishing,
// not merges. Each test drives the real validator against a fixture on both
// sides of the line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const ROOT = new URL('../../', import.meta.url).pathname;
const { judgeLength, hardFloor } = require('../../scripts/validation/lib/floors');
const { brandedTitle, fitLength } = require('../../scripts/lib/search_readiness_policy');

const tmp = (t, tag) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `petty-${tag}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const node = (script, { cwd = ROOT, env = {}, args = [] } = {}) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], {
  cwd, env: { ...process.env, ...env }, encoding: 'utf8',
});
const words = (n, tag = 'w') => Array.from({ length: n }, (_, i) => `${tag}${i}`).join(' ');

test('one floor rule: fail under 75%, note for a near miss or anything over', () => {
  assert.equal(hardFloor(1800), 1350);
  assert.equal(judgeLength(1349, 1800), 'fail');
  assert.equal(judgeLength(1350, 1800), 'note');
  assert.equal(judgeLength(1800, 1800), 'ok');
  assert.equal(judgeLength(29, 40, 60), 'fail');
  assert.equal(judgeLength(30, 40, 60), 'note');
  assert.equal(judgeLength(500, 40, 60), 'note');
});

test('head contract: a long or slightly short title is a note; a stub, a duplicate or two h1s still fail', (t) => {
  const dir = tmp(t, 'head');
  const page = (rel, title, desc = 'd'.repeat(130), h1 = '<h1>x</h1>') => {
    fs.mkdirSync(path.join(dir, 'dist', rel), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist', rel, 'index.html'), `<title>${title}</title><meta name="description" content="${desc}"><main>${h1}</main>`);
  };
  page('', 'T'.repeat(80));
  page('a', 'Twenty-five chars title x', 'd'.repeat(200));
  let r = node('scripts/validation/search_readiness_head_contract.js', { cwd: dir });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NOTE: 3 title\/description length/);
  page('b', 'Too short title');
  r = node('scripts/validation/search_readiness_head_contract.js', { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /b\/ +title is 15 chars/);
  page('b', 'T'.repeat(80));
  r = node('scripts/validation/search_readiness_head_contract.js', { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /used by more than one page/);
  page('b', 'A unique title for page b ok', 'd'.repeat(130), '<h1>x</h1><h1>y</h1>');
  r = node('scripts/validation/search_readiness_head_contract.js', { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /has 2 <h1>/);
});

test('answer shape: a 35-word or 80-word answer is a note; a 25-word fragment fails', (t) => {
  const dir = tmp(t, 'answer');
  const write = (n) => fs.writeFileSync(path.join(dir, 'index.html'),
    `<main><h2>What does a crash report cost?</h2><p data-citation-summary-answer="true">${words(n, 'cost')}</p>` +
    '<div data-content-block="recommendation_summary"></div></main>');
  const run = () => node('scripts/validation/answer_shape_contract.js', { env: { PAGES_OUT_DIR: dir } });
  for (const n of [35, 80]) {
    write(n);
    const r = run();
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, new RegExp(`NOTE .*answer span is ${n} words`));
  }
  write(25);
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL .*answer span is 25 words/);
});

test('guide word floor: 1,500 words is a note on an enforced pack; 1,000 fails', (t) => {
  const dir = tmp(t, 'floor');
  const slug = 'ocala-dental-new-patient-specials-compared';
  fs.mkdirSync(path.join(dir, 'guides', slug), { recursive: true });
  const write = (n) => fs.writeFileSync(path.join(dir, 'guides', slug, 'index.html'),
    `<h1>Guide topic</h1><h2 id="quick-answer">Quick answer</h2><table><tr><td>Comparison</td></tr></table>` +
    `<section data-search-faq="true"><h2>Frequently asked questions</h2><p>${words(n)}</p></section>` +
    `<script type="application/ld+json">{"@type":"FAQPage"}</script>` +
    `<a href="/request-assistance/?vertical=dentistry&amp;page_kind=guide&amp;page_slug=guides/${slug}">Ask</a>`);
  const run = () => node('scripts/validation/guide_word_floor_contract.js', {
    env: { LKG_VALIDATE_DIST: '1', PAGE_SET_FILE: 'data/page_sets/examples/dentistry_v1.json', PAGES_OUT_DIR: dir },
  });
  write(1500);
  let r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NOTE: .*under the 1800-word target/);
  write(1000);
  r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /under 1350 words/);
});

test('PI wording: outcome and dollar promises stay blocking; pushy tone is a note', () => {
  const pi = require('../../scripts/validation/pi_trust_tone_contract');
  for (const p of ['guaranteed win', 'guaranteed outcome', 'million-dollar', 'we win big']) assert.ok(pi.BANNED_PHRASES.includes(p), p);
  for (const p of ['call now', 'act now', 'limited time']) {
    assert.ok(!pi.BANNED_PHRASES.includes(p), p);
    assert.ok(pi.TONE_PHRASES.includes(p), p);
  }
});

test('generator trims over-long head copy and keeps the brand', () => {
  const t = brandedTitle('A very long editorial heading about car accident settlements and what they cost in Ohio', 'https://theaccidentguides.com', 'The Accident Guides');
  assert.ok(t.length <= 65, t);
  assert.match(t, /… \| The Accident Guides$/);
  assert.equal(fitLength('short', 160), 'short');
  assert.ok(fitLength(words(60), 160).length <= 160);
});

test('cadence: the weekly cap blocks the publish lane and is a warning in the merge lane', (t) => {
  const dir = tmp(t, 'cadence');
  fs.mkdirSync(path.join(dir, 'data/cadence'), { recursive: true });
  const urls = Array.from({ length: 6 }, (_, i) => `https://example.org/p${i}/`);
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), urls.map((u) => `<url><loc>${u}</loc><lastmod>2026-11-01</lastmod></url>`).join(''));
  const ledger = JSON.stringify({ urls: [urls[0]], by_host: { 'example.org': [urls[0]] } });
  const run = (lane) => {
    fs.writeFileSync(path.join(dir, 'data/cadence/known_urls.json'), ledger);
    return node('scripts/cadence_gate.js', { cwd: dir, env: { CADENCE_TODAY: '2026-11-02' }, args: lane ? ['--lane', lane] : [] });
  };
  let r = run(null);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /BLOCK +weekly_cap: 5 URLs are new/);
  r = run('merge');
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /WARN +weekly_cap: 5 URLs are new.*merge lane/);
  // Merge lane still blocks the other conditions: an undated URL.
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), '<url><loc>https://example.org/p0/</loc></url>');
  r = run('merge');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /BLOCK +no_freshness_signal/);
});

test('answer wording: a label heading or a pronoun opening is a note, and the generator produces the shape', (t) => {
  const { seatAnswerShape, selfContainedFirst } = require('../../scripts/lib/answer_shape_seat');
  const dir = tmp(t, 'wording');
  const page = (heading, span) => `<main><h1>USCIS medical exam: costs</h1><h2>${heading}</h2>` +
    `<p data-citation-summary-answer="true">${span}</p><div data-content-block="recommendation_summary"></div></main>`;
  const pronoun = `It is ${words(40, 'exam')}`;
  fs.writeFileSync(path.join(dir, 'index.html'), page('Short answer', pronoun));
  const r = node('scripts/validation/answer_shape_contract.js', { env: { PAGES_OUT_DIR: dir } });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /NOTE .*heading is not a question/);
  assert.match(r.stdout, /NOTE .*opens with a pronoun/);
  // Render-time: the label becomes the house question; a page in shape is untouched.
  const seated = seatAnswerShape(page('Short answer', 'The exam costs money.'), 'guides/x');
  assert.match(seated, /<h2>USCIS medical exam: what should you know before you decide\?<\/h2>/);
  const inShape = page('What does it cost?', 'The exam costs money.');
  assert.equal(seatAnswerShape(inShape, 'guides/x'), inShape);
  // Composition: a span never opens on a dangling sentence.
  assert.deepEqual(selfContainedFirst(['It is required.', 'The I-693 exam is required.', 'Bring records.']),
    ['The I-693 exam is required.', 'It is required.', 'Bring records.']);
});
