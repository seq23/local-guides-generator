/* eslint-disable no-console */
/**
 * No two city pages, and no two next-steps pages, of a site are more than half
 * identical.
 *
 * WHY: the Monday Search Readiness quality sample (boss-os page-quality-sample.mjs)
 * reads five live pages and calls a page template filler when it is more than half
 * identical to another sampled page: Jaccard similarity of 5-word shingles over the
 * <main> text above 0.5. On 7 Nov 2026 it failed all five sites this repo serves on
 * exactly that (uscisexam portland-or / columbia-sc next-steps, theaccidentguides
 * albuquerque-nm / denver-co next-steps, neuroevalguides wilmington-de /
 * philadelphia-pa / newark-nj, hormonesivhair portland-me / baltimore-md,
 * memphisseniorcarehomes millington-tn / bartlett-tn next-steps). The sample
 * rotates weekly, so passing it once proves nothing about next week: this measures
 * every pair the generator built, with the audit's own formula
 * (scripts/lib/template_text.js pairwiseSimilarity).
 *
 * The ratchet: some places genuinely share their facts (two Memphis
 * neighbourhoods whose nearest licensed communities are the same, two cities of
 * one state whose only listed providers are the same telehealth chains, the form
 * every next-steps page must carry), so a pack may still have pairs over the limit.
 * data/contracts/cross_page_similarity_ceilings.json records, per pack and page
 * kind, how many pairs were over the limit and the worst similarity when the
 * generator was last fixed (7 Nov 2026). The build fails when either gets worse;
 * lower the ceiling whenever a fix lowers the measure, never raise it. A pack or
 * kind with no ceiling must have no pair over the limit at all. Zero pages of a
 * kind is a failure, not a pass.
 *
 * Usage: node scripts/validation/cross_page_similarity_contract.js [--self-test]
 */
const fs = require('fs');
const path = require('path');
const { pairwiseSimilarity } = require('../lib/template_text');

const ROOT = path.join(__dirname, '..', '..');
const LIMIT = 0.5;
const WORST_SLACK = 0.02;
const KINDS = ['city', 'next-steps'];

function packKey() {
  try {
    const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
    const m = String(site.pageSetFile || '').match(/([a-z_]+)_v1\.json$/);
    return m ? m[1] : '';
  } catch (_) { return ''; }
}

