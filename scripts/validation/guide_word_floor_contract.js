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
 * floor, and five of the six are not there yet (~84 guides of substantive legal,
 * clinical and treatment content remain). Until then the whole pack is skipped --
 * so a guide a brief has just carried over the floor had nothing holding it
 * there. Deleting its new sections, or breaking its route so it stops rendering,
 * would have passed this gate silently and the next weekly audit would have
 * re-found the same page. PROVEN names every guide a brief has already raised and
 * measures those pages even when their pack is skipped. It fails both ways: a
 * named guide back under the floor, and a named guide that has stopped rendering
 * at all.
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
//   pi_v1    24 of 34 guides under the floor, lowest 1,173 (product-liability)
//   neuro_v1 19 of 32 guides under the floor, lowest 1,371
//            (what-to-expect-after-a-neuro-evaluation)
//   trt_v1   37 of 50 guides under the floor, lowest 1,096
//            (peptides-for-hair-loss-explained)
// The pi_v1 and trt_v1 figures were re-measured on this branch after the three
// guides below were raised; re-measure rather than subtract, because the pack's
// guide list moves too.
// Every guide a queue brief has named so far is now over the floor and held by
// PROVEN, which is why those briefs are closed while these packs stay unenforced:
// ~80 guides of substantive legal, clinical and treatment content remain, and
// padding them to clear a word count is the failure this floor exists to catch.
const PENDING = {
  'uscis_medical_v1.json': 'sr-uscisexam.com-j3',
  'pi_v1.json': 'sr-theaccidentguides.com-j3',
  'neuro_v1.json': 'sr-neuroevalguides.com-j3',
  'trt_v1.json': 'sr-hormonesivhair.com-j3',
  'senior_living_v1.json': 'no j3 brief open',
};

// Guides a Search Readiness brief has already carried over the floor, by pack.
// Measured on the rendered page with visibleWordCount, the same number the audit
// reports. Entries are added by the pass that raises a guide; nothing removes
// them. A pack graduating to ENFORCED makes its entry redundant, not wrong.
const PROVEN = {
  'pi_v1.json': [
    // sr-theaccidentguides.com-j3, 26 Oct 2026: 1,333 -> 2,500 and 1,542 -> 2,296.
    'vehicle-collisions-near-law-enforcement-activity',
    'what-a-personal-injury-case-costs-you',
    // sr-theaccidentguides.com-j3, 26 Oct 2026 (second brief, different sampled
    // pages): 1,309 -> truck-accidents, 1,688 -> settlement costs before/after suit.
    'truck-accidents',
    'settlement-costs-before-and-after-filing-suit',
  ],
  'trt_v1.json': [
    // sr-hormonesivhair.com-j3, 26 Oct 2026: 1,145 -> 2,258.
    'iv-hydration-therapy-overview',
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

// Every PROVEN guide in this pack: still rendered, and still over the floor.
// Returns how many were measured so the run can say so out loud.
function checkProven(pack, pages) {
  const proven = PROVEN[pack] || [];
  if (!proven.length) return 0;
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const absent = [];
  const under = [];
  for (const slug of proven) {
    const page = bySlug.get(slug);
    if (!page) { absent.push(slug); continue; }
    const words = visibleWordCount(fs.readFileSync(page.file, 'utf8'));
    if (words < FLOOR) under.push({ slug, words });
  }
  if (under.length || absent.length) {
    const lines = [];
    if (under.length) {
      lines.push(`${under.length} guide(s) named in PROVEN for ${pack} fell back under the ${FLOOR}-word floor:`);
      for (const u of under.sort((a, b) => a.words - b.words)) {
        lines.push(`    /guides/${u.slug}/  ${u.words} words  (needs ${FLOOR - u.words} more)`);
      }
    }
    if (absent.length) {
      lines.push(`${absent.length} guide(s) named in PROVEN for ${pack} are not in the rendered pack: ${absent.map((s) => `/guides/${s}/`).join(', ')}.`);
      lines.push('A page that stops rendering is how a closed brief silently reopens.');
    }
    lines.push('');
    lines.push('These pages were carried over the floor by a Search Readiness brief. Restore the');
    lines.push('substance that was removed; do not remove the page from PROVEN, which is the one');
    lines.push('edit this gate does not accept.');
    fail(lines);
  }
  return proven.length;
}

function main() {
  const pack = path.basename(String(process.env.PAGE_SET_FILE || ''));
  const distDir = path.resolve(process.env.PAGES_OUT_DIR || 'dist');

  const enforced = ENFORCED.includes(pack);
  const provenCount = (PROVEN[pack] || []).length;

  if (!enforced && !provenCount) {
    // Rule 0: no stage may exit 0 having done nothing without saying so.
    const why = PENDING[pack] ? `its guides are under the floor (${PENDING[pack]})` : 'it is not a known pack';
    console.log(`ℹ️ GUIDE WORD FLOOR SKIP — pack "${pack || '(none)'}" is not enforced: ${why}. Enforced: ${ENFORCED.join(', ')}.`);
    return;
  }
  if (process.env.LKG_VALIDATE_DIST !== '1') {
    console.log(`ℹ️ GUIDE WORD FLOOR SKIP — LKG_VALIDATE_DIST is not 1, so there is no rendered pack to measure. The hard_fail tier sets it.`);
    return;
  }
  if (!fs.existsSync(distDir)) fail([`${distDir} does not exist; run a build for ${pack} first.`]);

  const pages = guidePages(distDir);
  // An empty measurement is the "runs but inert" defect, not a pass.
  if (!pages.length) {
    const reason = enforced ? `${pack} is enforced and must have them` : `${provenCount} guide(s) named in PROVEN for ${pack} cannot be measured`;
    fail([`no rendered /guides/ pages found under ${distDir}; ${reason}.`]);
  }

  // Runs for every pack, enforced or skipped: this is the gap PROVEN closes.
  const measured = checkProven(pack, pages);

  if (!enforced) {
    const why = PENDING[pack] ? `its guides are under the floor (${PENDING[pack]})` : 'it is not a known pack';
    console.log(`✅ GUIDE WORD FLOOR PARTIAL — pack "${pack}" is not enforced (${why}), but ${measured} guide(s) named in PROVEN are rendered and at or above ${FLOOR} words.`);
    return;
  }

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
