/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'GOLDEN_MAJOR_BLOCKS';
  throw err;
}

function getPageSetName(){
  // prepare_site writes data/site.json
  try{
    const site = JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','data','site.json'),'utf8'));
    const ps = String(site.pageSetFile||'').split('/').pop();
    return ps || 'unknown';
  }catch{
    return 'unknown';
  }
}

function loadCities(repoRoot){
  const fp = path.join(repoRoot,'data','cities.json');
  if (!fs.existsSync(fp)) return [];
  const arr = JSON.parse(fs.readFileSync(fp,'utf8'));
  if (!Array.isArray(arr)) return [];
  return arr.map(c=>c.slug).filter(Boolean);
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname,'..','..');
  const dist = path.join(repoRoot,'dist');
  if (!fs.existsSync(dist)) fail('dist/ missing. Run build first.');

  const pageSetName = getPageSetName();
  const citySlugs = loadCities(repoRoot);

  const errors=[];

  for (const slug of citySlugs){
    const fp = path.join(dist, slug, 'index.html');
    if (!fs.existsSync(fp)) continue; // not built in this pageset
    const html = fs.readFileSync(fp,'utf8');

    // Enforce exactly 1 top/mid/bottom ad slot on city pages.
    const topCount = (html.match(/data-sponsored-placement="top"/g) || []).length;
    const midCount = (html.match(/data-sponsored-placement="mid"/g) || []).length;
    const bottomCount = (html.match(/data-sponsored-placement="bottom"/g) || []).length;
    if (topCount !== 1) errors.push(`${fp.replace(repoRoot+path.sep,'')} expected exactly 1 top ad, got ${topCount}`);
    if (midCount !== 1) errors.push(`${fp.replace(repoRoot+path.sep,'')} expected exactly 1 mid ad, got ${midCount}`);
    if (bottomCount !== 1) errors.push(`${fp.replace(repoRoot+path.sep,'')} expected exactly 1 bottom ad, got ${bottomCount}`);

    // Minimal pack-aware block requirements.
    // NOTE: we intentionally do NOT validate global pages like /privacy.
    const required = [];
    // All city pages: eval + llm bait question + faq marker.
    required.push('data-eval-framework="true"');
    required.push('data-llm-bait="question"');
    required.push('data-faq="true"');

    // PI vs non-PI differences.
    const isPI = /personal injury/i.test(html) || /data-vertical="pi"/i.test(html);
    if (isPI) {
      // PI city pages: directory block marker is data-example-listings (pi directory) OR data-example-providers (if used), and guides.
      // Current reality: PI pages use guides micro block.
      required.push('data-guides');
    } else {
      // Non-PI: example providers + state lookup + guides.
      required.push('data-example-providers="true"');
      required.push('data-state-lookup="true"');
      required.push('data-guides');
    }

    for (const r of required){
      if (!html.includes(r)) errors.push(`${fp.replace(repoRoot+path.sep,'')} missing ${r}`);
    }
  }

  if (errors.length){
    fail(`GOLDEN MAJOR BLOCK FAIL (${pageSetName})\n` + errors.slice(0,200).join('\n') + (errors.length>200?`\n...and ${errors.length-200} more`:''));
  }

  console.log(`✅ GOLDEN MAJOR BLOCKS PASS (${pageSetName})`);
}

module.exports = { run };
