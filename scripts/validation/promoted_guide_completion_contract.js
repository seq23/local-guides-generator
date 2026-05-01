#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const QUEUE_FILE = path.join(ROOT, '.tmp', 'promoted_guide_completion_queue.json');
const ALLOWED_PREFIXES = [
  'data/page_sets/examples/',
  'docs/_generated_guides/'
];
const REQUIRED = {
  dentistry: ['definition', 'cost', 'recovery', 'candidacy', 'questions', 'red-flags', 'next-steps'],
  neuro: ['definition', 'pricing', 'trust', 'process', 'questions', 'next-steps'],
  trt: ['definition', 'cost', 'safety', 'candidacy', 'questions', 'red-flags', 'next-steps'],
  pi: ['definition', 'when-to-call', 'cost', 'evidence', 'questions', 'red-flags', 'next-steps'],
  uscis_medical: ['quick-answer', 'cost', 'documents', 'process', 'questions', 'next-steps']
};

function changedFiles() {
  const out = execSync('git diff --name-only', { encoding: 'utf8' });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function main() {
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  const files = changedFiles();
  const bad = files.filter((file) => !ALLOWED_PREFIXES.some((p) => file.startsWith(p)));
  if (bad.length) {
    console.error('promoted_guide_completion_contract failed: unexpected changed files detected');
    bad.forEach((file) => console.error(` - ${file}`));
    process.exit(1);
  }
  const problems = [];
  for (const item of queue.items || []) {
    const fp = path.join(ROOT, item.file);
    if (!fs.existsSync(fp)) {
      problems.push(`missing completed file: ${item.file}`);
      continue;
    }
    const json = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const html = String(json.main_html || '');
    for (const id of REQUIRED[item.vertical] || []) {
      if (!html.includes(`id="${id}"`)) problems.push(`${item.file} missing #${id} after completion`);
    }
  }
  if (problems.length) {
    console.error('promoted_guide_completion_contract failed:');
    problems.forEach((msg) => console.error(` - ${msg}`));
    process.exit(1);
  }
  console.log(`promoted_guide_completion_contract: OK (${(queue.items || []).length} completed guide(s))`);
}

main();
