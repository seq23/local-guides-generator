/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){ throw new Error('SPONSORSHIP CONFLICT FAIL: ' + msg); }

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const p = path.join(repoRoot, 'data', 'sponsorships.json');
  if (!fs.existsSync(p)) fail('data/sponsorships.json missing');
  const data = JSON.parse(fs.readFileSync(p,'utf8'));
  const base = (((data||{}).statewide_buyout)||{}).base_city_limit;
  if (base !== 10) fail('statewide_buyout.base_city_limit must equal 10');
  const policy = (((data||{}).statewide_buyout)||{}).extra_city_policy;
  if (String(policy || '') !== 'unlimited_with_explicit_declaration') fail('statewide_buyout.extra_city_policy must equal unlimited_with_explicit_declaration');
  console.log('✅ SPONSORSHIP CONFLICT PASS');
}
module.exports = { run };
