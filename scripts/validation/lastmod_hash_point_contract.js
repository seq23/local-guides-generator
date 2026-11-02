#!/usr/bin/env node
'use strict';
/**
 * Every pipeline that hashes a rendered page must hash it at the same point.
 * (Three today: `npm run build`, build_all_packs.js, and the Rotating Refresh
 * rotate step, scripts/automation/rotate_vertical_refresh.js.)
 *
 * The defect this exists to stop. scripts/lastmod_apply.js decides whether a
 * page's content changed by hashing it, so it has to run after every step that
 * mutates a rendered page. There are two pipelines that build this repository:
 *
 *   - `npm run build` + `postbuild` (package.json) - what
 *     .github/workflows/deploy-distribution.yml runs, so what actually ships.
 *   - scripts/build_all_packs.js - what `npm run lastmod:refresh`, `build:dist`,
 *     `validate:dist` and `distribution:prepare` run, so what produces the
 *     committed ledger.
 *
 * On 25 Oct 2026 they disagreed. apply_robots_policy.js rewrites <main> - it
 * unlinks internal links that point at the city pages it noindexes - and
 * build_all_packs.js ran it AFTER lastmod_apply.js while `npm run build` ran it
 * BEFORE. So the refresh recorded the hash of the still-linked page and the
 * deploy hashed the unlinked one. 67 dentistryguides.com /next-steps/ and
 * /states/ pages could never match the committed ledger: every deploy advanced
 * them to the deploy date, threw the working tree away, and repeated it the next
 * day. That is Search Readiness item a6 - uniform <lastmod> - and no validator
 * could see it, because each pipeline was internally consistent.
 *
 * What this checks. Every page-mutating step named below must appear before
 * lastmod_apply.js in whichever pipeline runs it, and both pipelines must run
 * apply_robots_policy.js and lastmod_apply.js in that relative order. It reads
 * the two pipeline definitions themselves rather than asserting prose, so the
 * ordering cannot drift apart again without this failing.
 *
 * Re-verified 26 Oct 2026 on memphisseniorcarehomes.com, which failed item a6
 * that morning with 64 of 64, 38 of 38 and 36 of 36 sitemap URLs sharing
 * lastmod 2026-10-25. Not a defect: a clean rebuild of main advanced 0 of its
 * 144 pages, every one held its existing date, the committed ledger came back
 * byte-identical, and the live sitemaps agree with it exactly. 2026-10-25 is
 * the real date of the site-wide hyperlocal content pass that landed that day
 * and rewrote every page on the site (nearby-area links, care-type links and a
 * per-page lead FAQ, per senior_living_site_contract.js).
 *
 * So a6's heuristic - 90% of a sitemap sharing a date inside two days - fires
 * the day after ANY site-wide content landing, which is the same false positive
 * it produced for uscisexam.com, theaccidentguides.com and neuroevalguides.com
 * on 25 Oct. The ordering this contract pins is what makes those dates
 * trustworthy; the way to tell a content date from a build date is the test run
 * above, a rebuild that advances nothing, not the shape of the sitemap.
 */
const fs = require('fs');
const path = require('path');

// Steps that rewrite an already-rendered page in dist/. Anything added here (or
// to a pipeline) has to run before the hash is taken.
const MUTATORS = [
  'build_city_sites.js',
  'build_404.js',
  'retrofit_recommendation_summary.js',
  'install_clarity.js',
  'install_site_head_assets.js',
  'apply_robots_policy.js',
];
const HASHER = 'lastmod_apply.js';

function fail(msg) {
  console.error(`❌ LASTMOD HASH POINT FAIL — ${msg}`);
  process.exit(1);
}

