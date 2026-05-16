#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const cityDir = path.join(repoRoot, 'data', 'city_content');
const contractsDir = path.join(repoRoot, 'data', 'contracts');
const outPath = path.join(repoRoot, 'reports', 'phase5_validator_uplift_audit.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function listJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJson(fp));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(fp);
  }
  return out;
}

const guideContract = readJson(path.join(contractsDir, 'guide_answer_shape_contract.json'));
const registry = readJson(path.join(contractsDir, 'guide_enhancement_registry.json'));
const files = listJson(cityDir);
const verticalBreakdown = {};
for (const fp of files) {
  const rel = path.relative(cityDir, fp);
  const vertical = rel.split(path.sep)[0];
  verticalBreakdown[vertical] = (verticalBreakdown[vertical] || 0) + 1;
}
const report = {
  ok: true,
  generated_at: new Date().toISOString(),
  city_content_files: files.length,
  city_vertical_breakdown: verticalBreakdown,
  guide_contract_entries: (guideContract.entries || []).length,
  guide_registry_routes: Object.keys(registry || {}).length,
  validator_files: [
    'scripts/validation/city_content_schema_contract.js',
    'scripts/validation/city_content_location_contract.js',
    'scripts/validation/city_market_depth_contract.js',
    'scripts/validation/guide_answer_shape_contract.js',
    'scripts/validation/guide_family_shape_contract.js',
    'scripts/validation/guide_enhancement_registry_contract.js'
  ]
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
