#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const cityDir = path.join(repoRoot, 'data', 'city_content');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

if (!fs.existsSync(cityDir)) fail('data/city_content missing');
const rootJson = fs.readdirSync(cityDir).filter((name) => name.endsWith('.json'));
if (rootJson.length) fail(`root-level city_content files not allowed: ${rootJson.join(', ')}`);

const problems = [];
let checked = 0;
for (const vertical of fs.readdirSync(cityDir)) {
  const verticalDir = path.join(cityDir, vertical);
  if (!fs.statSync(verticalDir).isDirectory()) continue;
  for (const file of fs.readdirSync(verticalDir).filter((name) => name.endsWith('.json'))) {
    const fp = path.join(verticalDir, file);
    const rel = path.relative(repoRoot, fp);
    const data = readJson(fp);
    checked += 1;
    if (String(data.vertical || '') !== vertical) problems.push(`${rel}: vertical field does not match folder name ${vertical}`);
    const expectedSlug = path.basename(file, '.json');
    if (String(data.city_slug || '') !== expectedSlug) problems.push(`${rel}: city_slug does not match filename ${expectedSlug}`);
  }
}

if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, checked_location_files: checked }, null, 2));
