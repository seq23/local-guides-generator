#!/usr/bin/env node
'use strict';
/**
 * A promoted city must have a research file.
 *
 * This is the invariant that broke main on 2026-08-27. apply_robots_policy sets any
 * city page with no data/city_content/<vertical>/<slug>.json to noindex, because it
 * was rendered from the slug template rather than from research. The coverage
 * contract separately requires every promoted city to appear in the sitemap. When 42
 * uscis_medical cities were promoted without research files, those two rules could
 * not both be satisfied: ordering the policy before sitemap_emit failed coverage,
 * ordering it after failed sitemap parity. The wiring was correct both times. The
 * content was the conflict.
 *
 * Those 42 were researched, and today the invariant holds at 168/168. This contract
 * exists so it cannot silently stop holding. The failure it prevents is not a broken
 * page -- it is a promoted city quietly shipping a template, or a build that cannot
 * be made to pass at all.
 *
 * Dentistry is the live example of why this matters and is deliberately NOT solved
 * by researching it: its own research records insufficient_data, and the vertical
 * has no promoted cities, so its coverage contract skips and the 52 template pages
 * are correctly noindexed. Promote one without a research file and the same
 * unsatisfiable conflict reappears. This contract makes that state unreachable
 * instead of waiting for someone to hit it.
 *
 * The dentistry decision itself is recorded in data/research/dentistry/vertical_status.json,
 * next to the data rather than only in this comment. Read it before promoting a
 * dentistry city: it records which query classes were measured open and which
 * closed, and it notes that promotion here is not a CSV edit - coverage_plan_contract.js
 * hard-codes the three valid verticals, so promoting dentistry would mean editing a
 * validator, which is not a thing to do to make a coverage number move.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PROMOTED = path.join(ROOT, 'data/research/coverage/coverage_promoted.csv');
const EVIDENCE = path.join(ROOT, 'artifacts/validation/promoted-city-research.json');

function parseCsv(text) {
  // coverage_promoted.csv ships with CRLF endings. Splitting on \n alone leaves a
  // trailing \r on the last HEADER cell, so the key became "publish_enabled\r" and
  // every lookup returned undefined -- the contract passed while measuring nothing.
  const [head, ...rows] = text.replace(/\r\n/g, '\n').trim().split('\n');
  const cols = head.split(',');
  return rows.filter(Boolean).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] || '').trim()]));
  });
}

if (!fs.existsSync(PROMOTED)) {
  console.error(`PROMOTED CITY RESEARCH FAIL: ${path.relative(ROOT, PROMOTED)} is missing.`);
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(PROMOTED, 'utf8'));
const promoted = rows.filter((r) => r.publish_enabled === 'true');
const offenders = [];
const byVertical = {};

for (const r of promoted) {
  byVertical[r.vertical] = (byVertical[r.vertical] || 0) + 1;
  const rel = `data/city_content/${r.vertical}/${r.city_slug}.json`;
  if (!fs.existsSync(path.join(ROOT, rel))) offenders.push({ vertical: r.vertical, city: r.city_slug, expected: rel });
}

const evidence = {
  schema_version: '1.0',
  promoted_cities: promoted.length,
  by_vertical: byVertical,
  missing_research_files: offenders.length,
  offenders: offenders.slice(0, 50),
};
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');

if (offenders.length) {
  console.error(`PROMOTED CITY RESEARCH FAIL: ${offenders.length} promoted city/cities have no research file.`);
  for (const o of offenders.slice(0, 12)) console.error(`  ${o.vertical}/${o.city} -> expected ${o.expected}`);
  console.error('');
  console.error('  A promoted city with no research file renders from the slug template, so');
  console.error('  apply_robots_policy noindexes it while the coverage contract still requires');
  console.error('  it in the sitemap. Those cannot both hold -- this is what broke main.');
  console.error('  Fix by writing the research file, or by setting publish_enabled=false in');
  console.error('  data/research/coverage/coverage_promoted.csv. Do not relax either contract.');
  process.exit(1);
}

const summary = Object.entries(byVertical).map(([v, n]) => `${v}=${n}`).join(' ');
console.log(`PROMOTED CITY RESEARCH PASS: ${promoted.length} promoted city/cities, all backed by a research file (${summary}).`);
