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

function normalizeToCanonicalPageSetPath(rawPageSetFile) {
  const raw = String(rawPageSetFile || '').trim().replace(/^\.\/?/, '');
  if (!raw) return '';
  if (!raw.startsWith('data/page_sets/')) return '';
  return raw;
}

function resolvePageSetPath(pageSetFile) {
  const raw = String(pageSetFile || '').trim().replace(/^\.\/?/, '');
  if (!raw) fail('data/site.json is missing pageSetFile');

  if (!raw.startsWith('data/page_sets/')) {
    fail(`Invalid pageSetFile: ${pageSetFile}. Expected canonical repo-relative path under data/page_sets/`);
  }

  const abs = path.join(repoRoot, raw);
  if (!fs.existsSync(abs)) {
    fail(`pageSetFile missing or unreadable: ${raw}`);
  }

  return abs;
}

function main() {
  const siteJsonPath = path.join(dataDir, 'site.json');
  const hasSiteJson = fs.existsSync(siteJsonPath);

  // site.json is created during build (prepare_site). Some workflows (e.g.
  // Rotating Refresh) intentionally run without a full build, so site.json may
  // be missing. Also, previous buggy commits may have written literal `null`.
  // Snapshot must NEVER crash in those scenarios.
  const siteParsed = hasSiteJson ? readJson(siteJsonPath) : null;
  const site = siteParsed && typeof siteParsed === 'object' ? siteParsed : {};

  // Prefer site.pageSetFile; fall back to env if present.
  const envPageSet = process.env.PAGE_SET_FILE || process.env.PAGE_SET_FILE_REL || '';
  const pageSetFileRaw = site.pageSetFile ? String(site.pageSetFile) : String(envPageSet || '');
  const pageSetFileRel = pageSetFileRaw ? normalizeToCanonicalPageSetPath(pageSetFileRaw) : '';

  let pageSetPath = null;
  let pageSet = null;
  if (pageSetFileRaw) {
    try {
      pageSetPath = resolvePageSetPath(pageSetFileRaw);
      pageSet = readJson(pageSetPath);
    } catch (e) {
      // If the pageSetFile came from site.json, that's a hard failure (Golden
      // contract relies on it). If it came from env (or is otherwise optional),
      // don't crash; just omit pageSet details.
      const fromSiteJson = Boolean(siteParsed && typeof siteParsed === 'object' && siteParsed.pageSetFile);
      if (fromSiteJson) {
        fail(`pageSetFile missing or unreadable: ${pageSetFileRaw}`);
      } else {
        console.log(`ℹ️ snapshot_lkg: pageSetFile not resolved (${pageSetFileRaw}); continuing without pageSet.`);
        pageSetPath = null;
        pageSet = null;
      }
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
      pageSetFileRaw: String(pageSetFileRaw || site.pageSetFile || '')
    },
    pageSet: pageSet
      ? {
          name: pageSet.name,
          vertical: pageSet.vertical,
          file: pageSetPath ? rel(pageSetPath) : null
        }
      : null,
    counts
  };

  // dist is the required output location for the snapshot.
  ensureDir(distDir);

  const outPath = path.join(distDir, '_lkg_snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`WROTE: ${rel(outPath)}`);
}

main();
