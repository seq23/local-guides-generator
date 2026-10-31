'use strict';
//
// entity_watch_lane: the weekly entity-backlink watch is real, runs often
// enough, and cannot quietly stop running.
//
// Why it exists (Search Readiness item k6, 31 Oct 2026). k6 asks for an
// entity-backlink-watch workflow with a schedule and a workflow_dispatch whose
// newest run succeeded within the last eight days, and it asks it of every one
// of the six publications at once: one lane, six fix briefs. The lane landed on
// 30 Oct 2026 (#142) with a single Monday cron, 23 minutes AFTER the Monday
// grid audit that reads it, so the audit always saw a run seven days old - under
// eight by a few hours. GitHub delays and drops scheduled runs under load, so
// one missed Monday would have put the newest run at fourteen days and turned
// k6 red for all six sites, and nothing in the repo would have noticed that the
// schedule, the dispatch or the self-heal PR had been removed either.
//
// What this holds:
//   - the workflow exists, parses, and keeps workflow_dispatch
//   - at least two schedule crons, numeric and parseable; zero fails
//   - the longest gap between consecutive firings is at most four days, so a
//     single dropped run still leaves the newest run inside k6's eight
//   - it runs scripts/entity_backlink_watch.mjs (which exists) with --apply and
//     --report, so the self-heal and the report are both live
//   - the self-heal goes through a pull request: never a push to main
//   - the watch exits 0 on a named stop, so a publication with no external
//     profile is said, not turned into a red lane that hides the next finding
//
// Negative proofs: tests/entity/entity_watch_lane.test.mjs runs each of these
// against a hostile fixture and requires the failure.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = '.github/workflows/entity_backlink_watch.yml';
const SCRIPT = 'scripts/entity_backlink_watch.mjs';
const MAX_GAP_DAYS = 4;
const MINUTES_PER_WEEK = 7 * 24 * 60;

// Every firing of a numeric `cron: 'm h * * d'` line, as minutes into the week
// (Monday 00:00 = 0). Day-of-month and month must stay '*': a cron that only
// fires on the 1st is not a weekly watch.
function cronFirings(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) return { error: `cron "${expr}" does not have five fields` };
  const [min, hour, dom, month, dow] = parts;
  if (dom !== '*' || month !== '*') return { error: `cron "${expr}" is not weekly (day-of-month ${dom}, month ${month})` };
  const nums = (field, max) => {
    if (field === '*') return Array.from({ length: max + 1 }, (_, i) => i);
    if (!/^\d+(,\d+)*$/.test(field)) return null;
    const out = field.split(',').map(Number);
    return out.every((n) => n >= 0 && n <= max) ? out : null;
  };
  const mins = nums(min, 59);
  const hours = nums(hour, 23);
  const dows = nums(dow, 7);
  if (!mins || !hours || !dows) return { error: `cron "${expr}" has a field this contract cannot read; use plain numbers or commas` };
  const out = new Set();
  for (const d of dows) for (const h of hours) for (const m of mins) {
    // cron day-of-week: 0 and 7 are both Sunday; the week here starts on Monday.
    const dayFromMonday = d === 0 || d === 7 ? 6 : d - 1;
    out.add(dayFromMonday * 1440 + h * 60 + m);
  }
  return { firings: [...out] };
}

function maxGapDays(firings) {
  const sorted = [...firings].sort((a, b) => a - b);
  let worst = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + MINUTES_PER_WEEK;
    worst = Math.max(worst, next - sorted[i]);
  }
  return worst / 1440;
}

/** Pure check over the lane's two texts. Returns the list of problems. */
function checkWatchLane({ workflowText, scriptText, scriptExists = true }) {
  const problems = [];
  const w = String(workflowText || '');
  if (!w.trim()) return [`${WORKFLOW} is missing or empty`];

  if (!/\bworkflow_dispatch\b/.test(w)) problems.push(`${WORKFLOW} has no workflow_dispatch (k6 requires it, and it is the only way to run the watch by hand)`);

  const crons = [...w.matchAll(/^\s*-\s*cron:\s*['"]?([^'"#\n]+?)['"]?\s*(?:#.*)?$/gm)].map((m) => m[1].trim());
  if (!crons.length) {
    problems.push(`${WORKFLOW} has no schedule cron. A watch nothing triggers has checked nothing.`);
  } else {
    const firings = [];
    for (const c of crons) {
      const r = cronFirings(c);
      if (r.error) problems.push(`${WORKFLOW}: ${r.error}`);
      else firings.push(...r.firings);
    }
    if (crons.length < 2) problems.push(`${WORKFLOW} has ${crons.length} schedule cron. Two firings are the margin that survives one run GitHub drops; k6 goes red for all six publications on a single miss.`);
    if (firings.length) {
      const gap = maxGapDays(firings);
      if (gap > MAX_GAP_DAYS) problems.push(`${WORKFLOW}: the longest gap between firings is ${gap.toFixed(1)} days; at most ${MAX_GAP_DAYS} keeps the newest run inside Search Readiness k6's eight days after one dropped run`);
    }
  }

  if (!w.includes(SCRIPT)) problems.push(`${WORKFLOW} does not run ${SCRIPT}`);
  if (!scriptExists) problems.push(`missing ${SCRIPT}, which the workflow runs`);
  if (!/--apply\b/.test(w)) problems.push(`${WORKFLOW} does not pass --apply: the watch would report dead and promotable profiles and heal nothing`);
  if (!/--report\b/.test(w)) problems.push(`${WORKFLOW} does not pass --report: the self-heal pull request body is built from that report`);
  if (/git\s+push\s+(-\S+\s+)*origin\s+(main|HEAD:main|"?\$\{\{\s*github\.event\.repository\.default_branch)/.test(w)) problems.push(`${WORKFLOW} pushes to main; a self-heal of data/entity goes through a pull request so the merge gate sees it`);
  if (!/gh pr create/.test(w)) problems.push(`${WORKFLOW} never opens a pull request, so a self-heal of data/entity could never land`);

  const s = String(scriptText || '');
  if (s.trim()) {
    if (!s.includes('NO_EXTERNAL_PROFILE')) problems.push(`${SCRIPT} no longer raises NO_EXTERNAL_PROFILE; a publication with no external profile would pass silently`);
    if (/process\.exit\(1\)[\s\S]{0,400}NAMED STOP/.test(s) || /\bstop\b[\s\S]{0,80}process\.exit\(1\)/.test(s)) problems.push(`${SCRIPT} exits 1 on a named stop; a site with no external profile would turn the lane red every week and hide the next real failure`);
  }
  return problems;
}

function main() {
  const workflowPath = path.join(ROOT, WORKFLOW);
  const scriptPath = path.join(ROOT, SCRIPT);
  const problems = checkWatchLane({
    workflowText: fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '',
    scriptText: fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '',
    scriptExists: fs.existsSync(scriptPath),
  });
  if (problems.length) {
    console.error('ENTITY WATCH LANE CONTRACT FAIL');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log('ENTITY WATCH LANE CONTRACT PASS: the entity-backlink watch has a dispatch, two firings at most 4 days apart, --apply/--report, a pull-request self-heal and a named stop that exits 0.');
}

module.exports = { checkWatchLane, cronFirings, maxGapDays, WORKFLOW, SCRIPT, MAX_GAP_DAYS };

if (require.main === module) main();
