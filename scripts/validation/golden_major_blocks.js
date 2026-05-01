/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) { throw new Error(msg); }
function hasAdjacentCtas(html) {
  const re = /<section[^>]*data-(?:primary-conversion-cta|inline-conversion-cta|runtime-next-steps-cta)="true"[^>]*>/ig;
  const positions = [];
  let m;
  while ((m = re.exec(html))) positions.push(m.index);
  for (let i = 0; i < positions.length - 1; i += 1) {
    const start = positions[i];
    const next = positions[i + 1];
    const close = html.indexOf('</section>', start);
    if (close === -1 || close > next) continue;
    const between = html.slice(close + 10, next);
    if (!between.trim()) return true;
  }
  return false;
}

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
  const dist = path.join(repoRoot, 'dist');
  if (!fs.existsSync(dist)) fail('dist/ missing. Run build first.');
  const bad = [];
  for (const fp of walk(dist)) {
    const rel = path.relative(repoRoot, fp);
    if (rel === 'dist/index.html') continue;
    const html = fs.readFileSync(fp, 'utf8');
    if (html.includes('data-sponsored-empty="true"')) bad.push(rel + ' contains empty sponsor placeholder');
    if (hasAdjacentCtas(html)) bad.push(rel + ' contains adjacent CTA sections');
  }
  if (bad.length) fail('GOLDEN MAJOR BLOCK FAIL\n' + bad.join('\n'));
  console.log('✅ GOLDEN MAJOR BLOCKS PASS');
}

module.exports = { run };
