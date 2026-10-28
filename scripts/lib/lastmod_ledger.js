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

// Bumped to v3 on 26 Oct 2026. The hash point moved, not the content: until then
// scripts/build_all_packs.js hashed the page BEFORE apply_robots_policy.js rewrote
// <main>, while the deploy's `npm run build` hashed it after, so the committed
// ledger could never match what ships. Re-keying those hashes is a re-basing, and
// resolve() must hold every recorded date through it - advancing them would claim
// 67 pages changed today when only the measurement did.
const SCHEMA = 'lastmod-ledger-v3';
// What the hash is taken over. Bump this when the basis changes so a re-basing
// can be told apart from a content change. `after-robots-policy` records that the
// hash is taken at the end of the mutating pipeline, which is where both pipelines
// now hash (scripts/validation/lastmod_hash_point_contract.js pins it).
const HASH_BASIS = 'main-content-after-robots-policy';
const DEFAULT_PATH = path.join(process.cwd(), 'data', 'cadence', 'lastmod_ledger.json');

const NOTE =
  'Per-URL content hash and the date that content last changed. lastmod only advances ' +
  'for a URL whose hash changed; see scripts/lib/lastmod_ledger.js. Seeded from the tree ' +
  'as it stood on seeded_on - no historical dates were reconstructed, because none are ' +
  'recorded anywhere in this repository. Entries are merged, never pruned: dist/ holds ' +
  'one pack at a time.';

// The note once scripts/reseed_lastmod_from_git.js has replaced the seed dates
// with real commit dates. merged() must carry this (and reseeded_from_git_on)
// through every build: writing NOTE back over it would make the committed
// ledger claim that no historical dates were reconstructed when they were.
const RESEEDED_NOTE =
  'Per-URL content hash and the date that content last changed. lastmod only advances for a ' +
  'URL whose hash changed; see scripts/lib/lastmod_ledger.js. Dates were reseeded from real ' +
  'git history by scripts/reseed_lastmod_from_git.js: lastmod is the newest commit date across ' +
  'the committed files that page is rendered from, first_seen the oldest commit that added one ' +
  'of them. A URL whose sources could not be resolved kept its previous entry rather than being ' +
  'given an invented date. Entries are merged, never pruned: dist/ holds one pack at a time.';

// A build timestamp is not content. Normalising it out is what lets an
// unchanged page keep its date across a rebuild.
const BUILD_STAMP = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/g;

function buildDate() {
  const override = String(process.env.BUILD_DATE || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  return new Date().toISOString().slice(0, 10);
}

// Global chrome is not content either. A page's <main> is what a reader and a
// retrieval system are actually there for; the header nav, the footer and the
// policy links are the same on every page by construction. Hashing the whole
// document meant one link added to the footer partial advanced <lastmod> on all
// 183 URLs at once - the exact uniform_lastmod signal this ledger exists to
// remove, re-created by a cosmetic edit. Hash the main region instead, so a
// template tweak is silent and a rewritten page is not.
const MAIN_REGION = /<main\b[^>]*>([\s\S]*?)<\/main>/i;

function hashableBody(html) {
  const doc = String(html);
  const m = doc.match(MAIN_REGION);
  // No <main> is a real possibility (redirect stubs, 404). Falling back to the
  // whole document is correct there - it is the only content those pages have -
  // and it is conservative: at worst such a page keeps the old behaviour.
  // The senior wizard's empty mount changed from a div to a semantic form.
  // Its questions still come from senior-intake.js; that wrapper is not an
  // editorial refresh of 183 pages. Keep the historical representation in the
  // hash, retaining the city/ZIP attributes and every byte of actual content.
  // Only this empty mount is equivalent; populated or unrelated forms are not.
  return (m ? m[1] : doc).replace(
    /<form id="senior-intake" aria-label="Senior care matching" (data-vertical="senior-living" data-city="[^"]*" data-zip="[^"]*")><\/form>/g,
    '<div id="senior-intake" $1></div>'
  );
}

function contentHash(html) {
  return crypto.createHash('sha256').update(hashableBody(html).replace(BUILD_STAMP, '<<BUILD_TIMESTAMP>>')).digest('hex');
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
    // Changing what we hash is not the same as the content changing. On the run
    // that migrates the basis every stored hash mismatches, and advancing every
    // date on that basis would publish a library-wide freshness claim that is
    // false for every page. Keep the recorded dates and only re-key the hashes.
    //
    // The basis is recorded per ENTRY, not once per file, because
    // scripts/build_all_packs.js saves the ledger between packs: a flag read
    // once from the file header would be true for the first pack and false for
    // the remaining five, so only one site would be held and the rest would
    // advance on a measurement change. A per-entry basis is also self-clearing -
    // once an entry is re-keyed it carries the current basis and behaves
    // normally again, with no migration state left anywhere.
    const rebasing = Boolean(prev && prev.basis !== HASH_BASIS);
    const unchanged = prev && prev.lastmod && (rebasing || prev.hash === hash);
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
    // `basis` records what this entry's hash was taken over, so resolve() can
    // tell a re-keying apart from a content change one URL at a time.
    entries[url] = { hash, basis: HASH_BASIS, lastmod: resolved[url].lastmod, first_seen: resolved[url].first_seen };
  }
  const sorted = {};
  for (const url of Object.keys(entries).sort()) sorted[url] = entries[url];
  const reseeded = ledger && ledger.reseeded_from_git_on;
  const out = {
    schema: SCHEMA,
    hash_basis: HASH_BASIS,
    note: reseeded ? RESEEDED_NOTE : NOTE,
    seeded_on: (ledger && ledger.seeded_on) || day,
  };
  if (reseeded) out.reseeded_from_git_on = reseeded;
  out.entries = sorted;
  return out;
}

function save(ledger, ledgerPath = DEFAULT_PATH) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const tmp = `${ledgerPath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, ledgerPath);
}

module.exports = { SCHEMA, HASH_BASIS, NOTE, RESEEDED_NOTE, DEFAULT_PATH, BUILD_STAMP, buildDate, contentHash, hashableBody, load, resolve, merged, save };
