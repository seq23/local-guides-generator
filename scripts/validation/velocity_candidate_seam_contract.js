#!/usr/bin/env node
/**
 * Contract: the cross-repo candidate seam must actually move candidates, and
 * must never exit 0 having quietly moved none.
 *
 * Why this exists
 * ---------------
 * local-guides-citation-velocity produces promotion candidates for the five
 * guide properties this repo generates (uscisexam, dentistryguides,
 * theaccidentguides, neuroevalguides, hormonesivhair). The scheduled Ingestion
 * Sync cron runs the three scripts in scripts/reference/ to pull them, generate
 * draft guides, and guard the visible surfaces. Every one of those three stages
 * had a way of reporting success while doing nothing:
 *
 *   1. resolveSource() preferred the committed stub
 *      data/reference/promotion_candidates.source.json purely because the file
 *      EXISTS. It is committed with `candidates: []`, so it always existed,
 *      always won, and the cron logged "wrote 0 incoming candidate(s)" from
 *      April onward -- indistinguishable from a genuinely empty upstream.
 *   2. The puller then marked every pulled id processed BEFORE anything was
 *      generated from it, so whatever the next stage skipped was swallowed
 *      permanently. The registry still shows 86 processed ids against 25 pages.
 *   3. generate_from_candidates.js kept its own list of vertical names that had
 *      no link to velocity's. Velocity emits `personal_injury` and `uscis`;
 *      this repo knew `personal-injury` and `uscis-medical`. All 9 candidates
 *      this repo had never ingested were personal_injury, so even a fully
 *      repaired source resolution produced exactly 0 guides.
 *
 * The first version of this validator only grepped the source of the puller. A
 * grep cannot tell whether the seam MOVES anything. This one runs the real
 * scripts against synthetic candidates in a throwaway directory and asserts the
 * output changes with the input -- the only evidence that a stage is not inert.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const PULLER = path.join(ROOT, 'scripts/reference/pull_velocity_candidates.js');
const GENERATOR = path.join(ROOT, 'scripts/reference/generate_from_candidates.js');
const ALIASES = path.join(ROOT, 'data/contracts/velocity_vertical_aliases.json');
const CADENCE = path.join(ROOT, 'data/cadence/policy.json');

const failures = [];
let checks = 0;
const notes = [];

function fail(msg) {
  failures.push(msg);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

for (const [label, file] of [
  ['pull_velocity_candidates.js', PULLER],
  ['generate_from_candidates.js', GENERATOR],
  ['velocity_vertical_aliases.json', ALIASES],
  ['cadence/policy.json', CADENCE],
]) {
  checks += 1;
  if (!fs.existsSync(file)) {
    fail(`${label} is missing; the cross-repo candidate seam cannot be verified.`);
  }
}

if (failures.length) {
  console.error(JSON.stringify(
    {
      validator: 'velocity_candidate_seam_contract',
      status: 'FAIL',
      hard_failures: failures.length,
      checks_performed: checks,
      failures,
    },
    null,
    2
  ));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// A throwaway repo-shaped sandbox. The seam scripts are cwd-relative, so give
// them a cwd with only the directories they touch. Nothing here can reach the
// real tree.
// ---------------------------------------------------------------------------
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-contract-'));
const cleanup = () => { try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* best effort */ } };

function sandboxPath(...p) { return path.join(sandbox, ...p); }

function setupSandbox(policy) {
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(sandboxPath('data/reference'), { recursive: true });
  fs.mkdirSync(sandboxPath('data/contracts'), { recursive: true });
  fs.mkdirSync(sandboxPath('data/cadence'), { recursive: true });
  fs.copyFileSync(ALIASES, sandboxPath('data/contracts/velocity_vertical_aliases.json'));
  fs.writeFileSync(sandboxPath('data/cadence/policy.json'), JSON.stringify(policy, null, 2));
  // Empty committed stub, exactly as it exists in the real tree: this is the
  // file that used to shadow every real source.
  fs.writeFileSync(
    sandboxPath('data/reference/promotion_candidates.source.json'),
    JSON.stringify({ contract_version: '1.0', source_repo: 'stub', candidates: [] }, null, 2)
  );
  fs.writeFileSync(
    sandboxPath('data/reference/reference_registry.json'),
    JSON.stringify({ processed_ids: [], pages: [], promoted_ids: [] }, null, 2)
  );
  // Every page-set folder the alias contract can route to must exist, or the
  // generator skips with missing_folder and we would be measuring the sandbox
  // rather than the seam.
  for (const folder of new Set(Object.values(readJson(ALIASES).aliases))) {
    const dir = FOLDER_BY_VERTICAL[folder];
    if (dir) fs.mkdirSync(sandboxPath(dir), { recursive: true });
  }
}

