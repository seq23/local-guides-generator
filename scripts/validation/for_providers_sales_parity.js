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

  console.log('✅ SALES PARITY PASS (runtime ad registry ⇄ for-providers ⇄ canonical inventory doc)');
}

module.exports = { run };
