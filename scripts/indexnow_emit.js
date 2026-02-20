/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const dataSitePath = path.join(repoRoot, 'data', 'site.json');

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listHtmlFiles(dir) {
  const out = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, ent.name);
      if (ent.isDirectory()) walk(fp);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) out.push(fp);
    }
  }
  walk(dir);
  return out;
}

function writeSitemap(siteUrl) {
  try {
    if (!fs.existsSync(distDir)) {
      console.warn('[IndexNow] dist/ not found; skipping sitemap/robots/indexnow files');
      return;
    }
    const base = new URL(siteUrl.endsWith('/') ? siteUrl : siteUrl + '/');
    const htmlFiles = listHtmlFiles(distDir);
    const today = new Date().toISOString().slice(0,10);

    const urls = [];
    for (const fp of htmlFiles) {
      const rel = path.relative(distDir, fp).replace(/\\/g, '/');
      // normalize index.html to folder root
      const loc = rel.endsWith('index.html')
        ? new URL(rel.slice(0, -'index.html'.length), base).toString()
        : new URL(rel, base).toString();
      urls.push(loc);
    }

    const sm = [];
    sm.push('<?xml version="1.0" encoding="UTF-8"?>');
    sm.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const u of urls) {
      sm.push('<url>');
      sm.push(`<loc>${u}</loc>`);
      sm.push(`<lastmod>${today}</lastmod>`);
      sm.push('</url>');
    }
    sm.push('</urlset>');
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sm.join('\n'), 'utf8');

    const robots = [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: ${new URL('sitemap.xml', base).toString()}`,
      ''
    ].join('\n');
    fs.writeFileSync(path.join(distDir, 'robots.txt'), robots, 'utf8');

    const key = (process.env.INDEXNOW_KEY || '').trim();
    if (key) {
      fs.writeFileSync(path.join(distDir, 'indexnow.txt'), key + '\n', 'utf8');
    }

    console.log(`[IndexNow] wrote dist/robots.txt, dist/sitemap.xml${key ? ', dist/indexnow.txt' : ''}`);
  } catch (e) {
    console.warn('[IndexNow] non-blocking error:', e && e.message ? e.message : String(e));
  }
}

function main() {
  const site = safeReadJson(dataSitePath);
  if (!site || !site.siteUrl) {
    console.warn('[IndexNow] data/site.json missing siteUrl; skipping');
    return;
  }
  writeSitemap(site.siteUrl);
}

main();
