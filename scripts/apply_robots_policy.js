#!/usr/bin/env node
'use strict';
/**
 * Keep operator-only surfaces out of the index.
 *
 * The problem this fixes. templates/base.html hardcodes
 * `<meta name="robots" content="index,follow,...">` with no per-route override,
 * so every page a pack builds is marked indexable - including /admin/, the
 * "Operator panel" that lists sponsorship inventory, what is free vs taken,
 * activation instructions for a VA, and a password box whose own copy says it
 * "is not secure authentication". `admin` is a shared route, so that page is
 * built for all five vertical packs. scripts/sitemap_emit.js then walks every
 * index.html in dist/ with no robots check, so the operator panel was also
 * submitted in the public sitemap of every vertical domain.
 *
 * Why it matters. It advertises the monetisation mechanics of the network to
 * anyone searching, points attackers at a weak gate, and spends brand search
 * presence on an internal console. None of that is what the page is for.
 *
 * How it works. Runs after the pages are rendered and before postbuild, and
 * rewrites the robots meta for the routes named below. Kept as a separate pass
 * rather than a template placeholder because base.html is applied from ~7 call
 * sites in build_city_sites.js, and an unreplaced %%ROBOTS%% at any one of them
 * would leak into the page.
 */
const fs = require('fs');
const path = require('path');

// Routes that exist for operators, not readers. Extend deliberately: anything
// listed here disappears from search and from the sitemap.
const NOINDEX_ROUTES = new Set(['admin']);
const ROBOTS_META = /<meta\s+name=(["'])robots\1\s+content=(["'])[^"']*\2\s*\/?>/i;
const NOINDEX_TAG = '<meta name="robots" content="noindex,nofollow" />';

function routeFor(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '';
  if (!rel.endsWith('/index.html')) return null;
  return rel.slice(0, -'/index.html'.length);
}

function run() {
  const distDir = path.resolve(process.env.PAGES_OUT_DIR || 'dist');
  if (!fs.existsSync(distDir)) {
    console.log('apply_robots_policy: no dist/, nothing to do');
    return;
  }
  let changed = 0;
  const missing = [];
  for (const route of NOINDEX_ROUTES) {
    const file = path.join(distDir, route, 'index.html');
    if (!fs.existsSync(file)) { missing.push(route); continue; }
    const before = fs.readFileSync(file, 'utf8');
    if (/content=["'][^"']*noindex/i.test(before)) continue;
    if (!ROBOTS_META.test(before)) {
      // Failing loudly beats silently shipping an indexable operator panel.
      throw new Error(`apply_robots_policy: no robots meta found in /${route}/ - the tag in templates/base.html changed shape. Refusing to leave it indexable.`);
    }
    fs.writeFileSync(file, before.replace(ROBOTS_META, NOINDEX_TAG), 'utf8');
    changed += 1;
  }
  const note = missing.length ? `; not built in this pack: ${missing.join(', ')}` : '';
  console.log(`apply_robots_policy: ${changed} operator route(s) set to noindex,nofollow${note}`);
}

if (require.main === module) run();
module.exports = { run, NOINDEX_ROUTES, routeFor };
