/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const buyouts = require('../helpers/buyouts');

function count(html, re) {
  return (String(html || '').match(re) || []).length;
}

function fail(lines) {
  throw new Error('HOMEPAGE SPONSORSHIP PARITY CONTRACT FAIL\n' + lines.join('\n'));
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const env = String(process.env.LKG_ENV || 'baseline').trim().toLowerCase();
  if (env === 'training') {
    console.log('✅ HOMEPAGE SPONSORSHIP PARITY CONTRACT SKIP (training environment)');
    return;
  }

  const sitePath = path.join(repoRoot, 'data', 'site.json');
  const homePath = path.join(repoRoot, 'dist', 'index.html');
  if (!fs.existsSync(sitePath) || !fs.existsSync(homePath)) throw new Error('HOMEPAGE SPONSORSHIP PARITY CONTRACT FAIL\nsite.json or dist/index.html missing');

  const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  const html = fs.readFileSync(homePath, 'utf8');
  const verticalKey = String(site.verticalKey || '').trim() || String(site.pageSetFile || '').match(/(trt|pi|dentistry|neuro|uscis_medical)_v1\.json$/i)?.[1] || '';
  const winner = buyouts.resolveWinner(buyouts.loadBuyouts(repoRoot), { verticalKey, pageType: 'home' }, new Date());
  const primaryCount = count(html, /data-primary-conversion-cta="true"/g);
  const sponsoredTopCount = count(html, /data-sponsored-surface="top-cta"/g);
  const runtimeSponsorCount = count(html, /data-runtime-next-steps-cta="true"/g);
  const bad = [];

  if (primaryCount !== 1) bad.push(`expected exactly one homepage primary conversion CTA; found ${primaryCount}`);

  if (!winner) {
    if (sponsoredTopCount !== 0 || runtimeSponsorCount !== 0) bad.push('unsponsored homepage renders a sponsor-owned CTA surface');
    if (!/View your next steps/i.test(html) || !/View Your Next Steps/i.test(html)) bad.push('unsponsored homepage is missing the standard next-steps heading/button');
  } else {
    if (sponsoredTopCount !== 1) bad.push(`sponsored homepage must render exactly one top sponsor surface; found ${sponsoredTopCount}`);
    if (runtimeSponsorCount < 1) bad.push('sponsored homepage is missing runtime sponsor CTA marker');
    if (/data-primary-conversion-cta="true"[\s\S]{0,1200}View Your Next Steps/i.test(html)) bad.push('sponsored homepage still renders the standard primary CTA inside the sponsor-owned surface');
  }

  if (bad.length) fail(bad);
  console.log(`✅ HOMEPAGE SPONSORSHIP PARITY CONTRACT PASS (${winner ? 'sponsored' : 'unsponsored'} ${verticalKey || 'pack'})`);
}

if (require.main === module) {
  try { run({}); } catch (err) { console.error(err.message); process.exit(1); }
}

module.exports = { run };
