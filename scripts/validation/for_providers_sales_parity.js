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
  // Find the first ```json fenced block that contains the canonical version marker.
  const fenceRe = /```json\s*([\s\S]*?)\s*```/g;
  let m;
  while ((m = fenceRe.exec(md)) !== null) {
    const body = m[1].trim();
    if (body.includes('"version"') && body.includes('CANONICAL_AD_INVENTORY_V1')) {
      try {
        return JSON.parse(body);
      } catch (e) {
        fail(`Canonical inventory JSON fence is not valid JSON: ${e.message}`);
      }
    }
  }
  fail('Could not find canonical inventory JSON fence with version CANONICAL_AD_INVENTORY_V1 in canonical doc.');
}

function extractInventoryFromDistHtml(html) {
  // Extract <script type="application/json" id="canonical-ad-inventory-v1">...</script>
  const re = /<script[^>]*id=["']canonical-ad-inventory-v1["'][^>]*>([\s\S]*?)<\/script>/i;
  const m = html.match(re);
  if (!m) fail('dist/for-providers/index.html missing <script id="canonical-ad-inventory-v1"> JSON block.');
  const raw = (m[1] || '').trim();
  if (!raw) fail('canonical-ad-inventory-v1 script tag is empty.');
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`canonical-ad-inventory-v1 JSON in dist is invalid: ${e.message}`);
  }
}

function stableSort(obj) {
  if (Array.isArray(obj)) return obj.map(stableSort);
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.keys(obj).sort().forEach(k => {
      out[k] = stableSort(obj[k]);
    });
    return out;
  }
  return obj;
}

function stableStringify(obj) {
  return JSON.stringify(stableSort(obj));
}

function run() {
  const repoRoot = path.join(__dirname, '..', '..');

  const canonicalDoc = path.join(
    repoRoot,
    'docs',
    'runbooks',
    'monetization_ads_buyouts',
    '02_CANONICAL_AD_SYSTEM_AND_CHECKLIST.md'
  );

  const distFp = path.join(repoRoot, 'dist', 'for-providers', 'index.html');

  const md = readFileOrFail(canonicalDoc, 'Canonical doc must exist.');
  const canonical = extractCanonicalInventory(md);

  const html = readFileOrFail(distFp, 'Run a build first (npm run build or npm run build:all).');
  const distInv = extractInventoryFromDistHtml(html);

  const a = stableStringify(canonical);
  const b = stableStringify(distInv);

  if (a !== b) {
    // Minimal but actionable failure output.
    fail(
      [
        'Rendered /for-providers/ inventory JSON does not match canonical doc.',
        `Canonical version: ${canonical.version || 'unknown'}`,
        `Dist version: ${distInv.version || 'unknown'}`,
        'Fix by updating BOTH the canonical doc JSON fence and the /for-providers/ embedded JSON together.',
        `Canonical doc: ${canonicalDoc}`,
        `Dist page: ${distFp}`
      ].join('\n')
    );
  }

  console.log('✅ SALES PARITY PASS (for-providers ⇄ canonical inventory JSON)');
}

module.exports = { run };
