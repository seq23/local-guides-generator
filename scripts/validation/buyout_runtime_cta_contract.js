const fs = require('fs');
const path = require('path');
const buyouts = require('../helpers/buyouts');

function fail(msg) {
  throw new Error('BUYOUT RUNTIME CTA FAIL: ' + msg);
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const distRoot = path.join(repoRoot, 'dist');
  const buyoutPath = path.join(repoRoot, 'data', 'buyouts.json');
  if (!fs.existsSync(buyoutPath)) {
    console.log('✅ BUYOUT RUNTIME CTA SKIP (no buyouts.json)');
    return;
  }
  let arr = [];
  try { arr = JSON.parse(read(buyoutPath)); } catch (e) { fail(`invalid JSON in data/buyouts.json: ${e.message}`); }
  if (!Array.isArray(arr) || arr.length === 0) {
    console.log('✅ BUYOUT RUNTIME CTA SKIP (no configured buyouts)');
    return;
  }
  const now = new Date();
  const activeVerticals = arr.filter((b) => buyouts.isLive(b, now) && b.scope === 'vertical');
  const activePiStates = arr.filter((b) => buyouts.isLive(b, now) && b.scope === 'state' && String((b.verticalKey || '')).toLowerCase() === 'pi');
  if (!activeVerticals.length && !activePiStates.length) {
    console.log('✅ BUYOUT RUNTIME CTA SKIP (no live vertical/state buyouts)');
    return;
  }

  const home = path.join(distRoot, 'index.html');
  if (activeVerticals.length) {
    const html = read(home);
    if (!html.includes('data-runtime-next-steps-cta="true"')) fail('home page missing runtime next-steps CTA under live vertical buyout.');
    if (!html.includes('data-vertical-buyout-hero="true"')) fail('home page missing vertical buyout hero marker under live vertical buyout.');
    if (!html.includes('Review the local next-step guide before choosing a provider.')) fail('home page missing locked runtime CTA copy under live vertical buyout.');
    if (!html.includes('href="/next-steps/"')) fail('home page hero CTA must route to /next-steps/ under live vertical buyout.');
    const nextSteps = read(path.join(distRoot, 'next-steps', 'index.html'));
    if (!nextSteps.includes('data-sponsored-routing-note="true"')) fail('next-steps page missing sponsored routing note under live vertical buyout.');
    if (!nextSteps.includes('id="sponsor_slug" name="sponsor_slug" value=')) fail('next-steps page missing sponsor_slug hidden field value under live vertical buyout.');
    if (!nextSteps.includes('id="lead_target" name="lead_target" value=')) fail('next-steps page missing lead_target hidden field under live vertical buyout.');
    const requestAssist = read(path.join(distRoot, 'request-assistance', 'index.html'));
    if (!requestAssist.includes('data-sponsored-routing-note="true"')) fail('request-assistance page missing sponsored routing note under live vertical buyout.');
    if (!requestAssist.includes('id="sponsor_slug" name="sponsor_slug" value=')) fail('request-assistance page missing sponsor_slug hidden field value under live vertical buyout.');
    if (!requestAssist.includes('id="lead_target" name="lead_target" value=')) fail('request-assistance page missing lead_target hidden field under live vertical buyout.');
  }

  for (const rec of activePiStates) {
    const targets = Array.isArray(rec.targets) ? rec.targets : [];
    for (const ab of targets) {
      const p = path.join(distRoot, 'states', String(ab).toUpperCase(), 'index.html');
      if (!fs.existsSync(p)) fail(`state page missing for live PI state buyout target ${ab}`);
      const html = read(p);
      if (!html.includes('data-runtime-next-steps-cta="true"')) fail(`state page ${ab} missing runtime next-steps CTA under live PI state buyout.`);
      if (!html.includes('Review the local next-step guide before choosing a provider.')) fail(`state page ${ab} missing locked runtime CTA copy under live PI state buyout.`);
    }
  }

  console.log('✅ BUYOUT RUNTIME CTA PASS');
}

module.exports = { run };
