/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function exists(p) {
  try { return fs.existsSync(p); } catch (_) { return false; }
}

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of fs.readdirSync(cur)) {
      const fp = path.join(cur, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) stack.push(fp);
      else out.push(fp);
    }
  }
  return out;
}

function toUrlPath(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return `/${rel.slice(0, -'/index.html'.length)}/`;
}

function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>([\s\S]*?)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) {
    locs.push(String(m[1] || '').trim());
  }
  return locs;
}

function canonicalizeLoc(loc) {
  if (!loc) return '';
  try {
    const u = new URL(loc);
    let p = u.pathname || '/';
    if (!p.endsWith('/')) p += '/';
    return p;
  } catch (_) {
    return '';
  }
}

function run(ctx = {}) {
  const repoRoot = ctx.repoRoot || process.cwd();
  const distDir = path.join(repoRoot, 'dist');
  const sitemapPath = path.join(distDir, 'sitemap.xml');

  if (!exists(distDir)) {
    throw new Error('SITEMAP PARITY FAIL: dist/ missing. Run build first.');
  }
  if (!exists(sitemapPath)) {
    throw new Error('SITEMAP PARITY FAIL: dist/sitemap.xml missing. Run postbuild first.');
  }

  const expectedPaths = new Set(
    walk(distDir)
      .map((fp) => toUrlPath(distDir, fp))
      .filter(Boolean)
  );

  const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
  const actualPaths = new Set(parseSitemapLocs(sitemapXml).map(canonicalizeLoc).filter(Boolean));

  const missingFromSitemap = [...expectedPaths].filter((p) => !actualPaths.has(p)).sort();
  const missingFromDist = [...actualPaths].filter((p) => !expectedPaths.has(p)).sort();

  if (missingFromSitemap.length || missingFromDist.length) {
    const parts = ['SITEMAP PARITY FAIL: crawlable dist pages and sitemap.xml are out of sync.'];
    if (missingFromSitemap.length) {
      parts.push(`Missing from sitemap (${missingFromSitemap.length}): ${missingFromSitemap.slice(0, 20).join(', ')}${missingFromSitemap.length > 20 ? ' ...' : ''}`);
    }
    if (missingFromDist.length) {
      parts.push(`Missing from dist (${missingFromDist.length}): ${missingFromDist.slice(0, 20).join(', ')}${missingFromDist.length > 20 ? ' ...' : ''}`);
    }
    throw new Error(parts.join('\n'));
  }

  console.log(`✅ sitemap parity contract pass (${expectedPaths.size} crawlable pages)`);
}

module.exports = { run };
