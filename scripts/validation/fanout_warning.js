const fs = require('fs');
const path = require('path');

const WARN_THRESHOLD = 20;
const FAIL_THRESHOLD = 50;

function collectFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(fp, results);
    else if (entry.isFile() && entry.name.toLowerCase() === 'index.html') results.push(fp);
  }
  return results;
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const distDir = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distDir)) {
    console.log('ℹ️ FANOUT CHECK: dist/ is missing; could not inspect fan-out query clusters.');
    return;
  }

  const required = [];
  const addIfExists = (rel) => {
    const fp = path.join(distDir, rel);
    if (fs.existsSync(fp)) required.push(fp);
  };

  addIfExists('index.html');
  addIfExists(path.join('faq', 'index.html'));
  addIfExists(path.join('guides', 'index.html'));
  addIfExists(path.join('personal-injury', 'index.html'));

  const allIndexFiles = collectFiles(distDir);
  for (const fp of allIndexFiles) {
    const rel = path.relative(distDir, fp).replace(/\\/g, '/');
    if (/^(assets|functions)\//.test(rel)) continue;
    if (rel.startsWith('guides/') && rel !== 'guides/index.html') required.push(fp);
    if (rel.startsWith('states/') && /\/index\.html$/.test(rel) && rel.split('/').length === 3) required.push(fp);
    if (/^[a-z0-9-]+\/index\.html$/i.test(rel) && !['faq/index.html', 'guides/index.html', 'request-assistance/index.html', 'for-providers/index.html', 'methodology/index.html', 'about/index.html', 'contact/index.html', 'privacy/index.html', 'disclaimer/index.html', 'editorial-policy/index.html'].includes(rel)) {
      required.push(fp);
    }
    if (/^[a-z0-9-]+\/[a-z0-9-]+\/index\.html$/i.test(rel) && !rel.startsWith('states/')) {
      required.push(fp);
    }
  }

  const deduped = Array.from(new Set(required));
  const missing = deduped.filter((fp) => !fs.readFileSync(fp, 'utf8').includes('data-fanout-query-cluster="true"'));
  const exportPath = path.join(distDir, '_fanout_query_clusters.json');
  const issues = [];
  if (!fs.existsSync(exportPath)) issues.push('missing dist/_fanout_query_clusters.json export artifact');
  issues.push(...missing.map((fp) => `missing fan-out query cluster block: ${path.relative(repoRoot, fp).replace(/\\/g, '/')}`));

  const issueCount = issues.length;
  if (issueCount >= FAIL_THRESHOLD) {
    console.error(`FANOUT CONTRACT FAIL: fan-out issues ${issueCount} (threshold ${FAIL_THRESHOLD})`);
    issues.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }

  if (issueCount >= WARN_THRESHOLD) {
    console.warn(`⚠️ FANOUT CONTRACT: fan-out issues ${issueCount} (warning threshold ${WARN_THRESHOLD})`);
    issues.forEach((msg) => console.warn(`   - ${msg}`));
    return;
  }

  if (issueCount > 0) {
    console.log(`ℹ️ FANOUT CHECK: minor fan-out issues ${issueCount} below warning threshold ${WARN_THRESHOLD}.`);
    issues.forEach((msg) => console.log(`   - ${msg}`));
    return;
  }

  console.log('ℹ️ FANOUT CHECK: all required fan-out surfaces are present.');
}

module.exports = { run };
