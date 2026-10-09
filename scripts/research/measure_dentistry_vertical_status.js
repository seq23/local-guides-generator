#!/usr/bin/env node
/**
 * Computes the numbers that data/research/dentistry/vertical_status.json states,
 * so the decision record cannot drift from the repo it describes.
 *
 *   node scripts/research/measure_dentistry_vertical_status.js          # print
 *   node scripts/research/measure_dentistry_vertical_status.js --write  # store under "measurements"
 *
 * scripts/validation/dentistry_safety_net_research_contract.js imports measure()
 * and fails the build when the stored block no longer equals a fresh measurement.
 * Nothing in that block is typed by hand.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PACK_CITIES = path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_dentistry_v1.json');
const BASE_CITIES = path.join(ROOT, 'data', 'cities.json');
const PROMOTED_CSV = path.join(ROOT, 'data', 'research', 'coverage', 'coverage_promoted.csv');
const RESEARCH_DIR = path.join(ROOT, 'data', 'city_content', 'dentistry');
const SIGNALS = path.join(ROOT, 'data', 'signals', 'dentistry_query_class_openness_2026-08-27.json');
const STATUS = path.join(ROOT, 'data', 'research', 'dentistry', 'vertical_status.json');

const SECTION_KEYS = ['free_low_cost', 'dental_school'];
const DOLLAR_FIGURE = /\$\s?\d/;

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function promotedDentistrySlugs() {
  if (!fs.existsSync(PROMOTED_CSV)) return [];
  return fs.readFileSync(PROMOTED_CSV, 'utf8').split(/\r?\n/).slice(1)
    .map((line) => line.split(','))
    .filter((cols) => (cols[0] || '').trim() === 'dentistry' && /^true$/i.test((cols[3] || '').trim()))
    .map((cols) => (cols[1] || '').trim())
    .filter(Boolean);
}

// The same three sources loadCities() in scripts/build_city_sites.js unions.
function builtCitySlugs() {
  const slugs = new Set();
  for (const c of readJson(PACK_CITIES)) if (c && c.slug) slugs.add(c.slug);
  for (const slug of promotedDentistrySlugs()) slugs.add(slug);
  for (const c of readJson(BASE_CITIES)) if (c && c.slug) slugs.add(c.slug);
  return [...slugs].sort();
}

function walkStrings(value, visit) {
  if (typeof value === 'string') visit(value);
  else if (Array.isArray(value)) value.forEach((v) => walkStrings(v, visit));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => walkStrings(v, visit));
}

function measure() {
  const built = builtCitySlugs();
  const researchFiles = fs.readdirSync(RESEARCH_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  const backed = researchFiles.filter((slug) => built.includes(slug));
  const entriesPerMetro = {};
  const sourceUrls = new Set();
  const fetchedOn = new Set();
  let dollarFigures = 0;
  for (const slug of researchFiles) {
    const doc = readJson(path.join(RESEARCH_DIR, `${slug}.json`));
    walkStrings(doc, (s) => { if (DOLLAR_FIGURE.test(s)) dollarFigures += 1; });
    const sna = doc.safety_net_access || {};
    entriesPerMetro[slug] = {};
    for (const key of SECTION_KEYS) {
      const entries = Array.isArray(sna[key]) ? sna[key] : [];
      entriesPerMetro[slug][key] = entries.length;
      for (const e of entries) {
        for (const src of [{ url: e.source_url, fetched_on: e.fetched_on }].concat(e.additional_sources || [])) {
          if (src && src.url) sourceUrls.add(src.url);
          if (src && src.fetched_on) fetchedOn.add(src.fetched_on);
        }
      }
    }
  }
  const totals = {};
  for (const key of SECTION_KEYS) totals[key] = Object.values(entriesPerMetro).reduce((n, m) => n + (m[key] || 0), 0);
  const probes = {};
  for (const p of readJson(SIGNALS).probes || []) {
    if (p.vertical === 'dentistry') probes[p.query] = { unbranded_share: p.unbranded_share, national_brand_share: p.national_brand_share };
  }
  return {
    computed_by: 'scripts/research/measure_dentistry_vertical_status.js',
    city_pages_built: built.length,
    research_files_present: researchFiles,
    research_backed_pages_built: backed.length,
    research_files_without_a_page: researchFiles.filter((slug) => !built.includes(slug)),
    cities_rendering_the_template: built.length - backed.length,
    cities_promoted: promotedDentistrySlugs().length,
    safety_net_entries_per_metro: entriesPerMetro,
    safety_net_entries_total: totals,
    distinct_source_urls: sourceUrls.size,
    source_fetch_dates: [...fetchedOn].sort(),
    dollar_figures_in_dentistry_city_content: dollarFigures,
    open_axis_probes: probes,
  };
}

module.exports = { measure, builtCitySlugs, STATUS, SECTION_KEYS, DOLLAR_FIGURE };

if (require.main === module) {
  const m = measure();
  if (process.argv.includes('--write')) {
    const status = readJson(STATUS);
    status.measurements = m;
    fs.writeFileSync(STATUS, JSON.stringify(status, null, 2) + '\n');
    console.log(`wrote measurements to ${path.relative(ROOT, STATUS)}`);
  } else {
    console.log(JSON.stringify(m, null, 2));
  }
}
