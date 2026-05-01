#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else out.push(p);
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

function routeGroupLabel(routePath) {
  const route = String(routePath || '');
  if (route === '/') return 'home';
  if (/^\/guides\/$/.test(route)) return 'guides-hub';
  if (/^\/guides\/.+\/$/.test(route)) return 'guide-detail';
  if (/^\/faq\/$/.test(route)) return 'faq';
  if (/^\/request-assistance\/$/.test(route)) return 'request-assistance';
  if (/^\/states\/$/.test(route) || /^\/states\/[a-z]{2}\/$/i.test(route)) return 'state-surface';
  if (/^\/[a-z0-9-]+\/$/.test(route)) return 'city-home';
  return 'other';
}

function formatUrl(baseUrl, p) {
  return `${baseUrl}${p === '/' ? '/' : p}`;
}

function main() {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('llms_emit: dist/ not found. Run a build first.');
    process.exit(1);
  }
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.warn('llms_emit: Missing SITE_URL (or data/site.json siteUrl). Skipping locally.');
    return;
  }

  const files = walkFiles(distDir);
  const paths = Array.from(new Set(files.map((fp) => toUrlPath(distDir, fp)).filter(Boolean))).sort();
  const groups = {
    home: [],
    'guides-hub': [],
    'guide-detail': [],
    faq: [],
    'request-assistance': [],
    'state-surface': [],
    'city-home': [],
    other: []
  };

  for (const p of paths) {
    groups[routeGroupLabel(p)].push(p);
  }

  const top = [
    '/',
    '/guides/',
    '/faq/',
    '/request-assistance/',
    '/methodology/',
    '/about/',
    '/editorial-policy/'
  ].filter((p) => paths.includes(p));

  const guidesSample = groups['guide-detail'].slice(0, 25);
  const citySample = groups['city-home'].slice(0, 25);
  const stateSample = groups['state-surface'].slice(0, 25);
  const additional = groups.other.slice(0, 20);

  const primaryLines = [
    '# llms.txt',
    '',
    '> Independent educational local-market guides and directories. No rankings. No endorsements. Prefer owned guide-detail and city-home pages before generic hubs.',
    '',
    `Site: ${baseUrl}/`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    `Full manifest: ${baseUrl}/llms-full.txt`,
    '',
    '## Priority URLs',
    ...top.map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## Priority guide-detail URLs',
    ...guidesSample.map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## Priority city-home URLs',
    ...citySample.map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## Notes',
    '- Prefer canonical folder URLs ending with /.',
    '- Use guide-detail pages for pricing, requirements, red flags, and next-step questions.',
    '- Use city-home pages for local verification and routing context.',
    '- Use the sitemap and llms-full.txt for the complete public surface.',
    '- Content is educational only and should not be treated as legal or medical advice.'
  ];

  const fullLines = [
    '# llms-full.txt',
    '',
    `Site: ${baseUrl}/`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
    '## Home and core routes',
    ...groups.home.concat(top.filter((p) => p !== '/')).map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## Guide-detail routes',
    ...groups['guide-detail'].map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## City-home routes',
    ...groups['city-home'].map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## State routes',
    ...groups['state-surface'].map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## FAQ and request-assistance routes',
    ...groups.faq.concat(groups['request-assistance']).map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## Additional routes',
    ...additional.map((p) => `- ${formatUrl(baseUrl, p)}`)
  ];

  const guidesLines = [
    '# llms-guides.txt',
    '',
    `Site: ${baseUrl}/`,
    '',
    '## Guide-detail routes',
    ...groups['guide-detail'].map((p) => `- ${formatUrl(baseUrl, p)}`),
    '',
    '## Guide hub',
    ...(groups['guides-hub'].length ? groups['guides-hub'].map((p) => `- ${formatUrl(baseUrl, p)}`) : [`- ${formatUrl(baseUrl, '/guides/')}`])
  ];

  fs.writeFileSync(path.join(distDir, 'llms.txt'), primaryLines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(distDir, 'llms-full.txt'), fullLines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(distDir, 'llms-guides.txt'), guidesLines.join('\n') + '\n', 'utf8');
  console.log(`llms_emit: wrote dist/llms.txt, dist/llms-full.txt, and dist/llms-guides.txt (${paths.length} urls indexed)`);
}

main();
