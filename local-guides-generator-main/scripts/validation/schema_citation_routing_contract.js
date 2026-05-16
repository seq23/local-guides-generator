/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`SCHEMA CITATION ROUTING FAIL: ${msg}`);
  process.exit(1);
}

function extractJsonLdObjects(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch (_) {
      // ignore malformed blocks here; other validators can handle parse discipline
    }
  }
  return out;
}

function piCollectionHasLeakedUrl(obj) {
  if (!obj || obj['@type'] !== 'CollectionPage') return false;
  const about = obj.about || {};
  if ((about.name || '') !== 'Personal injury legal services') return false;
  const list = (((obj.mainEntity || {}).itemListElement) || []);
  for (const entry of list) {
    const item = entry && entry.item;
    if (item && item['@type'] === 'Organization' && item.url) return true;
  }
  return false;
}

function run() {
  const distDir = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distDir)) return;

  const failures = [];
  const requestAssistance = path.join(distDir, 'request-assistance', 'index.html');
  if (fs.existsSync(requestAssistance)) {
    const html = fs.readFileSync(requestAssistance, 'utf8');
    const objs = extractJsonLdObjects(html);
    const hasWebPage = objs.some((o) => o && o['@type'] === 'WebPage');
    const service = objs.find((o) => o && o['@type'] === 'Service' && o.serviceType === 'Local provider routing and request assistance');
    if (!hasWebPage) failures.push('dist/request-assistance/index.html: missing WebPage schema');
    if (!service) failures.push('dist/request-assistance/index.html: missing request-assistance Service schema');
    if (
      service &&
      (!service.availableChannel || !service.availableChannel.serviceUrl || !String(service.availableChannel.serviceUrl).includes('/request-assistance/'))
    ) {
      failures.push('dist/request-assistance/index.html: missing request-assistance serviceUrl');
    }
  }

  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name === 'index.html') files.push(full);
    }
  }
  walk(distDir);

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const objs = extractJsonLdObjects(html);
    if (objs.some(piCollectionHasLeakedUrl)) {
      failures.push(`${path.relative(distDir, file)}: PI organization schema still leaks outbound url`);
    }
  }

  if (failures.length) fail('\n - ' + failures.join('\n - '));
  console.log('✅ schema_citation_routing_contract PASS');
}

module.exports = { run };
