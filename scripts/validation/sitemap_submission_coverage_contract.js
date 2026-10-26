#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: every sub-sitemap the build publishes is a sitemap the deploy
 * submits to Search Console.
 *
 * The defect this exists to stop (Search Readiness e2, 26 Oct 2026).
 * scripts/sitemap_emit.js writes an index plus up to five sub-sitemaps
 * (sitemap-core, -guides, -cities, -states, -fresh). Step 3 of
 * distribution_scripts/deploy_distribution.sh submitted a hard-coded
 * "https://${HOST}/sitemap.xml" and nothing else, so no child was ever
 * resubmitted and Search Console re-read them only on its own uneven schedule.
 *
 * hormonesivhair.com/sitemap-core.xml was last read on 13 Oct while
 * sitemap-cities.xml, sitemap-guides.xml and sitemap-fresh.xml were read on
 * 21, 22 and 19 Oct. Search Console still reported 1 error on it, recorded
 * against the 67-URL version it read that day; the live file had since moved to
 * 64 URLs, so the error described a file that no longer existed and nothing
 * could clear it. Item e2 fails a sitemap with errors OR one not read in 14
 * days, and core was at 13 days and drifting.
 *
 * distribution.config.json's gsc.sites[].sitemaps named two feeds per host, the
 * build emits up to five, and NO code read that array at all - a list that
 * governed nothing while the submit guessed. That is the "exists but nothing
 * invokes it" and "two components each keeping their own list" pair together.
 *
 * What this checks, by reading the deploy script and the built artifact rather
 * than asserting prose:
 *   1. the submit step derives its feed list from the artifact's sitemap.xml
 *      and does not pass a single hard-coded sitemap path;
 *   2. every host in distribution.config.json gsc.sites declares its sitemaps,
 *      and declares none the build cannot emit (a feed that 404s is a
 *      submission Search Console records as an error);
 *   3. when dist/ holds a built pack: the feed list the deploy step would
 *      derive covers every sub-sitemap present in dist/ and listed in the
 *      index, and names no file that is absent.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DEPLOY = path.join(ROOT, 'distribution_scripts', 'deploy_distribution.sh');
const CONFIG = path.join(ROOT, 'distribution.config.json');
const EMITTER = path.join(ROOT, 'scripts', 'sitemap_emit.js');
const DIST = path.join(ROOT, 'dist');

const errors = [];
const notes = [];

function read(file, label) {
  if (!fs.existsSync(file)) { errors.push(`missing ${label} (${path.relative(ROOT, file)})`); return null; }
  return fs.readFileSync(file, 'utf8');
}

// The names sitemap_emit.js can write, read from the emitter itself so this
// contract cannot drift from the generator.
const emitter = read(EMITTER, 'the sitemap emitter');
let emittable = [];
if (emitter) {
  const order = emitter.match(/const ORDER = \[([^\]]+)\]/);
  if (!order) errors.push('scripts/sitemap_emit.js no longer declares a const ORDER of sub-sitemap names; this contract reads it to know what the build can publish');
  else emittable = [...order[1].matchAll(/'([^']+\.xml)'/g)].map((m) => m[1]);
  if (emitter && !/sitemap\.xml'\), buildIndex\(/.test(emitter)) notes.push('sitemap_emit.js no longer writes the index with buildIndex(); check this contract still describes it');
}
if (emittable.length) notes.push(`the build can publish ${emittable.length} sub-sitemap(s): ${emittable.join(', ')}`);

// --- 1. the deploy step derives the list, it does not hard-code one ---------
const deploy = read(DEPLOY, 'the distribution deploy script');
if (deploy) {
  const step = deploy.slice(deploy.indexOf('== 3) Optional Google sitemap submit'));
  const submit = step.slice(0, step.indexOf('\n== 4)') === -1 ? step.length : step.indexOf('\n== 4)'));
  if (!submit.includes('gsc_submit_sitemaps.py')) {
    errors.push('deploy_distribution.sh step 3 no longer calls gsc_submit_sitemaps.py, so no sitemap is submitted at all');
  } else {
    const call = submit.slice(submit.indexOf('gsc_submit_sitemaps.py'));
    const callLine = call.slice(0, call.indexOf('\n'));
    if (/"https:\/\/\$\{HOST\}\/sitemap[^"]*\.xml"/.test(callLine)) {
      errors.push(
        'deploy_distribution.sh submits a hard-coded sitemap path to gsc_submit_sitemaps.py. ' +
        'Submit the artifact index and every sub-sitemap it lists instead, or the children are never resubmitted ' +
        'and a stale Search Console error on one of them can never clear.'
      );
    }
    if (!/SITEMAP_FEEDS/.test(submit) || !/sitemap\.xml/.test(submit)) {
      errors.push('deploy_distribution.sh step 3 does not build a SITEMAP_FEEDS list from the artifact sitemap.xml');
    }
    if (!/\$ARTIFACT_DIR|\$\{ARTIFACT_DIR\}/.test(submit)) {
      errors.push('deploy_distribution.sh step 3 does not read the built artifact directory, so its feed list is not derived from what shipped');
    }
  }
}

