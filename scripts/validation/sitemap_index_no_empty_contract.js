#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: no sitemap index lists an empty (or missing) sub-sitemap.
 *
 * memphisseniorcarehomes.com shipped a sitemap.xml index naming
 * sitemap-guides.xml and sitemap-cities.xml with 0 URLs each (verified live
 * 25 Oct 2026): every guide and city page was fresh, so sitemap-fresh.xml held
 * them all and the buckets went out empty. Search Console reads an empty
 * submitted sitemap as a broken one. scripts/sitemap_emit.js now writes and
 * lists only buckets that carry URLs; this holds it.
 *
 * Build (when dist/sitemap.xml exists): every <loc> in the index is a file in
 * dist/ holding at least one <url><loc>, and the index lists at least one.
 * Negative proof every run: an index naming an empty sub-sitemap fails check().
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');

function locs(xml, tag) {
  const re = new RegExp(`<${tag}>\\s*<loc>\\s*([^<\\s]+)\\s*</loc>`, 'g');
  return [...String(xml || '').matchAll(re)].map((m) => m[1]);
}

// readSub(name) returns the sub-sitemap's XML, or null when it does not exist.
function check(indexXml, readSub) {
  const out = [];
  const subs = locs(indexXml, 'sitemap');
  if (!/<sitemapindex\b/.test(String(indexXml || ''))) out.push('sitemap.xml is not a sitemap index');
  if (!subs.length) out.push('sitemap.xml lists no sub-sitemaps');
  for (const u of subs) {
    const name = u.replace(/^https?:\/\/[^/]+\//, '');
    const xml = readSub(name);
    if (xml == null) { out.push(`sitemap.xml lists ${name}, which does not exist`); continue; }
    const n = locs(xml, 'url').length;
    if (n < 1) out.push(`sitemap.xml lists ${name}, which has 0 URLs`);
  }
  return out;
}

const problems = [];
let checked = 0;
const indexFile = path.join(DIST, 'sitemap.xml');
if (fs.existsSync(indexFile)) {
  const indexXml = fs.readFileSync(indexFile, 'utf8');
  checked = locs(indexXml, 'sitemap').length;
  problems.push(...check(indexXml, (name) => {
    const f = path.join(DIST, name);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  }));
}

const hostileIndex = '<sitemapindex><sitemap><loc>https://x.test/sitemap-a.xml</loc></sitemap><sitemap><loc>https://x.test/sitemap-b.xml</loc></sitemap></sitemapindex>';
const hostile = check(hostileIndex, (n) => (n === 'sitemap-a.xml' ? '<urlset></urlset>' : null));
if (!hostile.some((p) => p.includes('sitemap-a.xml, which has 0 URLs')) || !hostile.some((p) => p.includes('sitemap-b.xml, which does not exist'))) {
  problems.push('negative proof no longer caught: an index naming an empty and a missing sub-sitemap');
}
const good = check('<sitemapindex><sitemap><loc>https://x.test/s.xml</loc></sitemap></sitemapindex>', () => '<urlset><url><loc>https://x.test/</loc></url></urlset>');
if (good.length) problems.push('positive proof failed: a valid index was rejected: ' + good.join('; '));

if (problems.length) {
  console.error('SITEMAP INDEX NO-EMPTY CONTRACT FAIL');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✅ SITEMAP INDEX NO-EMPTY CONTRACT PASS (${checked ? checked + ' sub-sitemaps in dist/sitemap.xml, each with at least one URL' : 'no dist/sitemap.xml; negative proof only'})`);
