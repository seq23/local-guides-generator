'use strict';
/**
 * Demand families: the strengthening selection rule, in one place.
 *
 * Read by scripts/search_intelligence/build_search_plan.mjs (writes
 * data/search_intelligence/<host>/demand_families.json), by
 * scripts/search_intelligence/render_blocks.js (which state hubs render the
 * state strengthening block) and by scripts/validation/demand_families_contract.js
 * (recomputes and compares), so the rule cannot drift between them.
 *
 * A family is (intent, landing page): queries from the 28-day Search Console
 * export (rows: query x page) whose head term (data/search_intelligence/
 * demand_intents.json) is the same and that land on the same page. State hubs
 * collapse to /states/{STATE}/ because one template renders all of them.
 *
 * A family qualifies for strengthening when
 *   (a) any page in it has >= 2 impressions at average position <= 15 (the
 *       original rule: pages that already rank), OR
 *   (b) it is one of the site's top 5 families by 28-day impressions, has at
 *       least MIN_FAMILY_IMPRESSIONS, and its impression-weighted position is
 *       <= 95 (pages Google already tests for real demand).
 * A qualifying family is served when its landing page's intent matches the
 * family's intent: a guide is strengthened through its page-set JSON
 * search_strengthening; a state hub family strengthens every state page in it
 * with >= STATE_PAGE_MIN_IMPRESSIONS through the pack page set's
 * search_strengthening.state_hub template. Anything else carries its reason.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SI = path.join(ROOT, 'data', 'search_intelligence');
const RULE = Object.freeze({
  top_n: 5,
  max_position: 95,
  min_family_impressions: 5,
  state_page_min_impressions: 10,
  ranking_position: 15,
  ranking_min_impressions: 2
});
const SERVED = new Set(['strengthened', 'intent_mismatch', 'no_page', 'position_beyond_max', 'below_impression_floor']);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const round1 = (n) => Math.round(n * 10) / 10;
const routeOf = (url) => { try { return new URL(url).pathname; } catch (_) { return String(url || ''); } };
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };

function loadIntents() {
  const lex = JSON.parse(fs.readFileSync(path.join(SI, 'demand_intents.json'), 'utf8'));
  if (!Array.isArray(lex.intents) || !lex.intents.length || !lex.state_hub_intent) throw new Error('demand_intents.json: intents[] and state_hub_intent are required');
  return { stateHubIntent: lex.state_hub_intent, intents: lex.intents.map((i) => ({ ...i, re: new RegExp(i.pattern) })) };
}

function classify(text, lex) {
  const t = norm(text);
  const hit = lex.intents.find((i) => i.re.test(t));
  return hit ? hit.intent : null;
}

function pageKind(route) {
  if (/^\/states\/[A-Z]{2}\/$/.test(route)) return 'state_hub';
  if (/^\/guides\/[^/]+\/$/.test(route)) return 'guide';
  if (route === '/' || route === '/guides/') return 'hub';
  return 'other';
}

function pageIntent(route, guide, lex) {
  const kind = pageKind(route);
  if (kind === 'state_hub') return lex.stateHubIntent;
  if (kind === 'guide') return classify(route.replace(/[-/]/g, ' '), lex) || (guide && classify(guide.title, lex)) || `topic:${route.split('/')[2]}`;
  return kind;
}

/** Guide pages of a site, from its global_pages_dir (route, title, source file, strengthening). */
function loadGuides(site) {
  const dir = path.join(ROOT, site.global_pages_dir);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const d = readJson(path.join(dir, f), {});
    return { route: d.route, title: d.title || '', source: path.relative(ROOT, path.join(dir, f)), has_strengthening: !!(d.search_strengthening && d.search_strengthening.definition) };
  }).filter((g) => /^\/guides\/[^/]+\/$/.test(g.route || ''));
}

function packPageSetFile(site) {
  return `data/page_sets/examples/${site.pack}_v1.json`;
}

