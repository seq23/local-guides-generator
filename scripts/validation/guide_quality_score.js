/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
function sentences(text){ return String(text||'').split(/[.!?]+/).map(s=>s.trim()).filter(Boolean); }
function scoreHtml(html){
  const text = String(html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const secs = (html.match(/data-guide-section="true"/g) || []).length;
  const sent = sentences(text);
  const avgSent = sent.length ? sent.reduce((a,b)=>a+b.split(/\s+/).length,0)/sent.length : 30;
  let score = 0;
  score += html.includes('data-citation-summary-type="guide-detail"') ? 10 : 0;
  score += html.includes('data-guide-opening="true"') ? 10 : 0;
  score += html.includes('data-guide-custom-core="true"') ? 20 : 5;
  score += html.includes('data-guide-comparison="true"') ? 15 : 0;
  score += secs >= 4 ? 15 : secs >= 3 ? 10 : 0;
  score += /Common mistake:/i.test(text) ? 10 : 0;
  score += /Questions to ask:/i.test(text) ? 10 : 0;
  score += avgSent <= 18 ? 10 : avgSent <= 24 ? 5 : 0;
  return Math.min(100, score);
}
function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const guidesDir = path.join(repoRoot,'dist','guides');
  if (!fs.existsSync(guidesDir)) { console.log('ℹ️ GUIDE QUALITY REPORT: no guides'); return; }
  let checked=0,bad=0,weak=0,total=0;
  for (const name of fs.readdirSync(guidesDir)) {
    const fp = path.join(guidesDir,name,'index.html');
    if (!fs.existsSync(fp)) continue;
    checked += 1;
    const score = scoreHtml(fs.readFileSync(fp,'utf8'));
    total += score;
    if (score < 30) bad += 1;
    else if (score < 60) weak += 1;
  }
  const avg = checked ? (total/checked) : 0;
  const badRatio = checked ? (bad/checked) : 0;
  if (badRatio > 0.20) throw new Error(`Guide quality too weak: ${bad}/${checked} under 30`);
  console.log(`GUIDE QUALITY REPORT avg=${avg.toFixed(1)} weak=${weak} bad=${bad}`);
}
module.exports = { run };
