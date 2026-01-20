#!/usr/bin/env node

/**
 * Validate ALL packs (starter + all example vertical packs).
 * This prevents “starter passes, vertical fails” deploy surprises.
 *
 * Behavior:
 * - Mutates data/site.json.pageSetFile for each pack
 * - Runs: build_city_sites -> snapshot_lkg -> validate_tbs
 * - Restores original site.json at the end (even on failure)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const siteJsonPath = path.join(repoRoot, "data", "site.json");

const PACKS = [
  "starter_v1.json",
  "examples/pi_v1.json",
  "examples/dentistry_v1.json",
  "examples/trt_v1.json",
  "examples/neuro_v1.json",
  "examples/uscis_medical_v1.json"
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: repoRoot });
}

function header(msg) {
  console.log("\n============================================================");
  console.log(msg);
  console.log("============================================================\n");
}

function main() {
  const original = readJson(siteJsonPath);

  try {
    for (const pageSetFile of PACKS) {
      header(`VALIDATE PACK: ${pageSetFile}`);

      const next = { ...original, pageSetFile };
      writeJson(siteJsonPath, next);

      // Run the same steps as the postbuild pipeline, but explicitly, per-pack.
      run("node scripts/build_city_sites.js");
      run("node scripts/snapshot_lkg.js");
      run("node scripts/validate_tbs.js");

      console.log(`\nOK: Pack PASS: ${pageSetFile}\n`);
    }

    header("ALL PACKS PASSED");
    process.exit(0);
  } catch (err) {
    console.error("\nFAILED: validate_all_packs.js encountered an error.\n");
    process.exit(1);
  } finally {
    // Always restore original site.json to avoid “stuck on wrong pack”.
    try {
      writeJson(siteJsonPath, original);
      console.log("OK: Restored data/site.json to original pageSetFile.");
    } catch (e) {
      console.error("WARN: Could not restore data/site.json. Restore manually if needed.");
    }
  }
}

main();
