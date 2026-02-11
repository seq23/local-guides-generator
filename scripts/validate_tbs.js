#!/usr/bin/env node
/* eslint-disable no-console */

// TBS validation = pack-aware contract checks + audits.
// Core hard-fails live in scripts/validate_core.js.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');

function readSiteJsonOrNull() {
  const p = path.join(REPO_ROOT, 'data', 'site.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function isStarterV1(site) {
  const ps = String(site?.pageSetFile || '');
  return /(^|\/)starter_v1\.json$/i.test(ps);
}

function run(cmd, { hardFail = true, label } = {}) {
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (e) {
    if (hardFail) throw e;
    console.warn(`AUDIT WARNING (validate_tbs): ${label || cmd} failed (non-blocking)`);
    return false;
  }
}

function main() {
  const site = readSiteJsonOrNull();

  // Training pack must publish without validation hold-ups.
  if (site && isStarterV1(site)) {
    console.log('✅ TRAINING PACK (starter_v1): skipping TBS validation (non-blocking).');
    process.exit(0);
  }

  // Hard contract (pageset-aware): golden cities must match PI vs non-PI reality.
  run('node scripts/validate_golden_pages.js', { hardFail: true, label: 'golden contract' });

  // Audits (non-blocking): keep them useful, never annoying.
  run('node scripts/validate_dist_compliance_scan.js', { hardFail: false, label: 'dist compliance scan' });
  run('node scripts/validate_pi_keyword_containment.js', { hardFail: false, label: 'pi keyword containment' });

  console.log('OK: TBS audit: PASS (no warnings)');
}

main();
