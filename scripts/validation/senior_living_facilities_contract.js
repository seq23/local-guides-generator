#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the senior-living directory (data/listings/senior-living/facilities.json)
 * is the state licensure list, not a sample.
 *
 * Shelby County, TN had 31 licensed Assisted Care Living Facilities in the
 * Tennessee Health Facilities Commission bed report of July 2026, and DeSoto
 * County, MS 6 licensed Personal Care Homes in the MSDH directory of 12 Oct 2026. Every row must carry what a family needs to act on it (a phone
 * number and a ZIP) and the one fact the pages filter on (memory_care, a real
 * boolean, true exactly when the registry reports secured beds). A refresh
 * that silently dropped rows, phones or the memory-care flag fails here
 * instead of shipping a thinner directory.
 *
 * Refresh: scripts/research/pull_senior_living_facilities.py
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FILE = path.join(ROOT, 'data', 'listings', 'senior-living', 'facilities.json');
// Floors are the counts at the 13 Oct 2026 refresh (owner: the floor is the
// combined count). A licensed facility that closes is a reason to lower a floor
// deliberately in the same commit that drops its row, never a silent shrink.
const MIN_BY_STATE = { TN: 31, MS: 6 };
const MIN_FACILITIES = Object.values(MIN_BY_STATE).reduce((a, b) => a + b, 0);
// The lead backend can only send a teaser to a row with an email.
const MIN_WITH_EMAIL = 20;

const problems = [];
if (!fs.existsSync(FILE)) {
  console.error(`SENIOR LIVING FACILITIES CONTRACT FAIL: ${path.relative(ROOT, FILE)} is missing`);
  process.exit(1);
}
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rows = Array.isArray(doc.facilities) ? doc.facilities : [];

if (!doc.source || typeof doc.source !== 'object' || !/^https:\/\/www\.tn\.gov\//.test(String(doc.source.registry || ''))) {
  problems.push('source.registry must name the Tennessee Health Facilities Commission report URL');
}
if (!doc.source || !/^https:\/\/msdh\.ms\.gov\//.test(String(doc.source.ms_registry || ''))) {
  problems.push('source.ms_registry must name the Mississippi State Department of Health directory URL');
}
if (!/^\d{4}-\d{2}-\d{2}T/.test(String(doc.fetched_at || ''))) problems.push('fetched_at must be an ISO timestamp');
if (rows.length < MIN_FACILITIES) problems.push(`${rows.length} facilities; the floor is ${MIN_FACILITIES}`);
for (const [st, min] of Object.entries(MIN_BY_STATE)) {
  const n = rows.filter((f) => f && f.state === st).length;
  if (n < min) problems.push(`${n} ${st} facilities; the ${st} floor is ${min}`);
}
const withEmail = rows.filter((f) => f && String(f.email || '').trim()).length;
if (withEmail < MIN_WITH_EMAIL) problems.push(`${withEmail} facilities have an email; the floor is ${MIN_WITH_EMAIL}`);

const seen = new Set();
rows.forEach((f, i) => {
  const id = `row ${i} (${f && f.name})`;
  if (!f || typeof f !== 'object') { problems.push(`${id}: not an object`); return; }
  for (const k of ['name', 'address', 'city', 'state', 'license_type', 'license_number']) {
    if (!String(f[k] || '').trim()) problems.push(`${id}: missing ${k}`);
  }
  if (!/^\d{3}-\d{3}-\d{4}$/.test(String(f.phone || ''))) problems.push(`${id}: phone "${f.phone}" is not NNN-NNN-NNNN`);
  if (!/^\d{5}$/.test(String(f.zip || ''))) problems.push(`${id}: zip "${f.zip}" is not 5 digits`);
  if (typeof f.memory_care !== 'boolean') problems.push(`${id}: memory_care must be a boolean`);
  else if (typeof f.secured_beds === 'number' && f.memory_care !== (f.secured_beds > 0)) problems.push(`${id}: memory_care disagrees with secured_beds ${f.secured_beds}`);
  if (f.website && !/^https?:\/\//.test(String(f.website))) problems.push(`${id}: website must be an http(s) URL or empty`);
  if (f.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(f.email))) problems.push(`${id}: email "${f.email}" is malformed`);
  if (typeof f.lat !== 'number' || typeof f.lng !== 'number') problems.push(`${id}: lat/lng must be numbers`);
  if (!['TN', 'MS'].includes(f.state)) problems.push(`${id}: state "${f.state}" is not TN or MS`);
  if (!['state_license', 'registry_key'].includes(f.license_number_kind)) problems.push(`${id}: license_number_kind must be state_license or registry_key`);
  if (f.email && !String(f.email_source || '').trim()) problems.push(`${id}: email has no email_source`);
  if (f.contact_form_url && !/^https?:\/\//.test(String(f.contact_form_url))) problems.push(`${id}: contact_form_url must be an http(s) URL`);
  if (seen.has(f.license_number)) problems.push(`${id}: duplicate license_number ${f.license_number}`);
  seen.add(f.license_number);
});

if (problems.length) {
  console.error('SENIOR LIVING FACILITIES CONTRACT FAIL');
  problems.slice(0, 40).forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
const mc = rows.filter((f) => f.memory_care).length;
const by = Object.keys(MIN_BY_STATE).map((st) => `${st} ${rows.filter((f) => f.state === st).length}`).join(', ');
console.log(`✅ SENIOR LIVING FACILITIES CONTRACT PASS (${rows.length} licensed facilities [${by}], ${mc} with memory care, ${withEmail} with an email, all with phone + zip + memory_care)`);
