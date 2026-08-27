/**
 * One answer to "did anyone actually research this city?", shared by the
 * builder and the validator.
 *
 * `loadOptionalCityContent()` in build_city_sites.js falls back to
 * `defaultArtifactCityContent()` when no research file exists. That function
 * derives a city name and a state name from the slug and interpolates them into
 * a fixed prose template: "${cityName} personal injury comparisons work better
 * when the page acts like a decision guide first and a directory second." The
 * page names the city and says nothing about it.
 *
 * 197 of the 221 non-PI city pages render that way - 47 of 53 dentistry, 50 of
 * 56 neuro, 50 of 56 trt, 50 of 56 uscis_medical - and every one is admitted to
 * the sitemap, because the sitemap's entire admission test is "not noindex".
 * The fallback was silent, so nothing distinguished a researched page from a
 * slug-interpolated one at any point after generation.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CITY_CONTENT_DIR = path.join(ROOT, 'data', 'city_content');

/** True when a real research file backs this city for this vertical. */
function hasResearch(verticalKey, citySlug) {
  const vk = String(verticalKey || '').trim();
  const slug = String(citySlug || '').trim();
  if (!vk || !slug) return false;
  const file = path.join(CITY_CONTENT_DIR, vk, `${slug}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    // A file that parses but carries nothing is the same as no file. The
    // fallback would not fire, but the page is equally unresearched.
    return Boolean(raw) && Object.keys(raw).length > 0;
  } catch {
    return false;
  }
}

/** Every city slug with a research file, per vertical. */
function researchedSlugs(verticalKey) {
  const dir = path.join(CITY_CONTENT_DIR, String(verticalKey || '').trim());
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .filter((slug) => hasResearch(verticalKey, slug))
  );
}

/** The verticals this repo builds packs for. */
function verticals() {
  if (!fs.existsSync(CITY_CONTENT_DIR)) return [];
  return fs.readdirSync(CITY_CONTENT_DIR).filter((d) => fs.statSync(path.join(CITY_CONTENT_DIR, d)).isDirectory());
}

module.exports = { hasResearch, researchedSlugs, verticals, CITY_CONTENT_DIR };
