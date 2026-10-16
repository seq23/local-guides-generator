#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const neuroServices = require('../lib/neuro_services');

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
function hasSortedThree(list, vertical) {
  if (!Array.isArray(list) || list.length !== 3) return false;
  const names = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') return false;
    const name = String(item.name || '').trim();
    if (!name) return false;
    // Neuro: offers_evaluation and offers_therapy both booleans, at least one true.
    if (String(vertical || '').toLowerCase() === 'neuro' && neuroServices.recordProblem(item)) return false;
    if (String(vertical || '').toLowerCase() === 'trt') {
      if (typeof item.offers_peptide_programs !== 'boolean') return false;
      if (typeof item.peptide_program_notes !== 'string') return false;
      if (typeof item.peptide_program_source !== 'string') return false;
    }
    names.push(name);
  }
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
const therapyMetros = new Set();
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
      if (!hasSortedThree(data, row.vertical)) fail(`grouped provider dataset must contain exactly 3 alphabetized unique provider objects for ${key} (${subKey})${String(row.vertical).toLowerCase()==='neuro' ? ' with boolean offers_evaluation and offers_therapy flags, at least one true' : (String(row.vertical).toLowerCase()==='trt' ? ' with peptide-program fields' : '')}`);
    }
    // Neuro therapy practices: optional per metro, but every one present must
    // carry a public evidence URL, a note on what it shows, and its booleans.
    if (String(row.vertical).toLowerCase() === 'neuro') {
      const therapyFile = path.join(baseDir, `${row.city_slug}__${neuroServices.THERAPY_SUBKEY}.json`);
      if (fs.existsSync(therapyFile)) {
        const problem = neuroServices.therapyListProblem(loadJson(therapyFile, key));
        if (problem) fail(`neuro therapy dataset for ${key} ${problem} (${path.relative(REPO_ROOT, therapyFile)})`);
        therapyMetros.add(row.city_slug);
      }
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
// Neuro therapy coverage: no therapy file for a metro that is not promoted
// (it would never render), and coverage never silently drops below the floor.
const neuroDir = path.join(REPO_ROOT, 'data', 'example_providers', 'neuro');
if (fs.existsSync(neuroDir)) {
  const suffix = `__${neuroServices.THERAPY_SUBKEY}.json`;
  const therapyFiles = fs.readdirSync(neuroDir).filter((f) => f.endsWith(suffix));
  for (const f of therapyFiles) {
    const slug = f.slice(0, -suffix.length);
    if (!therapyMetros.has(slug)) fail(`neuro therapy dataset for a metro with no promoted runtime row: data/example_providers/neuro/${f}`);
  }
  if (therapyFiles.length && therapyMetros.size < neuroServices.THERAPY_MIN_METROS) fail(`neuro therapy coverage fell to ${therapyMetros.size} metros (floor ${neuroServices.THERAPY_MIN_METROS}, scripts/lib/neuro_services.js)`);
  if (!therapyFiles.length && rows.some((r) => String(r.vertical).toLowerCase() === 'neuro')) fail('no neuro therapy datasets (data/example_providers/neuro/*__therapy.json): the therapy path would land on evaluator lists only');
}
console.log(`COVERAGE RUNTIME SUPPORT CONTRACT PASS (${rows.length} rows; ${therapyMetros.size} neuro metros with therapy practices)`);
