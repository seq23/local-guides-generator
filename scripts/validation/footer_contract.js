/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'FOOTER_CONTRACT';
  throw err;
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const dist = path.join(repoRoot,'dist');
  if (!fs.existsSync(dist)) fail('dist/ missing. Run build first.');

  const htmlFiles = [];
  (function walk(dir){
    for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const p = path.join(dir,ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name==='index.html') htmlFiles.push(p);
    }
  })(dist);

  const offenders=[];
  for (const fp of htmlFiles){
    const html = fs.readFileSync(fp,'utf8');
    const hasFooter = /<footer\b/i.test(html);
    if (!hasFooter) continue; // not enforced everywhere

    const footerText = html.split(/<footer\b/i)[1] || '';
    const year = /\b(20\d{2})\b/.test(footerText);
    const copyrightSignal = /(©|\(c\)|\bcopyright\b)/i.test(footerText);
    if (!(year && copyrightSignal)) offenders.push(fp.replace(repoRoot+path.sep,''));
  }

  if (offenders.length) {
    fail(`Footer contract failed for ${offenders.length} pages (missing year + copyright signal):\n` + offenders.slice(0,50).join('\n'));
  }

  console.log('FOOTER CONTRACT PASS');
}

module.exports = { run };
