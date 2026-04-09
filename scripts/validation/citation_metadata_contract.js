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
  if (route === '/guides/') return 'guides-hub';
  if (/^\/guides\/.+\/$/.test(route)) return 'guide-detail';
  if (/^\/states\/[a-z]{2}\/$/i.test(route)) return 'state-home';
  if (/^\/[a-z0-9-]+\/$/.test(route) && !['/faq/', '/about/', '/contact/', '/methodology/', '/editorial-policy/', '/privacy/', '/disclaimer/', '/for-providers/', '/request-assistance/', '/next-steps/', '/personal-injury/', '/states/', '/verification/'].includes(route)) return 'city-home';
  return 'other';
}

function requireIncludes(html, rel, failures, snippets) {
  for (const snippet of snippets) {
    if (!html.includes(snippet)) failures.push(`${rel}: missing ${snippet}`);
  }
}

function run() {
  const distDir = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distDir)) return;

  const files = [];
  walk(distDir, files);
  const failures = [];
  let checked = 0;

  for (const file of files) {
    const rel = path.relative(distDir, file).replace(/\\/g, '/');
    const type = classify(rel);
    if (!['home', 'guides-hub', 'guide-detail', 'city-home', 'state-home'].includes(type)) continue;
    checked += 1;
    const html = fs.readFileSync(file, 'utf8');

    requireIncludes(html, rel, failures, [
      '<meta property="og:title"',
      '<meta property="og:description"',
      '<meta property="og:url"',
      '<meta name="twitter:card" content="summary"',
      '<meta name="citation_title"',
      '<meta name="citation_public_url"',
      '<meta name="citation_author"',
      '<meta name="citation_publisher"',
      '<meta name="citation_publication_date"',
      '<meta name="citation_modified_date"',
      '<meta name="citation_section"',
      '<meta name="citation_keywords"',
      `<meta name="page-family" content="${type}"`
    ]);

    if (type === 'guide-detail') {
      requireIncludes(html, rel, failures, [
        '<meta property="og:type" content="article"',
        '<meta property="article:published_time"',
        '<meta property="article:modified_time"',
        '"@type": "Article"'
      ]);
    } else {
      requireIncludes(html, rel, failures, [
        '<meta property="og:type" content="website"'
      ]);
    }
  }

  if (checked === 0) failures.push('No eligible pages found for citation metadata contract');

  if (failures.length) {
    throw new Error('CITATION METADATA CONTRACT FAIL\n' + failures.join('\n'));
  }

  console.log(`✓ citation metadata contract ok (${checked} pages checked)`);
}

module.exports = { run };
