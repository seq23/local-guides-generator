#!/usr/bin/env node
/**
 * Seat a recommendation_summary block on every rendered page that has one to
 * state.
 *
 * recommendation_summary is the single most-requested block in the agent data,
 * and this library had it on 0 of 184 pages. It is a short statement of what the
 * page actually recommends, placed where an answer engine will reach it.
 *
 * Adapted from scripts/retrofit_recommendation_summary.js in
 * local-guides-citation-velocity. Two things carried over unchanged, both
 * because they were paid for once already:
 *
 *   - BLOCK_RE is anchored to the block's own closing div. An earlier greedy
 *     version matched to the next "</ul></div>" anywhere in the document, which
 *     on a page whose block had no list swallowed everything up to the next
 *     list - deleting real content, including 30 disclosed affiliate links. Do
 *     not loosen that anchor.
 *   - Nothing is generated. Every word emitted is lifted from the page's own
 *     content. A page whose recommendation cannot be located is reported and
 *     skipped rather than given a placeholder, because a block that announces a
 *     gap is filler for readers and noise for extraction.
 *
 * What is new here, and why:
 *
 *   - This repo is a generator. Its pages are rendered into dist/ and the
 *     reference script skips dist/ by design (it walks a repo whose pages are
 *     committed). So this walks the rendered output directory instead, and is
 *     wired into the build ahead of install_clarity.js - before anything hashes
 *     the page - so a regenerated pack does not lose the block.
 *
 *   - The extractors are this repo's. Its answer surface is a
 *     `data-citation-summary` section, its per-page conclusion is
 *     `data-eval-best-for` / `data-eval-avoid-if`, and its conversion link is a
 *     `data-primary-conversion-cta` button. The reference script's generic
 *     detectors found none of those: they fell through to the hero's `.kicker`
 *     paragraph, which produced the recommendation "About" on /about/ and "FAQ"
 *     on /faq/, and to the header nav's "Contact" link as the next step.
 *
 *   - Duplicate answers are demoted corpus-wide. The strongest candidate on all
 *     57 next-steps pages used to be one paragraph that was byte-identical on
 *     every one of them. Quoting it would put the same sentence at the top of 57
 *     pages, which is the failure the reference script's BOILERPLATE list exists
 *     to prevent - it just cannot be spotted one page at a time. So candidates
 *     are gathered for the whole corpus first, and any candidate shared by more
 *     than MAX_SHARED pages is dropped in favour of the page's next one.
 *
 * Usage: node scripts/retrofit_recommendation_summary.js [--apply] [--out DIR]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const outIdx = argv.indexOf('--out');
const OUT_DIR = path.resolve(outIdx >= 0 ? argv[outIdx + 1] : (process.env.PAGES_OUT_DIR || 'dist'));

const MARK = 'data-content-block="recommendation_summary"';
// The block contains no nested div, so the first closing div after it is its
// own. See the header: this anchor is load-bearing.
const BLOCK_RE = /<div class="[^"]*recommendation-summary[^"]*"[^>]*>(?:(?!<div\b)[\s\S])*?<\/div>/i;

// A candidate quoted on more than this many pages is chrome, not this page's
// recommendation. Three allows a genuinely shared answer across a small family
// without letting a 57-way duplicate through.
const MAX_SHARED = 3;
const MIN_WORDS = 10;
const MAX_CHARS = 320;

const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&middot;/g, '·').replace(/&mdash;/g, '—')
  .replace(/\s+/g, ' ')
  // Removing <strong>Atlanta, GA</strong> leaves "Atlanta, GA , four things".
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

// Labels this repo's templates prefix onto their own answers. They are
// scaffolding, not the recommendation; the words after the colon are the page's.
const LABEL_PREFIX = /^(short answer|quick answer|direct answer|answer|bottom line|summary|tl;?dr|best for|what usually matters most|common mistake|do not use this section as|use this hub when|best used when)\s*[:—-]\s*/i;

