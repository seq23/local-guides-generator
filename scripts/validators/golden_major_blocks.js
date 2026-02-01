const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Read pack-level cityFeatures from data/site.json.pageSetFile.
// Pack is a styling/content pack; city vertical (from data/listings/<slug>.json) governs PI vs non-PI rules.
function getPackCityFeatures(repoRoot) {
  let pageSetFile = null;
  try {
    const site = readJson(path.join(repoRoot, 'data', 'site.json'));
    pageSetFile = site && site.pageSetFile;
  } catch (_) {}

  let cityFeatures = {};
  if (pageSetFile) {
    const pageSetPath = path.join(repoRoot, 'data', 'page_sets', pageSetFile);
    const examplesPath = path.join(repoRoot, 'data', 'page_sets', 'examples', pageSetFile);
    const chosen = fs.existsSync(pageSetPath) ? pageSetPath : (fs.existsSync(examplesPath) ? examplesPath : null);
    if (chosen) {
      try {
        const pack = readJson(chosen);
        cityFeatures = (pack && pack.cityFeatures) || {};
      } catch (_) {}
    }
  }
  return { pageSetFile, cityFeatures };
}

function listHtmlFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name.endsWith('.html')) out.push(p);
    }
  }
  return out;
}

function getCitySlugFromDistPath(distRoot, filePath) {
  const rel = path.relative(distRoot, filePath).replace(/\\/g, '/');
  const m = rel.match(/^([^/]+)\/index\.html$/);
  return m ? m[1] : null;
}

function getCityVertical(repoRoot, citySlug) {
  if (!citySlug) return null;
  const p = path.join(repoRoot, 'data', 'listings', `${citySlug}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    const j = readJson(p);
    // Preferred: explicit vertical key
    if (j && j.vertical) return String(j.vertical).toLowerCase();

    // Back-compat inference: many city listing JSONs only contain listings + practice_areas.
    // Treat any city that includes a personal-injury practice area as PI.
    const listings = Array.isArray(j && j.listings) ? j.listings : [];
    for (const item of listings) {
      const areas = Array.isArray(item && item.practice_areas) ? item.practice_areas : [];
      if (areas.map(a => String(a).toLowerCase()).includes('personal-injury')) return 'pi';
    }
    return null;
  } catch (_) {
    return null;
  }
}

function listListingCitySlugs(repoRoot) {
  const dir = path.join(repoRoot, 'data', 'listings');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => n.replace(/\.json$/i, ''))
    .sort();
}

function main() {
  const repoRoot = process.cwd();
  const distRoot = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distRoot)) {
    console.error('GOLDEN MAJOR BLOCK FAIL: dist/ not found. Run build first.');
    process.exit(1);
  }

  const pack = getPackCityFeatures(repoRoot);
  const packStateLookupEnabled = !!(pack.cityFeatures && pack.cityFeatures.stateLookup);

  // Golden Major Blocks are defined ONLY for city hub pages.
  // Do NOT validate legal/policy/utility routes (privacy, terms, etc.).
  // Source of truth for "what is a city" is data/listings/*.json.
  const citySlugs = listListingCitySlugs(repoRoot);

  // Base always-required major markers for city hub pages (reduced scope: core blocks only)
  const baseRequired = [
    'data-faq="true"',
    'data-guides="true"'
  ];

  const fails = [];
  for (const citySlug of citySlugs) {
    const f = path.join(distRoot, citySlug, 'index.html');
    if (!fs.existsSync(f)) continue; // Coverage validator should catch missing outputs.
    const vertical = getCityVertical(repoRoot, citySlug);

    // Canonical rule (Playbook v7 intent):
    // - PI city hubs MUST NOT be forced to include state lookup or example providers blocks
    //   (PI safety stripping makes those blocks non-canonical on PI hubs).
    // - Non-PI city hubs: require state lookup + example providers only if the active pack enables stateLookup.
    const requireStateLookup = (vertical !== 'pi') && packStateLookupEnabled;
    const requireExampleProviders = (vertical !== 'pi') && packStateLookupEnabled;

    const required = baseRequired.slice();
    if (requireExampleProviders) required.push('data-example-providers="true"');
    if (requireStateLookup) required.push('data-state-lookup="true"');

    const html = fs.readFileSync(f, 'utf8');
    for (const token of required) {
      if (!html.includes(token)) {
        const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
        fails.push(`${rel} missing ${token}` + (vertical ? ` (vertical=${vertical})` : ''));
      }
    }
  }

  if (fails.length) {
    console.error('GOLDEN MAJOR BLOCK FAIL', fails.slice(0, 10));
    if (fails.length > 10) console.error(`...and ${fails.length - 10} more`);
    process.exit(1);
  }

  console.log('✅ GOLDEN MAJOR BLOCKS PASS' + (pack.pageSetFile ? ` (${pack.pageSetFile})` : ''));
}

main();
