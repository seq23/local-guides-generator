/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
function fail(msg){ throw new Error(msg); }
function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const guidesDir = path.join(repoRoot,'dist','guides');
  if (!fs.existsSync(guidesDir)) { console.log('✅ GUIDE STRUCTURE CONTRACT PASS (0 guides)'); return; }
  const bad = [];
  let checked = 0;
  for (const name of fs.readdirSync(guidesDir)) {
    const fp = path.join(guidesDir,name,'index.html');
    if (!fs.existsSync(fp)) continue;
    checked += 1;
    const html = fs.readFileSync(fp,'utf8');
    const needs = [
      'class="hero"',
      'data-citation-summary-type="guide-detail"',
      'data-sponsored-placement="top"',
      'data-sponsored-placement="bottom"',
      'data-guide-comparison="true"'
    ];
    for (const n of needs) if (!html.includes(n)) bad.push(path.relative(repoRoot, fp) + ' missing ' + n);
  }
  if (bad.length) fail(bad.join('\n'));
  console.log(`✅ GUIDE STRUCTURE CONTRACT PASS (${checked} guides)`);
}
module.exports = { run };
