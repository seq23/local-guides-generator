'use strict';

// Link the sources a guide already names, in place.
//
// WHY: guide pages print their figures with a "Source:" line naming the
// publisher - "Administrative Office of the U.S. Courts, District Court
// Miscellaneous Fee Schedule", "Centers for Medicare & Medicaid Services ... by
// Geography and Service", "uscis.gov/i-693" - but as plain text. A figure whose
// source cannot be followed is not a sourced figure, and the Monday quality
// sample scored those pages "N figures and no source linked" (Search Readiness
// q1 d3, 17 Nov 2026: theaccidentguides.com settlement-costs-before-and-after-
// filing-suit, dentistryguides.com dental-implant-and-oral-surgery-cost,
// hormonesivhair.com ultimate-guide-to-peptides).
//
// Only text inside a paragraph that opens "Source:" is touched, only a name in
// the list below or a bare official .gov address is linked, and text already in
// a link is left alone - so this adds no words and invents no source: it links
// what the page already says it relied on. Same approach as the city cost
// tables' linkCostTableSource() in build_city_sites.js.
// Guarded by tests/search_readiness/guide_source_links.test.mjs.

const { CMS_GEO_URL, CMS_PROVIDER_URL } = require('./city_local_facts');

const NAMED_SOURCES = [
  [/Medicare Physician &amp; Other Practitioners(?: &mdash;| —| -)? by Geography and Service/, CMS_GEO_URL],
  [/Medicare Physician &amp; Other Practitioners(?: &mdash;| —| -)? by Provider and Service/, CMS_PROVIDER_URL],
  [/District Court Miscellaneous Fee Schedule/, 'https://www.uscourts.gov/court-programs/fees/district-court-miscellaneous-fee-schedule'],
  [/28 U\.S\.C\. (?:&sect;|§) ?1914(?:\(a\))?/, 'https://www.law.cornell.edu/uscode/text/28/1914'],
  [/Form G-1055/, 'https://www.uscis.gov/g-1055'],
];

// A bare official address printed as text: "uscis.gov/i-693", "www.cms.gov/x".
// The path stops before trailing punctuation so "uscis.gov/i-693." links /i-693.
const BARE_GOV = /\b((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.gov)((?:\/[A-Za-z0-9._~%-]*[A-Za-z0-9_~%/-])?)/g;

function anchor(url, label) {
  return '<a href="' + String(url).replace(/"/g, '&quot;') + '" rel="nofollow noopener">' + label + '</a>';
}

// Apply fn to the text runs of an HTML fragment that are not tags and not inside <a>…</a>.
function mapTextOutsideLinks(html, fn) {
  let depth = 0;
  return String(html).split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) depth++;
      else if (/^<\/a>/i.test(part)) depth = Math.max(0, depth - 1);
      return part;
    }
    return depth ? part : fn(part);
  }).join('');
}

function linkSourceText(text) {
  let out = text;
  for (const [re, url] of NAMED_SOURCES) {
    // Once per run: a name that appears twice in one line needs one link.
    let done = false;
    out = out.replace(re, (m) => (done ? m : ((done = true), anchor(url, m))));
  }
  // Bare .gov addresses, outside anything the named pass just linked.
  return mapTextOutsideLinks(out, (t) => t.replace(BARE_GOV, (m, host, p) => anchor('https://' + (host.startsWith('www.') ? host : 'www.' + host) + (p || ''), m)));
}

function linkNamedSources(html) {
  return String(html || '').replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (whole, attrs, inner) => {
    const plain = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/^Sources?:/i.test(plain)) return whole;
    return '<p' + attrs + '>' + mapTextOutsideLinks(inner, linkSourceText) + '</p>';
  });
}

module.exports = { linkNamedSources, NAMED_SOURCES };
