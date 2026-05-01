#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const cityDir = path.join(repoRoot, 'data', 'city_content');
const baseSchemaPath = path.join(repoRoot, 'data', 'contracts', 'city_schema_base.json');
const verticalSchemaPath = path.join(repoRoot, 'data', 'contracts', 'city_schema_vertical_extensions.json');
const templateDir = path.join(repoRoot, 'data', 'templates');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

if (!fs.existsSync(cityDir)) fail('data/city_content missing');
if (!fs.existsSync(baseSchemaPath)) fail('data/contracts/city_schema_base.json missing');
if (!fs.existsSync(verticalSchemaPath)) fail('data/contracts/city_schema_vertical_extensions.json missing');

const base = readJson(baseSchemaPath);
const verticals = readJson(verticalSchemaPath);
const decisionTypes = new Set(base.decision_block_types || []);
const verticalFolders = fs.readdirSync(cityDir).filter((name) => fs.statSync(path.join(cityDir, name)).isDirectory());
const rootJson = fs.readdirSync(cityDir).filter((name) => name.endsWith('.json'));
if (rootJson.length) fail(`root-level city_content files still exist: ${rootJson.join(', ')}`);

let checked = 0;
for (const vertical of verticalFolders) {
  const folder = path.join(cityDir, vertical);
  const files = fs.readdirSync(folder).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    const full = path.join(folder, file);
    const data = readJson(full);
    checked += 1;
    for (const key of base.required || []) {
      if (!(key in data)) fail(`${path.relative(repoRoot, full)} missing base key ${key}`);
    }
    if (String(data.vertical || '') !== vertical) fail(`${path.relative(repoRoot, full)} vertical field mismatch: expected ${vertical}`);
    const block = data.primary_city_decision_block || {};
    if (!decisionTypes.has(String(block.type || ''))) fail(`${path.relative(repoRoot, full)} has invalid decision block type`);
    if (!Array.isArray(block.items)) fail(`${path.relative(repoRoot, full)} decision block items must be an array`);
    const listKeys = ['market_specific_notes','local_vetting_points','typical_cost_ranges','payment_options','wait_time_notes','availability_notes','named_resources_or_providers'];
    for (const key of listKeys) {
      if (!Array.isArray(data[key])) fail(`${path.relative(repoRoot, full)} ${key} must be an array`);
    }
    const ext = verticals[vertical] || [];
    for (const key of ext) {
      if (!(key in data)) fail(`${path.relative(repoRoot, full)} missing vertical key ${key}`);
      if (!Array.isArray(data[key])) fail(`${path.relative(repoRoot, full)} vertical key ${key} must be an array`);
    }
  }
}

const templateFiles = [
  'city_content.base.schema.json',
  'city_content.dentistry.schema.json',
  'city_content.neuro.schema.json',
  'city_content.trt.schema.json',
  'city_content.uscis_medical.schema.json',
  'city_content.pi.schema.json'
];
for (const file of templateFiles) {
  if (!fs.existsSync(path.join(templateDir, file))) fail(`missing template ${file}`);
}

console.log(JSON.stringify({ ok: true, checked_city_files: checked, vertical_folders: verticalFolders.length, templates_verified: templateFiles.length }, null, 2));
