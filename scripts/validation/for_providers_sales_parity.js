/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('SALES PARITY FAIL:', msg);
  process.exit(1);
}

function readFileOrFail(p, hint) {
  if (!fs.existsSync(p)) fail(`${p} missing. ${hint || ''}`.trim());
  return fs.readFileSync(p, 'utf8');
}

function extractCanonicalInventory(md) {
  const fenceRe = /```json\s*([\s\S]*?)\s*```/g;
  let m;
  while ((m = fenceRe.exec(md)) !== null) {
    const body = m[1].trim();
    if (body.includes('"version"') && body.includes('CANONICAL_AD_INVENTORY_V1')) {
      try { return JSON.parse(body); } catch (e) { fail(`Canonical inventory JSON fence is not valid JSON: ${e.message}`); }
    }
  }
  fail('Could not find canonical inventory JSON fence with version CANONICAL_AD_INVENTORY_V1 in canonical doc.');
}

function extractInventoryFromDistHtml(html) {
  const re = /<script[^>]*id=["']canonical-ad-inventory-v1["'][^>]*>([\s\S]*?)<\/script>/i;
  const m = html.match(re);
  if (!m) fail('dist/for-providers/index.html missing <script id="canonical-ad-inventory-v1"> JSON block.');
  const raw = (m[1] || '').trim();
  if (!raw) fail('canonical-ad-inventory-v1 script tag is empty.');
  try { return JSON.parse(raw); } catch (e) { fail(`canonical-ad-inventory-v1 JSON in dist is invalid: ${e.message}`); }
}

function stableSort(obj) {
  if (Array.isArray(obj)) return obj.map(stableSort);
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.keys(obj).sort().forEach((k) => { out[k] = stableSort(obj[k]); });
    return out;
  }
  return obj;
}
function stableStringify(obj) { return JSON.stringify(stableSort(obj)); }

function enabledAdPlacementKeys(repoRoot) {
  const fp = path.join(repoRoot, 'data', 'ad_placements.json');
  const json = JSON.parse(readFileOrFail(fp, 'Canonical ad placement registry must exist.'));
  return Object.keys(json).filter((key) => json[key] && json[key].enabled).sort();
}

