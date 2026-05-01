#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const CITY_CONTENT_DIR = path.join(DATA_DIR, 'city_content');
const LISTINGS_DIR = path.join(DATA_DIR, 'listings');
const PAGE_SETS_DIR = path.join(DATA_DIR, 'page_sets', 'examples');
const GLOBAL_PAGES_DIR = path.join(DATA_DIR, 'global_pages');
const EXAMPLE_PROVIDERS_DIR = path.join(DATA_DIR, 'example_providers');
const CONTRACT_PATH = path.join(DATA_DIR, 'contracts', 'layer_source_of_truth_map.json');

const ENRICHMENT_KEYS = new Set([
  'market_specific_notes',
  'local_vetting_points',
  'typical_cost_ranges',
  'payment_options',
  'wait_time_notes',
  'availability_notes',
  'named_resources_or_providers',
  'city_intro_override',
  'primary_city_decision_block'
]);

function walk(dir, matcher, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, matcher, out);
    else if (!matcher || matcher(full)) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

const errors = [];
const summary = {
  contract_present: fs.existsSync(CONTRACT_PATH),
  root_city_content_files: [],
  vertical_city_content_files: 0,
  listings_files_checked: 0,
  pack_global_dirs: 0,
  shared_global_files: 0,
  example_provider_vertical_dirs: 0
};

if (!summary.contract_present) {
  errors.push('Missing data/contracts/layer_source_of_truth_map.json');
}

if (fs.existsSync(CITY_CONTENT_DIR)) {
  for (const entry of fs.readdirSync(CITY_CONTENT_DIR, { withFileTypes: true })) {
    const full = path.join(CITY_CONTENT_DIR, entry.name);
    if (entry.isFile() && entry.name.endsWith('.json')) {
      summary.root_city_content_files.push(rel(full));
    }
    if (entry.isDirectory()) {
      summary.vertical_city_content_files += walk(full, f => f.endsWith('.json')).length;
    }
  }
}
if (summary.root_city_content_files.length) {
  errors.push(`Root-level city enrichment files are not allowed: ${summary.root_city_content_files.join(', ')}`);
}

for (const file of walk(LISTINGS_DIR, f => f.endsWith('.json'))) {
  summary.listings_files_checked += 1;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const required = ['city_slug', 'sponsor', 'listings'];
  for (const key of required) {
    if (!(key in data)) errors.push(`${rel(file)} is missing required listings key: ${key}`);
  }
  for (const key of Object.keys(data)) {
    if (ENRICHMENT_KEYS.has(key)) {
      errors.push(`${rel(file)} contains city enrichment key that belongs in data/city_content: ${key}`);
    }
  }
}

if (fs.existsSync(PAGE_SETS_DIR)) {
  summary.pack_global_dirs = fs.readdirSync(PAGE_SETS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.endsWith('_global_pages')).length;
}
if (summary.pack_global_dirs === 0) {
  errors.push('No *_global_pages directories found under data/page_sets/examples');
}

summary.shared_global_files = walk(GLOBAL_PAGES_DIR, f => f.endsWith('.json')).length;
if (summary.shared_global_files === 0) {
  errors.push('No shared global JSON files found under data/global_pages');
}

if (fs.existsSync(EXAMPLE_PROVIDERS_DIR)) {
  summary.example_provider_vertical_dirs = fs.readdirSync(EXAMPLE_PROVIDERS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory()).length;
}
if (summary.example_provider_vertical_dirs === 0) {
  errors.push('No vertical example provider directories found under data/example_providers');
}

const outPath = path.join(ROOT, 'staging', 'phase0b_layer_inventory_report.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ ok: errors.length === 0, summary, errors }, null, 2));

if (errors.length) {
  console.error(JSON.stringify({ ok: false, summary, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, summary, report: rel(outPath) }, null, 2));
