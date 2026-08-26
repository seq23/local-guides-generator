#!/usr/bin/env node
'use strict';
/**
 * lastmod_apply.js
 *
 * Purpose:
 * - Replace the build timestamp that scripts/build_city_sites.js stamps into
 *   every rendered page's freshness metadata with the date that page's content
 *   actually last changed, taken from the per-URL content-hash ledger in
 *   scripts/lib/lastmod_ledger.js.
 *
 * Why this exists:
 * - build_city_sites.js writes `BUILD_ISO` (one `new Date()` per process) into
 *   citation_publication_date, citation_modified_date, article:published_time,
 *   article:modified_time and the JSON-LD datePublished/dateModified of every
 *   page. sitemap_emit.js reads citation_modified_date for <lastmod> and
 *   citation_manifest_emit.js reads it for updated_at, so the whole library
 *   claimed to have been refreshed on every build - the date-bump pattern
 *   `node scripts/cadence_gate.js` flags as uniform_lastmod, and a false claim
 *   to a crawler about every page that did not change.
 * - Fixing it here rather than inside the 4,000-line renderer keeps the change
 *   small and puts one authority in front of every downstream consumer: the
 *   sitemap, the citation manifest, and the on-page metadata all read the same
 *   corrected values with no further changes.
 *
 * Inputs:
 * - dist/**\/index.html (the rendered pack)
 * - data/cadence/lastmod_ledger.json (created on first run)
 * - SITE_URL or data/site.json siteUrl, resolved exactly as sitemap_emit.js does
 *   so ledger keys match the URLs that are actually published.
 *
 * Outputs:
 * - Rewritten freshness metadata in dist/
 * - Updated data/cadence/lastmod_ledger.json
 *
 * Side effects:
 * - None outside dist/ and the ledger.
 *
 * Use this when:
 * - After a build and before sitemap/citation-manifest emission. It is wired
 *   into `postbuild`, `build_all_packs.js` and `refresh:verification`.
 *
 * Pipeline position matters:
 * - The hash is taken over the page as it exists on disk, so every pipeline has
 *   to hash it at the same point. It must run after every step that mutates the
 *   rendered page - build_city_sites.js and install_clarity.js - and before
 *   sitemap_emit.js and citation_manifest_emit.js, which read the dates it
 *   writes. Running it earlier in one pipeline than another makes every page
 *   look changed on the next build through the other pipeline.
 */
const fs = require('fs');
const path = require('path');
const ledgerLib = require('./lib/lastmod_ledger');

const ROOT = process.cwd();

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// Same resolution order as scripts/sitemap_emit.js. If the two disagreed the
// ledger would be keyed by URLs that are never published, and every page would
// look new on every build.
function getBaseUrl() {
  const fromEnv = String(process.env.SITE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const site = readJson(path.join(ROOT, 'data', 'site.json'));
  const fromSite = site && typeof site.siteUrl === 'string' ? site.siteUrl.trim() : '';
  return fromSite ? fromSite.replace(/\/+$/, '') : '';
}

function walkIndexFiles(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walkIndexFiles(full, acc);
    else if (st.isFile() && name.toLowerCase() === 'index.html') acc.push(full);
  }
  return acc;
}

function toRoute(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return `/${rel.slice(0, -'/index.html'.length)}/`;
}

const asIso = (day) => `${day}T00:00:00.000Z`;

// Only the values are rewritten; the tags themselves are left exactly as the
// renderer emitted them, so scripts/validation/citation_metadata_contract.js
// still sees every marker it requires.
function stampDates(html, modifiedIso, publishedIso) {
  const setMeta = (text, attr, name, value) =>
    text.replace(
      new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`, 'g'),
      `$1${value}$2`
    );
  const setJsonLd = (text, key, value) =>
    text.replace(new RegExp(`("${key}"\\s*:\\s*")[^"]*(")`, 'g'), `$1${value}$2`);

  let out = html;
  out = setMeta(out, 'name', 'citation_modified_date', modifiedIso);
  out = setMeta(out, 'name', 'citation_publication_date', publishedIso);
  out = setMeta(out, 'property', 'article:modified_time', modifiedIso);
  out = setMeta(out, 'property', 'article:published_time', publishedIso);
  out = setJsonLd(out, 'dateModified', modifiedIso);
  out = setJsonLd(out, 'datePublished', publishedIso);
  return out;
}

function run() {
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('lastmod_apply: dist/ not found. Run a build first.');
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    // Matches sitemap_emit.js: a missing SITE_URL is fatal in CI and a skip
    // locally. Keying the ledger on a guessed host would be worse than skipping.
    const msg = 'lastmod_apply: Missing SITE_URL (or data/site.json siteUrl).';
    if (String(process.env.CI || '').toLowerCase() === 'true') {
      console.error(`${msg} Refusing to write freshness dates against an unknown host.`);
      process.exit(1);
    }
    console.warn(`${msg} Skipping locally.`);
    return;
  }

  const files = walkIndexFiles(distDir, []).sort();
  const today = ledgerLib.buildDate();
  const ledger = ledgerLib.load();

  const hashes = {};
  const routeUrl = new Map();
  for (const file of files) {
    const route = toRoute(distDir, file);
    if (!route) continue;
    const url = `${baseUrl}${route}`;
    hashes[url] = ledgerLib.contentHash(fs.readFileSync(file, 'utf8'));
    routeUrl.set(file, url);
  }

  const resolved = ledgerLib.resolve(hashes, ledger, today);

  let rewritten = 0;
  let advanced = 0;
  for (const [file, url] of routeUrl) {
    const { lastmod, first_seen: firstSeen } = resolved[url];
    if (lastmod === today) advanced += 1;
    const before = fs.readFileSync(file, 'utf8');
    const after = stampDates(before, asIso(lastmod), asIso(firstSeen));
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      rewritten += 1;
    }
  }

  ledgerLib.save(ledgerLib.merged(hashes, ledger, today));

  const held = routeUrl.size - advanced;
  console.log(
    `lastmod_apply: ${routeUrl.size} pages; ${advanced} advanced to ${today} (new or changed content), ` +
    `${held} held their existing date; ${rewritten} files rewritten; base=${baseUrl}`
  );
}

if (require.main === module) run();

module.exports = { run, stampDates };
