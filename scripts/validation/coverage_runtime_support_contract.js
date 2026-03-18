#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CSV_PATH = path.join(REPO_ROOT, 'data', 'research', 'coverage', 'coverage_runtime_support.csv');
const PROMOTED_PATH = path.join(REPO_ROOT, 'data', 'research', 'coverage', 'coverage_promoted.csv');

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => row[h] = String(cols[i] || '').trim());
    return row;
  });
}
function fail(msg){ console.error(`COVERAGE RUNTIME SUPPORT CONTRACT FAIL: ${msg}`); process.exit(1); }
function groupedSubKeys(vertical) {
  const v = String(vertical || '').toLowerCase();
  if (v === 'trt') return ['trt', 'iv_hydration', 'hair_restoration'];
  if (v === 'neuro') return ['adhd_eval', 'autism_eval'];
  return [];
}
function loadJson(file, key) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail(`invalid json for ${key}: ${path.relative(REPO_ROOT, file)}`); }
}
function hasSortedThree(list) {
  if (!Array.isArray(list) || list.length !== 3) return false;
  const names = list.map(x => String(x && x.name || '').trim());
  if (names.some(n => !n)) return false;
  const dedup = new Set(names.map(n => n.toLowerCase()));
  if (dedup.size !== names.length) return false;
  const sorted = [...names].sort((a,b)=>a.localeCompare(b, undefined, {sensitivity:'base'}));
  return sorted.every((x,i)=>x===names[i]);
}
if (!fs.existsSync(CSV_PATH)) fail('missing coverage_runtime_support.csv');
if (!fs.existsSync(PROMOTED_PATH)) fail('missing coverage_promoted.csv');
const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
const promoted = parseCsv(fs.readFileSync(PROMOTED_PATH, 'utf8'));
if (!rows.length) fail('coverage_runtime_support.csv has no rows');
const promotedKeys = new Set(promoted.filter(r=>String(r.publish_enabled).toLowerCase()==='true').map(r => `${r.vertical}::${r.city_slug}`));
const seen = new Set();
for (const row of rows) {
  const key = `${row.vertical}::${row.city_slug}`;
  if (seen.has(key)) fail(`duplicate row: ${key}`);
  seen.add(key);
  if (!promotedKeys.has(key)) fail(`runtime support row not promoted: ${key}`);
  if (String(row.runtime_ready).toLowerCase() !== 'true') fail(`runtime_ready must be true for ${key}`);
  const listingPath = path.join(REPO_ROOT, row.listing_json_path);
  if (!fs.existsSync(listingPath)) fail(`missing listing json for ${key}: ${row.listing_json_path}`);
  const listings = loadJson(listingPath, key);
  if (!listings || typeof listings !== 'object') fail(`listing json must be object for ${key}`);
  if (String(listings.city_slug || '').trim() !== row.city_slug) fail(`listing city_slug mismatch for ${key}`);
  if (!Array.isArray(listings.listings) || listings.listings.length < 1) fail(`listing json must include at least one listing for ${key}`);

  const subKeys = groupedSubKeys(row.vertical);
  if (subKeys.length) {
    const baseDir = path.join(REPO_ROOT, 'data', 'example_providers', row.vertical);
    for (const subKey of subKeys) {
      const file = path.join(baseDir, `${row.city_slug}__${subKey}.json`);
      if (!fs.existsSync(file)) fail(`missing grouped provider dataset for ${key}: ${path.relative(REPO_ROOT, file)}`);
      const data = loadJson(file, key);
      if (!hasSortedThree(data)) fail(`grouped provider dataset must contain exactly 3 alphabetized unique names for ${key} (${subKey})`);
    }
  } else {
    const providerPath = path.join(REPO_ROOT, row.provider_dataset_path);
    if (!fs.existsSync(providerPath)) fail(`missing provider dataset for ${key}: ${row.provider_dataset_path}`);
    const providers = loadJson(providerPath, key);
    if (!Array.isArray(providers) || providers.length < 2) fail(`provider dataset must have >=2 entries for ${key}`);
    if (!providers.every(p => p && typeof p === 'object' && String(p.name || '').trim())) fail(`provider dataset missing provider names for ${key}`);
  }
}
for (const key of promotedKeys) {
  if (!seen.has(key)) fail(`promoted city missing runtime support row: ${key}`);
}
console.log(`COVERAGE RUNTIME SUPPORT CONTRACT PASS (${rows.length} rows)`);
