/* eslint-disable no-console */
//
// Title and meta-description length + uniqueness for the pack standing in dist/.
//
// What it guards
// --------------
// 1. Every rendered, served HTML page has a <title> of at least 30 characters.
// 2. Every rendered, served HTML page has a <meta name="description"> of
//    110-160 characters.
// 3. No two self-canonical pages share a title, and no two share a description.
//
// Why it exists
// -------------
// Bing Webmaster (25 Sep 2026) reported rule 114 (title too short) and rule 118
// (meta description too short) across hormonesivhair.com, theaccidentguides.com
// and uscisexam.com, and a crawl of dentistryguides.com and neuroevalguides.com
// found the same templates short there too - titles like "FAQ", "Car Accidents",
// "Next steps" (the title of 57 neuroevalguides city pages at once) and
// descriptions like "Frameworks for Dallas, TX. No rankings. No endorsements."
// All five sites come from this generator, so the rule lives here and runs per
// pack from build_all_packs.js through the hard_fail tier.
//
// It hard-fails on zero pages examined so it can never pass on an empty dist.

const fs = require('fs');
const path = require('path');

const TITLE_MIN = 30;
const DESC_MIN = 110;
const DESC_MAX = 160;

const repoRoot = path.resolve(__dirname, '..', '..');
const distRoot = path.join(repoRoot, process.env.PAGES_OUT_DIR || 'dist');

// Files the host never serves as an indexable 200 page.
const SKIP_FILES = new Set(['404.html']);

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function collectHtmlFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) out.push(p);
    }
  })(root);
  return out.sort();
}

function routeFor(file) {
  const rel = path.relative(distRoot, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -'index.html'.length);
  return '/' + rel.replace(/\.html$/, '');
}

function main() {
  if (!fs.existsSync(distRoot)) {
    console.error(`FAIL: ${distRoot} does not exist; build a pack first.`);
    process.exit(1);
  }
  const files = collectHtmlFiles(distRoot);
  const failures = [];
  const titles = new Map();
  const descs = new Map();
  let examined = 0;

  for (const file of files) {
    if (SKIP_FILES.has(path.basename(file)) && path.dirname(file) === distRoot) continue;
    const html = fs.readFileSync(file, 'utf8');
    // A meta-refresh redirect stub is not a page a crawler indexes.
    if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) continue;
    const route = routeFor(file);
    examined += 1;

    const tm = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = tm ? decodeEntities(tm[1]).replace(/\s+/g, ' ').trim() : '';
    const dm = html.match(/<meta\s+name=["']description["']\s+content=(["'])([\s\S]*?)\1/i);
    const desc = dm ? decodeEntities(dm[2]).replace(/\s+/g, ' ').trim() : '';

    if (title.length < TITLE_MIN) failures.push(`${route}: title ${title.length} chars (< ${TITLE_MIN}): "${title}"`);
    if (desc.length < DESC_MIN || desc.length > DESC_MAX) {
      failures.push(`${route}: description ${desc.length} chars (want ${DESC_MIN}-${DESC_MAX}): "${desc}"`);
    }

    const cm = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"'\s>]*)["']/i);
    let selfCanonical = true;
    if (cm) {
      try {
        const cpath = new URL(decodeEntities(cm[1])).pathname;
        selfCanonical = cpath === route || cpath === route.replace(/\/$/, '') || cpath + '/' === route;
      } catch (_) { selfCanonical = true; }
    }
    if (!selfCanonical) continue;
    if (title) (titles.get(title) || titles.set(title, []).get(title)).push(route);
    if (desc) (descs.get(desc) || descs.set(desc, []).get(desc)).push(route);
  }

  if (examined === 0) {
    console.error(`FAIL: examined 0 pages under ${distRoot}; refusing to pass on an empty dist.`);
    process.exit(1);
  }
  for (const [t, routes] of titles) if (routes.length > 1) failures.push(`duplicate title x${routes.length} "${t}": ${routes.slice(0, 5).join(', ')}`);
  for (const [d, routes] of descs) if (routes.length > 1) failures.push(`duplicate description x${routes.length} "${d}": ${routes.slice(0, 5).join(', ')}`);

  if (failures.length) {
    console.error(`FAIL: meta length/uniqueness contract - ${failures.length} problem(s) across ${examined} pages`);
    for (const f of failures.slice(0, 400)) console.error('  ' + f);
    process.exit(1);
  }
  console.log(`OK: meta length/uniqueness contract (${examined} pages; titles >= ${TITLE_MIN}, descriptions ${DESC_MIN}-${DESC_MAX}, all unique).`);
}

main();
