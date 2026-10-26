#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the fresh lane never empties a bucket sitemap that has URLs.
 *
 * What this pins. scripts/sitemap_emit.js puts every URL in exactly one
 * sub-sitemap, and sitemap-fresh.xml borrows up to 15 guide pages and up to 20
 * city pages from their buckets. uscisexam.com has exactly 15 guide pages and
 * dentistryguides.com exactly 6 indexable city pages, so the fresh lane took
 * every one and sitemap-guides.xml / sitemap-cities.xml were emitted with 0
 * URLs, then deleted from dist/.
 *
 * Why deleting them was not enough. A file deleted from dist/ is not deleted
 * from the deployed site. Both kept answering 200 with an empty <urlset>
 * (verified live 26 Oct 2026), and Search Console holds every sub-sitemap as a
 * submitted sitemap, so it reported one error against each - Search Readiness
 * item e2, failing on both sites. Search Console cannot be made to forget a
 * submission from this repository; keeping the bucket non-empty is what this
 * repository can do, and it is also the truthful shape.
 *
 * Build (when dist/ carries sitemaps): for every bucket file present, if the
 * dist tree holds pages of that bucket's kind at all, the bucket file has at
 * least one URL, and no URL appears in two sub-sitemaps.
 * Negative proof every run: a bucket emptied into the fresh lane fails check().
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const BUCKETS = ['sitemap-core.xml', 'sitemap-guides.xml', 'sitemap-cities.xml', 'sitemap-states.xml'];
const FRESH = 'sitemap-fresh.xml';

function urls(xml) {
  return [...String(xml || '').matchAll(/<url>\s*<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * read(name) returns a sub-sitemap's XML or null when the file is absent.
 * A bucket is a problem when it exists but is empty, or when it is absent while
 * the fresh lane carries URLs that would have belonged to it. The second case is
 * the one that shipped: the bucket was emptied and then unlinked.
 */
function check(read, classifyFresh) {
  const out = [];
  const fresh = urls(read(FRESH));
  const seen = new Map();
  for (const name of [...BUCKETS, FRESH]) {
    for (const u of urls(read(name))) {
      if (seen.has(u)) out.push(`${u} is in both ${seen.get(u)} and ${name}`);
      else seen.set(u, name);
    }
  }
  for (const name of BUCKETS) {
    const xml = read(name);
    if (xml != null && urls(xml).length === 0) {
      out.push(`${name} exists with 0 URLs`);
      continue;
    }
    if (xml == null && fresh.some((u) => classifyFresh(u) === name)) {
      out.push(`${name} is missing while ${FRESH} carries URLs that belong to it`);
    }
  }
  return out;
}

// Which bucket a URL in the fresh lane came from, by route shape - the same
// split scripts/sitemap_emit.js makes.
function bucketOf(u) {
  let p;
  try { p = new URL(u).pathname; } catch { return null; }
  if (/^\/guides\/.+\/$/.test(p)) return 'sitemap-guides.xml';
  if (/^\/(states|personal-injury)\//.test(p)) return 'sitemap-states.xml';
  if (/^\/[a-z0-9-]+-[a-z]{2}\/$/.test(p)) return 'sitemap-cities.xml';
  return 'sitemap-core.xml';
}

const problems = [];
const readDist = (name) => {
  const f = path.join(DIST, name);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
let checked = 0;
if (fs.existsSync(path.join(DIST, 'sitemap.xml'))) {
  checked = [...BUCKETS, FRESH].filter((n) => readDist(n) != null).length;
  problems.push(...check(readDist, bucketOf));
}

// Negative proof: the exact shape that shipped - every guide in the fresh lane
// and no sitemap-guides.xml - plus an empty bucket left on disk.
const one = (u) => `<urlset><url><loc>${u}</loc></url></urlset>`;
const hostile = check((n) => {
  if (n === FRESH) return one('https://x.test/guides/a/');
  if (n === 'sitemap-cities.xml') return '<urlset></urlset>';
  return null;
}, bucketOf);
if (!hostile.some((p) => p.includes('sitemap-guides.xml is missing while'))) {
  problems.push('negative proof no longer caught: a guides bucket emptied into the fresh lane');
}
if (!hostile.some((p) => p === 'sitemap-cities.xml exists with 0 URLs')) {
  problems.push('negative proof no longer caught: a bucket file left on disk with 0 URLs');
}
const dup = check((n) => (n === FRESH || n === 'sitemap-guides.xml' ? one('https://x.test/guides/a/') : null), bucketOf);
if (!dup.some((p) => p.includes('is in both'))) {
  problems.push('negative proof no longer caught: one URL in two sub-sitemaps');
}
// Positive proof: a guide in the fresh lane and another left in its bucket.
const good = check((n) => {
  if (n === FRESH) return one('https://x.test/guides/a/');
  if (n === 'sitemap-guides.xml') return one('https://x.test/guides/b/');
  return null;
}, bucketOf);
if (good.length) problems.push('positive proof failed: a valid split was rejected: ' + good.join('; '));

if (problems.length) {
  console.error('SITEMAP BUCKET NOT-EMPTIED CONTRACT FAIL');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✅ SITEMAP BUCKET NOT-EMPTIED CONTRACT PASS (${checked ? checked + ' sub-sitemaps in dist/, no bucket emptied by the fresh lane' : 'no dist/sitemap.xml; negative proof only'})`);
