#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the impressions-weighted strengthening rule holds, at source and
 * in the rendered pages.
 *
 *  1. data/search_intelligence/<host>/demand_families.json is fresh and
 *     consistent: same collected_at and window as that site's Search Console
 *     export, and identical to what scripts/search_intelligence/demand_families.js
 *     computes from the export now (so a hand edit, a stale file, or a rule
 *     change without a rebuild all fail).
 *  2. Every top-5 family (and every family that qualifies) is either
 *     strengthened or carries a recorded reason (intent_mismatch, no_page,
 *     position_beyond_max, below_impression_floor). "not_strengthened" fails:
 *     demand that qualifies is served, not listed.
 *  3. Each strengthening source has a 40-60 word definition, >= 2 FAQ, and a
 *     title that shares >= 2 words with its query.
 *  4. In dist/ (the active pack's host): every strengthened page exists, its H1
 *     is the strengthened one, it carries the definition and FAQ markers, and it
 *     has exactly ONE FAQPage whose questions include all of the page's FAQ.
 *     No page on the host carries more than one FAQPage.
 */
const fs = require('fs');
const path = require('path');
const DF = require('../search_intelligence/demand_families');
const { ROOT, DIST, activeHost, pages } = require('./lib_site_dist');

function fail(msg) { console.error(`DEMAND FAMILIES FAIL: ${msg}`); process.exit(1); }
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const words = (s) => String(s).split(/\s+/).filter(Boolean).length;
const sig = (x) => new Set(String(x).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 3));
const aligned = (title, query) => { const q = sig(query); return [...sig(title)].filter((w) => q.has(w)).length >= 2; };

const sites = read('data/search_intelligence/sites.json').sites;
if (!sites.length) fail('sites.json lists no site');
const strengthenedGuides = read('data/search_intelligence/strengthened_pages.json').pages;
let families = 0; let served = 0;
const expectByHost = new Map();

for (const site of sites) {
  const dir = `data/search_intelligence/${site.host}`;
  if (site.awaiting_gsc && !fs.existsSync(path.join(ROOT, dir, 'gsc_search_analytics_export.json'))) {
    console.log(`NAMED STOP: ${site.host} awaiting Search Console access (${site.awaiting_gsc}); no families until the first export`);
    continue;
  }
  const file = path.join(ROOT, dir, 'demand_families.json');
  if (!fs.existsSync(file)) fail(`${dir}/demand_families.json missing (run scripts/search_intelligence/build_search_plan.mjs)`);
  const doc = read(`${dir}/demand_families.json`);
  const gsc = read(`${dir}/gsc_search_analytics_export.json`);
  if (doc.gsc_collected_at !== gsc.collected_at || doc.gsc_window !== `${gsc.start_date}..${gsc.end_date}`) {
    fail(`${dir}/demand_families.json is from ${doc.gsc_collected_at} (${doc.gsc_window}); the export is ${gsc.collected_at}: rebuild it`);
  }
  const want = DF.buildDocument(site, gsc);
  if (JSON.stringify(want) !== JSON.stringify(doc)) fail(`${dir}/demand_families.json differs from what demand_families.js computes from the export and sources: rebuild it`);
  if (!doc.families.length && (gsc.rows || []).some((r) => r.impressions > 0)) fail(`${site.host}: export has impressions but zero families`);
  families += doc.families.length;

  const expect = [];
  for (const f of doc.families) {
    if (!(f.rank <= DF.RULE.top_n || f.qualifies)) continue;
    if (!DF.SERVED.has(f.status) || !f.reason) fail(`${site.host} family "${f.family}" (rank ${f.rank}, ${f.impressions} impressions) is ${f.status}: strengthen ${f.strengthened_pages.join(', ') || f.page} or record why not`);
    served++;
    if (f.status !== 'strengthened') continue;
    if (f.page_kind === 'guide') {
      const row = strengthenedGuides.find((p) => p.host === site.host && p.route === f.page);
      const page = read(row.source);
      const s = page.search_strengthening;
      if (words(s.definition) < 40 || words(s.definition) > 60) fail(`${row.source} definition is ${words(s.definition)} words (40-60)`);
      if (!(s.faq.length >= 2)) fail(`${row.source} needs >= 2 FAQ`);
      if (!aligned(page.title, s.query)) fail(`${row.source} title "${page.title}" is not aligned to "${s.query}"`);
      expect.push({ route: f.page, h1: page.title, faq: s.faq.map((x) => x.q) });
    } else {
      const t = DF.stateHubTemplate(site);
      const longest = 'South Carolina';
      const def = t.definition.split('%%STATE%%').join(longest);
      if (words(def) < 40 || words(def) > 60) fail(`${DF.packPageSetFile(site)} state_hub definition is ${words(def)} words (40-60)`);
      if (!aligned(t.title, t.query)) fail(`${DF.packPageSetFile(site)} state_hub title is not aligned to "${t.query}"`);
      for (const route of f.strengthened_pages) {
        const ab = route.split('/')[2];
        expect.push({ route, state: ab, template: t });
      }
    }
  }
  expectByHost.set(site.host, expect);
}

