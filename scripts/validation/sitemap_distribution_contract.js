const fs = require('fs');
const path = require('path');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function countMatches(text, pattern) {
  const m = text.match(pattern);
  return m ? m.length : 0;
}

function walkIndexFiles(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkIndexFiles(full, acc);
    else if (st.isFile() && name.toLowerCase() === 'index.html') acc.push(full);
  }
}

function run() {
  const distDir = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distDir)) return;

  const failures = [];
  const required = [
    'sitemap.xml',
    'sitemap-guides.xml',
    'sitemap-cities.xml',
    'sitemap-states.xml',
    'sitemap-core.xml',
    'sitemap-fresh.xml'
  ];

  for (const name of required) {
    if (!fs.existsSync(path.join(distDir, name))) failures.push(`${name}: missing`);
  }
  if (failures.length) throw new Error('SITEMAP DISTRIBUTION CONTRACT FAIL\n' + failures.join('\n'));

  const indexXml = read(path.join(distDir, 'sitemap.xml'));
  for (const name of required.filter((n) => n !== 'sitemap.xml')) {
    if (!indexXml.includes(`/${name}`)) failures.push(`sitemap.xml: missing ${name} entry`);
  }

  const guidesXml = read(path.join(distDir, 'sitemap-guides.xml'));
  const citiesXml = read(path.join(distDir, 'sitemap-cities.xml'));
  const statesXml = read(path.join(distDir, 'sitemap-states.xml'));
  const coreXml = read(path.join(distDir, 'sitemap-core.xml'));
  const freshXml = read(path.join(distDir, 'sitemap-fresh.xml'));

  const htmlFiles = [];
  walkIndexFiles(distDir, htmlFiles);
  const hasStatePages = htmlFiles.some((p) => read(p).includes('content="pi-state"') || read(p).includes('content="state-surface"'));

  if (!guidesXml.includes('/guides/')) failures.push('sitemap-guides.xml: missing /guides/ family entries');
  if (countMatches(guidesXml, /<url>/g) < 3) failures.push('sitemap-guides.xml: too few guide urls');

  if (countMatches(citiesXml, /<url>/g) < 1) failures.push('sitemap-cities.xml: no city urls');
  if (!citiesXml.includes('<changefreq>weekly</changefreq>') && !citiesXml.includes('<changefreq>daily</changefreq>')) failures.push('sitemap-cities.xml: missing expected changefreq');

  if (hasStatePages && countMatches(statesXml, /<url>/g) < 1) failures.push('sitemap-states.xml: no state urls');
  if (!coreXml.includes('<loc>') || (!coreXml.includes('<loc>https://') && !coreXml.includes('<loc>http://'))) failures.push('sitemap-core.xml: missing core routing surfaces');
  if (!coreXml.includes('/request-assistance/') && !coreXml.includes('/faq/') && !coreXml.includes('/about/')) failures.push('sitemap-core.xml: missing expected core utility pages');

  if (countMatches(freshXml, /<url>/g) < 1) failures.push('sitemap-fresh.xml: empty');
  if (!freshXml.includes('/guides/') && !freshXml.includes('/')) failures.push('sitemap-fresh.xml: missing priority or core urls');

  if (!indexXml.includes('<sitemapindex')) failures.push('sitemap.xml: not a sitemap index');

  if (failures.length) {
    throw new Error('SITEMAP DISTRIBUTION CONTRACT FAIL\n' + failures.join('\n'));
  }

  console.log('✓ sitemap distribution contract ok');
}

module.exports = { run };
