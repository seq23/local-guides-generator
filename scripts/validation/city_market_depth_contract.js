#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const cityDir = path.join(repoRoot, 'data', 'city_content');
const contractsDir = path.join(repoRoot, 'data', 'contracts');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

const phase4 = readJson(path.join(contractsDir, 'phase4_named_city_priority_set.json'));
const phase45 = readJson(path.join(contractsDir, 'phase45_multi_vertical_city_priority_set.json'));

const prioritySets = [];
if (phase4 && phase4.vertical && Array.isArray(phase4.priority_city_slugs)) {
  prioritySets.push({
    vertical_priority_sets: { [phase4.vertical]: phase4.priority_city_slugs },
    required_nonempty_fields: phase4.required_nonempty_fields || []
  });
}
if (phase45 && phase45.vertical_priority_sets) prioritySets.push(phase45);

const requiredKeys = [
  'market_specific_notes','local_vetting_points','typical_cost_ranges','payment_options','wait_time_notes','availability_notes','named_resources_or_providers'
];
const problems = [];
let checked = 0;
for (const set of prioritySets) {
  const requiredFieldSet = Array.from(new Set([...(set.required_nonempty_fields || []), ...requiredKeys]));
  for (const [vertical, slugs] of Object.entries(set.vertical_priority_sets || {})) {
    for (const slug of slugs) {
      const fp = path.join(cityDir, vertical, `${slug}.json`);
      if (!fs.existsSync(fp)) {
        problems.push(`missing priority city content file: data/city_content/${vertical}/${slug}.json`);
        continue;
      }
      checked += 1;
      const data = readJson(fp);
      for (const key of requiredFieldSet) {
        const arr = data[key];
        if (!Array.isArray(arr) || arr.length < 1) problems.push(`${path.relative(repoRoot, fp)}: ${key} must be non-empty for priority-city market depth`);
      }
      const blockItems = (((data || {}).primary_city_decision_block || {}).items || []);
      if (!Array.isArray(blockItems) || blockItems.length < 3) problems.push(`${path.relative(repoRoot, fp)}: priority city decision block must have at least 3 items`);
    }
  }
}

if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, checked_priority_city_files: checked }, null, 2));
