'use strict';

// All six publications now have a b10 brief repaired at source. The senior
// site's recording policy is a separate brief and is not part of this pass.
const HOSTS = new Set(['uscisexam.com', 'dentistryguides.com', 'theaccidentguides.com',
  'neuroevalguides.com', 'hormonesivhair.com', 'memphisseniorcarehomes.com']);
const CONVERSION_HOSTS = new Set([...HOSTS].filter((host) => host !== 'memphisseniorcarehomes.com'));
// Reviewed search copy for long editorial headings. A missing/invalid registry
// fails before the renderer writes anything; no automatic truncation or slug copy.
const TITLE_COPY = require('../../data/search_title_copy.json');
function scoped(siteUrl) { return HOSTS.has(new URL(siteUrl).hostname); }
function normalize(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function brandedTitle(title, siteUrl, brandName, route = '') {
  const key = '/' + String(route).replace(/^\/+|\/+$/g, '') + '/';
  const copy = (TITLE_COPY[new URL(siteUrl).hostname] || {})[key];
  if (copy) title = copy;
  if (!scoped(siteUrl) || normalize(title).includes(normalize(brandName))) return title;
  // Do not truncate: the existing length/uniqueness contract requires concise
  // source copy and catches collisions rather than silently cutting off intent.
  return `${title} | ${brandName}`;
}

function formOrBuy(html, siteUrl) {
  const content = String(html).replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  if (/<form\b/i.test(content)) return true;
  const anchors = content.match(/<a\b[^>]*>/gi) || [];
  return anchors.some((tag) => {
    const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    if (!match) return false;
    try {
      const u = new URL((match[1] ?? match[2] ?? match[3]).replace(/&amp;/g, '&'), siteUrl);
      if (!/^https?:$/.test(u.protocol)) return false;
      return /(^|\.)(gumroad\.com|stripe\.com|paypal\.com|lemonsqueezy\.com|square\.link|checkout\.shopify\.com)$/.test(u.hostname)
        || /\/(checkout|cart|buy|order|book(ing)?)(\/|$)/i.test(u.pathname);
    } catch { return false; }
  });
}

function clarityEligible(html, siteUrl) { return !CONVERSION_HOSTS.has(new URL(siteUrl).hostname) || formOrBuy(html, siteUrl); }

module.exports = { scoped, brandedTitle, clarityEligible };
