/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`PUBLIC SOURCE URL POLICY FAIL: ${msg}`);
  process.exit(1);
}

function walkJsonFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(full, out);
    else if (entry.isFile() && full.endsWith('.json')) out.push(full);
  }
  return out;
}

function containsBannedKeys(value, banned, hits = []) {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => containsBannedKeys(item, banned, hits));
    return hits;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (banned.has(k)) hits.push(k);
      containsBannedKeys(v, banned, hits);
    }
  }
  return hits;
}

function run() {
  const root = path.join(__dirname, '..', '..');
  const banned = new Set(['official_site_url', 'website', 'url']);

  const piCsv = path.join(root, 'data', 'pi_directory_master_all_cities_50_states.csv');
  if (fs.existsSync(piCsv)) {
    const firstLine = fs.readFileSync(piCsv, 'utf8').split(/\r?\n/, 1)[0] || '';
    const headers = firstLine.split(',').map(s => s.trim());
    if (headers.includes('official_site_url')) {
      fail('PI master CSV still contains official_site_url header');
    }
  }

  const exampleProvidersDir = path.join(root, 'data', 'example_providers');
  for (const file of walkJsonFiles(exampleProvidersDir)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const hits = containsBannedKeys(data, banned);
    if (hits.length) {
      fail(`Banned public source URL keys found in ${path.relative(root, file)}: ${Array.from(new Set(hits)).join(', ')}`);
    }
  }

  const listingsDir = path.join(root, 'data', 'listings');
  // data/listings/senior-living/ is the state licensure directory for the
  // senior-living pack, not a city listings/sponsor file: the owner's brief
  // (13 Oct 2026) requires each licensed facility's own website on it. It is
  // held instead by scripts/validation/senior_living_facilities_contract.js,
  // which allows `website` there and nowhere else.
  const seniorDir = path.join(listingsDir, 'senior-living') + path.sep;
  for (const file of walkJsonFiles(listingsDir)) {
    if (file.startsWith(seniorDir)) continue;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const hits = containsBannedKeys(data, banned);
    if (hits.length) {
      fail(`Banned public source URL keys found in ${path.relative(root, file)}: ${Array.from(new Set(hits)).join(', ')}`);
    }
  }

  console.log('✅ PUBLIC SOURCE URL POLICY PASS');
}

module.exports = { run };
