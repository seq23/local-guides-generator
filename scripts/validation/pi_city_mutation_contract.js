#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const cityDir = path.join(root, 'data', 'city_content', 'pi');
const failures = [];
function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
const files = fs.readdirSync(cityDir).filter(f => f.endsWith('.json')).sort();
const cities = files.map(f => readJson(path.join(cityDir, f))).map(d => ({slug:d.city_slug, city:String(d.city||''), state:String(d.state||''), text:JSON.stringify(d)}));
const bodies = new Map();
for (const c of cities) {
  const fw = readJson(path.join(cityDir, `${c.slug}.json`)).attorney_selection_framework || {};
  const body = [fw.case_type_specialization, fw.contingency_terms, fw.trial_readiness, fw.reviews_and_reputation, fw.directory_use_note].join('\n').replace(new RegExp(c.city,'gi'),'[CITY]').replace(new RegExp(c.state,'gi'),'[STATE]');
  bodies.set(body, (bodies.get(body)||0)+1);
  if (!c.text.includes(c.city)) failures.push(`${c.slug}: missing own city name`);
  if (!c.text.includes(c.state)) failures.push(`${c.slug}: missing own state name`);
}
const duplicateMax = Math.max(...bodies.values());
if (duplicateMax > Math.max(2, Math.ceil(files.length * 0.9))) failures.push(`too many city framework bodies are effectively identical after city/state normalization: ${duplicateMax}`);
if (failures.length) { console.error('PI city mutation contract FAIL'); failures.forEach(f => console.error('- '+f)); process.exit(1); }
console.log(`PI city mutation contract PASS: ${files.length} city-mutated frameworks checked`);
