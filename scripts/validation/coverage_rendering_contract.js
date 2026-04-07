#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PROMOTED_PATH = path.join(REPO_ROOT, 'data', 'research', 'coverage', 'coverage_promoted.csv');
const RUNTIME_PATH = path.join(REPO_ROOT, 'data', 'research', 'coverage', 'coverage_runtime_support.csv');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const SITEMAP_GLOB = /^sitemap(?:-[a-z]+)?\.xml$/i;
const HOME_PATH = path.join(DIST_DIR, 'index.html');
const SITE_PATH = path.join(REPO_ROOT, 'data', 'site.json');

function fail(msg) {
  console.error(`COVERAGE RENDERING CONTRACT FAIL: ${msg}`);
  process.exit(1);
}
function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = String(parts[i] || '').trim();
    });
    return row;
  });
}
function escapeRegex(str) { return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtmlForRegex(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function readSiteOrNull() {
  if (!fs.existsSync(SITE_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(SITE_PATH, 'utf8')); } catch { return null; }
}
function currentPackIsVertical(targetVertical) {
  const site = readSiteOrNull();
  const ps = String(site && site.pageSetFile || '').toLowerCase();
  const normalizedTarget = String(targetVertical || '').replace(/-/g, '_').toLowerCase();
  return ps.includes(normalizedTarget);
}
function groupedSubKeys(vertical) {
  const v = String(vertical || '').toLowerCase();
  if (v === 'trt') return ['trt', 'iv_hydration', 'hair_restoration'];
  if (v === 'neuro') return ['adhd_eval', 'autism_eval'];
  return [];
}
function loadGroupedProviders(vertical, citySlug) {
  const baseDir = path.join(REPO_ROOT, 'data', 'example_providers', vertical);
  return groupedSubKeys(vertical).map((subKey) => {
    const file = path.join(baseDir, `${citySlug}__${subKey}.json`);
    if (!fs.existsSync(file)) fail(`missing grouped provider file for ${vertical}::${citySlug}: ${path.relative(REPO_ROOT, file)}`);
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail(`invalid grouped provider file: ${path.relative(REPO_ROOT, file)}`); }
    return { subKey, providers: data };
  });
}

if (!fs.existsSync(PROMOTED_PATH)) fail('missing coverage_promoted.csv');
if (!fs.existsSync(RUNTIME_PATH)) fail('missing coverage_runtime_support.csv');
if (!fs.existsSync(DIST_DIR)) fail('missing dist directory');
const sitemapFiles = fs.readdirSync(DIST_DIR).filter((name) => SITEMAP_GLOB.test(name));
if (!sitemapFiles.length) fail('missing dist sitemap files');
if (!fs.existsSync(HOME_PATH)) fail('missing dist/index.html');

const promoted = parseCsv(fs.readFileSync(PROMOTED_PATH, 'utf8')).filter((row) => String(row.publish_enabled).toLowerCase() === 'true' && currentPackIsVertical(row.vertical));
const runtimeRows = parseCsv(fs.readFileSync(RUNTIME_PATH, 'utf8')).filter((row) => String(row.runtime_ready).toLowerCase() === 'true');
function run() {
  const promoted = parseCsv(fs.readFileSync(PROMOTED_PATH, 'utf8')).filter((row) => String(row.publish_enabled).toLowerCase() === 'true' && currentPackIsVertical(row.vertical));
  const runtimeRows = parseCsv(fs.readFileSync(RUNTIME_PATH, 'utf8')).filter((row) => String(row.runtime_ready).toLowerCase() === 'true');
  if (!promoted.length) {
    console.log('COVERAGE RENDERING CONTRACT SKIP (no promoted cities for current pack)');
    return;
  }
  const runtimeMap = new Map(runtimeRows.map((row) => [`${row.vertical}::${row.city_slug}`, row]));
  const sitemap = sitemapFiles.map((name) => fs.readFileSync(path.join(DIST_DIR, name), 'utf8')).join('\n');
  const home = fs.readFileSync(HOME_PATH, 'utf8');

  let checked = 0;
  for (const row of promoted) {
  const key = `${row.vertical}::${row.city_slug}`;
  const runtime = runtimeMap.get(key);
  if (!runtime) continue;
  const cityPath = path.join(DIST_DIR, row.city_slug, 'index.html');
  if (!fs.existsSync(cityPath)) fail(`published page missing for ${key}: dist/${row.city_slug}/index.html`);
  const html = fs.readFileSync(cityPath, 'utf8');
  if (!html.includes(`data-city="${row.city_slug}"`)) fail(`missing data-city marker for ${key}`);
  if (!html.includes('data-example-providers="true"')) fail(`missing example providers block for ${key}`);
  if (!html.includes('data-state-lookup="true"')) fail(`missing state lookup block for ${key}`);
  if (!html.includes('data-faq="true"')) fail(`missing FAQ block for ${key}`);
  if (!html.includes('/request-assistance/?pt=')) fail(`missing request-assistance CTA for ${key}`);

  const allSections = Array.from(String(html).matchAll(/<section[^>]*data-example-providers="true"[^>]*>[\s\S]*?<\/section>/gi)).map((m)=>m[0]);
  if (!allSections.length) fail(`unable to extract example providers sections for ${key}`);
  if (allSections.some(sec => /<a\s/i.test(sec))) fail(`example providers block contains links for ${key}`);

  const subKeys = groupedSubKeys(row.vertical);
  if (subKeys.length) {
    const grouped = loadGroupedProviders(row.vertical, row.city_slug);
    if (allSections.length < grouped.length) fail(`missing grouped example providers sections for ${key}`);
    let therapyTrueCount = 0;
    let peptideTrueCount = 0;
    for (const entry of grouped) {
      for (const provider of entry.providers) {
        const name = String(provider?.name || '').trim();
        const rawNeedle = `<strong>${name}</strong>`;
        const escapedNeedle = `<strong>${escapeHtmlForRegex(name)}</strong>`;
        if (!html.includes(rawNeedle) && !html.includes(escapedNeedle)) fail(`provider name not rendered for ${key}: ${name}`);
        if (String(row.vertical).toLowerCase() === 'neuro' && provider && provider.offers_therapy === true) {
          therapyTrueCount += 1;
        }
        if (String(row.vertical).toLowerCase() === 'trt' && provider && provider.offers_peptide_programs === true) {
          peptideTrueCount += 1;
        }
      }
    }
    if (String(row.vertical).toLowerCase() === 'neuro' && therapyTrueCount > 0) {
      const markerCount = (html.match(/Also offers therapy\./g) || []).length;
      if (markerCount < therapyTrueCount) fail(`therapy capability marker count too low for ${key}: expected >= ${therapyTrueCount}, found ${markerCount}`);
    }
    if (String(row.vertical).toLowerCase() === 'trt' && peptideTrueCount > 0) {
      const markerCount = (html.match(/Offers peptide programs\./g) || []).length;
      if (markerCount < peptideTrueCount) fail(`peptide-program marker count too low for ${key}: expected >= ${peptideTrueCount}, found ${markerCount}`);
    }
  } else {
    const providerPath = path.join(REPO_ROOT, runtime.provider_dataset_path);
    let providers;
    try { providers = JSON.parse(fs.readFileSync(providerPath, 'utf8')); } catch { fail(`invalid provider dataset while checking rendering for ${key}`); }
    for (const provider of providers) {
      const name = String(provider?.name || '').trim();
      const rawNeedle = `<strong>${name}</strong>`;
      const escapedNeedle = `<strong>${escapeHtmlForRegex(name)}</strong>`;
      if (!html.includes(rawNeedle) && !html.includes(escapedNeedle)) fail(`provider name not rendered for ${key}: ${name}`);
    }
  }

  const sitemapPattern = new RegExp(`<loc>[^<]*/${escapeRegex(row.city_slug)}/<\\/loc>`, 'i');
  if (!sitemapPattern.test(sitemap)) fail(`sitemap missing promoted city for ${key}`);
  const homePattern = new RegExp(`href="/${escapeRegex(row.city_slug)}/"`, 'i');
  if (!homePattern.test(home)) fail(`homepage/hub missing promoted city link for ${key}`);

    checked += 1;
  }
  console.log(`COVERAGE RENDERING CONTRACT PASS (${checked} promoted cities)`);
}

if (require.main === module) run();
module.exports = { run };
