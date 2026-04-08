/* eslint-disable no-console */
const fs=require('fs'); const path=require('path');
function walk(dir,out=[]){ if(!fs.existsSync(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const f=path.join(dir,e.name); if(e.isDirectory()) walk(f,out); else if(e.isFile()&&e.name==='index.html') out.push(f);} return out; }
function fail(msg){ console.error('HIERARCHY REINFORCEMENT FAIL\n'+msg); process.exit(1);} 
function run(){ const root=path.join(__dirname,'..','..'); const files=walk(path.join(root,'dist')); const bad=[]; for(const f of files){ const html=fs.readFileSync(f,'utf8'); const iFresh=html.indexOf('data-distribution-fresh-block="true"'); const iPriority=html.indexOf('data-distribution-priority-block="true"'); if(iFresh!==-1 && iPriority!==-1 && iFresh<iPriority) bad.push(path.relative(root,f)+': recently refreshed appears before priority block'); if(/local-routes/i.test(html) && !(/visually-hidden/.test(html)||/distribution-fresh--quiet/.test(html))){} }
if(bad.length) fail(bad.join('\n')); console.log('✅ HIERARCHY REINFORCEMENT PASS'); }
module.exports={run}; if(require.main===module) run();