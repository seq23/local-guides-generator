const fs = require('fs');
const path = require('path');
function fail(msg) { throw new Error('SALES PARITY FAIL: ' + msg); }
function readFileOrFail(fp, msg) { try { return fs.readFileSync(fp, 'utf8'); } catch { fail(msg + ' (' + fp + ')'); } }
function stableStringify(obj) { return JSON.stringify(obj, null, 2); }
function extractCanonicalInventory(md) { const m = String(md || '').match(/```json\s*\n([\s\S]*?"version"\s*:\s*"CANONICAL_AD_INVENTORY_V1"[\s\S]*?)\n```/m); if (!m) fail('Canonical doc missing CANONICAL_AD_INVENTORY_V1 JSON fence.'); try { return JSON.parse(m[1]); } catch (e) { fail('Canonical inventory JSON is invalid: ' + e.message); } }
function extractInventoryFromHtml(html) { const m = String(html || '').match(/<script[^>]*id=["']canonical-ad-inventory-v1["'][^>]*>([\s\S]*?)<\/script>/i); if (!m) fail('dist/for-providers/index.html missing canonical inventory JSON block.'); try { return JSON.parse((m[1] || '').trim()); } catch (e) { fail('dist canonical inventory JSON invalid: ' + e.message); } }
function run() {
 const repoRoot = path.join(__dirname, '..', '..');
 const canonicalDoc = path.join(repoRoot, 'docs', 'runbooks', 'monetization_ads_buyouts', '02_CANONICAL_AD_SYSTEM_AND_CHECKLIST.md');
 const distFp = path.join(repoRoot, 'dist', 'for-providers', 'index.html');
 const srcFp = path.join(repoRoot, 'data', 'global_pages', 'for-providers.json');
 const canonical = extractCanonicalInventory(readFileOrFail(canonicalDoc, 'Canonical doc must exist.'));
 const srcHtml = JSON.parse(readFileOrFail(srcFp, 'for-providers source must exist.')).main_html || '';
 const distHtml = readFileOrFail(distFp, 'Run a build first.');
 const distInv = extractInventoryFromHtml(distHtml);
 if (stableStringify(canonical) !== stableStringify(distInv)) fail('Rendered /for-providers/ canonical JSON does not match the canonical doc.');
 if ((((canonical||{}).surfaces||{}).guide||{}).availability !== 'vertical_buyout_only') fail('Canonical inventory must mark guide availability as vertical_buyout_only.');
 for (const label of ['City Buyout', 'State Buyout', 'Vertical Buyout']) { if (!srcHtml.includes(label)) fail('for-providers source missing required product label: ' + label); }
 for (const label of ['Clean page vs owned page', 'Composite buyout coverage', 'Directory CTA feature', 'Sponsor lead form example']) { if (!srcHtml.includes(label)) fail('for-providers source missing required visual summary: ' + label); }
 for (const required of ['CTA above a directory becomes the sponsor feature surface', 'No adjacent CTAs are allowed', 'Personal Injury excludes city pages']) { if (!srcHtml.includes(required)) fail('for-providers source missing required rule copy: ' + required); }
 for (const forbidden of ['City — Shared Placement (Stacked)', 'City — Buyout (Exclusive)', 'State Buyout (PI only)', 'Vertical Pack (total website) Buyout', 'What slots look like (visual)', 'What buyout pages look like']) { if (srcHtml.includes(forbidden)) fail('for-providers source contains obsolete sales copy: ' + forbidden); }
 console.log('✅ SALES PARITY PASS');
}
module.exports = { run };