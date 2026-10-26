#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the memphisseniorcarehomes.com build is the site the owner decided.
 *
 * Source (always): the city fence is exactly the owner-approved pages: 15
 * towns, 8 Memphis neighbourhoods and 10 new towns (25 Oct 2026), 11 hospital
 * pages, and memory care + assisted living pages for the 7 biggest markets.
 * Extended 26 Oct 2026 by the four towns, three Memphis neighbourhoods and
 * three hospitals the Search Readiness coverage manifest names and this site
 * had never built (brief sr-memphisseniorcarehomes.com-j9): eads-tn, tunica-ms,
 * senatobia-ms, earle-ar; cooper-young, university-district and binghampton;
 * saint-francis-hospital-bartlett, methodist-olive-branch-hospital and
 * baptist-memorial-hospital-crittenden. Every one is inside the manifest's
 * 40-mile radius.
 * Every care-type page sits on its town's ZIP and centre.
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
 *  - hyperlocal (25 Oct 2026): every town, neighbourhood and hospital page
 *    links to >= 3 nearby area pages and to care-type pages; a memory care
 *    page lists only memory care rows and an assisted living page carries its
 *    own licensed-capacity facts; the home page links every fenced page and
 *    each state page every fenced page of its state; every page carries its
 *    own lead FAQ (no two pages share a first question and answer);
 *  - WebSite alternateName, robots.txt allows the AI search agents and names
 *    the sitemap, llms.txt explains the site in under 2,000 words, and the
 *    legal pages are noindex.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const FENCE = [
  'memphis-tn', 'east-memphis-tn', 'germantown-tn', 'collierville-tn', 'bartlett-tn', 'cordova-tn', 'arlington-tn', 'lakeland-tn', 'millington-tn', 'southaven-ms', 'olive-branch-ms', 'horn-lake-ms', 'hernando-ms', 'west-memphis-ar', 'marion-ar',
  'midtown-memphis-tn', 'downtown-memphis-tn', 'whitehaven-memphis-tn', 'raleigh-memphis-tn', 'frayser-memphis-tn', 'hickory-hill-memphis-tn', 'berclair-memphis-tn', 'parkway-village-memphis-tn',
  'cooper-young-memphis-tn', 'university-district-memphis-tn', 'binghampton-memphis-tn',
  'oakland-tn', 'atoka-tn', 'munford-tn', 'covington-tn', 'brighton-tn', 'somerville-tn', 'rossville-tn', 'nesbit-ms', 'walls-ms', 'byhalia-ms',
  'eads-tn', 'tunica-ms', 'senatobia-ms', 'earle-ar',
  'baptist-memorial-hospital-memphis', 'methodist-university-hospital', 'saint-francis-hospital-park-avenue', 'regional-one-health',
  'baptist-memorial-hospital-collierville', 'baptist-memorial-hospital-desoto', 'methodist-le-bonheur-germantown-hospital', 'methodist-north-hospital', 'methodist-south-hospital', 'memphis-va-medical-center', 'delta-specialty-hospital',
  'saint-francis-hospital-bartlett', 'methodist-olive-branch-hospital', 'baptist-memorial-hospital-crittenden',
  // Care-type pages exist for every town with licensed supply in
  // data/listings/senior-living/facilities.json - the seven biggest markets the
  // owner approved on 25 Oct 2026, plus arlington-tn, covington-tn, hernando-ms
  // and somerville-tn, added 26 Oct 2026 for brief
  // sr-memphisseniorcarehomes.com-j9. "Every town that has licensed communities"
  // is a rule this list can be measured against; "the biggest markets" was not.
  ...['memphis-tn', 'germantown-tn', 'collierville-tn', 'bartlett-tn', 'cordova-tn', 'southaven-ms', 'olive-branch-ms',
      'arlington-tn', 'covington-tn', 'hernando-ms', 'somerville-tn'].flatMap((t) => ['memory-care-' + t, 'assisted-living-' + t]),
  // 26 Oct 2026 (Search Readiness j9, service x town): coverage towns inside
  // the licence registries this site carries (TN HFC: Shelby, Tipton, Fayette;
  // MSDH: DeSoto, Marshall) now has both care-type pages, even with no licensed
  // community of its own: the page names the nearest ones with real distances,
  // bed counts and licence status. The five coverage towns outside those
  // registries (tunica-ms, senatobia-ms, west-memphis-ar, marion-ar, earle-ar)
  // are folded with a 301 instead; the basis is in the pack's legacyRedirects
  // and data/search_intelligence/memphisseniorcarehomes.com/consolidation_candidates.json.
  // The four largest no-supply towns only: eight more (oakland, munford,
  // rossville, eads, brighton, walls, nesbit, byhalia) would take the site past
  // the cadence gate's maintainable ceiling of 195 URLs, so they are folded too.
  ...['lakeland-tn', 'millington-tn', 'atoka-tn', 'horn-lake-ms'].flatMap((t) => ['memory-care-' + t, 'assisted-living-' + t]),
];
const MIN_NEARBY_AREAS = 3;
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
for (const c of cities.filter((x) => x.kind === 'care_type')) {
  const base = cities.find((x) => x.slug === c.base_slug);
  if (!base || base.kind !== 'city') { problems.push(`${c.slug}: base_slug ${c.base_slug} is not a town page`); continue; }
  if (c.slug !== `${c.care_type === 'memory_care' ? 'memory-care' : 'assisted-living'}-${base.slug}` || !['memory_care', 'assisted_living'].includes(c.care_type)) problems.push(`${c.slug}: slug/care_type do not match its base ${base.slug}`);
  for (const k of ['lat', 'lng', 'primary_zip', 'state', 'city', 'marketLabel']) if (c[k] !== base[k]) problems.push(`${c.slug}: ${k} ${c[k]} differs from ${base.slug} (${base[k]})`);
}
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
  const facilities = JSON.parse(read(path.join(ROOT, 'data', 'listings', 'senior-living', 'facilities.json'))).facilities;
  const mcByLicence = new Map(facilities.map((f) => [String(f.license_number), f.memory_care]));
  const areaSlugs = new Set(cities.filter((x) => x.kind === 'city').map((x) => x.slug));
  const careSlugs = new Set(cities.filter((x) => x.kind === 'care_type').map((x) => x.slug));
  const firstFaq = new Map();
  for (const c of FENCE) if (!home || !home.includes(`href="/${c}/"`)) problems.push(`home page does not link /${c}/`);
  for (const st of ['TN', 'MS', 'AR']) {
    const sp = page(`states/${st}`) || '';
    for (const c of cities.filter((x) => x.state === st)) if (!sp.includes(`href="/${c.slug}/"`)) problems.push(`/states/${st}/ does not link /${c.slug}/`);
  }
  for (const c of cities) {
    const h = page(c.slug);
    if (!h) { problems.push(`/${c.slug}/ not built`); continue; }
    checkedPages += 1;
    const nearby = section(h, 'data-senior-nearby="true"');
    const links = [...nearby.matchAll(/href="\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
    if (c.kind !== 'care_type' && links.filter((l) => areaSlugs.has(l)).length < MIN_NEARBY_AREAS) problems.push(`/${c.slug}/ links ${links.filter((l) => areaSlugs.has(l)).length} nearby area pages; the floor is ${MIN_NEARBY_AREAS}`);
    if (!links.some((l) => careSlugs.has(l))) problems.push(`/${c.slug}/ links no care-type page`);
    if (c.kind === 'care_type' && !links.includes(c.base_slug)) problems.push(`/${c.slug}/ does not link its town page /${c.base_slug}/`);
    const rowLic = [...h.matchAll(/<tr data-facility-license="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    if (c.kind === 'care_type' && c.care_type === 'memory_care' && rowLic.some((l) => mcByLicence.get(l) !== true)) problems.push(`/${c.slug}/ lists a community without memory care`);
    if (c.kind === 'care_type' && !h.includes(`data-senior-care-type="${c.care_type}"`)) problems.push(`/${c.slug}/ lacks its ${c.care_type} local section`);
    const fq = (h.match(/<details class="faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<div class="faq-answer"><p>([\s\S]*?)<\/p>/) || []).slice(1).join(' | ');
    if (!fq) problems.push(`/${c.slug}/ has no FAQ`);
    else if (firstFaq.has(fq)) problems.push(`/${c.slug}/ repeats the lead FAQ of /${firstFaq.get(fq)}/`);
    else firstFaq.set(fq, c.slug);
    if (!h.includes(slot(c.slug, c.primary_zip))) problems.push(`/${c.slug}/ lacks the exact intake slot`);
    const ns = page(`${c.slug}/next-steps`);
    if (!ns || (ns.match(/id="senior-intake"/g) || []).length !== 1 || !ns.includes(slot(c.slug, c.primary_zip))) problems.push(`/${c.slug}/next-steps/ lacks exactly one intake slot for its page`);
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
    const tok = h.match(/%%[A-Z][A-Z0-9_:]*%%/);
    if (tok) problems.push(`${path.relative(DIST, f)} ships the unfilled template token ${tok[0]}`);
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
