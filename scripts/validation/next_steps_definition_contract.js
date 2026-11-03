/* eslint-disable no-console */
/**
 * Every rendered next-steps page opens with a real definition: a 40-60 word
 * paragraph containing the copula, directly under the H1.
 *
 * WHY: the paragraph under the H1 used to be a 22-word label ("Use this page when
 * you want everything in one place: ...") that said what the page was FOR and never
 * what it IS, so the one span an answer engine is most likely to lift defined
 * nothing. The Search Readiness page-shape check (item b4) failed every
 * /<city>/next-steps/ and /states/<ST>/next-steps/ page of four canonical sites on
 * 3 Nov 2026 with "opening paragraph is 22 words and defines nothing (needs 40-60,
 * 'X is ...')".
 *
 * This counts the words the way that checker counts them and requires the copula,
 * so the window cannot drift back shut as the copy is edited. Hard-fails on zero
 * next-steps pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MIN_WORDS = 40;
const MAX_WORDS = 60;

// The same word rule as the auditor: runs starting with a letter or digit.
const wordCount = (text) => (String(text).match(/[A-Za-z0-9][\w'’-]*/g) || []).length;
const visible = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' ').replace(/\s+/g, ' ').trim();

function nextStepsPages(distDir) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'index.html' && /(^|\/)next-steps$/.test(path.relative(distDir, dir).replace(/\\/g, '/'))) out.push(full);
    }
  };
  walk(distDir);
  return out;
}

function run() {
  const distDir = path.join(ROOT, 'dist');
  const pages = nextStepsPages(distDir);
  if (pages.length === 0) {
    throw new Error('NEXT STEPS DEFINITION CONTRACT FAIL\n - dist/ has no next-steps page: nothing was checked, which is not a pass');
  }
  const bad = [];
  for (const file of pages) {
    const rel = path.relative(distDir, file);
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<p\b[^>]*data-next-steps-definition="true"[^>]*>([\s\S]*?)<\/p>/i);
    if (!m) { bad.push(`${rel}: no data-next-steps-definition paragraph under the H1`); continue; }
    const text = visible(m[1]);
    const n = wordCount(text);
    if (n < MIN_WORDS || n > MAX_WORDS) bad.push(`${rel}: definition is ${n} words (needs ${MIN_WORDS}-${MAX_WORDS})`);
    if (!/\b(is|are)\b/.test(text)) bad.push(`${rel}: definition never says what the page is ("X is ...")`);
    // It must really be the first substantial paragraph after the H1, which is the
    // only position the checker reads.
    const after = html.split(/<\/h1>/i)[1] || '';
    const first = [...after.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => x[0]).find((p) => wordCount(visible(p)) >= 20);
    if (first && !/data-next-steps-definition="true"/.test(first)) {
      bad.push(`${rel}: another paragraph of 20+ words comes before the definition, so the definition is not what gets read`);
    }
  }
  if (bad.length) throw new Error('NEXT STEPS DEFINITION CONTRACT FAIL\n' + bad.map((b) => ' - ' + b).join('\n'));
  console.log(`✅ next-steps definition contract pass (${pages.length} page(s), ${MIN_WORDS}-${MAX_WORDS} words with a copula)`);
}

if (require.main === module) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { run };
