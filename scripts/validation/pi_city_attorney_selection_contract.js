#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const cityDir = path.join(root, 'data', 'city_content', 'pi');
const failures = [];
function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
const files = fs.readdirSync(cityDir).filter(f => f.endsWith('.json')).sort();
if (!files.length) failures.push('no PI city content files found');
const requiredFields = ['title','case_type_specialization','contingency_terms','trial_readiness','reviews_and_reputation','attorney_verification','deadline_caveat','directory_use_note','educational_boundary','source_status','confidence'];
const requiredTerms = ['case type', 'contingency', 'trial', 'reviews', 'neutral starting', 'not a ranking'];
for (const file of files) {
  const rel = `data/city_content/pi/${file}`;
  const data = readJson(path.join(cityDir, file));
  const fw = data.attorney_selection_framework || {};
  if (fw.version !== 'PI_ATTORNEY_SELECTION_FRAMEWORK_V1') failures.push(`${rel}: missing PI_ATTORNEY_SELECTION_FRAMEWORK_V1`);
  for (const field of requiredFields) if (!String(fw[field] || '').trim() && !Array.isArray(fw[field])) failures.push(`${rel}: missing attorney_selection_framework.${field}`);
  const combined = JSON.stringify(data).toLowerCase();
  const city = String(data.city || '').toLowerCase();
  const state = String(data.state || '').toLowerCase();
  if (city && !combined.includes(city)) failures.push(`${rel}: framework does not include city name ${data.city}`);
  if (state && !combined.includes(state)) failures.push(`${rel}: framework does not include state name ${data.state}`);
  for (const term of requiredTerms) if (!combined.includes(term)) failures.push(`${rel}: missing required framework term: ${term}`);
  if (/\[(city|state)\]|\{(city|state)\}/i.test(combined)) failures.push(`${rel}: unresolved city/state placeholder`);
}
if (failures.length) { console.error('PI city attorney-selection contract FAIL'); failures.forEach(f => console.error('- '+f)); process.exit(1); }
console.log(`PI city attorney-selection contract PASS: ${files.length} PI city files checked`);
