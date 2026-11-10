#!/usr/bin/env node
/**
 * Refresh lane: a real re-check of a few guide pages every day, at $0.
 *
 * Owner goal, 10 Nov 2026: real freshness on every guide site with nothing for
 * her to do. Risk rule R-ADV-12 (FTC Act s5, no fake freshness): a page's
 * "last updated" date and sitemap lastmod move ONLY when what the page says
 * changed. This lane never writes a date. It edits a guide's page-set JSON; the
 * record step's `build_all_packs.js --refresh-ledger` hashes the rendered main
 * content, and only a changed hash moves lastmod (scripts/lib/lastmod_ledger.js,
 * pinned by lastmod_date_invariant_contract.js). A page checked with nothing to
 * fix is recorded as checked and keeps its date.
 *
 * Per page, two real changes are possible:
 *   1. Links re-checked and fixed. Every outbound link in main_html is fetched
 *      (twice). A link that is gone (404, 410, or the host no longer answers) is
 *      unwrapped to its plain words, so the page stops sending readers to a dead
 *      address. A 403, 429 or 5xx is "could not tell" and is left alone.
 *   2. One new real-search question. A Search Console query (28 days, from
 *      data/search_intelligence/<host>/gsc_search_analytics_export.json) that
 *      lands on this page and that no heading or FAQ on it answers yet becomes one
 *      FAQ entry (`refresh_faq`), written by a $0 model from facts already on the
 *      page only (guards: no new numbers, names, links or promises).
 *
 * Order: dentistry, then the accident guides, then the other packs, oldest first.
 * Pace: ceil(guides / PACE_DAYS) a run, so each guide is visited about every
 * PACE_DAYS days, and never twice within MIN_DAYS.
 *
 * Census: `OUTPUT <n> pages refreshed`. Rule 0: due pages and nothing refreshed is
 * a NAMED STOP; three runs in a row of that exits 1 (a red scheduled run).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

export const ORDER = ['dentistry', 'pi', 'neuro', 'trt', 'uscis_medical', 'senior_living'];
export const PACE_DAYS = 45;
export const MIN_DAYS = 30;
export const MAX_REFRESH_FAQ = 6;
export const LEDGER = 'data/cadence/refresh_lane_ledger.json';
const DAY = 86400000;

const readJson = (rel, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; } };
const writeJson = (rel, value) => fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(value, null, 2) + '\n');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('a an and are can do does for from how i in is it my of on or the to what when where which who why with you your near me'.split(' '));
export const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));
export const textOf = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

/** Every guide page, in lane order, with the date its content last changed. */
export function guidePages(root = ROOT) {
  const { PACK_SITE_CONFIG } = require(path.join(root, 'scripts/lib/pack_site_config.js'));
  const ledger = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'data/cadence/lastmod_ledger.json'), 'utf8')).entries || {}; } catch { return {}; } })();
  const out = [];
  for (const key of ORDER) {
    const cfg = PACK_SITE_CONFIG[key];
    if (!cfg) continue;
    const dir = `data/page_sets/examples/${key}_global_pages`;
    let files = [];
    try { files = fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.json')).sort(); } catch { continue; }
    for (const f of files) {
      const rel = `${dir}/${f}`;
      const page = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
      if (!/^\/guides\/.+/.test(page.route || '')) continue;
      const url = cfg.siteUrl.replace(/\/$/, '') + page.route;
      out.push({ key, host: new URL(cfg.siteUrl).hostname, rel, route: page.route, url, lastmod: ledger[url]?.lastmod || null });
    }
  }
  return out;
}

/** Which pages are due today, in order, and how many this run takes. */
export function duePages(pages, laneLedger, today) {
  const t = Date.parse(today);
  const last = (p) => laneLedger.pages?.[p.url]?.checked_at || p.lastmod || '1970-01-01';
  const due = pages.filter((p) => t - Date.parse(last(p)) >= MIN_DAYS * DAY);
  const rank = (p) => ORDER.indexOf(p.key);
  due.sort((a, b) => rank(a) - rank(b) || last(a).localeCompare(last(b)) || a.url.localeCompare(b.url));
  return { due, take: Math.max(1, Math.ceil(pages.length / PACE_DAYS)) };
}

/** Unwraps every <a> whose href is in `dead`, keeping its words. */
export function unwrapDeadLinks(html, dead) {
  if (!dead.length) return html;
  return String(html).replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => (dead.includes(href) ? inner : m));
}

export function outboundLinks(html) {
  return [...new Set([...String(html).matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]))];
}

async function probe(url, fetchImpl) {
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; IndustryGuidesLinkCheck/1.0)' } });
    return res.status;
  } catch { return 'unreachable'; }
}