/** Ordered script basenames referenced by a pipeline definition. */
function orderedSteps(text) {
  const out = [];
  const re = /scripts\/(?:[A-Za-z0-9_\-./]*\/)?([A-Za-z0-9_\-]+\.js)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

/**
 * Inline each `npm run <name>` with that package.json script (plus its
 * pre/post hooks, which npm runs with it), so a pipeline written as npm
 * invocations is read as the scripts it actually runs, in order.
 */
function expandNpmRuns(text, scripts, depth = 0) {
  if (depth > 4) return text;
  return text.replace(/npm run ([A-Za-z0-9:_\-]+)/g, (whole, name) => {
    if (!scripts[name]) return whole;
    const parts = [scripts[`pre${name}`], scripts[name], scripts[`post${name}`]].filter(Boolean);
    return expandNpmRuns(parts.join(' && '), scripts, depth + 1);
  });
}

function checkPipeline(name, steps) {
  const hashAt = steps.indexOf(HASHER);
  if (hashAt === -1) fail(`${name} never runs ${HASHER}. Freshness dates would stay at the build clock.`);
  // A pipeline may legitimately not run every mutator; the rule binds the ones it does run.
  for (const mut of MUTATORS) {
    const at = steps.indexOf(mut);
    if (at === -1) continue;
    if (at > hashAt) {
      fail(
        `${name} runs ${mut} AFTER ${HASHER}.\n` +
        `    ${mut} mutates a rendered page, so hashing before it records a page that never ships.\n` +
        `    The other pipeline then disagrees about which pages changed, and every deploy\n` +
        `    restamps them with the deploy date (Search Readiness a6, uniform <lastmod>).\n` +
        `    Move ${mut} above ${HASHER} in ${name}.`
      );
    }
  }
  return hashAt;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deployPipeline = `${pkg.scripts.build || ''} && ${pkg.scripts.postbuild || ''}`;
  if (!pkg.scripts.build || !pkg.scripts.postbuild) {
    fail('package.json is missing the build or postbuild script: the deploy pipeline cannot be read.');
  }
  const allPacksPath = path.join('scripts', 'build_all_packs.js');
  if (!fs.existsSync(allPacksPath)) fail(`${allPacksPath} not found.`);
  const allPacks = fs.readFileSync(allPacksPath, 'utf8');

  const deploySteps = orderedSteps(deployPipeline);
  const packSteps = orderedSteps(allPacks);

  const rotatePath = path.join('scripts', 'automation', 'rotate_vertical_refresh.js');
  if (!fs.existsSync(rotatePath)) fail(`${rotatePath} not found.`);
  // Comments are stripped first: a comment that names `npm run build` must not
  // count as running it.
  const rotateCode = fs.readFileSync(rotatePath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const rotateSteps = orderedSteps(expandNpmRuns(rotateCode, pkg.scripts));

  const pipelines = [
    ['`npm run build` + postbuild (package.json)', deploySteps],
    ['scripts/build_all_packs.js', packSteps],
    [`${rotatePath} (Rotating Refresh "Rotate one vertical")`, rotateSteps],
  ];
  for (const [name, steps] of pipelines) {
    // Zero steps read means the pipeline definition moved or the parser broke;
    // that must never read as "nothing out of order".
    if (!steps.length) fail(`${name}: no script steps could be read from its definition.`);
    checkPipeline(name, steps);
  }

  // Every pipeline that hashes must run EVERY mutator the ledger's producer
  // (build_all_packs.js) runs, before it hashes. "Not running" a mutator is the
  // same defect as running it late: the page hashed is not the page the
  // committed ledger recorded. That is the gap the Rotating Refresh rotate step
  // fell through on 1 and 2 Nov 2026 - it ran build_city_sites.js alone,
  // then lastmod_apply.js, so it wrote a different hash with today's date, and
  // the record step's --refresh-ledger restored the real hash but kept the date:
  // 176 uscisexam.com entries advanced on unchanged content.
  const packMutators = MUTATORS.filter((m) => packSteps.includes(m) && packSteps.indexOf(m) < packSteps.indexOf(HASHER));
  if (!packMutators.length) fail('scripts/build_all_packs.js runs no page mutator before hashing: the parser or the pipeline broke.');
  for (const [name, steps] of pipelines) {
    const hashAt = steps.indexOf(HASHER);
    const missing = packMutators.filter((m) => { const at = steps.indexOf(m); return at === -1 || at > hashAt; });
    if (missing.length) {
      fail(
        `${name} hashes pages without first running ${missing.join(', ')}.\n` +
        `    scripts/build_all_packs.js runs ${missing.length === 1 ? 'it' : 'them'} before ${HASHER}, so this pipeline hashes\n` +
        `    a page the committed ledger never recorded: every page looks changed and gets today's\n` +
        `    date, and the next ledger refresh keeps that date on the original hash.`
      );
    }
  }

  // The specific pair that broke: both pipelines run these two, and their order
  // relative to each other is what the committed ledger depends on.
  for (const [name, steps] of pipelines) {
    const robots = steps.indexOf('apply_robots_policy.js');
    const hash = steps.indexOf(HASHER);
    if (robots === -1) {
      fail(
        `${name} does not run apply_robots_policy.js.\n` +
        `    Both pipelines must apply it: the one that skips it renders template-fallback\n` +
        `    city pages as indexable, and its ledger records a <main> the other never ships.`
      );
    }
    if (robots > hash) fail(`${name} runs apply_robots_policy.js after ${HASHER}.`);
  }

  console.log(
    `✅ LASTMOD HASH POINT PASS — all three pipelines hash after every mutator ` +
    `(deploy: ${deploySteps.filter((s) => MUTATORS.includes(s)).join(' → ')} → ${HASHER}; ` +
    `build_all_packs: ${packSteps.filter((s) => MUTATORS.includes(s)).join(' → ')} → ${HASHER}; ` +
    `rotate: ${rotateSteps.filter((s) => MUTATORS.includes(s)).join(' → ')} → ${HASHER}).`
  );
}

if (require.main === module) main();
module.exports = { orderedSteps, expandNpmRuns, MUTATORS, HASHER };
