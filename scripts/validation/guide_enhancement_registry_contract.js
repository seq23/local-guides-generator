#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const contractsDir = path.join(repoRoot, 'data', 'contracts');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

const registry = readJson(path.join(contractsDir, 'guide_enhancement_registry.json'));
const contract = readJson(path.join(contractsDir, 'guide_answer_shape_contract.json'));
const requiredFields = ['heading', 'best', 'key', 'mistake', 'good', 'ask'];
const problems = [];
if (!registry || typeof registry !== 'object' || Array.isArray(registry)) problems.push('guide_enhancement_registry must be an object keyed by route');
const routes = new Set();
for (const route of Object.keys(registry || {})) {
  routes.add(route);
  if (!/^\/guides\/.+\/$/.test(route)) problems.push(`registry route must be normalized guide route with trailing slash: ${route}`);
  const entry = registry[route];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    problems.push(`registry entry must be an object for ${route}`);
    continue;
  }
  for (const field of requiredFields) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) problems.push(`registry entry ${route} missing non-empty string field ${field}`);
  }
}
for (const entry of contract.entries || []) {
  if (!routes.has(entry.route)) problems.push(`guide contract route missing enhancement registry entry: ${entry.route}`);
}
if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, registry_routes: routes.size }, null, 2));
