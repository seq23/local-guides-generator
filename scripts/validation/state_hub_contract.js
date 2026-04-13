/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name === 'index.html') acc.push(full);
  }
}

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
  const files = [];
  walk(statesDir, files);
  const bad = [];
  files.forEach((fp) => {
    const rel = path.relative(path.join(process.cwd(), 'dist'), fp).replace(/\\/g, '/');
    if (/\/next-steps\/index\.html$/i.test(rel)) return;
    const html = fs.readFileSync(fp, 'utf8');
    const idxBest = html.indexOf('data-pi-best-lawyer-answer="true"');
    const idxChoose = html.indexOf('data-pi-how-to-choose="true"');
    const idxDir = html.indexOf('data-pi-state-directory="true"');
    const idxDisc = html.indexOf('data-disciplinary-lookup="true"');
    if (idxBest === -1) bad.push(rel + ': missing PI best-lawyer block');
    if (!html.includes('depends on your case')) bad.push(rel + ': missing sponsor-safe best-lawyer framing');
    if (!html.includes('does not rank firms')) bad.push(rel + ': missing no-ranking statement');
    if (idxChoose === -1) bad.push(rel + ': missing how-to-choose block');
    if (!html.includes('data-pi-comparison-table="true"')) bad.push(rel + ': missing PI comparison table');
    if (idxDir === -1) bad.push(rel + ': missing PI state directory block');
    if (idxDisc === -1) bad.push(rel + ': missing discipline lookup block');
    if (idxBest !== -1 && idxChoose !== -1 && idxChoose < idxBest) bad.push(rel + ': how-to-choose block appears before best-lawyer block');
    if (idxChoose !== -1 && idxDir !== -1 && idxDir < idxChoose) bad.push(rel + ': directory appears before how-to-choose block');
    if (idxDir !== -1 && idxDisc !== -1 && idxDisc < idxDir) bad.push(rel + ': discipline lookup appears before state directory');
    const forbidden = [
      'Cities we cover',
      'Request your city',
      'Don’t see your city yet?',
      'city pages are intentionally retired',
      'without opening local city pages'
    ];
    forbidden.forEach((needle) => {
      if (html.includes(needle)) bad.push(rel + ': forbidden leftover copy present: ' + needle);
    });
  });
  if (bad.length) throw new Error('STATE HUB CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ state hub contract pass');
}

module.exports = { run };
