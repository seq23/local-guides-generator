#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: no placeholder city page ships.
 *
 * On 26 Oct 2026 Search Readiness (items j9 and a3) found dentistryguides.com
 * carrying 50 city pages rendered from the slug template: no research file, no
 * city-specific facts, stamped data-template-fallback="true" and noindexed. They
 * sat in the coverage list as if they were pages, failed j9 (not in the sitemap)
 * and a3 (noindex on a public page), and helped nobody. They were folded into
 * their state pages with a 301 (data/search_intelligence/dentistryguides.com/
 * consolidation_candidates.json), and memphisseniorcarehomes.com gained its
 * service x town pages from the licence registries. This contract keeps either
 * state from coming back.
 *
 * What it checks, against the active pack's built dist (data/site.json names it):
 *   1. every built top-level page is free of the template-fallback stamp
 *      (data-template-fallback="true") - a placeholder city page, in any pack;
 *   2. every city row of the pack's own city list (kind city / care_type, or no
 *      kind) has a built page that is index,follow-able (no robots noindex);
 *   3. memphisseniorcarehomes.com: every such page lists at least one licensed
 *      community from the registry (a <tr data-facility-license=...> row), so a
 *      care page can never ship as an empty shell.
 * It refuses to pass on nothing: zero city pages checked is a failure.
 *
 * Usage: LKG_VALIDATE_DIST=1 PAGE_SET_FILE=<pack> node scripts/validation/placeholder_city_pages_contract.js
 * Negative test (26 Oct 2026): restore one folded dentistry city row (or delete
 * one research file) and rebuild the dentistry pack -> FAIL naming the page.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const distRoot = process.env.LKG_DIST_DIR ? path.resolve(process.env.LKG_DIST_DIR) : path.join(repoRoot, 'dist');

function fail(lines) {
  console.error('FAIL: placeholder city pages contract');
  for (const l of [].concat(lines)) console.error('  ' + l);
  process.exit(1);
}

const site = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'site.json'), 'utf8'));
const pageSetFile = String(site.pageSetFile || '');
if (!pageSetFile) fail('data/site.json names no pageSetFile; build a pack first.');
const pageSet = JSON.parse(fs.readFileSync(path.resolve(repoRoot, pageSetFile), 'utf8'));
const cities = pageSet.citiesFile ? JSON.parse(fs.readFileSync(path.resolve(repoRoot, pageSet.citiesFile), 'utf8')) : [];
const isSenior = /senior_living/.test(pageSetFile);
if (!fs.existsSync(distRoot)) fail(`${distRoot} is missing; build a pack first.`);

const problems = [];
// 1. No placeholder stamp on any built top-level page (city pages live at /<slug>/).
let scanned = 0;
for (const d of fs.readdirSync(distRoot, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  for (const rel of ['index.html', 'next-steps/index.html']) {
    const f = path.join(distRoot, d.name, rel);
    if (!fs.existsSync(f)) continue;
    scanned += 1;
    if (/data-template-fallback="true"/.test(fs.readFileSync(f, 'utf8'))) problems.push(`/${d.name}/${rel.replace('index.html', '')} is a placeholder (slug template, no research file)`);
  }
}

// 2 + 3. Every city of the pack's own list is a real, indexable page.
let checked = 0;
for (const c of cities) {
  if (!c || !c.slug || (c.status && c.status !== 'live')) continue;
  if (c.kind && !['city', 'care_type'].includes(c.kind)) continue;
  const f = path.join(distRoot, c.slug, 'index.html');
  if (!fs.existsSync(f)) { problems.push(`/${c.slug}/ is in ${pageSet.citiesFile} but was not built`); continue; }
  const h = fs.readFileSync(f, 'utf8');
  checked += 1;
  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(h)) problems.push(`/${c.slug}/ is noindexed`);
  if (isSenior && !/<tr data-facility-license=/.test(h)) problems.push(`/${c.slug}/ lists no licensed community`);
}

if (checked === 0) fail(`0 city pages checked for ${pageSetFile}; refusing to pass on nothing.`);
if (problems.length) fail(problems);
console.log(`✅ PLACEHOLDER CITY PAGES CONTRACT PASS (${pageSetFile}: ${checked} city pages real and indexable; ${scanned} built pages free of the template stamp)`);
