#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: memphisseniorcarehomes.com carries its own thick family guides.
 *
 * Source (always): the 12 guide routes the owner fixed (velocity links to them)
 * each exist in data/page_sets/examples/senior_living_global_pages with at
 * least MIN_WORDS words of body text (main_html plus its visible FAQ), 6-10
 * visible FAQ questions, the intake slot once, and no dollar figure that
 * data/research/costs/sources.json does not name. The /guides/ hub and /faq/
 * exist, and /faq/ answers 25 questions.
 * Build (when dist/ holds the senior-living pack): every pinned path is built,
 * each guide renders its FAQ visibly, and every question in its FAQPage schema
 * is visible on the page.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'page_sets', 'examples', 'senior_living_global_pages');
const DIST = path.join(ROOT, 'dist');
const MIN_GUIDES = 12;
const MIN_WORDS = 1800;
const ROUTES = [
  '/guides/how-to-choose-a-senior-care-home-memphis/', '/guides/levels-of-care-tennessee/',
  '/guides/assisted-living-cost-memphis/', '/guides/how-families-pay-for-assisted-living/',
  '/guides/memory-care-when-is-it-time/', '/guides/activities-of-daily-living-care-levels/',
  '/guides/questions-to-ask-on-a-tour/', '/guides/tennessee-assisted-living-inspection-records/',
  '/guides/residency-agreement-fees-and-rules/', '/guides/hospital-discharge-to-assisted-living-memphis/',
  '/guides/when-a-parent-refuses-to-move/', '/guides/when-the-money-runs-out-tenncare-choices/',
];
const PINNED = ['/guides/', '/faq/', ...ROUTES];
const MONEY = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;
const text = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/%%[A-Z_]+%%/g, ' ');
const words = (h) => text(h).split(/\s+/).filter(Boolean).length;

function checkGuides(pages, allowedMoney) {
  const out = [];
  const byRoute = new Map(pages.map((p) => [p.route, p]));
  const guides = pages.filter((p) => /^\/guides\/.+\/$/.test(p.route));
  if (guides.length < MIN_GUIDES) out.push(`${guides.length} senior-living guides; the floor is ${MIN_GUIDES}`);
  for (const r of ROUTES) if (!byRoute.has(r)) out.push(`pinned guide ${r} has no source page`);
  for (const g of guides) {
    const faq = (g.search_strengthening && g.search_strengthening.faq) || [];
    const faqText = faq.map((x) => `${x.q} ${x.a}`).join(' ');
    const n = words(g.main_html) + words(faqText);
    if (n < MIN_WORDS) out.push(`${g.route}: ${n} body words; the floor is ${MIN_WORDS}`);
    if (faq.length < 6 || faq.length > 10) out.push(`${g.route}: ${faq.length} visible FAQ questions; need 6-10`);
    if (faq.some((x) => !String(x.q).trim().endsWith('?') || !String(x.a).trim())) out.push(`${g.route}: every FAQ needs a question ending in ? and an answer`);
    if ((String(g.main_html).match(/%%SENIOR_INTAKE%%/g) || []).length !== 1) out.push(`${g.route}: the intake slot must appear exactly once`);
    if (!/id="quick-answer"/.test(g.main_html) || !/id="next-steps"/.test(g.main_html)) out.push(`${g.route}: missing the quick-answer or next-steps section`);
    for (const m of `${g.main_html} ${faqText}`.matchAll(MONEY)) if (!allowedMoney.has(m[0])) out.push(`${g.route}: ${m[0]} is not named in data/research/costs/sources.json`);
  }
  const faqPage = byRoute.get('/faq/');
  if (!faqPage) out.push('/faq/ has no source page');
  else {
    const n = (String(faqPage.main_html).match(/data-senior-faq="true"/g) || []).length;
    if (n < 25) out.push(`/faq/ answers ${n} questions; need 25`);
    for (const m of String(faqPage.main_html).matchAll(MONEY)) if (!allowedMoney.has(m[0])) out.push(`/faq/: ${m[0]} is not named in sources.json`);
  }
  if (!byRoute.has('/guides/')) out.push('/guides/ hub has no source page');
  return out;
}

const problems = [];
const pages = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const allowedMoney = new Set([...fs.readFileSync(path.join(ROOT, 'data', 'research', 'costs', 'sources.json'), 'utf8').matchAll(MONEY)].map((m) => m[0]));
problems.push(...checkGuides(pages, allowedMoney));

// Built output, when the active pack is senior-living.
let built = 0;
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
if (/senior_living_v1\.json$/.test(String(site.pageSetFile || '')) && fs.existsSync(path.join(DIST, 'index.html'))) {
  for (const r of PINNED) {
    const f = path.join(DIST, r.replace(/^\/|\/$/g, ''), 'index.html');
    if (!fs.existsSync(f)) { problems.push(`${r} is not in the build`); continue; }
    built += 1;
    if (!r.startsWith('/guides/') || r === '/guides/') continue;
    const html = fs.readFileSync(f, 'utf8');
    if (!html.includes('data-search-faq="true"')) problems.push(`${r}: built page has no visible FAQ section`);
    if ((html.match(/id="senior-intake"/g) || []).length !== 1) problems.push(`${r}: built page must carry the intake slot exactly once`);
    const visible = text(html.replace(/<script[\s\S]*?<\/script>/g, ' ')).replace(/\s+/g, ' ');
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let data; try { data = JSON.parse(m[1]); } catch { continue; }
      for (const node of [].concat(data)) {
        if (!node || node['@type'] !== 'FAQPage') continue;
        for (const q of [].concat(node.mainEntity || [])) {
          const name = String(q.name || '').replace(/\s+/g, ' ').trim();
          if (name && !visible.includes(name)) problems.push(`${r}: FAQPage question "${name.slice(0, 60)}" is not visible on the page`);
        }
      }
    }
  }
}

// Negative proof every run: a thin guide with an unsourced figure must fail.
const hostile = checkGuides([{ route: '/guides/x/', main_html: '<h2 id="quick-answer">Q</h2><p>It costs $9,999.</p>', search_strengthening: { faq: [] } }], allowedMoney);
if (!hostile.some((p) => p.includes('$9,999')) || !hostile.some((p) => p.includes('body words'))) problems.push('negative proof no longer caught: thin guide with an unsourced figure');

if (problems.length) {
  console.error('SENIOR LIVING GUIDES CONTRACT FAIL');
  problems.slice(0, 40).forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
const guides = pages.filter((p) => /^\/guides\/.+\/$/.test(p.route));
const avg = Math.round(guides.reduce((a, g) => a + words(g.main_html) + words(((g.search_strengthening || {}).faq || []).map((x) => `${x.q} ${x.a}`).join(' ')), 0) / guides.length);
console.log(`✅ SENIOR LIVING GUIDES CONTRACT PASS (${guides.length} guides, average ${avg} words, ${built ? built + ' pinned paths built' : 'source only; senior pack not in dist'})`);
