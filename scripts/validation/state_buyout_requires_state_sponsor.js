/* eslint-disable no-console */
const path = require('path');
const buyouts = require('../helpers/buyouts');
const sponsorCatalog = require('../helpers/sponsor_catalog');

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const arr = buyouts.loadBuyouts(repoRoot);
  const liveStateBuyouts = arr.filter(r => r && r.live === true && r.buyout === true && r.scope === 'state' && Array.isArray(r.targets) && r.targets.length > 0);
  if (liveStateBuyouts.length === 0) {
    console.log('✅ STATE BUYOUT SPONSOR REQUIREMENTS SKIP (no LIVE state buyouts)');
    return;
  }
  const catalog = sponsorCatalog.loadSponsorCatalog(repoRoot);
  for (const r of liveStateBuyouts){
    const slug = String(r.sponsor_slug || '').trim().toLowerCase();
    const s = catalog[slug];
    if (!s) throw new Error(`STATE BUYOUT SPONSOR FAIL: LIVE state buyout for ${r.targets.join(',')} requires sponsor record for ${slug}`);
    if (!String(s.display_name || '').trim()) throw new Error(`STATE BUYOUT SPONSOR FAIL: ${slug} missing display_name`);
    if (!String(s.website_url || '').trim()) throw new Error(`STATE BUYOUT SPONSOR FAIL: ${slug} missing website_url`);
    if (!String(s.lead_email || '').trim()) throw new Error(`STATE BUYOUT SPONSOR FAIL: ${slug} missing lead_email`);
  }
  console.log(`✅ STATE BUYOUT SPONSOR REQUIREMENTS PASS (${liveStateBuyouts.length} LIVE state buyouts)`);
}

module.exports = { run };
