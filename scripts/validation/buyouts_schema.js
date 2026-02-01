/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'BUYOUTS_SCHEMA';
  throw err;
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const fp = path.join(repoRoot, 'data', 'buyouts.json');

  if (!fs.existsSync(fp)) {
    console.log('✅ BUYOUTS SCHEMA PASS (0 records)');
    return;
  }

  let raw;
  try { raw = JSON.parse(fs.readFileSync(fp,'utf8')); }
  catch(e){ fail(`data/buyouts.json is not valid JSON: ${e.message}`); }

  if (!Array.isArray(raw)) fail('data/buyouts.json must be an array');

  const allowed = ['city','state','vertical'];
  for (let i=0;i<raw.length;i++) {
    const r = raw[i];
    if (!r || typeof r !== 'object') fail(`buyouts[${i}] must be an object`);
    if (!allowed.includes(r.scope)) fail(`buyouts[${i}].scope must be one of: ${allowed.join(', ')}`);
    if (typeof r.slug !== 'string' || !r.slug.trim()) fail(`buyouts[${i}].slug must be a non-empty string`);
    if (typeof r.live !== 'boolean') fail(`buyouts[${i}].live must be boolean`);
  }

  console.log(`✅ BUYOUTS SCHEMA PASS (${raw.length} records)`);
}

module.exports = { run };
