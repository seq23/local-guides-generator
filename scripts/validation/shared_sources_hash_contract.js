#!/usr/bin/env node
'use strict';
/**
 * Site-wide source attribution must be marked, honestly marked, and invisible
 * to the per-URL content hash.
 *
 * The defect this exists to stop. On 31 Oct 2026 commit ce23be88 replaced one
 * dead Mississippi State Department of Health URL with the live facility
 * locator - two data files, nothing else; no page's prose, table or facility
 * data changed. That URL is printed inside a single "Sources:" paragraph that
 * scripts/lib/senior_living.js renders byte-identically on every city page, so
 * the content hash of all 84 memphisseniorcarehomes.com city-level pages moved
 * and every one of them advanced its <lastmod> to that day. The live symptom
 * was 64 of 64 URLs in https://memphisseniorcarehomes.com/sitemap-cities.xml
 * carrying 2026-10-31 - Search Readiness item a6, "lastmod looks like the build
 * date" - and it was a false freshness claim on 84 pages that had not changed.
 *
 * The fix it guards. scripts/lib/lastmod_ledger.js hashableBody() replaces the
 * contents of any element the renderer marks `data-shared-sources="true"` with a
 * constant, exactly as it already drops global chrome by hashing <main> alone.
 * That fix is only as good as the marker is honest, and a regex over markup goes
 * stale silently, so this contract checks all three things that have to hold:
 *
 *   1. The marker is REACHED. At least one rendered page carries it. Rule 0: a
 *      normalisation that matches nothing must not pass quietly - that is how
 *      "runs but inert" ships.
 *   2. The marker is TRUE. Every page that carries a marked element renders it
 *      byte-identically. A marked element that differs per page is per-page
 *      content being hidden from the hash, which would freeze real dates.
 *   3. The hash really IGNORES it, and only it. Swapping a URL inside the marked
 *      element must not change contentHash (positive proof); changing a byte
 *      just outside it must (negative proof). Both are run here, on the real
 *      rendered page, so the proof cannot go stale.
 *
 * Reads dist/, so it runs after a build like the other dist-dependent contracts.
 */
const fs = require('fs');
const path = require('path');
const ledger = require('../lib/lastmod_ledger');

const DIST = path.join(process.cwd(), 'dist');
const MARKED = /<(p|div|section|aside)\b[^>]*\bdata-shared-sources="true"[^>]*>[\s\S]*?<\/\1>/gi;
const MAX_LISTED = 5;

function fail(msg, lines = []) {
  console.error(`❌ SHARED SOURCES HASH FAIL — ${msg}`);
  lines.slice(0, MAX_LISTED).forEach((l) => console.error(`    ${l}`));
  if (lines.length > MAX_LISTED) console.error(`    ... and ${lines.length - MAX_LISTED} more`);
  console.error('    scripts/lib/lastmod_ledger.js normalises data-shared-sources elements out of the');
  console.error('    per-URL content hash. See that file and this one for why.');
  process.exit(1);
}

function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (st.isFile() && name.toLowerCase() === 'index.html') acc.push(full);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(DIST)) fail('dist/ not found. Run a build first.');
  const files = walk(DIST, []).sort();
  if (!files.length) fail('dist/ holds no rendered pages.');

  // Which pack is standing in dist/. Only senior_living renders a marked
  // element today; a pack without one is reported as a SKIP that names itself,
  // never a silent pass.
  const carriers = [];
  const variants = new Map(); // marked element markup -> [pages]
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const found = html.match(MARKED);
    if (!found) continue;
    carriers.push(file);
    for (const el of found) {
      if (!variants.has(el)) variants.set(el, []);
      variants.get(el).push(path.relative(DIST, file));
    }
  }

  // Which pack is standing in dist/, read from the rendered pages themselves and
  // not from data/site.json. scripts/prepare_site.js rewrites site.json per pack,
  // so a stale or reverted copy of it would name a different host than the one
  // dist/ actually holds - and this contract would then skip the very pack it
  // exists to protect. The pages under test are the only honest source.
  const host = (() => {
    for (const file of files.slice(0, 20)) {
      const m = fs.readFileSync(file, 'utf8').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\/([^/"']+)/i);
      if (m) return m[1];
    }
    return '';
  })();

  // 1. The marker is REACHED. The host that owns the element this contract was
  // written for must never skip: a renderer change that dropped the marker would
  // otherwise turn the whole contract into a silent no-op on the one pack it
  // protects, and the 84-page date bump would come straight back.
  if (!carriers.length && /memphisseniorcarehomes\.com/.test(host)) {
    fail(
      `the senior_living pack renders no data-shared-sources element across ${files.length} page(s). ` +
      'scripts/lib/senior_living.js must mark its site-wide "Sources:" paragraph, or a dead-link repair in ' +
      'data/listings/senior-living/facilities.json will advance <lastmod> on every city page again.'
    );
  }

  if (!carriers.length) {
    console.log(`ℹ️ SHARED SOURCES HASH SKIP — the pack in dist/ (${host || 'unknown host'}) renders no data-shared-sources element across ${files.length} page(s). Only the senior_living pack does today.`);
    return;
  }

  // 2. The marker is TRUE: one distinct markup for every page that carries it.
  if (variants.size !== 1) {
    const rows = [...variants.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([el, pages]) => `${pages.length} page(s), e.g. ${pages[0]}: ${el.slice(0, 160)}…`);
    fail(
      `${variants.size} different data-shared-sources elements are rendered across ${carriers.length} page(s). ` +
      'A marked element is excluded from the content hash because it is the same on every page; one that differs ' +
      'per page is per-page content being hidden, and its real change date would never advance.',
      rows
    );
  }

  // 3. The hash really IGNORES it, and only it. Proved on a real rendered page.
  const sample = carriers[0];
  const html = fs.readFileSync(sample, 'utf8');
  const base = ledger.contentHash(html);

  const swapped = html.replace(MARKED, (el) =>
    el.replace(/href="[^"]*"/g, 'href="https://example.invalid/contract-probe"')
  );
  if (swapped === html) {
    fail(`the probe could not rewrite a URL inside the marked element on ${path.relative(DIST, sample)}; the element carries no href, so this contract would prove nothing.`);
  }
  if (ledger.contentHash(swapped) !== base) {
    fail(`rewriting a URL inside the data-shared-sources element on ${path.relative(DIST, sample)} still changes the content hash. The normalisation in scripts/lib/lastmod_ledger.js is not reaching it, so a dead-link repair will advance <lastmod> on every page again.`);
  }

  // Negative proof: a byte outside the marked element must still move the hash,
  // or the normalisation is swallowing real content.
  const marker = 'data-shared-sources="true"';
  const after = html.indexOf('</p>', html.indexOf(marker));
  const outside = `${html.slice(0, after + 4)}<p>contract probe: this page changed.</p>${html.slice(after + 4)}`;
  if (ledger.contentHash(outside) === base) {
    fail(`adding a paragraph outside the marked element on ${path.relative(DIST, sample)} did not change the content hash. The normalisation is swallowing real page content, which would freeze every page's <lastmod>.`);
  }

  console.log(
    `✅ SHARED SOURCES HASH PASS — ${carriers.length} of ${files.length} page(s) carry a data-shared-sources element, ` +
    'all byte-identical; a URL swap inside it leaves the content hash unchanged and a change outside it does not.'
  );
}

if (require.main === module) main();
module.exports = { main };
