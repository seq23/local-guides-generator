/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { getPackSiteConfig } = require('../lib/pack_site_config');

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(msg) {
  console.error('HOMEPAGE ENTITY CONTRACT FAIL\n' + msg);
  process.exit(1);
}

function run(ctx) {
  const root = path.join(__dirname, '..', '..');
  const site = (ctx && ctx.site) || {};
  const pack = getPackSiteConfig(site.pageSetFile || '') || {};
  const brand = String(site.brandName || pack.brandName || '').trim();
  const siteUrl = String(site.siteUrl || pack.siteUrl || '').replace(/\/$/, '') + '/';
  const file = path.join(root, 'dist', 'index.html');
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  const bad = [];

  if (brand) {
    const h1Re = new RegExp('<h1[^>]*>\\s*' + escapeRegExp(brand) + '\\s*<\\/h1>', 'i');
    if (!h1Re.test(html)) bad.push('missing exact brand H1');
    const mentions = html.match(new RegExp(escapeRegExp(brand), 'g')) || [];
    if (mentions.length < 4) bad.push('brand appears too few times on homepage');
    if (!html.includes('"@type": "Organization"')) bad.push('missing Organization schema');
    if (!html.includes('"name": "' + brand + '"')) bad.push('Organization schema missing exact brand name');
    if (!html.includes('View Next Steps at ' + brand)) bad.push('missing branded next-steps link');
  }
  if (siteUrl && !html.includes('"url": "' + siteUrl + '"')) bad.push('Organization schema missing exact site url');

  if (bad.length) fail(bad.join('\n'));
  console.log('✅ homepage entity contract pass');
}

module.exports = { run };
