'use strict';
/**
 * The one definition of which internal links may carry a query string, and
 * which keys.
 *
 * Why it is shared. scripts/build_city_sites.js (moveInternalQueryToData)
 * decides what stays in an href, and scripts/validation/link_audit.js decides
 * what is allowed to be there. Those are the same rule. Kept as two lists they
 * would be the "two components each keeping their own list" defect: the build
 * would emit a link the audit rejects, or - worse - the audit would pass a link
 * the build no longer emits. Both read this module, which reads one config file.
 *
 * Why any query is allowed at all. Attribution normally travels in
 * `data-attr-qs` and is restored by /assets/attr-carry.js, because every
 * distinct query was crawled as its own URL (Ahrefs: 1,306 uscisexam URLs in a
 * week against a 228-URL sitemap). That fix stands. The exception is narrow and
 * bounded: the conversion CTA needs `vertical`, `page_kind` and `page_slug` in
 * the href itself so a lead is attributable to the page it came from without
 * JavaScript, which is what Search Readiness item j3 is about. Those three keys
 * are low-cardinality - one combination per page, not one per source/intent/
 * button/market product - so they add about one URL per guide rather than
 * hundreds, and /request-assistance/ canonicalises to its clean path.
 *
 * High-cardinality keys (src, intent, button, market, pt) stay in data-attr-qs.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_REL = path.join('config', 'internal_query_allowlist.json');

function loadEntries(repoRoot) {
  const p = path.join(repoRoot || process.cwd(), CONFIG_REL);
  if (!fs.existsSync(p)) throw new Error(`internal_query_policy: ${CONFIG_REL} missing.`);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (raw.prefixes || []).map((entry) => {
    // A bare string keeps the old meaning: that prefix may carry any query.
    if (typeof entry === 'string') return { prefix: entry, keys: null };
    return {
      prefix: String(entry.prefix || ''),
      keys: Array.isArray(entry.keys) ? entry.keys.map(String) : null,
    };
  }).filter((e) => e.prefix);
}

/** The matching entry for a path, or null. Longest prefix wins. */
function entryFor(pathPart, repoRoot) {
  const p = String(pathPart || '');
  let best = null;
  for (const e of loadEntries(repoRoot)) {
    if (p.startsWith(e.prefix) && (!best || e.prefix.length > best.prefix.length)) best = e;
  }
  return best;
}

/** The query keys this path may carry in an href: [] when none may. */
function allowedKeys(pathPart, repoRoot) {
  const e = entryFor(pathPart, repoRoot);
  if (!e) return [];
  return e.keys === null ? null : e.keys; // null = any key
}

/**
 * Split a query string into the part that may stay in the href and the part
 * that must travel in data-attr-qs.
 */
// A query string inside an href is HTML, so its separators arrive escaped:
// `pt=X&amp;vertical=pi`. Splitting that on a bare '&' yields the key
// "amp;vertical", which matches no allow-list entry - every key would look
// disallowed and be carried away. Split on either form, and re-join with the
// escaped form, which is what an href has to contain.
const PAIR_SEPARATOR = /&(?:amp;)?/;
const JOIN = '&amp;';

function splitPairs(query) {
  return String(query || '').split(PAIR_SEPARATOR).filter(Boolean);
}

function keyOf(pair) {
  try { return decodeURIComponent(String(pair).split('=')[0] || ''); }
  catch { return String(pair).split('=')[0] || ''; }
}

function splitQuery(pathPart, query, repoRoot) {
  const pairs = splitPairs(query);
  const keys = allowedKeys(pathPart, repoRoot);
  if (keys === null) return { keep: pairs.join(JOIN), carry: '' };
  if (!keys.length) return { keep: '', carry: pairs.join(JOIN) };
  const keep = [];
  const carry = [];
  for (const pair of pairs) {
    (keys.includes(keyOf(pair)) ? keep : carry).push(pair);
  }
  return { keep: keep.join(JOIN), carry: carry.join(JOIN) };
}

/** Every key in this query that the path is not allowed to carry in its href. */
function disallowedKeys(pathPart, query, repoRoot) {
  const keys = allowedKeys(pathPart, repoRoot);
  if (keys === null) return [];
  return splitPairs(query).map(keyOf).filter((k) => !keys.includes(k));
}

module.exports = { CONFIG_REL, loadEntries, entryFor, allowedKeys, splitQuery, disallowedKeys };
