#!/usr/bin/env node
/**
 * ZERO-PAID LLM CONTRACT (owner policy 11 Oct 2026: "nothing should be paid ...
 * cut the probes and make them free"). Registered in
 * data/contracts/site_hygiene_registry.json (validators.zero_paid_llm and the
 * zero_paid_llm block). The rules live in scripts/lib/zero_paid_llm_check.js:
 *   (a) no scheduled workflow reaches a model except through the free router;
 *   (b) config/llm_routing.json holds only $0 models and max_cost_usd 0
 *       (a stale pricing snapshot is a warning, not a blocker);
 *   (c) probe workflows are dispatch-only behind confirm_paid.
 * Every run also replays the hostile fixtures (selfTest): if any one of them
 * stops being caught, this contract fails - the negative proof never goes stale.
 */
const path = require('path');
const { check, selfTest, repoIo } = require('../lib/zero_paid_llm_check.js');

const ROOT = path.resolve(__dirname, '..', '..');
const reg = require(path.join(ROOT, 'data/contracts/site_hygiene_registry.json')).zero_paid_llm;
if (!reg) { console.error('ZERO-PAID LLM CONTRACT FAIL: zero_paid_llm block missing from data/contracts/site_hygiene_registry.json'); process.exit(1); }
const { failures, warnings, stats } = check(repoIo(ROOT), { reg });
const proof = selfTest(ROOT, reg);
for (const m of proof.missed) failures.push(`negative proof no longer caught: ${m}`);
warnings.forEach((w) => console.log(`  !! ZERO-PAID LLM WARNING: ${w}`));
if (failures.length) {
  console.error('ZERO-PAID LLM CONTRACT FAIL');
  failures.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`ZERO-PAID LLM CONTRACT PASS: ${stats.scheduled_workflows} scheduled workflow(s) reach no paid model, ${stats.probe_workflows} probe workflow(s) dispatch-only behind confirm_paid, ${stats.models} $0 model(s), ${stats.scripts_scanned} scripts scanned, ${proof.cases} negative proofs caught`);
