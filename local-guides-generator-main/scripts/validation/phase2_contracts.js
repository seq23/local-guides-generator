const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const cityDir = path.join(root, 'data', 'city_content');
const contractsDir = path.join(root, 'data', 'contracts');

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(fp));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(fp);
  }
  return out;
}

const base = readJson(path.join(contractsDir, 'city_schema_base.json'));
const verticals = readJson(path.join(contractsDir, 'city_schema_vertical_extensions.json'));
const guideContract = readJson(path.join(contractsDir, 'guide_answer_shape_contract.json'));
const qmap = readJson(path.join(contractsDir, 'query_family_module_map.json'));

for (const file of ['city_schema_base.json','city_schema_vertical_extensions.json','guide_answer_shape_contract.json','query_family_module_map.json']) {
  if (!fs.existsSync(path.join(contractsDir, file))) fail(`missing contract file ${file}`);
}

const problems = [];
for (const fp of walkJson(cityDir)) {
  const rel = path.relative(root, fp);
  const raw = readJson(fp);
  const hasLegacy = raw.citation_velocity_insert || raw.heading || raw.bullets;
  const hasStructured = base.required.every((k) => Object.prototype.hasOwnProperty.call(raw, k));
  if (!hasLegacy && !hasStructured) {
    problems.push(`${rel}: neither legacy nor structured city schema detected`);
  }
  if (hasStructured) {
    const type = (((raw || {}).primary_city_decision_block || {}).type || '').trim();
    if (type && !base.decision_block_types.includes(type)) {
      problems.push(`${rel}: invalid primary_city_decision_block.type ${type}`);
    }
    const vk = String(raw.vertical || '').trim();
    if (vk && verticals[vk] && !Array.isArray(verticals[vk])) {
      problems.push(`${rel}: vertical extension registry malformed for ${vk}`);
    }
  }
}

if (!Array.isArray(guideContract.entries) || !guideContract.entries.length) {
  problems.push('guide_answer_shape_contract.json: entries missing');
} else {
  for (const entry of guideContract.entries) {
    for (const key of guideContract.required_fields || []) {
      if (!Object.prototype.hasOwnProperty.call(entry, key)) problems.push(`guide contract entry missing ${key} for route ${entry.route || 'unknown'}`);
    }
    if (!guideContract.allowed_answer_shapes.includes(entry.primary_answer_shape)) {
      problems.push(`guide contract ${entry.route}: invalid primary_answer_shape ${entry.primary_answer_shape}`);
    }
    if (!guideContract.allowed_top_module_types.includes(entry.top_module_type)) {
      problems.push(`guide contract ${entry.route}: invalid top_module_type ${entry.top_module_type}`);
    }
    const mapped = qmap[entry.primary_query_family];
    if (mapped && mapped !== entry.top_module_type) {
      problems.push(`guide contract ${entry.route}: top module ${entry.top_module_type} does not match query map ${mapped}`);
    }
  }
}

if (problems.length) fail(problems.join('\n'));
console.log('OK: phase2 contracts valid');
