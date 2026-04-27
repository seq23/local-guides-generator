/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { getVerticalRules } = require('./vertical_rules');
function words(text){ return String(text||'').split(/\s+/).filter(Boolean); }
function complianceScore(route, html){
  const text = String(html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const rule = getVerticalRules(route);
  let score = 100;
  const avgLen = (()=>{ const s=text.split(/[.!?]+/).map(x=>x.trim()).filter(Boolean); return s.length ? s.reduce((a,b)=>a+words(b).length,0)/s.length : 0; })();
  if (avgLen > 24) score -= 10;
  if (/guaranteed|always|never fails/i.test(text)) score -= 15;
  for (const re of rule.banned) if (re.test(text)) score -= 35;
  for (const re of rule.required) if (!re.test(text)) score -= 10;
  if (!/Common mistake:/i.test(text)) score -= 5;
  if (!/What a good provider should make clear:/i.test(text)) score -= 10;
  if (!/Questions to ask:/i.test(text)) score -= 5;
  return Math.max(0, score);
}
function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const guidesDir = path.join(repoRoot,'dist','guides');
  if (!fs.existsSync(guidesDir)) { console.log('ℹ️ GUIDE COMPLIANCE REPORT: no guides'); return; }
  let checked=0, bad=0, total=0;
  for (const name of fs.readdirSync(guidesDir)) {
    const fp = path.join(guidesDir,name,'index.html');
    if (!fs.existsSync(fp)) continue;
    checked += 1;
    const route = '/guides/' + name + '/';
    const score = complianceScore(route, fs.readFileSync(fp,'utf8'));
    total += score;
    if (score < 40) bad += 1;
  }
  const badRatio = checked ? bad/checked : 0;
  if (badRatio > 0.25) throw new Error(`Guide compliance too weak: ${bad}/${checked} under 40`);
  const avg = checked ? total/checked : 0;
  console.log(`GUIDE COMPLIANCE REPORT avg=${avg.toFixed(1)} bad=${bad}`);
}
module.exports = { run };
