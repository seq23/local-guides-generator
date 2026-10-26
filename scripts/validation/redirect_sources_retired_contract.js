#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';
/**
 * Every redirect source has left the site, and every redirect target is a live page.
 *
 * The defect this exists to stop. On 26 Oct 2026, 43 thin guides across four
 * canonicals (0 impressions, under 600 words) were folded into on-topic guides
 * and 301'd (data/search_intelligence/<host>/consolidation_candidates.json).
 * A 301 only consolidates if Google stops being told the old URL is a page: a
 * source still listed in a sitemap, or still linked from the site's own pages,
 * keeps sending crawlers through the redirect, and the consolidation is inert.
 * legacy_redirects_contract.js proves the _redirects lines exist; nothing
 * proved the old URLs were gone from the sitemap and the internal links.
 *
 * What this checks, against the active pack's built dist (one pack per run,
 * invoked per pack by scripts/build_all_packs.js through the hard_fail tier):
 *   1. every legacyRedirects target is a built page (dist/<to>/index.html: 200)
 *   2. no redirect source is a built page
 *   3. no redirect source appears as a <loc> in any dist sitemap*.xml
 *   4. no built HTML page links to a redirect source (relative or absolute,
 *      with or without the trailing slash or a #fragment)
 *   5. no llms*.txt surface lists a redirect source
 * It refuses to pass on nothing: zero legacyRedirects across all page sets, or
 * a dist with no sitemap, is a failure.
 *
 * Usage: LKG_VALIDATE_DIST=1 PAGE_SET_FILE=<pack> node scripts/validation/redirect_sources_retired_contract.js
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const distRoot = process.env.LKG_DIST_DIR ? path.resolve(process.env.LKG_DIST_DIR) : path.join(repoRoot, 'dist');
const pageSetsDir = path.join(repoRoot, 'data', 'page_sets', 'examples');

function fail(lines) {
  console.error('FAIL: redirect sources retired contract');
  for (const l of [].concat(lines)) console.error('  ' + l);
  process.exit(1);
}

const packFiles = fs.readdirSync(pageSetsDir).filter((f) => /^[a-z_]+_v1\.json$/.test(f) && !f.startsWith('cities_'));
let total = 0;
for (const f of packFiles) {
  const ps = JSON.parse(fs.readFileSync(path.join(pageSetsDir, f), 'utf8'));
  total += Array.isArray(ps.legacyRedirects) ? ps.legacyRedirects.length : 0;
}
if (total === 0) fail(`0 legacyRedirects across ${packFiles.length} page sets; refusing to pass on nothing.`);

const site = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'site.json'), 'utf8'));
// dist always holds the pack data/site.json names (prepare_site.js writes both).
const pageSetFile = String(site.pageSetFile || '');
const pageSet = JSON.parse(fs.readFileSync(path.resolve(repoRoot, pageSetFile), 'utf8'));
const rows = Array.isArray(pageSet.legacyRedirects) ? pageSet.legacyRedirects : [];
const host = new URL(String(site.siteUrl)).host;

if (!fs.existsSync(distRoot)) fail(`${distRoot} is missing; build a pack first.`);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(distRoot, []);
const sitemaps = files.filter((f) => /sitemap[^/]*\.xml$/.test(path.basename(f)));
if (!sitemaps.length) fail('no sitemap*.xml in dist; refusing to pass on nothing.');
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const llmsFiles = files.filter((f) => /^llms.*\.txt$/.test(path.basename(f)));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const problems = [];
const sources = [];
for (const row of rows) {
  const from = String(row.from || '').replace(/\/+$/, '');
  const to = String(row.to || '');
  if (!from) continue;
  sources.push(from);
  if (!fs.existsSync(path.join(distRoot, to.replace(/^\/+/, ''), 'index.html'))) problems.push(`${from}: target ${to} is not a built page`);
  if (fs.existsSync(path.join(distRoot, from.replace(/^\/+/, ''), 'index.html'))) problems.push(`${from}: is still a built page`);
}

if (sources.length) {
  // One alternation per pass keeps this linear in the size of dist.
  const alt = sources.map(esc).join('|');
  const locRe = new RegExp(`<loc>\\s*(?:https?://${esc(host)})?(${alt})/?\\s*</loc>`, 'g');
  const hrefRe = new RegExp(`href=["'](?:https?://${esc(host)})?(${alt})/?(?:[#?][^"']*)?["']`, 'g');
  const lineRe = new RegExp(`(?:https?://${esc(host)})(${alt})/?(?=[\\s)#?\\]]|$)`, 'gm');
  for (const f of sitemaps) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(locRe)) problems.push(`${m[1]}: still listed in ${path.relative(distRoot, f)}`);
  }
  for (const f of htmlFiles) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(hrefRe)) problems.push(`${m[1]}: still linked from ${path.relative(distRoot, f)}`);
  }
  for (const f of llmsFiles) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(lineRe)) problems.push(`${m[1]}: still listed in ${path.relative(distRoot, f)}`);
  }
}

if (problems.length) {
  const shown = problems.slice(0, 40);
  if (problems.length > shown.length) shown.push(`... and ${problems.length - shown.length} more`);
  fail([`${problems.length} problem(s) for ${path.basename(pageSetFile)} (${host}):`].concat(shown));
}
console.log(`OK: redirect sources retired contract (${rows.length} sources for ${path.basename(pageSetFile)} on ${host}: none in ${sitemaps.length} sitemap(s), none linked from ${htmlFiles.length} pages; ${total} across ${packFiles.length} page sets).`);
