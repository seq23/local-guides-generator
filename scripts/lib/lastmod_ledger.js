'use strict';
/**
 * Per-URL lastmod ledger: a freshness date that tracks content, not build time.
 *
 * Root cause it replaces. scripts/build_city_sites.js stamped `BUILD_ISO` -
 * `new Date().toISOString()`, taken once per process - into
 * `citation_publication_date`, `citation_modified_date`,
 * `article:published_time`, `article:modified_time` and the JSON-LD
 * `datePublished`/`dateModified` of every page it rendered.
 * scripts/sitemap_emit.js then read `citation_modified_date` for `<lastmod>`,
 * so every URL in every sitemap carried the build timestamp and
 * `node scripts/cadence_gate.js` reported `uniform_lastmod: 183 of 183`.
 *
 * Why it matters. `<lastmod>` is a claim to a crawler about when the page
 * changed, and recency is the strongest single correlate of whether an answer
 * engine cites a page at all. A date that advances for every page on every
 * build says nothing about which page changed, and it is false for every page
 * that did not. It also hides real decay: a page can sit untouched for a year
 * while its sitemap entry keeps claiming it was refreshed this morning.
 *
 * How this fixes it. The ledger stores `{url: {hash, lastmod, first_seen}}` in
 * data/cadence/lastmod_ledger.json, beside the known_urls.json the cadence gate
 * already keeps, and follows that file's conventions rather than adding a
 * parallel system. The hash is taken over the rendered page with build
 * timestamps normalised out - a build clock is not content - so a rebuild that
 * produces the same page keeps the date it already had, and only a page whose
 * content actually changed advances.
 *
 * Seeding. Entries are seeded from the tree as it stands on `seeded_on`, with
 * that date on every entry. Nothing in this repository records when each page
 * last substantively changed, so no historical dates were reconstructed; dates
 * diverge from the seed onward.
 *
 * Merge, never prune. `dist/` holds one pack at a time and
 * scripts/build_all_packs.js overwrites it once per pack, so any single run
 * sees only a slice of the published URLs. Pruning the entries a run did not
 * see would delete the other packs' recorded dates and reset them to the build
 * date on their next build.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA = 'lastmod-ledger-v1';
const DEFAULT_PATH = path.join(process.cwd(), 'data', 'cadence', 'lastmod_ledger.json');

const NOTE =
  'Per-URL content hash and the date that content last changed. lastmod only advances ' +
  'for a URL whose hash changed; see scripts/lib/lastmod_ledger.js. Seeded from the tree ' +
  'as it stood on seeded_on - no historical dates were reconstructed, because none are ' +
  'recorded anywhere in this repository. Entries are merged, never pruned: dist/ holds ' +
  'one pack at a time.';

// A build timestamp is not content. Normalising it out is what lets an
// unchanged page keep its date across a rebuild.
const BUILD_STAMP = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/g;

function buildDate() {
  const override = String(process.env.BUILD_DATE || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Date().toISOString().slice(0, 10);
}

function contentHash(html) {
  return crypto.createHash('sha256').update(String(html).replace(BUILD_STAMP, '<<BUILD_TIMESTAMP>>')).digest('hex');
}

function load(ledgerPath = DEFAULT_PATH) {
  if (!fs.existsSync(ledgerPath)) return { schema: SCHEMA, note: NOTE, seeded_on: null, entries: {} };
  let data;
  try {
    data = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  } catch (err) {
    // A corrupt ledger must not silently degrade to "everything changed today".
    throw new Error(`lastmod ledger is not valid JSON: ${ledgerPath}`);
  }
  if (!data.entries || typeof data.entries !== 'object') data.entries = {};
  return data;
}

/** Map {url: hash} to {url: {lastmod, first_seen}}. Pure: reads, never writes. */
function resolve(hashes, ledger, today) {
  const day = today || buildDate();
  const entries = (ledger && ledger.entries) || {};
  const out = {};
  for (const [url, hash] of Object.entries(hashes)) {
    const prev = entries[url];
    const unchanged = prev && prev.hash === hash && prev.lastmod;
    out[url] = {
      lastmod: unchanged ? prev.lastmod : day,
      first_seen: (prev && prev.first_seen) || (unchanged ? prev.lastmod : day)
    };
  }
  return out;
}

/** The ledger to persist: existing entries plus this run's, sorted, none dropped. */
function merged(hashes, ledger, today) {
  const day = today || buildDate();
  const resolved = resolve(hashes, ledger, day);
  const entries = Object.assign({}, (ledger && ledger.entries) || {});
  for (const [url, hash] of Object.entries(hashes)) {
    entries[url] = { hash, lastmod: resolved[url].lastmod, first_seen: resolved[url].first_seen };
  }
  const sorted = {};
  for (const url of Object.keys(entries).sort()) sorted[url] = entries[url];
  return {
    schema: SCHEMA,
    note: NOTE,
    seeded_on: (ledger && ledger.seeded_on) || day,
    entries: sorted
  };
}

function save(ledger, ledgerPath = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const tmp = `${ledgerPath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, ledgerPath);
}

module.exports = { SCHEMA, DEFAULT_PATH, BUILD_STAMP, buildDate, contentHash, load, resolve, merged, save };
