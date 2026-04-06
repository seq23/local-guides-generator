#!/usr/bin/env node
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
  if (/^\/states\/[a-z]{2}\/$/i.test(route)) return 'state-home';
  if (/^\/[a-z0-9-]+\/$/.test(route) && !['/guides/', '/faq/', '/about/', '/contact/', '/methodology/', '/editorial-policy/', '/privacy/', '/disclaimer/', '/for-providers/', '/request-assistance/', '/next-steps/', '/personal-injury/', '/states/'].includes(route)) return 'city-home';
  return 'other';
}

function extractBlock(html, attr) {
  const rx = new RegExp(`<section class="section [^"]*"[^>]*${attr}="true"[\\s\\S]*?<\\/section>`, 'i');
  const m = String(html || '').match(rx);
  return m ? m[0] : '';
}

function hrefs(html) {
  return Array.from(String(html || '').matchAll(/href="([^"]+)"/g)).map((m) => m[1]);
}

function countMatching(list, re) {
  return list.filter((href) => re.test(href)).length;
}

function run() {
  const distDir = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distDir)) return;
  const files = [];
  walk(distDir, files);
  const failures = [];
  let checked = { home: 0, guides: 0, city: 0, state: 0 };

  for (const file of files) {
    const rel = path.relative(distDir, file).replace(/\\/g, '/');
    const type = classify(rel);
    if (!['home', 'guides-hub', 'city-home', 'state-home'].includes(type)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const priority = extractBlock(html, 'data-distribution-priority-block');
    const fresh = extractBlock(html, 'data-distribution-fresh-block');
    if (!priority) failures.push(`${rel}: missing distribution priority block`);
    if (!fresh) failures.push(`${rel}: missing distribution fresh block`);
    const priorityHrefs = hrefs(priority);
    const freshHrefs = hrefs(fresh);
    if (priorityHrefs.length < 3) failures.push(`${rel}: distribution priority block too sparse`);
    if (freshHrefs.length < 2) failures.push(`${rel}: distribution fresh block too sparse`);

    if (type === 'home') {
      checked.home += 1;
      if (!priorityHrefs.includes('/guides/')) failures.push(`${rel}: home priority block missing /guides/`);
      if (countMatching(priorityHrefs, /^\/guides\/[^/]+\/$/) < 2) failures.push(`${rel}: home priority block missing guide-detail links`);
    }
    if (type === 'guides-hub') {
      checked.guides += 1;
      if (countMatching(priorityHrefs, /^\/guides\/[^/]+\/$/) < 4) failures.push(`${rel}: guides hub priority block missing enough guide-detail links`);
    }
    if (type === 'city-home') {
      checked.city += 1;
      if (!priorityHrefs.includes('/guides/')) failures.push(`${rel}: city priority block missing /guides/`);
      if (!priorityHrefs.includes('/request-assistance/')) failures.push(`${rel}: city priority block missing /request-assistance/`);
      if (countMatching(priorityHrefs, /^\/guides\/[^/]+\/$/) < 2) failures.push(`${rel}: city priority block missing guide-detail links`);
    }
    if (type === 'state-home') {
      checked.state += 1;
      if (!priorityHrefs.includes('/guides/')) failures.push(`${rel}: state priority block missing /guides/`);
      if (countMatching(priorityHrefs, /^\/[a-z0-9-]+\/$/) < 1 && countMatching(freshHrefs, /^\/[a-z0-9-]+\/$/) < 1) failures.push(`${rel}: state distribution blocks missing city links`);
    }
  }

  if (!checked.home) failures.push('internal distribution: no home page checked');
  if (!checked.guides) failures.push('internal distribution: no guides hub checked');
  if (!checked.city) failures.push('internal distribution: no city home pages checked');

  if (failures.length) throw new Error('INTERNAL DISTRIBUTION CONTRACT FAIL\n' + failures.join('\n'));
  console.log(`✓ internal distribution contract ok (${checked.home} home, ${checked.guides} guides hubs, ${checked.city} city homes, ${checked.state} state pages)`);
}

if (require.main === module) run();
module.exports = { run };
