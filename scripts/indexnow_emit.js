#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getIndexNowConfig } = require('./lib/indexnow_config');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function familyRank(family) {
  return {
    'home': 6,
    'guides-hub': 5,
    'guide-detail': 4,
    'city-home': 3,
    'state': 2,
    'state-next-steps': 2,
  }[family] || 1;
}

function loadCitationPages(distDir) {
  const manifestPath = path.join(distDir, 'citation-manifest.json');
  const manifest = readJson(manifestPath, {});
  const pages = Array.isArray(manifest.pages) ? manifest.pages.slice() : [];
  return pages.sort((a, b) => {
    const prio = Number(b.priority || 0) - Number(a.priority || 0);
    if (prio !== 0) return prio;
    const fam = familyRank(String(b.pageFamily || '')) - familyRank(String(a.pageFamily || ''));
    if (fam !== 0) return fam;
    return String(a.url || '').localeCompare(String(b.url || ''));
  });
}

function formatUrlBlock(p) {
  const lines = [];
  lines.push(`URL: ${p.url}`);
  lines.push(`Route: ${p.route || '/'}`);
  lines.push(`Family: ${p.pageFamily || 'unknown'}`);
  lines.push(`Priority: ${p.priority ?? ''}`);
  lines.push(`Updated: ${p.updatedAt || ''}`);
  if (p.title) lines.push(`Title: ${p.title}`);
  if (p.shortAnswer) lines.push(`Short answer: ${String(p.shortAnswer).replace(/\s+/g, ' ').trim()}`);
  if (p.routingText) lines.push(`Routing: ${String(p.routingText).replace(/\s+/g, ' ').trim()}`);
  return lines.join('\n');
}

function writeText(p, content) {
  fs.writeFileSync(p, content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf8');
}

function emitDistributionArtifacts(distDir, cfg) {
  const pages = loadCitationPages(distDir);
  if (!pages.length) {
    throw new Error('distribution artifacts require dist/citation-manifest.json with non-empty pages[]');
  }

  const changedPages = pages.filter((p) => !!p.updatedAt).slice(0, 60);
  const featuredFamilies = ['home', 'guides-hub'];
  const featuredPages = featuredFamilies.flatMap((fam) => pages.filter((p) => String(p.pageFamily || '') === fam)).slice(0, 10);
  const priorityPages = uniq([
    ...featuredPages.map((p) => p.url),
    ...pages.filter((p) => ['guide-detail', 'city-home', 'state', 'home', 'guides-hub'].includes(String(p.pageFamily || ''))).slice(0, 80).map((p) => p.url),
  ]).map((url) => pages.find((p) => p.url === url)).filter(Boolean);
  const priorityUrls = uniq(priorityPages.map((p) => p.url));
  const batchUrls = uniq([...changedPages.map((p) => p.url), ...priorityUrls]).slice(0, 120);
  const host = cfg.primaryHost || cfg.siteHost || '';

  writeText(path.join(distDir, 'indexnow-batch.txt'), batchUrls.join('\n'));
  writeText(path.join(distDir, 'indexnow-priority.txt'), priorityUrls.join('\n'));
  writeText(path.join(distDir, 'distribution-priority-urls.txt'), priorityPages.map(formatUrlBlock).join('\n\n'));

  const checklist = [
    '# distribution-checklist.txt',
    '',
    '1. Submit the URLs in indexnow-priority.txt first.',
    '2. Submit the broader batch in indexnow-batch.txt second.',
    '3. Re-submit sitemap.xml and sitemap-fresh.xml in search console / bing webmaster.',
    '4. Reinspect any homepage, guides hub, or guide-detail pages that changed materially.',
    '5. Do not waste time manually submitting low-priority inventory before the files above are processed.',
    '',
    `Primary host: ${host || '(host unavailable)'}`,
    `Priority URL count: ${priorityUrls.length}`,
    `Batch URL count: ${batchUrls.length}`,
  ].join('\n');
  writeText(path.join(distDir, 'distribution-checklist.txt'), checklist);

  const readme = [
    '# distribution-readme.txt',
    '',
    'Purpose: deterministic post-build distribution artifacts for recrawl and submission.',
    '',
    'Files:',
    '- indexnow-priority.txt: submit these first.',
    '- indexnow-batch.txt: broader changed URL batch.',
    '- distribution-priority-urls.txt: owner/VA review file with titles, family, and routing context.',
    '- distribution-checklist.txt: exact submission order.',
    '- indexnow.json / bing-submission.json / search-console-notes.json: machine-readable payload helpers.',
    '',
    'Selection rules:',
    '- Priority favors home, guides hub, guide-detail, city-home, and state surfaces.',
    '- Batch adds recently updated pages on top of priority surfaces.',
    '- Source of truth is citation-manifest.json.',
  ].join('\n');
  writeText(path.join(distDir, 'distribution-readme.txt'), readme);

  const indexnowPayload = {
    host,
    keyLocation: host && cfg.key ? `https://${host}/${cfg.key}.txt` : null,
    urlList: batchUrls,
  };
  fs.writeFileSync(path.join(distDir, 'indexnow.json'), JSON.stringify(indexnowPayload, null, 2));

  const bingPayload = {
    host,
    sitemap: host ? `https://${host}/sitemap.xml` : null,
    freshnessSitemap: host ? `https://${host}/sitemap-fresh.xml` : null,
    priorityUrls,
  };
  fs.writeFileSync(path.join(distDir, 'bing-submission.json'), JSON.stringify(bingPayload, null, 2));

  const searchConsolePayload = {
    site: cfg.siteUrl || (host ? `https://${host}` : null),
    reinspect: priorityUrls.slice(0, 25),
    resubmitSitemaps: [
      host ? `https://${host}/sitemap.xml` : null,
      host ? `https://${host}/sitemap-fresh.xml` : null,
    ].filter(Boolean),
    notes: 'Reinspect highest-priority changed pages first; then submit sitemap.xml and sitemap-fresh.xml.',
  };
  fs.writeFileSync(path.join(distDir, 'search-console-notes.json'), JSON.stringify(searchConsolePayload, null, 2));
}

function ensureRobotsSitemap(distDir, host) {
  const robotsPath = path.join(distDir, 'robots.txt');
  let robots = '';
  if (fs.existsSync(robotsPath)) robots = fs.readFileSync(robotsPath, 'utf8');
  const sitemapLine = host ? `Sitemap: https://${host}/sitemap.xml` : '';
  if (!sitemapLine) return;
  const hasSitemap = robots.toLowerCase().includes('sitemap:');
  if (!hasSitemap) {
    robots = robots ? robots.trimEnd() + '\n' : '';
    robots += sitemapLine + '\n';
    fs.writeFileSync(robotsPath, robots, 'utf8');
  }
}

function main() {
  const cfg = getIndexNowConfig();
  const distDir = path.join(process.cwd(), 'dist');
  ensureDir(distDir);

  const keyText = String(cfg.key || '').trim();
  if (keyText) {
    fs.writeFileSync(path.join(distDir, 'indexnow.txt'), keyText, 'utf8');
    fs.writeFileSync(path.join(distDir, `${keyText}.txt`), keyText, 'utf8');
  }

  ensureRobotsSitemap(distDir, cfg.primaryHost || cfg.siteHost || '');
  emitDistributionArtifacts(distDir, cfg);

  console.log(`Distribution artifacts: wrote IndexNow/submission helper files${keyText ? ' plus key files' : ''}.`);
}

main();
