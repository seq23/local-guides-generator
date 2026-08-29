#!/usr/bin/env node
/**
 * Contract: the cross-repo candidate seam must never silently ingest nothing.
 *
 * Why this exists
 * ---------------
 * local-guides-citation-velocity produces promotion candidates for the five
 * guide properties this repo generates (uscisexam, dentistryguides,
 * theaccidentguides, neuroevalguides, hormonesivhair). The scheduled Ingestion
 * Sync cron runs scripts/reference/pull_velocity_candidates.js to pull them.
 *
 * resolveSource() preferred data/reference/promotion_candidates.source.json --
 * a stub committed with `candidates: []` -- purely because the file EXISTS. It
 * always existed, so it always won, and the cron logged
 * "wrote 0 incoming candidate(s)" on every run since April. That is
 * indistinguishable from a genuinely empty upstream, so nobody was told the
 * seam was dead. data/reference/last_pull_manifest.json still records the
 * evidence: a real CI run that resolved source_file to the stub with
 * accepted_count 0.
 *
 * This validator asserts the two properties that keep the seam honest:
 *   1. an EMPTY stub must not be preferred over a real source, and
 *   2. an unreachable source must stop loudly rather than exit 0 having done
 *      nothing (Rule 0).
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const PULLER = path.join(ROOT, "scripts/reference/pull_velocity_candidates.js");

const failures = [];
let checks = 0;

if (!fs.existsSync(PULLER)) {
  console.error(
    JSON.stringify(
      {
        validator: "velocity_candidate_seam_contract",
        status: "FAIL",
        hard_failures: 1,
        detail:
          "scripts/reference/pull_velocity_candidates.js is missing; the cross-repo candidate seam cannot be verified.",
      },
      null,
      2
    )
  );
  process.exit(1);
}

const src = fs.readFileSync(PULLER, "utf8");

checks += 1;
if (!/stubHasCandidates\s*\(/.test(src)) {
  failures.push(
    "pull_velocity_candidates.js no longer gates the committed stub on it actually " +
      "carrying candidates. An empty stub will win source resolution again and the " +
      "Ingestion Sync cron will silently ingest nothing."
  );
}

checks += 1;
if (/if\s*\(\s*fs\.existsSync\(DEFAULT_REPO_LOCAL_FILE\)\s*\)/.test(src)) {
  failures.push(
    "pull_velocity_candidates.js selects the committed stub on mere existence " +
      "(fs.existsSync(DEFAULT_REPO_LOCAL_FILE)). That is the exact resolution order " +
      "that made the daily cross-repo sync a permanent no-op."
  );
}

checks += 1;
if (!/No promotion candidates source reachable/.test(src)) {
  failures.push(
    "pull_velocity_candidates.js no longer carries the named stop for an unreachable " +
      "source. Rule 0: this stage must not exit 0 having consulted no upstream."
  );
}

checks += 1;
if (/"Documents"/.test(src) && !/path\.join\(HOME, "GitHub"/.test(src)) {
  failures.push(
    "the local upstream fallback points only at ~/Documents/GitHub, which does not " +
      "exist on the maintainer's machine; a manual run will fall through to the stub."
  );
}

// Rule 0 for this validator itself: never pass having examined nothing.
if (checks === 0) {
  failures.push("validator examined zero contract properties and cannot vouch for the seam.");
}

const result = {
  validator: "velocity_candidate_seam_contract",
  status: failures.length ? "FAIL" : "PASS",
  hard_failures: failures.length,
  checks_performed: checks,
  failures,
};
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
