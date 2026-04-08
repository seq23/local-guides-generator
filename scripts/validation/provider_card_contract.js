/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase().endsWith('.html')) acc.push(full);
  }
}

function run() {
  const distDir = path.join(process.cwd(), 'dist');
  const files = [];
  walk(distDir, files);
  const bad = [];
  files.forEach((fp) => {
    const html = fs.readFileSync(fp, 'utf8');
    const count = (html.match(/data-provider-card="true"/g) || []).length;
    if (!count) return;
    const metaCount = (html.match(/data-provider-card-meta="true"/g) || []).length;
    const attrsCount = (html.match(/data-provider-card-attributes="true"/g) || []).length;
    if (metaCount < count) bad.push(path.relative(distDir, fp) + ': provider card missing meta line');
    if (attrsCount < count) bad.push(path.relative(distDir, fp) + ': provider card missing attributes');
  });
  if (bad.length) throw new Error('PROVIDER CARD CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ provider card contract pass');
}

module.exports = { run };
