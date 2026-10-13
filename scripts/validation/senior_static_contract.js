#!/usr/bin/env node
'use strict';
/**
 * Hard-fail: static rules over the senior lead backend source
 * (functions/api/senior-*.js, lib/senior/*.mjs, assets/senior-*.js):
 *   1. every env name the code reads is declared in lib/senior/env.mjs (with its why),
 *      none is a reserved name, and EMAIL_FROM is never read (the sender is pinned);
 *   2. no paid model call: no model-provider endpoint, SDK or AI binding anywhere;
 *   3. Resend is called from lib/senior/email.mjs only, so every email passes composeEmail;
 *   4. no Spry Labs / West Peek name or domain (same rule as footer_contract.js);
 *   5. the 15-minute tick is wired: workflow, endpoint and token header agree;
 *   6. the D1 migration creates every table the evidence trail needs.
 * Every run replays hostile fixtures through the same check (negative proof).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const PAID_MODEL = [/openrouter\.ai/i, /api\.anthropic\.com/i, /api\.openai\.com/i, /generativelanguage\.googleapis\.com/i, /@anthropic-ai\//, /from ['"]openai['"]/, /env\.AI\b/, /api\.mistral\.ai/i, /api\.cohere\.(ai|com)/i, /free_llm_router/];
const FORBIDDEN_NAMES = [/spry\s*labs/i, /spryvc\.com/i, /joinwestpeek\.com/i, /westpeek\.ventures/i];
const TABLES = ['leads', 'teasers', 'accepts', 'seat_events', 'followups', 'recipients', 'sends'];

function declared(envSrc) {
  const block = envSrc.slice(envSrc.indexOf('SENIOR_ENV = {'), envSrc.indexOf('};', envSrc.indexOf('SENIOR_ENV = {')));
  const names = [...block.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]);
  const resBlock = envSrc.slice(envSrc.indexOf('RESERVED_ENV_NAMES'));
  const reserved = [...resBlock.matchAll(/'([A-Z][A-Z0-9_]*)'/g)].map((m) => m[1]);
  return { names, reserved };
}

/** files: { relPath: source }. Returns a list of failures. */
function check(files, envSrc) {
  const f = [];
  const { names, reserved } = declared(envSrc);
  if (names.length < 5) f.push('lib/senior/env.mjs declares fewer than 5 names; the declaration block was not found');
  if (reserved.length < 5) f.push('lib/senior/env.mjs RESERVED_ENV_NAMES list not found');
  for (const n of names) if (reserved.includes(n)) f.push(`declared env name ${n} is reserved`);
  for (const [rel, src] of Object.entries(files)) {
    for (const m of src.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)) {
      const n = m[1];
      if (n === 'EMAIL_FROM') f.push(`${rel} reads env.EMAIL_FROM; the sender is pinned in lib/senior/email.mjs`);
      else if (reserved.includes(n)) f.push(`${rel} reads reserved env name ${n}`);
      else if (!names.includes(n)) f.push(`${rel} reads env.${n}, which lib/senior/env.mjs does not declare`);
    }
    for (const re of PAID_MODEL) if (re.test(src)) f.push(`${rel} reaches a model provider (${re})`);
    for (const re of FORBIDDEN_NAMES) if (re.test(src)) f.push(`${rel} names a forbidden company (${re})`);
    if (/api\.resend\.com/.test(src) && rel !== 'lib/senior/email.mjs') f.push(`${rel} calls Resend directly; every email must go through lib/senior/email.mjs composeEmail`);
  }
  const email = files['lib/senior/email.mjs'] || '';
  if (!/throw new Error\('Refused: no unsubscribe token/.test(email) || !/throw new Error\('Refused: no postal address/.test(email)) f.push('composeEmail no longer refuses a message without an unsubscribe link or postal address');
  if (!/List-Unsubscribe-Post/.test(email)) f.push('composeEmail no longer sets List-Unsubscribe-Post');
  return f;
}

function fail(list) {
  console.error('SENIOR STATIC CONTRACT FAIL');
  list.forEach((m) => console.error(` - ${m}`));
  process.exit(1);
}

