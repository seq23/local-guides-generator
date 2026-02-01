/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'LINK_AUDIT';
  throw err;
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname,'..','..');
  const dist = path.join(repoRoot,'dist');
  if (!fs.existsSync(dist)) fail('dist/ missing. Run build first.');

  // Minimal internal link resolution: ensure href="/path/" resolves to dist/path/index.html
  const htmlFiles=[];
  (function walk(dir){
    for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const p = path.join(dir,ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name==='index.html') htmlFiles.push(p);
    }
  })(dist);

  const missing=[];
  const hrefRe = /href=["'](\/[^"'#?]+)["']/g;
  for (const fp of htmlFiles){
    const html = fs.readFileSync(fp,'utf8');
    const m = html.matchAll(hrefRe);
    for (const match of m){
      const href = match[1];
      // ignore external-ish
      if (!href.startsWith('/')) continue;
      const target = path.join(dist, href.replace(/^\//,''), 'index.html');
      if (!fs.existsSync(target)) missing.push(`${fp.replace(repoRoot+path.sep,'')} -> ${href}`);
    }
  }

  if (missing.length) {
    fail('Broken internal hrefs:\n' + missing.slice(0,200).join('\n') + (missing.length>200?`\n...and ${missing.length-200} more`:''));
  }

  console.log('✅ LINK AUDIT PASS');
}

module.exports = { run };
