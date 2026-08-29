#!/usr/bin/env node
/**
 * CITATION PROBE LANE CONTRACT
 *
 * The citation probe is the only thing in this repo that observes whether
 * answer engines cite us. Between 2026-08-26 and 2026-08-29 it ran, billed for
 * grounded search, produced 25 observations a run, and lost every one of them:
 * the workflow guarded its commit with `git diff --quiet -- data/signals/`,
 * which reports CLEAN for an untracked file, so the observations file could
 * never take its first commit. From the outside a lane that has never produced
 * anything looked exactly like one that ran fine and had nothing new to say.
 *
 * This contract makes that state impossible to miss. It reads the receipt the
 * probe now writes on every path and asserts the receipt and the observations
 * file agree. A run stopped for want of a credential is a NAMED STOP: reported
 * loudly, never red. A run that SUCCEEDED whose output is not in the repo is
 * red, because that is the defect above.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const STATUS = path.join(repoRoot, 'data', 'signals', 'citation_probe_status.json');
const OBS = path.join(repoRoot, 'data', 'signals', 'llm_citation_observations.json');
const CONFIG = path.join(repoRoot, 'data', 'signals', 'citation_probe_config.json');

const failures = [];
const notices = [];
let checks = 0;
const check = (label, fn) => { checks += 1; fn(label); };

// --- The lane must have something to probe. A probe with no queries is
// --- another way to exit 0 having done nothing.
let queryCount = 0;
check('queries', () => {
  if (!fs.existsSync(CONFIG)) {
    failures.push('data/signals/citation_probe_config.json is missing - the probe cannot tell our domains from anyone else’s');
    return;
  }
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const owned = config.owned_domains || [];
  if (!owned.length) failures.push('citation_probe_config.json declares no owned_domains - every observation would be unattributable');
  const queriesFile = path.join(repoRoot, config.queries_file || 'data/seo/priority_queries.json');
  if (!fs.existsSync(queriesFile)) {
    failures.push(`queries file ${path.relative(repoRoot, queriesFile)} does not exist - the probe would exit 1 on every run`);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(queriesFile, 'utf8'));
  const rows = Array.isArray(raw) ? raw : (raw.queries || raw.priority_queries || raw.entries || []);
  queryCount = rows.length;
  if (!queryCount) failures.push(`${path.relative(repoRoot, queriesFile)} yields zero queries - the lane would probe nothing`);
});

// --- The receipt must exist. Its absence IS the invisibility defect.
let status = null;
check('receipt present', () => {
  if (!fs.existsSync(STATUS)) {
    failures.push('data/signals/citation_probe_status.json is missing - the probe lane leaves no receipt, so a lane that has never produced an observation is indistinguishable from a healthy one. scripts/llm_citation_probe.mjs must write it on every path.');
    return;
  }
  try {
    status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  } catch (e) {
    failures.push(`citation_probe_status.json does not parse: ${e.message}`);
  }
});

if (status) {
  const runs = Number(status.runs_total) || 0;
  const wins = Number(status.successes_total) || 0;
  const stops = Number(status.stops_total) || 0;

  // --- Every run is either a success or a named stop. Nothing may vanish.
  check('runs accounted for', () => {
    if (!status.bootstrapped && runs !== wins + stops) {
      failures.push(`receipt does not add up: runs_total=${runs} but successes_total=${wins} + stops_total=${stops} = ${wins + stops}. A run went unrecorded.`);
    }
  });

  check('outcome named', () => {
    if (runs > 0 && !status.last_outcome) {
      failures.push('receipt records runs but names no last_outcome - a run that reports nothing about itself is the state this contract exists to prevent');
    }
    if (status.last_outcome === 'stopped' && !status.last_stop_reason) {
      failures.push('the last run stopped without naming a reason - a stop must always be a NAMED stop');
    }
  });

  // --- THE REGRESSION GUARD. If the probe succeeded, its output must be in
  // --- the repo. Success with no committed observations means the workflow
  // --- threw the work away again.
  check('successful runs landed their output', () => {
    if (wins > 0 && !fs.existsSync(OBS)) {
      failures.push(`the probe has succeeded ${wins} time(s) (last ${status.last_success_at}) but data/signals/llm_citation_observations.json is not in the repo. The run produced observations and the workflow discarded them - check the staging set in .github/workflows/rotating_refresh.yml.`);
      return;
    }
    if (wins > 0) {
      const obs = JSON.parse(fs.readFileSync(OBS, 'utf8'));
      const runsRecorded = (obs.runs || []).length;
      if (!runsRecorded) {
        failures.push('llm_citation_observations.json exists but records zero runs - the lane is producing an empty shell');
        return;
      }
      const newest = obs.runs[obs.runs.length - 1].run_at;
      if (status.last_success_at && newest < status.last_success_at) {
        failures.push(`receipt says the probe last succeeded at ${status.last_success_at} but the newest committed observation is from ${newest}. At least one successful run's output was discarded.`);
      }
    }
  });

  // --- A lane that has run and never once produced anything. Not red when the
  // --- cause is a named credential stop (Rule 0: a credential-less run is a
  // --- named stop, not a failure) but it must be impossible to miss.
  check('lane has produced an observation', () => {
    if (status.bootstrapped) {
      notices.push('the lane has NEVER produced a committed observation. This receipt is a hand-seeded bootstrap; no run has written it yet. Read _bootstrap_note.');
      return;
    }
    if (runs > 0 && wins === 0) {
      notices.push(`the lane has run ${runs} time(s) and produced ZERO observations, every one stopping for: ${status.last_stop_reason || 'unnamed'}. Nothing is being measured. If the cause is a missing OPENROUTER_API_KEY, set it in repo secrets.`);
    }
    if (wins > 0 && !fs.existsSync(OBS)) return; // already a failure above
  });
}

if (!checks) {
  console.error('CITATION PROBE LANE CONTRACT FAIL: examined zero checks');
  process.exit(1);
}

if (failures.length) {
  console.error('CITATION PROBE LANE CONTRACT FAIL');
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}

notices.forEach((n) => {
  console.log('  !! CITATION PROBE LANE NOTICE: ' + n);
});
const state = status && status.bootstrapped
  ? 'never run'
  : `${(Number(status && status.successes_total) || 0)} success(es) / ${(Number(status && status.runs_total) || 0)} run(s)`;
console.log(`CITATION PROBE LANE CONTRACT PASS: ${checks} checks, ${queryCount} queries ready, lane state: ${state}`);
