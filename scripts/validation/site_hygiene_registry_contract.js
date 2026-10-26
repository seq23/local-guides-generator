#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: reads data/contracts/site_hygiene_registry.json and proves the
 * registered site-hygiene layer is still wired - every installer runs in both
 * build paths, every registered validator sits in the hard_fail tier, every
 * committed source, brand file, home definition and the IndexNow key file
 * exists, and the Clarity map matches the registered ids. A rebuild or content
 * cycle that drops any of it fails here before it ships.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
function fail(msg) { console.error(`SITE HYGIENE REGISTRY FAIL: ${msg}`); process.exit(1); }
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const reg = JSON.parse(read('data/contracts/site_hygiene_registry.json'));
const pkg = JSON.parse(read('package.json'));
const buildCmd = `${pkg.scripts.build} && ${pkg.scripts.postbuild}`;
const allPacks = read('scripts/build_all_packs.js');
for (const step of reg.build_steps) {
  if (!fs.existsSync(path.join(ROOT, step))) fail(`${step} missing`);
  if (!buildCmd.includes(step)) fail(`npm run build no longer runs ${step}`);
  if (!allPacks.includes(`'${step}'`)) fail(`scripts/build_all_packs.js no longer runs ${step}`);
}
const tiers = JSON.parse(read('data/contracts/validator_tiering_policy.json'));
for (const [item, v] of Object.entries(reg.validators)) {
  if (!fs.existsSync(path.join(ROOT, v))) fail(`${item} validator ${v} missing`);
  if (!tiers.hard_fail.includes(v)) fail(`${item} validator ${v} is not in the hard_fail tier`);
}
for (const s of reg.sources) if (!fs.existsSync(path.join(ROOT, s))) fail(`registered source ${s} missing`);
const brand = JSON.parse(read('data/site_brand_assets.json'));
for (const host of Object.keys(reg.clarity_projects)) {
  if (!brand.hosts[host]) fail(`no brand set for ${host}`);
  for (const f of brand.files) if (!fs.existsSync(path.join(ROOT, 'brand', host, f))) fail(`brand/${host}/${f} missing`);
}
const clarity = JSON.parse(read('data/clarity_projects.json')).projects || {};
for (const [host, id] of Object.entries(reg.clarity_projects)) if (clarity[host] !== id) fail(`clarity ${host}=${clarity[host]}, registered ${id}`);
if (!fs.existsSync(path.join(ROOT, reg.indexnow_key_file))) fail(`IndexNow key file ${reg.indexnow_key_file} not committed`);
const homes = fs.readdirSync(path.join(ROOT, 'data/page_sets/examples')).filter((d) => /_global_pages$/.test(d) && !/^starter/.test(d));
for (const d of homes) {
  const p = path.join(ROOT, 'data/page_sets/examples', d, 'home.json');
  if (fs.existsSync(p) && !read(path.relative(ROOT, p)).includes(reg.homepage_definition_marker.replace(/"/g, '\\"'))) fail(`${d}/home.json lost its definition paragraph`);
}
console.log(`SITE HYGIENE REGISTRY CONTRACT PASS (${reg.build_steps.length} steps, ${Object.keys(reg.validators).length} validators, ${homes.length} homes)`);

// Search-demand repoint (11 Oct 2026): every file and step registered under
// search_intelligence is present and wired, the per-site Search Console truth is
// fresh and internally consistent, every target carries a measured number, the
// freeze flag is read by the publisher, strengthened pages carry what makes them
// strengthened, and each audience CTA ref is the same in the registry and the
// click endpoint.
{
  const si = reg.search_intelligence;
  if (!si) fail('search_intelligence block missing from the registry');
  const wf = read(si.workflow);
  for (const step of si.workflow_steps) {
    if (!fs.existsSync(path.join(ROOT, step))) fail(`${step} missing`);
    if (!wf.includes(step)) fail(`${si.workflow} no longer runs ${step}`);
  }
  if (!new RegExp(`git add [^\\n]*${si.workflow_commits.replace(/\//g, '\\/')}`).test(wf)) fail(`${si.workflow} no longer commits ${si.workflow_commits}`);
  for (const s of si.sources) if (!fs.existsSync(path.join(ROOT, s))) fail(`search source ${s} missing`);
  const sites = JSON.parse(read('data/search_intelligence/sites.json')).sites;
  if (!sites.length) fail('sites.json lists no site');
  const maxAge = si.freshness_days * 86400000;
  let targets = 0;
  let foldedTotal = 0;
  const packDir = path.join(ROOT, 'data/page_sets/examples');
  const redirectRows = fs.readdirSync(packDir).filter((f) => /^[a-z_]+_v1\.json$/.test(f) && !f.startsWith('cities_'))
    .flatMap((f) => JSON.parse(read(`data/page_sets/examples/${f}`)).legacyRedirects || []);
  for (const site of sites) {
    const dir = `data/search_intelligence/${site.host}`;
    // A newly added property is measured from the day Search Console grants the
    // service account access; until the daily cycle writes its first export it
    // is a NAMED STOP that clears itself (the flag is ignored once files exist).
    if (site.awaiting_gsc && !fs.existsSync(path.join(ROOT, dir, 'gsc_search_analytics_export.json'))) {
      console.log(`NAMED STOP: ${site.host} not yet readable in Search Console (${site.awaiting_gsc}); its per-site files appear on the first daily run after access`);
      continue;
    }
    for (const f of si.per_site_files) if (!fs.existsSync(path.join(ROOT, dir, f))) fail(`${dir}/${f} missing`);
    const j = (f) => JSON.parse(read(`${dir}/${f}`));
    const cov = j('index_coverage.json');
    const gsc = j('gsc_search_analytics_export.json');
    for (const [name, at] of [['index_coverage.json', cov.collected_at], ['gsc_search_analytics_export.json', gsc.collected_at]]) {
      if (!(Date.now() - Date.parse(at) <= maxAge)) fail(`${dir}/${name} is stale (collected_at ${at}, limit ${si.freshness_days} days): the daily cycle stopped measuring`);
    }
    const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
    const n = cov.urls.length;
    if (sum(cov.summary.by_coverage_state) !== n || sum(cov.summary.buckets) !== n || cov.inspected_total !== n) fail(`${dir}/index_coverage.json counts disagree with its ${n} rows`);
    if (cov.inspected_total + cov.never_inspected !== cov.sitemap_url_count) fail(`${dir}/index_coverage.json inspected + never_inspected != sitemap_url_count`);
    if (cov.inspected_this_run > si.inspect_cap_per_site) fail(`${dir}/index_coverage.json inspected ${cov.inspected_this_run} > cap ${si.inspect_cap_per_site}`);
    const tq = j('target_query_set.json');
    if (tq.target_count !== tq.targets.length) fail(`${dir}/target_query_set.json target_count disagrees with its rows`);
    for (const t of tq.targets) {
      if (!['gsc_export', 'measured_demand'].includes(t.source) || !(Number(t.measurement && t.measurement.value) > 0)) fail(`${dir} target "${t.query}" has no measured number`);
    }
    targets += tq.targets.length;
    const cc = j('consolidation_candidates.json');
    if (cc.status !== 'LEDGER_ONLY_NO_REDIRECTS' || cc.candidates.some((c) => !c.fold_into)) fail(`${dir}/consolidation_candidates.json must be a ledger with a fold_into per candidate`);
    // A folded guide must really be gone: a 301 in its pack to the recorded target.
    for (const c of cc.folded || []) {
      const from = String(c.route || '').replace(/\/+$/, '');
      const hit = redirectRows.find((r) => String(r.from || '').replace(/\/+$/, '') === from);
      if (!c.redirect_to || !hit) fail(`${dir}: folded ${c.route} has no legacyRedirects row in any pack`);
      if (hit.to !== c.redirect_to) fail(`${dir}: folded ${c.route} redirects to ${hit.to}, ledger says ${c.redirect_to}`);
      if (fs.existsSync(path.join(ROOT, c.source))) fail(`${dir}: folded ${c.route} still has its source file ${c.source}`);
      foldedTotal += 1;
    }
  }
  if (targets === 0) fail('zero measured targets across all sites');
  console.log(`search intelligence: ${foldedTotal} folded guide(s) checked against pack redirects`);
  const freeze = JSON.parse(read(si.freeze_flag));
  if (typeof freeze.enabled !== 'boolean') fail(`${si.freeze_flag} enabled must be a boolean`);
  for (const r of si.freeze_readers) if (!read(r).includes('publishing_freeze.json') || !read(r).includes('FREEZE.enabled')) fail(`${r} no longer reads the publishing freeze`);
  const builder = read(si.builder);
  for (const call of si.builder_calls) if (!builder.includes(call)) fail(`${si.builder} no longer calls ${call}`);
  for (const p of JSON.parse(read('data/search_intelligence/strengthened_pages.json')).pages) {
    const page = JSON.parse(read(p.source));
    const s = page.search_strengthening || {};
    if (page.route !== p.route || !s.definition || !Array.isArray(s.faq) || s.faq.length < 2) fail(`${p.source} lost its search_strengthening (definition + >= 2 FAQ)`);
    const words = (x) => new Set(String(x).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 3));
    const q = words(s.query); const shared = [...words(page.title)].filter((w) => q.has(w)).length;
    if (shared < 2) fail(`${p.route} title "${page.title}" is not aligned to its query "${s.query}"`);
  }
  const ctas = JSON.parse(read('data/search_intelligence/audience_ctas.json')).ctas;
  const fnRefs = (read('functions/api/cta-clicks.js').match(/CTA_REFS = \[([^\]]*)\]/) || [])[1] || '';
  const refs = ctas.map((c) => c.ref);
  if (new Set(refs).size !== refs.length) fail('audience CTA refs are not unique');
  for (const r of refs) if (!fnRefs.includes(`'${r}'`)) fail(`functions/api/cta-clicks.js CTA_REFS is missing ${r}`);
  if ((fnRefs.match(/'/g) || []).length / 2 !== refs.length) fail('functions/api/cta-clicks.js CTA_REFS lists a ref the registry does not');
  for (const c of ctas) if (!c.cta_href.includes(`ref=${c.ref}`)) fail(`CTA ${c.ref} link does not carry its ref`);
  // Exactly one FAQPage after the merge, carrying the page's questions.
  const { mergeFaqIntoJsonLd } = require(path.join(ROOT, 'scripts/search_intelligence/render_blocks.js'));
  const head = '<script type="application/ld+json">\n' + JSON.stringify([{ '@type': 'WebPage' }, { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'q0' }] }]) + '\n</script>';
  const merged = JSON.parse(mergeFaqIntoJsonLd(head, { search_strengthening: { faq: [{ q: 'q1', a: 'a1' }, { q: 'q2', a: 'a2' }] } }).replace(/^[\s\S]*?<script[^>]*>|<\/script>[\s\S]*$/g, ''));
  const faqs = merged.filter((n) => n['@type'] === 'FAQPage');
  if (faqs.length !== 1 || faqs[0].mainEntity.length !== 3) fail(`FAQ merge produced ${faqs.length} FAQPage node(s); a page must carry exactly one`);
  console.log(`SEARCH INTELLIGENCE REGISTRY PASS (${sites.length} sites, ${targets} measured targets, ${ctas.length} CTAs)`);
}
