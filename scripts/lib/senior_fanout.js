'use strict';
/**
 * Expands data/fanout/senior_living_query_universe.json into one fan-out record
 * per query, each pointing at the ONE page that answers it best (city page,
 * guide, /faq/ or home), in the same record shape scripts/helpers/fanout.js
 * writes for every pack.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const UNIVERSE = path.join(ROOT, 'data', 'fanout', 'senior_living_query_universe.json');

function loadUniverse() { return JSON.parse(fs.readFileSync(UNIVERSE, 'utf8')); }

function stateOfRoute(route) {
  const m = String(route).match(/-(tn|ms|ar)\/$/);
  return m ? m[1].toUpperCase() : 'TN';
}

function labelFor(route) {
  if (route === '/') return 'Home';
  if (route === '/faq/') return 'FAQ';
  if (route.startsWith('/guides/')) return 'Guide';
  return 'Licensed communities';
}

// A market with its own memory care / assisted living page (kind care_type in
// the cities file) answers its care-type searches there, not on the town page.
function careTypeRoutes() {
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_senior_living_v1.json'), 'utf8'));
  const out = {};
  for (const p of pages) if (p.kind === 'care_type') (out['/' + p.base_slug + '/'] = out['/' + p.base_slug + '/'] || {})[p.care_type] = '/' + p.slug + '/';
  return out;
}

function expandQueries(u = loadUniverse()) {
  const out = [];
  const add = (query, route, topic, locality) => out.push({ query: query.replace(/\s+/g, ' ').trim(), route, topic, locality: locality || '' });
  const care = careTypeRoutes();
  const phraseType = {};
  for (const [type, phrases] of Object.entries(u.care_type_phrases || {})) for (const p of phrases) phraseType[p] = type;
  const routeFor = (p, route) => (care[route] && care[route][phraseType[p]]) || route;
  for (const loc of u.localities) {
    for (const p of u.place_phrases) for (const t of u.place_templates) add(t.replace('{p}', p).replace('{l}', loc.name), routeFor(p, loc.route), p, loc.name);
    for (const g of u.located_guide_phrases) {
      if (g.only_states && !g.only_states.includes(stateOfRoute(loc.route))) continue;
      add(g.q.replace('{l}', loc.name), g.route, g.q.replace(' {l}', '').replace('{l}', ''), loc.name);
    }
  }
  for (const [zip, route] of Object.entries(u.zips)) {
    for (const p of [...u.place_phrases, ...u.zip_phrases]) add(`${p} ${zip}`, /nursing home/.test(p) ? '/guides/levels-of-care-tennessee/' : routeFor(p, route), p, zip);
  }
  for (const p of u.place_phrases) for (const t of u.near_me_templates) add(t.replace('{p}', p), '/', p, 'near me');
  for (const h of u.hospitals) for (const n of h.names) for (const t of u.hospital_templates) add(t.replace('{h}', n), h.route, t.replace(' {h}', ''), n);
  for (const q of u.questions) add(q.q, q.route, q.q, '');
  const seen = new Set();
  return out.filter((r) => { const k = r.query.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

function fanoutRecords() {
  return expandQueries().map((r) => ({
    pageKind: 'query',
    route: r.route,
    title: r.query,
    topic: r.topic,
    locality: r.locality,
    groups: [{ id: 'primary', label: 'Best page for this search', items: [{ query: r.query, href: r.route, label: labelFor(r.route) }] }],
  }));
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// The searches a page answers, shown on the page itself (visible text only; no schema).
function searchesHtml(route, limit = 40) {
  const qs = expandQueries().filter((r) => r.route === route).map((r) => r.query);
  if (!qs.length) return '';
  const shown = qs.slice(0, limit);
  return '<section class="section senior-searches" data-senior-searches="' + qs.length + '">' +
    '<h2>Searches this page answers</h2>' +
    '<p class="muted">Families reach this page by searching for things like:</p>' +
    '<ul class="senior-search-list">' + shown.map((q) => '<li>' + esc(q) + '</li>').join('') + '</ul>' +
    '</section>';
}

module.exports = { loadUniverse, expandQueries, fanoutRecords, searchesHtml };
