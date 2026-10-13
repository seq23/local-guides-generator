#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the memphisseniorcarehomes.com build is the site the owner decided.
 *
 * Source (always): the city fence is exactly the 15 cities and 4 hospital pages.
 * Build (when dist/ holds the senior-living pack):
 *  - no city page outside the fence (the shared top-10 national cities leaked
 *    into every pack until citiesExclusive);
 *  - the intake slot, byte for byte, on home, every city/hospital page and
 *    /request-assistance/; its script is never blocked by a CSP;
 *  - /_seat.json publishes only {active, end}; /data/facilities.json is the
 *    committed directory;
 *  - /for-providers/ lists exactly the three products at their prices;
 *  - the referral disclosure in every footer and beside every directory;
 *  - thin-page rule: >= 600 words of page-specific content on every city page
 *    (intro, directory, local section), and a directory ItemList whose
 *    LocalBusiness nodes match the visible rows;
 *  - WebSite alternateName, robots.txt allows the AI search agents and names
 *    the sitemap, llms.txt explains the site in under 2,000 words, and the
 *    legal pages are noindex.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const FENCE = ['memphis-tn', 'east-memphis-tn', 'germantown-tn', 'collierville-tn', 'bartlett-tn', 'cordova-tn', 'arlington-tn', 'lakeland-tn', 'millington-tn', 'southaven-ms', 'olive-branch-ms', 'horn-lake-ms', 'hernando-ms', 'west-memphis-ar', 'marion-ar', 'baptist-memorial-hospital-memphis', 'methodist-university-hospital', 'saint-francis-hospital-park-avenue', 'regional-one-health'];
const MIN_CITY_WORDS = 600;
const PRICES = ['$249/month', '$800', "One month's rent"];
const AI_AGENTS = ['OAI-SearchBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'];
const problems = [];
const read = (f) => fs.readFileSync(f, 'utf8');
const text = (h) => String(h || '').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
const words = (h) => text(h).split(/\s+/).filter(Boolean).length;
const slot = (city, zip) => `<div id="senior-intake" data-vertical="senior-living" data-city="${city}" data-zip="${zip}"></div><script src="/assets/senior-intake.js" defer></script>`;
const section = (html, attr) => { const m = html.match(new RegExp(`<section[^>]*${attr}[^>]*>[\\s\\S]*?</section>`)); return m ? m[0] : ''; };

