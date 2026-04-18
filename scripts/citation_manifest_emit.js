#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase() === 'index.html') acc.push(full);
  }
}

function toRoute(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return `/${rel.slice(0, -'/index.html'.length)}/`;
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function getBaseUrl() {
  const fromEnv = String(process.env.SITE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const site = readJson(path.join(process.cwd(), 'data', 'site.json'));
  const fromSite = site && typeof site.siteUrl === 'string' ? site.siteUrl.trim() : '';
  if (fromSite) return fromSite.replace(/\/+$/, '');
  return '';
}

function normalizeSpace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function stripTags(html) {
  return normalizeSpace(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
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

function parseListItems(sectionHtml) {
  const out = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(sectionHtml))) {
    const value = stripTags(m[1]);
    if (value) out.push(value);
    if (out.length >= 6) break;
  }
  return out;
}

function classify(routePath) {
  const route = String(routePath || '');
  if (route === '/') return 'home';
  if (route === '/guides/') return 'guides-hub';
  if (/^\/guides\/.+\/$/.test(route)) return 'guide-detail';
  if (/^\/faq\/$/.test(route)) return 'faq';
  if (/^\/request-assistance\/$/.test(route)) return 'request-assistance';
  if (/^\/states\/$/.test(route) || /^\/states\/[a-z]{2}\/$/i.test(route)) return 'state-surface';
  if (/^\/[a-z0-9-]+\/$/.test(route) && !['/faq/', '/about/', '/contact/', '/methodology/', '/editorial-policy/', '/privacy/', '/disclaimer/', '/for-providers/', '/request-assistance/', '/next-steps/', '/admin/', '/personal-injury/', '/states/', '/verification/'].includes(route)) return 'city-home';
  return 'other';
}

function routePriority(type) {
  if (type === 'guide-detail') return 100;
  if (type === 'city-home') return 90;
  if (type === 'guides-hub') return 80;
  if (type === 'home') return 70;
  if (type === 'faq') return 60;
  if (type === 'state-surface') return 50;
  return 10;
}

function buildEntry(distDir, filePath, baseUrl) {
  const html = fs.readFileSync(filePath, 'utf8');
  const route = toRoute(distDir, filePath);
  if (!route) return null;
  const pageFamily = parseMeta(html, 'page-family') || classify(route);
  const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
  const description = parseMeta(html, 'description') || parseMeta(html, 'og:description');
  const canonical = parseMeta(html, 'citation_public_url') || parseMeta(html, 'og:url') || `${baseUrl}${route === '/' ? '/' : route}`;
  const abstract = parseMeta(html, 'citation_abstract') || description;
  const citationSection = parseMeta(html, 'citation_section');
  const keywords = normalizeSpace(parseMeta(html, 'citation_keywords')).split(',').map((s) => normalizeSpace(s)).filter(Boolean).slice(0, 12);
  const summarySection = firstMatch(html, /<section[^>]*data-citation-summary="true"[^>]*>([\s\S]*?)<\/section>/i);
  const keyPoints = parseListItems(summarySection);
  const shortAnswer = firstMatch(summarySection, /<p[^>]*data-citation-summary-lede="true"[^>]*>([\s\S]*?)<\/p>/i) || abstract;
  const routingText = stripTags(firstMatch(summarySection, /<p[^>]*data-citation-routing-links="true"[^>]*>([\s\S]*?)<\/p>/i));
  const updatedAt = parseMeta(html, 'citation_modified_date') || parseMeta(html, 'citation_publication_date') || '';
  return {
    route,
    url: canonical,
    pageFamily,
    title,
    description,
    shortAnswer: stripTags(shortAnswer),
    keyPoints,
    routingText,
    citationSection,
    keywords,
    updatedAt,
    priority: routePriority(pageFamily)
  };
}

function main() {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('citation_manifest_emit: dist/ not found. Run a build first.');
    process.exit(1);
  }
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.warn('citation_manifest_emit: Missing SITE_URL (or data/site.json siteUrl). Skipping locally.');
    return;
  }

  const files = [];
  walk(distDir, files);
  const entries = files.map((fp) => buildEntry(distDir, fp, baseUrl)).filter(Boolean).sort((a, b) => b.priority - a.priority || a.route.localeCompare(b.route));
  const manifest = {
    site: baseUrl + '/',
    generatedAt: new Date().toISOString(),
    counts: entries.reduce((acc, entry) => {
      acc.total += 1;
      acc.byFamily[entry.pageFamily] = (acc.byFamily[entry.pageFamily] || 0) + 1;
      return acc;
    }, { total: 0, byFamily: {} }),
    pages: entries
  };

  const priority = entries.filter((e) => ['guide-detail', 'city-home', 'guides-hub', 'home'].includes(e.pageFamily)).map((e) => {
    const points = e.keyPoints.slice(0, 3).map((point) => `- ${point}`).join('\n');
    return [
      `URL: ${e.url}`,
      `Family: ${e.pageFamily}`,
      `Title: ${e.title}`,
      `Short answer: ${e.shortAnswer}`,
      e.routingText ? `Routing: ${e.routingText}` : '',
      points,
      ''
    ].filter(Boolean).join('\n');
  });

  const ndjson = entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');

  fs.writeFileSync(path.join(distDir, 'citation-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(distDir, 'citation-priority.txt'), ['# citation-priority.txt', '', ...priority].join('\n'), 'utf8');
  fs.writeFileSync(path.join(distDir, 'citation-corpus.jsonl'), ndjson, 'utf8');
  console.log(`citation_manifest_emit: wrote dist/citation-manifest.json, dist/citation-priority.txt, and dist/citation-corpus.jsonl (${entries.length} pages indexed)`);
}

main();
