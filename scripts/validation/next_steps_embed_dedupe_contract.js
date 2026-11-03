/* eslint-disable no-console */
/**
 * A next-steps hub embeds the request-assistance FORM, never the explanatory prose
 * that the canonical /request-assistance/ page owns.
 *
 * WHY: 344 words of that page's explanation ("What this tool does", "Who this is
 * for", "What this tool is not", "What happens after submission", "What to submit",
 * "Important limits") shipped byte-for-byte on all 57 next-steps pages of every
 * pack. Two city next-steps pages picked at random came back 77% identical and the
 * Monday quality sample scored them template filler (Search Readiness q1,
 * 3 Nov 2026), and it pointed 57 near-copies of that copy at the one page that
 * should rank for it.
 *
 * What must stay true: the form is still there, with the compliance lines a visitor
 * needs before submitting, and the full explanation is still one click away. What
 * must stay false: those sections being embedded again.
 *
 * The canonical /request-assistance/ page itself is exempt - it is where the prose
 * belongs. Hard-fails on zero next-steps pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// The sections that belong only on /request-assistance/.
const PROSE_MARKERS = ['who-its-for', 'what-happens-next'];
// Lines a visitor must still see next to the embedded form.
const COMPLIANCE = [
  'We do not rank providers',
  'Do not submit sensitive case facts',
  'educational only and does not provide professional advice',
];

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
    throw new Error('NEXT STEPS EMBED DEDUPE CONTRACT FAIL\n - dist/ has no next-steps page: nothing was checked, which is not a pass');
  }
  const bad = [];
  let withForm = 0;
  for (const file of pages) {
    const rel = path.relative(distDir, file);
    const html = fs.readFileSync(file, 'utf8');
    for (const marker of PROSE_MARKERS) {
      if (html.includes(`data-request-assistance-${marker}="true"`)) {
        bad.push(`${rel}: embeds the /request-assistance/ "${marker}" prose section again`);
      }
    }
    // Only pages that actually carry the embedded form owe the rest.
    if (!html.includes('data-request-assistance-form-primary="true"')) continue;
    withForm += 1;
    for (const line of COMPLIANCE) {
      if (!html.includes(line)) bad.push(`${rel}: embeds the form but dropped the compliance line "${line}"`);
    }
    if (!html.includes('data-request-assistance-detail-link="true"')) {
      bad.push(`${rel}: embeds the form but does not link the full explanation on /request-assistance/`);
    }
  }
  if (withForm === 0) {
    bad.push(`none of the ${pages.length} next-steps page(s) carries the request-assistance form: the conversion path is gone`);
  }
  if (bad.length) throw new Error('NEXT STEPS EMBED DEDUPE CONTRACT FAIL\n' + bad.map((b) => ' - ' + b).join('\n'));
  console.log(`✅ next-steps embed dedupe contract pass (${pages.length} page(s), ${withForm} carrying the form)`);
}

if (require.main === module) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { run };
