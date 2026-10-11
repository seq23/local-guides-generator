#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: reads data/contracts/site_hygiene_registry.json and proves the
 * registered site-hygiene layer is still wired - every installer runs in both
 * build paths, every registered validator sits in the hard_fail tier, every
 * committed source, brand file, home definition and the IndexNow key file
 * exists, and the Clarity map matches the registered ids. A rebuild or content
 * cycle that drops any of it fails here before it ships.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
function fail(msg) { console.error(`SITE HYGIENE REGISTRY FAIL: ${msg}`); process.exit(1); }
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const reg = JSON.parse(read('data/contracts/site_hygiene_registry.json'));
const pkg = JSON.parse(read('package.json'));
const buildCmd = `${pkg.scripts.build} && ${pkg.scripts.postbuild}`;
const allPacks = read('scripts/build_all_packs.js');
for (const step of reg.build_steps) {
  if (!fs.existsSync(path.join(ROOT, step))) fail(`${step} missing`);
  if (!buildCmd.includes(step)) fail(`npm run build no longer runs ${step}`);
  if (!allPacks.includes(`'${step}'`)) fail(`scripts/build_all_packs.js no longer runs ${step}`);
}
const tiers = JSON.parse(read('data/contracts/validator_tiering_policy.json'));
for (const [item, v] of Object.entries(reg.validators)) {
  if (!fs.existsSync(path.join(ROOT, v))) fail(`${item} validator ${v} missing`);
  if (!tiers.hard_fail.includes(v)) fail(`${item} validator ${v} is not in the hard_fail tier`);
}
for (const s of reg.sources) if (!fs.existsSync(path.join(ROOT, s))) fail(`registered source ${s} missing`);
const brand = JSON.parse(read('data/site_brand_assets.json'));
for (const host of Object.keys(reg.clarity_projects)) {
  if (!brand.hosts[host]) fail(`no brand set for ${host}`);
  for (const f of brand.files) if (!fs.existsSync(path.join(ROOT, 'brand', host, f))) fail(`brand/${host}/${f} missing`);
}
const clarity = JSON.parse(read('data/clarity_projects.json')).projects || {};
for (const [host, id] of Object.entries(reg.clarity_projects)) if (clarity[host] !== id) fail(`clarity ${host}=${clarity[host]}, registered ${id}`);
if (!fs.existsSync(path.join(ROOT, reg.indexnow_key_file))) fail(`IndexNow key file ${reg.indexnow_key_file} not committed`);
const homes = fs.readdirSync(path.join(ROOT, 'data/page_sets/examples')).filter((d) => /_global_pages$/.test(d) && !/^starter/.test(d));
for (const d of homes) {
  const p = path.join(ROOT, 'data/page_sets/examples', d, 'home.json');
  if (fs.existsSync(p) && !read(path.relative(ROOT, p)).includes(reg.homepage_definition_marker.replace(/"/g, '\\"'))) fail(`${d}/home.json lost its definition paragraph`);
}
console.log(`SITE HYGIENE REGISTRY CONTRACT PASS (${reg.build_steps.length} steps, ${Object.keys(reg.validators).length} validators, ${homes.length} homes)`);
