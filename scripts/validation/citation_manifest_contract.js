const fs = require('fs');
const path = require('path');

function parseJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function sampleHas(arr, pred) {
  return Array.isArray(arr) && arr.some(pred);
}

function checkHtmlContains(distDir, relPath, snippet, failures) {
  const p = path.join(distDir, relPath);
  if (!fs.existsSync(p)) {
    failures.push(`${relPath}: missing html target for citation manifest contract`);
    return;
  }
  const html = fs.readFileSync(p, 'utf8');
  if (!html.includes(snippet)) failures.push(`${relPath}: missing ${snippet}`);
}

function readSite(repoRoot) { try { return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'site.json'), 'utf8')); } catch { return {}; } }

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const site = readSite(repoRoot);
  const isPi = /(^|\/)pi_v1\.json$/i.test(String(site.pageSetFile || ''));
  const distDir = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distDir)) return;

  const failures = [];
  const manifestPath = path.join(distDir, 'citation-manifest.json');
  const priorityPath = path.join(distDir, 'citation-priority.txt');
  const corpusPath = path.join(distDir, 'citation-corpus.jsonl');

  for (const p of [manifestPath, priorityPath, corpusPath]) {
    if (!fs.existsSync(p)) failures.push(`${path.basename(p)}: missing`);
  }
  if (failures.length) throw new Error('CITATION MANIFEST CONTRACT FAIL\n' + failures.join('\n'));

  const manifest = parseJson(manifestPath);
  if (!manifest || !Array.isArray(manifest.pages)) failures.push('citation-manifest.json: pages array missing');
  if (!manifest || !manifest.counts || typeof manifest.counts.total !== 'number') failures.push('citation-manifest.json: counts.total missing');
  const pages = manifest && Array.isArray(manifest.pages) ? manifest.pages : [];
  if (pages.length < 10) failures.push('citation-manifest.json: too few pages indexed');

  const requiredFamilies = isPi ? ['guide-detail', 'guides-hub', 'home', 'state-home'] : ['guide-detail', 'city-home', 'guides-hub', 'home'];
  for (const family of requiredFamilies) {
    if (!sampleHas(pages, (p) => p && p.pageFamily === family)) failures.push(`citation-manifest.json: missing page family ${family}`);
  }

  const requiredFields = ['route', 'url', 'pageFamily', 'title', 'description', 'shortAnswer', 'priority'];
  for (const page of pages.slice(0, 25)) {
    for (const field of requiredFields) {
      if (!(field in page) || page[field] === '' || page[field] == null) failures.push(`citation-manifest.json: page missing ${field}`);
    }
  }

  const priorityText = fs.readFileSync(priorityPath, 'utf8');
  if (!priorityText.includes('# citation-priority.txt')) failures.push('citation-priority.txt: missing header');
  if (!priorityText.includes('Family: guide-detail')) failures.push('citation-priority.txt: missing guide-detail entries');
  if (isPi) {
    if (!priorityText.includes('Family: state-home')) failures.push('citation-priority.txt: missing state-home entries');
  } else {
    if (!priorityText.includes('Family: city-home')) failures.push('citation-priority.txt: missing city-home entries');
  }

  const ndjsonLines = fs.readFileSync(corpusPath, 'utf8').trim().split(/\n+/).filter(Boolean);
  if (ndjsonLines.length < pages.length) failures.push('citation-corpus.jsonl: fewer rows than manifest pages');
  try {
    JSON.parse(ndjsonLines[0]);
  } catch {
    failures.push('citation-corpus.jsonl: first row is not valid JSON');
  }

  checkHtmlContains(distDir, 'index.html', '/citation-manifest.json', failures);
  checkHtmlContains(distDir, 'index.html', '/citation-corpus.jsonl', failures);
  checkHtmlContains(distDir, path.join('guides', 'index.html'), '/citation-manifest.json', failures);

  if (failures.length) {
    throw new Error('CITATION MANIFEST CONTRACT FAIL\n' + failures.join('\n'));
  }

  console.log(`✓ citation manifest contract ok (${pages.length} pages)`);
}

module.exports = { run };
