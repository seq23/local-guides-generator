#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const failures = [];
function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
const defaults = readJson(path.join(root, 'data/pi_state_attorney_selection_defaults.json'));
const overrides = readJson(path.join(root, 'data/pi_city_attorney_selection_overrides.json'));
const cityDir = path.join(root, 'data/city_content/pi');
const files = fs.readdirSync(cityDir).filter(f => f.endsWith('.json')).sort();
for (const file of files) {
  const data = readJson(path.join(cityDir, file));
  const ab = String(data.state_abbr || '').toUpperCase();
  const state = defaults.states && defaults.states[ab];
  if (!state) failures.push(`${file}: missing state default for ${ab}`);
  else {
    for (const field of ['attorney_verification_note','contingency_fee_review_note','deadline_caveat','legal_advice_caveat','source_status','confidence']) {
      if (!String(state[field] || '').trim()) failures.push(`${file}: state ${ab} missing ${field}`);
    }
    if (!Array.isArray(state.sources)) failures.push(`${file}: state ${ab} sources must be an array`);
  }
  const ov = overrides.cities && overrides.cities[data.city_slug];
  if (!ov) failures.push(`${file}: missing city override`);
  else if (!String(ov.override_reason || '').trim()) failures.push(`${file}: city override missing override_reason`);
}
const acceptance = {
  'chicago-il.json': ['Illinois', 'contingency', 'fee', 'case expenses'],
  'atlanta-ga.json': ['Georgia', 'neutral starting list', 'not as a ranking'],
  'houston-tx.json': ['Texas', 'case type specialization', 'contingency', 'trial readiness', 'reviews']
};
for (const [file, terms] of Object.entries(acceptance)) {
  const txt = fs.readFileSync(path.join(cityDir, file), 'utf8').toLowerCase();
  for (const term of terms) if (!txt.includes(term.toLowerCase())) failures.push(`${file}: PDF acceptance case missing ${term}`);
}
if (failures.length) { console.error('PI city research integrity contract FAIL'); failures.forEach(f => console.error('- '+f)); process.exit(1); }
console.log(`PI city research integrity contract PASS: ${files.length} PI city files checked against state defaults and city overrides`);
