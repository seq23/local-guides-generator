/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const sponsorship = require('../helpers/sponsorship');

const CANONICAL_CTA_TEXT = 'Speak directly with a vetted provider serving your location.';

function fileExists(fp) {
  try {
    fs.accessSync(fp, fs.constants.R_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function readText(fp) {
  return fs.readFileSync(fp, 'utf8');
}

function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`NEXT STEPS CTA CONTRACT FAIL: missing "${needle}" in ${label}`);
  }
}

function assertNotContains(haystack, needle, label) {
  if (haystack.includes(needle)) {
    throw new Error(`NEXT STEPS CTA CONTRACT FAIL: forbidden "${needle}" present in ${label}`);
  }
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || process.cwd();
  const distDir = path.join(repoRoot, 'dist');
  if (!fileExists(distDir)) {
    throw new Error('NEXT STEPS CTA CONTRACT FAIL: dist/ not found. Run build first.');
  }

  // Load buyouts (if any). Empty is allowed.
  let buyouts = [];
  try {
    const fp = path.join(repoRoot, 'data', 'buyouts.json');
    if (fileExists(fp)) {
      const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
      buyouts = Array.isArray(raw) ? raw : [];
    }
  } catch (_) {
    buyouts = [];
  }

  const now = new Date();

  const pages = [];

  // Home
  const home = path.join(distDir, 'index.html');
  if (fileExists(home)) pages.push({ fp: home, meta: { pageType: 'home' } });

  // City pages: dist/<citySlug>/index.html
  const citiesFile = path.join(repoRoot, 'data', 'cities.json');
  if (fileExists(citiesFile)) {
    const cities = readJson(citiesFile);
    if (Array.isArray(cities)) {
      for (const c of cities) {
        const slug = c && c.slug ? String(c.slug) : null;
        if (!slug) continue;
        const st = c && c.state ? String(c.state) : null;
        const fp = path.join(distDir, slug, 'index.html');
        if (fileExists(fp)) pages.push({ fp, meta: { pageType: 'city', citySlug: slug, stateCode: st } });
      }
    }
  }

  // State pages: dist/states/<abbr>/index.html
  const statesDir = path.join(distDir, 'states');
  if (fileExists(statesDir)) {
    try {
      const abbrs = fs.readdirSync(statesDir).filter((d) => !d.startsWith('.'));
      for (const ab0 of abbrs) {
        const fp = path.join(statesDir, ab0, 'index.html');
        if (fileExists(fp)) pages.push({ fp, meta: { pageType: 'state', stateCode: String(ab0).toUpperCase() } });
      }
    } catch (_) {
      // ignore
    }
  }

  // Validate per-page expectation.
  let expectedCount = 0;
  let scannedCount = 0;

  for (const row of pages) {
    const fp = row.fp;
    const meta = row.meta || {};
    const label = path.relative(repoRoot, fp);
    const html = readText(fp);
    const hasZone = html.includes('data-next-steps-zone="true"');

    const expected = sponsorship.shouldRenderNextSteps({
      pageType: meta.pageType,
      citySlug: meta.citySlug || null,
      stateCode: meta.stateCode || null,
      guideRoute: meta.guideRoute || null,
      buyouts,
      now,
    });

    if (expected) expectedCount += 1;
    scannedCount += 1;

    if (!expected) {
      if (hasZone) {
        throw new Error(`NEXT STEPS CTA CONTRACT FAIL: CTA zone rendered but not expected. File=${label}`);
      }
      assertNotContains(html, CANONICAL_CTA_TEXT, label);
      continue;
    }

    // Expected
    if (!hasZone) {
      throw new Error(`NEXT STEPS CTA CONTRACT FAIL: missing CTA zone on expected page. File=${label}`);
    }
    assertContains(html, CANONICAL_CTA_TEXT, label);
    assertContains(html, 'data-next-steps-cta="true"', label);
  }

  if (scannedCount === 0) {
    throw new Error('NEXT STEPS CTA CONTRACT FAIL: no pages were scanned (dist missing expected surfaces).');
  }

  console.log('✅ NEXT STEPS CTA CONTRACT PASS');
}

module.exports = { run };
