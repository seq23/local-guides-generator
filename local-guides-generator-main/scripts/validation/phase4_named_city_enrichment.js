const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const contractPath = path.join(repoRoot, 'data', 'contracts', 'phase4_named_city_priority_set.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(contractPath)) fail('missing phase4 contract file');
const contract = readJson(contractPath);
const vertical = String(contract.vertical || '').trim();
const slugs = Array.isArray(contract.priority_city_slugs) ? contract.priority_city_slugs : [];
const required = Array.isArray(contract.required_nonempty_fields) ? contract.required_nonempty_fields : [];
if (!vertical) fail('contract.vertical missing');
if (!slugs.length) fail('no priority_city_slugs configured');
if (!required.length) fail('no required_nonempty_fields configured');

for (const slug of slugs) {
  const fp = path.join(repoRoot, 'data', 'city_content', vertical, `${slug}.json`);
  if (!fs.existsSync(fp)) fail(`missing priority city enrichment file: ${vertical}/${slug}.json`);
  const raw = readJson(fp);
  if (String(raw.city_slug || '') !== slug) fail(`city_slug mismatch in ${vertical}/${slug}.json`);
  if (String(raw.vertical || '') !== vertical) fail(`vertical mismatch in ${vertical}/${slug}.json`);
  const decision = raw.primary_city_decision_block || {};
  if (!Array.isArray(decision.items) || !decision.items.length) fail(`missing primary decision block items in ${vertical}/${slug}.json`);
  for (const field of required) {
    const val = raw[field];
    if (!Array.isArray(val) || !val.length || !val.some((x) => String(x || '').trim())) {
      fail(`required non-empty array missing for ${field} in ${vertical}/${slug}.json`);
    }
  }
}

console.log(JSON.stringify({ ok: true, vertical, priority_city_count: slugs.length }, null, 2));
