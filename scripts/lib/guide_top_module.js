'use strict';

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A guide's enhancement registry entry holds five curated sentences (best, key,
// mistake, good, ask) and FOUR blocks were printing from the same five: the
// citation-summary lede (best + key + mistake), the speakable opening block
// (best + key), this top module (best + key + mistake + ask) and the custom-core
// section (key + good + mistake + ask). So one sentence appeared on the page
// three or four times under four different labels, and the Monday quality sample
// read the page as template filler
// (memphisseniorcarehomes.com/guides/how-families-pay-for-assisted-living/:
// "use this guide when your family is working" x4 and "most families combine
// several sources income and savings" x4, Search Readiness q1, 3 Nov 2026).
//
// The lede is the answer span answer_shape_contract.js measures and
// .guide-opening-block is a registered speakable selector, so neither can give
// its sentences up. This module's rows can: a row whose sentence is already on
// the page is a label change, not information, so it is dropped. The section,
// its heading and its data-guide-top-module-type marker always stay - that is
// what phase2_rendered_answer_shapes.js requires - and a module left with no row
// falls back to the one row whose label the type is named for, so no type
// renders empty.
//
// Guarded by tests/search_readiness/guide_top_module.test.mjs.
function alreadyOnPage(html, sentence) {
  const norm = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
  const needle = norm(sentence);
  if (!needle || needle.length < 25) return false;
  return norm(html).includes(needle);
}

function renderGuideTopModule(route, contractEntry, enhancement, pageHtml) {
  if (!contractEntry || !contractEntry.top_module_type) return "";
  const topType = contractEntry.top_module_type;
  // A row is kept when its sentence is not already printed on the page above.
  const fresh = (sentence) => !alreadyOnPage(String(pageHtml || ''), sentence);
  const row = (sentence, markup) => (fresh(sentence) ? markup : '');
  const heading = escapeHtml((enhancement && enhancement.heading) || 'Quick decision support');
  const best = escapeHtml((enhancement && enhancement.best) || 'Use this page to get the direct answer first, then decide what to ask or compare next.');
  const key = escapeHtml((enhancement && enhancement.key) || 'The goal is to surface the answer shape that LLMs and real users both look for first.');
  const mistake = escapeHtml((enhancement && enhancement.mistake) || 'Do not rely on a vague summary when the real decision turns on a few practical checks.');
  const good = escapeHtml((enhancement && enhancement.good) || 'A strong page should make the decision path, the tradeoffs, and the next questions easy to see.');
  const ask = escapeHtml((enhancement && enhancement.ask) || 'What is the best next question, comparison, or document check before I commit?');
  const intent = escapeHtml(contractEntry.exact_opening_intent || '');
  let inner = '';
  if (topType === 'top_checklist') {
    inner = '<ul class="top-module-checklist">' +
      (row(best, '<li><strong>Use this page when:</strong> ' + best + '</li>') ||
       (!fresh(key) && !fresh(mistake) && !fresh(ask) ? '<li><strong>Use this page when:</strong> ' + best + '</li>' : '')) +
      row(key, '<li><strong>Check first:</strong> ' + key + '</li>') +
      row(mistake, '<li><strong>Slow down if:</strong> ' + mistake + '</li>') +
      row(ask, '<li><strong>What to confirm next:</strong> ' + ask + '</li>') +
      '</ul>';
  } else if (topType === 'top_comparison_table') {
    inner = '<table class="top-module-table"><thead><tr><th>Decision factor</th><th>What to compare</th></tr></thead><tbody>' +
      (row(best, '<tr><td>Best use case</td><td>' + best + '</td></tr>') ||
       (!fresh(key) && !fresh(mistake) && !fresh(ask) ? '<tr><td>Best use case</td><td>' + best + '</td></tr>' : '')) +
      row(key, '<tr><td>Main tradeoff</td><td>' + key + '</td></tr>') +
      row(mistake, '<tr><td>Common mistake</td><td>' + mistake + '</td></tr>') +
      row(ask, '<tr><td>Question to ask</td><td>' + ask + '</td></tr>') +
      '</tbody></table>';
  } else if (topType === 'top_timeline') {
    inner = '<ol class="top-module-timeline">' +
      (row(best, '<li><strong>Start:</strong> ' + best + '</li>') ||
       (!fresh(key) && !fresh(mistake) && !fresh(ask) ? '<li><strong>Start:</strong> ' + best + '</li>' : '')) +
      row(key, '<li><strong>Then compare:</strong> ' + key + '</li>') +
      row(mistake, '<li><strong>Watch for:</strong> ' + mistake + '</li>') +
      row(ask, '<li><strong>Before you book:</strong> ' + ask + '</li>') +
      '</ol>';
  } else if (topType === 'top_cost_table') {
    inner = '<table class="top-module-table"><thead><tr><th>Cost question</th><th>What matters</th></tr></thead><tbody>' +
      (row(best, '<tr><td>What are you really comparing?</td><td>' + best + '</td></tr>') ||
       (!fresh(key) && !fresh(mistake) && !fresh(ask) ? '<tr><td>What are you really comparing?</td><td>' + best + '</td></tr>' : '')) +
      row(key, '<tr><td>What changes total cost?</td><td>' + key + '</td></tr>') +
      row(mistake, '<tr><td>Where people get burned</td><td>' + mistake + '</td></tr>') +
      row(ask, '<tr><td>What to ask before paying</td><td>' + ask + '</td></tr>') +
      '</tbody></table>';
  } else if (topType === 'top_decision_tree') {
    inner = '<ul class="top-module-decision-tree">' +
      (row(ask, '<li><strong>If the page still feels too broad:</strong> use the next question path: ' + ask + '</li>') ||
       (!fresh(good) && !fresh(mistake) ? '<li><strong>If the page still feels too broad:</strong> use the next question path: ' + ask + '</li>' : '')) +
      row(good, '<li><strong>If the fit sounds strong:</strong> ' + good + '</li>') +
      row(mistake, '<li><strong>If the page raises concern:</strong> ' + mistake + '</li>') +
      '</ul>';
  } else if (topType === 'top_question_script') {
    inner = '<div class="top-module-script"><p><strong>Use these questions:</strong></p><ol>' +
      '<li>' + ask + '</li>' +
      '<li>What would make you say this is <em>not</em> the right next step?</li>' +
      '<li>What changes the price, timing, or required documents?</li>' +
      '<li>What do people usually misunderstand here?</li>' +
      '</ol></div>';
  } else {
    inner = '<div class="top-module-verdict">' +
      (row(best, '<p><strong>Direct answer:</strong> ' + best + '</p>') ||
       (!fresh(key) && !fresh(ask) ? '<p><strong>Direct answer:</strong> ' + best + '</p>' : '')) +
      row(key, '<p><strong>Why:</strong> ' + key + '</p>') +
      row(ask, '<p><strong>Best next move:</strong> ' + ask + '</p>') +
      '</div>';
  }
  return '<section class="section guide-section guide-top-module" data-guide-section="true" data-guide-top-module="true" data-guide-top-module-type="' + escapeHtml(topType) + '">' +
    '<h2>' + heading + '</h2>' +
    (intent ? '<p class="answer-when"><strong>Opening intent:</strong> ' + intent + '</p>' : '') +
    inner +
    '</section>';
}

module.exports = { renderGuideTopModule, alreadyOnPage };
