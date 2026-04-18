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
  const cities = (data && data.cities) || {};
  const states = (data && data.state_buyouts) || {};
  const seen = new Set(Object.keys(cities).map((s)=>String(s).toLowerCase()));
  for (const [stateKey, rec] of Object.entries(states)) {
    const included = Array.isArray(rec.cities_included) ? rec.cities_included : [];
    const extra = Array.isArray(rec.extra_cities) ? rec.extra_cities : [];
    if (included.length > 10) fail(`${stateKey} includes ${included.length} base cities; max is 10`);
    for (const city of included) {
      if (extra.includes(city)) fail(`${stateKey} duplicates ${city} in both base and extra cities`);
    }
    if (extra.length > 0 && String(rec.extra_city_pricing || '') !== 'contract_required') fail(`${stateKey} extra cities require extra_city_pricing=contract_required`);
    for (const city of included.concat(extra)) {
      const slug = String(city).toLowerCase();
      const stateSuffix = '-' + String(stateKey).toLowerCase();
      if (!slug.endsWith(stateSuffix)) fail(`${city} does not belong to state ${stateKey}`);
      if (seen.has(slug)) fail(`${city} is already reserved by a city sponsor and cannot be silently included in state buyout ${stateKey}`);
    }
  }
  const vertical = (data && data.vertical_buyouts) || {};
  for (const [vk, rec] of Object.entries(vertical)) {
    if (rec && rec.cta_buyout === true && !String(rec.sponsor_slug || '').trim()) fail(`vertical buyout ${vk} enables CTA buyout but missing sponsor_slug`);
    if (rec && rec.cta_buyout === true && !String(rec.lead_target || '').trim()) fail(`vertical buyout ${vk} enables CTA buyout but missing lead_target`);
  }
  console.log('✅ SPONSORSHIP CONFLICT PASS');
}
module.exports = { run };
