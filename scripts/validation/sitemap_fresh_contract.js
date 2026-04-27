const fs = require('fs');
const path = require('path');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}
function xmlLocs(text) {
  return Array.from(String(text || '').matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].trim());
}

function fail(msg) {
  throw new Error(`SITEMAP FRESH CONTRACT FAIL: ${msg}`);
}

function run() {
  const dist = path.join(__dirname, '..', '..', 'dist');
  const citation = readJson(path.join(dist, 'citation-manifest.json'), {});
  const pages = Array.isArray(citation.pages) ? citation.pages : [];
  const freshUrls = xmlLocs(readText(path.join(dist, 'sitemap-fresh.xml')));
  if (!freshUrls.length) fail('sitemap-fresh.xml is empty');
  if (freshUrls.length > 60) fail(`sitemap-fresh.xml has ${freshUrls.length} urls; max allowed is 60`);

  const byUrl = new Map(pages.map((p) => [String(p.url || ''), p]));
  const families = {};
  let home = 0;
  let guidesHub = 0;
  for (const url of freshUrls) {
    const page = byUrl.get(url);
    const fam = String(page?.pageFamily || 'unknown');
    families[fam] = (families[fam] || 0) + 1;
    if (String(page?.route || '') === '/') home += 1;
    if (String(page?.route || '') === '/guides/' || fam === 'guides-hub') guidesHub += 1;
  }

  if (home !== 1) fail('homepage must appear exactly once in sitemap-fresh.xml');
  if (guidesHub < 1) fail('guides hub missing from sitemap-fresh.xml');
  if ((families['guide-detail'] || 0) > 15) fail(`guide-detail count too high (${families['guide-detail'] || 0}); max 15`);
  if ((families['city-home'] || 0) > 20) fail(`city-home count too high (${families['city-home'] || 0}); max 20`);
  if ((families['state'] || 0) > 0 || (families['pi-state'] || 0) > 0 || (families['state-surface'] || 0) > 0) fail('state pages are not allowed in sitemap-fresh.xml');
  if ((families['city-detail'] || 0) > 0) fail('city-detail / next-steps style pages are not allowed in sitemap-fresh.xml');
  if ((families['global'] || 0) > 2) fail(`global utility page count too high (${families['global'] || 0}); max 2`);

  console.log(`✅ sitemap_fresh_contract passed (${freshUrls.length} urls)`);
}

if (require.main === module) run();
module.exports = { run };
