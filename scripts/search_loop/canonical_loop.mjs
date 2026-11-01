#!/usr/bin/env node
// The shared search loop (seq23/search-loop @v1) on the CANONICAL side of the Industry Guides.
//
// Owner ruling 1 Nov 2026 (spry brain, "Search growth loop on every selling site"): the
// velocity repo builds the daily new pages; this repo does NOT get the daily new-page build.
// It runs, for each of its six sites (search-loop.config.json):
//
//   MISSING-GUIDE  a topic the velocity repo lists in data/search-loop/missing-guides.json with
//                  no canonical guide here is written as a full guide (page-set JSON, rendered by
//                  the normal generator), sourced (every source URL must answer), gated, and
//                  published straight away. The only new pages this site gets.
//   CHECK+REPAIR   every loop guide at 2/4/8 weeks and 90 days (the engine's own checkpoint and
//                  decision code) from the Search Console truth rotating_refresh.yml commits
//                  daily; guides near page one are strengthened (search_strengthening at source,
//                  before/after hash, automatic undo when a re-strengthening makes it worse);
//                  every measured demand family the build requires to be served
//                  (demand_families_contract.js) and is not, is strengthened here instead of
//                  turning main red; the lead path (request page + /api/request-assistance) is
//                  probed live on every site, since leads land on this side.
//   REPORT         search-loop-week-v1 per site (the engine's buildReport/checkReport), uploaded
//                  as the Actions artifact `search-loop-week`.
//
// The engine is checked out at .search-loop-engine (SEARCH_LOOP_ENGINE_DIR); its modules are
// imported, not copied. Model calls go through this repo's $0 router (free_llm_router.mjs).
//
// Exit codes (engine's): 0 work done and visible; 1 problems; 2 NAMED STOP [NOTHING_DONE].
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = process.env.SEARCH_LOOP_ROOT ? path.resolve(process.env.SEARCH_LOOP_ROOT) : process.cwd();
const CONFIG_FILE = 'search-loop.config.json';

export function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; o[k] = v; } else o._.push(a);
  }
  return o;
}

export async function loadEngine(dir = process.env.SEARCH_LOOP_ENGINE_DIR || path.join(ROOT, '.search-loop-engine')) {
  const src = path.join(path.resolve(dir), 'src');
  if (!fs.existsSync(path.join(src, 'check.mjs'))) throw Object.assign(new Error(`NAMED STOP [ENGINE_MISSING] the search-loop engine is not checked out at ${dir} (the workflow checks out seq23/search-loop@v1 there; locally set SEARCH_LOOP_ENGINE_DIR)`), { code: 1 });
  const m = async (n) => import(pathToFileURL(path.join(src, n)).href);
  const [config, check, report, pace, util, mode, build, gate, ledger, llm] = await Promise.all(['config.mjs', 'check.mjs', 'report.mjs', 'pace.mjs', 'util.mjs', 'mode.mjs', 'build.mjs', 'gate.mjs', 'ledger.mjs', 'llm.mjs'].map(m));
  return { config, check, report, pace, util, mode, build, gate, ledger, llm };
}

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const writeJson = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };

// One engine-valid config per site: the shared keys + the site entry. Problems are the engine's.
export function siteConfigs(E, raw, root = ROOT) {
  const shared = { ...raw };
  delete shared.sites; delete shared._what; delete shared.engine_ref; delete shared.new_pages; delete shared.missing_guides; delete shared.ledger_root;
  const out = []; const problems = [];
  if (raw.schema !== 'search-loop-canonical-v1') problems.push('schema must be "search-loop-canonical-v1"');
  if (raw.new_pages !== 'missing_guides_only') problems.push('new_pages must be "missing_guides_only" (owner ruling 1 Nov 2026: the canonical side gets no daily new-page build)');
  for (const s of raw.sites || []) {
    const c = { ...shared, ...s, schema: E.config.CONFIG_SCHEMA };
    for (const p of E.config.checkConfig(c)) problems.push(`${s.site}: ${p}`);
    const cfg = { ...E.config.DEFAULTS, ...c, pace: { ...E.config.DEFAULTS.pace, ...(raw.pace || {}) }, root, ledger_dir: path.join(raw.ledger_root || 'data/search-loop', s.site) };
    out.push(cfg);
  }
  if (!out.length) problems.push('sites: at least one site');
  return { sites: out, problems };
}

// ---------------------------------------------------------------- shared helpers
export const norm = (q) => String(q || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const words = (s) => String(s || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

const ALIASES = () => readJson(path.join(ROOT, 'data/contracts/velocity_vertical_aliases.json'), { aliases: {}, canonical: {} });

export function guidesIn(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).filter((f) => f.endsWith('.json')).map((f) => {
    const j = readJson(path.join(abs, f), null);
    return j && /^\/guides\/.+/.test(String(j.route || '')) ? { file: path.join(dir, f), route: j.route, title: j.title || '', text: String(j.main_html || '').replace(/<[^>]+>/g, ' ') } : null;
  }).filter(Boolean);
}

// The velocity list, tolerant of shape. Unreadable is a note (the next run retries), never red.
export function parseMissingList(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.items || payload?.missing || payload?.guides || payload?.topics || []);
  return (Array.isArray(list) ? list : []).map((x) => (typeof x === 'string' ? { query: x } : x)).map((x) => ({
    query: String(x.query || x.topic || x.title || '').trim(),
    vertical: x.vertical || x.canonical_vertical || null,
    site: x.site || x.host || x.canonical_host || null,
    velocity_url: x.velocity_url || x.url || null,
    evidence: x.evidence || x.reason || null,
  })).filter((x) => x.query.length > 3);
}

