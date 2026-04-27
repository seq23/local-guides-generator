/* eslint-disable no-console */
const fs=require('fs'); const path=require('path');
function walk(dir,out=[]){ if(!fs.existsSync(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const f=path.join(dir,e.name); if(e.isDirectory()) walk(f,out); else if(e.isFile()&&e.name==='index.html') out.push(f);} return out; }
function fail(msg){ console.error('METADATA SCHEMA STRENGTH FAIL\n'+msg); process.exit(1);} 
function run(){ const root=path.join(__dirname,'..','..'); const home=fs.readFileSync(path.join(root,'dist','index.html'),'utf8'); if(!/@type":\s*"FAQPage"/.test(home)||!/@type":\s*"BreadcrumbList"/.test(home)) fail('dist/index.html missing FAQPage or BreadcrumbList'); const guides=walk(path.join(root,'dist','guides')).filter(f=>!/guides\/index\.html$/.test(f)); const bad=[]; for(const f of guides){ const html=fs.readFileSync(f,'utf8'); if(!/@type":\s*"HowTo"/.test(html)) bad.push(path.relative(root,f)+': missing HowTo schema'); }
if(bad.length) fail(bad.join('\n')); console.log('✅ METADATA SCHEMA STRENGTH PASS'); }
module.exports={run}; if(require.main===module) run();