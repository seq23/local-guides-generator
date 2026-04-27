/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const site = require(path.join(__dirname, '..', '..', 'data', 'site.json'));

function fail(msg) {
  console.error('PI STATE FIRMS CONTRACT FAIL\n' + msg);
  process.exit(1);
}

function run() {
  const pageSetFile = String((site && site.pageSetFile) || '').toLowerCase();
  if (!pageSetFile.includes('/pi_v1.json')) {
    console.log('ℹ️ PI state firms contract skip (non-PI pack)');
    return;
  }
  const states = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'us_states.json'), 'utf8'));
  const base = path.join(__dirname, '..', '..', 'data', 'pi_state_firms');
  const bad = [];
  for (const [ab, stateName] of Object.entries(states)) {
    const fp = path.join(base, `${String(ab).toLowerCase()}.json`);
    if (!fs.existsSync(fp)) {
      bad.push(`${ab}: missing data/pi_state_firms/${String(ab).toLowerCase()}.json`);
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const firms = Array.isArray(raw.firms) ? raw.firms : [];
    if (String(raw.state_abbr || '').toUpperCase() !== String(ab).toUpperCase()) bad.push(`${ab}: state_abbr mismatch`);
    if (String(raw.state_name || '').trim() !== String(stateName).trim()) bad.push(`${ab}: state_name mismatch`);
    if (firms.length < 1) bad.push(`${ab}: expected at least 1 firm (got ${firms.length})`);
    const names = firms.map((item) => String((item && (item.name || item.firm_name)) || '').trim());
    if (names.some((name) => !name)) bad.push(`${ab}: blank firm name present`);
    const unique = new Set(names.map((name) => name.toLowerCase()));
    if (unique.size !== names.length) bad.push(`${ab}: duplicate firm names present`);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    if (JSON.stringify(sorted) !== JSON.stringify(names)) bad.push(`${ab}: firms not in alphabetical order`);
  }
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ PI state firms contract pass');
}

module.exports = { run };
if (require.main === module) run();
