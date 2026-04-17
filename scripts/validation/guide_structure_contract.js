/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const buyouts = require('../helpers/buyouts');
function fail(msg){ throw new Error(msg); }
function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const guidesDir = path.join(repoRoot,'dist','guides');
  if (!fs.existsSync(guidesDir)) { console.log('✅ GUIDE STRUCTURE CONTRACT PASS (0 guides)'); return; }
  let activeVertical = false;
  try {
    const all = buyouts.loadBuyouts(repoRoot);
    activeVertical = all.some((b)=>buyouts.isLive(b,new Date()) && b.scope === 'vertical');
  } catch (_) {}
  const bad = [];
  let checked = 0;
  for (const name of fs.readdirSync(guidesDir)) {
    const fp = path.join(guidesDir,name,'index.html');
    if (!fs.existsSync(fp)) continue;
    checked += 1;
    const html = fs.readFileSync(fp,'utf8');
    const needs = [ 'class="hero"', 'data-citation-summary-type="guide-detail"', 'data-guide-comparison="true"' ];
    for (const n of needs) if (!html.includes(n)) bad.push(path.relative(repoRoot, fp) + ' missing ' + n);
    const hasTop = html.includes('data-sponsored-placement="top"');
    const hasBottom = html.includes('data-sponsored-placement="bottom"');
    if (activeVertical) {
      if (!hasTop) bad.push(path.relative(repoRoot, fp) + ' missing top guide sponsor placement under live vertical buyout');
      if (!hasBottom) bad.push(path.relative(repoRoot, fp) + ' missing bottom guide sponsor placement under live vertical buyout');
    } else {
      if (hasTop || hasBottom) bad.push(path.relative(repoRoot, fp) + ' should not render standard guide ad placements without live vertical buyout');
    }
  }
  if (bad.length) fail(bad.join('\n'));
  console.log(`✅ GUIDE STRUCTURE CONTRACT PASS (${checked} guides)`);
}
module.exports = { run };
