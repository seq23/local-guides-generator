/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'FOR_PROVIDERS_CONTRACT';
  throw err;
}

function count(h, s){ return (String(h).match(new RegExp(s,'g')) || []).length; }

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const srcFp = path.join(repoRoot, 'data', 'global_pages', 'for-providers.json');
  const distFp = path.join(repoRoot, 'dist', 'for-providers', 'index.html');
  const adFp = path.join(repoRoot, 'data', 'ad_placements.json');
  const sponsorFp = path.join(repoRoot, 'data', 'sponsors', 'global.json');

  const src = JSON.parse(fs.readFileSync(srcFp, 'utf8'));
  const srcHtml = String(src.main_html || '');
  if (/%%AD:for_providers_(top|mid|bottom)%%/.test(srcHtml)) fail('for-providers source must not contain for_providers ad tokens. This page is documentation only.');
  if (!srcHtml.includes('data-sales-page-contract="true"')) fail('for-providers source missing sales-page contract notice.');
  if (count(srcHtml, '<h1>Advertising &amp; Provider Info</h1>') !== 1) fail('for-providers source must contain exactly one H1.');
  if (count(srcHtml, '<h2>Start a sponsorship inquiry</h2>') !== 1) fail('for-providers source must contain exactly one sponsorship inquiry section.');

  const ad = JSON.parse(fs.readFileSync(adFp, 'utf8'));
  for (const k of ['for_providers_top','for_providers_mid','for_providers_bottom']) {
    if (Object.prototype.hasOwnProperty.call(ad, k)) fail(`ad_placements.json must not define ${k}; /for-providers/ is not an ad surface.`);
  }
  const sponsors = JSON.parse(fs.readFileSync(sponsorFp, 'utf8'));
  for (const k of ['for_providers_top','for_providers_mid','for_providers_bottom']) {
    if (Object.prototype.hasOwnProperty.call(sponsors, k)) fail(`data/sponsors/global.json must not define ${k}; /for-providers/ is not an ad surface.`);
  }

  if (fs.existsSync(distFp)) {
    const html = fs.readFileSync(distFp, 'utf8');
    if ((html.match(/id=["']canonical-ad-inventory-v1["']/g) || []).length !== 1) fail('dist/for-providers/index.html must contain exactly one canonical inventory JSON block.');
    if (/data-sponsored-placement="(top|mid|bottom)"/.test(html)) fail('dist/for-providers/index.html must not render live sponsor placement blocks.');
    if ((html.match(/<h2>Start a sponsorship inquiry<\/h2>/g) || []).length !== 1) fail('dist/for-providers/index.html must contain exactly one sponsorship inquiry heading.');
    if (!html.includes('data-sales-page-contract="true"')) fail('dist/for-providers/index.html missing sales-page contract notice.');
  }

  console.log('✅ FOR-PROVIDERS CONTRACT PASS (sales page matches ad inventory model; no duplicate blocks)');
}

module.exports = { run };
