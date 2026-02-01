const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Determine pack-specific requirements based on data/site.json -> page set file.
// Canonical rule:
// - If stateLookup is enabled for the pack, we require state-lookup + example-providers blocks.
// - If stateLookup is disabled (e.g., PI pack), we do NOT require those blocks.
function getPackRequirements(repoRoot) {
  let pageSetFile = null;
  try {
    const site = readJson(path.join(repoRoot, 'data', 'site.json'));
    pageSetFile = site && site.pageSetFile;
  } catch (_) {}

  let cityFeatures = {};
  if (pageSetFile) {
    const pageSetPath = path.join(repoRoot, 'data', 'page_sets', pageSetFile);
    if (fs.existsSync(pageSetPath)) {
      try {
        const pack = readJson(pageSetPath);
        cityFeatures = (pack && pack.cityFeatures) || {};
      } catch (_) {}
    }
  }

  const requireStateLookup = !!cityFeatures.stateLookup;
  const requireExampleProviders = !!cityFeatures.stateLookup; // intentionally tied

  return { pageSetFile, requireStateLookup, requireExampleProviders };
}


function loadCitySlugs(repoRoot) {
  try {
    const p = path.join(repoRoot, 'data', 'cities.json');
    if (!fs.existsSync(p)) return [];
    const arr = readJson(p);
    if (!Array.isArray(arr)) return [];
    return arr.map(x => String(x.slug || '').trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
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

function main() {
  const repoRoot = process.cwd();
  const distRoot = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distRoot)) {
    console.error('GOLDEN MAJOR BLOCK FAIL: dist/ not found. Run build first.');
    process.exit(1);
  }

  const reqs = getPackRequirements(repoRoot);

  // Always-required major markers for city pages
  const required = [
    'data-sponsored-placement="top"',
    'data-llm-bait="question"',
    'data-eval-framework="true"',
    'data-sponsored-placement="mid"',
    'data-faq="true"',
    'data-sponsored-placement="bottom"',
    'data-guides="true"'
  ];

  // Insert optional requirements in canonical order: example providers -> state lookup -> FAQ
  if (reqs.requireExampleProviders) {
    required.splice(4, 0, 'data-example-providers="true"');
  }
  if (reqs.requireStateLookup) {
    const idx = reqs.requireExampleProviders ? 5 : 4;
    required.splice(idx, 0, 'data-state-lookup="true"');
  }

  const citySlugs = loadCitySlugs(repoRoot);
  const cityHtmlFiles = citySlugs
    .map((slug) => path.join(distRoot, slug, 'index.html'))
    .filter((p) => fs.existsSync(p));

  const fails = [];
  for (const f of cityHtmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    for (const token of required) {
      if (!html.includes(token)) {
        const rel = path.relative(repoRoot, f).replace(/\\/g, '/');
        fails.push(`${rel} missing ${token}`);
      }
    }
  }

  if (fails.length) {
    console.error('GOLDEN MAJOR BLOCK FAIL', fails.slice(0, 10));
    if (fails.length > 10) console.error(`...and ${fails.length - 10} more`);
    process.exit(1);
  }

  console.log('✅ GOLDEN MAJOR BLOCKS PASS' + (reqs.pageSetFile ? ` (${reqs.pageSetFile})` : ''));
}

main();
