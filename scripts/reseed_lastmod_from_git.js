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

// Checked inside main(), not here. A module must not exit the process when it is
// required: tests/lastmod/reseed_sources.test.mjs imports the resolvers, and the
// merge gate checks out shallow, so an import-time exit(2) failed CI on a file
// that was never going to reseed anything.
function refuseShallowClone() {
  if (git(['rev-parse', '--is-shallow-repository']) === 'false') return;
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

// ---------------------------------------------------------------------------
// Per-page slices of a shared manifest.
//
// Why this exists. The first version of this file folded two pack-wide files -
// data/page_sets/examples/<pack>_v1.json and its cities list - and
// data/contracts/guide_enhancement_registry.json into the source set of every
// page that reads them. Those files are shared by the whole pack, so one commit
// touching any of them moved the lastmod of every city, state, guide and the
// home page onto that commit's date. On 26 Oct 2026 the Search Readiness audit
// reported item a6 ("lastmod comes from content, not from the build date")
// failing on uscisexam.com, dentistryguides.com, theaccidentguides.com and
// neuroevalguides.com, with every URL in sitemap-cities.xml, sitemap-states.xml
// and sitemap-fresh.xml carrying one date - the same uniform_lastmod this whole
// ledger exists to remove, re-created by the reseeder.
//
// The header already refuses to treat the renderer as a content source, for
// exactly this reason: "Folding the renderer's commit date into the seed would
// collapse every page back onto one date, which is the bug, not the fix." A
// pack-wide manifest is the same kind of file. The difference is that a manifest
// does have a per-page part, so the date is recoverable rather than merely
// excludable: the registry is keyed by route, and the cities list is one row per
// city. A page's date is the date ITS slice last changed.
//
// How. Walk the file's commits newest-first, read the slice out of each blob,
// and take the newest commit whose slice differs from the next older one. These
// files have between one and five commits each, so this is a handful of
// `git show` calls, cached per path.
const sliceHistory = new Map();
function historyOf(rel) {
  if (!sliceHistory.has(rel)) {
    let rows = [];
    if (exists(rel)) {
      const out = git(['log', '--format=%H %cs', '--', rel]);
      rows = (out ? out.split('\n') : []).filter(Boolean).map((line) => {
        const [sha, date] = line.trim().split(/\s+/);
        let json = null;
        try { json = JSON.parse(git(['show', `${sha}:${rel}`])); } catch { json = null; }
        return { sha, date, json };
      });
    }
    sliceHistory.set(rel, rows);
  }
  return sliceHistory.get(rel);
}

const EMPTY = Symbol('absent');
function fingerprint(json, selector) {
  if (!json) return EMPTY;
  let v;
  try { v = selector(json); } catch { return EMPTY; }
  if (v === undefined || v === null) return EMPTY;
  if (Array.isArray(v) && v.length === 0) return EMPTY;
  return JSON.stringify(v);
}

/**
 * {last, first} for one page's slice of a shared manifest, or null when the
 * slice never appears in the file's history. Never invents a date: a null sends
 * the caller back to the whole-file date, exactly as before.
 */
function sliceDates(rel, selector, history) {
  // `history` is injectable so the resolution rule can be pinned against known
  // commits: on the shallow clone the merge gate checks out, real git history is
  // one grafted commit and would prove nothing.
  const rows = history || historyOf(rel);
  if (!rows.length) return null;
  const prints = rows.map((r) => fingerprint(r.json, selector));
  const present = prints.map((p, i) => i).filter((i) => prints[i] !== EMPTY);
  if (!present.length) return null;
  const oldestWithSlice = rows[present[present.length - 1]].date;
  for (const i of present) {
    const olderIdx = present.find((j) => j > i);
    const older = olderIdx === undefined ? EMPTY : prints[olderIdx];
    if (older !== prints[i]) return { last: rows[i].date, first: oldestWithSlice };
  }
  // The slice is byte-identical all the way back: its date is the oldest commit
  // that carried it, not the newest commit that touched some other page's row.
  return { last: oldestWithSlice, first: oldestWithSlice };
}

const GUIDE_REGISTRY = 'data/contracts/guide_enhancement_registry.json';

// Head-only keys of a global-page JSON. scripts/lib/lastmod_ledger.js hashes a
// page's <main> region and nothing else, deliberately: "a template tweak is
// silent and a rewritten page is not". The reseeder has to measure the same
// thing, and it did not. data/global_pages/next-steps.json was committed on
// 25 Oct 2026 with one character of difference - meta_title lost the word
// "Provider" - and that moved the lastmod of all 56 /<city>/next-steps/ pages
// on every site to 25 Oct, 91% of sitemap-core.xml on one date. A <title> is
// not what the page says.
const HEAD_ONLY_KEYS = new Set(['meta_title', 'meta_description']);
const mainContentOf = (json) => {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return json;
  const out = {};
  for (const k of Object.keys(json).sort()) if (!HEAD_ONLY_KEYS.has(k)) out[k] = json[k];
  return out;
};
const cityRow = (slug) => (rows) => (Array.isArray(rows) ? rows.find((r) => r && r.slug === slug) : undefined);
const stateRows = (abbr) => (rows) => (Array.isArray(rows)
  ? rows.filter((r) => r && String(r.state || '').toLowerCase() === abbr).sort((a, b) => String(a.slug).localeCompare(String(b.slug)))
  : undefined);

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

// Global pages, indexed by the route they declare rather than by their file
// name. Three naming conventions are in use for the same thing - guides_<slug>
// (81 files), guides_<pack>_<slug> (50) and a bare <slug> (34) - so guessing a
// file name from a route silently resolved nothing for a third of the guides on
// this network, including /guides/medical-malpractice/. The renderer resolves
// these by their `route` field; so does this.
const globalPageIndex = new Map();
function globalPageByRoute(pack) {
  if (!globalPageIndex.has(pack)) {
    const map = new Map();
    // Shared first, then pack-local, so a pack-local file overrides the shared
    // one exactly as loadGlobalPagesDir resolves it at build time.
    for (const dir of ['data/global_pages', packGlobalDir(pack)]) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const name of fs.readdirSync(abs)) {
        if (!name.endsWith('.json')) continue;
        const rel = `${dir}/${name}`;
        let json;
        try { json = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { continue; }
        const route = json && typeof json.route === 'string' ? json.route : '';
        if (route) map.set(route.endsWith('/') ? route : `${route}/`, rel);
      }
    }
    globalPageIndex.set(pack, map);
  }
  return globalPageIndex.get(pack);
}

