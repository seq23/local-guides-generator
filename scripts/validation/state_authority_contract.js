/* eslint-disable no-console */
const fs=require('fs'); const path=require('path');
function fail(msg){ console.error('STATE AUTHORITY FAIL\n'+msg); process.exit(1);} 
function walk(dir,out=[]){ if(!fs.existsSync(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const f=path.join(dir,e.name); if(e.isDirectory()) walk(f,out); else if(e.isFile()&&e.name==='index.html') out.push(f);} return out; }
function run(){ const root=path.join(__dirname,'..','..'); const files=walk(path.join(root,'dist','states')).filter(f=>!/states[\\/][A-Z]{2}[\\/]next-steps[\\/]index\.html$/.test(f)); const bad=[]; for(const f of files){ const html=fs.readFileSync(f,'utf8'); ['data-state-authority-block="true"','data-state-authority-dominance="true"','data-distribution-priority-block="true"','data-citation-summary-type="state-home"'].forEach(n=>{ if(!html.includes(n)) bad.push(path.relative(root,f)+': missing '+n);}); }
if(bad.length) fail(bad.join('\n')); console.log('✅ STATE AUTHORITY CONTRACT PASS'); }
module.exports={run}; if(require.main===module) run();
