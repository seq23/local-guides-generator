'use strict';
/**
 * Search-demand blocks rendered by scripts/build_city_sites.js.
 *
 *  - applyStrengthening: a page whose page-set JSON carries `search_strengthening`
 *    gets its definition paragraph (after the Quick answer heading) and an FAQ
 *    section from the real questions; faqJsonLd emits the matching FAQPage.
 *  - renderRankedLinksHtml: the homepage and the guides hub link to every
 *    strengthened page of their host (data/search_intelligence/strengthened_pages.json).
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

function faqJsonLd(page) {
  const s = page && page.search_strengthening;
  if (!s || !Array.isArray(s.faq) || !s.faq.length) return '';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: s.faq.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } }))
  };
  return '\n<script type="application/ld+json">\n' + JSON.stringify(ld, null, 2) + '\n</script>';
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

module.exports = { applyStrengthening, faqJsonLd, renderRankedLinksHtml, renderAudienceBlockHtml, STRENGTHENED, CTAS };
