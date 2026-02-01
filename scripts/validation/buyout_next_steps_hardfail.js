/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'BUYOUT_NEXT_STEPS_HARDFAIL';
  throw err;
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

  // LIVE buyouts: require nextStepsHtml to exist and have at least one explicit inquiry CTA.
  // This keeps scope tight: we only hard-fail when LIVE.
  for (const r of live){
    if (!r.nextStepsHtml || typeof r.nextStepsHtml !== 'string') {
      fail(`LIVE buyout ${r.scope}:${r.slug} missing nextStepsHtml`);
    }
    if (!/mailto:/i.test(r.nextStepsHtml) && !/\/for-providers\//i.test(r.nextStepsHtml)) {
      fail(`LIVE buyout ${r.scope}:${r.slug} nextStepsHtml missing inquiry CTA (mailto or /for-providers/)`);
    }
  }

  console.log(`✅ BUYOUT HARDFAIL PASS (${live.length} LIVE buyouts)`);
}

module.exports = { run };
