/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, 'data');
const distDir = path.join(repoRoot, 'dist');

function fail(msg) {
  console.error(`LKG SNAPSHOT FAILED: ${msg}`);
  process.exit(1);
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    fail(`Could not read JSON: ${fp}`);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function relFromRepo(p) {
  return path
    .relative(repoRoot, p)
    .split(path.sep)
    .join('/');
}

function walkFiles(dir, predicate) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile()) {
        const posix = full.split(path.sep).join('/');
        if (!predicate || predicate(posix)) out.push(full);
      }
    }
  }
  return out;
}

function normalizeInputPath(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function normalizeToPageSetsRel(rawPageSetFile) {
  // Returns a path *relative to data/page_sets/*.
  // Examples:
  //  - "data/page_sets/examples/pi_v1.json" -> "examples/pi_v1.json"
  //  - "page_sets/examples/pi_v1.json"      -> "examples/pi_v1.json"
  //  - "examples/pi_v1.json"                -> "examples/pi_v1.json"
  //  - "pi_v1.json"                          -> "pi_v1.json"
  const s0 = normalizeInputPath(rawPageSetFile);
  return s0.replace(/^data\/page_sets\//, '').replace(/^page_sets\//, '');
}

function resolvePageSetPath(rawPageSetFile) {
  const rel = normalizeToPageSetsRel(rawPageSetFile);
  if (!rel) fail('Missing pageSetFile (set data/site.json.pageSetFile or env PAGE_SET_FILE)');

  const candidates = [];

  // Always resolve under data/page_sets
  candidates.push(path.join(dataDir, 'page_sets', rel));

  // If they passed bare filename, also try examples/
  if (!rel.includes('/')) {
    candidates.push(path.join(dataDir, 'page_sets', 'examples', rel));
  }

  // Extra defensive: handle odd nested inputs like "page_sets/examples/foo.json" already stripped,
  // but if something slipped through, strip again and try.
  candidates.push(path.join(dataDir, 'page_sets', rel.replace(/^page_sets\//, '')));

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  fail(
    `Could not resolve pageSetFile "${rawPageSetFile}" under data/page_sets/. Tried: ${candidates
      .map(relFromRepo)
      .join(', ')}`
  );
  return null;
}

function loadSite() {
  const siteJsonPath = path.join(dataDir, 'site.json');
  if (fs.existsSync(siteJsonPath)) {
    const site = readJson(siteJsonPath);
    if (!site.pageSetFile) fail('data/site.json is missing pageSetFile');
    return site;
  }

  // Fallback for workflows that don't run prepare:site (e.g., rotating refresh)
  const pageSetFileEnv = process.env.PAGE_SET_FILE || process.env.LKG_PAGE_SET_FILE || '';
  if (!pageSetFileEnv) {
    fail(
      'Missing data/site.json and no PAGE_SET_FILE env var provided. ' +
        'Either run prepare:site/build first or set PAGE_SET_FILE.'
    );
  }

  return {
    brandName: process.env.BRAND_NAME || process.env.LKG_BRAND_NAME || 'The Industry Guides',
    siteUrl: process.env.SITE_URL || process.env.LKG_SITE_URL || 'https://example.com',
    pageSetFile: pageSetFileEnv
  };
}

function main() {
  const site = loadSite();

  // IMPORTANT: Golden Contract expects site.pageSetFile in snapshot to be RELATIVE to data/page_sets/
  const pageSetFileRel = normalizeToPageSetsRel(site.pageSetFile);
  const pageSetPath = resolvePageSetPath(site.pageSetFile);
  const pageSet = readJson(pageSetPath);

  // dist is required for route counts + output location; create if missing (defensive)
  ensureDir(distDir);

  const htmlFiles = fs.existsSync(distDir)
    ? walkFiles(distDir, (p) => p.endsWith('.html'))
        .map(relFromRepo)
        .sort()
    : [];

  const routes = htmlFiles.map((r) => r.replace(/^dist\//, ''));

  const nextStepsPages = routes.filter((r) => /(^|\/)next-steps(\/|$)/i.test(r));

  const counts = {
    htmlFiles: routes.length,
    hasHomepage: routes.includes('index.html'),
    guidePages: routes.filter((r) => r.startsWith('guides/') && r.endsWith('/index.html')).length,
    cityHubPages: routes.filter((r) => /^[^/]+\/index\.html$/.test(r) && !r.startsWith('guides/')).length,
    nextStepsPages: nextStepsPages.length
  };

  const snapshot = {
    createdAt: new Date().toISOString(),
    site: {
      brandName: site.brandName,
      siteUrl: site.siteUrl,
      // GOLDEN CONTRACT FIELD:
      pageSetFile: normalizePageSetFile(site.pageSetFile),
      // Debug-only (won't be used by validators unless someone changes them):
      pageSetFileRaw: String(site.pageSetFile || '')
    },
    pageSet: {
      name: pageSet.name,
      vertical: pageSet.vertical,
      // Full repo-relative file path for human inspection:
      file: relFromRepo(pageSetPath)
    },
    counts
  };

  const outPath = path.join(distDir, '_lkg_snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`WROTE: ${relFromRepo(outPath)}`);
}

main();
