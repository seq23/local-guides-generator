/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
function exists(p){ try{return fs.existsSync(p);}catch{return false;} }
function readText(p){ return fs.readFileSync(p,'utf8'); }
function markerPositions(html, kind){
  const map={primary:/<section[^>]*data-primary-conversion-cta\s*=\s*"true"/gi,inline:/<section[^>]*data-inline-conversion-cta\s*=\s*"true"/gi,bubble:/<section[^>]*data-connection-bubble\s*=\s*"true"/gi};
  return Array.from(String(html||'').matchAll(map[kind]||/$^/g)).map(m=>m.index||0);
}
function listCityHubIndexHtmlPaths(distDir){ const out=[]; for(const e of fs.readdirSync(distDir,{withFileTypes:true})){ if(!e.isDirectory()) continue; const n=e.name; if(['assets','guides','states'].includes(n)||n.startsWith('_')) continue; const fp=path.join(distDir,n,'index.html'); if(!exists(fp)) continue; const html=readText(fp); const m=html.match(/<body[^>]*data-city\s*=\s*"([^"]*)"/i); if(m&&m[1]===n) out.push(fp);} return out; }
function listStateHubIndexHtmlPaths(distDir){ const out=[]; const dir=path.join(distDir,'states'); if(!exists(dir)) return out; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(!e.isDirectory()) continue; const fp=path.join(dir,e.name,'index.html'); if(exists(fp)) out.push(fp);} return out; }
function validateExact(html, kind, expected, label, failures){ const n=markerPositions(html,kind).length; const marker=kind==='primary'?'data-primary-conversion-cta="true"':kind==='inline'?'data-inline-conversion-cta="true"':'data-connection-bubble="true"'; if(n!==expected) failures.push(`${label}: expected ${expected} occurrence(s) of ${marker} but found ${n}`); }
function run(){
  const distDir=path.join(REPO_ROOT,'dist'); if(!exists(distDir)){ console.error('CONVERSION CONTRACT FAIL: dist/ is missing. Build first.'); process.exit(1); }
  const failures=[];
  const cityFiles=listCityHubIndexHtmlPaths(distDir);
  const stateFiles=listStateHubIndexHtmlPaths(distDir);
  for(const fp of [...cityFiles, ...stateFiles]){ const html=readText(fp); const label=path.relative(REPO_ROOT,fp); validateExact(html,'primary',1,label,failures); validateExact(html,'inline',1,label,failures); validateExact(html,'bubble',1,label,failures); }
  for(const fp of cityFiles){ const html=readText(fp); const label=path.relative(REPO_ROOT,fp); const p=markerPositions(html,'primary')[0]??-1; const i=markerPositions(html,'inline')[0]??-1; const b=markerPositions(html,'bubble')[0]??-1; if(!(p>=0 && i>=0 && b>=0 && p<i && i<b)) failures.push(`${label}: conversion hierarchy order must be primary -> inline -> connection bubble`); }
  if(failures.length){ console.error('CONVERSION CONTRACT FAIL'); failures.slice(0,80).forEach(f=>console.error(' - '+f)); if(failures.length>80) console.error(`... (${failures.length-80} more failures)`); process.exit(1); }
  console.log('✅ conversion contract pass');
}
module.exports={run};
