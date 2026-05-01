#!/usr/bin/env node
const { execSync } = require('child_process');

const ALLOWED_EXACT = new Set([
  'data/reference/incoming_candidates.json',
  'data/reference/reference_registry.json',
  'data/site.json',
]);

const ALLOWED_PREFIXES = [
  'data/page_sets/examples/',
  'docs/_generated_guides/',
];

function getChangedFiles() {
  const out = execSync('git diff --name-only', { encoding: 'utf8' });
  return out.split('\n').map(s => s.trim()).filter(Boolean);
}

const files = getChangedFiles();
const disallowed = files.filter((file) => {
  if (ALLOWED_EXACT.has(file)) return false;
  return !ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix));
});

if (disallowed.length) {
  console.error('promote_reference_intake_contract failed: unexpected changed files detected');
  for (const file of disallowed) console.error(` - ${file}`);
  process.exit(1);
}

console.log(`promote_reference_intake_contract: OK (${files.length} changed file(s))`);
