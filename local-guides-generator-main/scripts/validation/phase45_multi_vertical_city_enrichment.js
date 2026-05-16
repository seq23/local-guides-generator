const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const contractPath = path.join(repoRoot, 'data', 'contracts', 'phase45_multi_vertical_city_priority_set.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(contractPath)) fail('missing phase4.5 contract file');
const contract = readJson(contractPath);
const sets = contract.vertical_priority_sets || {};
const required = Array.isArray(contract.required_nonempty_fields) ? contract.required_nonempty_fields : [];
const verticalRequired = contract.vertical_required_fields || {};
if (!Object.keys(sets).length) fail('no vertical priority sets configured');
if (!required.length) fail('no required non-empty fields configured');

for (const [vertical, slugs] of Object.entries(sets)) {
  if (!Array.isArray(slugs) || !slugs.length) fail(`no priority slugs configured for ${vertical}`);
  const extraFields = Array.isArray(verticalRequired[vertical]) ? verticalRequired[vertical] : [];
  if (!extraFields.length) fail(`no vertical required fields configured for ${vertical}`);
  for (const slug of slugs) {
    const fp = path.join(repoRoot, 'data', 'city_content', vertical, `${slug}.json`);
    if (!fs.existsSync(fp)) fail(`missing priority city enrichment file: ${vertical}/${slug}.json`);
    const raw = readJson(fp);
    if (String(raw.city_slug || '') !== slug) fail(`city_slug mismatch in ${vertical}/${slug}.json`);
    if (String(raw.vertical || '') !== vertical) fail(`vertical mismatch in ${vertical}/${slug}.json`);
    const decision = raw.primary_city_decision_block || {};
    if (!Array.isArray(decision.items) || !decision.items.length) fail(`missing primary decision block items in ${vertical}/${slug}.json`);
    for (const field of required.concat(extraFields)) {
      const val = raw[field];
      if (!Array.isArray(val) || !val.length || !val.some((x) => String(x || '').trim())) {
        fail(`required non-empty array missing for ${field} in ${vertical}/${slug}.json`);
      }
    }
  }
}

console.log(JSON.stringify({ ok: true, verticals: Object.keys(sets), total_files: Object.values(sets).reduce((a,b)=>a+b.length,0) }, null, 2));
