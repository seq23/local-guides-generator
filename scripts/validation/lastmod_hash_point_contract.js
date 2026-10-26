#!/usr/bin/env node
'use strict';
/**
 * Both build pipelines must hash a rendered page at the same point.
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

  checkPipeline('`npm run build` + postbuild (package.json)', deploySteps);
  checkPipeline('scripts/build_all_packs.js', packSteps);

  // The specific pair that broke: both pipelines run these two, and their order
  // relative to each other is what the committed ledger depends on.
  for (const [name, steps] of [
    ['`npm run build` + postbuild (package.json)', deploySteps],
    ['scripts/build_all_packs.js', packSteps],
  ]) {
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
    `✅ LASTMOD HASH POINT PASS — both pipelines hash after every mutator ` +
    `(deploy: ${deploySteps.filter((s) => MUTATORS.includes(s)).join(' → ')} → ${HASHER}; ` +
    `build_all_packs: ${packSteps.filter((s) => MUTATORS.includes(s)).join(' → ')} → ${HASHER}).`
  );
}

if (require.main === module) main();
module.exports = { orderedSteps, MUTATORS, HASHER };
