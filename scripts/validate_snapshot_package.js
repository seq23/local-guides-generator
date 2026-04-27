#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const target = path.resolve(process.argv[2] || process.cwd());

function fail(msg) {
  console.error(`validate_snapshot_package failed: ${msg}`);
  process.exit(1);
}

function exists(rel) {
  return fs.existsSync(path.join(target, rel));
}

function findNestedRootCandidate() {
  const entries = fs.readdirSync(target, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  if (dirs.length === 1 && files.length === 0) {
    const nested = path.join(target, dirs[0]);
    if (fs.existsSync(path.join(nested, 'package.json'))) {
      return nested;
    }
  }
  return null;
}

if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  fail(`target is not a directory: ${target}`);
}

const nestedRoot = findNestedRootCandidate();
if (nestedRoot && !exists('package.json')) {
  fail(`archive/root wrapper detected; package.json found under nested directory ${path.relative(target, nestedRoot)}`);
}

const requiredFiles = [
  '.gitignore',
  'README.md',
  'package.json',
  'package-lock.json',
  'distribution.config.json',
  'indexnow.txt'
];

const requiredDirs = [
  '.github/workflows',
  'scripts'
];

const requiredWorkflowFiles = [
  '.github/workflows/validate.yml',
  '.github/workflows/integrity_build.yml'
];

const requiredScriptFiles = [
  'scripts/build_all_packs.js',
  'scripts/validate_core.js'
];

const missing = [
  ...requiredFiles.filter((rel) => !exists(rel)).map((rel) => `missing file ${rel}`),
  ...requiredDirs.filter((rel) => !exists(rel)).map((rel) => `missing directory ${rel}`),
  ...requiredWorkflowFiles.filter((rel) => !exists(rel)).map((rel) => `missing workflow ${rel}`),
  ...requiredScriptFiles.filter((rel) => !exists(rel)).map((rel) => `missing script ${rel}`),
];

if (missing.length) {
  fail(`\n - ${missing.join('\n - ')}`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
if (!pkg.scripts || typeof pkg.scripts !== 'object') {
  fail('package.json missing scripts object');
}
if (!pkg.scripts['validate:snapshot-package']) {
  fail('package.json missing validate:snapshot-package script');
}

console.log(`validate_snapshot_package: OK (${target})`);
