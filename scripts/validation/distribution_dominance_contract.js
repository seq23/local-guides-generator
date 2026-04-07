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

  const requiredFamilies = ['home', 'guides-hub', 'guide-detail', 'city-home'];
  for (const fam of requiredFamilies) {
    const famPages = pages.filter(p => p.pageFamily === fam);
    if (!famPages.length) fail(`missing family in distribution manifest: ${fam}`);
    const missingSitemap = famPages.filter(p => !p.inSitemap);
    if (missingSitemap.length) fail(`${fam} has pages missing sitemap coverage`);
    if (fam === 'home' || fam === 'guides-hub') {
      const missingDist = famPages.filter(p => !(p.inIndexNowPriority || p.inIndexNowBatch));
      if (missingDist.length) fail(`${fam} has pages missing IndexNow distribution coverage`);
    }
  }

  const homePages = pages.filter(p => p.pageFamily === 'home');
  if (homePages.some(p => !p.inIndexNowPriority)) fail('home page must be in IndexNow priority');
  const guidesHub = pages.filter(p => p.pageFamily === 'guides-hub');
  if (guidesHub.some(p => !p.inIndexNowPriority)) fail('guides hub must be in IndexNow priority');

  const guidePages = pages.filter(p => p.pageFamily === 'guide-detail');
  const cityPages = pages.filter(p => p.pageFamily === 'city-home');
  if (pct(guidePages.filter(p => p.inIndexNowPriority).length, guidePages.length) < 25) fail('guide-detail priority coverage below 25%');
  if (pct(cityPages.filter(p => p.inIndexNowBatch || p.inIndexNowPriority).length, cityPages.length) < 25) fail('city-home batch/priority coverage below 25%');
  if (pct(guidePages.filter(p => p.inLlms || p.inLlmsFull || p.inLlmsGuides).length, guidePages.length) < 80) fail('guide-detail llms coverage below 80%');

  const guidesHubPages = pages.filter(p => p.pageFamily === 'guides-hub');
  const guidePagesForFresh = pages.filter(p => p.pageFamily === 'guide-detail');
  const cityPagesForFresh = pages.filter(p => p.pageFamily === 'city-home');

  if (homePages.some(p => !p.inFreshSitemap)) fail('home page missing from sitemap-fresh.xml');
  if (guidesHubPages.some(p => !p.inFreshSitemap)) fail('guides hub missing from sitemap-fresh.xml');

  const guideFreshMin = Math.min(15, guidePagesForFresh.length);
  const cityFreshMin = Math.min(20, cityPagesForFresh.length);
  if (guidePagesForFresh.filter(p => p.inFreshSitemap).length < guideFreshMin) fail(`guide-detail fresh coverage below expected minimum (${guideFreshMin})`);
  if (cityPagesForFresh.filter(p => p.inFreshSitemap).length < cityFreshMin) fail(`city-home fresh coverage below expected minimum (${cityFreshMin})`);

  const summary = fs.readFileSync(summaryPath, 'utf8');
  if (!/Focus family coverage:/i.test(summary)) fail('distribution-summary.txt missing focus coverage block');
  if (!/Underexposed high-priority pages/i.test(summary)) fail('distribution-summary.txt missing underexposed block');

  console.log('✅ distribution_dominance_contract passed');
}

if (require.main === module) run();
module.exports = { run };
