#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the senior-living query fan-out is a full universe, and every
 * record lands on a page that exists.
 *
 * Source (always): data/fanout/senior_living_query_universe.json expands
 * (scripts/lib/senior_fanout.js) to >= MIN_RECORDS query records; every
 * locality and ZIP the site covers has >= MIN_PER_LOCALITY of them; every
 * record routes to a page this pack builds (a fenced city/hospital page, one
 * of its guides, /faq/ or home).
 * Build (when dist/ holds the senior-living pack): dist/_fanout_query_clusters.json
 * carries those records and every route in it exists in dist/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const MIN_RECORDS = 600;
const MIN_PER_LOCALITY = 20;
const fan = require('../lib/senior_fanout');

function check(records, universe, routeExists) {
  const out = [];
  const queries = records.filter((r) => r.pageKind === 'query');
  if (queries.length < MIN_RECORDS) out.push(`${queries.length} query records; the floor is ${MIN_RECORDS}`);
  const per = {};
  for (const r of queries) per[r.locality] = (per[r.locality] || 0) + 1;
  const localities = [...universe.localities.map((l) => l.name), ...Object.keys(universe.zips)];
  for (const l of localities) if ((per[l] || 0) < MIN_PER_LOCALITY) out.push(`locality "${l}" has ${per[l] || 0} records; the floor is ${MIN_PER_LOCALITY}`);
  const missing = new Set();
  for (const r of records) if (!routeExists(r.route)) missing.add(r.route);
  for (const m of missing) out.push(`fan-out routes to ${m}, which the build does not produce`);
  return out;
}

const problems = [];
const universe = fan.loadUniverse();
const srcRecords = fan.fanoutRecords();
const cities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_senior_living_v1.json'), 'utf8'));
const guideRoutes = fs.readdirSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'senior_living_global_pages'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'senior_living_global_pages', f), 'utf8')).route);
const sourceRoutes = new Set(['/', ...cities.map((c) => `/${c.slug}/`), ...guideRoutes]);
problems.push(...check(srcRecords, universe, (r) => sourceRoutes.has(r)));

let builtCount = 0;
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
if (/senior_living_v1\.json$/.test(String(site.pageSetFile || '')) && fs.existsSync(path.join(DIST, 'index.html'))) {
  const exportFile = path.join(DIST, '_fanout_query_clusters.json');
  if (!fs.existsSync(exportFile)) problems.push('dist/_fanout_query_clusters.json missing');
  else {
    const recs = JSON.parse(fs.readFileSync(exportFile, 'utf8')).records || [];
    builtCount = recs.length;
    const exists = (r) => fs.existsSync(path.join(DIST, String(r).replace(/^\/|\/$/g, ''), 'index.html'));
    problems.push(...check(recs, universe, exists));
  }
}

// Negative proof every run: a short universe routed to a missing page fails.
const hostile = check([{ pageKind: 'query', route: '/nowhere/', locality: 'memphis' }], universe, (r) => sourceRoutes.has(r));
if (!hostile.some((p) => p.includes('/nowhere/')) || !hostile.some((p) => p.includes('floor is 600'))) problems.push('negative proof no longer caught: thin fan-out with a dead route');

if (problems.length) {
  console.error('SENIOR LIVING FANOUT CONTRACT FAIL');
  problems.slice(0, 40).forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✅ SENIOR LIVING FANOUT CONTRACT PASS (${srcRecords.length} query records over ${universe.localities.length} localities and ${Object.keys(universe.zips).length} ZIPs${builtCount ? `; ${builtCount} records in the build, every route built` : ''})`);
