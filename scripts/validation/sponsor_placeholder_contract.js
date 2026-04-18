/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
function fail(msg) { throw new Error(msg); }
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, out);
    else if (e.isFile() && fp.endsWith('.html')) out.push(fp);
  }
  return out;
}
function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const distRoot = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distRoot)) fail('dist/ missing. Run build first.');
  const bad = [];
  for (const fp of walk(distRoot)) {
    const html = fs.readFileSync(fp, 'utf8');
    if (/Placeholder visual:/i.test(html)) bad.push(path.relative(repoRoot, fp) + ' still contains placeholder visual text');
    if (html.includes('data-sponsored-empty="true"')) bad.push(path.relative(repoRoot, fp) + ' still contains empty sponsor placeholder');
  }
  if (bad.length) fail('SPONSOR PLACEHOLDER CONTRACT FAIL\n' + bad.join('\n'));
  console.log('✅ SPONSOR PLACEHOLDER CONTRACT PASS');
}
module.exports = { run };
