/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function isIsoDate(s){
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function inWindow(rec, now){
  const s = new Date(rec.starts_on);
  const e = new Date(rec.ends_on);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return now >= s && now <= e;
}

function isLiveBuyoutRecord(rec, now){
  if (!rec || typeof rec !== 'object') return false;
  if (rec.live !== true) return false;
  if (rec.buyout !== true) return false;
  if (!isIsoDate(rec.starts_on) || !isIsoDate(rec.ends_on)) return false;
  if (!inWindow(rec, now)) return false;
  return true;
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const buyoutsPath = path.join(repoRoot, 'data', 'buyouts.json');
  if (!fs.existsSync(buyoutsPath)) {
    console.log('✅ STATE BUYOUT SPONSOR REQUIREMENTS SKIP (no buyouts.json)');
    return;
  }

  let arr = [];
  try { arr = JSON.parse(fs.readFileSync(buyoutsPath, 'utf8')); }
  catch(e){ throw new Error(`STATE BUYOUT SPONSOR FAIL: invalid JSON in data/buyouts.json: ${e.message}`); }

  if (!Array.isArray(arr)) throw new Error('STATE BUYOUT SPONSOR FAIL: data/buyouts.json must be an array');

  const now = new Date();

  const liveStateBuyouts = arr.filter(r =>
    isLiveBuyoutRecord(r, now) &&
    (r.scope === 'state') &&
    Array.isArray(r.targets) && r.targets.length > 0
  );

  if (liveStateBuyouts.length === 0) {
    console.log('✅ STATE BUYOUT SPONSOR REQUIREMENTS SKIP (no LIVE state buyouts)');
    return;
  }

  for (const r of liveStateBuyouts){
    for (const t of r.targets){
      const ab = String(t).trim().toLowerCase();
      const fp = path.join(repoRoot, 'data', 'state_sponsors', `${ab}.json`);
      if (!fs.existsSync(fp)) {
        throw new Error(`STATE BUYOUT SPONSOR FAIL: LIVE state buyout for ${String(t).toUpperCase()} requires ${path.relative(repoRoot, fp)} (missing)`);
      }
      let s = {};
      try { s = JSON.parse(fs.readFileSync(fp,'utf8')); }
      catch(e){ throw new Error(`STATE BUYOUT SPONSOR FAIL: invalid JSON in ${path.relative(repoRoot, fp)}: ${e.message}`); }

      const isLive = (x) => {
        if (!x) return false;
        if (typeof x.is_live === 'boolean') return x.is_live;
        if (typeof x.live === 'boolean') return x.live;
        if (typeof x.status === 'string') return x.status.toUpperCase() === 'LIVE';
        return false;
      };

      if (!isLive(s)) {
        throw new Error(`STATE BUYOUT SPONSOR FAIL: ${path.relative(repoRoot, fp)} must be LIVE (is_live:true) when a state buyout is LIVE`);
      }

      const firm = String(s.firm_name || s.name || '').trim();
      if (!firm) throw new Error(`STATE BUYOUT SPONSOR FAIL: ${path.relative(repoRoot, fp)} missing firm_name`);

      const intake = String(s.intake_url || '').trim();
      const official = String(s.official_site_url || '').trim();
      if (!intake) throw new Error(`STATE BUYOUT SPONSOR FAIL: ${path.relative(repoRoot, fp)} missing intake_url`);
      if (!official) throw new Error(`STATE BUYOUT SPONSOR FAIL: ${path.relative(repoRoot, fp)} missing official_site_url`);
    }
  }

  console.log(`✅ STATE BUYOUT SPONSOR REQUIREMENTS PASS (${liveStateBuyouts.length} LIVE state buyouts)`);
}

module.exports = { run };