function stateHubTemplate(site) {
  const ps = readJson(path.join(ROOT, packPageSetFile(site)), {});
  const t = ps.search_strengthening && ps.search_strengthening.state_hub;
  return t && t.definition && Array.isArray(t.faq) && t.faq.length ? t : null;
}

function strengthenedSet() {
  const pages = readJson(path.join(SI, 'strengthened_pages.json'), { pages: [] }).pages || [];
  return new Set(pages.map((p) => `${p.host}${p.route}`));
}

/**
 * Deterministic: same export + same sources = same families.
 * ctx = { site, gsc, guides, strengthened:Set, stateTemplate:boolean, lex }
 */
function computeFamilies(ctx) {
  const { site, gsc, guides, strengthened, stateTemplate, lex } = ctx;
  const guideByRoute = new Map(guides.map((g) => [g.route, g]));
  const byPage = new Map((gsc.by_page || []).map((p) => [routeOf(p.page), p]));
  const fams = new Map();
  for (const r of gsc.rows || []) {
    if (!(r.impressions > 0)) continue;
    const route = routeOf(r.page);
    const kind = pageKind(route);
    const template = kind === 'state_hub' ? '/states/{STATE}/' : route;
    const pIntent = pageIntent(route, guideByRoute.get(route), lex);
    const intent = classify(r.query, lex) || pIntent;
    const key = `${intent} ${template}`;
    if (!fams.has(key)) fams.set(key, { intent, page: template, page_kind: kind, page_intent: pIntent, rows: [] });
    fams.get(key).rows.push({ query: r.query, route, impressions: r.impressions, position: r.position });
  }
  const headOf = (intent) => (lex.intents.find((i) => i.intent === intent) || {}).head_term || intent;
  const list = [...fams.values()].map((f) => {
    const impressions = f.rows.reduce((a, r) => a + r.impressions, 0);
    const weighted = round1(f.rows.reduce((a, r) => a + r.impressions * r.position, 0) / impressions);
    const queries = f.rows.slice().sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query) || a.route.localeCompare(b.route));
    const perPage = new Map();
    for (const r of f.rows) perPage.set(r.route, (perPage.get(r.route) || 0) + r.impressions);
    const pages = [...perPage.entries()].map(([route, imp]) => {
      const m = byPage.get(route) || {};
      return { route, family_impressions: imp, page_impressions: m.impressions || 0, page_position: m.position == null ? null : m.position };
    }).sort((a, b) => b.family_impressions - a.family_impressions || a.route.localeCompare(b.route));
    return {
      family: `${headOf(f.intent)} @ ${f.page}`, intent: f.intent, head_term: headOf(f.intent),
      page: f.page, page_kind: f.page_kind, page_intent: f.page_intent,
      impressions, best_position: Math.min(...f.rows.map((r) => r.position)), weighted_position: weighted,
      top_query: queries[0].query, query_count: queries.length, queries, pages
    };
  }).sort((a, b) => b.impressions - a.impressions || a.family.localeCompare(b.family));

  list.forEach((f, i) => {
    f.rank = i + 1;
    const ranking = f.pages.some((p) => p.page_impressions >= RULE.ranking_min_impressions && p.page_position != null && p.page_position <= RULE.ranking_position);
    const top = f.rank <= RULE.top_n;
    const demand = top && f.impressions >= RULE.min_family_impressions && f.weighted_position <= RULE.max_position;
    f.basis = [ranking && 'ranking_page', demand && 'top_demand'].filter(Boolean);
    f.qualifies = f.basis.length > 0;
    f.strengthened_pages = [];
    if (!f.qualifies) {
      if (!top) { f.status = 'not_top_family'; f.reason = `rank ${f.rank} of ${list.length} by impressions; no page at position <= ${RULE.ranking_position}`; }
      else if (f.impressions < RULE.min_family_impressions) { f.status = 'below_impression_floor'; f.reason = `${f.impressions} impressions < ${RULE.min_family_impressions}`; }
      else { f.status = 'position_beyond_max'; f.reason = `weighted position ${f.weighted_position} > ${RULE.max_position}`; }
      return;
    }
    if (f.page_kind === 'hub' || f.page_kind === 'other') {
      f.status = 'no_page'; f.reason = `lands on ${f.page} (${f.page_kind}); no guide or state hub serves "${f.head_term}" there`; return;
    }
    if (f.intent !== f.page_intent) {
      f.status = 'intent_mismatch'; f.reason = `query intent ${f.intent} vs page intent ${f.page_intent}` +
        (f.intent === 'license_lookup' ? ' (licence lookups are the provider audience; the state-hub audience block serves them)' : ''); return;
    }
    if (f.page_kind === 'guide') {
      const g = guideByRoute.get(f.page);
      if (!g) { f.status = 'no_page'; f.reason = `${f.page} has no page-set JSON in ${site.global_pages_dir}`; return; }
      f.strengthened_pages = [f.page];
      f.status = strengthened.has(`${site.host}${f.page}`) && g.has_strengthening ? 'strengthened' : 'not_strengthened';
      f.reason = f.status === 'strengthened' ? `${g.source} search_strengthening` : `${g.source} has no search_strengthening listed in strengthened_pages.json`;
      return;
    }
    // State hub family: every state page carrying enough of the family's demand.
    const eligible = f.pages.filter((p) => p.family_impressions >= RULE.state_page_min_impressions ||
      (p.page_impressions >= RULE.ranking_min_impressions && p.page_position != null && p.page_position <= RULE.ranking_position));
    if (!eligible.length) {
      f.status = 'no_page'; f.reason = `no state page in the family has >= ${RULE.state_page_min_impressions} impressions (largest ${f.pages[0].family_impressions} on ${f.pages[0].route})`; return;
    }
    f.strengthened_pages = eligible.map((p) => p.route);
    f.status = stateTemplate ? 'strengthened' : 'not_strengthened';
    f.reason = stateTemplate ? `${packPageSetFile(site)} search_strengthening.state_hub` : `${packPageSetFile(site)} has no search_strengthening.state_hub template`;
  });
  return list;
}

