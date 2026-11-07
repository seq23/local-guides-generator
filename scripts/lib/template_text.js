'use strict';
/**
 * Template text: a sentence that every city's research file carries with only the
 * place name (or a number) swapped in.
 *
 * WHY. data/city_content/<vertical>/<slug>.json reads as per-city research, but
 * most of its lines were written once and interpolated: "Ask whether the clinic
 * sees San Diego patients in person, by telehealth, or both" sits in all 56 TRT
 * files with only the city changed, and the state-level cost lines are the same
 * sentence with four numbers swapped. Printed on every city page, those lines are
 * why any two city pages of a site came back more than half identical in the
 * Monday quality sample (Search Readiness q1, 7 Nov 2026: hormonesivhair
 * san-diego-ca / san-francisco-ca 0.86, neuroevalguides wilmington-de /
 * philadelphia-pa / newark-nj, theaccidentguides denver-co / albuquerque-nm 0.84).
 *
 * The rule: a line whose masked form (place names out, digits out) appears in at
 * least TEMPLATE_MIN_FILES files of the same vertical is template text. The city
 * page does not print it; what the page prints is what is true only of that city.
 * The same checklist lives once on the site's guides, which every city page links.
 *
 * pairwiseSimilarity() is the measure the Monday audit applies (boss-os
 * page-quality-sample.mjs: Jaccard of 5-word shingles over <main> text) so the
 * build can hold every page kind under it (scripts/validation/cross_page_similarity_contract.js).
 */
const fs = require('fs');
const path = require('path');

const TEMPLATE_MIN_FILES = 3;

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Lowercased text with the city, state and state abbreviation out and every digit run as '#'. */
function maskText(text, ctx = {}) {
  let t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ') + ' ';
  const names = [ctx.city, ctx.state, ctx.stateName].filter(Boolean).map((x) => String(x).toLowerCase().trim()).filter((x) => x.length > 2)
    .sort((a, b) => b.length - a.length);
  for (const n of names) t = t.split(n).join('{p}');
  if (ctx.abbr) t = t.replace(new RegExp('\\b' + escapeRe(String(ctx.abbr).toLowerCase()) + '\\b', 'g'), '{p}');
  return t.replace(/\$?\d[\d,.]*%?/g, '#').replace(/\s+/g, ' ').trim();
}

function collectStrings(obj, out = []) {
  if (typeof obj === 'string') { if (obj.trim()) out.push(obj); return out; }
  if (Array.isArray(obj)) { for (const x of obj) collectStrings(x, out); return out; }
  if (obj && typeof obj === 'object') { for (const [k, v] of Object.entries(obj)) if (!k.startsWith('_')) collectStrings(v, out); }
  return out;
}

const _cache = new Map();
/** For one vertical's research dir: masked line -> number of files carrying it. */
function templateCounts(dir) {
  if (_cache.has(dir)) return _cache.get(dir);
  const counts = new Map();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      let raw; try { raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { continue; }
      const ctx = { city: raw.city, state: raw.state, abbr: raw.state_abbr };
      for (const m of new Set(collectStrings(raw).map((s) => maskText(s, ctx)))) counts.set(m, (counts.get(m) || 0) + 1);
    }
  }
  _cache.set(dir, counts);
  return counts;
}

function isTemplateLine(text, ctx, counts, min = TEMPLATE_MIN_FILES) {
  return (counts.get(maskText(text, ctx)) || 0) >= min;
}

/** content (normalised city research) with every template line removed. */
function stripTemplateLines(content, dir) {
  if (!content || content.is_template_fallback) return content;
  const counts = templateCounts(dir);
  const ctx = { city: content.city, state: content.state, abbr: content.state_abbr };
  const keep = (s) => !isTemplateLine(s, ctx, counts);
  const out = { ...content };
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[k] = v.filter(keep);
  }
  if (out.city_intro_override && !keep(out.city_intro_override)) out.city_intro_override = '';
  if (out.primary_city_decision_block && Array.isArray(out.primary_city_decision_block.items)) {
    out.primary_city_decision_block = { ...out.primary_city_decision_block, items: out.primary_city_decision_block.items.filter(keep) };
  }
  return out;
}

// ---- the audit's measure -------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•', hellip: '…' };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
function visibleText(html) {
  return decode(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
/** <main> (else <article>, else the page without nav/header/footer) as text. */
function bodyText(html) {
  const h = String(html || '');
  const main = (h.match(/<main\b[\s\S]*?<\/main>/i) || [])[0] || (h.match(/<article\b[\s\S]*?<\/article>/i) || [])[0];
  return visibleText(main || h.replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' '));
}
const wordsOf = (t) => String(t).toLowerCase().match(/[a-z0-9][\w'’-]*/g) || [];
function shingles(text, k = 5) {
  const w = wordsOf(text); const s = new Set();
  for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(' '));
  return s;
}
function jaccard(A, B) {
  if (!A.size || !B.size) return 0;
  const [small, large] = A.size < B.size ? [A, B] : [B, A];
  let inter = 0; for (const x of small) if (large.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
/** pages: [{ id, html }] -> every pair's similarity, highest first. */
function pairwiseSimilarity(pages) {
  const sets = pages.map((p) => ({ id: p.id, s: shingles(bodyText(p.html)) }));
  const pairs = [];
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) pairs.push({ a: sets[i].id, b: sets[j].id, sim: jaccard(sets[i].s, sets[j].s) });
  return pairs.sort((x, y) => y.sim - x.sim);
}

module.exports = { TEMPLATE_MIN_FILES, maskText, templateCounts, isTemplateLine, stripTemplateLines, visibleText, bodyText, shingles, jaccard, pairwiseSimilarity };
