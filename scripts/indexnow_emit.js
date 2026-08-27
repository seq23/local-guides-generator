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

// Ordered crawl-policy agent list, shared verbatim with the rest of the
// portfolio (local-guides-citation-velocity/robots.txt). Keep the order and
// the membership identical across repos — portfolio consistency is the point.
const CITATION_POLICY_AGENTS = [
  'Googlebot',
  'Bingbot',
  'DuckDuckBot',
  'OAI-SearchBot',
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'DuckAssistBot',
  'Amazonbot',
  'CCBot',
  'meta-externalagent',
  'Bytespider',
  'cohere-ai',
  'CloudflareBrowserRenderingCrawler',
];

const CITATION_POLICY_HEADER = [
  '# Citation-first crawl policy.',
  '# Search engines and AI answer engines are explicitly welcome on this site.',
  '# The per-agent Allow groups below are deliberate: they override any',
  '# prepended blanket Disallow (e.g. Cloudflare managed robots.txt) for the',
  '# same agent, because merged same-name groups resolve equal-length',
  '# Allow/Disallow conflicts in favour of Allow.',
].join('\n');

function buildCrawlPolicyBlock() {
  const groups = [...CITATION_POLICY_AGENTS, '*']
    .map((agent) => `User-agent: ${agent}\nAllow: /`)
    .join('\n\n');
  return `${CITATION_POLICY_HEADER}\n\n${groups}\n`;
}

function ensureRobotsSitemap(distDir, host) {
  const robotsPath = path.join(distDir, 'robots.txt');
  let robots = '';
  if (fs.existsSync(robotsPath)) robots = fs.readFileSync(robotsPath, 'utf8');
  if (!host) return;
  // The Sitemap lines stay derived from the resolved per-vertical host. This
  // one emitter serves five Pages projects; a hardcoded host would point four
  // of them at the wrong sitemap.
  const requiredLines = [
    `Sitemap: https://${host}/sitemap.xml`,
    `Sitemap: https://${host}/sitemap-fresh.xml`
  ];
  const existing = new Set(String(robots || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  let changed = false;
  // Nothing else in the build writes robots.txt, so on a clean dist this
  // function produced a file containing two Sitemap lines and no group at all.
  // That is what uscisexam.com has been serving. A group-less robots.txt is
  // not a block — under RFC 9309 a crawler that matches no group is
  // unrestricted — but it states no policy, and it makes this the one property
  // in the programme that never says yes to a crawler.
  //
  // Emit an explicit Allow group per named agent, then the `User-agent: *`
  // catch-all, ahead of the Sitemap lines. The named groups matter because
  // Cloudflare's zone-level managed robots.txt prepends a blanket
  // `Disallow: /` for exactly these AI agents; RFC 9309 merges same-named
  // groups and resolves an equal-length Allow/Disallow conflict in favour of
  // Allow, so the explicit Allow wins.
  //
  // The `User-agent:` probe is the idempotency guard: re-running against a
  // robots.txt that already declares any group is a no-op, so the block is
  // never duplicated.
  if (!/^\s*User-agent\s*:/im.test(robots)) {
    robots = buildCrawlPolicyBlock() + (robots ? '\n' + robots.trimStart() : '');
    for (const agent of [...CITATION_POLICY_AGENTS, '*']) existing.add(`User-agent: ${agent}`);
    existing.add('Allow: /');
    changed = true;
  }
  const missingSitemaps = requiredLines.filter((line) => !existing.has(line));
  if (missingSitemaps.length) {
    robots = (robots ? robots.trimEnd() + '\n\n' : '') + missingSitemaps.join('\n') + '\n';
    for (const line of missingSitemaps) existing.add(line);
    changed = true;
  }
  if (changed) fs.writeFileSync(robotsPath, robots, 'utf8');
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
