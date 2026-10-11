'use strict';
/**
 * Shared helpers for the site-hygiene validators (icons, og:image, homepage
 * definition, Clarity hosts, IndexNow key): the active host, the public pack
 * hosts, and the rendered pages under dist/.
 */
const fs = require('fs');
const path = require('path');
const { PACK_SITE_CONFIG } = require('../lib/pack_site_config');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.resolve(ROOT, process.env.PAGES_OUT_DIR || 'dist');

function publicHosts() {
  return Object.entries(PACK_SITE_CONFIG)
    .filter(([key]) => key !== 'starter')
    .map(([, c]) => new URL(c.siteUrl).hostname.replace(/^www\./, ''));
}

function activeHost() {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
  return new URL(site.siteUrl).hostname.replace(/^www\./, '');
}

function walkHtml(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkHtml(p, out);
    else if (ent.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Rendered pages with a <head>; dies on zero so an empty dist never passes. */
function pages(fail) {
  if (!fs.existsSync(DIST)) fail(`${path.relative(ROOT, DIST)}/ missing`);
  const out = walkHtml(DIST).map((p) => ({ file: path.relative(DIST, p), html: fs.readFileSync(p, 'utf8') }))
    .filter((p) => /<\/head>/i.test(p.html));
  if (!out.length) fail('no rendered pages found');
  return out;
}

function head(html) {
  const i = html.search(/<\/head>/i);
  return i < 0 ? '' : html.slice(0, i);
}

function metaContent(h, attr, name) {
  const re = new RegExp(`<meta[^>]+${attr}="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'gi');
  return (h.match(re) || []).map((t) => (t.match(/content="([^"]*)"/i) || [])[1]);
}

module.exports = { ROOT, DIST, publicHosts, activeHost, pages, head, metaContent };
