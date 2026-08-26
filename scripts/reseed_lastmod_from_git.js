#!/usr/bin/env node
'use strict';
/**
 * Reseed data/cadence/lastmod_ledger.json from real git history.
 *
 * What was wrong. The ledger was seeded from the tree as it stood on one day and
 * every one of its 1,036 entries carried that same date, because - as its own
 * header says - "nothing in this repository records when each page last
 * substantively changed". That is true of dist/, which is generated and
 * gitignored. It is not true of the inputs those pages are rendered from: the
 * city content, the pack page sets, the per-pack global page JSON. Those are
 * committed, and git records exactly when each of them last changed.
 *
 * So the date each page's content last changed is recoverable after all, and
 * `node scripts/cadence_gate.js` no longer has to report uniform_lastmod on a
 * library whose pages were in fact last edited across a seven-month span.
 *
 * What it does. For every URL already in the ledger it resolves the set of
 * committed files that page is rendered from, and takes:
 *   lastmod    = the newest "last commit touched this file" date in that set
 *   first_seen = the oldest "commit that added this file" date in that set
 *
 * What it deliberately does NOT do.
 *   - It never invents a date. A URL whose sources cannot be resolved, or whose
 *     sources have no commit history yet, keeps whatever entry it already has
 *     and is listed in the report. There is no fallback to today.
 *   - It refuses to run against a shallow clone. `git log` there returns the
 *     grafted boundary commit for every file, which would silently stamp one
 *     wrong date across the whole library - exactly the failure being fixed.
 *   - It does not treat the renderer as a content source. scripts/
 *     build_city_sites.js changing is a real change to every page, but that is
 *     what the content-hash half of the ledger is for: the next build sees the
 *     new hash and advances the date itself. Folding the renderer's commit date
 *     into the seed would collapse every page back onto one date, which is the
 *     bug, not the fix.
 *   - It does not touch the hashes. The hash is what decides whether the next
 *     build advances a page; rewriting it here would make every page look
 *     changed on the next build.
 *
 * Usage: node scripts/reseed_lastmod_from_git.js [--apply] [--json]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PACK_SITE_CONFIG } = require('./lib/pack_site_config');
const ledgerLib = require('./lib/lastmod_ledger');

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const AS_JSON = argv.includes('--json');

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

if (git(['rev-parse', '--is-shallow-repository']) !== 'false') {
  console.error(
    'reseed_lastmod: refusing to run against a shallow clone. `git log` returns the graft\n' +
    'boundary for every path there, so every page would be stamped with one wrong date -\n' +
    'the exact failure this replaces. Re-run with a full clone (fetch-depth: 0).'
  );
  process.exit(2);
}

// Cache: a single `git log` per path, not per page. Fifty state pages share a
// cities file; without this that file is walked fifty times.
const lastCommit = new Map();
const firstCommit = new Map();
function lastDate(rel) {
  if (!lastCommit.has(rel)) {
    lastCommit.set(rel, fs.existsSync(path.join(ROOT, rel)) ? (git(['log', '-1', '--format=%cs', '--', rel]) || null) : null);
  }
  return lastCommit.get(rel);
}
function firstDate(rel) {
  if (!firstCommit.has(rel)) {
    let d = null;
    if (fs.existsSync(path.join(ROOT, rel))) {
      // --diff-filter=A finds the commit that introduced the file. --follow so a
      // renamed file keeps the date it was actually first published on.
      const out = git(['log', '--follow', '--diff-filter=A', '--format=%cs', '--', rel]);
      const lines = out ? out.split('\n').filter(Boolean) : [];
      d = lines.length ? lines[lines.length - 1] : (git(['log', '--format=%cs', '--', rel]).split('\n').filter(Boolean).pop() || null);
    }
    firstCommit.set(rel, d);
  }
  return firstCommit.get(rel);
}

const hostToPack = new Map();
for (const [key, cfg] of Object.entries(PACK_SITE_CONFIG)) {
  hostToPack.set(new URL(cfg.siteUrl).hostname.replace(/^www\./, ''), key);
}

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const packPageSet = (pack) => `data/page_sets/examples/${pack}_v1.json`;
const packCities = (pack) => `data/page_sets/examples/cities_${pack}_v1.json`;
const packGlobalDir = (pack) => `data/page_sets/examples/${pack}_global_pages`;
// The renderer's vertical key is the directory name under data/city_content.
const CONTENT_VERTICAL = { pi: 'pi', dentistry: 'dentistry', trt: 'trt', neuro: 'neuro', uscis_medical: 'uscis_medical' };

/**
 * The committed files a published URL is rendered from. Order does not matter -
 * the caller takes a max and a min over the set.
 */
