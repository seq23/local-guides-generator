#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function isCi() {
  return String(process.env.CI || '').toLowerCase() === 'true';
}

function getBaseUrl() {
  const fromEnv = String(process.env.SITE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const site = readJson(path.join(process.cwd(), 'data', 'site.json'));
  const fromSite = site && typeof site.siteUrl === 'string' ? site.siteUrl.trim() : '';
  if (fromSite) return fromSite.replace(/\/+$/, '');
  return '';
}

function walkIndexFiles(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkIndexFiles(full, acc);
    else if (st.isFile() && name.toLowerCase() === 'index.html') acc.push(full);
  }
}

function toRoute(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return `/${rel.slice(0, -'/index.html'.length)}/`;
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function firstMatch(text, re) {
  const m = String(text || '').match(re);
  return m ? normalizeSpace(m[1]) : '';
}

function parseMeta(html, name) {
  const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${quoted}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i');
  return firstMatch(html, re);
}

function classify(route, pageFamily) {
  const family = String(pageFamily || '').trim();
  if (family === 'home') return 'core';
  if (family === 'guides-hub') return 'guides';
  if (family === 'guide-detail' || family === 'guide') return 'guides';
  if (family === 'city-home' || family === 'city_hub' || family === 'city') return 'cities';
  if (family === 'pi-state' || family === 'state-surface' || family === 'state') return 'states';

  if (route === '/' || route === '/guides/' || route === '/faq/' || route === '/request-assistance/' || route === '/next-steps/') return 'core';
  if (/^\/guides\/.+\/$/.test(route)) return 'guides';
  if (/^\/states\/$/i.test(route) || /^\/states\/[a-z]{2}\/$/i.test(route) || /^\/personal-injury\/[a-z]{2}\/$/i.test(route)) return 'states';
  if (/^\/[a-z0-9-]+\/$/.test(route) && !['/about/','/contact/','/methodology/','/editorial-policy/','/privacy/','/disclaimer/','/for-providers/'].includes(route)) return 'cities';
  return 'core';
}

function priorityFor(route, pageFamily, bucket, fresh) {
  if (route === '/') return 1.0;
  if (pageFamily === 'guides-hub' || route === '/guides/') return 0.95;
  if (pageFamily === 'guide-detail' || bucket === 'guides') return fresh ? 0.92 : 0.9;
  if (pageFamily === 'city-home' || bucket === 'cities') return fresh ? 0.87 : 0.85;
  if (bucket === 'states') return fresh ? 0.78 : 0.75;
  return fresh ? 0.68 : 0.6;
}

function changefreqFor(route, pageFamily, bucket, fresh) {
  if (route === '/' || route === '/guides/') return 'daily';
  if (fresh && (bucket === 'guides' || bucket === 'cities')) return 'daily';
  if (bucket === 'guides' || bucket === 'cities' || bucket === 'states') return 'weekly';
  return 'monthly';
}

function isoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(record, baseUrl) {
  const loc = `${baseUrl}${record.route === '/' ? '/' : record.route}`;
  const parts = [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    record.lastmod ? `    <lastmod>${xmlEscape(record.lastmod)}</lastmod>` : '',
    `    <changefreq>${record.changefreq}</changefreq>`,
    `    <priority>${record.priority.toFixed(1)}</priority>`,
    '  </url>'
  ].filter(Boolean);
  return parts.join('\n');
}

function buildUrlSet(records, baseUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${records.map((r) => urlEntry(r, baseUrl)).join('\n')}\n</urlset>\n`;
}

function buildIndex(baseUrl, files) {
  const today = new Date().toISOString().slice(0, 10);
  const items = files.map((name) => {
    const loc = `${baseUrl}/${name}`;
    return `  <sitemap>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

function buildRecord(distDir, filePath) {
  const route = toRoute(distDir, filePath);
  if (!route) return null;
  const html = fs.readFileSync(filePath, 'utf8');
  const st = fs.statSync(filePath);
  const pageFamily = parseMeta(html, 'page-family');
  const modified = parseMeta(html, 'citation_modified_date') || parseMeta(html, 'article:modified_time') || parseMeta(html, 'citation_publication_date');
  const lastmod = isoDate(modified) || new Date(st.mtimeMs || st.mtime).toISOString().slice(0, 10);
  const bucket = classify(route, pageFamily);
  const ageMs = Date.now() - new Date(`${lastmod}T00:00:00Z`).getTime();
  const fresh = ageMs <= 14 * 24 * 60 * 60 * 1000;
  return {
    route,
    filePath,
    bucket,
    pageFamily,
    lastmod,
    fresh,
    priority: priorityFor(route, pageFamily, bucket, fresh),
    changefreq: changefreqFor(route, pageFamily, bucket, fresh)
  };
}

function run() {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('sitemap_emit: dist/ not found. Run a build first.');
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    const msg = 'sitemap_emit: Missing SITE_URL (or data/site.json siteUrl).';
    if (isCi()) {
      console.error(msg + ' Refusing to ship a broken sitemap in CI.');
      process.exit(1);
    }
    console.warn(msg + ' Skipping sitemap generation locally.');
    return;
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    const msg = `sitemap_emit: SITE_URL is not a valid URL: ${baseUrl}`;
    if (isCi()) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg + ' Skipping locally.');
    return;
  }

  const files = [];
  walkIndexFiles(distDir, files);
  const records = files.map((fp) => buildRecord(distDir, fp)).filter(Boolean).sort((a, b) => a.route.localeCompare(b.route));

  const guides = records.filter((r) => r.bucket === 'guides');
  const cities = records.filter((r) => r.bucket === 'cities');
  const states = records.filter((r) => r.bucket === 'states');
  const core = records.filter((r) => r.bucket === 'core');
  const fresh = records
    .filter((r) => r.fresh || r.priority >= 0.9)
    .sort((a, b) => b.priority - a.priority || b.lastmod.localeCompare(a.lastmod) || a.route.localeCompare(b.route))
    .slice(0, 250);

  const outputs = {
    'sitemap-guides.xml': guides,
    'sitemap-cities.xml': cities,
    'sitemap-states.xml': states,
    'sitemap-core.xml': core,
    'sitemap-fresh.xml': fresh
  };

  for (const [name, bucketRecords] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(distDir, name), buildUrlSet(bucketRecords, parsed.origin), 'utf8');
  }

  const indexFiles = ['sitemap-core.xml', 'sitemap-guides.xml', 'sitemap-cities.xml', 'sitemap-states.xml', 'sitemap-fresh.xml'];
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), buildIndex(parsed.origin, indexFiles), 'utf8');
  console.log(`sitemap_emit: wrote sitemap index + ${indexFiles.length} sub-sitemaps (${records.length} urls) base=${parsed.origin}`);
}

if (require.main === module) run();

module.exports = { run };
