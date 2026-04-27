/* eslint-disable no-console */
const fs=require('fs'); const path=require('path');
function walk(dir,out=[]){ if(!fs.existsSync(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const f=path.join(dir,e.name); if(e.isDirectory()) walk(f,out); else if(e.isFile()&&e.name==='index.html') out.push(f);} return out; }
function fail(msg){ console.error('GUIDE INTRO FAIL\n'+msg); process.exit(1);} 
function run(){ const root=path.join(__dirname,'..','..'); const files=walk(path.join(root,'dist','guides')).filter(f=>!/guides\/index\.html$/.test(f)); const bad=[]; for(const f of files){ const html=fs.readFileSync(f,'utf8'); const hasDedicated = html.includes('data-guide-opening="true"'); const hasCitationIntro = html.includes('data-citation-summary-type="guide-detail"') && html.includes('data-citation-summary-lede="true"') && html.includes('class="answer-when"') && html.includes('class="answer-tradeoff"'); if(!(hasDedicated || hasCitationIntro)) bad.push(path.relative(root,f)+': missing enforced guide intro surface'); }
if(bad.length) fail(bad.join('\n')); console.log('✅ GUIDE INTRO CONTRACT PASS'); }
module.exports={run}; if(require.main===module) run();