export function siteFor(item, sites) {
  const host = String(item.site || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (host) { const s = sites.find((c) => c.site === host); if (s) return s; }
  const v = ALIASES().aliases[String(item.vertical || '').trim()] || item.vertical;
  return sites.find((c) => c.vertical === v) || null;
}

// Already served by a canonical guide? Same slug, or at least 3 in 4 of the QUERY's content words
// (crude plural stem) in a guide's title or route: "what to do after an accident" does not cover
// "how to correct a police report after a car accident".
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(?<!s)s$/, '');
export function coveredBy(E, query, guides) {
  const slug = slugify(query);
  const q = new Set(E.util.contentWords(query).map(stem));
  const covers = (t) => { const T = new Set(E.util.contentWords(t).map(stem)); let n = 0; for (const w of q) if (T.has(w)) n++; return n >= 2 && n / q.size >= 0.75; };
  return guides.find((g) => g.route === `/guides/${slug}/` || covers(g.title) || covers(g.route.replace(/[/-]+/g, ' '))) || null;
}

// ---------------------------------------------------------------- the gate for a new guide
const STAT = /(\b\d+(\.\d+)?\s?(%|percent\b)|\b\d+\s+(out of|in)\s+\d+\b|\b(studies|research|surveys?|data) (show|shows|find|finds|found|suggests?)\b)/i;
const REVIEW = /(testimonial|\breviews? (from|by)\b|\brated \d|\b\d(\.\d)?\s?stars?\b|\b(customers|clients|users|patients) (say|love|rave)\b|\bfive-star\b)/i;
const PERSONA = /(\bDr\.\s?[A-Z]|\baward[- ]winning\b|\bour (team of )?experts\b|\b\d+\+? years of experience\b|\bas seen (on|in)\b|[Aa]ccording to [A-Z][a-z]+ [A-Z][a-z]+)/;
const FILLER = /(lorem ipsum|as an ai\b|\[insert|\{\{|todo:|in today's fast-paced world|delve into|this (page|guide) should\b|a strong page should)/i;
// Source hosts a guide may cite: public authorities and non-profit/academic references.
const SOURCE_HOST = /(\.gov|\.edu|\.org|\.int|\.us)$/i;

export function gateGuide(E, g, { site, existing }) {
  const p = [];
  const range = (v, [lo, hi], what) => { if (!(v >= lo && v <= hi)) p.push(`${what} is ${v} (${lo}-${hi})`); };
  range(fullTitle(site, g.meta_title).length, [30, 65], 'title length with the site name');
  range((g.meta_description || '').length, [120, 160], 'meta_description length');
  range(words(g.answer), [40, 60], 'quick answer words');
  range((g.faq || []).length, [3, 6], 'FAQ count');
  for (const f of g.faq || []) range(words(f.a), [30, 70], `FAQ answer "${String(f.q).slice(0, 40)}" words`);
  if ((g.sections || []).length < 6) p.push(`only ${(g.sections || []).length} sections (6+)`);
  const verified = (g.sources || []).filter((s) => s.verified);
  if (verified.length < site.min_verified_sources) p.push(`${verified.length} verified sources (${site.min_verified_sources}+ answering 200); replace these, which did not answer: ${(g.sources || []).filter((x) => !x.verified).map((x) => x.url).join(', ') || 'none given'}`);
  const html = g.main_html || '';
  const text = html.replace(/<[^>]+>/g, ' ') + ' ' + (g.faq || []).map((f) => `${f.q} ${f.a}`).join(' ');
  if (words(text) < site.min_words) p.push(`${words(text)} words (${site.min_words}+)`);
  for (const [re, what] of [[STAT, 'an unsourced statistic'], [REVIEW, 'a review or rating'], [PERSONA, 'an invented person or credential'], [FILLER, 'filler or instruction text']]) { const m = text.match(re); if (m) p.push(`${what}: "${m[0]}"`); }
  if (site.risk === 'pi') {
    const pi = require(path.join(ROOT, 'scripts/validation/pi_trust_tone_contract.js'));
    const m = text.match(pi.LAWYER_SUPERLATIVE_RE); if (m) p.push(`superlative wording about lawyers: "${m[0]}"`);
    for (const b of pi.BANNED_PHRASES) if (text.toLowerCase().includes(b)) p.push(`banned PI phrase "${b}"`);
    if (/referral service/i.test(text.replace(/not a (lawyer )?referral service/gi, ''))) p.push('calls itself a referral service');
  }
  if (site.health_gate && site.health_gate !== 'none') for (const [k, re] of Object.entries(E.gate.HEALTH)) { if (k === 'offer' || k === 'hours') continue; const m = text.match(re); if (m) p.push(`health gate (${k}): "${m[0]}"`); }
  const shape = shapeFor(site);
  if (shape.pack) for (const x of shape.depth.checkGuide(shape.pack, { route: '/guides/new/', title: g.title, main_html: html }, 'draft').issues) p.push(x.replace(/^[a-z_]+: draft /, ''));
  const sh = E.util.shingles(text);
  for (const x of existing) { const j = E.util.jaccard(sh, E.util.shingles(x.text)); if (j >= 0.35) { p.push(`near-duplicate of ${x.route} (${j.toFixed(2)})`); break; } }
  return p;
}

// The canonical guide shape of a site's vertical (section ids), from the one list the build's
// depth contract also reads (scripts/validation/vertical_guide_depth_contract.js).
export function shapeFor(site) {
  const depth = require(path.join(ROOT, 'scripts/validation/vertical_guide_depth_contract.js'));
  const pack = ALIASES().canonical[site.vertical]?.pack_key || null;
  const ids = depth.SECTION_IDS[pack] || ['definition', 'next-steps'];
  const quick = ids.includes('quick-answer') ? 'quick-answer' : 'definition';
  return { pack, ids, quick, body: ids.filter((x) => x !== quick && x !== 'next-steps'), depth };
}
const brandSuffix = (site) => ` | ${site.site_name}`;
export const fullTitle = (site, metaTitle) => { let t = String(metaTitle || '').trim(); for (const sep of [' | ', ' - ', ' – ']) if (t.toLowerCase().endsWith((sep + site.site_name).toLowerCase())) t = t.slice(0, -(sep + site.site_name).length).trim(); return t + brandSuffix(site); };

const DISCLAIMER = { pi: 'Educational only. Not legal advice. No endorsements or rankings.', health: 'Educational only. Not medical advice. No endorsements, rankings or guarantees.' };

export function renderGuide(site, d) {
  const disclaimer = site.risk === 'pi' ? require(path.join(ROOT, 'scripts/validation/pi_trust_tone_contract.js')).REQUIRED_DISCLAIMER : DISCLAIMER.health;
  const shape = shapeFor(site);
  const out = [`<h2>${esc(d.title)}</h2>`, `<p>${esc(disclaimer)}</p>`, `<h2 id="${shape.quick}">Quick answer</h2>`, `<p>${esc(d.context || '')}</p>`];
  const used = new Set();
  for (const s of d.sections) {
    const id = shape.body.includes(s.id) && !used.has(s.id) ? s.id : `s-${slugify(s.heading).slice(0, 40)}`;
    used.add(id);
    out.push(`<h2 id="${id}">${esc(s.heading)}</h2>`);
    for (const para of s.paragraphs || []) out.push(`<p>${esc(para)}</p>`);
  }
  if ((d.checklist || []).length) out.push('<h2 id="checklist">Checklist before you decide</h2>', `<ol>${d.checklist.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`);
  const src = (d.sources || []).filter((s) => s.verified);
  out.push('<h2 id="sources">Sources</h2>', `<ul>${src.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title || new URL(s.url).hostname)}</a>${s.supports ? ` — ${esc(s.supports)}` : ''}</li>`).join('')}</ul>`);
  out.push('<h2 id="next-steps">What to do next</h2>', `<p>${esc(d.next_step || '')}</p>`);
  return out.join('\n');
}

export function draftPrompt(site, item, problems = []) {
  return [
    { role: 'system', content: `You write one educational guide for ${site.site_name} (${site.base_url}). Audience: ${site.audience}. Voice: ${site.voice}. Return ONLY JSON.` },
    { role: 'user', content: [
      `Write a complete guide answering: "${item.query}".`,
      'Return {"title":"","meta_title":"' + (30 - brandSuffix(site).length) + '-' + (65 - brandSuffix(site).length) + ' chars, the search first, WITHOUT the site name (it is added)","meta_description":"120-160 chars","answer":"40-60 word direct answer starting with the subject","context":"1-2 sentences","sections":[{"id":"one of the required ids, or empty","heading":"a question a reader asks","paragraphs":["90-160 words","90-160 words"]}],"checklist":["5-7 short steps"],"faq":[{"q":"","a":"40-60 words"}],"next_step":"1-2 sentences","sources":[{"url":"https://...","title":"","supports":"what this source backs"}]}',
      `Required sections, in this order, each once, with these exact ids: ${shapeFor(site).body.join(', ')}; then 2-3 more sections with an empty id.`,
      'Rules: 7-9 sections; 4-5 FAQ; 1300+ words in total. 3-5 sources, each a real page on a government (.gov), court, bar association, university (.edu) or established non-profit (.org) site that you are confident exists. No statistics or percentages, no named people, quotes, reviews, ratings, credentials or prices you cannot source. No promises of outcomes.',
      site.risk === 'pi' ? 'Personal injury rules: never use the words best, top, expert or leading about lawyers or firms; never recommend or endorse any lawyer; never call the site a referral service; fees are explained in general terms only.' : '',
      site.health_gate !== 'none' ? 'Health rules: no outcome or cure claims, never "painless" or "risk-free", no dosing or medical advice, no hours or services of any provider.' : '',
      problems.length ? `The previous draft failed these checks; fix every one: ${problems.join('; ')}` : '',
    ].filter(Boolean).join('\n') },
  ];
}

async function chat(messages, { maxTokens = 6000 } = {}) {
  const router = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/free_llm_router.mjs')).href);
  const cfg = router.loadRouting(ROOT);
  const r = await router.chatFree(cfg, { messages, max_tokens: maxTokens, temperature: 0.4, timeoutMs: 180000, totalBudgetMs: 540000 });
  if (r.ok) return { ok: true, text: r.content, model: r.model };
  const tried = (r.attempts || []).map((a) => `${String(a.model || '').split('/').pop()}:${a.status ?? ''}${a.error ? ' ' + String(a.error).slice(0, 80) : ''}`).join('; ');
  return { ok: false, reason: `${r.stop || r.error || 'no free model answered'}${tried ? ` (${tried})` : ''}`, refused: /key/i.test(String(r.stop || '')) && !/no free model/i.test(String(r.stop || '')) };
}

// The guides hub lists every guide (no new guide is an orphan): one card appended, nothing else
// in the hub touched.
function addHubCard(site, page) {
  const f = path.join(ROOT, site.output.dir, 'guides.json');
  const hub = readJson(f, null);
  if (!hub || !Array.isArray(hub.guide_cards)) return;
  if (hub.guide_cards.some((c) => c.route === page.route)) return;
  hub.guide_cards.push({ route: page.route, title: page.title, description: page.description });
  writeJson(f, hub);
}

// ---------------------------------------------------------------- MISSING-GUIDE
export async function missingGuides(E, sites, raw, { mode, notes, publish, fetchImpl = fetch, chatImpl = chat, now = new Date() }) {
  const res = { listed: 0, covered: 0, built: 0, dropped: 0, held: 0, written: [] };
  const rules = E.mode.rulesFor(mode);
  if (!rules.build) { notes.push(`MISSING-GUIDE: no new guide in mode=${mode}`); return res; }
  const mg = raw.missing_guides;
  let payload = null;
  if (process.env.MISSING_GUIDES_FILE) payload = readJson(process.env.MISSING_GUIDES_FILE, null);
  else {
    const r = await E.util.fetchText(mg.source_url, { fetchImpl, timeoutMs: 20000 });
    if (r.status === 200) { try { payload = JSON.parse(r.text); } catch { notes.push(`NAMED NOTE [MISSING_LIST_UNREADABLE] ${mg.source_url} is not JSON`); } }
    else notes.push(`not read: velocity missing-guide list (${mg.source_url} answered ${r.status || r.error}); the velocity repo has not published data/search-loop/missing-guides.json yet — the next run reads it`);
  }
  const items = parseMissingList(payload);
  res.listed = items.length;
  if (payload && !items.length) notes.push('MISSING-GUIDE: the velocity list is empty — every listed topic has a canonical guide');
  const policy = readJson(path.join(ROOT, 'data/cadence/policy.json'), {});
  const weekly = Number(policy.new_pages_per_week) || 0;
  const today = E.util.centralDate(now);
  let modelDown = false;
  for (const site of sites) {
    if (modelDown) break;
    const L = E.ledger.ledger(site);
    const book = L.pages();
    const mine = items.filter((i) => siteFor(i, sites) === site);
    if (!mine.length) continue;
    const stateFile = path.join(L.dir, 'missing-guides.json');
    const state = readJson(stateFile, { schema: 'search-loop-missing-guides-v1', covered: [], dropped: [] });
    const existing = guidesIn(site.output.dir);
    const builtThisWeek = (book.pages || []).filter((p) => p.source === 'missing-guide' && E.util.daysBetween(p.published_at, today) < 7).length;
    const pace = E.pace.currentPace(site, L).per_day;
    const quota = Math.max(0, Math.min(rules.build_cap ?? pace, pace, weekly - builtThisWeek));
    let used = 0;
    for (const item of mine) {
      const key = norm(item.query);
      if ((book.pages || []).some((p) => norm(p.query) === key)) continue;
      if (state.dropped.some((d) => d.key === key && E.util.daysBetween(d.at, today) < mg.retry_after_days)) continue;
      const cov = coveredBy(E, item.query, existing);
      if (cov) { res.covered++; if (!state.covered.some((c) => c.key === key)) state.covered.push({ key, query: item.query, by: cov.route, at: today }); continue; }
      if (used >= quota) { res.held++; continue; }
      used++;
      let draft = null; let problems = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await chatImpl(draftPrompt({ ...site, min_words: mg.min_words }, item, problems), { maxTokens: 5000 });
        // A model outage is not the topic's fault: the topic is deferred to the next run, not dropped.
        if (!r.ok) { notes.push(`NAMED NOTE [FREE_MODEL_UNAVAILABLE] MISSING-GUIDE ${site.site} "${item.query}" deferred to the next run: ${r.reason}`); if (r.refused) notes.push('NAMED STOP [FREE_MODEL_KEY_REFUSED] OpenRouter refused the key; no guide can be written'); modelDown = true; break; }
        const d = E.llm.parseJsonAnswer(r.text);
        if (!d) { problems = ['the answer was not valid JSON']; continue; }
        d.sources = (d.sources || []).filter((s) => { try { const u = new URL(s.url); return u.protocol === 'https:' && SOURCE_HOST.test(u.hostname); } catch { return false; } }).slice(0, 6).map((s) => ({ ...s, claim: s.supports, source_url: s.url }));
        await E.build.verifyFacts(d.sources, fetchImpl);
        for (const s of d.sources) s.verified = Boolean(s.verified);
        d.main_html = renderGuide(site, d);
        problems = gateGuide(E, d, { site: { ...site, min_words: mg.min_words, min_verified_sources: mg.min_verified_sources }, existing });
        if (!problems.length) { draft = d; break; }
      }
      if (modelDown) { res.deferred = (res.deferred || 0) + 1; break; }
      if (!draft) {
        res.dropped++;
        state.dropped.push({ key, query: item.query, at: today, problems: problems.slice(0, 4) });
        notes.push(`MISSING-GUIDE ${site.site} "${item.query}" dropped (retried after ${mg.retry_after_days} days): ${problems.slice(0, 3).join('; ') || 'no draft'}`);
        continue;
      }
      const prefix = ALIASES().canonical[site.vertical]?.guide_file_prefix ?? 'guides_';
      const slug = slugify(item.query);
      const rel = path.join(site.output.dir, `${prefix}${slug}.json`);
      const page = {
        route: `/guides/${slug}/`,
        title: String(draft.title || item.query).trim(),
        description: draft.meta_description,
        meta_title: fullTitle(site, draft.meta_title).slice(0, -brandSuffix(site).length),
        meta_description: draft.meta_description,
        main_html: draft.main_html,
        search_strengthening: { query: item.query, definition: draft.answer, faq: draft.faq.map((f) => ({ q: f.q, a: f.a })) },
      };
      writeJson(path.join(ROOT, rel), page);
      addHubCard(site, page);
      res.written.push(rel);
      book.pages = [...(book.pages || []), {
        slug, query: item.query, route: page.route, url: `${site.base_url}${page.route}`, rel, source: 'missing-guide',
        velocity_url: item.velocity_url, status: 'live', published_at: today, checks: {},
        sources: draft.sources.filter((s) => s.verified).map((s) => s.url), model_route: 'free_llm_router ($0)',
      }];
      res.built++;
    }
    if (res.held) notes.push(`MISSING-GUIDE ${site.site}: ${res.held} listed guide(s) wait for next week's cadence allowance (${weekly}/week, ${builtThisWeek} used)`);
    L.write('pages', book); writeJson(stateFile, state);
  }
  return res;
}

// ---------------------------------------------------------------- CHECK + REPAIR
function gscFor(host, today, E) {
  const ex = readJson(path.join(ROOT, 'data/search_intelligence', host, 'gsc_search_analytics_export.json'), null);
  if (!ex) return { notRead: 'no Search Console export for this site yet (rotating_refresh.yml writes it)' };
  const age = E.util.daysBetween(String(ex.collected_at || '').slice(0, 10), today);
  if (!(age <= 4)) return { notRead: `the Search Console export is ${Number.isFinite(age) ? age + ' days' : 'of unknown age'} old (collected ${ex.collected_at})` };
  const map = new Map((ex.by_page || []).map((r) => [r.page, r]));
  const queriesFor = (url) => (ex.rows || []).filter((r) => r.page === url).sort((a, b) => b.impressions - a.impressions).map((r) => r.query);
  const cov = readJson(path.join(ROOT, 'data/search_intelligence', host, 'index_coverage.json'), { urls: [] });
  const idx = new Map((cov.urls || []).map((u) => [u.url, u]));
  return { map, queriesFor, idx };
}

export function strengthenPrompt(site, page, queries) {
  return [
    { role: 'system', content: `You improve one guide for ${site.site_name}. Audience: ${site.audience}. Voice: ${site.voice}. Return ONLY JSON.` },
    { role: 'user', content: `The guide "${page.title}" (${page.route}) is shown for these searches: ${queries.slice(0, 12).join(' | ')}.\nReturn {"query":"the main search, as searched","definition":"40-60 words: a direct answer to the main search, starting with its subject","faq":[{"q":"a real question from the searches","a":"40-60 words"}]} with 3 FAQ. No statistics, named people, reviews, ratings, credentials, prices or outcome promises.${site.risk === 'pi' ? ' Never use best, top, expert or leading about lawyers; never recommend or endorse any lawyer.' : ''}` },
  ];
}

export function gateStrengthening(E, site, page, s) {
  const p = [];
  if (!(words(s.definition) >= 40 && words(s.definition) <= 60)) p.push(`definition ${words(s.definition)} words (40-60)`);
  if (!(Array.isArray(s.faq) && s.faq.length >= 2)) p.push('fewer than 2 FAQ');
  const sig = (t) => new Set(norm(t).split(' ').filter((w) => w.length > 3));
  const q = sig(s.query); if ([...sig(page.title)].filter((w) => q.has(w)).length < 2) p.push(`title "${page.title}" is not aligned to "${s.query}"`);
  const text = `${s.definition} ${(s.faq || []).map((f) => `${f.q} ${f.a}`).join(' ')}`;
  for (const [re, what] of [[STAT, 'statistic'], [REVIEW, 'review'], [PERSONA, 'person/credential'], [FILLER, 'filler']]) if (re.test(text)) p.push(what);
  if (site.risk === 'pi' && require(path.join(ROOT, 'scripts/validation/pi_trust_tone_contract.js')).LAWYER_SUPERLATIVE_RE.test(text)) p.push('superlative about lawyers');
  if (site.health_gate !== 'none' && (E.gate.HEALTH.outcome.test(text) || E.gate.HEALTH.advice.test(text))) p.push('health gate');
  return p;
}

async function strengthenSource(E, site, L, rel, queries, { chatImpl, notes }) {
  const file = path.join(ROOT, rel);
  const page = readJson(file, null);
  if (!page) return null;
  const r = await chatImpl(strengthenPrompt(site, page, queries), { maxTokens: 1500 });
  if (!r.ok) { notes.push(`strengthen ${page.route} skipped: ${r.reason}`); return null; }
  const s = E.llm.parseJsonAnswer(r.text) || {};
  s.query = s.query || queries[0]; s.faq = (s.faq || []).filter((f) => f?.q && f?.a).slice(0, 4);
  const problems = gateStrengthening(E, site, page, s);
  if (problems.length) { notes.push(`strengthen ${page.route} failed the gate, left as it was: ${problems.slice(0, 3).join('; ')}`); return null; }
  const before = fs.readFileSync(file, 'utf8');
  const bh = E.util.sha256(before);
  const snap = path.join(L.dir, 'snapshots', `${bh}.json`);
  fs.mkdirSync(path.dirname(snap), { recursive: true });
  fs.writeFileSync(snap, before);
  page.search_strengthening = { query: s.query, definition: s.definition, faq: s.faq };
  writeJson(file, page);
  return { before_hash: bh, after_hash: E.util.sha256(fs.readFileSync(file, 'utf8')), had_strengthening: /"search_strengthening"/.test(before), query: s.query };
}

function registerStrengthened(site, route, rel, m) {
  const f = path.join(ROOT, 'data/search_intelligence/strengthened_pages.json');
  const reg = readJson(f, null);
  if (!reg) return;
  reg.pages = (reg.pages || []).filter((p) => !(p.host === site.site && p.route === route));
  reg.pages.push({ host: site.site, route, source: rel, impressions: m?.impressions ?? 0, clicks: m?.clicks ?? 0, position: m?.position ?? null, query_shown: null });
  writeJson(f, reg);
}

export async function checkRepair(E, sites, { mode, notes, chatImpl = chat, fetchImpl = fetch, now = new Date() }) {
  const today = E.util.centralDate(now);
  const rules = E.mode.rulesFor(mode);
  const res = { checked: 0, wins: 0, strengthened: 0, undone: 0, merged: 0, families_served: 0, lead_paths_ok: 0, lead_paths: 0, per_site: {} };
  for (const site of sites) {
    const L = E.ledger.ledger(site);
    const book = L.pages(); book.pages ||= [];
    const g = gscFor(site.site, today, E);
    const per = { checked: 0, strengthened: 0, undone: 0, families_served: 0 };
    if (g.notRead) notes.push(`${site.site}: not read: Search Console (${g.notRead})`);
    // Index status for the pace, from the URL Inspection rotation rotating_refresh.yml runs.
    for (const p of book.pages.filter((x) => x.status === 'live')) {
      const u = g.idx?.get(p.url);
      if (u) { p.inspected_at = String(u.inspected_at || '').slice(0, 10) || today; p.indexed = u.verdict === 'PASS'; if (p.indexed && !p.indexed_at) p.indexed_at = p.inspected_at; }
    }
    const window = book.pages.filter((p) => p.status === 'live' && E.util.daysBetween(p.published_at, today) >= site.pace.index_window_days && E.util.daysBetween(p.published_at, today) <= 42);
    const sample = window.length && window.every((p) => p.inspected_at) ? { measured: window.length, indexed: window.filter((p) => p.indexed).length, source: 'Search Console URL Inspection (rotating_refresh.yml)' } : { measured: window.length, indexed: null, reason: window.length ? 'not every page 14-42 days old has been inspected yet' : 'no loop guide is 14-42 days old yet' };
    const pace = E.pace.nextPace(site, E.pace.currentPace(site, L), sample, now);
    if (pace.reason !== 'already evaluated this week') { L.write('pace', pace.pace); notes.push(`${site.site} pace: ${pace.reason}`); }

    // Checkpoints and decisions: the engine's code.
    for (const p of book.pages.filter((x) => x.status === 'live')) {
      const due = E.check.dueCheckpoints(p, today);
      const settle = p.strengthen && !p.strengthen.verdict && E.util.daysBetween(p.strengthen.at, today) >= E.check.STRENGTHEN_SETTLE_DAYS;
      if (!due.length && !settle) continue;
      const m = g.map?.get(p.url);
      const snap = g.notRead ? { source: 'not read', note: g.notRead } : { source: 'search_console', clicks: m?.clicks || 0, impressions: m?.impressions || 0, position: m?.position ?? null, indexed: p.indexed ?? null };
      for (const k of due.length ? due : ['settle']) {
        snap.checkpoint = k; per.checked++; res.checked++;
        if (k !== 'settle') p.checks[k] = { at: today, ...snap };
        if (snap.source !== 'search_console') continue;
        for (const act of E.check.decide(p, snap, { rules, today })) {
          if (act === 'winner' && !p.winner) { p.winner = today; res.wins++; }
          if (act === 'keep') p.strengthen.verdict = { at: today, kept: true, position: snap.position };
          if (act === 'undo') {
            // Undo restores the guide as it was. A first strengthening of a family the build
            // requires served is held instead (demand_families_contract.js), and logged.
            const snapFile = path.join(L.dir, 'snapshots', `${p.strengthen.before_hash}.json`);
            if (p.strengthen.had_strengthening && fs.existsSync(snapFile)) { fs.writeFileSync(path.join(ROOT, p.rel), fs.readFileSync(snapFile)); p.strengthen.verdict = { at: today, undone: true, position: snap.position }; per.undone++; res.undone++; }
            else { p.strengthen.verdict = { at: today, held: true, position: snap.position, reason: 'first strengthening; the measured family must stay served' }; notes.push(`${site.site} ${p.route}: worse after strengthening (${snap.position} vs ${p.strengthen.baseline_position}); held — first strengthening, family must stay served`); }
          }
          if (act === 'strengthen' && rules.strengthen) {
            const s = await strengthenSource(E, site, L, p.rel, g.queriesFor(p.url).length ? g.queriesFor(p.url) : [p.query], { chatImpl, notes });
            if (s) { p.strengthen = { at: today, ...s, baseline_position: snap.position }; registerStrengthened(site, p.route, p.rel, m); per.strengthened++; res.strengthened++; }
          }
          if (act === 'merge') notes.push(`${site.site} ${p.route}: 90 days with no impressions — recorded as a merge candidate; the canonical side never removes a guide automatically (data/search_intelligence/<host>/consolidation_candidates.json is the ledger)`);
        }
      }
    }

    // Families the build requires served (top / qualifying, demand_families_contract.js).
    const fam = readJson(path.join(ROOT, 'data/search_intelligence', site.site, 'demand_families.json'), { families: [] });
    for (const f of (fam.families || []).filter((x) => x.status === 'not_strengthened' && x.page_kind === 'guide')) {
      const rel = guidesIn(site.output.dir).find((x) => x.route === f.page)?.file;
      if (!rel) continue;
      const j = readJson(path.join(ROOT, rel), {});
      const m = g.map?.get(`${site.base_url}${f.page}`);
      if (j.search_strengthening) { registerStrengthened(site, f.page, rel, m); per.families_served++; res.families_served++; continue; }
      if (!rules.strengthen) { notes.push(`${site.site} family "${f.family}" needs strengthening; mode=${mode} makes no rewrites`); continue; }
      const s = await strengthenSource(E, site, L, rel, (f.queries || []).map((q) => q.query), { chatImpl, notes });
      if (!s) continue;
      registerStrengthened(site, f.page, rel, m);
      book.pages = book.pages.filter((p) => p.route !== f.page);
      book.pages.push({ slug: f.page.split('/')[2], query: s.query, route: f.page, url: `${site.base_url}${f.page}`, rel, source: 'existing-guide', status: 'live', published_at: null, checks: {}, strengthen: { at: today, ...s, baseline_position: m?.position ?? f.best_position ?? null } });
      per.families_served++; res.families_served++; res.strengthened++; per.strengthened++;
    }
    // Existing guides (not in a family) near page one: strengthen once.
    if (!g.notRead && rules.strengthen) {
      for (const x of guidesIn(site.output.dir)) {
        const m = g.map.get(`${site.base_url}${x.route}`);
        if (!m || m.position < E.check.NEAR_PAGE_ONE[0] || m.position > E.check.NEAR_PAGE_ONE[1] || m.impressions < 2) continue;
        if (book.pages.some((p) => p.route === x.route) || /"search_strengthening"/.test(fs.readFileSync(path.join(ROOT, x.file), 'utf8'))) continue;
        const s = await strengthenSource(E, site, L, x.file, g.queriesFor(m.page), { chatImpl, notes });
        if (!s) continue;
        registerStrengthened(site, x.route, x.file, m);
        book.pages.push({ slug: x.route.split('/')[2], query: s.query, route: x.route, url: m.page, rel: x.file, source: 'existing-guide', status: 'live', published_at: null, checks: {}, strengthen: { at: today, ...s, baseline_position: m.position } });
        per.strengthened++; res.strengthened++;
      }
    }

    // Lead path: the request page and the lead endpoint answer on every site. The probe sends an
    // empty payload, which the function rejects with 400 before storing or sending anything.
    res.lead_paths++;
    const page = await E.util.fetchText(site.lead.page_url || site.action.url, { fetchImpl, timeoutMs: 15000 });
    const api = await E.util.fetchText(`${site.base_url}${site.lead.api}`, { fetchImpl, method: 'POST', body: '{}', headers: { 'content-type': 'application/json' }, timeoutMs: 15000 });
    const formOk = page.status === 200 && (page.text || '').includes(site.lead.form_marker);
    if (formOk && api.status === 400) { res.lead_paths_ok++; per.lead_path = 'ok'; }
    else { per.lead_path = `request page ${page.status}${formOk ? '' : ' (no form)'}, api ${api.status}`; notes.push(`NAMED NOTE [LEAD_PATH_DOWN] ${site.site}: ${per.lead_path} — leads land on this site; fix the deploy or the function`); }
    per.notes_from = site.site;
    res.per_site[site.site] = per;
    L.write('pages', book);
  }
  return res;
}

// ---------------------------------------------------------------- REPORT
function ctaClicks(host, today, E) {
  const f = readJson(path.join(ROOT, 'data/search_intelligence', host, 'cta_clicks.json'), null);
  if (!f) return 'not read: no CTA click readback for this site yet (collect_cta_clicks.mjs)';
  const rows = Array.isArray(f.ctas) ? f.ctas : [];
  const n = rows.reduce((t, r) => t + (Number(r.clicks_7d ?? r.last_7_days ?? 0) || 0), 0);
  return rows.length && rows.some((r) => 'clicks_7d' in r || 'last_7_days' in r) ? n : `not read: the CTA readback has no 7-day count (${f.source || 'cta clicks'})`;
}

export function reports(E, sites, { mode, notes, did, now = new Date(), out }) {
  const files = [];
  for (const site of sites) {
    const L = E.ledger.ledger(site);
    const pace = E.pace.currentPace(site, L).per_day;
    const rules = E.mode.rulesFor(mode);
    const effective = !rules.build ? 0 : Math.min(pace, rules.build_cap ?? pace, Number(readJson(path.join(ROOT, 'data/cadence/policy.json'), {}).new_pages_per_week) || pace);
    const siteNotes = notes.filter((n) => !/^[a-z0-9.-]+\.(com|net|org)[: ]/.test(n) || n.startsWith(site.site)).filter((n) => !/^MISSING-GUIDE [a-z]/.test(n) || n.includes(site.site));
    const r = E.report.buildReport(site, { mode, effectivePace: effective, notes: [`canonical side: new pages = missing guides only (velocity builds the daily pages); pace = min(engine pace, cadence ${effective}/week)`, ...siteNotes], now, check: {} });
    const c = ctaClicks(site.site, E.util.centralDate(now), E); r.conversions = c;
    r.lead_path = did.check?.per_site?.[site.site]?.lead_path || 'not read: check did not run';
    const problems = E.report.checkReport(r);
    if (problems.length) throw Object.assign(new Error(`NAMED STOP [REPORT_SHAPE] ${site.site}: ${problems.join('; ')}`), { code: 1 });
    const f = path.join(out, `${site.site}.search-loop-week.json`);
    writeJson(f, r); writeJson(path.join(L.dir, 'search-loop-week.json'), r);
    files.push(f);
  }
  return files;
}

// ---------------------------------------------------------------- REVERT
// The repo's own build and validators are the last gate. When they refuse this run's guides,
// the workflow restores data/page_sets and the strengthened registry from git and calls this:
// each written guide is recorded as dropped (retried after retry_after_days), never published.
export function revertWritten(E, sites, raw, files, reason, now = new Date()) {
  const today = E.util.centralDate(now);
  let n = 0;
  for (const site of sites) {
    const L = E.ledger.ledger(site);
    const book = L.pages();
    const stateFile = path.join(L.dir, 'missing-guides.json');
    const state = readJson(stateFile, { schema: 'search-loop-missing-guides-v1', covered: [], dropped: [] });
    const gone = (book.pages || []).filter((p) => files.includes(p.rel) && p.published_at === today);
    if (!gone.length) continue;
    book.pages = book.pages.filter((p) => !gone.includes(p));
    for (const p of gone) { state.dropped.push({ key: norm(p.query), query: p.query, at: today, problems: [reason] }); n++; }
    L.write('pages', book); writeJson(stateFile, state);
  }
  return n;
}

// ---------------------------------------------------------------- main
export async function run(opts = {}) {
  const E = opts.engine || await loadEngine();
  const raw = readJson(path.join(ROOT, opts.config || CONFIG_FILE), null);
  if (!raw) throw Object.assign(new Error(`NAMED STOP [CONFIG_INVALID] ${CONFIG_FILE} is missing or not JSON`), { code: 1 });
  const { sites, problems } = siteConfigs(E, raw);
  if (problems.length) throw Object.assign(new Error(`NAMED STOP [CONFIG_INVALID] ${problems.join('; ')}`), { code: 1 });
  const now = opts.now || new Date();
  if (opts.stage === 'revert') {
    const files = String(opts.files || '').split(/\s+/).filter(Boolean);
    const n = revertWritten(E, sites, raw, files, String(opts.reason || 'the repo build or validators refused it'), now);
    return { census: `search-loop canonical: reverted ${n} guide(s) the repo gate refused`, notes: [], did: {}, files: [], nothing: false, written: [] };
  }
  const notes = [];
  const m = await E.mode.resolveMode({ globalMode: opts['global-mode'], siteMode: raw.mode, fetchImpl: opts.fetchImpl || fetch, now });
  notes.push(...m.notes);
  const stage = opts.stage || 'all';
  const publish = process.env.PUBLISH === 'true';
  const did = {};
  if (stage === 'all' || stage === 'missing') did.missing = await missingGuides(E, sites, raw, { mode: m.mode, notes, publish, fetchImpl: opts.fetchImpl, chatImpl: opts.chatImpl, now });
  if (stage === 'all' || stage === 'check') did.check = await checkRepair(E, sites, { mode: m.mode, notes, fetchImpl: opts.fetchImpl, chatImpl: opts.chatImpl, now });
  const out = path.join(ROOT, opts['report-dir'] || 'reports/search-loop');
  const files = reports(E, sites, { mode: m.mode, notes, did, now, out });
  const census = `search-loop canonical: mode=${m.mode} missing_listed=${did.missing?.listed ?? 'skipped'} covered=${did.missing?.covered ?? 0} built=${did.missing?.built ?? 0} dropped=${did.missing?.dropped ?? 0} deferred=${did.missing?.deferred ?? 0} held=${did.missing?.held ?? 0} checked=${did.check?.checked ?? 0} wins=${did.check?.wins ?? 0} strengthened=${did.check?.strengthened ?? 0} undone=${did.check?.undone ?? 0} families_served=${did.check?.families_served ?? 0} lead_paths=${did.check?.lead_paths_ok ?? 0}/${did.check?.lead_paths ?? 0} reports=${files.length}`;
  const nothing = !did.missing?.listed && !did.missing?.built && !did.check?.lead_paths && !did.check?.checked;
  return { census, notes, did, files, nothing, written: did.missing?.written || [] };
}

async function main() {
  const o = args(process.argv.slice(2));
  const r = await run(o);
  for (const n of r.notes) console.log(`note: ${n}`);
  console.log(r.census);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `built=${r.did.missing?.built ?? 0}\nwritten=${r.written.join(' ')}\nchanged=${(r.did.missing?.built || 0) + (r.did.check?.strengthened || 0) + (r.did.check?.undone || 0) + (r.did.check?.families_served || 0)}\n`);
  if (r.nothing) { console.error('NAMED STOP [NOTHING_DONE] no list read, no guide built, no page checked and no lead path probed'); process.exit(2); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e.message); process.exit(Number.isInteger(e.code) ? e.code : 1); });
}
