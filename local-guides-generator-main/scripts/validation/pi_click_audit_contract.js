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
  ['states/TN/index.html', 'states/TX/index.html', 'states/MA/index.html'].forEach((rel) => {
    const html = read(rel);
    if (!html) { bad.push(`missing ${rel}`); return; }
    if (!html.includes('Directory Listings (Firms listed for')) bad.push(`${rel}: missing renamed directory title`);
    if (!html.includes('Cities we cover in')) bad.push(`${rel}: missing cities-we-cover block`);
    if (html.includes('data-sponsored-empty="true"')) bad.push(`${rel}: still renders empty ad placeholders`);
  });
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ PI click audit contract pass');
}
module.exports = { run };
if (require.main === module) run();
