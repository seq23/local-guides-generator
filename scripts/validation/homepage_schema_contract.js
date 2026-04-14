/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`HOMEPAGE SCHEMA FAIL: ${msg}`);
  process.exit(1);
}

function readDistIndex() {
  const fp = path.join(__dirname, '..', '..', 'dist', 'index.html');
  if (!fs.existsSync(fp)) fail('dist/index.html missing');
  return fs.readFileSync(fp, 'utf8');
}

function extractJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch (err) {
      fail(`invalid JSON-LD block in dist/index.html (${err.message})`);
    }
  }
  return out;
}

function flattenTypes(nodes) {
  const types = new Set();
  const stack = Array.isArray(nodes) ? [...nodes] : [nodes];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const t = node['@type'];
    if (Array.isArray(t)) t.forEach((x) => types.add(String(x)));
    else if (t) types.add(String(t));
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) stack.push(...v);
      else if (v && typeof v === 'object') stack.push(v);
    }
  }
  return types;
}

function run() {
  const html = readDistIndex();
  const blocks = extractJsonLd(html);
  if (blocks.length === 0) fail('no JSON-LD blocks found on dist/index.html');
  const types = flattenTypes(blocks);
  const required = ['Organization', 'WebSite', 'WebPage'];
  for (const t of required) {
    if (!types.has(t)) fail(`missing required JSON-LD type ${t} on dist/index.html`);
  }
  console.log('HOMEPAGE SCHEMA CONTRACT PASS');
}

module.exports = { run };
if (require.main === module) run();
