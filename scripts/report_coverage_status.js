/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const COVERAGE_TARGETS = path.join(REPO_ROOT, 'data', 'research', 'coverage', 'coverage_targets.csv');
const SHARED_REGISTRY = path.join(REPO_ROOT, 'data', 'research', 'shared', 'us_city_registry.csv');
const LISTINGS_DIR = path.join(REPO_ROOT, 'data', 'listings');
const EXAMPLE_PROVIDERS_DIR = path.join(REPO_ROOT, 'data', 'example_providers');

const VERTICALS = ['neuro', 'trt', 'uscis-medical'];
const DISPLAY = {
  neuro: 'Neuro',
  trt: 'TRT',
  'uscis-medical': 'USCIS Medical',
};
const PROVIDER_DIR = {
  neuro: 'neuro',
  trt: 'trt',
  'uscis-medical': 'uscis_medical',
};
const VALID_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]);

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

function readCsv(fp) {
  return parseCsv(fs.readFileSync(fp, 'utf8'));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));
}

function getListingSlugs() {
  return new Set(listJsonFiles(LISTINGS_DIR));
}

function getProviderCitySlugs(vertical) {
  const dir = path.join(EXAMPLE_PROVIDERS_DIR, PROVIDER_DIR[vertical]);
  if (!fs.existsSync(dir)) return new Set();
  const slugs = new Set();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const base = name.replace(/\.json$/, '');
    const citySlug = base.split('__')[0];
    slugs.add(citySlug);
  }
  return slugs;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function sortAlpha(arr) {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

function renderSection(title, lines) {
  const body = lines.map((line) => `- ${line}`).join('\n');
  return `${title}\n${body}`;
}

function main() {
  if (!fs.existsSync(COVERAGE_TARGETS)) {
    console.error('COVERAGE REPORT FAIL: missing data/research/coverage/coverage_targets.csv');
    process.exit(1);
  }
  if (!fs.existsSync(SHARED_REGISTRY)) {
    console.error('COVERAGE REPORT FAIL: missing data/research/shared/us_city_registry.csv');
    process.exit(1);
  }

  const targetRows = readCsv(COVERAGE_TARGETS).filter((row) => VERTICALS.includes(row.vertical));
  const registryRows = readCsv(SHARED_REGISTRY);
  const listingSlugs = getListingSlugs();
  const tier1Slugs = new Set(registryRows.filter((row) => String(row.is_tier1).toLowerCase() === 'true').map((row) => row.city_slug));
  const anchorByState = new Map();
  for (const row of registryRows) {
    if (!VALID_STATE_CODES.has(row.state_code)) continue;
    if (String(row.is_anchor).toLowerCase() === 'true' && !anchorByState.has(row.state_code)) {
      anchorByState.set(row.state_code, row.city_slug);
    }
  }

  const byVertical = groupBy(targetRows, 'vertical');
  const output = [];

  output.push('PHASE 2 — COVERAGE STATUS REPORT');
  output.push('');
  output.push(`Generated: ${new Date().toISOString()}`);
  output.push('');

  for (const vertical of VERTICALS) {
    const rows = byVertical.get(vertical) || [];
    const providerSlugs = getProviderCitySlugs(vertical);
    const plannedSlugs = new Set(rows.map((row) => row.city_slug));
    const statesCoveredInPlan = new Set(rows.map((row) => row.state_code));
    const plannedTier1 = rows.filter((row) => row.tier === 'T1');
    const coveredTier1 = plannedTier1.filter((row) => providerSlugs.has(row.city_slug) && listingSlugs.has(row.city_slug));
    const missingTier1 = plannedTier1.filter((row) => !(providerSlugs.has(row.city_slug) && listingSlugs.has(row.city_slug)));
    const readyRows = rows.filter((row) => providerSlugs.has(row.city_slug) && listingSlugs.has(row.city_slug));
    const missingProvider = rows.filter((row) => !providerSlugs.has(row.city_slug));
    const missingListing = rows.filter((row) => !listingSlugs.has(row.city_slug));
    const runtimeOutsidePlan = sortAlpha([...providerSlugs].filter((slug) => !plannedSlugs.has(slug)));
    const missingStateAnchors = sortAlpha([...VALID_STATE_CODES].filter((code) => !statesCoveredInPlan.has(code)));

    output.push(DISPLAY[vertical].toUpperCase());
    output.push(renderSection('STATE / DC PRESENCE', [
      `planned jurisdictions represented: ${statesCoveredInPlan.size} / ${VALID_STATE_CODES.size}`,
      `missing state/DC anchors in plan: ${missingStateAnchors.length ? missingStateAnchors.join(', ') : 'none'}`,
    ]));
    output.push(renderSection('TIER 1 COVERAGE READINESS', [
      `tier 1 cities planned: ${plannedTier1.length}`,
      `tier 1 cities ready now (provider + listing): ${coveredTier1.length}`,
      `tier 1 cities still blocked: ${missingTier1.length ? missingTier1.map((row) => row.city_slug).join(', ') : 'none'}`,
    ]));
    output.push(renderSection('BUILD READINESS', [
      `planned cities: ${rows.length}`,
      `ready now (provider + listing): ${readyRows.length}`,
      `blocked by missing provider dataset: ${missingProvider.length ? missingProvider.map((row) => row.city_slug).join(', ') : 'none'}`,
      `blocked by missing listing json: ${missingListing.length ? missingListing.map((row) => row.city_slug).join(', ') : 'none'}`,
    ]));
    output.push(renderSection('RUNTIME VS PLAN', [
      `provider datasets present outside plan: ${runtimeOutsidePlan.length ? runtimeOutsidePlan.join(', ') : 'none'}`,
      `listing jsons available for planned cities: ${rows.filter((row) => listingSlugs.has(row.city_slug)).length}`,
      `provider-ready jurisdiction count: ${new Set(readyRows.map((row) => row.state_code)).size} / ${VALID_STATE_CODES.size}`,
    ]));
    output.push('');
  }

  const report = output.join('\n');
  console.log(report);
}

if (require.main === module) main();