// Mirrors the VERTICALS table in generate_from_candidates.js. Kept in step by
// the folder-reachability check below, which fails if any alias target has no
// folder in the real tree.
const FOLDER_BY_VERTICAL = {
  dentistry: 'data/page_sets/examples/dentistry_global_pages',
  neuro: 'data/page_sets/examples/neuro_global_pages',
  'uscis-medical': 'data/page_sets/examples/uscis_medical_global_pages',
  trt: 'data/page_sets/examples/trt_global_pages',
  'personal-injury': 'data/page_sets/examples/pi_global_pages',
};

function run(script, { env = {}, cwd = sandbox } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env, GITHUB_STEP_SUMMARY: '', GITHUB_OUTPUT: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout ? String(err.stdout) : '',
      stderr: err.stderr ? String(err.stderr) : '',
    };
  }
}

function synthetic(items) {
  const file = sandboxPath('synthetic_candidates.json');
  fs.writeFileSync(file, JSON.stringify({ source_repo: 'synthetic', items }, null, 2));
  return file;
}

const BASE_POLICY = { refresh_window_days: 91, new_pages_per_week: 3, refresh_capacity_per_week: 15 };

try {
  // -------------------------------------------------------------------------
  // 1. Every vertical name velocity actually emits must route to a real folder.
  //    This is the link that did not exist: two components each keeping their
  //    own list.
  // -------------------------------------------------------------------------
  const aliasContract = readJson(ALIASES);
  for (const upstream of aliasContract.upstream_verticals) {
    checks += 1;
    const target = aliasContract.aliases[upstream];
    if (!target) {
      fail(
        `velocity emits vertical "${upstream}" and data/contracts/velocity_vertical_aliases.json ` +
        'does not map it. Candidates in that vertical will be skipped as unsupported.'
      );
      continue;
    }
    const folder = FOLDER_BY_VERTICAL[target];
    if (!folder) {
      fail(`alias "${upstream}" -> "${target}" names a vertical the generator has no folder for.`);
    } else if (!fs.existsSync(path.join(ROOT, folder))) {
      fail(`alias "${upstream}" -> "${target}" points at ${folder}, which does not exist.`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. TRACE: feed the seam known synthetic candidates in EVERY upstream
  //    vertical and prove guide files come out. A stage producing the same
  //    output regardless of input is inert; this is the check a source grep
  //    could never make.
  // -------------------------------------------------------------------------
  setupSandbox(BASE_POLICY);
  const upstreams = aliasContract.upstream_verticals;
  const items = upstreams.map((v, i) => ({
    id: `synthetic-${v}-${i}`,
    vertical: v,
    cluster: `synthetic-cluster-${v}`,
    query: `synthetic probe query for ${v}`,
    source_bucket: 'synthetic',
    promotion_status: 'candidate',
  }));

  checks += 1;
  const pull = run(PULLER, { env: { REPO2_PROMOTION_CANDIDATES_FILE: synthetic(items) } });
  if (pull.code !== 0) {
    fail(`the puller exited ${pull.code} on a well-formed synthetic source: ${pull.stderr.trim()}`);
  }
  const incoming = fs.existsSync(sandboxPath('data/reference/incoming_candidates.json'))
    ? readJson(sandboxPath('data/reference/incoming_candidates.json'))
    : [];
  checks += 1;
  if (incoming.length !== items.length) {
    fail(
      `the puller accepted ${incoming.length} of ${items.length} synthetic candidates. The empty ` +
      'committed stub is shadowing the configured source again, or validCandidate() rejects ' +
      "velocity's payload shape."
    );
  }

  // The whole point: the seam must not stop at the queue.
  checks += 1;
  const gen = run(GENERATOR, { env: { MAX_NEW_GUIDES_PER_RUN: String(items.length) } });
  const created = [];
  for (const [vertical, folder] of Object.entries(FOLDER_BY_VERTICAL)) {
    const dir = sandboxPath(folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) created.push(`${vertical}/${f}`);
  }
  if (created.length !== items.length) {
    fail(
      `the seam moved ${incoming.length} candidates into the queue but produced ${created.length} ` +
      `guide file(s) from them, expected ${items.length}. Generator output:\n${gen.stdout}${gen.stderr}`
    );
  }
  const verticalsCovered = new Set(created.map((c) => c.split('/')[0]));
  checks += 1;
  if (verticalsCovered.size !== new Set(upstreams.map((u) => aliasContract.aliases[u])).size) {
    fail(
      `guides were produced for only ${[...verticalsCovered].join(', ')}. Every vertical velocity ` +
      'emits must reach a page-set folder.'
    );
  }
  notes.push(`traced ${items.length} synthetic candidates -> ${created.length} guide files across ${verticalsCovered.size} verticals`);

  // -------------------------------------------------------------------------
  // 3. A candidate the generator could NOT use must stay pending. The puller
  //    used to mark ids processed at pull time, so anything skipped downstream
  //    was consumed by a stage that produced nothing from it and could never be
  //    retried.
  // -------------------------------------------------------------------------
  setupSandbox(BASE_POLICY);
  const orphan = [{
    id: 'synthetic-unmapped-1',
    vertical: 'a_vertical_that_does_not_exist',
    cluster: 'synthetic-orphan',
    query: 'synthetic orphan query',
  }];
  checks += 1;
  run(PULLER, { env: { REPO2_PROMOTION_CANDIDATES_FILE: synthetic(orphan) } });
  const afterPull = readJson(sandboxPath('data/reference/reference_registry.json'));
  if ((afterPull.processed_ids || []).includes('synthetic-unmapped-1')) {
    fail(
      'the puller marked a candidate processed at PULL time. Anything the generator then skips ' +
      'is swallowed permanently: it will never be pulled again and no guide will ever exist for ' +
      'it. processed_ids must mean "a guide was generated", written only by the generator.'
    );
  }

  // -------------------------------------------------------------------------
  // 4. Rule 0 for the generator: candidates in, nothing out, must not exit 0.
  // -------------------------------------------------------------------------
  checks += 1;
  const orphanGen = run(GENERATOR);
  if (orphanGen.code === 0) {
    fail(
      'generate_from_candidates.js exited 0 having skipped every candidate it was handed. That is ' +
      'the exact silent failure that hid the personal_injury vertical mismatch for months.'
    );
  }

  // -------------------------------------------------------------------------
  // 5. Rule 0 for the puller: an unreachable source must produce a NAMED stop
  //    that names the credential -- exit 1 for a human, exit 0 only under the
  //    scheduled lane's explicit acknowledgement, and never a silent success.
  // -------------------------------------------------------------------------
  setupSandbox(BASE_POLICY);
  checks += 1;
  const manual = run(PULLER, { env: { HOME: sandbox } });
  if (manual.code === 0) {
    fail(
      'with no source reachable and no acknowledgement, the puller exited 0. A manual run must ' +
      'not report success having consulted no upstream.'
    );
  }
  const manualOut = manual.stdout + manual.stderr;
  checks += 1;
  for (const credential of ['REPO2_PROMOTION_CANDIDATES_URL', 'REPO2_PROMOTION_CANDIDATES_FILE']) {
    if (!manualOut.includes(credential)) {
      fail(`the unreachable-source stop does not name ${credential}, so it does not say how to fix it.`);
    }
  }
  checks += 1;
  if (!/NAMED STOP/.test(manualOut)) {
    fail('the unreachable-source stop is not labelled NAMED STOP, so it cannot be recognised as one.');
  }

  setupSandbox(BASE_POLICY);
  checks += 1;
  const scheduled = run(PULLER, { env: { HOME: sandbox, INGESTION_SYNC_ALLOW_NAMED_STOP: '1' } });
  if (scheduled.code !== 0) {
    fail(
      `the scheduled lane's acknowledged named stop exited ${scheduled.code}. It is meant to exit 0 ` +
      'so an unwired credential does not leave a permanently red cron that trains people to ignore ' +
      "this repo's red."
    );
  }
  checks += 1;
  const statusFile = sandboxPath('data/reference/ingestion_sync_status.json');
  if (!fs.existsSync(statusFile)) {
    fail('a named stop left no receipt at data/reference/ingestion_sync_status.json, so an exit-0 stop is indistinguishable from an exit-0 success.');
  } else {
    const status = readJson(statusFile);
    if (status.state !== 'named_stop') {
      fail(`the named-stop receipt records state="${status.state}", expected "named_stop".`);
    }
    if (!Array.isArray(status.missing_credential) || !status.missing_credential.length) {
      fail('the named-stop receipt does not record which credential is missing.');
    }
  }

  // -------------------------------------------------------------------------
  // 6. The per-run guide cap is a PUBLISHING RATE and must follow the declared
  //    one. Every generated guide becomes a /guides/ route and so a sitemap URL,
  //    which scripts/cadence_gate.js caps at new_pages_per_week. The cap was
  //    hardcoded to 25 on a lane the cron runs daily: 175 a week against a
  //    declared 5. Prove it is derived, by changing the policy and watching the
  //    cap move.
  // -------------------------------------------------------------------------
  for (const rate of [1, 2]) {
    setupSandbox({ ...BASE_POLICY, new_pages_per_week: rate });
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `synthetic-rate-${rate}-${i}`,
      vertical: 'dentistry',
      cluster: `synthetic-rate-cluster-${i}`,
      query: `synthetic rate probe ${i}`,
    }));
    run(PULLER, { env: { REPO2_PROMOTION_CANDIDATES_FILE: synthetic(many) } });
    run(GENERATOR);
    const dir = sandboxPath(FOLDER_BY_VERTICAL.dentistry);
    const n = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
    checks += 1;
    if (n !== rate) {
      fail(
        `with cadence policy new_pages_per_week=${rate}, the generator created ${n} guides from 6 ` +
        'pending candidates, expected ' + rate + '. The per-run cap is not derived from the ' +
        'declared publishing rate, so the two can drift apart silently and the cadence gate will ' +
        'block main.'
      );
    }
  }
  notes.push('per-run guide cap tracks data/cadence/policy.json new_pages_per_week (traced at 1 and 2)');

  // -------------------------------------------------------------------------
  // 7. The scheduled workflow must actually keep what it generates. It declared
  //    contents: write from creation and never committed anything, so the whole
  //    lane ingested into a destroyed runner.
  // -------------------------------------------------------------------------
  checks += 1;
  const wf = path.join(ROOT, '.github/workflows/ingestion_sync.yml');
  if (!fs.existsSync(wf)) {
    fail('.github/workflows/ingestion_sync.yml is missing; the seam has no scheduled lane.');
  } else {
    const y = fs.readFileSync(wf, 'utf8');
    const persists = /create-pull-request/.test(y) || (/git\s+commit/.test(y) && /git\s+push/.test(y));
    if (!persists) {
      fail(
        'ingestion_sync.yml generates draft guides and never persists them -- no PR, no commit. The ' +
        'runner is destroyed at the end of the job, so every candidate it ingests is thrown away ' +
        'and the lane is inert however well the seam itself works.'
      );
    }
    checks += 1;
    if (!/INGESTION_SYNC_ALLOW_NAMED_STOP/.test(y)) {
      fail(
        'ingestion_sync.yml does not acknowledge the named stop, so an unwired cross-repo ' +
        'credential leaves a permanently red daily cron.'
      );
    }
  }
} finally {
  cleanup();
}

// Rule 0 for this validator itself: never pass having examined nothing.
if (checks === 0) {
  failures.push('validator examined zero contract properties and cannot vouch for the seam.');
}

const result = {
  validator: 'velocity_candidate_seam_contract',
  status: failures.length ? 'FAIL' : 'PASS',
  hard_failures: failures.length,
  checks_performed: checks,
  notes,
  failures,
};
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
