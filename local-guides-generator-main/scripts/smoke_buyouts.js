#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const repoRoot = path.resolve(__dirname, "..");
function run(cmd, envExtras = {}){
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, env: { ...process.env, ...envExtras } });
}

function getCurrentPageSetFile() {
  const fp = path.join(repoRoot, 'data', 'site.json');
  try {
    const site = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return String(site && site.pageSetFile || '').trim();
  } catch {
    return '';
  }
}

console.log("== SMOKE BUYOUTS ==");
run("node scripts/validate_buyouts_schema.js");

const distDir = path.join(repoRoot, 'dist');
if (!fs.existsSync(distDir)) {
  const pageSetFile = getCurrentPageSetFile();
  if (!pageSetFile) {
    throw new Error('SMOKE BUYOUTS FAIL: dist/ missing and data/site.json has no pageSetFile. Build a pack first.');
  }
  run("node scripts/prepare_site.js", { PAGE_SET_FILE: pageSetFile, LKG_ENV: process.env.LKG_ENV || 'baseline' });
  run("node scripts/build_city_sites.js", { PAGE_SET_FILE: pageSetFile, LKG_ENV: process.env.LKG_ENV || 'baseline' });
}

run("node scripts/validate_buyout_next_steps_hardfail.js");
run("node scripts/validate_buyout_next_steps_contract.js");
console.log("✅ SMOKE BUYOUTS PASS");
