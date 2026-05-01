/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
function walk(dir,out=[]){ if(!fs.existsSync(dir)) return out; for (const e of fs.readdirSync(dir,{withFileTypes:true})) { const f=path.join(dir,e.name); if(e.isDirectory()) walk(f,out); else if(e.isFile() && e.name==='index.html') out.push(f);} return out; }
function fail(msg){ console.error('EVALUATION FRAMEWORK FAIL\n'+msg); process.exit(1); }
function run(){ const root=path.join(__dirname,'..','..'); const dist=path.join(root,'dist'); const files=walk(dist).filter(f=>!/\/guides\//.test(f)); const bad=[]; for(const f of files){ const html=fs.readFileSync(f,'utf8'); if(!/data-eval-framework="true"/i.test(html)) continue; ['data-eval-priority="true"','data-eval-best-for="true"','data-eval-avoid-if="true"','data-eval-cost-outcome="true"'].forEach(n=>{ if(!html.includes(n)) bad.push(path.relative(root,f)+': missing '+n);}); }
if(bad.length) fail(bad.join('\n')); console.log('✅ EVALUATION FRAMEWORK CONTRACT PASS'); }
module.exports={run}; if(require.main===module) run();