'use strict';
/**
 * The answer shape, produced by the generator instead of failed by a validator.
 *
 * Owner ruling 2 Nov 2026: wording and style checks never block; the generator
 * produces the shape. scripts/validation/answer_shape_contract.js and
 * scripts/validation/guide_word_floor_contract.js now report these as notes;
 * this file is what keeps the rendered pages in shape:
 *
 *   - selfContainedFirst: an answer span never opens on a sentence whose
 *     pronoun points outside it ("It is ..."); such a sentence moves behind
 *     the first self-contained one.
 *   - the heading above an answer span is a question: a "Short answer" label
 *     or a statement heading is rewritten into the house question shape
 *     ("<topic>: what should you know before you decide?", the same fallback
 *     guideQuestionHeading uses in scripts/build_city_sites.js).
 *   - every guide carries a "Quick answer" H2: an H3 of that label is
 *     promoted, or the existing citation-summary heading is relabelled.
 *     QUICK_ANSWER_GUIDES is now only the set whose full house shape
 *     guide_word_floor_contract.js proves (words, intake link, FAQ).
 *
 * Each rewrite fires only on a page that is out of shape, so a page already in
 * shape renders byte-identical and its freshness date does not move.
 */

// An opening that only means something next to the rest of the page.
const DANGLING = /^(it|they|he|she|these|those|here|there|its|their|his|her)\b|^(this|that)\s+(is|was|are|were|can|will|would|should|does|did|has|have|means)\b/i;

// Guides a Search Readiness brief repaired into the full house shape (a
// "Quick answer" H2 and an attributed intake link); guide_word_floor_contract.js
// proves this set. The Quick answer H2 itself is seated on every guide.
const QUICK_ANSWER_GUIDES = new Set([
  'settlement-calculator-red-flags',
  'neuropsych-testing-cost-by-state',
  'adhd-therapy-vs-medication-vs-coaching',
  'neuro-provider-red-flags',
  'brooklyn-i693-medical-exam-prices',
  'ocala-dental-new-patient-specials-compared',
  'neuropsych-evaluation-cost-estimator',
  'neuropsych-testing-children-vs-adults',
  'questions-to-ask-a-personal-injury-lawyer',
  'peptides-vs-iv-therapy',
  'recorded-statements-and-insurance-calls',
  'trt-fertility-and-family-planning',
  'beauty-peptide-costs-and-bundles',
  'fresno-i693-immigration-medical-exam-cost',
  'brooklyn-vitamin-c-injections-prices',
]);

const ANSWER_P = /<p[^>]*data-(?:citation-summary-answer|home-answer-span)="true"[^>]*>([\s\S]*?)<\/p>/i;
const QUESTION_TAIL = 'what should you know before you decide?';
const plain = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const opensDangling = (s) => DANGLING.test(plain(s));

function selfContainedFirst(sentences) {
  const list = (sentences || []).filter((s) => String(s || '').trim());
  const first = list.findIndex((s) => !opensDangling(s));
  if (first <= 0) return list;
  return [list[first], ...list.slice(0, first), ...list.slice(first + 1)];
}

function topicOf(main) {
  const h1 = (main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  return plain(h1).split(/\s*[:—|]\s*/)[0].trim();
}

function questionHeading(main) {
  const m = main.match(ANSWER_P);
  if (!m) return main;
  const at = main.indexOf(m[0]);
  const heads = [...main.slice(0, at).matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi)];
  const last = heads[heads.length - 1];
  if (!last) return main;
  const text = plain(last[2]);
  if (!text || text.endsWith('?')) return main;
  // "Quick answer" is the house label on repaired guides; it is not rewritten.
  if (/^quick answer$/i.test(text)) return main;
  const topic = /^short answer$/i.test(text) ? topicOf(main) : text.replace(/[.:;!]+$/, '');
  if (!topic) return main;
  const rewritten = `<h2${last[1]}>${topic}: ${QUESTION_TAIL}</h2>`;
  return main.slice(0, last.index) + rewritten + main.slice(last.index + last[0].length);
}

function quickAnswerH2(main) {
  if (/<h2\b[^>]*>\s*Quick answer\s*<\/h2>/i.test(main)) return main;
  const promoted = main.replace(/<h3(\b[^>]*)>\s*Quick answer\s*<\/h3>/i, '<h2$1>Quick answer</h2>');
  if (promoted !== main) return promoted;
  // Source-driven guides may have no Quick answer H3. Their authored answer
  // already sits in the citation summary; seat the label above that answer.
  return main.replace(/<h2(\b[^>]*\bid="citation-summary"[^>]*)>[\s\S]*?<\/h2>/i, '<h2$1>Quick answer</h2>');
}

// html: a whole rendered page. route: its route without slashes ("guides/x").
function seatAnswerShape(html, route = '') {
  const mm = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!mm) return html;
  let main = questionHeading(mm[1]);
  const slug = (String(route).match(/^guides\/([^/]+)\/?$/) || [])[1];
  // Every guide carries the Quick answer H2 (j3), not only the ones a brief
  // named: a list made each new guide wait for its own failed audit
  // (beauty-peptides-after-35, 5 Nov 2026). quickAnswerH2 is a no-op on a
  // guide with neither a Quick answer H3 nor a citation-summary heading.
  if (slug) main = quickAnswerH2(main);
  if (main === mm[1]) return html;
  return html.replace(mm[1], () => main);
}

module.exports = { DANGLING, QUICK_ANSWER_GUIDES, selfContainedFirst, seatAnswerShape };
