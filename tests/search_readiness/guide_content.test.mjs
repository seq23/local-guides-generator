import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { answerFromSource, faqFromSource, openingFaqFromSource } = require('../../scripts/lib/guide_content.js');
const { buildFanoutCluster } = require('../../scripts/helpers/fanout.js');
const { assertDistinctGuides } = require('../../scripts/lib/guide_content.js');
const { buildGuideHtml } = require('../../scripts/vertical_upgrades/lib.js');

test('an opening preserves authored prices and complete markup without inventing padding', () => {
  const paragraph = 'The clinic publishes an examination fee of <strong>$100.50</strong> for this visit. Its quoted fee includes the initial review and a copy of the completed paperwork, while additional laboratory testing and vaccination charges must be confirmed directly with the office before booking.';
  const source = '<p class="kicker">Quick answer</p><p>Educational only.</p><p>' + paragraph + '</p>';
  assert.equal(answerFromSource(source), paragraph);
  assert.equal(answerFromSource('<p>Short undocumented claim.</p>'), '');
  assert.equal(answerFromSource(''), '');
});

test('visible FAQ contains only questions and answers in the source', () => {
  const answer = 'Ask the clinic for a written estimate identifying the examination, laboratory testing, follow-up visit and paperwork charges before booking.';
  const html = faqFromSource('<h2>What does the quote include?</h2><p>' + answer + '</p>');
  assert.ok(html.includes(answer));
  assert.ok(html.includes('<h3>What does the quote include?</h3>'));
  assert.equal(faqFromSource('<h2>Cost table</h2><table><tr><td>100</td></tr></table>'), '');
});

test('the opening never reprints a question the article below already answers', () => {
  const answer = 'Ask the clinic for a written estimate identifying the examination, laboratory testing, follow-up visit and paperwork charges before booking.';
  const article = '<h2>What does the quote include?</h2><p>' + answer + '</p>';
  const entry = { good: 'The provider should explain the written estimate line by line.', mistake: 'Booking on the headline fee alone.' };
  // The article carries a pair: the opening adds nothing, so the answer is on the page once.
  assert.equal(openingFaqFromSource(article, entry), '');
  // No pair in the article: the opening carries the curated pair, which the article does not.
  const fallback = openingFaqFromSource('<p>No questions here.</p>', entry);
  assert.ok(fallback.includes(entry.good) && fallback.includes(entry.mistake));
  assert.equal(openingFaqFromSource('<p>No questions here.</p>', null), '');
});

test('compiled navigation resolves retired routes and rejects redirect cycles', () => {
  const pageSet = {
    fanoutOverrides: { '*': { replaceDefault: true, items: [{ query: 'a useful query', href: '/guides/retired/', label: 'Guide' }] } },
    legacyRedirects: [{ from: '/guides/retired', to: '/guides/kept/' }],
  };
  const ctx = { verticalKey: 'fixture', route: '/guides/example/', title: 'Example' };
  const cluster = buildFanoutCluster(ctx, pageSet);
  assert.ok(JSON.stringify(cluster).includes('/guides/kept/'));
  assert.ok(!JSON.stringify(cluster).includes('/guides/retired/'));
  pageSet.legacyRedirects.push({ from: '/guides/kept', to: '/guides/retired/' });
  assert.throws(() => buildFanoutCluster(ctx, pageSet), /cycle/);
});

test('prewrite publication gate rejects empty and copied guides', () => {
  const a = { route: '/guides/first/', main_html: '<p>A documented examination includes records review and an explanation of the next steps.</p>' };
  const b = { route: '/guides/second/', main_html: '<p>Written fee agreements identify expenses, deductions, responsibility and the terms governing a recovery.</p>' };
  assert.doesNotThrow(() => assertDistinctGuides([a, b]));
  assert.throws(() => assertDistinctGuides([]), /No guide candidates/);
  assert.throws(() => assertDistinctGuides([{ ...a, main_html: '' }]), /Empty guide/);
  assert.throws(() => assertDistinctGuides([a, { ...a, route: b.route }]), /near-duplicate/);
});

test('legacy upgrades preserve reviewed copy and cannot synthesize a template body', () => {
  const guide = { route: '/guides/kept/', main_html: '<p>Reviewed source with its own facts and citations.</p>' };
  const profile = { sections() { throw new Error('generic profile must not render'); } };
  assert.equal(buildGuideHtml(guide, profile), guide.main_html);
  assert.throws(() => buildGuideHtml({ route: guide.route }, profile), /Author guide content/);
});
