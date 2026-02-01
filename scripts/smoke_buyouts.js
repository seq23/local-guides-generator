#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
function run(cmd){
  execSync(cmd, { stdio: "inherit", cwd: repoRoot });
}

console.log("== SMOKE BUYOUTS ==");
run("node scripts/validate_buyouts_schema.js");
run("npm run build");
run("node scripts/validate_buyout_next_steps_hardfail.js");
run("node scripts/validate_buyout_next_steps_contract.js");
console.log("✅ SMOKE BUYOUTS PASS");
