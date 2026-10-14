'use strict';
/**
 * Search-demand blocks rendered by scripts/build_city_sites.js.
 *
 *  - applyStrengthening: a page whose page-set JSON carries `search_strengthening`
 *    gets its definition paragraph (after the Quick answer heading) and an FAQ
 *    section from the real questions; faqJsonLd emits the matching FAQPage.
 *  - renderRankedLinksHtml: the homepage and the guides hub link to every
 *    strengthened page of their host (data/search_intelligence/strengthened_pages.json).
 *  - stateHubStrengthening / renderStateStrengtheningHtml: a state hub whose
 *    route is in a strengthened state-hub demand family (demand_families.js,
 *    data/search_intelligence/<host>/demand_families.json) takes the pack page
 *    set's search_strengthening.state_hub template: title + H1 on the query, a
 *    top section with the definition, criteria, the listing CTA and the FAQ; its
 *    questions merge into the page's one FAQPage through mergeFaqIntoJsonLd.
 *  - renderAudienceBlockHtml: the state-hub block that turns a measured
 *    wrong-audience query family toward the buyer, with one tracked ref
 *    (data/search_intelligence/audience_ctas.json).
 *
 * The registries are read once; a missing or unparsable registry throws, so a
 * build can never silently drop these blocks.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SI = path.join(ROOT, 'data', 'search_intelligence');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(SI, rel), 'utf8'));
const STRENGTHENED = read('strengthened_pages.json').pages;
const CTAS = read('audience_ctas.json').ctas;
const { strengthenedStateRoutes } = require('./demand_families');
const STATE_ROUTES = new Map();

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hostOf(siteUrl) {
  try { return new URL(siteUrl).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}

function applyStrengthening(mainHtml, page) {
  const s = page && page.search_strengthening;
  if (!s) return mainHtml;
  let out = String(mainHtml);
  if (s.definition && !out.includes('data-search-definition="true"')) {
    const para = '<p class="search-definition" data-search-definition="true">' + esc(s.definition) + '</p>';
    const m = out.match(/<h2[^>]*id="definition"[^>]*>[\s\S]*?<\/h2>/i);
    out = m ? out.replace(m[0], m[0] + '\n' + para) : para + '\n' + out;
  }
  if (Array.isArray(s.faq) && s.faq.length && !out.includes('data-search-faq="true"')) {
    const faq = '<section class="section search-faq" data-search-faq="true"><h2 id="faq">Frequently asked questions</h2>' +
      s.faq.map((x) => '<h3>' + esc(x.q) + '</h3><p>' + esc(x.a) + '</p>').join('') + '</section>';
    const next = out.search(/<h2[^>]*id="next-steps"/i);
    out = next >= 0 ? out.slice(0, next) + faq + '\n' + out.slice(next) : out + '\n' + faq;
  }
  return out;
}

// Folds the page's real questions into the FAQPage the head already carries
// (renderHeadJsonLdGlobal emits a one-question FAQPage on every global page), so
// the page keeps exactly ONE FAQPage: a second one is a Search Console
// "Duplicate field FAQPage" error that voids the rich result.
function mergeFaqIntoJsonLd(headJsonLd, page) {
  const s = page && page.search_strengthening;
  if (!s || !Array.isArray(s.faq) || !s.faq.length) return headJsonLd;
  const qs = s.faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } }));
  const m = String(headJsonLd).match(/(<script type="application\/ld\+json">\s*)([\s\S]*?)(\s*<\/script>)/);
  if (!m) throw new Error('mergeFaqIntoJsonLd: head JSON-LD script not found');
  const data = JSON.parse(m[2]);
  const nodes = Array.isArray(data) ? data : [data];
  const faq = nodes.find((n) => n && n['@type'] === 'FAQPage');
  if (faq) faq.mainEntity = [...[].concat(faq.mainEntity || []), ...qs];
  else nodes.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs });
  const out = Array.isArray(data) ? nodes : (nodes.length === 1 ? nodes[0] : nodes);
  return String(headJsonLd).replace(m[0], m[1] + JSON.stringify(out, null, 2) + m[3]);
}

// The strengthened pages for one host, as {route, title}: the "Guides readers find
// in search" list. The homepage renders these as its "Most read" line.
function rankedLinks(siteUrl) {
  const host = hostOf(siteUrl);
  return STRENGTHENED.filter((p) => p.host === host)
    .map((p) => ({ route: p.route, title: JSON.parse(fs.readFileSync(path.join(ROOT, p.source), 'utf8')).title || p.route }));
}

function renderRankedLinksHtml(siteUrl, route) {
  if (route !== '' && route !== 'guides') return '';
  const host = hostOf(siteUrl);
  const pages = STRENGTHENED.filter((p) => p.host === host);
  if (!pages.length) return '';
  return '<section class="section search-ranked-links" data-search-ranked-links="true"><h2>Guides readers find in search</h2><ul>' +
    pages.map((p) => '<li><a href="' + esc(p.route) + '">' + esc(JSON.parse(fs.readFileSync(path.join(ROOT, p.source), 'utf8')).title || p.route) + '</a></li>').join('') +
    '</ul></section>';
}

// The pack template, filled for one state, when that state hub is in a strengthened
// state-hub family; else null (the page renders exactly as before).
function stateHubStrengthening(siteUrl, pageSet, stateAbbr, stateName) {
  const t = pageSet && pageSet.search_strengthening && pageSet.search_strengthening.state_hub;
  if (!t) return null;
  const host = hostOf(siteUrl);
  if (!STATE_ROUTES.has(host)) STATE_ROUTES.set(host, strengthenedStateRoutes(host));
  if (!STATE_ROUTES.get(host).has('/states/' + String(stateAbbr).toUpperCase() + '/')) return null;
  for (const k of ['query', 'title', 'h1', 'heading', 'definition', 'cta_label', 'cta_href']) {
    if (!t[k]) throw new Error('search_strengthening.state_hub.' + k + ' is required');
  }
  if (!Array.isArray(t.faq) || t.faq.length < 2 || !Array.isArray(t.criteria) || !t.criteria.length) throw new Error('search_strengthening.state_hub needs >= 2 faq and criteria');
  const fill = (s) => String(s).split('%%STATE%%').join(String(stateName));
  return {
    query: fill(t.query), title: fill(t.title), h1: fill(t.h1), heading: fill(t.heading), definition: fill(t.definition),
    criteria: t.criteria.map(fill), cta_label: fill(t.cta_label), cta_href: t.cta_href,
    faq: t.faq.map((x) => ({ q: fill(x.q), a: fill(x.a) }))
  };
}

function renderStateStrengtheningHtml(s) {
  if (!s) return '';
  return '<section class="section search-strengthening" data-search-strengthening="state_hub"><h2>' + esc(s.heading) + '</h2>' +
    '<p class="search-definition" data-search-definition="true">' + esc(s.definition) + '</p>' +
    '<ol>' + s.criteria.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ol>' +
    '<p><a class="button button-primary" href="' + esc(s.cta_href) + '" data-search-listing-cta="true">' + esc(s.cta_label) + '</a></p>' +
    '<div class="search-faq" data-search-faq="true"><h3>Frequently asked questions</h3>' +
    s.faq.map((x) => '<h4>' + esc(x.q) + '</h4><p>' + esc(x.a) + '</p>').join('') + '</div></section>';
}

const TRACK_SCRIPT = '<script>(function(){try{document.querySelectorAll("[data-cta-ref]").forEach(function(a){a.addEventListener("click",function(){try{fetch("/api/track-connection-click",{method:"POST",headers:{"content-type":"application/json"},keepalive:true,body:JSON.stringify({provider_type:"cta:"+a.getAttribute("data-cta-ref"),page_slug:location.pathname,source_domain:location.host,intent_type:"cta_ref",button_source:a.getAttribute("data-cta-ref"),page_kind:"state",vertical_key:a.getAttribute("data-vertical-key")||""})}).catch(function(){})}catch(e){}})})}catch(e){}})();</script>';

function renderAudienceBlockHtml(siteUrl, verticalKey, stateAbbr, stateName) {
  const host = hostOf(siteUrl);
  const cta = CTAS.find((c) => c.host === host && c.vertical_key === verticalKey && c.placement === 'state_hub');
  if (!cta) return '';
  const fill = (s) => esc(String(s || '').split('%%STATE%%').join(stateName));
  const src = '/states/' + String(stateAbbr).toUpperCase() + '/';
  const ctaHref = cta.cta_href + (cta.cta_href.includes('?') ? '&' : '?') + 'src=' + encodeURIComponent(src);
  const links = [];
  if (cta.verify_source) {
    const row = JSON.parse(fs.readFileSync(path.join(ROOT, cta.verify_source), 'utf8'))[String(stateAbbr).toUpperCase()] || {};
    if (row.license) links.push('<a class="button button-secondary" href="' + esc(row.license) + '" target="_blank" rel="noopener noreferrer">' + fill(cta.verify_label) + '</a>');
  }
  if (cta.field_office_href) links.push('<a class="button button-secondary" href="' + esc(cta.field_office_href) + '" target="_blank" rel="noopener noreferrer">' + fill(cta.field_office_label) + '</a>');
  if (cta.finder_href) links.push('<a class="button button-secondary" href="' + esc(cta.finder_href) + '" target="_blank" rel="noopener noreferrer">' + fill(cta.finder_label) + '</a>');
  links.push('<a class="button button-primary" href="' + esc(ctaHref) + '" data-cta-ref="' + esc(cta.ref) + '" data-vertical-key="' + esc(verticalKey) + '">' + fill(cta.cta_label) + '</a>');
  return '<section class="section audience-cta" data-audience-cta="' + esc(cta.ref) + '"><h2>' + fill(cta.heading) + '</h2><p>' + fill(cta.body) + '</p><p class="audience-cta__actions">' + links.join(' ') + '</p></section>' + TRACK_SCRIPT;
}

module.exports = { rankedLinks, applyStrengthening, mergeFaqIntoJsonLd, stateHubStrengthening, renderStateStrengtheningHtml, renderRankedLinksHtml, renderAudienceBlockHtml, STRENGTHENED, CTAS };
