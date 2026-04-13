/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const site = require(path.join(__dirname, '..', '..', 'data', 'site.json'));

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name === 'index.html') acc.push(full);
  }
}

function run() {
  const pageSetFile = String((site && site.pageSetFile) || '').toLowerCase();
  if (!pageSetFile.includes('/pi_v1.json')) {
    console.log('ℹ️ state hub contract skip (non-PI pack)');
    return;
  }
  const statesDir = path.join(process.cwd(), 'dist', 'states');
  if (!fs.existsSync(statesDir)) {
    throw new Error('STATE HUB CONTRACT FAIL\nmissing dist/states directory');
  }
  const files = [];
  walk(statesDir, files);
  const bad = [];
  files.forEach((fp) => {
    const rel = path.relative(path.join(process.cwd(), 'dist'), fp).replace(/\\/g, '/');
    if (/\/next-steps\/index\.html$/i.test(rel)) return;
    const html = fs.readFileSync(fp, 'utf8');
    if (!html.includes('data-pi-state-page="true"')) return;
    if (html.includes('data-covered-cities="true"')) bad.push(rel + ': unexpected covered cities block');
    if (html.includes('data-request-city="true"')) bad.push(rel + ': unexpected request city block');
    if (/Cities we cover in/i.test(html)) bad.push(rel + ': stale cities-we-cover copy present');
    if (/Don[’']t see your city yet\?/i.test(html)) bad.push(rel + ': stale request-city copy present');
    if (/Request your city/i.test(html)) bad.push(rel + ': stale request-city CTA present');
    if (/narrow into the right city/i.test(html)) bad.push(rel + ': stale next-steps city copy present');
    if (/city-by-city routing/i.test(html)) bad.push(rel + ': stale state summary city-routing copy present');
    if (/state or city page/i.test(html)) bad.push(rel + ': stale homepage-style city-page copy present');
    const directCityLinks = html.match(/href="\/(?!states\/|guides\/|faq\/|methodology\/|next-steps\/|request-assistance\/|contact\/|disclaimer\/|editorial-policy\/|privacy\/|for-providers\/|personal-injury\/)([a-z0-9-]+)\/"/gi) || [];
    if (directCityLinks.length) bad.push(rel + ': direct city links still present on PI state page');
    const dirIdx = html.indexOf('data-pi-state-directory="true"');
    const disciplineIdx = html.indexOf('data-disciplinary-lookup="true"');
    if (dirIdx === -1) bad.push(rel + ': missing PI state directory block');
    if (disciplineIdx === -1) bad.push(rel + ': missing discipline lookup block');
    if (dirIdx !== -1 && disciplineIdx !== -1 && dirIdx > disciplineIdx) bad.push(rel + ': PI state directory appears after discipline lookup');
  });
  if (bad.length) throw new Error('STATE HUB CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ state hub contract pass');
}

module.exports = { run };
