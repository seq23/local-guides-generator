#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const failures = [];
const checks = {
 'evidence-checklist-after-an-accident.json': ['evidence-checklist-citations','Citation-backed evidence preservation notes'],
 'personal-injury-fees-explained.json': ['cited-fee-data','Fee data and agreement review checklist'],
 'personal-injury-lawyer-red-flags.json': ['direct-red-flags','Decision-action red flag framework'],
 'questions-to-ask-a-personal-injury-lawyer.json': ['grouped-decision-stages','Questions grouped by decision stage'],
 'recorded-statements-and-insurance-calls.json': ['recorded-statement-decision-framework','Recorded-statement decision framework'],
 'what-to-do-after-an-accident.json': ['decision-critical-opening-checklist','Decision-critical opening checklist'],
 'when-to-call-a-personal-injury-lawyer.json': ['specific-call-thresholds','Specific thresholds for calling a lawyer'],
 'wrongful-death.json': ['wrongful-death-authority-framework','Wrongful-death authority and evidence framework']
};
const dir = path.join(root, 'data/page_sets/examples/pi_global_pages');
for (const [file, markers] of Object.entries(checks)) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) { failures.push(`missing guide source ${file}`); continue; }
  const txt = fs.readFileSync(p, 'utf8');
  if (!txt.includes('citation-agent-fix')) failures.push(`${file}: missing citation-agent-fix class`);
  for (const marker of markers) if (!txt.includes(marker)) failures.push(`${file}: missing marker ${marker}`);
}
if (failures.length) { console.error('PI guide recommendation contract FAIL'); failures.forEach(f => console.error('- '+f)); process.exit(1); }
console.log(`PI guide recommendation contract PASS: ${Object.keys(checks).length} guide repairs checked`);
