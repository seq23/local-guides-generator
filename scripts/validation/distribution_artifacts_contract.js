#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`DISTRIBUTION ARTIFACTS FAIL: ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function lines(text) {
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function readSite(root) { try { return JSON.parse(fs.readFileSync(path.join(root, 'data', 'site.json'), 'utf8')); } catch { return {}; } }

function run() {
  const root = path.join(__dirname, '..', '..');
  const site = readSite(root);
  const isPi = /(^|\/)pi_v1\.json$/i.test(String(site.pageSetFile || ''));
  const dist = path.join(root, 'dist');
  const required = [
    'indexnow-batch.txt',
    'indexnow-priority.txt',
    'distribution-priority-urls.txt',
    'distribution-checklist.txt',
    'distribution-readme.txt',
    'indexnow.json',
    'bing-submission.json',
    'search-console-notes.json',
    'citation-manifest.json',
  ];
  for (const rel of required) {
    if (!fs.existsSync(path.join(dist, rel))) fail(`missing dist/${rel}`);
  }

  const manifest = readJson(path.join(dist, 'citation-manifest.json'));
  const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
  if (!pages.length) fail('citation-manifest.json has no pages[]');

  const priorityUrls = lines(readText(path.join(dist, 'indexnow-priority.txt'))).filter((l) => /^https?:\/\//i.test(l));
  const batchUrls = lines(readText(path.join(dist, 'indexnow-batch.txt'))).filter((l) => /^https?:\/\//i.test(l));
  if (!priorityUrls.length) fail('indexnow-priority.txt has no URLs');
  if (!batchUrls.length) fail('indexnow-batch.txt has no URLs');

  const requiredFamilies = new Set(isPi ? ['home', 'guides-hub', 'guide-detail', 'state-home'] : ['home', 'guides-hub', 'guide-detail', 'city-home']);
  const familyMap = new Map();
  for (const p of pages) {
    if (p && p.url) familyMap.set(String(p.url), String(p.pageFamily || ''));
  }

  for (const fam of requiredFamilies) {
    const found = priorityUrls.some((url) => familyMap.get(url) === fam);
    if (!found) fail(`indexnow-priority.txt missing required family: ${fam}`);
  }

  const changedCount = batchUrls.filter((url) => familyMap.has(url)).length;
  if (changedCount < Math.min(10, pages.length)) fail('indexnow-batch.txt is too small relative to manifest coverage');

  const priorityReview = readText(path.join(dist, 'distribution-priority-urls.txt'));
  if (!/Family:\s*guide-detail/i.test(priorityReview)) fail('distribution-priority-urls.txt missing guide-detail review block');
  if (isPi) {
    if (!/Family:\s*state-home/i.test(priorityReview)) fail('distribution-priority-urls.txt missing state-home review block');
  } else if (!/Family:\s*city-home/i.test(priorityReview)) fail('distribution-priority-urls.txt missing city-home review block');

  const checklist = readText(path.join(dist, 'distribution-checklist.txt'));
  if (!/indexnow-priority\.txt/i.test(checklist) || !/sitemap-fresh\.xml/i.test(checklist)) {
    fail('distribution-checklist.txt missing required submission instructions');
  }

  const idx = readJson(path.join(dist, 'indexnow.json'));
  if (!Array.isArray(idx.urlList) || !idx.urlList.length) fail('indexnow.json missing urlList');

  const bing = readJson(path.join(dist, 'bing-submission.json'));
  if (!Array.isArray(bing.priorityUrls) || !bing.priorityUrls.length) fail('bing-submission.json missing priorityUrls');

  const search = readJson(path.join(dist, 'search-console-notes.json'));
  if (!Array.isArray(search.reinspect) || !search.reinspect.length) fail('search-console-notes.json missing reinspect URLs');

  console.log('✅ distribution_artifacts_contract passed');
}

if (require.main === module) run();
module.exports = { run };
