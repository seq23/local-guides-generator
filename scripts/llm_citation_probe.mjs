#!/usr/bin/env node
/**
 * Ask an answer engine a real question and record whether it cites us.
 *
 * This is the measurement the portfolio did not have. The existing
 * query:test:zero-cost task makes no network calls at all - it prints a
 * worksheet and a CSV for a human to fill in by hand - so nothing has ever
 * observed whether these pages are cited. Every statement about AEO progress up
 * to now has been inference from proxies.
 *
 * Every model call goes through scripts/lib/free_llm_router.mjs, which only
 * reaches the $0 models in config/llm_routing.json and fails the run if a
 * provider ever reports a non-zero cost. Owner policy 11 Oct 2026: nothing paid.
 *
 * What this does not claim: one engine is not all engines, grounding metadata is
 * not identical to what a user sees in an AI Overview, and absence on a given
 * day is weak evidence. Runs are recorded individually with timestamps so a
 * trend can be read later rather than a single run being treated as a verdict.
 *
 * Without CONFIRM_PAID=true, without a working key, or in grounded mode (billed)
 * it exits 0 with a NAMED STOP receipt. A measurement
 * tool that fails the build when it cannot measure teaches people to remove it.
 *
 * Usage: node llm_citation_probe.mjs [--queries file] [--limit N] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadRouting, freeModelIds, chatOnce, assertFreeRequest, receipt, CostViolation, PaidCallRefused, KEY_REFUSED_STOP, NO_KEY_STOP } from './lib/free_llm_router.mjs';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const arg = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : dflt; };
const DRY = argv.includes('--dry-run');
const MODE = arg('--mode', process.env.CITATION_PROBE_MODE || 'knowledge');
const GROUNDED = MODE === 'grounded';
const LIMIT = Number(arg('--limit', '25'));
const OUT = 'data/signals/llm_citation_observations.json';
// Every run writes this receipt, including a run that stops for want of a
// credential. Without it a lane that has never once produced an observation is
// indistinguishable from one that ran fine and had nothing to report, and that
// is precisely how this lane spent four paid grounded runs unnoticed.
const STATUS = 'data/signals/citation_probe_status.json';

function readStatus() {
  const fp = path.join(ROOT, STATUS);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function writeStatus(patch) {
  const prev = readStatus() || {};
  const next = {
    schema_version: '1.0',
    bootstrapped: false,
    runs_total: (Number(prev.runs_total) || 0) + 1,
    successes_total: Number(prev.successes_total) || 0,
    stops_total: Number(prev.stops_total) || 0,
    last_success_at: prev.last_success_at || null,
    last_success_observations: prev.last_success_observations ?? null,
    last_success_run_at: prev.last_success_run_at || null,
    ...patch,
  };
  fs.mkdirSync(path.join(ROOT, path.dirname(STATUS)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, STATUS), JSON.stringify(next, null, 2) + '\n');
  return next;
}

const CONFIG_PATH = 'data/signals/citation_probe_config.json';
const config = fs.existsSync(path.join(ROOT, CONFIG_PATH))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG_PATH), 'utf8'))
  : {};
const OWNED = (config.owned_domains || []).map((d) => d.toLowerCase().replace(/^www\./, ''));
if (!OWNED.length) {
  console.error(`citation probe: no owned_domains in ${CONFIG_PATH} - cannot tell a citation of ours from anyone else's`);
  process.exit(1);
}

function loadQueries() {
  const file = arg('--queries', config.queries_file || 'data/seo/priority_queries.json');
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return [];
  const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
  const rows = Array.isArray(raw) ? raw : (raw.queries || raw.priority_queries || raw.entries || []);
  return rows.map((r) => (typeof r === 'string' ? r : r.query || r.text || '')).filter(Boolean).slice(0, LIMIT);
}

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

// Two modes, kept distinct because they measure different things and conflating
// them would overstate what is known.
//
//   knowledge (default) - ask without tools and see whether a model names us
//     unprompted. Weaker than a citation and never reported as one. Runs on the
//     $0 models in config/llm_routing.json, through the free router.
//   grounded - read the pages an answer was built from. Every grounded channel
//     (OpenRouter's web plugin / :online, Gemini search grounding) bills per
//     request whatever the model, so under the owner's zero-spend policy
//     (11 Oct 2026: "nothing should be paid ... cut the probes and make them
//     free") grounded mode is REFUSED by the router as a named stop.
//
// Before 11 Oct 2026 this ran daily in rotating_refresh.yml in grounded mode on
// ibm-granite/granite-4.0-h-micro:online - paid every day. It is now dispatch-only
// (.github/workflows/citation_probe.yml, confirm_paid) and cannot spend at all.

const queries = loadQueries();
if (!queries.length) { console.error('citation probe: no queries found'); process.exit(1); }

const now = new Date().toISOString();
function namedStop(reason) {
  const prev = readStatus();
  const st = writeStatus({
    last_run_at: now,
    last_outcome: 'stopped',
    last_stop_reason: reason,
    last_mode: MODE,
    queries_ready: queries.length,
    stops_total: (Number(prev?.stops_total) || 0) + 1,
  });
  console.log(`citation probe: NAMED STOP - ${reason}; mode=${MODE}; ${queries.length} queries ready, owned domains: ${OWNED.join(', ')}`);
  console.log(`citation probe: recorded in ${STATUS} (${st.runs_total} run(s) so far, ${st.successes_total} produced an observation; last success ${st.last_success_at || 'NEVER'}). Nothing generated, nothing spent.`);
  console.log(`LLM ROUTER RECEIPT ${JSON.stringify(receipt(routing, { outcome: `NAMED STOP: ${reason}` }))}`);
  process.exit(0);
}

const routing = loadRouting(ROOT);
if (process.env.CONFIRM_PAID !== 'true') namedStop(routing.policy.probes_disabled_reason + ' - dispatch .github/workflows/citation_probe.yml with confirm_paid: true to run it on $0 models');
if (DRY) namedStop('dry_run');
if (GROUNDED) {
  try { assertFreeRequest(routing, { model: `${freeModelIds(routing)[0]}:online` }); } catch (e) { namedStop(`grounded mode refused: ${e.message}`); }
}
const orKey = process.env.OPENROUTER_API_KEY || '';
if (!orKey) namedStop(NO_KEY_STOP);

const PROVIDER = 'openrouter';
const REQUEST_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 25000);
async function askFree(query, model) {
  const r = await chatOnce(routing, { model, messages: [{ role: 'user', content: query }], max_tokens: 400, temperature: 0, key: orKey, timeoutMs: REQUEST_TIMEOUT_MS });
  if (!r.ok) return r;
  return { ok: true, answer: r.content, uris: [] };
}

const observations = [];
// Several $0 models, each reported separately: one model's idiosyncrasies are
// not a measurement. The list is config/llm_routing.json, nothing else.
const engines = freeModelIds(routing);
for (const q of queries) {
 for (const engineModel of engines) {
  let r;
  try {
    r = await askFree(q, engineModel);
  } catch (e) {
    if (e instanceof CostViolation || e instanceof PaidCallRefused) { console.error(`citation probe: ${e.message}`); process.exit(1); }
    r = { ok: false, error: String(e.message || e) };
  }
  if (!r.ok && r.credential_refused) namedStop(r.error === NO_KEY_STOP ? NO_KEY_STOP : KEY_REFUSED_STOP);
  if (!r.ok) {
    observations.push({ query: q, engine: `${PROVIDER}:${engineModel}`, mode: MODE, observed_at: now, status: 'provider_error', error: r.error });
    console.log(`  ERROR  ${engineModel} :: ${q} :: ${String(r.error).slice(0, 70)}`);
    continue;
  }
  const domains = [...new Set(r.uris.map(hostOf).filter(Boolean))];
  const ours = domains.filter((d) => OWNED.some((o) => d === o || d.endsWith(`.${o}`)));
  // In knowledge mode there are no grounded sources, so presence means the model
  // named the brand or domain in its own answer.
  const answerLower = (r.answer || '').toLowerCase();
  const named = OWNED.filter((o) => answerLower.includes(o) || answerLower.includes(o.split('.')[0]));
  observations.push({
    query: q, engine: `${PROVIDER}:${engineModel}`, mode: MODE, observed_at: now,
    status: 'observed',
    cited_domains: domains,
    cited_ours: ours,
    self_cited: GROUNDED ? ours.length > 0 : named.length > 0,
    named_in_answer: named,
    answer_mentions_brand: named.length > 0,
  });
  const hit = GROUNDED ? ours.length > 0 : named.length > 0;
  console.log(`  ${hit ? 'PRESENT' : '   --  '} ${engineModel.split('/').pop()} :: ${q}${hit ? ` (${(GROUNDED ? ours : named).join(', ')})` : ''}`);
 }
}

const prior = fs.existsSync(path.join(ROOT, OUT))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, OUT), 'utf8'))
  : { schema_version: '1.0', runs: [] };
prior.runs = (prior.runs || []).slice(-49);
prior.runs.push({ run_at: now, provider: PROVIDER, engines, mode: MODE, queries: queries.length, observations });

const cited = observations.filter((o) => o.self_cited).length;
const errored = observations.filter((o) => o.status === 'provider_error').length;
prior.latest_summary = {
  run_at: now, provider: PROVIDER, engines, mode: MODE,
  queries: queries.length, observations: observations.length, self_cited: cited, errored,
  _mode_note: GROUNDED
    ? 'grounded: counted when the answer was built from one of our pages'
    : 'knowledge: counted when the model named us unprompted, with no retrieval. Weaker than a citation and must not be reported as one.',
  self_cited_rate_pct: observations.length ? Number(((100 * cited) / observations.length).toFixed(1)) : 0,
};

fs.mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(prior, null, 2) + '\n');
const prevStatus = readStatus();
writeStatus({
  last_run_at: now,
  last_outcome: 'observed',
  last_stop_reason: null,
  last_mode: MODE,
  queries_ready: queries.length,
  successes_total: (Number(prevStatus?.successes_total) || 0) + 1,
  last_success_at: now,
  last_success_run_at: now,
  last_success_observations: observations.length,
});
console.log(`citation probe [${PROVIDER}/${MODE}]: ${cited}/${observations.length} observations named one of our domains (${prior.latest_summary.self_cited_rate_pct}%); ${errored} provider error(s). Recorded in ${OUT}`);
