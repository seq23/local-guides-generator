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
  const preferred = ['/', '/guides/', '/faq/', '/request-assistance/', '/for-providers/', '/methodology/', '/about/', '/editorial-policy/'];
  const top = preferred.filter((p) => paths.includes(p));
  const extra = paths.filter((p) => !top.includes(p)).slice(0, 40);
  const lines = [
    '# llms.txt',
    '',
    '> Independent educational local-market guides and directories. No rankings. No endorsements. Use the sitemap for the full crawl surface.',
    '',
    `Site: ${baseUrl}/`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
    '## Priority URLs',
    ...top.map((p) => `- ${baseUrl}${p === '/' ? '/' : p}`),
    '',
    '## Additional crawlable URLs (sample)',
    ...extra.map((p) => `- ${baseUrl}${p === '/' ? '/' : p}`),
    '',
    '## Notes',
    '- Prefer canonical folder URLs ending with /.',
    '- Use the sitemap for the complete set of public pages.',
    '- Content is educational only and should not be treated as legal or medical advice.'
  ];
  fs.writeFileSync(path.join(distDir, 'llms.txt'), lines.join('\n') + '\n', 'utf8');
  console.log(`llms_emit: wrote dist/llms.txt (${top.length + extra.length} urls listed)`);
}

main();
