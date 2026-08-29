#!/usr/bin/env node
/**
 * Phase 6 redo helper: validate reports/phase6_* outputs exist and are non-empty.
 *
 * That sentence was the ENTIRE file. One comment line, no code. It was
 * registered in the hard_fail tier of data/contracts/validator_tiering_policy.json
 * and wired to `npm run validate:phase6:recommendations`, and every run of the
 * tier reported it as `"status": "pass"` -- so one of the repo's 34 passing
 * hard-fail validators was a comment. A validator that hardcodes PASS, in the
 * most literal form available: a file that cannot fail because it does nothing.
 *
 * This implements what that line said it did, and hard-fails on examining
 * nothing.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');

// The three artifacts the phase 6 lane produces. Named explicitly rather than
// globbed, so a report that stops being written is a failure instead of simply
// vanishing from the set that gets checked -- a glob over a directory can only
// validate what is there, never notice what is missing.
const REQUIRED = [
  {
    file: 'phase6_pdf_recommendations.summary.json',
    describe: 'PDF recommendation normalisation summary',
    check(json) {
      const problems = [];
      for (const key of ['pdf_count', 'recommendation_count', 'vertical_count']) {
        const v = json[key];
        if (!Number.isFinite(v)) problems.push(`${key} is not a number`);
        else if (v <= 0) problems.push(`${key} is ${v}; the lane summarised nothing`);
      }
      if (!json.generated_at) problems.push('generated_at is missing, so the summary cannot be dated');
      return problems;
    },
  },
  {
    file: 'phase6_layer_plan.json',
    describe: 'layer plan',
    check(json) {
      const buckets = Array.isArray(json.buckets) ? json.buckets : null;
      if (!buckets) return ['buckets is not an array'];
      if (!buckets.length) return ['buckets is empty; the plan covers no vertical'];
      const problems = [];
      buckets.forEach((b, i) => {
        if (!b || !b.vertical) problems.push(`buckets[${i}] has no vertical`);
        if (!b || !b.layer_bucket) problems.push(`buckets[${i}] has no layer_bucket`);
        if (!b || !Number.isFinite(b.count) || b.count <= 0) {
          problems.push(`buckets[${i}] (${(b && b.vertical) || '?'}) has a non-positive count`);
        }
      });
      return problems;
    },
  },
  {
    file: 'phase6_recommendation_batches.json',
    describe: 'recommendation batches',
    check(json) {
      const batches = Array.isArray(json) ? json : Array.isArray(json.batches) ? json.batches : null;
      if (!batches) return ['batches payload is not an array'];
      if (!batches.length) return ['batches is empty; there is nothing to recommend'];
      const problems = [];
      batches.forEach((b, i) => {
        if (!b || !b.vertical) problems.push(`batches[${i}] has no vertical`);
        const urls = b && Array.isArray(b.urls) ? b.urls : null;
        if (!urls || !urls.length) {
          problems.push(`batches[${i}] (${(b && b.vertical) || '?'}) carries no urls`);
        } else if (Number.isFinite(b.count) && b.count !== urls.length) {
          // A count that no longer follows from the list it summarises.
          problems.push(
            `batches[${i}] (${b.vertical}) declares count ${b.count} but lists ${urls.length} urls`
          );
        }
      });
      return problems;
    },
  },
];

const failures = [];
let examined = 0;

for (const spec of REQUIRED) {
  const abs = path.join(REPORT_DIR, spec.file);
  if (!fs.existsSync(abs)) {
    failures.push(`missing reports/${spec.file} (${spec.describe})`);
    continue;
  }
  const raw = fs.readFileSync(abs, 'utf8');
  if (!raw.trim()) {
    failures.push(`reports/${spec.file} is empty`);
    continue;
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    failures.push(`reports/${spec.file} is not valid JSON: ${err.message}`);
    continue;
  }
  examined += 1;
  for (const problem of spec.check(json)) {
    failures.push(`reports/${spec.file}: ${problem}`);
  }
}

// Rule 0: never vouch for phase 6 having read none of its outputs.
if (examined === 0) {
  failures.push(
    `examined 0 of ${REQUIRED.length} phase 6 outputs under reports/ and cannot vouch for the lane.`
  );
}

if (failures.length) {
  console.error('PHASE 6 RECOMMENDATION OUTPUTS FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `✅ PHASE 6 RECOMMENDATION OUTPUTS PASS (${examined} of ${REQUIRED.length} reports checked, all non-empty and internally consistent)`
);