const envSrc = read('lib/senior/env.mjs');
const files = {};
const add = (dir, re) => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  for (const n of fs.readdirSync(abs)) if (re.test(n)) files[path.join(dir, n)] = read(path.join(dir, n));
};
add('functions/api', /^senior-.*\.js$/);
add('lib/senior', /\.mjs$/);
add('assets', /^senior-.*\.js$/);
const routeCount = Object.keys(files).filter((k) => k.startsWith('functions/api/')).length;
if (routeCount < 8 || !files['lib/senior/email.mjs']) fail([`scanned ${routeCount} senior route files and ${Object.keys(files).length} files in all; expected the 8 routes and lib/senior`]);

const failures = check(files, envSrc);

// Negative proofs: each hostile fixture must be caught by the same check.
const base = { 'lib/senior/email.mjs': files['lib/senior/email.mjs'] };
const HOSTILE = {
  'undeclared env': { 'functions/api/senior-x.js': 'const k = env.STRIPE_KEY_TYPO;' },
  'reserved env': { 'functions/api/senior-x.js': 'const k = env.ANTHROPIC_API_KEY;' },
  'EMAIL_FROM read': { 'functions/api/senior-x.js': 'const from = env.EMAIL_FROM;' },
  // Split so this validator's own source is not itself a model endpoint to zero_paid_llm_check.
  'paid model': { 'lib/senior/x.mjs': "await fetch('https://openrouter" + ".ai/api/v1/chat/completions')" },
  'direct resend': { 'lib/senior/x.mjs': "await fetch('https://api.resend.com/emails')" },
  'forbidden name': { 'lib/senior/x.mjs': "const reply = 'hello@joinwestpeek.com';" },
  'composer refusal removed': { 'lib/senior/email.mjs': (files['lib/senior/email.mjs'] || '').replace("throw new Error('Refused: no postal address", "console.log('no postal address") }
};
for (const [name, extra] of Object.entries(HOSTILE)) {
  if (!check({ ...base, ...extra }, envSrc).length) failures.push(`negative proof no longer caught: ${name}`);
}
if (!check({ ...base }, envSrc.replace(/STRIPE_SECRET_KEY:/, 'TOKEN:')).length) failures.push('negative proof no longer caught: reserved declared name');

// The tick is wired end to end.
const wfRel = '.github/workflows/senior_tick.yml';
if (!fs.existsSync(path.join(ROOT, wfRel))) failures.push(`${wfRel} missing: nothing drives the 72-hour release clock or the 30/60/90 follow-ups`);
else {
  const wf = read(wfRel);
  if (!/cron:\s*['"]\*\/15 \* \* \* \*['"]/.test(wf)) failures.push(`${wfRel} must run every 15 minutes`);
  if (!/\/api\/senior-tick/.test(wf)) failures.push(`${wfRel} does not call /api/senior-tick`);
  if (!/x-senior-tick-token:\s*\$\{\{\s*secrets\.SENIOR_TICK_TOKEN\s*\}\}/.test(wf)) failures.push(`${wfRel} does not send secrets.SENIOR_TICK_TOKEN as x-senior-tick-token`);
}
if (!files['functions/api/senior-tick.js'] || !/handleTick/.test(files['functions/api/senior-tick.js'])) failures.push('functions/api/senior-tick.js does not route to handleTick');
if (!/x-senior-tick-token/.test(files['lib/senior/handlers.mjs'] || '')) failures.push('handleTick no longer checks x-senior-tick-token');

// The evidence trail exists in the schema.
const migDir = path.join(ROOT, 'migrations/senior');
const sql = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((n) => n.endsWith('.sql')).map((n) => fs.readFileSync(path.join(migDir, n), 'utf8')).join('\n') : '';
for (const t of TABLES) if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${t} \\(`).test(sql)) failures.push(`migrations/senior does not create table ${t}`);

if (failures.length) fail(failures);
console.log(`SENIOR STATIC CONTRACT PASS (${Object.keys(files).length} files: ${declared(envSrc).names.length} declared env names, none reserved; no paid model; Resend only via composeEmail; tick wired; ${TABLES.length} tables; ${Object.keys(HOSTILE).length + 1} negative proofs caught)`);
