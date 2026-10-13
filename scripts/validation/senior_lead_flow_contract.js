#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: the senior lead backend's behaviour tests (tests/senior/*.test.mjs, run on
 * node:test over a real SQLite copy of the D1 migration) all pass, and every REQUIRED
 * test below exists and ran. A required test that is renamed, deleted or skipped fails
 * this contract; zero tests run fails it too.
 */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REQUIRED = [
  'teaser body contains no PII',
  'open round sends only to fitting facilities',
  'accepts cap at five and later clicks are late',
  'flat payment releases once and a payment after the cap is refunded and late',
  'webhook signature rejects a bad signature',
  'seat checkout completion sets a six-month cancel_at and records seat events',
  'seat-active routing sends only to the seat holder',
  'seat pass reaches the open round',
  'seat 72h timeout reaches the open round',
  'seat working then day-30 not placed reaches the open round',
  'off-ramp leads are stored unsellable and still emailed',
  'guide attribution is kept on the lead',
  'honeypot, consent and contact are enforced',
  'follow-up move-in emails the owner with the invoice line',
  'every outgoing email carries the footer',
  'matcher: tiers, radius and the full list',
  'funnel refuses without the token and returns no PII'
];

function fail(msg) { console.error(`SENIOR LEAD FLOW FAIL: ${msg}`); process.exit(1); }

const dir = path.join(ROOT, 'tests/senior');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join('tests/senior', f)) : [];
if (!files.length) fail('no tests/senior/*.test.mjs files');
const r = cp.spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
const out = `${r.stdout || ''}`;
const passed = new Set();
const failed = [];
for (const line of out.split('\n')) {
  let m = line.match(/^\s*ok \d+ - (.+?)(\s+#\s*(SKIP|TODO).*)?$/);
  if (m && !m[2]) passed.add(m[1].trim());
  m = line.match(/^\s*not ok \d+ - (.+)$/);
  if (m) failed.push(m[1].trim());
}
if (!passed.size && !failed.length) fail(`zero tests ran (exit ${r.status}).\n${(r.stderr || '').slice(0, 2000)}${out.slice(0, 2000)}`);
if (failed.length) fail(`${failed.length} failing: ${failed.join(' | ')}\n${out.split('\n').filter((l) => /not ok|Error|expected|actual|message/.test(l)).slice(0, 40).join('\n')}`);
const missing = REQUIRED.filter((n) => !passed.has(n));
if (missing.length) fail(`required tests missing or skipped: ${missing.join(' | ')}`);
if (r.status !== 0) fail(`node --test exited ${r.status}`);
console.log(`SENIOR LEAD FLOW PASS (${passed.size} tests passed, ${REQUIRED.length} required present)`);
