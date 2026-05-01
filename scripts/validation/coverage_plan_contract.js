/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const VALID_VERTICALS = new Set(['neuro', 'trt', 'uscis-medical']);
const VALID_TIERS = new Set(['T1', 'T2', 'T3']);
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);
const VALID_STATUS = new Set(['planned', 'ready', 'blocked']);
const VALID_BOOL = new Set(['true', 'false']);
const VALID_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(msg) {
  throw new Error(`COVERAGE PLAN CONTRACT FAIL: ${msg}`);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line, idx) => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    row.__line = idx + 2;
    return row;
  });
}

function parseLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'; i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function run(ctx = {}) {
  const repoRoot = ctx.repoRoot || path.join(__dirname, '..', '..');
  const fp = path.join(repoRoot, 'data', 'research', 'coverage', 'coverage_targets.csv');
  if (!fs.existsSync(fp)) fail('data/research/coverage/coverage_targets.csv missing');
  const rows = parseCsv(fs.readFileSync(fp, 'utf8'));
  if (!rows.length) fail('coverage_targets.csv is empty');
  const seen = new Set();
  for (const row of rows) {
    const required = ['vertical','city_slug','city_name','state_code','state_name','tier','priority','required_provider_dataset','required_listing_json','status','notes'];
    for (const key of required) {
      if (!String(row[key] || '').trim()) fail(`row ${row.__line} missing ${key}`);
    }
    if (!VALID_VERTICALS.has(row.vertical)) fail(`row ${row.__line} invalid vertical ${row.vertical}`);
    if (!SLUG_RE.test(row.city_slug)) fail(`row ${row.__line} invalid city_slug ${row.city_slug}`);
    if (!VALID_STATE_CODES.has(row.state_code)) fail(`row ${row.__line} invalid state_code ${row.state_code}`);
    if (!VALID_TIERS.has(row.tier)) fail(`row ${row.__line} invalid tier ${row.tier}`);
    if (!VALID_PRIORITIES.has(row.priority)) fail(`row ${row.__line} invalid priority ${row.priority}`);
    if (!VALID_STATUS.has(row.status)) fail(`row ${row.__line} invalid status ${row.status}`);
    if (!VALID_BOOL.has(String(row.required_provider_dataset).toLowerCase())) fail(`row ${row.__line} invalid required_provider_dataset ${row.required_provider_dataset}`);
    if (!VALID_BOOL.has(String(row.required_listing_json).toLowerCase())) fail(`row ${row.__line} invalid required_listing_json ${row.required_listing_json}`);
    const key = `${row.vertical}::${row.city_slug}`;
    if (seen.has(key)) fail(`duplicate vertical + city_slug ${key}`);
    seen.add(key);
  }
  console.log(`COVERAGE PLAN CONTRACT PASS (${rows.length} rows)`);
}

module.exports = { run };
if (require.main === module) run();
