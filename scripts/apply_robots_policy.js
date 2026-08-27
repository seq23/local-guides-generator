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
 *
 * It also handles a second, larger case: city pages that had no research file and
 * were rendered from the slug-interpolated template instead. 200 of the 285 city
 * pages are built that way - the page names the city, derives the state from the
 * last segment of the slug, and says nothing that is true of anywhere in
 * particular. loadOptionalCityContent() has flagged them as is_template_fallback
 * since the fallback was written, and nothing read the flag, so they shipped
 * indexable and in the sitemap. build_city_sites.js now stamps
 * `<meta name="x-template-fallback" content="true">` into them and this pass
 * finds it.
 *
 * The pages are not deleted. A reader who lands on one still gets the national
 * guidance, and writing a research file at data/city_content/<vertical>/<slug>.json
 * promotes it back to indexable on the next build with no code change. What stops
 * is competing in search for a city query on the strength of having interpolated
 * the city's name.
 */
const fs = require('fs');
const path = require('path');

// Routes that exist for operators, not readers. Extend deliberately: anything
// listed here disappears from search and from the sitemap.
const NOINDEX_ROUTES = new Set(['admin']);
const ROBOTS_META = /<meta\s+name=(["'])robots\1\s+content=(["'])[^"']*\2\s*\/?>/i;
const NOINDEX_TAG = '<meta name="robots" content="noindex,nofollow" />';
const TEMPLATE_FALLBACK_MARKER = /\sdata-template-fallback=(["'])true\1/i;

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
  // Second pass: every rendered page that admits it came from the template.
  let fallbacks = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name !== 'index.html') continue;
      const html = fs.readFileSync(full, 'utf8');
      if (!TEMPLATE_FALLBACK_MARKER.test(html)) continue;
      if (/content=["'][^"']*noindex/i.test(html)) { fallbacks += 1; continue; }
      if (!ROBOTS_META.test(html)) {
        throw new Error(`apply_robots_policy: no robots meta found in ${routeFor(distDir, full)} - the tag in templates/base.html changed shape. Refusing to leave an unresearched city page indexable.`);
      }
      fs.writeFileSync(full, html.replace(ROBOTS_META, NOINDEX_TAG), 'utf8');
      fallbacks += 1;
    }
  };
  walk(distDir);

  const note = missing.length ? `; not built in this pack: ${missing.join(', ')}` : '';
  console.log(`apply_robots_policy: ${changed} operator route(s) set to noindex,nofollow${note}`);
  console.log(`apply_robots_policy: ${fallbacks} unresearched city page(s) set to noindex,nofollow - they had no data/city_content research file and were rendered from the slug template. Write a research file to promote one back.`);
}

if (require.main === module) run();
module.exports = { run, NOINDEX_ROUTES, TEMPLATE_FALLBACK_MARKER, routeFor };