/** One sentence, kept whole. A fragment reads as broken wherever it is quoted. */
function firstSentence(text, max = MAX_CHARS) {
  let t = String(text || '').trim();
  for (let i = 0; i < 4; i += 1) {
    const before = t;
    t = t.replace(LABEL_PREFIX, '').trim();
    if (t === before) break;
  }
  if (!t) return '';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  // A terminator may be followed by a closing quote or bracket; without allowing
  // them the first boundary is missed and the whole paragraph overflows max.
  const m = t.match(/^(.{40,}?[.!?]["'”’)\]]?)(\s|$)/);
  const s = m ? m[1] : t;
  return s.length <= max ? s : '';
}

// Strings this build injects verbatim on many pages. They are real content, but
// they state nothing about what THIS page recommends.
const BOILERPLATE = [
  /^use these owned routes first/i,
  /^published by /i,
  /^educational only/i,
  /^general educational information only/i,
  /^these routes support fanout/i,
  /^this site is static/i,
  /^start with your state to narrow/i,
  /^use the faq, methodology, or guides hub/i,
  /^the same routing system can capture/i,
  /^neutral, checklist-based/i,
  /^this page is educational and is designed/i,
  /^advertising placements are clearly labeled/i,
  /^we (?:respond personally|do not sell)/i,
  /^lightweight operator page/i,
  /^use this page when you want everything in one place/i,
];
const isBoilerplate = (s) => BOILERPLATE.some((re) => re.test(String(s || '').trim()));

// A span that opens with a bare pronoun is not extractable: "It is a required
// immigration medical examination" only means anything next to the FAQ question
// above it, and an answer engine quoting it alone quotes a sentence about
// nothing. "This page" and "That fee" are fine - the noun is inside the span.
const DANGLING_PRONOUN = /^(it|they|he|she|these|those|here|there|its|their|his|her)\b|^(this|that)\s+(is|was|are|were|can|will|would|should|does|did|has|have|means)\b/i;

const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** A restatement of the title is not a summary - it tells the reader nothing. */
function informative(candidate, title) {
  const c = norm(candidate);
  if (!c) return false;
  if (wordCount(candidate) < MIN_WORDS) return false;
  if (DANGLING_PRONOUN.test(String(candidate).trim())) return false;
  const t = norm(title);
  if (!t) return true;
  if (c === t) return false;
  return !(c.startsWith(t) && c.length - t.length < 24);
}

const firstMatch = (html, re) => { const m = html.match(re); return m ? strip(m[1]) : ''; };

/** The 40-60 word span the page already leads with, so it is not simply echoed. */
function answerSpanOf(html) {
  return firstMatch(html, /<p[^>]*data-(?:citation-summary-answer|home-answer-span|next-steps-answer)="true"[^>]*>([\s\S]*?)<\/p>/i);
}

/**
 * Candidate recommendations for one page, strongest first.
 *
 * Every one of these is a surface this build marks as an answer - there is no
 * generic body-prose fallback, deliberately. The reference script's fallback
 * read the hero's `.kicker` paragraph and returned the word "About" as the
 * /about/ page's recommendation. A page with no marked answer surface is a page
 * with nothing to recommend, and is skipped.
 */
function candidatesOf(html) {
  const title = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const out = [];
  const add = (text) => {
    const s = firstSentence(text);
    if (s && !isBoilerplate(s) && informative(s, title)) out.push(s);
  };

  // Most page-specific first. The block sits directly beneath the page's answer
  // span, so restating that span word for word would put the same 45 words twice
  // on one screen. These come first precisely because they are different
  // sentences: the city checklist lead names the market, the guide's own quick
  // answer is written per guide. The span itself is still a candidate - it is
  // the right answer on a page that has nothing else - but it is demoted below.
  add(firstMatch(html, /<section[^>]*data-city-local-checklist="true"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<h3[^>]*>\s*Quick answer\s*<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*class="answer-context"[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*data-citation-summary-answer="true"[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*data-next-steps-answer="true"[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*data-home-answer-span="true"[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*class="answer-when"[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*class="answer-tradeoff"[^>]*>([\s\S]*?)<\/p>/i));
  add(firstMatch(html, /<p[^>]*data-citation-summary-lede="true"[^>]*>([\s\S]*?)<\/p>/i));
  // The home page's answer block predates the marked span in some packs.
  add(firstMatch(html, /<section[^>]*data-home-answer="true"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i));

  // Deliberately no generic body-prose fallback. Every candidate above comes
  // from a surface this build marks as an answer. Reading arbitrary body
  // paragraphs is what produced "Basic server logs may be collected by hosting
  // providers" as the privacy page's recommendation and "Spry Labs is the
  // operating publisher" as the about page's: true sentences, on pages that
  // recommend nothing. Those pages are reported and skipped instead.
  return [...new Set(out)];
}

/** "Best for" / "Not for", from the page's own conclusion panels. */
function pointsOf(html) {
  const best = firstSentence(firstMatch(html, /<p[^>]*data-eval-best-for="true"[^>]*>([\s\S]*?)<\/p>/i));
  const not = firstSentence(firstMatch(html, /<p[^>]*data-eval-avoid-if="true"[^>]*>([\s\S]*?)<\/p>/i));
  return { best, not };
}

/**
 * The page's conversion link.
 *
 * Anchored to the markers the build puts on it. The reference script's generic
 * detector matched the header nav's "Contact" link on every page, because a nav
 * link is an <a> with a label that starts with "contact".
 */
function primaryCta(html) {
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [, ''])[1] || html;
  const scopes = [
    (main.match(/<section[^>]*data-primary-conversion-cta="true"[^>]*>[\s\S]*?<\/section>/i) || [])[0],
    (main.match(/<a\b[^>]*data-next-steps-primary="true"[^>]*>[\s\S]*?<\/a>/i) || [])[0],
    (main.match(/<a\b[^>]*class="[^"]*\bbutton-primary\b[^"]*"[^>]*>[\s\S]*?<\/a>/i) || [])[0],
  ].filter(Boolean);
  for (const scope of scopes) {
    const a = scope.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const attrs = a[1];
    const label = strip(a[2]);
    const href = (attrs.match(/href="([^"]+)"/i) || [])[1];
    if (!href || !label || href.startsWith('#')) continue;
    // Carry the original link's rel. Copying a link into a summary block without
    // its rel silently drops a disclosure the repo requires.
    const rel = (attrs.match(/rel="([^"]+)"/i) || [])[1];
    return { href, label, rel };
  }
  return null;
}

function buildBlock(html, rec) {
  if (!rec) return null;
  const { best, not } = pointsOf(html);
  const cta = primaryCta(html);
  const points = [];
  if (best) points.push(`<li><strong>Best for:</strong> ${esc(best)}</li>`);
  if (not) points.push(`<li><strong>Not for:</strong> ${esc(not)}</li>`);
  if (cta) {
    const relAttr = cta.rel ? ` rel="${esc(cta.rel)}"` : '';
    // The href is copied verbatim from the page, where it is already
    // HTML-escaped. Escaping it again turns every &amp; into &amp;amp; and the
    // tracking parameters stop parsing.
    points.push(`<li><strong>Next step:</strong> <a href="${cta.href}"${relAttr}>${esc(cta.label)}</a></li>`);
  }
  return `<div class="section info-panel recommendation-summary" ${MARK} id="recommendation-summary">`
    + `<h2>What this page recommends</h2>`
    + `<p class="recommendation-summary__answer">${esc(rec)}</p>`
    + (points.length ? `<ul class="recommendation-summary__points">${points.join('')}</ul>` : '')
    + `</div>`;
}

/**
 * Insert high on the page: most AI-answer citations come from the opening third.
 *
 * Directly after the answer section the block summarises, which on these
 * templates is a sibling of it and still well inside the first third. Falling
 * back to "before the first h2" would seat it between a section's badge and its
 * own heading, and falling back to "after the first closing div" - the reference
 * script's last resort - lands inside the conversion CTA's panel div, because
 * the hero on these pages contains no div at all.
 */
function insert(html, block) {
  html = html.replace(BLOCK_RE, '');
  const anchors = [
    /<section[^>]*data-citation-summary="true"[^>]*>[\s\S]*?<\/section>/i,
    /<section[^>]*data-home-answer="true"[^>]*>[\s\S]*?<\/section>/i,
    /<div class="card"[^>]*data-next-steps-page-intro="true"[^>]*>[\s\S]*?<\/div>/i,
    /<section class="hero"[^>]*>[\s\S]*?<\/section>/i,
  ];
  for (const re of anchors) {
    const m = html.match(re);
    if (!m) continue;
    const at = html.indexOf(m[0]) + m[0].length;
    return html.slice(0, at) + '\n' + block + html.slice(at);
  }
  return null;
}

function walk(dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// A 404 has nothing to recommend and is noindex besides.
const EXCLUDE = /(^|\/)404\.html$/;

function run() {
  const files = walk(OUT_DIR).filter((f) => !EXCLUDE.test(f.replace(/\\/g, '/')));
  const pages = [];
  const shared = new Map();
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/<h1[\s>]/i.test(html)) continue;
    const source = html.replace(BLOCK_RE, '');
    const cands = candidatesOf(source);
    pages.push({ file, html, source, cands });
    for (const c of new Set(cands)) shared.set(c, (shared.get(c) || 0) + 1);
  }

  let added = 0; let replaced = 0; let unchanged = 0;
  const skipped = [];
  for (const page of pages) {
    const usable = page.cands.filter((c) => (shared.get(c) || 0) <= MAX_SHARED);
    // A candidate that is the answer span, or its opening sentence, is a
    // restatement of the paragraph immediately above this block. Take it only if
    // the page offers nothing else.
    const span = answerSpanOf(page.source);
    const echo = (c) => Boolean(span) && (c === span || span.startsWith(c));
    const rec = usable.find((c) => !echo(c)) || usable[0] || null;
    if (!rec) { skipped.push(path.relative(OUT_DIR, page.file)); continue; }
    const block = buildBlock(page.source, rec);
    const next = block ? insert(page.html, block) : null;
    if (!next) { skipped.push(path.relative(OUT_DIR, page.file)); continue; }
    const had = page.html.includes(MARK);
    if (next === page.html) { unchanged += 1; continue; }
    if (APPLY) fs.writeFileSync(page.file, next);
    if (had) replaced += 1; else added += 1;
  }

  const covered = added + replaced + unchanged;
  console.log(
    `recommendation_summary: ${covered}/${pages.length} pages carry a block ` +
    `(added=${added} replaced=${replaced} unchanged=${unchanged} skipped=${skipped.length}) ` +
    `(${APPLY ? 'APPLIED' : 'dry run'}) out=${path.relative(process.cwd(), OUT_DIR) || '.'}`
  );
  if (skipped.length) {
    console.log('no recommendation found on page - left unchanged rather than filled:');
    for (const s of skipped.slice(0, 25)) console.log('  ' + s);
    if (skipped.length > 25) console.log(`  ... and ${skipped.length - 25} more`);
  }
  return { covered, total: pages.length, skipped };
}

module.exports = { run, candidatesOf, buildBlock, insert, primaryCta, MARK, BLOCK_RE };

if (require.main === module) run();