// Rendered output for the active pack.
const host = activeHost();
const expect = expectByHost.get(host);
if (!expect) { console.log(`DEMAND FAMILIES PASS (${sites.length} sites, ${families} families, ${served} top/qualifying served); dist: NAMED SKIP - ${host} is not a search site`); process.exit(0); }
const all = pages(fail);
const ldNodes = (html) => {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch (_) { continue; }
    const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { out.push(n); if (n['@graph']) walk(n['@graph']); } };
    walk(d);
  }
  return out;
};
const multi = all.filter((p) => ldNodes(p.html).filter((n) => n['@type'] === 'FAQPage').length > 1).map((p) => p.file);
if (multi.length) fail(`${multi.length} page(s) carry more than one FAQPage: ${multi.slice(0, 5).join(', ')}`);
const byFile = new Map(all.map((p) => [p.file, p.html]));
for (const e of expect) {
  const fileRel = path.join(e.route.replace(/^\/|\/$/g, ''), 'index.html');
  const html = byFile.get(fileRel);
  if (!html) fail(`${host}${e.route} is strengthened but ${path.relative(ROOT, DIST)}/${fileRel} was not rendered`);
  const h1 = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").trim();
  let wantH1 = e.h1; let wantFaq = e.faq;
  if (e.template) {
    const name = (html.match(/data-search-strengthening="state_hub"><h2>How to choose [^<]* in ([^<]+)<\/h2>/) || [])[1];
    if (!name) fail(`${host}${e.route} lacks the state-hub strengthening section`);
    const fill = (s) => s.split('%%STATE%%').join(name);
    wantH1 = fill(e.template.h1); wantFaq = e.template.faq.map((x) => fill(x.q));
  }
  if (h1 !== wantH1) fail(`${host}${e.route} H1 "${h1}" is not the strengthened "${wantH1}"`);
  if (!html.includes('data-search-definition="true"') || !html.includes('data-search-faq="true"')) fail(`${host}${e.route} lacks the definition or FAQ block`);
  const faqs = ldNodes(html).filter((n) => n['@type'] === 'FAQPage');
  if (faqs.length !== 1) fail(`${host}${e.route} has ${faqs.length} FAQPage nodes; exactly one`);
  const names = new Set([].concat(faqs[0].mainEntity || []).map((q) => q.name));
  const missing = wantFaq.filter((q) => !names.has(q));
  if (missing.length) fail(`${host}${e.route} FAQPage is missing "${missing[0]}"`);
}
console.log(`DEMAND FAMILIES PASS (${sites.length} sites, ${families} families, ${served} top/qualifying served; ${host}: ${expect.length} strengthened pages rendered with one FAQPage, ${all.length} pages <= 1 FAQPage)`);
