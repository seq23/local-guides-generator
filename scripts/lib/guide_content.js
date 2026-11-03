'use strict';

// Extract only authored material. Never manufacture a price, a credential, a
// source, or a generic answer to fill a missing editorial field.
function text(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function answerFromSource(html) {
  const paragraphs = [...String(html || '').matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)];
  for (const [, attrs, content] of paragraphs) {
    if (/kicker|muted|fineprint/.test(attrs)) continue;
    const plain = text(content);
    if (/^(Educational|General information|Source:|Not medical|This guide|Use this|It |They |That |These )/i.test(plain) || /should answer the practical decision/.test(plain)) continue;
    const sentences = content.match(/[\s\S]+?(?:[.!?](?=\s|<|$)|$)/g) || [];
    let answer = '';
    for (const sentence of sentences) {
      const candidate = (answer + ' ' + sentence.trim()).trim();
      if (answer && text(candidate).split(/\s+/).length > 60) break;
      answer = candidate;
      if (text(answer).split(/\s+/).length >= 40) break;
    }
    // A short label, a fragment or an unbalanced link is not an answer. Leave
    // it in the article and let the curated registry supply the opening.
    if (text(answer).split(/\s+/).length < 40) continue;
    if ((answer.match(/<a\b/g) || []).length !== (answer.match(/<\/a>/g) || []).length) continue;
    return answer;
  }
  return '';
}
function faqFromSource(html, entry) {
  // Reuse the page's own question/answer pairs visibly. A table or a list is
  // retained in the article rather than being flattened into invented prose.
  const pairs = [...String(html || '').matchAll(/<h[23]\b[^>]*>([^<]*\?[^<]*)<\/h[23]>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .filter((m) => !/sources|next step|what is the answer/i.test(m[1]) && text(m[2]).split(/\s+/).length >= 15)
    .slice(0, 2);
  if (!pairs.length && entry && entry.good && entry.mistake) {
    return '<section class="guide-faq" data-guide-faq="true"><h2>What else should you know?</h2><h3>What should the provider explain?</h3><p>' + escape(entry.good) + '</p><h3>What mistake should you avoid?</h3><p>' + escape(entry.mistake) + '</p></section>';
  }
  if (!pairs.length) return '';
  return '<section class="guide-faq" data-guide-faq="true"><h2>What else should you know?</h2>' + pairs.map((m) => '<h3>' + escape(m[1]) + '</h3><p>' + m[2] + '</p>').join('') + '</section>';
}
function recommendationFromSource(html) {
  for (const m of String(html || '').matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const plain = text(m[2]);
    if (/^(Ask|Confirm|Check|Bring|Compare|Keep|Request|Use the official)\b/.test(plain) && plain.split(/\s+/).length >= 15) return m[2];
  }
  return '';
}
function assertDistinctGuides(pages) {
  const guides = pages.filter((p) => /^\/guides\/.+\/$/.test(p.route || ''));
  if (!guides.length) throw new Error('No guide candidates to publish');
  const fingerprints = guides.map((p) => {
    const words = text(p.main_html).toLowerCase().match(/[a-z0-9]+/g) || [];
    if (words.length < 5) throw new Error('Empty guide candidate: ' + p.route);
    const grams = new Set();
    for (let i = 0; i + 4 < words.length; i++) grams.add(words.slice(i, i + 5).join(' '));
    return { route: p.route, grams };
  });
  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      const a = fingerprints[i], b = fingerprints[j];
      let shared = 0;
      for (const gram of a.grams) if (b.grams.has(gram)) shared++;
      if (2 * shared / (a.grams.size + b.grams.size) >= 0.85) {
        throw new Error('Consolidate near-duplicate guide candidates before publishing: ' + a.route + ' and ' + b.route);
      }
    }
  }
}
module.exports = { answerFromSource, faqFromSource, recommendationFromSource, assertDistinctGuides };
