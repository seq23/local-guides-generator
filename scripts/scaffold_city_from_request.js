#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cityRegistry = require('./helpers/city_registry');

function fail(msg) { throw new Error(`CITY SCAFFOLD FAIL: ${msg}`); }
function readJson(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function writeJson(fp, data) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function normalizeSlug(s) { return String(s || '').trim().toLowerCase(); }
function normalizeState(s) { return String(s || '').trim().toUpperCase(); }

const requestPath = process.argv[2];
const apply = process.argv.includes('--apply');
if (!requestPath) fail('Usage: node scripts/scaffold_city_from_request.js data/templates/city_request.template.json [--apply]');

const root = process.cwd();
const template = readJson(path.resolve(root, requestPath));
if (!template || !Array.isArray(template.requests)) fail('template missing requests array');

const summary = { created: [], skipped_existing: [], warnings: [] };

for (const req of template.requests) {
  const vertical = String(req.vertical || '').trim();
  const state = normalizeState(req.state_code);
  const cityName = String(req.city_name || '').trim();
  const citySlug = normalizeSlug(req.city_slug);
  const marketLabel = String(req.market_label || '').trim();
  if (!vertical || !state || !cityName || !citySlug || !marketLabel) fail(`missing required fields in request ${JSON.stringify(req)}`);
  if ((req.is_base_included && req.is_extra_city) || (!req.is_base_included && !req.is_extra_city)) {
    fail(`${citySlug} must be exactly one of base or extra`);
  }
  if (!citySlug.endsWith(`-${state.toLowerCase()}`)) fail(`${citySlug} must end with -${state.toLowerCase()}`);

  const exists = cityRegistry.cityExists(root, vertical, citySlug);
  if (exists) {
    summary.skipped_existing.push(citySlug);
    continue;
  }

  const citiesFile = cityRegistry.getCitiesFileForVertical(root, vertical);
  const rows = cityRegistry.loadCityList(root, vertical);
  rows.push({ city: cityName, state, slug: citySlug, marketLabel, status: 'live' });
  rows.sort((a, b) => String(a.marketLabel || '').localeCompare(String(b.marketLabel || '')));

  const cityContentDir = path.join(root, 'data', 'city_content', vertical);
  const cityContentPath = path.join(cityContentDir, `${citySlug}.json`);
  const cityContent = {
    heading: `${marketLabel} local comparison notes`,
    body: [
      `${marketLabel} is newly scaffolded. Replace this placeholder copy with real localized comparison guidance before production use.`,
      `Keep the tone neutral, educational, and process-based.`
    ],
    bullets: [
      'Confirm what is included in the quote',
      'Confirm what happens after the first appointment',
      'Confirm whether follow-up costs extra',
      'Confirm the provider\'s credentials',
      'Replace this placeholder with market-specific notes'
    ]
  };

  const exampleDir = path.join(root, 'data', 'example_providers', vertical);
  const examplePath = path.join(exampleDir, `${citySlug}.json`);
  const examplePayload = [{ name: 'REPLACE_WITH_REAL_PROVIDER_EXAMPLE' }];

  if (apply) {
    writeJson(citiesFile, rows);
    if (!fs.existsSync(cityContentPath)) writeJson(cityContentPath, cityContent);
    if (fs.existsSync(exampleDir) && !fs.existsSync(examplePath)) writeJson(examplePath, examplePayload);
  }

  summary.created.push({
    citySlug,
    citiesFile: path.relative(root, citiesFile),
    cityContentPath: path.relative(root, cityContentPath),
    examplePath: fs.existsSync(exampleDir) ? path.relative(root, examplePath) : null
  });
}

console.log(JSON.stringify({ apply, summary }, null, 2));