/**
 * The committed sources a published URL is rendered from.
 *
 * Each entry is either a path (the whole file's commit dates are this page's
 * dates) or `{ rel, slice }` - a shared manifest plus the selector that picks
 * out this page's part of it, so a commit that edited another page's row does
 * not move this page's date. Order does not matter: the caller takes a max and
 * a min over the set.
 */
function sourcesFor(pack, route) {
  const out = [];
  const push = (rel) => { if (rel && exists(rel)) out.push(rel); };
  const pushSlice = (rel, slice) => { if (rel && exists(rel)) out.push({ rel, slice }); };
  // Sliced to the keys that render inside <main>, so a meta_title edit is as
  // silent here as it is in the content hash.
  const globalPage = (r) => {
    const rel = globalPageByRoute(pack).get(r.endsWith('/') ? r : `${r}/`);
    if (!rel) return false;
    pushSlice(rel, mainContentOf);
    return true;
  };

  const clean = route.replace(/^\/+|\/+$/g, '');
  const parts = clean ? clean.split('/') : [];

  // The pack page set is deliberately NOT a source. It is the pack's manifest -
  // which pages exist, the shared FAQ, sponsorship config - and it is read by
  // every page in the pack, so folding its commit date in collapses the pack
  // onto one date. When the manifest's shared FAQ really does change, every
  // page's rendered <main> changes with it and the content-hash half of the
  // ledger advances them all on the next build, which is the right mechanism
  // for a change that genuinely is library-wide.
  if (!parts.length) { globalPage('/'); return out; }

  if (parts[0] === 'guides') {
    globalPage(route);
    // The curated per-guide answer content lives in the contracts registry,
    // keyed by route: one guide's entry is this page's slice of it.
    pushSlice(GUIDE_REGISTRY, (reg) => reg && reg[route]);
    return out;
  }

  if (parts[0] === 'states') {
    // A state hub is composed from the cities list - but only from the rows in
    // that state. Adding a city in Texas does not change the Ohio hub.
    pushSlice(packCities(pack), stateRows(String(parts[1] || '').toLowerCase()));
    return out;
  }

  // A city market page, or its next-steps hub.
  const vertical = CONTENT_VERTICAL[pack];
  const cityContent = vertical ? `data/city_content/${vertical}/${parts[0]}.json` : '';
  if (cityContent && exists(cityContent)) {
    push(cityContent);
    pushSlice(packCities(pack), cityRow(parts[0]));
    if (parts[1] === 'next-steps') globalPage('/next-steps/');
    return out;
  }

  // A shared global page such as /about/ or /faq/ - but only if one is declared
  // at that route. A one-segment route with no global page is a city with no
  // research file, and the `if (cityContent && exists(...))` branch above cannot
  // catch it, so this order matters: asking for the global page first and
  // returning unconditionally is what made every unresearched dentistry city
  // resolve to the pack page set, and then - once that stopped being a source -
  // to nothing at all.
  if (parts.length === 1 && globalPage(route)) return out;

  // A city with no per-city content file: its text comes from its own row in
  // the cities list.
  pushSlice(packCities(pack), cityRow(parts[0]));
  if (parts[1] === 'next-steps') globalPage('/next-steps/');
  return out;
}

// {last, first} for one source descriptor, or null when it resolves to nothing.
function datesFor(src) {
  if (typeof src === 'string') {
    const last = lastDate(src);
    return last ? { last, first: firstDate(src) || last } : null;
  }
  return sliceDates(src.rel, src.slice);
}

// Everything above is a pure resolver, so this file can be required by
// tests/lastmod/reseed_sources.test.mjs without reseeding anything: requiring a
// module must not walk the whole git history and rewrite the ledger.
function main() {
  refuseShallowClone();

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
    const resolvedDates = sources.map(datesFor).filter(Boolean);
    const lasts = resolvedDates.map((d) => d.last).filter(Boolean);
    const firsts = resolvedDates.map((d) => d.first).filter(Boolean);
    if (!lasts.length) { unresolved.push([url, sources.length ? 'sources have no commit history' : 'no source files resolved']); next[url] = entry; continue; }

    const lastmod = lasts.slice().sort().pop();
    const firstSeen = firsts.length ? firsts.slice().sort()[0] : lastmod;
    next[url] = {
      hash: entry.hash,
      // Carry the hash basis through. Dropping it made resolve() treat every
      // entry as mid-rebasing on the next build and hold its date - so the one
      // build after a reseed silently refused to advance a page whose content
      // HAD changed, which is the same false freshness claim in the other
      // direction. The reseeder rewrites dates, never the hash or its basis.
      basis: entry.basis,
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
      hash_basis: ledger.hash_basis || ledgerLib.HASH_BASIS,
      note: ledgerLib.RESEEDED_NOTE,
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
}

if (require.main === module) main();

module.exports = { main, sourcesFor, sliceDates, datesFor, cityRow, stateRows, mainContentOf, HEAD_ONLY_KEYS, GUIDE_REGISTRY };

