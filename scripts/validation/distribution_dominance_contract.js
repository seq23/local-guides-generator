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

  const guideFreshMin = Math.min(15, guidePagesForFresh.length);
  const cityFreshMin = Math.min(20, cityPagesForFresh.length);
  if (guidePagesForFresh.filter(p => p.inFreshSitemap).length < guideFreshMin) fail(`guide-detail fresh coverage below expected minimum (${guideFreshMin})`);
  if (cityPagesForFresh.filter(p => p.inFreshSitemap).length < cityFreshMin) fail(`city-home fresh coverage below expected minimum (${cityFreshMin})`);

  const summary = fs.readFileSync(summaryPath, 'utf8');
  if (!/Focus family coverage:/i.test(summary)) fail('distribution-summary.txt missing focus coverage block');
  if (!/Underexposed high-priority pages/i.test(summary)) fail('distribution-summary.txt missing underexposed block');

  const withheld = pages.filter(p => p.noindex).length;
  console.log(`✅ distribution_dominance_contract passed (${indexable.length} indexable page(s) measured; ${withheld} noindex page(s) correctly withheld from every sitemap)`);
}

if (require.main === module) run();
module.exports = { run };
