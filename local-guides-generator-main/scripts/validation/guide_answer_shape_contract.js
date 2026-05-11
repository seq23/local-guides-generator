#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contractsDir = path.join(repoRoot, 'data', 'contracts');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

const contract = readJson(path.join(contractsDir, 'guide_answer_shape_contract.json'));
const qmap = readJson(path.join(contractsDir, 'query_family_module_map.json'));
const problems = [];
if (!Array.isArray(contract.entries) || !contract.entries.length) problems.push('guide_answer_shape_contract entries missing');
const seen = new Set();
for (const entry of contract.entries || []) {
  const route = String(entry.route || '');
  if (!/^\/guides\/.+\/$/.test(route)) problems.push(`invalid guide route format: ${route}`);
  if (seen.has(route)) problems.push(`duplicate guide contract route: ${route}`);
  seen.add(route);
  for (const field of contract.required_fields || []) {
    if (!Object.prototype.hasOwnProperty.call(entry, field)) problems.push(`${route}: missing required field ${field}`);
  }
  if (!contract.allowed_answer_shapes.includes(entry.primary_answer_shape)) problems.push(`${route}: invalid primary_answer_shape ${entry.primary_answer_shape}`);
  if (!contract.allowed_top_module_types.includes(entry.top_module_type)) problems.push(`${route}: invalid top_module_type ${entry.top_module_type}`);
  const mapped = qmap[entry.primary_query_family];
  if (!mapped) problems.push(`${route}: unmapped primary_query_family ${entry.primary_query_family}`);
  else if (mapped !== entry.top_module_type) problems.push(`${route}: top_module_type ${entry.top_module_type} does not match mapped type ${mapped}`);
}
if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, guide_contract_entries: seen.size }, null, 2));
