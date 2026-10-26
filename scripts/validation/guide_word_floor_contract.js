#!/usr/bin/env node
'use strict';
/**
 * Every /guides/ page in an enforced pack carries at least 1,800 words.
 *
 * The defect this exists to stop. The Search Readiness Checklist (item j3)
 * requires each guide to carry at least 1,800 words of answer, because that is
 * the shape the answer engines already quote from these sites and the floor
 * below which a guide is a stub that loses the query to a thicker page. On
 * 25 Oct 2026 the checker sampled three dentistryguides.com guides and found
 * 1,086, 1,422 and 1,678 words. Sampling is the operative word: measuring every
 * rendered dentistry guide showed 19 of 23 under the floor. Nothing in the
 * repository measured it, so each weekly audit re-found whichever three pages
 * it happened to sample, and fixing those three would have left sixteen.
 *
 * What this checks. The rendered pack, with the audit's own measurement, so the
 * number here and the number in the brief are the same number:
 * scripts/validation/lib/visible_words.js is a transcription of visibleText()
 * and wordCount() from boss-os src/shared/boss/searchReadiness/audit.mjs. A
 * floor measured a different way is a floor that passes here and fails there.
 *
 * Why the enforced list is explicit. Only the packs whose guides are all over
 * the floor are enforced; the rest are named below with the queue brief that
 * covers them, and the run says so out loud. A validator that silently passed
 * the five unenforced packs would be the same invisible gap in a new place.
 * Adding a pack is the last step of fixing its guides, in the same change.
 *
 * Why PROVEN exists. A pack is enforced only once ALL of its guides clear the
 * floor, and these packs are fixed a few guides per weekly brief, so a guide
 * raised over the floor in an unenforced pack had nothing holding it there: the
 * pack-level skip meant the next edit could take it back under and no check
 * would notice until the brief came round again. PROVEN names every guide a
 * brief has already carried over the floor, and those are measured even when
 * their pack is skipped. The floor a guide has cleared is a floor it keeps.
 * Every brief that raises a guide adds it here in the same change.
 *
 * Usage: LKG_VALIDATE_DIST=1 PAGE_SET_FILE=<pack> node scripts/validation/guide_word_floor_contract.js
 * Runs in the hard_fail tier, which scripts/build_all_packs.js invokes once per
 * pack against that pack's own dist.
 */
const fs = require('fs');
const path = require('path');
const { visibleWordCount } = require('./lib/visible_words');

const FLOOR = 1800;

// Packs whose /guides/ pages are all over the floor and must stay there.
const ENFORCED = ['dentistry_v1.json'];

// Packs not yet enforced, with the Search Readiness brief that covers each.
// Fixing a pack's guides and leaving it here is an unfinished job, not a pass.
//
// Measured 26 Oct 2026 with visibleWordCount below, every rendered guide in the
// pack, so the next pass starts from the real number instead of re-sampling:
//   pi_v1    28 of 35 guides under the floor, lowest 1,173 (product-liability)
//   neuro_v1 19 of 32 guides under the floor, lowest 1,371
//            (what-to-expect-after-a-neuro-evaluation)
//   trt_v1   39 of 50 guides under the floor, lowest 1,059
//            (peptides-for-hair-loss-explained)
// The six guides the 26 Oct queue named are now over it
// (/guides/motorcycle-accidents/ 1,879; /guides/neuropsych-testing-overview/
// 1,874; /guides/peptide-program-costs/ 2,020;
// /guides/what-is-hair-microneedling/ 2,216;
// /guides/peptide-clinic-near-me/ 2,196; /guides/what-is-hair-botox/ 2,095),
// which is why those briefs are closed and these packs are not yet enforced:
// ~82 guides of substantive legal, clinical and treatment content remain, and
// padding them to clear a word count is the failure this floor exists to catch.
//
// Why the trt_v1 count did not fall by two. The two guides the 26 Oct queue
// named were fixed in this change, which took the pack from 41 under the floor
// to 39 -- the figure recorded above as 39 was measured before them and was
// already stale by two. The number here is now a fresh measurement of the
// rendered pack, taken after the fix, and the lowest page moved with it.
const PENDING = {
  'uscis_medical_v1.json': 'sr-uscisexam.com-j3',
  'pi_v1.json': 'sr-theaccidentguides.com-j3',
  'neuro_v1.json': 'sr-neuroevalguides.com-j3',
  'trt_v1.json': 'sr-hormonesivhair.com-j3',
  'senior_living_v1.json': 'no j3 brief open',
};

