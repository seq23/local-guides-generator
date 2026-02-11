/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg){
  const err = new Error(msg);
  err._validation = 'GOLDEN_MAJOR_BLOCKS';
  throw err;
}

function readJSON(fp){
  return JSON.parse(fs.readFileSync(fp,'utf8'));
}

function getSite(repoRoot){
  try{
    return readJSON(path.join(repoRoot,'data','site.json'));
  }catch{
    return {};
  }
}

function getPageSet(repoRoot, pageSetFile){
  if (!pageSetFile) return {};
  const fp = path.join(repoRoot,'data','page_sets', pageSetFile);
  if (!fs.existsSync(fp)) return {};
  try{
    return readJSON(fp);
  }catch{
    return {};
  }
}

function loadCities(repoRoot){
  const fp = path.join(repoRoot,'data','cities.json');
  if (!fs.existsSync(fp)) return [];
  const arr = readJSON(fp);
  if (!Array.isArray(arr)) return [];
  return arr.map(c=>c.slug).filter(Boolean);
}

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname,'..','..');
  const dist = path.join(repoRoot,'dist');
  if (!fs.existsSync(dist)) fail('dist/ missing. Run build first.');

  const site = getSite(repoRoot);
  const pageSetFile = site.pageSetFile || '';
  const pageSetName = String(pageSetFile).split('/').pop() || 'unknown';
  const pageSet = getPageSet(repoRoot, pageSetFile);

  const isPI = String(pageSet.verticalKey || '').toLowerCase() === 'pi';
  const cityHasDirectory = (pageSet.cityFeatures && typeof pageSet.cityFeatures.directory === 'boolean') ? pageSet.cityFeatures.directory : true;
  const cityHasStateLookup = (pageSet.cityFeatures && typeof pageSet.cityFeatures.stateLookup === 'boolean') ? pageSet.cityFeatures.stateLookup : true;

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

    // Minimal block requirements.
    // NOTE: we intentionally do NOT validate global pages like /privacy.
    const required = [];
    required.push('data-eval-framework="true"');
    required.push('data-llm-bait="question"');
    required.push('data-faq="true"');
    required.push('data-guides');

    if (!isPI) {
      // Non-PI packs vary: some have a directory/examples, some don't.
      // Only require example providers if the pack actually enables a directory.

      // State lookup is present in most non-PI packs; validate it when enabled.
      if (cityHasStateLookup) {
        const hasStateLookup = html.includes('data-state-lookup="true"') || html.includes('data-state-lookup-cta="true"');
        if (!hasStateLookup) errors.push(`${fp.replace(repoRoot+path.sep,'')} missing marker: data-state-lookup (or data-state-lookup-cta)`);
      }
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
