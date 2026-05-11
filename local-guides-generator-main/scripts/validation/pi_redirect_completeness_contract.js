/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const site = require(path.join(__dirname, '..', '..', 'data', 'site.json'));

function fail(msg) {
  console.error('PI REDIRECT COMPLETENESS FAIL\n' + msg);
  process.exit(1);
}

function run() {
  const pageSetFile = String((site && site.pageSetFile) || '').toLowerCase();
  if (!pageSetFile.includes('/pi_v1.json')) {
    console.log('ℹ️ PI redirect completeness skip (non-PI pack)');
    return;
  }
  const redirectsPath = path.join(process.cwd(), 'dist', '_redirects');
  if (!fs.existsSync(redirectsPath)) fail('missing dist/_redirects');
  const redirects = fs.readFileSync(redirectsPath, 'utf8');
  const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'page_sets', 'examples', 'cities_pi_v1.json'), 'utf8')) || [];
  const bad = [];
  for (const row of cities) {
    const slug = String((row && row.slug) || '').trim();
    if (!slug) continue;
    const m = slug.match(/-([a-z]{2})$/i);
    if (!m) { bad.push(`${slug}: cannot infer state from slug`); continue; }
    const ab = m[1].toUpperCase();
    const expected = [
      `/${slug}/ /states/${ab}/ 301`,
      `/${slug}/directory/ /states/${ab}/ 301`,
      `/${slug}/faq/ /states/${ab}/ 301`,
      `/${slug}/next-steps/ /states/${ab}/ 301`
    ];
    expected.forEach((line) => { if (!redirects.includes(line)) bad.push(`${slug}: missing redirect ${line}`); });
  }
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ PI redirect completeness pass');
}

module.exports = { run };
if (require.main === module) run();
