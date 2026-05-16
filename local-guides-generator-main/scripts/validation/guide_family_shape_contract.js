#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contractsDir = path.join(repoRoot, 'data', 'contracts');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

const qmap = readJson(path.join(contractsDir, 'query_family_module_map.json'));
const contract = readJson(path.join(contractsDir, 'guide_answer_shape_contract.json'));
const problems = [];

const allowedModuleTypes = new Set(contract.allowed_top_module_types || []);
for (const [family, moduleType] of Object.entries(qmap)) {
  if (family.startsWith('$')) continue;
  if (!allowedModuleTypes.has(moduleType)) problems.push(`query family ${family} maps to invalid module type ${moduleType}`);
}
const familyUsage = new Map();
for (const entry of contract.entries || []) {
  const family = entry.primary_query_family;
  if (!familyUsage.has(family)) familyUsage.set(family, new Set());
  familyUsage.get(family).add(entry.top_module_type);
}
for (const [family, types] of familyUsage.entries()) {
  if (types.size > 1) problems.push(`query family ${family} uses multiple top module types: ${Array.from(types).join(', ')}`);
  if (!qmap[family]) problems.push(`query family ${family} used in guide contract but missing from query_family_module_map`);
}
if (problems.length) fail(problems.join('\n'));
const mappedCount = Object.keys(qmap).filter((k) => !k.startsWith('$')).length;
console.log(JSON.stringify({ ok: true, mapped_families: mappedCount, used_families: familyUsage.size }, null, 2));