/** Gone = 404/410/unreachable on two tries. Anything else is alive or unknown. */
export async function deadLinks(links, fetchImpl = fetch) {
  const dead = [];
  for (const url of links) {
    const first = await probe(url, fetchImpl);
    if (![404, 410, 'unreachable'].includes(first)) continue;
    const second = await probe(url, fetchImpl);
    if ([404, 410, 'unreachable'].includes(second)) dead.push(url);
  }
  return dead;
}

/** The page's real searches that nothing on it answers yet, best first. */
export function openQuestions(page, gscRows) {
  const asked = [
    ...[...String(page.main_html || '').matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => textOf(m[1])),
    ...(page.search_strengthening?.faq || []).map((x) => x.q),
    ...(page.refresh_faq || []).map((x) => x.q),
    page.title || '',
  ].map(tokens);
  const covered = (q) => {
    const t = tokens(q);
    if (t.size < 2) return true;
    return asked.some((a) => { let hit = 0; for (const w of t) if (a.has(w)) hit++; return hit / t.size >= 0.75; });
  };
  const tried = new Set((page.refresh_tried || []).map(norm));
  return gscRows
    .filter((r) => r.route === page.route && r.impressions > 0 && norm(r.query).split(' ').length >= 3 && !tried.has(norm(r.query)) && !covered(r.query))
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));
}

const BANNED = /\b(guarantee[ds]?|painless|cure[ds]?|best|cheapest|top[- ]rated|#1|number one|we recommend|always works|risk[- ]free)\b/i;

/** Problems with a drafted entry; empty means it may go on the page. */
export function entryProblems(entry, page, query) {
  const problems = [];
  const q = String(entry?.q || '').trim();
  const a = String(entry?.a || '').trim();
  if (!q.endsWith('?')) problems.push('the question must end with a question mark');
  const qt = tokens(query); let hit = 0; const has = tokens(q); for (const w of qt) if (has.has(w)) hit++;
  if (qt.size && hit / qt.size < 0.5) problems.push(`the question must keep the words of the real search "${query}"`);
  const words = a.split(/\s+/).filter(Boolean).length;
  if (words < 35 || words > 80) problems.push(`the answer must be 35 to 80 words (it is ${words})`);
  const source = textOf(page.main_html) + ' ' + (page.search_strengthening?.faq || []).map((x) => `${x.q} ${x.a}`).join(' ') + ' ' + (page.title || '');
  const sourceLower = source.toLowerCase();
  for (const n of a.match(/\d[\d,.%$]*/g) || []) if (!source.includes(n.replace(/[.,]$/, ''))) problems.push(`the number ${n} is not on the page; use only facts the page already states`);
  for (const name of a.match(/(?<=[a-z,;:] )[A-Z][a-zA-Z]+/g) || []) if (!sourceLower.includes(name.toLowerCase())) problems.push(`the name ${name} is not on the page`);
  if (/https?:|www\./i.test(a)) problems.push('no links in the answer');
  if (BANNED.test(q + ' ' + a)) problems.push('no promises, rankings or outcome claims (guarantee, best, painless, cure...)');
  return problems;
}

function parseEntry(text) {
  const s = String(text || '');
  for (let i = s.indexOf('{'); i >= 0; i = s.indexOf('{', i + 1)) {
    for (let j = s.lastIndexOf('}'); j > i; j = s.lastIndexOf('}', j - 1)) {
      try { const o = JSON.parse(s.slice(i, j + 1)); if (o && typeof o.q === 'string' && typeof o.a === 'string') return o; } catch { /* keep scanning */ }
    }
  }
  return null;
}

async function draftEntry(router, cfg, page, query, brand) {
  let problems = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages = [
      { role: 'system', content: 'You add one FAQ entry to an educational consumer guide. Use ONLY facts stated in the page text given. No new numbers, prices, names, links, rankings, promises or medical/legal advice. Plain words. Reply with JSON only: {"q": "...?", "a": "..."}.' },
      { role: 'user', content: `Site: ${brand}\nReal search people typed: "${query}"\nWrite the question in natural English as a reader would ask it (proper capitals for places and names), keeping the search's words, and a 40-60 word answer from this page text only.${problems.length ? `\nYour last draft was refused: ${problems.join('; ')}.` : ''}\n\nPAGE TEXT:\n${textOf(page.main_html).slice(0, 6000)}` },
    ];
    const r = await router.chatFree(cfg, { messages, max_tokens: 400, temperature: 0.2, totalBudgetMs: 90000 });
    if (!r.ok) return { stop: r.stop };
    const entry = parseEntry(r.content);
    problems = entry ? entryProblems(entry, page, query) : ['reply was not the JSON object asked for'];
    if (!problems.length) return { entry: { q: entry.q.trim(), a: entry.a.trim() }, model: r.model };
  }
  return { problems };
}

