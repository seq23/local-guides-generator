#!/usr/bin/env node
// Per site in data/search_intelligence/sites.json, from MEASURED sources only:
//
//   target_query_set.json        every query with Search Console impressions in the
//                                rolling 28 days (owner page = the page Google showed
//                                most for it), plus measured_demand.json records with a
//                                measured volume. Each target carries source + number.
//   consolidation_candidates.json guide pages with 0 impressions and thin content
//                                (< THIN_WORDS words of source text), each with the hub
//                                it would fold into. Ledger only: no redirects.
//   search_plan.json             strengthening candidates (guide pages with >= 2
//                                impressions at position <= 15) and whether each is
//                                already strengthened, plus the run's counts.
//
// A site whose analytics export is missing is a NAMED STOP line (its files are
// left as they were). Zero targets across all five sites fails the step.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SI = path.join(ROOT, 'data', 'search_intelligence');
const THIN_WORDS = 600;
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };
const write = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); };
export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (html) => String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));

const { sites } = read(path.join(SI, 'sites.json'));
const demand = read(path.join(SI, 'measured_demand.json'), { records: [] }).records || [];
const strengthened = new Set((read(path.join(SI, 'strengthened_pages.json'), { pages: [] }).pages || []).map((p) => `${p.host}${p.route}`));
let totalTargets = 0;

for (const site of sites) {
  const dir = path.join(SI, site.host);
  const gsc = read(path.join(dir, 'gsc_search_analytics_export.json'), null);
  if (!gsc) { console.log(`NAMED STOP: ${site.host} has no gsc_search_analytics_export.json yet; plan not rebuilt`); continue; }
  const window = `${gsc.start_date}..${gsc.end_date}`;
  const routeOf = (url) => { try { return new URL(url).pathname; } catch (_) { return url; } };

  // Targets.
  const ownerFor = new Map();
  for (const r of gsc.rows || []) {
    const cur = ownerFor.get(r.query);
    if (!cur || r.impressions > cur.impressions) ownerFor.set(r.query, r);
  }
  const targets = new Map();
  const dropped = [];
  for (const q of gsc.by_query || []) {
    if (!(q.impressions > 0)) { dropped.push({ query: q.query, source: 'gsc_export', reason: 'zero impressions in the window' }); continue; }
    const owner = ownerFor.get(q.query);
    targets.set(norm(q.query), {
      query: q.query, normalized_query: norm(q.query), source: 'gsc_export',
      impressions: q.impressions, clicks: q.clicks, average_position: q.position,
      measurement: { metric: 'impressions_28d', value: q.impressions, window },
      owner_route: owner ? routeOf(owner.page) : null
    });
  }
  for (const r of demand.filter((x) => x.target_domain === site.host)) {
    if (!(Number(r.volume) > 0)) { dropped.push({ query: r.query, source: 'measured_demand', reason: 'no measured volume' }); continue; }
    const key = norm(r.query);
    const m = { metric: 'search_volume_monthly', value: Number(r.volume), source_type: r.source_type };
    if (targets.has(key)) { targets.get(key).other_measurements = [m]; continue; }
    targets.set(key, { query: r.query, normalized_query: key, source: 'measured_demand', volume: Number(r.volume), measurement: m, owner_route: r.owner_route || null });
  }
  const list = [...targets.values()].sort((a, b) => b.measurement.value - a.measurement.value || a.query.localeCompare(b.query));
  totalTargets += list.length;
  const bySource = list.reduce((a, t) => ({ ...a, [t.source]: (a[t.source] || 0) + 1 }), {});
  write(path.join(dir, 'target_query_set.json'), {
    schema_version: '1.0', host: site.host, gsc_window: window, gsc_collected_at: gsc.collected_at,
    measurement_rule: 'Every target carries a source (gsc_export | measured_demand) and a positive measured number. Anything unmeasured is dropped with its reason.',
    target_count: list.length, targets_by_source: bySource, dropped_count: dropped.length, dropped, targets: list
  });

  // Pages, impressions, consolidation.
  const byPage = new Map((gsc.by_page || []).map((p) => [routeOf(p.page), p]));
  const coverage = read(path.join(dir, 'index_coverage.json'), { urls: [] });
  const covByRoute = new Map((coverage.urls || []).map((u) => [routeOf(u.url), u.coverageState || u.bucket]));
  const gdir = path.join(ROOT, site.global_pages_dir);
  const guides = fs.readdirSync(gdir).filter((f) => f.endsWith('.json')).map((f) => {
    const d = read(path.join(gdir, f), {});
    return { file: path.relative(ROOT, path.join(gdir, f)), route: d.route, title: d.title || '', words: words(d.main_html) };
  }).filter((g) => /^\/guides\/[^/]+\/$/.test(g.route || ''));
  const hubs = guides.filter((g) => (byPage.get(g.route) || {}).impressions > 0);
  const candidates = [];
  for (const g of guides) {
    if ((byPage.get(g.route) || {}).impressions > 0 || g.words >= THIN_WORDS) continue;
    const t = tokens(g.title + ' ' + g.route);
    let best = null; let score = 0;
    for (const h of hubs) {
      const s = [...tokens(h.title + ' ' + h.route)].filter((w) => t.has(w)).length;
      if (s > score) { best = h; score = s; }
    }
    candidates.push({ route: g.route, source: g.file, words: g.words, impressions_28d: 0, coverage_state: covByRoute.get(g.route) || 'not inspected yet',
      fold_into: best ? best.route : '/guides/', fold_basis: best ? `shares ${score} topic words with a guide that has impressions` : 'no topical guide with impressions; the guides hub' });
  }
  candidates.sort((a, b) => a.route.localeCompare(b.route));
  write(path.join(dir, 'consolidation_candidates.json'), {
    schema_version: '1.0', host: site.host, status: 'LEDGER_ONLY_NO_REDIRECTS', gsc_window: window,
    rule: `Guide page with 0 impressions in the window and fewer than ${THIN_WORDS} words of source text; fold_into is the guide with impressions sharing the most topic words, else /guides/.`,
    guide_count: guides.length, candidate_count: candidates.length, candidates
  });

  // Strengthening candidates.
  const strong = guides.map((g) => ({ ...g, m: byPage.get(g.route) })).filter((g) => g.m && g.m.impressions >= 2 && g.m.position <= 15)
    .map((g) => ({ route: g.route, source: g.file, impressions: g.m.impressions, clicks: g.m.clicks, position: g.m.position, strengthened: strengthened.has(`${site.host}${g.route}`) }));
  write(path.join(dir, 'search_plan.json'), {
    schema_version: '1.0', host: site.host, gsc_window: window, totals: gsc.totals,
    strengthening_rule: 'guide page with >= 2 impressions at average position <= 15',
    strengthening_candidates: strong,
    not_yet_strengthened: strong.filter((s) => !s.strengthened).map((s) => s.route),
    coverage: coverage.summary || null
  });
  console.log(`${site.host}: targets=${list.length} ${JSON.stringify(bySource)} consolidation=${candidates.length}/${guides.length} strengthen=${strong.length}`);
}
if (totalTargets === 0) { console.error('build_search_plan: 0 measured targets across all sites'); process.exit(1); }
