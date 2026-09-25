/* eslint-disable no-console */
//
// Legacy-URL 301s for the pack standing in dist/.
//
// Bing Webmaster (25 Sep 2026) still held retired URLs on three of these sites
// (/trt/peptide-types-uses, /personal-injury/settlement-offers,
// /uscis-medical/cost, ...). Each page set lists the ones that have a live page
// on the same topic under `legacyRedirects`, and scripts/redirects_emit.js writes
// them into dist/_redirects. This checks the built result:
//
// 1. Every legacyRedirects entry of the active pack is in dist/_redirects as a
//    301, in both the bare and trailing-slash form.
// 2. Every target is a page this build produced, and none is the homepage.
// 3. No `from` path is itself a live page.
//
// Zero entries across all five page sets is a failure: the list exists, and a
// validator that finds nothing to check has checked nothing.

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const distRoot = path.join(repoRoot, 'dist');
const pageSetsDir = path.join(repoRoot, 'data', 'page_sets', 'examples');

function fail(lines) {
  console.error('FAIL: legacy redirects contract');
  for (const l of [].concat(lines)) console.error('  ' + l);
  process.exit(1);
}

const packFiles = fs.readdirSync(pageSetsDir).filter((f) => /^[a-z_]+_v1\.json$/.test(f) && !f.startsWith('cities_'));
let totalEntries = 0;
for (const f of packFiles) {
  const ps = JSON.parse(fs.readFileSync(path.join(pageSetsDir, f), 'utf8'));
  totalEntries += Array.isArray(ps.legacyRedirects) ? ps.legacyRedirects.length : 0;
}
if (totalEntries === 0) fail(`0 legacyRedirects entries across ${packFiles.length} page sets; refusing to pass on nothing.`);

const site = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'site.json'), 'utf8'));
const pageSetFile = String(site.pageSetFile || '');
const pageSet = JSON.parse(fs.readFileSync(path.join(repoRoot, pageSetFile), 'utf8'));
const rows = Array.isArray(pageSet.legacyRedirects) ? pageSet.legacyRedirects : [];

const redirectsPath = path.join(distRoot, '_redirects');
if (!fs.existsSync(redirectsPath)) fail('dist/_redirects is missing; build a pack first.');
const lines = new Set(fs.readFileSync(redirectsPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean));

const problems = [];
for (const row of rows) {
  const from = String(row.from || '').replace(/\/+$/, '');
  const to = String(row.to || '');
  if (to === '/' || !to) problems.push(`${from}: redirects to the homepage`);
  if (!fs.existsSync(path.join(distRoot, to.replace(/^\/+/, ''), 'index.html'))) problems.push(`${from}: target ${to} is not a built page`);
  if (fs.existsSync(path.join(distRoot, from.replace(/^\/+/, ''), 'index.html'))) problems.push(`${from}: is a live page and must not be redirected`);
  for (const variant of [from, from + '/']) {
    if (!lines.has(`${variant} ${to} 301`)) problems.push(`missing in dist/_redirects: "${variant} ${to} 301"`);
  }
}
if (problems.length) fail(problems);
console.log(`OK: legacy redirects contract (${rows.length} for ${path.basename(pageSetFile)}; ${totalEntries} across ${packFiles.length} page sets).`);
