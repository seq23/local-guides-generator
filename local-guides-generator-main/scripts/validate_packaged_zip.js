#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const zipPath = path.resolve(process.argv[2] || process.env.ARTIFACT_ZIP || '');
if (!zipPath || !fs.existsSync(zipPath)) {
  console.error('validate_packaged_zip failed: provide zip path as argv[2] or ARTIFACT_ZIP');
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lkg-zip-audit-'));
function detectRoot(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile());
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1 && files.length === 0) {
    const nested = path.join(dir, dirs[0].name);
    if (fs.existsSync(path.join(nested, 'package.json'))) return nested;
  }
  return dir;
}
try {
  execFileSync('unzip', ['-q', zipPath, '-d', tmp], { stdio: 'inherit' });
  const root = detectRoot(tmp);
  execFileSync(process.execPath, [path.join(__dirname, 'validate_snapshot_package.js'), root], { stdio: 'inherit' });
  console.log(`validate_packaged_zip: OK (${zipPath})`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
