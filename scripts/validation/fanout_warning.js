const fs = require('fs');
const path = require('path');

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
    console.warn('⚠️ FANOUT WARNING: dist/ is missing; could not inspect fan-out query clusters.');
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
  const warnings = [];
  if (!fs.existsSync(exportPath)) warnings.push('missing dist/_fanout_query_clusters.json export artifact');
  warnings.push(...missing.map((fp) => `missing fan-out query cluster block: ${path.relative(repoRoot, fp).replace(/\\/g, '/')}`));

  if (warnings.length) {
    console.warn('⚠️ FANOUT WARNING: fan-out coverage is incomplete.');
    warnings.forEach((msg) => console.warn(`   - ${msg}`));
  } else {
    console.log('ℹ️ FANOUT WARNING CHECK: all required fan-out surfaces are present.');
  }
}

module.exports = { run };
