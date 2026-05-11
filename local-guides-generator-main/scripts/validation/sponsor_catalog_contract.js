const fs = require('fs');
const path = require('path');
const buyouts = require('../helpers/buyouts');
const sponsorCatalog = require('../helpers/sponsor_catalog');

function fail(msg){ throw new Error('SPONSOR CATALOG FAIL: ' + msg); }

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const catalog = sponsorCatalog.loadSponsorCatalog(repoRoot);
  const records = buyouts.loadBuyouts(repoRoot).filter((r)=>r && r.live === true && r.buyout === true);
  if (records.length === 0) { console.log('✅ SPONSOR CATALOG SKIP (no live buyouts)'); return; }
  for (const rec of records){
    const slug = String(rec.sponsor_slug || '').trim().toLowerCase();
    const sponsor = catalog[slug];
    if (!sponsor) fail(`live buyout ${rec.id || slug} missing sponsor record for ${slug}`);
    if (!String(sponsor.website_url || '').trim()) fail(`${slug} missing website_url`);
    if (!String(sponsor.phone || '').trim()) fail(`${slug} missing phone`);
    if (!String(sponsor.lead_email || '').trim()) fail(`${slug} missing lead_email`);
    const assets = sponsor.assets || {};
    ['logo','top_cta_image','mid_cta_image','bottom_cta_image','directory_cta_image'].forEach((k)=>{
      const fp = String(assets[k] || '').trim();
      if (!fp) fail(`${slug} missing assets.${k}`);
      const repoFp = path.join(repoRoot, fp);
      const srcFp = path.join(repoRoot, 'data', 'sponsor_intake', 'sponsors', slug, 'assets', path.basename(fp));
      if (!fs.existsSync(repoFp) && !fs.existsSync(srcFp)) fail(`${slug} assets.${k} file missing at ${fp}`);
    });
    if (rec.directory_cta_takeover === true && rec.cta_takeover === false) fail(`${slug} enables directory_cta_takeover but disables cta_takeover`);
    if (rec.scope === 'vertical' && String(rec.verticalKey || '').trim().toLowerCase() === 'pi' && Array.isArray(rec.cities) && rec.cities.length) fail(`${slug} vertical PI buyout cannot declare city coverage`);
  }
  console.log(`✅ SPONSOR CATALOG PASS (${records.length} live buyouts)`);
}

module.exports = { run };
