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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    fail(`Could not read JSON: ${fp}`);
  }
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
        const p = full.replaceAll('\\', '/');
        if (!predicate || predicate(p)) out.push(full);
      }
    }
  }
  return out;
}

function basenameNoExt(p) {
  return path.basename(p).replace(/\.[^.]+$/, '');
}

function rel(p) {
  return p.replace(repoRoot + path.sep, '').replaceAll('\\', '/');
}


function normalizeInputPath(raw) {
  if (!raw) return "";
  let s = String(raw).trim().replaceAll('\\', '/');
  // Strip repoRoot prefix if present
  if (s.startsWith(repoRoot.replaceAll('\\', '/') + '/')) {
    s = s.slice(repoRoot.replaceAll('\\', '/').length + 1);
  }
  return s.replace(/^\.{1,2}\//, '');
}

function normalizeToPageSetsRel(rawPageSetFile) {
  let s = normalizeInputPath(rawPageSetFile);
  if (!s) return "";

  // Strip repeated leading prefixes so we never end up with data/page_sets/data/page_sets/...
  const marker = "data/page_sets/";
  const idx = s.lastIndexOf(marker);
  if (idx >= 0) s = s.slice(idx + marker.length);

  while (s.startsWith("data/page_sets/")) s = s.slice("data/page_sets/".length);
  while (s.startsWith("page_sets/")) s = s.slice("page_sets/".length);

  return s.replace(/^\/+/, "");
}

function resolvePageSetPath(pageSetFile) {
  const raw = String(pageSetFile || '').trim();
  if (!raw) fail('data/site.json is missing pageSetFile');

  // Normalize:
  // - allow Windows separators
  // - allow "./"
  // - allow passing "data/page_sets/..." (as written in site.json)
  // - always resolve under data/page_sets (never absolute)
  const normalized0 = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  let rel = normalized0.replace(/^data\/page_sets\//, '').replace(/^\/+/, '');

  const candidates = [];

  // 1) direct relative under data/page_sets/
  candidates.push(path.join(dataDir, 'page_sets', rel));

  // 2) if they provided a bare filename, also try examples/
  if (!rel.includes('/')) {
    candidates.push(path.join(dataDir, 'page_sets', 'examples', rel));
  }

  // 3) handle odd inputs like "page_sets/examples/foo.json"
  rel = rel.replace(/^page_sets\//, '');
  candidates.push(path.join(dataDir, 'page_sets', rel));

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  fail(
    `Could not resolve pageSetFile "${pageSetFile}" under data/page_sets/ (tried: ${candidates.join(
      ', '
    )})`
  );
  return null;
}

function main() {
  const siteJsonPath = path.join(dataDir, 'site.json');
  const hasSiteJson = fs.existsSync(siteJsonPath);
  const site = hasSiteJson ? readJson(siteJsonPath) : null;

  // Rotating Refresh may run snapshot without a build; in that case we still
  // emit a snapshot file (for logging/audit), but we do not hard-fail.
  const pageSetFileRaw = site && site.pageSetFile ? String(site.pageSetFile) : '';
  const pageSetFileRel = pageSetFileRaw ? normalizeToPageSetsRel(pageSetFileRaw) : '';

  let pageSetPath = null;
  let pageSet = null;
  if (pageSetFileRaw) {
    try {
      pageSetPath = resolvePageSetPath(pageSetFileRaw);
      pageSet = readJson(pageSetPath);
    } catch (e) {
      // If site.json exists but the pageset is missing, that's a real failure.
      fail(`pageSetFile missing or unreadable: ${pageSetFileRaw}`);
    }
  }

  // dist is required for counts + output location; create if missing so we can
  // still write a snapshot in no-build flows.
  ensureDir(distDir);

  const htmlFiles = fs.existsSync(distDir)
    ? walkFiles(distDir, (p) => p.endsWith('.html')).map(rel).sort()
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
      pageSetFile: pageSetFileRel,
      // Debug-only (won't be used by validators unless someone changes them):
      pageSetFileRaw: String(site.pageSetFile || '')
    },
    pageSet: {
      name: pageSet.name,
      vertical: pageSet.vertical,
      file: rel(pageSetPath)
    },
    counts
  };

  // dist is the required output location for the snapshot.
  ensureDir(distDir);

  const outPath = path.join(distDir, '_lkg_snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`WROTE: ${rel(outPath)}`);
}

main();
