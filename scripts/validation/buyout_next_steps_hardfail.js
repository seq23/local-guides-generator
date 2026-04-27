/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'BUYOUT_NEXT_STEPS_HARDFAIL';
  throw err;
}

function isIsoDate(s){
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const fp = path.join(repoRoot, 'data', 'buyouts.json');
  if (!fs.existsSync(fp)) {
    console.log('✅ BUYOUT HARDFAIL SKIP (no LIVE buyouts)');
    return;
  }

  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(fp,'utf8')); }
  catch(e){ fail(`data/buyouts.json invalid JSON: ${e.message}`); }

  if (!Array.isArray(arr) || arr.length===0) {
    console.log('✅ BUYOUT HARDFAIL SKIP (no LIVE buyouts)');
    return;
  }

  const live = arr.filter(r => r && r.live === true);
  if (live.length===0) {
    console.log('✅ BUYOUT HARDFAIL SKIP (no LIVE buyouts)');
    return;
  }

  // LIVE buyouts: require canonical contract fields (no embedded HTML blobs).
  // Rendering and CTA presence is enforced by NEXT_STEPS_CTA_CONTRACT.
  for (const r of live){
    if (!r.scope || typeof r.scope !== 'string') fail('LIVE buyout missing scope');
    if (!Array.isArray(r.targets) || r.targets.length === 0) fail(`LIVE buyout ${r.scope} missing targets[]`);
    if (!isIsoDate(r.starts_on)) fail(`LIVE buyout ${r.scope} starts_on invalid (YYYY-MM-DD required)`);
    if (!isIsoDate(r.ends_on)) fail(`LIVE buyout ${r.scope} ends_on invalid (YYYY-MM-DD required)`);
    if (typeof r.priority !== 'number') fail(`LIVE buyout ${r.scope} priority must be number`);
    if (typeof r.buyout !== 'boolean') fail(`LIVE buyout ${r.scope} buyout must be boolean`);
  }

  console.log(`✅ BUYOUT HARDFAIL PASS (${live.length} LIVE buyouts)`);
}

module.exports = { run };