export function stalled(runs) {
  const last = runs.slice(-3);
  return last.length === 3 && last.every((r) => r.due > 0 && r.refreshed === 0);
}

async function main() {
  const today = (process.env.REFRESH_RUN_AT || new Date().toISOString()).slice(0, 10);
  const lane = readJson(LEDGER, { schema_version: 1, pages: {}, runs: [] });
  lane.pages ||= {}; lane.runs ||= [];
  const pages = guidePages();
  if (!pages.length) { console.log('NAMED STOP [REFRESH_NO_GUIDES] no guide pages found under data/page_sets/examples/*_global_pages'); process.exit(2); }
  const { due, take } = duePages(pages, lane, today);
  const { PACK_SITE_CONFIG } = require(path.join(ROOT, 'scripts/lib/pack_site_config.js'));

  const router = await import(pathToFileURL(path.join(ROOT, 'scripts/lib/free_llm_router.mjs')).href);
  let cfg = null; let modelStop = null;
  try { cfg = router.loadRouting(ROOT); } catch (e) { modelStop = `routing config refused: ${e.message}`; }
  if (!process.env.OPENROUTER_API_KEY) modelStop = router.NO_KEY_STOP;

  const gscCache = new Map();
  const gscFor = (host) => {
    if (!gscCache.has(host)) {
      const g = readJson(`data/search_intelligence/${host}/gsc_search_analytics_export.json`, { rows: [] });
      gscCache.set(host, (g.rows || []).map((r) => { let route = r.page; try { route = new URL(r.page).pathname; } catch { /* keep */ } return { ...r, route }; }));
    }
    return gscCache.get(host);
  };

  const refreshed = [];
  for (const p of due.slice(0, take)) {
    const page = readJson(p.rel);
    const changes = [];
    const dead = await deadLinks(outboundLinks(page.main_html));
    if (dead.length) { page.main_html = unwrapDeadLinks(page.main_html, dead); changes.push(...dead.map((u) => `dead link removed: ${u}`)); }

    let note = null;
    if ((page.refresh_faq || []).length >= MAX_REFRESH_FAQ) note = `already has ${MAX_REFRESH_FAQ} refresh questions`;
    else if (modelStop) note = `no question drafted: ${modelStop}`;
    else {
      const open = openQuestions(page, gscFor(p.host));
      if (!open.length) note = 'no real search lands on this page that it does not already answer';
      else {
        const query = open[0].query;
        const d = await draftEntry(router, cfg, page, query, PACK_SITE_CONFIG[p.key].brandName);
        if (d.stop) { modelStop = d.stop; note = `no question drafted: ${d.stop}`; }
        else if (d.problems) { page.refresh_tried = [...(page.refresh_tried || []), query].slice(-20); note = `draft for "${query}" refused: ${d.problems.join('; ')}`; }
        else {
          page.refresh_faq = [...(page.refresh_faq || []), { ...d.entry, query, impressions: open[0].impressions, added: today }];
          changes.push(`question added from a real search: "${query}"`);
        }
      }
    }
    if (changes.length || page.refresh_tried) writeJson(p.rel, page);
    lane.pages[p.url] = { checked_at: today, ...(changes.length ? { refreshed_at: today, changes } : { changes: [] }), ...(note ? { note } : {}) };
    if (changes.length) refreshed.push({ url: p.url, changes });
    console.log(`${changes.length ? 'REFRESHED' : 'CHECKED  '} ${p.url}${changes.length ? ' - ' + changes.join('; ') : ''}${note ? ` (${note})` : ''}`);
  }

  lane.runs = [...lane.runs.filter((r) => r.at !== today), { at: today, due: due.length, checked: Math.min(take, due.length), refreshed: refreshed.length, sites: [...new Set(refreshed.map((r) => new URL(r.url).hostname))].length }].slice(-90);
  lane.updated_at = today;
  writeJson(LEDGER, lane);

  console.log(`OUTPUT ${refreshed.length} pages refreshed`);
  if (!due.length) { console.log(`NAMED NOTE [NOTHING_DUE] every guide was checked or changed within ${MIN_DAYS} days`); return; }
  if (!refreshed.length) {
    console.log(`NAMED STOP [REFRESH_NOTHING_CHANGED] ${due.length} due, ${Math.min(take, due.length)} checked, 0 changed${modelStop ? `; ${modelStop}` : ''}`);
    if (stalled(lane.runs)) { console.log('NAMED STOP [REFRESH_STALLED] three runs in a row with due pages and nothing refreshed'); process.exit(1); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
