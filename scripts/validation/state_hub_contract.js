/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name === 'index.html') acc.push(full);
  }
}

function run() {
  const statesDir = path.join(process.cwd(), 'dist', 'states');
  if (!fs.existsSync(statesDir)) {
    throw new Error('STATE HUB CONTRACT FAIL\nmissing dist/states directory');
  }
  const files = [];
  walk(statesDir, files);
  const bad = [];
  files.forEach((fp) => {
    const rel = path.relative(path.join(process.cwd(), 'dist'), fp).replace(/\\/g, '/');
    if (/\/next-steps\/index\.html$/i.test(rel)) return;
    const html = fs.readFileSync(fp, 'utf8');
    if (!html.includes('data-covered-cities="true"')) bad.push(rel + ': missing covered cities block');
    if (!html.includes('data-request-city="true"')) bad.push(rel + ': missing request city block');
    if (!html.includes('mailto:info@spry.vc?subject=')) bad.push(rel + ': missing request city mailto');
    if (!(html.includes('&body=') || html.includes('&amp;body='))) bad.push(rel + ': request city mailto missing body prefill');
    if (!/please%20add%20this%20city/i.test(html)) bad.push(rel + ': request city mailto body is not user-facing');
    if ((html.match(/class="state-city-card"/g) || []).length === 0) bad.push(rel + ': missing state city cards');
  });
  if (bad.length) throw new Error('STATE HUB CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ state hub contract pass');
}

module.exports = { run };
