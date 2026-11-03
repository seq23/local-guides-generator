/* eslint-disable no-console */
/**
 * Every /guides/<slug>/ page declares a speakable node, and every selector it
 * declares resolves in its own markup.
 *
 * WHY: guide pages carry a short-answer block and a citation summary but declared
 * no SpeakableSpecification, so an answer engine had nothing marked to quote and
 * the Monday quality sample scored every sampled guide "a guide page with no
 * speakable markup" (Search Readiness q1, 3 Nov 2026: dentistryguides.com 4 of 5
 * sampled guides, plus neuroevalguides.com, hormonesivhair.com and uscisexam.com).
 *
 * The selectors live in data/contracts/site_hygiene_registry.json
 * (guide_speakable_selectors) and are declared by scripts/build_city_sites.js
 * (GUIDE_SPEAKABLE_SELECTORS), so a selector that stops matching the markup fails
 * the build here rather than shipping a speakable node that points at nothing -
 * which is what "declared but unresolvable" would be worth to an answer engine.
 *
 * Hard-fails on zero guide pages: a pack whose guides vanished must not pass by
 * having nothing to check.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function guidePages(distDir) {
  const dir = path.join(distDir, 'guides');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name, 'index.html'))
    .filter((p) => fs.existsSync(p));
}

function jsonLdNodes(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]);
      const flat = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of flat) {
        if (!node || typeof node !== 'object') continue;
        out.push(node);
        for (const sub of [].concat(node['@graph'] || [])) if (sub && typeof sub === 'object') out.push(sub);
      }
    } catch { /* a malformed block is another contract's problem */ }
  }
  return out;
}

function selectorResolves(selector, html) {
  const m = String(selector).match(/^([.#])([\w-]+)$/);
  // Anything that is not a bare class or id selector is not resolvable by string
  // match; those are declared only when a data-attribute block carries them and
  // are checked by the block's own contract.
  if (!m) return new RegExp(String(selector).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(html);
  return m[1] === '#'
    ? new RegExp(`id=["']${m[2]}["']`).test(html)
    : new RegExp(`class=["'][^"']*\\b${m[2]}\\b`).test(html);
}

function run() {
  const distDir = path.join(ROOT, 'dist');
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'contracts', 'site_hygiene_registry.json'), 'utf8'));
  const selectors = registry.guide_speakable_selectors;
  if (!Array.isArray(selectors) || selectors.length === 0) {
    throw new Error('GUIDE SPEAKABLE CONTRACT FAIL\n - data/contracts/site_hygiene_registry.json declares no guide_speakable_selectors');
  }
  const pages = guidePages(distDir);
  if (pages.length === 0) {
    throw new Error('GUIDE SPEAKABLE CONTRACT FAIL\n - dist/guides/ has no guide page: nothing was checked, which is not a pass');
  }
  const bad = [];
  for (const file of pages) {
    const rel = path.relative(distDir, file);
    const html = fs.readFileSync(file, 'utf8');
    const declared = jsonLdNodes(html)
      .flatMap((n) => [].concat(n.speakable || []))
      .filter((s) => s && String(s['@type']) === 'SpeakableSpecification')
      .flatMap((s) => [].concat(s.cssSelector || []));
    if (declared.length === 0) { bad.push(`${rel}: no SpeakableSpecification`); continue; }
    for (const sel of selectors) {
      if (!declared.includes(sel)) bad.push(`${rel}: does not declare registered selector ${sel}`);
    }
    for (const sel of declared) {
      if (!selectorResolves(sel, html)) bad.push(`${rel}: declares speakable ${sel}, which is not on the page`);
    }
  }
  if (bad.length) throw new Error('GUIDE SPEAKABLE CONTRACT FAIL\n' + bad.map((b) => ' - ' + b).join('\n'));
  console.log(`✅ guide speakable contract pass (${pages.length} guide page(s), ${selectors.length} selector(s))`);
}

if (require.main === module) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { run };