/** City pages are /<slug>/ dirs that have a next-steps child; next-steps are those children. */
function pagesOf(distDir) {
  const out = { city: [], 'next-steps': [] };
  if (!fs.existsSync(distDir)) return out;
  for (const e of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!e.isDirectory() || ['states', 'guides', 'next-steps'].includes(e.name)) continue;
    const city = path.join(distDir, e.name, 'index.html');
    const ns = path.join(distDir, e.name, 'next-steps', 'index.html');
    if (!fs.existsSync(city) || !fs.existsSync(ns)) continue;
    const ch = fs.readFileSync(city, 'utf8');
    const nh = fs.readFileSync(ns, 'utf8');
    // A noindex page is not in the sitemap, so the audit never samples it.
    if (!/content=["'][^"']*noindex/i.test(ch)) out.city.push({ id: e.name, html: ch });
    if (!/content=["'][^"']*noindex/i.test(nh)) out['next-steps'].push({ id: e.name, html: nh });
  }
  return out;
}

function loadCeilings(pack) {
  const fp = path.join(ROOT, 'data', 'contracts', 'cross_page_similarity_ceilings.json');
  if (!fs.existsSync(fp)) return {};
  const doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return (doc.packs && doc.packs[pack]) || {};
}

/** pages: { city: [{id, html}], 'next-steps': [...] }; ceilings: { kind: { pairs_over, worst } } */
function check(pages, ceilings) {
  const bad = [];
  const measured = {};
  for (const kind of KINDS) {
    const list = pages[kind] || [];
    if (list.length < 2) { bad.push(`no ${kind} pages to compare (${list.length}): nothing was checked, which is not a pass`); continue; }
    const pairs = pairwiseSimilarity(list);
    const over = pairs.filter((p) => p.sim > LIMIT);
    const worst = pairs[0];
    measured[kind] = { pages: list.length, pairs_over: over.length, worst: Number(worst.sim.toFixed(3)), worst_pair: worst.a + ' / ' + worst.b };
    const c = (ceilings || {})[kind];
    const show = over.slice(0, 5).map((p) => `/${p.a}/ ~ /${p.b}/ ${p.sim.toFixed(3)}`).join('; ');
    if (!c) {
      if (over.length) bad.push(`${kind}: ${over.length} pair(s) more than ${LIMIT} alike and no recorded ceiling (${show}); give each page facts only it can carry, or fold one into the other`);
      continue;
    }
    if (over.length > Number(c.pairs_over)) bad.push(`${kind}: ${over.length} pairs over ${LIMIT}, more than the recorded ceiling of ${c.pairs_over} (${show})`);
    if (worst.sim > Number(c.worst) + WORST_SLACK) bad.push(`${kind}: most alike pair /${worst.a}/ ~ /${worst.b}/ is ${worst.sim.toFixed(3)}, worse than the recorded ${c.worst}`);
  }
  return { bad, measured };
}

function selfTest() {
  const body = (words) => `<html><body><main>${words}</main></body></html>`;
  const shared = Array.from({ length: 200 }, (_, i) => 'shared' + i).join(' ');
  const own = (k) => Array.from({ length: 200 }, (_, i) => k + i).join(' ');
  const distinct = [{ id: 'a-xx', html: body(own('a')) }, { id: 'b-xx', html: body(own('b')) }];
  const twins = { city: [{ id: 'a-xx', html: body(shared + ' x') }, { id: 'b-xx', html: body(shared + ' y') }], 'next-steps': distinct };
  if (!check(twins, {}).bad.length) throw new Error('self-test: two identical city pages passed with no ceiling');
  if (check(twins, { city: { pairs_over: 1, worst: 0.99 } }).bad.length) throw new Error('self-test: twins inside their recorded ceiling failed');
  if (!check(twins, { city: { pairs_over: 0, worst: 0.99 } }).bad.length) throw new Error('self-test: more pairs than the ceiling passed');
  if (!check(twins, { city: { pairs_over: 1, worst: 0.6 } }).bad.length) throw new Error('self-test: a worse pair than the ceiling passed');
  if (!check({ city: [], 'next-steps': [] }, {}).bad.length) throw new Error('self-test: zero pages passed');
  if (check({ city: distinct, 'next-steps': distinct }, {}).bad.length) throw new Error('self-test: distinct pages failed');
  console.log('✅ cross-page similarity self-test pass (twins fail, ceilings hold both ways, zero pages fail, distinct pages pass)');
}

function run() {
  if (process.argv.includes('--self-test')) return selfTest();
  const pack = packKey();
  const pages = pagesOf(path.join(ROOT, 'dist'));
  const { bad, measured } = check(pages, loadCeilings(pack));
  // CROSS_PAGE_SIMILARITY_REPORT=<file>: append this pack's measure as one JSON
  // line, so a full build yields every pack's numbers (the tier runner hides a
  // passing validator's output). Used to set the ceilings.
  if (process.env.CROSS_PAGE_SIMILARITY_REPORT) fs.appendFileSync(process.env.CROSS_PAGE_SIMILARITY_REPORT, JSON.stringify({ pack, measured }) + '\n');
  const line = KINDS.map((k) => measured[k] ? `${k} ${measured[k].pages} pages, ${measured[k].pairs_over} pairs over ${LIMIT}, worst ${measured[k].worst_pair} ${measured[k].worst}` : `${k} n/a`).join('; ');
  if (bad.length) {
    console.error(`CROSS PAGE SIMILARITY FAIL (${pack || 'unknown pack'}): ${line}`);
    bad.forEach((b) => console.error(' - ' + b));
    process.exit(1);
  }
  console.log(`✅ CROSS PAGE SIMILARITY PASS (${pack}): ${line}`);
}

module.exports = { run, check, pagesOf, LIMIT };
if (require.main === module) run();