// --- 2. the configured per-host list is complete and possible --------------
const cfgRaw = read(CONFIG, 'distribution.config.json');
if (cfgRaw) {
  let cfg = null;
  try { cfg = JSON.parse(cfgRaw); } catch (e) { errors.push(`distribution.config.json does not parse: ${e.message}`); }
  const sites = cfg && cfg.gsc && Array.isArray(cfg.gsc.sites) ? cfg.gsc.sites : null;
  if (cfg && !sites) errors.push('distribution.config.json has no gsc.sites array');
  for (const s of sites || []) {
    const host = s.host;
    const declared = Array.isArray(s.sitemaps) ? s.sitemaps : [];
    if (!declared.length) { errors.push(`${host} declares no sitemaps in gsc.sites`); continue; }
    const names = declared.map((u) => u.replace(/^https?:\/\/[^/]+\//, ''));
    if (!names.includes('sitemap.xml')) errors.push(`${host} does not declare its sitemap index (sitemap.xml)`);
    for (const n of names) {
      if (n === 'sitemap.xml') continue;
      if (emittable.length && !emittable.includes(n)) {
        errors.push(`${host} declares ${n}, which scripts/sitemap_emit.js never writes; submitting a feed that 404s is recorded by Search Console as an error`);
      }
    }
    for (const u of declared) {
      if (!u.startsWith(`https://${host}/`)) errors.push(`${host} declares ${u}, which is not on that host`);
    }
    const missing = emittable.filter((n) => !names.includes(n));
    if (missing.length) {
      errors.push(
        `${host} declares ${names.length - 1} sub-sitemap(s) but the build can publish ${emittable.length}: ` +
        `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not declared. ` +
        'The deploy derives its submit list from the artifact index, and this list must say the same thing.'
      );
    }
  }
  if (sites) notes.push(`${sites.length} host(s) declare their sitemaps in gsc.sites`);
}

// --- 3. against a built pack, the derived list matches what is on disk ------
if (!fs.existsSync(DIST)) {
  notes.push('no dist/ on disk; the artifact half of this contract was not checked (run `npm run build` first)');
} else {
  const indexFile = path.join(DIST, 'sitemap.xml');
  if (!fs.existsSync(indexFile)) {
    errors.push('dist/ exists but holds no sitemap.xml, so the deploy would submit nothing but the index URL');
  } else {
    const listed = [...fs.readFileSync(indexFile, 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
      .map((m) => m[1].replace(/^https?:\/\/[^/]+\//, ''));
    const onDisk = fs.readdirSync(DIST).filter((n) => /^sitemap-.*\.xml$/.test(n));
    const unlisted = onDisk.filter((n) => !listed.includes(n));
    const phantom = listed.filter((n) => !fs.existsSync(path.join(DIST, n)));
    if (phantom.length) errors.push(`dist/sitemap.xml lists ${phantom.join(', ')}, which ${phantom.length === 1 ? 'is' : 'are'} not in dist/; the deploy would submit a feed that 404s`);
    if (unlisted.length) {
      errors.push(
        `dist/ holds ${unlisted.join(', ')} but the index does not list ${unlisted.length === 1 ? 'it' : 'them'}, ` +
        'so the deploy never submits it and Search Console re-reads it only when it chooses'
      );
    }
    if (!listed.length) errors.push('dist/sitemap.xml lists no sub-sitemaps at all');
    else notes.push(`dist/sitemap.xml lists ${listed.length} sub-sitemap(s), all present: ${listed.join(', ')}`);
  }
}

for (const n of notes) console.log(`   ${n}`);
if (errors.length) {
  console.error(`❌ SITEMAP SUBMISSION COVERAGE FAIL — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}
console.log('✅ SITEMAP SUBMISSION COVERAGE PASS — the deploy submits the index and every sub-sitemap the build publishes');
