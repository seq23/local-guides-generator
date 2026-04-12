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

function classify(rel) {
  const route = rel === 'index.html' ? '/' : `/${rel.slice(0, -'/index.html'.length)}/`;
  if (route === '/') return 'home';
  if (/^\/guides\/.+\/$/.test(route) && route !== '/guides/') return 'guide-detail';
  if (/^\/[a-z0-9-]+\/$/.test(route) && !['/guides/', '/faq/', '/about/', '/contact/', '/methodology/', '/editorial-policy/', '/privacy/', '/disclaimer/', '/for-providers/', '/request-assistance/', '/next-steps/', '/personal-injury/', '/states/', '/verification/'].includes(route)) return 'city-home';
  if (route === '/guides/') return 'guides-hub';
  return 'other';
}

function readSite(repoRoot) { try { return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'site.json'), 'utf8')); } catch { return {}; } }

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const site = readSite(repoRoot);
  const isPi = /(^|\/)pi_v1\.json$/i.test(String(site.pageSetFile || ''));
  const distDir = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distDir)) return;

  const failures = [];
  const files = [];
  walk(distDir, files);

  let guideCount = 0;
  let cityCount = 0;
  let guidesHubChecked = false;

  for (const file of files) {
    const rel = path.relative(distDir, file).replace(/\\/g, '/');
    const type = classify(rel);
    const html = fs.readFileSync(file, 'utf8');

    if (type === 'guide-detail') {
      guideCount += 1;
      if (!html.includes('data-citation-summary="true"')) failures.push(`${rel}: missing citation summary block`);
      if (!html.includes('data-citation-summary-type="guide-detail"')) failures.push(`${rel}: missing guide-detail citation summary type`);
      if (!html.includes('data-citation-key-points="true"')) failures.push(`${rel}: missing citation key points list`);
      if (!html.includes('data-citation-routing-links="true"')) failures.push(`${rel}: missing citation routing links`);
    }

    if (type === 'city-home') {
      cityCount += 1;
      if (!html.includes('data-citation-summary="true"')) failures.push(`${rel}: missing citation summary block`);
      if (!html.includes('data-citation-summary-type="city-home"')) failures.push(`${rel}: missing city-home citation summary type`);
      if (!html.includes('data-citation-key-points="true"')) failures.push(`${rel}: missing citation key points list`);
      if (!html.includes('data-citation-routing-links="true"')) failures.push(`${rel}: missing citation routing links`);
    }

    if (type === 'guides-hub') {
      guidesHubChecked = true;
      if (!html.includes('data-citation-summary-type="guides-hub"')) failures.push(`${rel}: missing guides-hub citation summary`);
    }
  }

  for (const required of ['llms.txt', 'llms-full.txt', 'llms-guides.txt']) {
    const p = path.join(distDir, required);
    if (!fs.existsSync(p)) {
      failures.push(`${required}: missing`);
      continue;
    }
    const text = fs.readFileSync(p, 'utf8');
    if (!String(text).includes('Site: ')) failures.push(`${required}: missing Site line`);
  }

  const primary = path.join(distDir, 'llms.txt');
  if (fs.existsSync(primary)) {
    const text = fs.readFileSync(primary, 'utf8');
    if (!text.includes('Priority guide-detail URLs')) failures.push('llms.txt: missing Priority guide-detail URLs section');
    if (!text.includes('Priority city-home URLs')) failures.push('llms.txt: missing Priority city-home URLs section');
    if (!text.includes('Full manifest:')) failures.push('llms.txt: missing Full manifest line');
  }

  if (guideCount === 0) failures.push('No guide-detail pages found in dist for extractability contract');
  if (cityCount === 0 && !isPi) failures.push('No city-home pages found in dist for extractability contract');
  if (!guidesHubChecked) failures.push('No guides hub found in dist for extractability contract');

  if (failures.length) {
    throw new Error('CITATION EXTRACTABILITY CONTRACT FAIL\n' + failures.join('\n'));
  }

  console.log(`✓ citation extractability contract ok (${guideCount} guides, ${cityCount} city pages)`);
}

module.exports = { run };
