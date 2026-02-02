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

  // Determine whether a LIVE vertical buyout exists (Option A).
  const pageSet = (ctx && ctx.pageSet) || null;
  const verticalLive = sponsorship.shouldRenderNextSteps(pageSet, { pageType: 'global', route: '/' });

  const filesToScan = [];

  // Home
  const home = path.join(distDir, 'index.html');
  if (fileExists(home)) filesToScan.push(home);

  // City pages (best-effort): dist/<citySlug>/index.html
  const citiesFile = path.join(repoRoot, 'data', 'cities.json');
  if (fileExists(citiesFile)) {
    const cities = readJson(citiesFile);
    if (Array.isArray(cities)) {
      for (const c of cities) {
        const slug = c && c.slug ? String(c.slug) : null;
        if (!slug) continue;
        const fp = path.join(distDir, slug, 'index.html');
        if (fileExists(fp)) filesToScan.push(fp);
      }
    }
  }

  // PI state pages (best-effort): dist/states/<abbr>/index.html
  const statesDir = path.join(distDir, 'states');
  if (fileExists(statesDir)) {
    try {
      const abbrs = fs.readdirSync(statesDir).filter((d) => !d.startsWith('.'));
      for (const ab of abbrs) {
        const fp = path.join(statesDir, ab, 'index.html');
        if (fileExists(fp)) filesToScan.push(fp);
      }
    } catch (_) {
      // ignore
    }
  }

  // Validate.
  let foundCta = 0;
  for (const fp of filesToScan) {
    const html = readText(fp);
    const label = path.relative(repoRoot, fp);

    const hasZone = html.includes('data-next-steps-zone="true"');

    if (!verticalLive) {
      // If no vertical buyout is live, we should not render the live-buyout CTA zone.
      if (hasZone) {
        throw new Error(`NEXT STEPS CTA CONTRACT FAIL: CTA zone rendered but no LIVE vertical buyout. File=${label}`);
      }
      // Also ensure canonical CTA text is not present accidentally.
      assertNotContains(html, CANONICAL_CTA_TEXT, label);
      continue;
    }

    // If vertical is live, then each eligible page should include the zone.
    // (Suppression for conflicting city/state/guide buyouts is handled per-page by shouldRenderNextSteps;
    // this validator is a baseline contract check on the built surfaces we can enumerate.)
    if (!hasZone) {
      throw new Error(`NEXT STEPS CTA CONTRACT FAIL: missing CTA zone on eligible page. File=${label}`);
    }

    // Canonical text must be present.
    assertContains(html, CANONICAL_CTA_TEXT, label);

    // The CTA element marker must exist.
    assertContains(html, 'data-next-steps-cta="true"', label);

    foundCta += 1;
  }

  if (verticalLive && foundCta == 0) {
    throw new Error('NEXT STEPS CTA CONTRACT FAIL: vertical buyout is live but no pages were checked (or dist missing expected pages).');
  }

  console.log('✅ NEXT STEPS CTA CONTRACT PASS');
}

module.exports = { run };
