#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require("child_process");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
function run(cmd){
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: repoRoot });
}

console.log("== RELEASE QA RUNNER ==");
run("npm run validate:all");
run("npm run validate:dist:compliance");
run("npm run validate:goldens");
run("npm run validate:pi:containment");
run("npm run audit:links");
run("npm run audit:buyouts");
run("npm run smoke:buyouts");
console.log("\n✅ RELEASE QA PASS");
