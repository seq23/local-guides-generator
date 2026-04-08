/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const CANONICAL_CTA_TEXT = 'Use this decision hub when you want to move forward without guessing which path fits best.';

function fileExists(fp) {
  try { fs.accessSync(fp, fs.constants.R_OK); return true; } catch (_) { return false; }
}
function readJson(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function readText(fp) { return fs.readFileSync(fp, 'utf8'); }
function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error(`NEXT STEPS CTA CONTRACT FAIL: missing "${needle}" in ${label}`);
}
function assertNotContains(haystack, needle, label) {
  if (haystack.includes(needle)) throw new Error(`NEXT STEPS CTA CONTRACT FAIL: forbidden "${needle}" present in ${label}`);
}
function readContracts(repoRoot) {
  try { return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'page_contracts.json'), 'utf8')); }
  catch (_) { return {}; }
}
function shouldExpectNextSteps(contracts, meta) {
  const conf = contracts && contracts.next_steps_required ? contracts.next_steps_required : {};
  const pageTypes = Array.isArray(conf.page_types) ? conf.page_types : [];
  const globalRoutes = new Set(Array.isArray(conf.global_routes) ? conf.global_routes : []);
  const keywords = Array.isArray(conf.guide_route_keywords) ? conf.guide_route_keywords : [];
  const route = String(meta.route || '/');
  if (pageTypes.includes(meta.pageType)) return true;
  if (globalRoutes.has(route)) return true;
  if (meta.pageType === 'guide' && keywords.some((kw) => route.includes(String(kw).toLowerCase()))) return true;
  return false;
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || process.cwd();
  const distDir = path.join(repoRoot, 'dist');
  if (!fileExists(distDir)) throw new Error('NEXT STEPS CTA CONTRACT FAIL: dist/ not found. Run build first.');
  const contracts = readContracts(repoRoot);
  const pages = [];

  const home = path.join(distDir, 'index.html');
  if (fileExists(home)) pages.push({ fp: home, meta: { pageType: 'home', route: '/' } });

  const citiesFile = path.join(repoRoot, 'data', 'cities.json');
  if (fileExists(citiesFile)) {
    const cities = readJson(citiesFile);
    if (Array.isArray(cities)) {
      for (const c of cities) {
        const slug = c && c.slug ? String(c.slug) : null;
        if (!slug) continue;
        const fp = path.join(distDir, slug, 'index.html');
        if (fileExists(fp)) pages.push({ fp, meta: { pageType: 'city', route: '/' + slug + '/' } });
      }
    }
  }

  const statesDir = path.join(distDir, 'states');
  if (fileExists(statesDir)) {
    for (const ab0 of fs.readdirSync(statesDir).filter((d) => !d.startsWith('.'))) {
      const fp = path.join(statesDir, ab0, 'index.html');
      if (fileExists(fp)) pages.push({ fp, meta: { pageType: 'state', route: '/states/' + String(ab0).toLowerCase() + '/' } });
    }
  }

  const guidesRoot = path.join(distDir, 'guides');
  if (fileExists(guidesRoot)) {
    const hub = path.join(guidesRoot, 'index.html');
    if (fileExists(hub)) pages.push({ fp: hub, meta: { pageType: 'guides-hub', route: '/guides/' } });
    for (const dir of fs.readdirSync(guidesRoot).filter((d) => !d.startsWith('.'))) {
      const fp = path.join(guidesRoot, dir, 'index.html');
      if (fileExists(fp)) pages.push({ fp, meta: { pageType: 'guide', route: '/guides/' + dir + '/' } });
    }
  }

  if (!pages.length) throw new Error('NEXT STEPS CTA CONTRACT FAIL: no pages were scanned.');

  for (const row of pages) {
    const label = path.relative(repoRoot, row.fp);
    const html = readText(row.fp);
    const hasZone = html.includes('data-next-steps-zone="true"');
    const expected = shouldExpectNextSteps(contracts, row.meta || {});
    if (!expected) {
      if (hasZone) throw new Error(`NEXT STEPS CTA CONTRACT FAIL: CTA zone rendered but not expected. File=${label}`);
      assertNotContains(html, CANONICAL_CTA_TEXT, label);
      continue;
    }
    if (!hasZone) throw new Error(`NEXT STEPS CTA CONTRACT FAIL: missing CTA zone on expected page. File=${label}`);
    assertContains(html, CANONICAL_CTA_TEXT, label);
    assertContains(html, 'data-next-steps-cta="true"', label);
    assertContains(html, 'View Next Steps', label);
  }

  console.log('✅ NEXT STEPS CTA CONTRACT PASS');
}

module.exports = { run };
