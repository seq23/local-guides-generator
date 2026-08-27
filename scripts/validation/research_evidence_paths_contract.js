#!/usr/bin/env node
'use strict';
/**
 * A research file may not cite evidence that is not in the repository.
 *
 * Research files under data/research/ are how this repo proves a claim is sourced
 * rather than invented. They routinely cite other files as their basis -
 * "data/signals/<x>.json refused this axis on measurement", "see
 * data/research/costs/sources.json". Those citations are load-bearing: they are
 * the difference between a recorded measurement and an assertion.
 *
 * On 2026-08-27 the dentistry research file was found citing
 * data/signals/bing_keyword_research_dentistry_2026-08-26.json as the evidence for
 * refusing the entire per-city dental cost axis, including a specific impression
 * count. That file is not in the repository and never has been - `git log --all`
 * for the path returns nothing. The refusal may well have been correct, but for
 * however long it stood, the repo's reason for not building a vertical pointed at
 * a file nobody could open. Nothing caught it, because a dead path inside a JSON
 * string is invisible to every other contract here.
 *
 * That is the specific way a deliberate decision rots into an accident: not by
 * being reversed, but by quietly losing the evidence that made it right, until
 * all that is left is prose asserting itself.
 *
 * This contract reads every JSON file under data/research/, extracts anything
 * shaped like a repo-relative path to a real file type, and requires it to
 * resolve. A path that cannot resolve must be listed, with a reason and a date,
 * in data/research/_unresolved_evidence_paths.json - which is printed in full on
 * every run, so a known gap stays visible instead of going quiet.
 *
 * If this fails, the fix is to restore the cited file, or to correct the citation
 * so it stops claiming something the repo cannot show. It is not to delete the
 * claim, and it is not to widen the ignore list.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RESEARCH_DIR = path.join(ROOT, 'data/research');
const LEDGER = path.join(ROOT, 'data/research/_unresolved_evidence_paths.json');

// Repo-relative paths to file types that actually exist as files here. Deliberately
// anchored to known top-level directories so prose like "50 states" or a URL path
// cannot be mistaken for a citation.
const PATH_RE = /\b(?:data|scripts|docs|templates|assets|functions|goldens|releases)\/[A-Za-z0-9_.\/-]*\.(?:json|js|mjs|cjs|csv|md|html|txt)\b/g;

function walkJson(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJson(full, out);
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

let ledger = { allowed: [] };
if (fs.existsSync(LEDGER)) ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
const allowed = new Map((ledger.allowed || []).map((e) => [e.path, e]));

const files = walkJson(RESEARCH_DIR);
const offenders = [];
let citedTotal = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  for (const cited of new Set(text.match(PATH_RE) || [])) {
    // A file citing its own path is not evidence of anything; skip it.
    if (cited === rel) continue;
    citedTotal++;
    if (fs.existsSync(path.join(ROOT, cited))) continue;
    if (allowed.has(cited)) continue;
    offenders.push({ cited_in: rel, missing_path: cited });
  }
}

// A ledger entry that has been fixed must not linger: it would keep a resolved
// gap on the books and make the list meaningless over time.
const stale = [...allowed.keys()].filter((p) => fs.existsSync(path.join(ROOT, p)));

if (allowed.size) {
  console.log(`RESEARCH EVIDENCE PATHS: ${allowed.size} known-unresolved citation(s) on the ledger:`);
  for (const [p, e] of allowed) console.log(`  ${p} -- ${e.reason || 'no reason recorded'} (since ${e.first_seen || 'unknown'})`);
}

if (stale.length) {
  console.error('RESEARCH EVIDENCE PATHS FAIL: ledger entries that now resolve and must be removed:');
  for (const p of stale) console.error(`  ${p}`);
  console.error('  Delete these from data/research/_unresolved_evidence_paths.json.');
  process.exit(1);
}

if (offenders.length) {
  console.error(`RESEARCH EVIDENCE PATHS FAIL: ${offenders.length} research file(s) cite evidence that is not in the repo.`);
  for (const o of offenders) console.error(`  ${o.cited_in} -> cites missing ${o.missing_path}`);
  console.error('');
  console.error('  A research file is how this repo shows a claim is sourced rather than invented.');
  console.error('  A citation that does not resolve is an assertion wearing a footnote.');
  console.error('  Fix by restoring the cited file, or by correcting the citation so it stops');
  console.error('  claiming something the repo cannot show. Do not widen the ledger to pass.');
  process.exit(1);
}

console.log(`RESEARCH EVIDENCE PATHS PASS: ${citedTotal} cited path(s) across ${files.length} research file(s) all resolve.`);
