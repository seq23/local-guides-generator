/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
function fail(msg){ throw new Error(msg); }
function countBefore(html, a, b){
  const ia = html.indexOf(a);
  const ib = html.indexOf(b);
  if (ia === -1 || ib === -1) return false;
  return ia < ib;
}
function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const checks = [path.join(repoRoot,'dist','guides','index.html')];
  const guidesDir = path.join(repoRoot,'dist','guides');
  if (fs.existsSync(guidesDir)) {
    for (const name of fs.readdirSync(guidesDir)) {
      const fp = path.join(guidesDir, name, 'index.html');
      if (fs.existsSync(fp)) checks.push(fp);
    }
  }
  const bad = [];
  for (const fp of checks) {
    if (!fs.existsSync(fp)) continue;
    const html = fs.readFileSync(fp,'utf8');
    const primary = (html.match(/data-primary-conversion-cta="true"/g) || []).length;
    const inline = (html.match(/data-inline-conversion-cta="true"/g) || []).length;
    if (primary > 1 || inline > 1) bad.push(path.relative(repoRoot, fp) + ' duplicate CTA marker');
    if (primary && inline) {
      bad.push(path.relative(repoRoot, fp) + ' has adjacent guide CTA surfaces; keep one guide CTA path');
    }
  }
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ CTA ADJACENCY CONTRACT PASS');
}
module.exports = { run };
