/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const site = require(path.join(__dirname, '..', '..', 'data', 'site.json'));

function fail(msg) {
  console.error('PI CLICK AUDIT CONTRACT FAIL\n' + msg);
  process.exit(1);
}

function read(rel) {
  const fp = path.join(process.cwd(), 'dist', rel);
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, 'utf8');
}

function run() {
  const pageSetFile = String((site && site.pageSetFile) || '').toLowerCase();
  if (!pageSetFile.includes('/pi_v1.json')) {
    console.log('ℹ️ PI click audit contract skip (non-PI pack)');
    return;
  }
  const bad = [];
  const homepage = read('index.html');
  if (!homepage) bad.push('missing dist/index.html');
  if (homepage) {
    if (/city-by-city/i.test(homepage)) bad.push('homepage still contains city-by-city language');
    if (/state or city page/i.test(homepage)) bad.push('homepage still contains state-or-city language');
    if ((homepage.match(/href="\/(memphis-tn|nashville-tn|boston-ma)\/"/gi) || []).length) bad.push('homepage still contains direct PI city links');
  }
  ['states/TN/index.html', 'states/TX/index.html', 'states/MA/index.html'].forEach((rel) => {
    const html = read(rel);
    if (!html) { bad.push(`missing ${rel}`); return; }
    const dirIdx = html.indexOf('data-pi-state-directory="true"');
    const disciplineIdx = html.indexOf('data-disciplinary-lookup="true"');
    if (dirIdx === -1) bad.push(`${rel}: missing PI state directory block`);
    if (disciplineIdx === -1) bad.push(`${rel}: missing discipline lookup block`);
    if (dirIdx !== -1 && disciplineIdx !== -1 && dirIdx > disciplineIdx) bad.push(`${rel}: PI state directory appears after discipline lookup`);
    if (/Cities we cover in/i.test(html)) bad.push(`${rel}: stale cities-we-cover copy present`);
    if (/Request your city/i.test(html)) bad.push(`${rel}: stale request-city CTA present`);
    const directCity = html.match(/href="\/(memphis-tn|nashville-tn|boston-ma)\/"/gi) || [];
    if (directCity.length) bad.push(`${rel}: direct city links still present`);
  });
  ['memphis-tn/index.html', 'nashville-tn/index.html', 'boston-ma/index.html'].forEach((rel) => {
    if (fs.existsSync(path.join(process.cwd(), 'dist', rel))) bad.push(`${rel}: PI city page still emitted in dist`);
  });
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ PI click audit contract pass');
}

module.exports = { run };
if (require.main === module) run();
