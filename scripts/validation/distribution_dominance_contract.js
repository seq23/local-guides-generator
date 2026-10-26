#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`DISTRIBUTION DOMINANCE FAIL: ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function pct(part, total) {
  return total ? (100 * part / total) : 0;
}

function run() {
  const root = path.join(__dirname, '..', '..');
  const dist = path.join(root, 'dist');
  const manifestPath = path.join(dist, 'distribution-manifest.json');
  const summaryPath = path.join(dist, 'distribution-summary.txt');
  if (!fs.existsSync(manifestPath)) fail('missing dist/distribution-manifest.json');
  if (!fs.existsSync(summaryPath)) fail('missing dist/distribution-summary.txt');
  const manifest = readJson(manifestPath);
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (!pages.length) fail('distribution-manifest.json pages[] missing/empty');

  // Distribution coverage is measured over INDEXABLE pages.
  //
  // This used to require every city-home page to be in the sitemap, which
  // contradicted scripts/sitemap_emit.js - that script drops noindex pages on
  // purpose, because submitting a page that is marked noindex spends crawl budget
  // to be told no. Once the 200 unresearched city pages were correctly set to
  // noindex, the two rules could not both hold, and the one asking a withheld page
  // to be advertised is the one that was wrong.
  //
  // The inverse is now asserted instead, which nothing checked before: a noindex
  // page must NOT appear in a sitemap. That is a stricter contract than the one it
  // replaces, not a looser one.
  const leaked = pages.filter(p => p.noindex && p.inSitemap);
  if (leaked.length) fail(`${leaked.length} noindex page(s) are advertised in a sitemap, e.g. ${leaked[0].url} - a withheld page must not be submitted`);

  const requiredFamilies = ['home', 'guides-hub', 'guide-detail', 'city-home'];
  for (const fam of requiredFamilies) {
    const famAll = pages.filter(p => p.pageFamily === fam);
    if (!famAll.length) fail(`missing family in distribution manifest: ${fam}`);
    const famPages = famAll.filter(p => !p.noindex);
    if (!famPages.length) fail(`every ${fam} page is noindex - the family exists but none of it is reachable from search`);
    const missingSitemap = famPages.filter(p => !p.inSitemap);
    if (missingSitemap.length) fail(`${fam} has indexable pages missing sitemap coverage`);
    if (fam === 'home' || fam === 'guides-hub') {
      const missingDist = famPages.filter(p => !(p.inIndexNowPriority || p.inIndexNowBatch));
      if (missingDist.length) fail(`${fam} has pages missing IndexNow distribution coverage`);
    }
  }

  const indexable = pages.filter(p => !p.noindex);
  const homePages = indexable.filter(p => p.pageFamily === 'home');
  if (homePages.some(p => !p.inIndexNowPriority)) fail('home page must be in IndexNow priority');
  const guidesHub = indexable.filter(p => p.pageFamily === 'guides-hub');
  if (guidesHub.some(p => !p.inIndexNowPriority)) fail('guides hub must be in IndexNow priority');

  const guidePages = indexable.filter(p => p.pageFamily === 'guide-detail');
  const cityPages = indexable.filter(p => p.pageFamily === 'city-home');
  if (pct(guidePages.filter(p => p.inIndexNowPriority).length, guidePages.length) < 25) fail('guide-detail priority coverage below 25%');
  if (pct(cityPages.filter(p => p.inIndexNowBatch || p.inIndexNowPriority).length, cityPages.length) < 25) fail('city-home batch/priority coverage below 25%');
  if (pct(guidePages.filter(p => p.inLlms || p.inLlmsFull || p.inLlmsGuides).length, guidePages.length) < 80) fail('guide-detail llms coverage below 80%');

  const guidesHubPages = indexable.filter(p => p.pageFamily === 'guides-hub');
  const guidePagesForFresh = indexable.filter(p => p.pageFamily === 'guide-detail');
  const cityPagesForFresh = indexable.filter(p => p.pageFamily === 'city-home');

  if (homePages.some(p => !p.inFreshSitemap)) fail('home page missing from sitemap-fresh.xml');
  if (guidesHubPages.some(p => !p.inFreshSitemap)) fail('guides hub missing from sitemap-fresh.xml');

  // Fresh coverage, stated so that it can actually be satisfied.
  //
  // This used to require min(15, N) guide pages and min(20, N) city pages to be
  // in sitemap-fresh.xml. For a site with no more than that many pages it
  // therefore required ALL of them - and since 25 Oct 2026 a URL is in exactly
  // one sub-sitemap, so "all of them in the fresh lane" means "sitemap-guides.xml
  // and sitemap-cities.xml are empty". uscisexam.com (15 guide pages) and
  // dentistryguides.com (6 indexable city pages) shipped exactly that: both
  // buckets went out with 0 URLs, both kept answering 200 on the live site after
  // being deleted from dist/, and Search Console reported one error against each
  // (Search Readiness item e2, 26 Oct 2026).
  //
  // Three things are asserted instead, and together they are stricter than the
  // rule they replace rather than looser:
  //   - every indexable page of the family is in EXACTLY one sub-sitemap;
  //   - the family's own bucket is never empty while the family has a page;
  //   - the fresh lane still carries all but at most that one page.
  const BUCKET = { 'guide-detail': 'sitemap-guides.xml', 'city-home': 'sitemap-cities.xml' };
  const CAP = { 'guide-detail': 15, 'city-home': 20 };
  for (const [family, famPages] of [['guide-detail', guidePagesForFresh], ['city-home', cityPagesForFresh]]) {
    const bucket = BUCKET[family];
    const multi = famPages.filter(p => (p.sitemapFiles || []).length !== 1);
    if (multi.length) fail(`${family}: ${multi.length} page(s) are in ${(multi[0].sitemapFiles || []).length} sub-sitemaps, not exactly one, e.g. ${multi[0].url}`);
    if (famPages.length && !famPages.some(p => (p.sitemapFiles || []).includes(bucket))) {
      fail(`${family}: ${bucket} carries no URL while ${famPages.length} indexable page(s) exist - an empty bucket that Search Console still holds as a submitted sitemap`);
    }
    const inFresh = famPages.filter(p => p.inFreshSitemap).length;
    const min = Math.max(0, Math.min(CAP[family], famPages.length) - 1);
    if (inFresh < min) fail(`${family} fresh coverage below expected minimum (${min} of ${famPages.length})`);
  }

  const summary = fs.readFileSync(summaryPath, 'utf8');
  if (!/Focus family coverage:/i.test(summary)) fail('distribution-summary.txt missing focus coverage block');
  if (!/Underexposed high-priority pages/i.test(summary)) fail('distribution-summary.txt missing underexposed block');

  const withheld = pages.filter(p => p.noindex).length;
  console.log(`✅ distribution_dominance_contract passed (${indexable.length} indexable page(s) measured; ${withheld} noindex page(s) correctly withheld from every sitemap)`);
}

if (require.main === module) run();
module.exports = { run };