function expectedEnabledKeysFromCanonical(inv) {
  const surfaces = (((inv || {}).surfaces) || {});
  const out = new Set();
  if (surfaces.guide) {
    out.add('global_guide_top');
    out.add('global_guide_bottom');
  }
  if (surfaces.city) {
    out.add('city_hub_top');
    out.add('city_hub_mid');
    out.add('city_hub_bottom');
  }
  if (surfaces.state) {
    out.add('state_hub_top');
    out.add('state_hub_mid');
  }
  if (surfaces.state_pi) {
    out.add('pi_state_top');
    out.add('pi_state_mid');
  }
  // state lookup remains runtime utility, not an ad surface, but must be present for functional pages.
  out.add('state_lookup_cta');
  return Array.from(out).sort();
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');
  const canonicalDoc = path.join(repoRoot, 'docs', 'runbooks', 'monetization_ads_buyouts', '02_CANONICAL_AD_SYSTEM_AND_CHECKLIST.md');
  const distFp = path.join(repoRoot, 'dist', 'for-providers', 'index.html');

  const canonical = extractCanonicalInventory(readFileOrFail(canonicalDoc, 'Canonical doc must exist.'));
  const distInv = extractInventoryFromDistHtml(readFileOrFail(distFp, 'Run a build first (npm run build or npm run build:all).'));

  if (stableStringify(canonical) !== stableStringify(distInv)) {
    fail([
      'Rendered /for-providers/ inventory JSON does not match canonical doc.',
      `Canonical version: ${canonical.version || 'unknown'}`,
      `Dist version: ${distInv.version || 'unknown'}`,
      'Fix by keeping /for-providers/ embedded JSON in exact parity with the canonical doc.',
      `Canonical doc: ${canonicalDoc}`,
      `Dist page: ${distFp}`
    ].join('\n'));
  }

  const expected = expectedEnabledKeysFromCanonical(canonical);
  const enabled = enabledAdPlacementKeys(repoRoot);
  const extra = enabled.filter((k) => !expected.includes(k));
  const missing = expected.filter((k) => !enabled.includes(k));
  if (extra.length || missing.length) {
    const lines = [];
    if (missing.length) lines.push('Runtime ad registry missing required keys: ' + missing.join(', '));
    if (extra.length) lines.push('Runtime ad registry enables undocumented keys: ' + extra.join(', '));
    fail(lines.join('\n'));
  }

  if ((((canonical||{}).surfaces||{}).guide||{}).availability !== 'vertical_buyout_only') fail('Canonical inventory must mark guide availability as vertical_buyout_only.');
  const products = (canonical||{}).products || {};
  if (!products.city_shared_placement || !products.city_buyout || !products.state_buyout_pi || !products.vertical_buyout) fail('Canonical inventory JSON missing required product definitions.');

  const srcFp = path.join(repoRoot, 'data', 'global_pages', 'for-providers.json');
  const srcHtml = JSON.parse(readFileOrFail(srcFp, 'for-providers source must exist.')).main_html || '';
  const requiredTierLabels = [
    'City — Shared Placement (Stacked)',
    'City — Buyout (Exclusive)',
    'State Buyout (PI only)',
    'Vertical Pack (total website) Buyout'
  ];
  for (const label of requiredTierLabels) {
    if (!srcHtml.includes(label)) fail(`for-providers source missing required tier: ${label}`);
  }
  const requiredCtas = requiredTierLabels.length;
  const ctaCount = (srcHtml.match(/>Sponsorship inquiry<\/a>/g) || []).length;
  if (ctaCount < requiredCtas) fail('for-providers source missing required Sponsorship inquiry buttons for listed tiers.');
  if (!srcHtml.includes('What slots look like (visual)')) fail('for-providers source missing What slots look like (visual) section.');
  if (!srcHtml.includes('What buyout pages look like')) fail('for-providers source missing What buyout pages look like section.');

  const forbiddenInternal = [
    'Sales page contract',
    'Calls to action on live pages',
    'How sponsor-controlled conversion works',
    'What the page-level CTAs do',
    'Contract authority',
    'three-CTA structure',
    'runtime page anatomy',
    'parity must be maintained'
  ];
  for (const forbidden of forbiddenInternal) {
    if (srcHtml.includes(forbidden)) fail(`for-providers source still contains internal sales/contract copy: ${forbidden}`);
  }

  const forbiddenStale = [
    'Vertical Buyout Runtime “Next Steps” Mechanism',
    'When a vertical buyout is active, eligible pages display a runtime “Next Steps” CTA.',
    'Locked CTA copy (vertical buyout only):'
  ];
  for (const forbidden of forbiddenStale) {
    if (srcHtml.includes(forbidden)) fail(`for-providers source still contains stale runtime CTA mechanism copy: ${forbidden}`);
  }

  for (const forbidden of ['Guide — Shared Placement', 'Guide — Buyout', 'State Shared Placement', 'Guide Buyout']) {
    if (srcHtml.includes(forbidden)) fail(`for-providers source contains forbidden tier text: ${forbidden}`);
  }

  const requiredPlacementSurfaces = [
    'City pages',
    'Guide pages',
    'State pages (PI only)',
    'Vertical hub / home pages',
    'hero placement'
  ];
  for (const label of requiredPlacementSurfaces) {
    if (!srcHtml.includes(label)) fail(`for-providers source missing required placement surface text: ${label}`);
  }

  const correctedHeroRule = 'For City Buyout and State Buyout (PI only), the top placement renders in a hero-style format rather than creating a new slot.';
  if (!srcHtml.includes(correctedHeroRule)) fail('for-providers source missing corrected hero position rule.');
  if (srcHtml.includes('For Guide Buyout, City Buyout, and State Buyout')) fail('for-providers source still contains stale guide-buyout hero rule.');

  const requiredVisualSummaries = [
    'City — Shared Placement (Stacked)',
    'State — Shared Placement (Runtime surface example)',
    'City Buyout — Hero example',
    'State Buyout — Hero example',
    'Guide page — Buyout hero example',
    'Vertical hub / home page — Hero example',
    'Sponsor lead form example'
  ];
  for (const label of requiredVisualSummaries) {
    if (!srcHtml.includes(label)) fail(`for-providers source missing required visual summary: ${label}`);
  }

  if (!srcHtml.includes('All leads submitted through this sponsor flow go to the sponsor.')) fail('for-providers source missing sponsor lead routing note.');

  const accordionCount = (srcHtml.match(/<details class=\"visual-card accordion\">/g) || []).length;
  if (accordionCount < 7) fail('for-providers source must include at least seven accordion visual cards (shared + buyout + sponsor form examples).');

  console.log('✅ SALES PARITY PASS (runtime ad registry ⇄ for-providers ⇄ canonical inventory doc)');
}

module.exports = { run };
