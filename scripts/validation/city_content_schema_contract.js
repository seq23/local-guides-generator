#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const cityDir = path.join(repoRoot, 'data', 'city_content');
const contractsDir = path.join(repoRoot, 'data', 'contracts');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }
function listJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJson(fp));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(fp);
  }
  return out;
}

const base = readJson(path.join(contractsDir, 'city_schema_base.json'));
const verticals = readJson(path.join(contractsDir, 'city_schema_vertical_extensions.json'));
const allowedDecisionTypes = new Set(base.decision_block_types || []);
const problems = [];
const files = listJson(cityDir);

for (const fp of files) {
  const rel = path.relative(repoRoot, fp);
  const data = readJson(fp);
  for (const key of base.required || []) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      problems.push(`${rel}: missing required base key ${key}`);
    }
  }
  const vertical = String(data.vertical || '').trim();
  if (!vertical) problems.push(`${rel}: missing vertical`);
  const extKeys = verticals[vertical];
  if (!Array.isArray(extKeys)) {
    problems.push(`${rel}: unknown or malformed vertical extension map for ${vertical || 'blank'}`);
  } else {
    for (const key of extKeys) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) problems.push(`${rel}: missing vertical extension key ${key}`);
      else if (!Array.isArray(data[key])) problems.push(`${rel}: vertical extension key ${key} must be an array`);
    }
  }

  const block = data.primary_city_decision_block || {};
  if (!allowedDecisionTypes.has(String(block.type || ''))) problems.push(`${rel}: invalid primary_city_decision_block.type`);
  if (!Array.isArray(block.items) || !block.items.length) problems.push(`${rel}: decision block items must be a non-empty array`);

  const listKeys = [
    'market_specific_notes','local_vetting_points','typical_cost_ranges','payment_options','wait_time_notes','availability_notes','named_resources_or_providers'
  ];
  for (const key of listKeys) {
    if (!Array.isArray(data[key])) problems.push(`${rel}: ${key} must be an array`);
  }
  if (typeof data.city_intro_override !== 'string' || !data.city_intro_override.trim()) problems.push(`${rel}: city_intro_override must be a non-empty string`);
}

if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, checked_city_files: files.length }, null, 2));
