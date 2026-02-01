#!/usr/bin/env node
/**
 * Generates data/site.json from data/site.template.json using env vars.
 * Env:
 *  - PAGE_SET_FILE (default: starter_v1.json)
 *  - BRAND_NAME    (default: The Industry Guides)
 *  - SITE_URL      (default: https://example.com)
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const templatePath = path.join(dataDir, "site.template.json");
const outPath = path.join(dataDir, "site.json");

const PAGE_SET_FILE = process.env.PAGE_SET_FILE || "starter_v1.json";
const BRAND_NAME = process.env.BRAND_NAME || "The Industry Guides";
const SITE_URL = process.env.SITE_URL || "https://example.com";

function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function validatePageSet(pageSetFile) {
  const p1 = path.join(dataDir, "page_sets", pageSetFile);
  const p2 = path.join(dataDir, "page_sets", "examples", pageSetFile);
  if (exists(p1) || exists(p2)) return true;
  throw new Error(
    `PAGE_SET_FILE not found: ${pageSetFile}\n` +
    `Tried:\n  - ${p1}\n  - ${p2}\n`
  );
}

function main() {
  if (!exists(templatePath)) throw new Error(`Missing template: ${templatePath}`);
  validatePageSet(PAGE_SET_FILE);

  const template = fs.readFileSync(templatePath, "utf8");
  const rendered = template
    .replaceAll("%%BRAND_NAME%%", BRAND_NAME)
    .replaceAll("%%SITE_URL%%", SITE_URL)
    .replaceAll("%%PAGE_SET_FILE%%", PAGE_SET_FILE);

  if (rendered.includes("%%")) throw new Error("Unresolved placeholders remain in generated data/site.json.");

  fs.writeFileSync(outPath, rendered.trimEnd() + "\n", "utf8");
  console.log(`[prepare_site] Wrote data/site.json`);
  console.log(`  BRAND_NAME   = ${BRAND_NAME}`);
  console.log(`  SITE_URL     = ${SITE_URL}`);
  console.log(`  PAGE_SET_FILE= ${PAGE_SET_FILE}`);
}
main();
