/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'GUIDES_INDEX_LINKS';
  throw err;
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const dist = path.join(repoRoot,'dist');
  const guidesDir = path.join(dist,'guides');

  if (!fs.existsSync(guidesDir)) {
    console.log('✅ GUIDES INDEX LINKS PASS (0 guide folders checked)');
    return;
  }

  const indexFp = path.join(guidesDir,'index.html');
  if (!fs.existsSync(indexFp)) fail('dist/guides/index.html missing');

  const indexHtml = fs.readFileSync(indexFp,'utf8');
  const folders = fs.readdirSync(guidesDir,{withFileTypes:true})
    .filter(d=>d.isDirectory())
    .map(d=>d.name)
    .filter(n=>!n.startsWith('_'));

  let checked = 0;
  for (const f of folders){
    const fp = path.join(guidesDir,f,'index.html');
    if (!fs.existsSync(fp)) continue;
    checked += 1;
    const slug = `/guides/${f}/`;
    if (!indexHtml.includes(slug)) fail(`guides index missing link to ${slug}`);
  }

  console.log(`✅ GUIDES INDEX LINKS PASS (${checked} guide folders checked)`);
}

module.exports = { run };
