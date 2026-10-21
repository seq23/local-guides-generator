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

  // Each URL is listed in exactly one sub-sitemap (Ahrefs, 14 Oct 2026: 39
  // theaccidentguides URLs "in multiple sitemaps", all repeated by
  // sitemap-fresh.xml). A fresh URL leaves its bucket while it is fresh, so the
  // family checks below read bucket + fresh together.
  const subs = { 'sitemap-guides.xml': guidesXml, 'sitemap-cities.xml': citiesXml, 'sitemap-states.xml': statesXml, 'sitemap-core.xml': coreXml, 'sitemap-fresh.xml': freshXml };
  const listedIn = new Map();
  for (const [name, xml] of Object.entries(subs)) {
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const u = m[1];
      if (!listedIn.has(u)) listedIn.set(u, []);
      listedIn.get(u).push(name);
    }
  }
  if (listedIn.size === 0) failures.push('sub-sitemaps list zero URLs: the one-sitemap-per-URL check examined nothing');
  const multi = [...listedIn.entries()].filter(([, names]) => names.length > 1);
  if (multi.length) {
    failures.push(`${multi.length} URL(s) listed in more than one sitemap:\n` + multi.slice(0, 20).map(([u, n]) => `  ${u}  <- ${n.join(', ')}`).join('\n'));
  }
  const freshUrls = (re) => (freshXml.match(re) || []);
  const guideUrlCount = countMatches(guidesXml, /<url>/g) + freshUrls(/<loc>[^<]*\/guides\/[^<]+\/<\/loc>/g).length;

  if (!guidesXml.includes('/guides/') && !freshXml.includes('/guides/')) failures.push('sitemap-guides.xml + sitemap-fresh.xml: missing /guides/ family entries');
  if (guideUrlCount < 3) failures.push('sitemap-guides.xml + sitemap-fresh.xml: too few guide urls');

  const freshCityUrls = freshUrls(/<loc>https?:\/\/[^/<]+\/[a-z0-9-]+-[a-z]{2}\/<\/loc>/g).length;
  if (countMatches(citiesXml, /<url>/g) + freshCityUrls < 1) failures.push('sitemap-cities.xml + sitemap-fresh.xml: no city urls');
  const citiesOrFresh = citiesXml + freshXml;
  if (!citiesOrFresh.includes('<changefreq>weekly</changefreq>') && !citiesOrFresh.includes('<changefreq>daily</changefreq>')) failures.push('sitemap-cities.xml + sitemap-fresh.xml: missing expected changefreq');

  if (hasStatePages && countMatches(statesXml, /<url>/g) < 1) failures.push('sitemap-states.xml: no state urls');
  if (!coreXml.includes('<loc>') || (!coreXml.includes('<loc>https://') && !coreXml.includes('<loc>http://'))) failures.push('sitemap-core.xml: missing core routing surfaces');
  const coreOrFresh = coreXml + freshXml;
  if (!coreOrFresh.includes('/request-assistance/') && !coreOrFresh.includes('/faq/') && !coreOrFresh.includes('/about/')) failures.push('sitemap-core.xml + sitemap-fresh.xml: missing expected core utility pages');

  if (countMatches(freshXml, /<url>/g) < 1) failures.push('sitemap-fresh.xml: empty');
  if (!freshXml.includes('/guides/') && !freshXml.includes('/')) failures.push('sitemap-fresh.xml: missing priority or core urls');

  if (!indexXml.includes('<sitemapindex')) failures.push('sitemap.xml: not a sitemap index');

  if (failures.length) {
    throw new Error('SITEMAP DISTRIBUTION CONTRACT FAIL\n' + failures.join('\n'));
  }

  console.log('✓ sitemap distribution contract ok');
}

module.exports = { run };
