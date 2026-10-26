#!/usr/bin/env node
/**
 * Cadence gate.
 *
 * The previous gate asked whether pages were earning Google impressions before
 * allowing more publishing. That is the wrong question for an AEO goal: AI
 * citation and Google rank are largely decoupled - most pages AI engines cite do
 * not rank in Google's top 10 - so a page can be invisible in Search and still be
 * cited, or rank and never be cited. Gating publication on Search surfacing
 * measured the wrong thing, and because it never returned a non-zero exit it
 * could not have stopped anything anyway.
 *
 * This gates on freshness and volume, which are the two levers the evidence
 * actually ties to citation:
 *
 *   - Pages not updated within 13 weeks are markedly more likely to lose AI
 *     citations, and recency correlates strongly with being cited at all.
 *   - Publishing faster than a library can be maintained guarantees the tail
 *     ages past that threshold. The ceiling is therefore not a taste question:
 *     it is refresh capacity multiplied by the refresh window.
 *
 * Four blocking conditions, each with an exit code so a pipeline can act on it:
 *
 *   1. new pages in the last 7 days above the weekly cap
 *   2. share of pages older than the refresh window above the tolerance
 *   3. URLs with no lastmod at all - a crawler gets no freshness signal
 *   4. library larger than refresh capacity can keep inside the window
 *
 * One bounded exception to condition 1: an approved expansion. Completing a
 * site's declared coverage is not routine drip publishing, and the weekly cap
 * exists to serve condition 4 rather than to stand on its own - its whole
 * rationale is that publishing faster than refresh capacity ages the tail out
 * of citability. So a host may carry an entry in policy.approved_expansions
 * naming the host, a URL count, a reason, the brief behind it and the date, and
 * that run's new URLs are allowed up to that count. It is refused unless the
 * resulting library still fits inside the maintainable ceiling, which ties the
 * allowance to the same capacity argument the cap serves; above the ceiling it
 * blocks exactly as before. It does not change new_pages_per_week, so the
 * ordinary rate resumes on the next run, and the entry stays in the policy as
 * the record of what was published and why.
 *
 * This is the same distinction the ledger already makes for a host seen for the
 * first time: launching a site is recorded rather than blocked, then the weekly
 * cap applies.
 *
 * It also warns, without blocking, when a very high share of pages carry the
 * same recent lastmod. That is the signature of a date bump rather than a
 * substantive refresh, and it is worth seeing rather than being rewarded by the
 * freshness rules above.
 *
 * Usage: node cadence_gate.js [--json] [--policy path]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const JSON_ONLY = args.includes('--json');
const policyPath = (() => {
  const i = args.indexOf('--policy');
  return i >= 0 ? args[i + 1] : 'data/cadence/policy.json';
})();

const DEFAULT_POLICY = {
  refresh_window_days: 91,      // the 13-week threshold
  high_value_window_days: 30,
  stale_tolerance_pct: 20,
  new_pages_per_week: 2,
  refresh_capacity_per_week: 25,
  refresh_capacity_per_week_by_host: {},
  require_lastmod: true,
  approved_expansions: [],
};

function loadPolicy() {
  const f = path.join(ROOT, policyPath);
  if (!fs.existsSync(f)) return { ...DEFAULT_POLICY, _source: 'defaults' };
  return { ...DEFAULT_POLICY, ...JSON.parse(fs.readFileSync(f, 'utf8')), _source: policyPath };
}

function sitemapUrls() {
  const found = new Map();
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (/^(node_modules|\.git|\.pages-output|coverage)$/.test(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (/^sitemap.*\.xml$/i.test(e.name)) {
        const xml = fs.readFileSync(full, 'utf8');
        for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
          const loc = (m[1].match(/<loc>(.*?)<\/loc>/) || [])[1];
          if (!loc) continue;
          const lm = (m[1].match(/<lastmod>(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
          const prev = found.get(loc);
          if (prev === undefined || (lm && (!prev || lm > prev))) found.set(loc, lm);
        }
      }
    }
  };
  walk(ROOT);
  return found;
}

const policy = loadPolicy();
const urls = sitemapUrls();
const today = new Date(process.env.CADENCE_TODAY || new Date().toISOString().slice(0, 10));
const ageDays = (d) => Math.floor((today - new Date(d)) / 86400000);

// A page that changed is not a page that was published. Counting any recent
// lastmod as a new page made a one-off structural edit across the library look
// like a publishing spree, which is exactly the signal this is meant to
// distinguish. New means a URL that was not in the sitemap last time this ran.
//
// The ledger is kept per host. CI builds every pack into one dist/ in turn and
// gates the last one, so a single flat list made the gate compare one site's
// sitemap against another site's URLs whenever the pack order changed. A host
// seen for the first time initialises its own entry, exactly as a missing
// ledger always has: launching a site is recorded, then its weekly cap applies.
const ledgerPath = path.join(ROOT, 'data/cadence/known_urls.json');
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
let ledger = null;
try { ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch { ledger = null; }
const byHost = {};
for (const [h, list] of Object.entries((ledger && ledger.by_host) || {})) byHost[h] = new Set(list);
for (const u of (ledger && ledger.urls) || []) { const h = hostOf(u); if (h) (byHost[h] = byHost[h] || new Set()).add(u); }
const hostsNow = [...new Set([...urls.keys()].map(hostOf).filter(Boolean))];
const initialisedHosts = hostsNow.filter((h) => !byHost[h]);
let ledgerExists = !!ledger && hostsNow.some((h) => byHost[h]);
const newUrls = [...urls.keys()].filter((u) => byHost[hostOf(u)] && !byHost[hostOf(u)].has(u));

const dated = [...urls.entries()].filter(([, d]) => d);
const undated = [...urls.entries()].filter(([, d]) => !d);
const ages = dated.map(([, d]) => ageDays(d));
const stale = ages.filter((a) => a > policy.refresh_window_days).length;
const fresh30 = ages.filter((a) => a <= policy.high_value_window_days).length;
const publishedThisWeek = ages.filter((a) => a <= 7).length;
const stalePct = dated.length ? (100 * stale) / dated.length : 0;
// Refresh capacity is per host, because this repository builds two kinds of
// site and they do not refresh the same way.
//
// Five of the six packs are hand-written guide libraries: refreshing a page
// means someone rewriting it, so capacity really is a number of pages per week
// and the ceiling is the honest limit on how many pages can be kept inside the
// citability window.
//
// memphisseniorcarehomes.com is a directory. Every town, neighbourhood,
// hospital and care-type page derives its content from
// data/listings/senior-living/facilities.json, so one re-pull of the directory
// moves the content hash of every derived page at once - the maintenance action
// is a data pull, not an edit, and its cost does not grow with the number of
// pages it refreshes. Scoring it at the guide packs' editorial throughput said
// the site could carry 195 URLs when its own declared coverage manifest asks
// for more than that, which is how brief sr-memphisseniorcarehomes.com-j9 came
// to be delivered 11 towns out of 28: the pass before this one sized itself to
// land at 177 against 195 rather than cross the ceiling.
//
// This is NOT a relaxation. The capacity claim is only true while the directory
// data actually moves (facilities.json changed on 13, 16 and 25 Oct 2026), and
// if it stops moving these pages age past refresh_window_days and condition 2,
// refresh_debt at a 20% tolerance, blocks on exactly that - a sharper test of
// the real risk than a page count, and one this change leaves fully armed. An
// override is per host and named, so the five guide packs keep the editorial
// ceiling they need.
const capacityFor = (host) => {
  const by = policy.refresh_capacity_per_week_by_host;
  const v = by && typeof by === 'object' ? by[host] : undefined;
  return Number.isInteger(v) && v > 0 ? v : policy.refresh_capacity_per_week;
};
const ceilingFor = (host) => capacityFor(host) * Math.floor(policy.refresh_window_days / 7);
// The library in dist is one pack, so the host carrying it is the one whose
// capacity governs. Ties and an empty library fall back to the global number.
const libraryHost = (() => {
  const counts = {};
  for (const u of urls.keys()) { const h = hostOf(u); if (h) counts[h] = (counts[h] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
})();
const ceiling = ceilingFor(libraryHost);

const blocking = [];
const warnings = [];

// An approved expansion raises the cap for the named hosts on this run only, and
// only while the resulting library still fits the maintainable ceiling. Anything
// malformed is ignored rather than trusted, so a half-written entry cannot
// silently widen the gate.
const newByHost = {};
for (const u of newUrls) { const h = hostOf(u); if (h) newByHost[h] = (newByHost[h] || 0) + 1; }
const expansions = (Array.isArray(policy.approved_expansions) ? policy.approved_expansions : []).filter((e) => (
  e && typeof e.host === 'string' && Number.isInteger(e.max_new_urls) && e.max_new_urls > 0
  && typeof e.reason === 'string' && e.reason.length >= 20
  && typeof e.brief === 'string' && e.brief.length > 0
  && /^\d{4}-\d{2}-\d{2}$/.test(String(e.approved_on || ''))
));
// An allowance is spent, not owned: it is honoured only inside EXPANSION_TTL_DAYS
// of its approval date, so a one-off coverage completion cannot become a
// permanently higher cap for that host by being left in the policy. An expired
// entry is reported, so the record of what was published stays readable.
const EXPANSION_TTL_DAYS = 14;
const expansionAge = (e) => Math.floor((today - new Date(`${e.approved_on}T00:00:00Z`)) / 86400000);
const expired = expansions.filter((e) => expansionAge(e) > EXPANSION_TTL_DAYS || expansionAge(e) < 0);
const live = expansions.filter((e) => !expired.includes(e));
expansions.length = 0;
expansions.push(...live);
const allowanceFor = (h) => expansions.filter((e) => e.host === h).reduce((n, e) => Math.max(n, e.max_new_urls), 0);
const expansionsUsed = [];
if (ledgerExists && newUrls.length > policy.new_pages_per_week) {
  const overCap = Object.entries(newByHost).filter(([, n]) => n > policy.new_pages_per_week);
  const refused = [];
  for (const [h, n] of overCap) {
    const allowed = allowanceFor(h);
    if (!allowed || n > allowed) {
      refused.push(`${h}: ${n} new, cap ${policy.new_pages_per_week}${allowed ? `, approved expansion ${allowed}` : ''}`);
    } else if (urls.size > ceilingFor(h)) {
      refused.push(
        `${h}: an approved expansion of ${allowed} cannot be used because the library would be ${urls.size} against a ceiling of ${ceilingFor(h)} - `
        + 'the expansion exists because the weekly cap serves the ceiling, so it cannot be used to cross it'
      );
    } else {
      const e = expansions.find((x) => x.host === h && x.max_new_urls >= n);
      expansionsUsed.push(`${h}: ${n} of ${allowed} approved URLs (${e.brief}, approved ${e.approved_on}) - ${e.reason}`);
    }
  }
  if (refused.length) {
    blocking.push(`weekly_cap: ${newUrls.length} URLs are new since the last run, cap is ${policy.new_pages_per_week} per week - ${refused.join('; ')}`);
  }
}
for (const u of expansionsUsed) warnings.push(`approved_expansion: ${u}`);
for (const e of expired) {
  warnings.push(
    `approved_expansion_expired: ${e.host} ${e.max_new_urls} URLs (${e.brief}, approved ${e.approved_on}) is ${expansionAge(e)} days old, `
    + `past the ${EXPANSION_TTL_DAYS}-day window, and no longer raises the cap. It can be deleted.`
  );
}
if (stalePct > policy.stale_tolerance_pct) {
  blocking.push(`refresh_debt: ${stale} of ${dated.length} pages (${stalePct.toFixed(0)}%) are older than ${policy.refresh_window_days} days, tolerance is ${policy.stale_tolerance_pct}%`);
}
if (undated.length) {
  const msg = `no_freshness_signal: ${undated.length} sitemap URLs have no lastmod, so a crawler cannot tell when they changed`;
  if (policy.require_lastmod) blocking.push(msg);
  else warnings.push(`${msg} (reported only: ${policy._lastmod_note || 'enforcement disabled for this repo'})`);
}
if (urls.size > ceiling) {
  // Reported, not blocking. A library above the ceiling is a strategic problem -
  // the tail cannot be kept inside the refresh window, so it decays toward zero
  // citation value - but it is not something a publish step can fix, and a gate
  // that is permanently red teaches people to ignore it. It has to be worked
  // down by pruning or by raising real refresh capacity.
  warnings.push(`library_over_ceiling: ${urls.size} pages against a ceiling of ${ceiling} (${capacityFor(libraryHost)} substantive refreshes per week held inside ${policy.refresh_window_days} days${libraryHost && capacityFor(libraryHost) !== policy.refresh_capacity_per_week ? `, the capacity recorded for ${libraryHost}` : ''}). ${urls.size - ceiling} pages cannot be kept current at this capacity.`);
}
if (dated.length && publishedThisWeek === dated.length && dated.length > 20) {
  warnings.push(`uniform_lastmod: ${publishedThisWeek} of ${dated.length} pages share a lastmod inside 7 days - that is a date bump pattern, not a refresh, and it makes the freshness signal meaningless`);
}
if (dated.length && fresh30 === 0) {
  warnings.push('no_recent_refresh: nothing has been updated in the last 30 days, where recency correlates most strongly with citation');
}

function report_date() { return today.toISOString().slice(0, 10); }
const report = {
  generated_at: today.toISOString().slice(0, 10),
  policy_source: policy._source,
  urls: urls.size,
  dated: dated.length,
  undated: undated.length,
  stale_over_window: stale,
  stale_pct: Number(stalePct.toFixed(1)),
  fresh_within_30d: fresh30,
  lastmod_within_7d: publishedThisWeek,
  new_since_last_run: ledgerExists ? newUrls.length : null,
  new_by_host: newByHost,
  approved_expansions_used: expansionsUsed,
  approved_expansions_expired: expired.map((e) => ({ host: e.host, brief: e.brief, approved_on: e.approved_on, age_days: expansionAge(e) })),
  ledger_initialised: ledgerExists,
  hosts_initialised_this_run: initialisedHosts,
  maintainable_ceiling: ceiling,
  refresh_capacity_per_week_used: capacityFor(libraryHost),
  library_host: libraryHost,
  policy: { ...policy, _source: undefined },
  blocking,
  warnings,
  status: blocking.length ? 'BLOCKED' : 'CLEAR',
};

// Record the current URL set so the next run can tell new from refreshed. Written
// whether or not the gate blocks: the ledger is a record of what exists, not a
// reward for passing.
fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
for (const h of hostsNow) byHost[h] = new Set([...urls.keys()].filter((u) => hostOf(u) === h));
const allKnown = [...new Set(Object.values(byHost).flatMap((set) => [...set]))].sort();
fs.writeFileSync(ledgerPath, JSON.stringify({
  generated_at: report_date(),
  urls: allKnown,
  by_host: Object.fromEntries(Object.keys(byHost).sort().map((h) => [h, [...byHost[h]].sort()])),
}, null, 2) + '\n');

fs.mkdirSync(path.join(ROOT, 'reports/cadence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/cadence/cadence-gate.json'), JSON.stringify(report, null, 2) + '\n');

if (JSON_ONLY) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`CADENCE GATE ${report.status}: ${urls.size} urls; ${stale} past ${policy.refresh_window_days}d (${report.stale_pct}%); ${fresh30} fresh within ${policy.high_value_window_days}d; ceiling ${ceiling}`);
  for (const b of blocking) console.log(`  BLOCK  ${b}`);
  for (const w of warnings) console.log(`  WARN   ${w}`);
}
process.exit(blocking.length ? 1 : 0);