function contextFor(site, gsc) {
  return { site, gsc, guides: loadGuides(site), strengthened: strengthenedSet(), stateTemplate: !!stateHubTemplate(site), lex: loadIntents() };
}

/** The demand_families.json document for one site (no timestamps of its own: it is a pure function of its inputs). */
function buildDocument(site, gsc) {
  const families = computeFamilies(contextFor(site, gsc));
  return {
    schema_version: '1.0', host: site.host,
    gsc_window: `${gsc.start_date}..${gsc.end_date}`, gsc_collected_at: gsc.collected_at,
    rule: `A family is (head term from demand_intents.json, landing page; state hubs collapse to /states/{STATE}/). It qualifies if (a) a page in it has >= ${RULE.ranking_min_impressions} impressions at position <= ${RULE.ranking_position}, or (b) it is in the site's top ${RULE.top_n} families by 28-day impressions with >= ${RULE.min_family_impressions} impressions at impression-weighted position <= ${RULE.max_position}. A qualifying family is strengthened on its landing page when the page's intent matches (state hubs: every state page with >= ${RULE.state_page_min_impressions} family impressions); otherwise it records the reason.`,
    thresholds: RULE,
    family_count: families.length,
    top_families: families.filter((f) => f.rank <= RULE.top_n).map((f) => ({ rank: f.rank, family: f.family, impressions: f.impressions, status: f.status })),
    families
  };
}

/** State routes on a host whose state-hub strengthening renders (read by render_blocks.js at build time). */
function strengthenedStateRoutes(host) {
  const doc = readJson(path.join(SI, host, 'demand_families.json'), null);
  if (!doc) return new Set();
  return new Set(doc.families.filter((f) => f.page_kind === 'state_hub' && f.status === 'strengthened').flatMap((f) => f.strengthened_pages));
}

module.exports = { RULE, SERVED, norm, routeOf, loadIntents, classify, pageKind, computeFamilies, contextFor, buildDocument, loadGuides, stateHubTemplate, packPageSetFile, strengthenedStateRoutes };
