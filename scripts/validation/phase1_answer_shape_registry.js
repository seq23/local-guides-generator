const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const registryFile = path.join(root, 'data', 'contracts', 'guide_enhancement_registry.json');
const contractFile = path.join(root, 'data', 'contracts', 'guide_answer_shape_contract.json');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

if (!fs.existsSync(registryFile)) fail('missing data/contracts/guide_enhancement_registry.json');
if (!fs.existsSync(contractFile)) fail('missing data/contracts/guide_answer_shape_contract.json');

const registry = readJson(registryFile);
const contract = readJson(contractFile);

if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
  fail('guide enhancement registry must be an object keyed by route');
}

const problems = [];
const requiredFields = ['heading', 'best', 'key', 'mistake', 'good', 'ask'];
const routes = Object.keys(registry);
for (const route of routes) {
  if (!/^\/guides\/.+\/$/.test(route)) {
    problems.push(`registry route must be normalized guide route with trailing slash: ${route}`);
    continue;
  }
  const entry = registry[route];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    problems.push(`registry entry must be an object for ${route}`);
    continue;
  }
  for (const field of requiredFields) {
    const value = entry[field];
    if (typeof value !== 'string' || !value.trim()) {
      problems.push(`registry entry ${route} missing non-empty string field ${field}`);
    }
  }
}

const contractRoutes = new Set((contract.entries || []).map((entry) => entry.route));
const registryRoutes = new Set(routes);
for (const route of contractRoutes) {
  if (!registryRoutes.has(route)) {
    problems.push(`guide contract route missing enhancement registry entry: ${route}`);
  }
}

if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, registry_routes: routes.length, contract_routes: contractRoutes.size }, null, 2));
