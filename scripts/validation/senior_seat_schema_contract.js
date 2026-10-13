#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: data/senior_seat.json (the exclusive lead routing switch for the
 * senior-living vertical) has exactly the documented shape, and an active seat's
 * term is at most 6 months. Off: {"active":false}. On:
 * {"active":true,"facility_id":"…","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}.
 * If the build published /_seat.json, it carries nothing beyond active (+ end).
 * Every run replays hostile fixtures, so the negative proof never goes stale.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MAX_MONTHS = 6;

function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function addMonths(s, m) {
  const d = new Date(`${s}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + m);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

function check(seat) {
  const errs = [];
  if (!seat || typeof seat !== 'object' || Array.isArray(seat)) return ['not a JSON object'];
  if (typeof seat.active !== 'boolean') errs.push('active must be true or false');
  if (seat.active === false) {
    const extra = Object.keys(seat).filter((k) => k !== 'active');
    if (extra.length) errs.push(`an inactive seat carries only {"active":false}; found ${extra.join(', ')}`);
    return errs;
  }
  const extra = Object.keys(seat).filter((k) => !['active', 'facility_id', 'start', 'end'].includes(k));
  if (extra.length) errs.push(`unknown keys: ${extra.join(', ')}`);
  if (typeof seat.facility_id !== 'string' || !seat.facility_id.trim()) errs.push('facility_id is required when active');
  if (!isDate(seat.start)) errs.push('start must be YYYY-MM-DD');
  if (!isDate(seat.end)) errs.push('end must be YYYY-MM-DD');
  if (isDate(seat.start) && isDate(seat.end)) {
    if (seat.end <= seat.start) errs.push('end must be after start');
    if (seat.end > addMonths(seat.start, MAX_MONTHS)) errs.push(`term ${seat.start}..${seat.end} is longer than ${MAX_MONTHS} months (latest end ${addMonths(seat.start, MAX_MONTHS)})`);
  }
  return errs;
}

const HOSTILE = [
  { active: true, facility_id: 'x', start: '2026-01-01', end: '2026-07-02' },
  { active: true, start: '2026-01-01', end: '2026-06-01' },
  { active: 'true', facility_id: 'x', start: '2026-01-01', end: '2026-06-01' },
  { active: true, facility_id: 'x', start: '2026-02-30', end: '2026-06-01' },
  { active: true, facility_id: 'x', start: '2026-06-01', end: '2026-05-01' },
  { active: false, facility_id: 'x' },
  { active: true, facility_id: 'x', start: '2026-01-01', end: '2026-06-01', leads_cap: 10 }
];
const GOOD = [{ active: false }, { active: true, facility_id: 'x', start: '2026-08-31', end: '2027-02-28' }, { active: true, facility_id: 'x', start: '2026-01-01', end: '2026-07-01' }];

function fail(msg) { console.error(`SENIOR SEAT SCHEMA FAIL: ${msg}`); process.exit(1); }

for (const h of HOSTILE) if (!check(h).length) fail(`negative proof no longer caught: ${JSON.stringify(h)}`);
for (const g of GOOD) if (check(g).length) fail(`valid fixture refused: ${JSON.stringify(g)}: ${check(g).join('; ')}`);

const file = path.join(ROOT, 'data/senior_seat.json');
if (!fs.existsSync(file)) fail('data/senior_seat.json missing');
let seat;
try { seat = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(`data/senior_seat.json is not JSON: ${e.message}`); }
const errs = check(seat);
if (errs.length) fail(`data/senior_seat.json: ${errs.join('; ')}`);

let published = 'not built';
for (const dir of ['dist', 'dist/senior-living', 'dist/memphisseniorcarehomes.com']) {
  const p = path.join(ROOT, dir, '_seat.json');
  if (!fs.existsSync(p)) continue;
  const pub = JSON.parse(fs.readFileSync(p, 'utf8'));
  const leak = Object.keys(pub).filter((k) => !['active', 'end'].includes(k));
  if (leak.length) fail(`${dir}/_seat.json publishes ${leak.join(', ')}; the public file carries only active and end`);
  if (pub.active !== seat.active) fail(`${dir}/_seat.json active=${pub.active} but data/senior_seat.json active=${seat.active}`);
  published = `${dir}/_seat.json ok`;
}

console.log(`SENIOR SEAT SCHEMA PASS (active=${seat.active}${seat.active ? ` ${seat.facility_id} ${seat.start}..${seat.end}` : ''}; ${HOSTILE.length} negative proofs caught; public: ${published})`);
