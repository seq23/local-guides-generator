#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const dataDir = path.join(repoRoot, 'data');

function fail(msg) {
  console.error(`LKG SNAPSHOT FAILED: ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (predicate(p)) out.push(p);
    }
  }
  return out;
}

function rel(p) {
  return p.replace(repoRoot + path.sep, '').replaceAll('\\', '/');
}

function resolvePageSetPath(pageSetFile) {
  const direct = path.join(dataDir, 'page_sets', pageSetFile);
  if (fs.existsSync(direct)) return direct;

  // Allow passing "examples/<file>.json" or bare file name.
  const normalized = pageSetFile.replace(/^\.\//, '');
  const ex1 = path.join(dataDir, 'page_sets', normalized);
  if (fs.existsSync(ex1)) return ex1;

  const ex2 = path.join(dataDir, 'page_sets', 'examples', pageSetFile);
  if (fs.existsSync(ex2)) return ex2;

  fail(`Could not resolve pageSetFile "${pageSetFile}" under data/page_sets/`);
  return null;
}

function main() {
  const siteJsonPath = path.join(dataDir, 'site.json');
  if (!fs.existsSync(siteJsonPath)) fail('Missing data/site.json');

  const site = readJson(siteJsonPath);
  const pageSetFile = site.pageSetFile;
  if (!pageSetFile) fail('data/site.json is missing pageSetFile');

  const pageSetPath = resolvePageSetPath(pageSetFile);
  const pageSet = readJson(pageSetPath);

  if (!fs.existsSync(distDir)) fail('dist/ does not exist. Run build first.');

  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'))
    .map(rel)
    .sort();

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
      pageSetFile: pageSetFile
    },
    pack: {
      educationOnly: !!pageSet.educationOnly,
      sponsorship: pageSet.sponsorship || {},
      cityFeatures: pageSet.cityFeatures || null
    },
    counts,
    nextStepsSample: nextStepsPages.slice(0, 10),
    routesSample: routes.slice(0, 25)
  };

  const outPath = path.join(distDir, '_lkg_snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  // Also write a copy at repo root for CI convenience.
  fs.writeFileSync(path.join(repoRoot, '_lkg_snapshot.json'), JSON.stringify(snapshot, null, 2));

  console.log(`OK: Wrote LKG snapshot: ${rel(outPath)}`);
}

main();