// Guides already carried over the floor by a Search Readiness brief, per pack.
// Their packs are still in PENDING because other guides in them are short, but
// these specific pages are measured on every run and may not fall back under.
const PROVEN = {
  'pi_v1.json': ['motorcycle-accidents'],
  'neuro_v1.json': ['neuropsych-testing-overview'],
  'trt_v1.json': [
    'peptide-program-costs',
    'what-is-hair-microneedling',
    'peptide-clinic-near-me',
    'what-is-hair-botox',
  ],
};

function fail(lines) {
  console.error(`❌ GUIDE WORD FLOOR FAIL — ${lines.join('\n')}`);
  process.exit(1);
}

function guidePages(distDir) {
  const dir = path.join(distDir, 'guides');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'index.html');
    if (fs.existsSync(file)) out.push({ slug: entry.name, file });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

function main() {
  const pack = path.basename(String(process.env.PAGE_SET_FILE || ''));
  const distDir = path.resolve(process.env.PAGES_OUT_DIR || 'dist');

  if (!ENFORCED.includes(pack)) {
    // Rule 0: no stage may exit 0 having done nothing without saying so. The
    // pack is not enforced, but any guide a brief already raised is.
    const why = PENDING[pack] ? `its guides are under the floor (${PENDING[pack]})` : 'it is not a known pack';
    const proven = PROVEN[pack] || [];
    let checked = 0;
    if (proven.length && process.env.LKG_VALIDATE_DIST === '1' && fs.existsSync(distDir)) {
      const regressed = [];
      const absent = [];
      for (const slug of proven) {
        const file = path.join(distDir, 'guides', slug, 'index.html');
        // A proven guide that stopped rendering is a regression too, not a skip.
        if (!fs.existsSync(file)) { absent.push(slug); continue; }
        checked += 1;
        const words = visibleWordCount(fs.readFileSync(file, 'utf8'));
        if (words < FLOOR) regressed.push({ slug, words });
      }
      if (absent.length) {
        fail([`${absent.length} guide(s) named in PROVEN for ${pack} are not in the rendered pack: ${absent.map((s) => `/guides/${s}/`).join(', ')}.`,
          'A guide a brief carried over the floor may not quietly stop being built.']);
      }
      if (regressed.length) {
        const lines = [`${regressed.length} guide(s) in ${pack} fell back under the ${FLOOR}-word floor after a brief had carried them over it:`];
        for (const r of regressed.sort((a, b) => a.words - b.words)) {
          lines.push(`    /guides/${r.slug}/  ${r.words} words  (needs ${FLOOR - r.words} more)`);
        }
        lines.push('');
        lines.push('These pages are listed in PROVEN in this file. Restore the substance that was removed;');
        lines.push('do not remove the page from PROVEN, which is the one edit this gate does not accept.');
        fail(lines);
      }
    }
    const held = checked
      ? ` ${checked} guide(s) already carried over the floor were re-measured and still clear it.`
      : (proven.length ? ' Its proven guides were not measured: no rendered pack here.' : '');
    console.log(`ℹ️ GUIDE WORD FLOOR SKIP — pack "${pack || '(none)'}" is not enforced: ${why}. Enforced: ${ENFORCED.join(', ')}.${held}`);
    return;
  }
  if (process.env.LKG_VALIDATE_DIST !== '1') {
    console.log(`ℹ️ GUIDE WORD FLOOR SKIP — LKG_VALIDATE_DIST is not 1, so there is no rendered pack to measure. The hard_fail tier sets it.`);
    return;
  }
  if (!fs.existsSync(distDir)) fail([`${distDir} does not exist; run a build for ${pack} first.`]);

  const pages = guidePages(distDir);
  // An empty measurement is the "runs but inert" defect, not a pass.
  if (!pages.length) fail([`no rendered /guides/ pages found under ${distDir}; ${pack} is enforced and must have them.`]);

  const short = [];
  for (const page of pages) {
    const words = visibleWordCount(fs.readFileSync(page.file, 'utf8'));
    if (words < FLOOR) short.push({ slug: page.slug, words });
  }

  if (short.length) {
    const lines = [`${short.length} of ${pages.length} ${pack} guide(s) are under the ${FLOOR}-word floor (Search Readiness item j3):`];
    for (const s of short.sort((a, b) => a.words - b.words)) {
      lines.push(`    /guides/${s.slug}/  ${s.words} words  (needs ${FLOOR - s.words} more)`);
    }
    lines.push('');
    lines.push('Add the substance the guide is missing to its data/page_sets/examples/<pack>_global_pages/');
    lines.push('source file. Padding passes this check and fails the reader, which is the point of the item.');
    fail(lines);
  }

  const lowest = Math.min(...pages.map((p) => visibleWordCount(fs.readFileSync(p.file, 'utf8'))));
  console.log(`✅ GUIDE WORD FLOOR PASS — ${pages.length} ${pack} guide(s), all at or above ${FLOOR} words (lowest ${lowest}).`);
}

main();
