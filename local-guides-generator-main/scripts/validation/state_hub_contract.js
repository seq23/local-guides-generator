/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function activePageSetIsPi() {
  try {
    const site = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'site.json'), 'utf8'));
    return /pi_v1\.json$/i.test(String(site.pageSetFile || ''));
  } catch (_) {
    return false;
  }
}

function run() {
  if (!activePageSetIsPi()) {
    console.log('ℹ️ state hub contract skip (non-PI pack)');
    return;
  }
  const statesDir = path.join(process.cwd(), 'dist', 'states');
  if (!fs.existsSync(statesDir)) throw new Error('STATE HUB CONTRACT FAIL\nmissing dist/states directory');
  const samples = ['TN', 'TX', 'MA'];
  const bad = [];
  for (const st of samples) {
    const fp = path.join(statesDir, st, 'index.html');
    if (!fs.existsSync(fp)) continue;
    const html = fs.readFileSync(fp, 'utf8');
    ['data-pi-best-lawyer-answer="true"','data-pi-how-to-choose="true"','data-pi-state-directory="true"','data-disciplinary-lookup="true"'].forEach((n) => {
      if (!html.includes(n)) bad.push(`states/${st}/index.html missing ${n}`);
    });
    if (!html.includes('Directory Listings (Firms listed for')) bad.push(`states/${st}/index.html missing directory title`);
    if (!html.includes('Cities we cover in')) bad.push(`states/${st}/index.html missing cities we cover block`);
    const idxShort = html.indexOf('data-citation-summary-type="state-home"');
    const idxCities = html.indexOf('Cities we cover in');
    if (idxShort !== -1 && idxCities !== -1 && idxCities < idxShort) bad.push(`states/${st}/index.html cities-we-cover appears before short answer`);
  }
  if (bad.length) throw new Error('STATE HUB CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ state hub contract pass');
}

module.exports = { run };