const cities = JSON.parse(read(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_senior_living_v1.json')));
const slugs = cities.map((c) => c.slug);
if (JSON.stringify([...slugs].sort()) !== JSON.stringify([...FENCE].sort())) problems.push(`cities_senior_living_v1.json is not the fence: ${slugs.join(', ')}`);
const pageSet = JSON.parse(read(path.join(ROOT, 'data', 'page_sets', 'examples', 'senior_living_v1.json')));
if (pageSet.citiesExclusive !== true) problems.push('senior_living_v1.json must set citiesExclusive: true');

const site = JSON.parse(read(path.join(ROOT, 'data', 'site.json')));
let checkedPages = 0;
if (/senior_living_v1\.json$/.test(String(site.pageSetFile || '')) && fs.existsSync(path.join(DIST, 'index.html'))) {
  const page = (rel) => { const f = path.join(DIST, rel, 'index.html'); return fs.existsSync(f) ? read(f) : null; };
  // Fence in the build: every top-level dir that is a city page must be fenced.
  for (const d of fs.readdirSync(DIST, { withFileTypes: true })) {
    if (!d.isDirectory() || !/-(tn|ms|ar|[a-z]{2})$/.test(d.name)) continue;
    if (!FENCE.includes(d.name) && fs.existsSync(path.join(DIST, d.name, 'index.html'))) problems.push(`city page /${d.name}/ is outside the fence`);
  }
  const home = page('');
  if (!home || !home.includes(slot('memphis-tn', '38104'))) problems.push('home page lacks the exact intake slot');
  if (!home || !/"alternateName":\s*\[\s*"memphis senior care homes",\s*"memphis senior guide"\s*\]/.test(home)) problems.push('home WebSite schema lacks the alternateName brand spellings');
  const ra = page('request-assistance');
  if (!ra || !ra.includes(slot('memphis-tn', '38104'))) problems.push('/request-assistance/ lacks the exact intake slot');
  for (const c of cities) {
    const h = page(c.slug);
    if (!h) { problems.push(`/${c.slug}/ not built`); continue; }
    checkedPages += 1;
    if (!h.includes(slot(c.slug, c.primary_zip))) problems.push(`/${c.slug}/ lacks the exact intake slot`);
    if (!h.includes('data-senior-listing-disclosure="true"')) problems.push(`/${c.slug}/ lacks the disclosure beside the directory`);
    const own = section(h, 'data-senior-city-intro') + section(h, 'data-senior-directory="true"') + section(h, 'data-senior-local="true"');
    const n = words(own);
    if (n < MIN_CITY_WORDS) problems.push(`/${c.slug}/ has ${n} words of page-specific content; the floor is ${MIN_CITY_WORDS}`);
    const rows = (h.match(/<tr data-facility-license=/g) || []).length;
    const ld = (h.match(/<script type="application\/ld\+json" data-senior-directory-ld="true">([\s\S]*?)<\/script>/) || [])[1];
    if (!ld) { problems.push(`/${c.slug}/ has no directory ItemList`); continue; }
    const list = JSON.parse(ld);
    if (list['@type'] !== 'ItemList' || list.numberOfItems !== rows || list.itemListElement.length !== rows) problems.push(`/${c.slug}/ ItemList has ${list.itemListElement.length} items for ${rows} visible rows`);
    for (const el of list.itemListElement) {
      const b = el.item || {};
      if (b['@type'] !== 'LocalBusiness' || !b.name || !b.telephone || !b.address || !b.address.postalCode || !b.hasMap || !b.areaServed || !['AssistedLivingFacility', 'MemoryCareFacility'].includes(b.additionalType)) problems.push(`/${c.slug}/ LocalBusiness "${b.name}" is missing a required field`);
      const phone = String(b.telephone || '').replace(/^\+1-/, '');
      if (!h.includes(phone)) problems.push(`/${c.slug}/ LocalBusiness "${b.name}" phone ${phone} is not visible`);
    }
  }
  for (const f of walk(DIST)) {
    if (!f.endsWith('.html') || /admin\//.test(f)) continue;
    const h = read(f);
    if (h.includes('<footer') && !h.includes('data-senior-disclosure="true"')) problems.push(`${path.relative(DIST, f)} footer lacks the referral disclosure`);
    if (/http-equiv=["']Content-Security-Policy/i.test(h)) problems.push(`${path.relative(DIST, f)} sets a CSP meta tag that could block /assets/senior-intake.js`);
  }
  const headers = path.join(DIST, '_headers');
  if (fs.existsSync(headers) && /Content-Security-Policy/i.test(read(headers)) && !/script-src[^\n]*'self'/.test(read(headers))) problems.push("_headers CSP has no script-src 'self'; /assets/senior-intake.js would be blocked");
  const seatFile = path.join(DIST, '_seat.json');
  if (!fs.existsSync(seatFile)) problems.push('/_seat.json not published');
  else {
    const seat = JSON.parse(read(seatFile));
    const extra = Object.keys(seat).filter((k) => !['active', 'end'].includes(k));
    if (typeof seat.active !== 'boolean' || extra.length) problems.push(`/_seat.json must publish only {active, end}; has ${Object.keys(seat).join(', ')}`);
  }
  const pub = path.join(DIST, 'data', 'facilities.json');
  if (!fs.existsSync(pub) || read(pub) !== read(path.join(ROOT, 'data', 'listings', 'senior-living', 'facilities.json'))) problems.push('/data/facilities.json is missing or differs from the committed directory');
  const fp = page('for-providers') || '';
  const products = (fp.match(/data-senior-product="/g) || []).length;
  if (products !== 3) problems.push(`/for-providers/ lists ${products} products; exactly 3`);
  for (const p of PRICES) if (!fp.includes(p.replace(/'/g, '&#39;')) && !fp.includes(p)) problems.push(`/for-providers/ lacks the price "${p}"`);
  const robots = fs.existsSync(path.join(DIST, 'robots.txt')) ? read(path.join(DIST, 'robots.txt')) : '';
  for (const a of AI_AGENTS) if (!new RegExp(`User-agent: ${a}\\s*\\nAllow: /`).test(robots)) problems.push(`robots.txt does not Allow ${a}`);
  if (!/^Sitemap: https:\/\/memphisseniorcarehomes\.com\/sitemap\.xml/m.test(robots)) problems.push('robots.txt lacks the Sitemap line');
  const llms = fs.existsSync(path.join(DIST, 'llms.txt')) ? read(path.join(DIST, 'llms.txt')) : '';
  if (!llms.includes('## About this site') || !llms.includes('## How to cite')) problems.push('llms.txt lacks the about and how-to-cite sections');
  if (llms.split(/\s+/).length >= 2000) problems.push('llms.txt is 2,000 words or more');
  for (const legal of ['privacy', 'disclaimer']) {
    const h = page(legal) || '';
    if (!/<meta name="robots" content="noindex/.test(h)) problems.push(`/${legal}/ is not noindex`);
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else out.push(f);
  }
  return out;
}

if (problems.length) {
  console.error('SENIOR LIVING SITE CONTRACT FAIL');
  problems.slice(0, 40).forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`✅ SENIOR LIVING SITE CONTRACT PASS (fence of ${FENCE.length} pages${checkedPages ? `; ${checkedPages} city/hospital pages checked in the build` : '; source only, senior pack not in dist'})`);
