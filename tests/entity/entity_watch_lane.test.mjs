// Negative proofs for scripts/validation/entity_watch_lane_contract.js.
//
// Search Readiness k6 asks for an entity-backlink-watch workflow with a
// schedule and a workflow_dispatch whose newest run succeeded inside eight days,
// for all six publications at once. Each test below is a way the lane could stop
// satisfying that while every other check in the repo stayed green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { checkWatchLane, cronFirings, maxGapDays, WORKFLOW, SCRIPT } = require(path.join(ROOT, 'scripts', 'validation', 'entity_watch_lane_contract.js'));

const realWorkflow = fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8');
const realScript = fs.readFileSync(path.join(ROOT, SCRIPT), 'utf8');
const check = (over = {}) => checkWatchLane({ workflowText: realWorkflow, scriptText: realScript, scriptExists: true, ...over });
const says = (problems, re) => assert.ok(problems.some((p) => re.test(p)), `expected a problem matching ${re}\ngot: ${JSON.stringify(problems, null, 2)}`);

test('the lane as it ships passes', () => {
  assert.deepEqual(check(), []);
});

test('zero publications is not a pass: no cron at all fails', () => {
  const w = realWorkflow.replace(/^\s*-\s*cron:.*$/gm, '');
  says(check({ workflowText: w }), /no schedule cron/);
});

test('a single weekly cron fails: one dropped run puts k6 past eight days', () => {
  const w = realWorkflow.replace(/^\s*- cron: '40 5 \* \* 4'.*$/m, '');
  const problems = check({ workflowText: w });
  says(problems, /1 schedule cron/);
});

test('two crons a day apart still fail the gap: the long way round is six days', () => {
  const w = realWorkflow.replace("- cron: '40 5 * * 4'", "- cron: '40 5 * * 2'");
  says(check({ workflowText: w }), /longest gap between firings is 6\.0 days/);
});

test('losing workflow_dispatch fails: k6 requires it and it is the only manual run', () => {
  says(check({ workflowText: realWorkflow.replace(/workflow_dispatch/g, 'repository_dispatch') }), /no workflow_dispatch/);
});

test('dropping --apply fails: the watch would report and heal nothing', () => {
  says(check({ workflowText: realWorkflow.replace(' --apply', '') }), /--apply/);
});

test('dropping --report fails: the self-heal pull request body is built from it', () => {
  says(check({ workflowText: realWorkflow.replace(/ --report \S+/, '') }), /--report/);
});

test('pushing the self-heal straight to main fails', () => {
  const w = realWorkflow.replace('git push -f origin "$branch"', 'git push origin main');
  says(check({ workflowText: w }), /pushes to main/);
});

test('a workflow that never opens a pull request fails', () => {
  says(check({ workflowText: realWorkflow.replace('gh pr create', 'echo skip') }), /never opens a pull request/);
});

test('not running the watch script fails, and a missing script fails', () => {
  says(check({ workflowText: realWorkflow.replace(new RegExp(SCRIPT, 'g'), 'scripts/other.mjs') }), /does not run/);
  says(check({ scriptExists: false }), /missing scripts\/entity_backlink_watch\.mjs/);
});

test('losing the NO_EXTERNAL_PROFILE named stop fails', () => {
  says(check({ scriptText: realScript.replace(/NO_EXTERNAL_PROFILE/g, 'FINE') }), /NO_EXTERNAL_PROFILE/);
});

test('a cron this contract cannot read is a failure, never a silent pass', () => {
  for (const expr of ['40 5 * * MON', '40 5 1 * 1', '40 5 * *', '40 5 * * */2']) {
    const r = cronFirings(expr);
    assert.ok(r.error, `expected "${expr}" to be refused`);
  }
});

test('the gap maths wraps around the week', () => {
  // Monday 05:40 and Thursday 05:40: three days, then four back to Monday.
  const mon = cronFirings('40 5 * * 1').firings;
  const thu = cronFirings('40 5 * * 4').firings;
  assert.equal(maxGapDays([...mon, ...thu]), 4);
  assert.equal(maxGapDays(mon), 7);
});
