#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..', '..');
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function fail(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }
const contract = readJson(path.join(repoRoot, 'data/contracts/guide_answer_shape_contract.json'));
const registry = readJson(path.join(repoRoot, 'data/contracts/guide_enhancement_registry.json'));
const requiredRoutes = [
  '/guides/how-to-choose-a-neuro-evaluation-provider/',
  '/guides/adhd-therapy-vs-medication-vs-coaching/',
  '/guides/autism-evaluations-screening-vs-assessment/',
  '/guides/autism-therapy-red-flags-and-green-flags/',
  '/guides/can-one-provider-handle-adhd-evaluation-and-therapy/',
  '/guides/neuropsych-testing-overview/',
  '/guides/questions-to-ask-an-adhd-therapist/',
  '/guides/telehealth-vs-in-person-neuro/',
  '/guides/using-results-for-school-or-work/',
  '/guides/uscis-fees-timelines-and-what-to-ask/',
  '/guides/questions-to-ask-a-civil-surgeon/',
  '/guides/document-checklist/',
  '/guides/uscis-vaccination-requirements/'
];
const contractMap = new Map((contract.entries || []).map((entry) => [entry.route, entry]));
const problems = [];
for (const route of requiredRoutes) {
  if (!contractMap.has(route)) problems.push(`missing guide answer-shape contract entry: ${route}`);
  if (!registry[route]) problems.push(`missing guide enhancement registry entry: ${route}`);
}
if (problems.length) fail(problems.join('\n'));
console.log(JSON.stringify({ ok: true, locked_routes: requiredRoutes.length }, null, 2));
