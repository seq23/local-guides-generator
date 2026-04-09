const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`SITE URL CONTRACT FAIL: ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function scanTextFiles(rootDir, patterns, opts = {}) {
  const hits = [];
  const ignoreDirs = new Set(opts.ignoreDirs || ['node_modules', '.git']);
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.has(entry.name)) continue;
        walk(p);
      } else if (entry.isFile()) {
        const rel = path.relative(process.cwd(), p);
        const txt = fs.readFileSync(p, 'utf8');
        for (const rx of patterns) {
          if (rx.test(txt)) {
            hits.push(rel);
            break;
          }
        }
      }
    }
  }
  if (fs.existsSync(rootDir)) walk(rootDir);
  return hits;
}

function run() {
  const repoRoot = process.cwd();
  const sitePath = path.join(repoRoot, 'data', 'site.json');
  if (!fs.existsSync(sitePath)) fail('Missing data/site.json');
  const site = readJson(sitePath);
  const siteUrl = String(site.siteUrl || '').trim();
  if (!siteUrl) fail('data/site.json siteUrl is empty');
  if (/placeholder-domain\.invalid/i.test(siteUrl)) fail(`data/site.json uses forbidden placeholder domain: ${siteUrl}`);
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(siteUrl)) fail(`data/site.json siteUrl must be a clean https origin: ${siteUrl}`);

  const templatePath = path.join(repoRoot, 'data', 'site.template.json');
  if (!fs.existsSync(templatePath)) fail('Missing data/site.template.json');
  const template = fs.readFileSync(templatePath, 'utf8');
  if (/%%SITE_URL%%/.test(template)) fail('data/site.template.json still uses forbidden %%SITE_URL%% placeholder token');
  if (!/%%CANONICAL_SITE_URL%%/.test(template)) fail('data/site.template.json missing %%CANONICAL_SITE_URL%% token');

  const placeholderPatterns = [
    /placeholder-domain\.invalid/i,
    /%%SITE_URL%%/,
    /siteURL\s*[:=]\s*["']?%%/i,
    /siteUrl\s*[:=]\s*["']?%%SITE_URL%%/i,
  ];

  const distDir = path.join(repoRoot, 'dist');
  if (fs.existsSync(distDir)) {
    const distHits = scanTextFiles(distDir, placeholderPatterns);
    if (distHits.length) fail(`dist contains forbidden site URL placeholders: ${distHits.slice(0, 10).join(', ')}`);
  }

  const workflowDirs = [
    path.join(repoRoot, '.github', 'workflows'),
    path.join(repoRoot, 'scripts', 'automation'),
  ];
  const workflowHits = workflowDirs.flatMap((dir) => scanTextFiles(dir, placeholderPatterns));
  if (workflowHits.length) fail(`workflow-critical files contain forbidden site URL placeholders: ${workflowHits.slice(0, 10).join(', ')}`);

  console.log('✅ SITE URL CONTRACT PASS');
}

module.exports = { run };
