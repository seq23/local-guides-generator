const fs = require('fs');
const path = require('path');

const DEFAULT_CITY_FILES = {
  dentistry: 'data/page_sets/examples/cities_dentistry_v1.json',
  neuro: 'data/page_sets/examples/cities_neuro_v1.json',
  pi: 'data/page_sets/examples/cities_pi_v1.json',
  trt: 'data/page_sets/examples/cities_trt_v1.json',
  uscis_medical: 'data/page_sets/examples/cities_uscis_medical_v1.json'
};

function readJsonSafe(fp, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return fallback;
  }
}

function repoRoot(root) {
  return root || process.cwd();
}

function getCitiesFileForVertical(root, verticalKey) {
  const rel = DEFAULT_CITY_FILES[String(verticalKey || '').trim()];
  if (!rel) throw new Error(`Unknown vertical for city registry: ${verticalKey}`);
  return path.join(repoRoot(root), rel);
}

function loadCityList(root, verticalKey) {
  const fp = getCitiesFileForVertical(root, verticalKey);
  const rows = readJsonSafe(fp, []);
  return Array.isArray(rows) ? rows : [];
}

function cityExists(root, verticalKey, citySlug) {
  const slug = String(citySlug || '').trim().toLowerCase();
  return loadCityList(root, verticalKey).some((row) => String((row && row.slug) || '').trim().toLowerCase() === slug);
}

function loadSponsorships(root) {
  return readJsonSafe(path.join(repoRoot(root), 'data', 'sponsorships.json'), {});
}

function getCityReservation(root, citySlug) {
  const cities = (loadSponsorships(root).cities) || {};
  return cities[String(citySlug || '').trim().toLowerCase()] || null;
}

function summarizeState(root, verticalKey, stateCode) {
  const state = String(stateCode || '').trim().toUpperCase();
  const cities = loadCityList(root, verticalKey).filter((row) => String(row.state || '').trim().toUpperCase() === state);
  const sponsorships = loadSponsorships(root);
  const stateRec = ((sponsorships.state_buyouts) || {})[state] || null;
  const reserved = cities.filter((row) => ((sponsorships.cities) || {})[String(row.slug || '').trim().toLowerCase()]);
  return {
    state,
    totalCitiesInPack: cities.length,
    reservedCities: reserved.map((row) => row.slug),
    baseCities: Array.isArray(stateRec && stateRec.cities_included) ? stateRec.cities_included : [],
    extraCities: Array.isArray(stateRec && stateRec.extra_cities) ? stateRec.extra_cities : []
  };
}

module.exports = {
  DEFAULT_CITY_FILES,
  getCitiesFileForVertical,
  loadCityList,
  cityExists,
  getCityReservation,
  summarizeState
};