function sourcesFor(pack, route) {
  const out = [];
  const push = (rel) => { if (rel && exists(rel)) out.push(rel); };
  const globalPage = (name) => {
    // A pack-local global page overrides the shared one, exactly as
    // loadGlobalPagesDir resolves it at build time.
    const packLocal = `${packGlobalDir(pack)}/${name}.json`;
    if (exists(packLocal)) { push(packLocal); return true; }
    return push(`data/global_pages/${name}.json`) || exists(`data/global_pages/${name}.json`);
  };

  const clean = route.replace(/^\/+|\/+$/g, '');
  const parts = clean ? clean.split('/') : [];

  if (!parts.length) { globalPage('home'); push(packPageSet(pack)); return out; }

  if (parts[0] === 'guides') {
    if (parts.length === 1) globalPage('guides');
    else globalPage(`guides_${parts[1]}`);
    // The curated per-guide answer content lives in the contracts registry.
    push('data/contracts/guide_enhancement_registry.json');
    push(packPageSet(pack));
    return out;
  }

  if (parts[0] === 'states') {
    // State hubs are composed entirely from the pack's city list.
    push(packCities(pack));
    push(packPageSet(pack));
    return out;
  }

  // A city market page, or its next-steps hub.
  const vertical = CONTENT_VERTICAL[pack];
  const cityContent = vertical ? `data/city_content/${vertical}/${parts[0]}.json` : '';
  if (cityContent && exists(cityContent)) {
    push(cityContent);
    push(packCities(pack));
    if (parts[1] === 'next-steps') globalPage('next-steps');
    return out;
  }

  // Not a city: a shared global page such as /about/ or /faq/.
  if (parts.length === 1) {
    globalPage(parts[0]);
    push(packPageSet(pack));
    return out;
  }

  // A city with no per-city content file: its text comes from the city list.
  push(packCities(pack));
  if (parts[1] === 'next-steps') globalPage('next-steps');
  push(packPageSet(pack));
  return out;
}

const ledger = ledgerLib.load();
const entries = ledger.entries || {};
const before = {};
for (const e of Object.values(entries)) before[e.lastmod] = (before[e.lastmod] || 0) + 1;

const next = {};
const unresolved = [];
let changed = 0;
for (const [url, entry] of Object.entries(entries)) {
  let parsed;
  try { parsed = new URL(url); } catch { unresolved.push([url, 'unparseable url']); next[url] = entry; continue; }
  const pack = hostToPack.get(parsed.hostname.replace(/^www\./, ''));
  if (!pack) { unresolved.push([url, `no pack owns host ${parsed.hostname}`]); next[url] = entry; continue; }

  const sources = sourcesFor(pack, parsed.pathname);
  const lasts = sources.map(lastDate).filter(Boolean);
  const firsts = sources.map(firstDate).filter(Boolean);
  if (!lasts.length) { unresolved.push([url, sources.length ? 'sources have no commit history' : 'no source files resolved']); next[url] = entry; continue; }

  const lastmod = lasts.slice().sort().pop();
  const firstSeen = firsts.length ? firsts.slice().sort()[0] : lastmod;
  next[url] = {
    hash: entry.hash,
    lastmod,
    // first_seen can never post-date lastmod; if the sources disagree, the
    // earlier of the two is the one that is certainly true.
    first_seen: firstSeen <= lastmod ? firstSeen : lastmod,
  };
  if (next[url].lastmod !== entry.lastmod || next[url].first_seen !== entry.first_seen) changed += 1;
}

const after = {};
for (const e of Object.values(next)) after[e.lastmod] = (after[e.lastmod] || 0) + 1;

const report = {
  urls: Object.keys(entries).length,
  rewritten: changed,
  unresolved: unresolved.length,
  distinct_dates_before: Object.keys(before).length,
  distinct_dates_after: Object.keys(after).length,
  lastmod_before: before,
  lastmod_after: after,
  unresolved_sample: unresolved.slice(0, 20),
  applied: APPLY,
};

if (APPLY) {
  const sorted = {};
  for (const url of Object.keys(next).sort()) sorted[url] = next[url];
  ledgerLib.save({
    schema: ledger.schema || ledgerLib.SCHEMA,
    note:
      'Per-URL content hash and the date that content last changed. lastmod only advances for a ' +
      'URL whose hash changed; see scripts/lib/lastmod_ledger.js. Dates were reseeded from real ' +
      'git history by scripts/reseed_lastmod_from_git.js: lastmod is the newest commit date across ' +
      'the committed files that page is rendered from, first_seen the oldest commit that added one ' +
      'of them. A URL whose sources could not be resolved kept its previous entry rather than being ' +
      'given an invented date. Entries are merged, never pruned: dist/ holds one pack at a time.',
    seeded_on: ledger.seeded_on,
    reseeded_from_git_on: new Date().toISOString().slice(0, 10),
    entries: sorted,
  });
}

if (AS_JSON) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`reseed_lastmod: ${report.urls} URLs; ${report.rewritten} rewritten; ${report.unresolved} unresolved (${APPLY ? 'APPLIED' : 'dry run'})`);
  console.log(`  distinct lastmod dates: ${report.distinct_dates_before} -> ${report.distinct_dates_after}`);
  for (const [d, n] of Object.entries(after).sort()) console.log(`    ${d}  ${n}`);
  for (const [u, why] of report.unresolved_sample) console.log(`  UNRESOLVED ${u} :: ${why}`);
  if (unresolved.length > 20) console.log(`  ... and ${unresolved.length - 20} more`);
}
