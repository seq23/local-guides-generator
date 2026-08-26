#!/usr/bin/env node
'use strict';
/**
 * Compile the citation probe's query set from the queries this library is
 * actually built to answer.
 *
 * The probe needs real queries or it measures nothing worth knowing. Inventing a
 * plausible-looking list would produce a number that moves for reasons unrelated
 * to the pages. So the list is compiled from data/community/query_compiler/,
 * which is where each pack's target queries already live and what the on-page
 * fan-out clusters are built from - the same strings the pages are written
 * against.
 *
 * `{market}` placeholders are filled with a real covered market from that pack's
 * own city list, because "find a civil surgeon in {market}" is not a query
 * anybody types and the templated form is the one the pages target. The
 * substitution is recorded per row so a reader can tell a templated query from a
 * literal one.
 *
 * Usage: node scripts/citation_probe_queries_emit.js [--per-pack N]
 */
const fs = require('fs');
const path = require('path');
const { PACK_SITE_CONFIG } = require('./lib/pack_site_config');

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const perPackIdx = argv.indexOf('--per-pack');
const PER_PACK = perPackIdx >= 0 ? Number(argv[perPackIdx + 1]) : 6;
const OUT = path.join(ROOT, 'data', 'signals', 'citation_probe_queries.json');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// query_compiler files are keyed by vertical, not by pack key.
const VERTICAL_FILE = {
  pi: 'pi', dentistry: 'dentistry', trt: 'trt', neuro: 'neuro', uscis_medical: 'uscis_medical',
};

function collectQueries(obj, out = []) {
  if (Array.isArray(obj)) { for (const v of obj) collectQueries(v, out); return out; }
  if (obj && typeof obj === 'object') {
    if (typeof obj.query === 'string' && obj.query.trim()) out.push(obj.query.trim());
    for (const v of Object.values(obj)) collectQueries(v, out);
  }
  return out;
}

function firstMarket(pack) {
  const file = path.join(ROOT, 'data', 'page_sets', 'examples', `cities_${pack}_v1.json`);
  if (!fs.existsSync(file)) return '';
  const raw = readJson(file);
  const cities = Array.isArray(raw) ? raw : (raw.cities || []);
  const c = cities.find((x) => x && (x.marketLabel || x.slug));
  return c ? String(c.marketLabel || c.slug) : '';
}

const rows = [];
for (const [pack, cfg] of Object.entries(PACK_SITE_CONFIG)) {
  const vertical = VERTICAL_FILE[pack];
  if (!vertical) continue; // the starter pack is a training sandbox, not a published site
  const qfile = path.join(ROOT, 'data', 'community', 'query_compiler', `${vertical}.json`);
  if (!fs.existsSync(qfile)) continue;
  const market = firstMarket(pack);
  const seen = new Set();
  const picked = [];
  for (const q of collectQueries(readJson(qfile))) {
    const templated = q.includes('{market}');
    if (templated && !market) continue;
    const text = templated ? q.split('{market}').join(market) : q;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ query: text, pack, host: new URL(cfg.siteUrl).hostname, templated_market: templated ? market : null });
    if (picked.length >= PER_PACK) break;
  }
  rows.push(...picked);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  _why:
    'Query set for scripts/llm_citation_probe.mjs, compiled from data/community/query_compiler/ - ' +
    'the queries each pack is already written to answer. Not hand-written for the probe, so the ' +
    'measurement is against the same targets the pages were built for. Regenerate with ' +
    'node scripts/citation_probe_queries_emit.js.',
  generated_from: 'data/community/query_compiler/<vertical>.json',
  per_pack: PER_PACK,
  queries: rows,
}, null, 2)}\n`);

const byPack = rows.reduce((acc, r) => { acc[r.pack] = (acc[r.pack] || 0) + 1; return acc; }, {});
console.log(`citation_probe_queries: ${rows.length} queries written to ${path.relative(ROOT, OUT)} (${JSON.stringify(byPack)})`);
