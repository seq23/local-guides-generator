#!/usr/bin/env node
'use strict';
/**
 * Answer-shape contract for the rendered pack.
 *
 * The shape an answer engine can actually lift has four properties, and each one
 * of them was violated by the library before this existed:
 *
 *   1. The heading is the question the searcher asked. Every answer block on
 *      every page opened with the label "Short answer", which matches no query.
 *   2. The span underneath it targets 40-60 words. Below 40 it is a fragment
 *      that only means something next to the rest of the page; above 60 an
 *      extractor truncates it mid-clause. Per lib/floors.js (owner ruling
 *      2 Nov 2026) it fails only under 75% of 40 (30 words); a near miss or
 *      anything over 60 is a note.
 *   3. It targets the first 100 words of the page body, because that is
 *      where the citation actually comes from. Over a word limit never
 *      fails, so a later start is a note.
 *   4. It opens with a noun, not a pronoun pointing at something outside it.
 *      "It is a required immigration medical examination" is a sentence about
 *      nothing once it is quoted on its own.
 *
 * 1 and 4 are wording, so they are notes (owner ruling 2 Nov 2026); the
 * generator produces them (scripts/lib/answer_shape_seat.js).
 *
 * It also checks that the recommendation_summary block reached every page that
 * has an answer surface at all, since the two are seated by the same pass.
 *
 * Pages with no answer surface - the legal, contact and operator pages - are
 * counted and exempted rather than failed. They have no searcher question.
 *
 * Usage: node scripts/validation/answer_shape_contract.js [--json]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.resolve(process.env.PAGES_OUT_DIR || path.join(ROOT, 'dist'));
const AS_JSON = process.argv.includes('--json');

const { hardFloor, judgeLength } = require('./lib/floors');
const MIN_WORDS = 40;
const MAX_WORDS = 60;
const WITHIN_WORDS = 100;
const { DANGLING } = require('../lib/answer_shape_seat');

const text = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (h) => text(h).split(/\s+/).filter(Boolean);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

if (!fs.existsSync(OUT_DIR)) {
  console.error(`answer_shape_contract: ${OUT_DIR} not found. Run a build first.`);
  process.exit(1);
}

const ANSWER_P = /<p[^>]*data-(?:citation-summary-answer|home-answer-span)="true"[^>]*>([\s\S]*?)<\/p>/i;
const files = walk(OUT_DIR).filter((f) => !/(^|[\\/])404\.html$/.test(f)).sort();

let problems = [];
const notes = [];

let checked = 0;
let exempt = 0;
let withSummaryBlock = 0;

for (const file of files) {
  const rel = path.relative(OUT_DIR, file);
  const html = fs.readFileSync(file, 'utf8');
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [, html])[1];
  const m = main.match(ANSWER_P);
  if (!m) { exempt += 1; continue; }
  checked += 1;

  // 1. the heading directly above the span is a question
  const before = main.slice(0, main.indexOf(m[0]));
  const heads = [...before.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  const heading = heads.length ? text(heads[heads.length - 1][1]) : '';
  if (!heading) problems.push(`${rel}: answer span has no heading above it`);
  else if (!heading.endsWith('?')) notes.push(`${rel}: heading is not a question: "${heading}"`);

  // 2. 40-60 words
  const n = words(m[1]).length;
  const verdict = judgeLength(n, MIN_WORDS, MAX_WORDS);
  const spanLine = `${rel}: answer span is ${n} words, target ${MIN_WORDS}-${MAX_WORDS}, fails under ${hardFloor(MIN_WORDS)}`;
  if (verdict === 'fail') problems.push(spanLine);
  else if (verdict === 'note') notes.push(spanLine);

  // 3. inside the first 100 words of the body
  const at = words(before).length;
  if (at > WITHIN_WORDS) {
    notes.push(`${rel}: answer span starts ${at} words into the page, target is within ${WITHIN_WORDS}`);
  }

  // 4. self-contained opening
  const span = text(m[1]);
  if (DANGLING.test(span)) notes.push(`${rel}: answer span opens with a pronoun pointing outside it: "${span.slice(0, 60)}..."`);

  if (html.includes('data-content-block="recommendation_summary"')) withSummaryBlock += 1;
  else problems.push(`${rel}: has an answer surface but no recommendation_summary block`);
}

// Pre-existing failures are sealed, not retro-failed. This contract only began
// seeing four of the five packs when the hard-fail tier moved inside the per-pack
// build loop -- before that it ran once, against whichever pack built last, so
// four verticals' rendered pages were never checked by it. Failing them all at
// once on the day they became visible would mean either a rushed rewrite or
// switching the gate off; sealing keeps the gate live and the debt named.
//
// Adding a route here is NOT how to pass this contract. Each sealed route is a
// page that needs authoring: several have an "answer" that is really the
// generator's brief ("<title> should answer the practical decision question
// first..."), which is why retrofit_recommendation_summary.js correctly refuses
// to seat a block on them -- there is no recommendation to locate.
const SEAL_PATH = path.join(ROOT, 'data', 'contracts', 'answer_shape_baseline.json');
const sealed = fs.existsSync(SEAL_PATH)
  ? new Set((JSON.parse(fs.readFileSync(SEAL_PATH, 'utf8')).sealed_routes || []))
  : new Set();
const sealedHits = problems.filter((m) => sealed.has(String(m).split(':')[0].trim()));
problems = problems.filter((m) => !sealed.has(String(m).split(':')[0].trim()));

const report = {
  out_dir: path.relative(ROOT, OUT_DIR) || '.',
  sealed_pre_existing: sealedHits.length,
  pages: files.length,
  with_answer_shape: checked,
  exempt_no_answer_surface: exempt,
  with_recommendation_summary: withSummaryBlock,
  notes,
  problems,
  status: problems.length ? 'FAIL' : 'PASS',
};

if (AS_JSON) console.log(JSON.stringify(report, null, 2));
else {
  console.log(
    `ANSWER SHAPE ${report.status}: ${checked}/${files.length} pages carry an answer of ${hardFloor(MIN_WORDS)}+ words (target ${MIN_WORDS}-${MAX_WORDS}) under a question heading; ` +
    `${withSummaryBlock} carry a recommendation_summary; ${exempt} exempt (no answer surface).`
  );
  for (const p of notes.slice(0, 20)) console.log(`  NOTE  ${p}`);
  if (notes.length > 20) console.log(`  ... and ${notes.length - 20} more notes`);
  for (const p of problems.slice(0, 40)) console.log(`  FAIL  ${p}`);
  if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
}
process.exit(problems.length ? 1 : 0);
