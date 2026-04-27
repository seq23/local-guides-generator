#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadBuyouts, filterLiveForVertical } = require("./helpers/buyouts");

// Resolve pageSetFile configured in data/site.json to an actual JSON file path.
// Packs live under data/page_sets/ (or data/page_sets/examples/ for starter/example packs).
function resolvePageSetPath(repoRoot, pageSetFile) {
  if (!pageSetFile || typeof pageSetFile !== "string") return null;

  // Already a data/page_sets... style path?
  const normalized = pageSetFile.replace(/^\.\//, "");
  const directAbs = path.join(repoRoot, normalized);
  if (fs.existsSync(directAbs)) return directAbs;

  // Bare filename like "dentistry_v1.json" or "starter_v1.json"
  const p1 = path.join(repoRoot, "data", "page_sets", normalized);
  if (fs.existsSync(p1)) return p1;

  const p2 = path.join(repoRoot, "data", "page_sets", "examples", normalized);
  if (fs.existsSync(p2)) return p2;

  return null;
}

function fail(msg){
  console.error("❌ BUYOUT NEXT-STEPS HARDFAIL:", msg);
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const siteJsonPath = path.join(repoRoot, "data", "site.json");
const site = JSON.parse(fs.readFileSync(siteJsonPath, "utf8"));
const pageSetFile = site.pageSetFile || "";
const vertical = path.basename(pageSetFile).replace(/\.json$/,""); // e.g. dentistry_v1
// Prefer vertical key from pageSet itself if present
const pageSetPath = resolvePageSetPath(repoRoot, pageSetFile);
if (!pageSetPath){
  fail(`Could not resolve pageSetFile "${pageSetFile}". Expected under data/page_sets/ or data/page_sets/examples/.`);
}
const pageSet = JSON.parse(fs.readFileSync(pageSetPath, "utf8"));
const verticalKey = pageSet.verticalKey || pageSet.vertical || vertical;

const buyouts = loadBuyouts(repoRoot);
const live = filterLiveForVertical(buyouts, verticalKey);

if (live.length === 0){
  console.log("✅ BUYOUT HARDFAIL SKIP (no LIVE buyouts)");
  process.exit(0);
}

// If any LIVE buyout exists, the pack must not be educationOnly
if (pageSet.educationOnly === true){
  fail(`LIVE buyout exists but pageSet.educationOnly is true for vertical=${verticalKey}. Set educationOnly=false.`);
}

// If any LIVE buyout exists, next-steps must be enabled in pack routes
const routes = Array.isArray(pageSet.routes) ? pageSet.routes : [];
const hasNextSteps = routes.includes("next-steps");
if (!hasNextSteps){
  fail(`LIVE buyout exists but next-steps route is missing in ${pageSetFile}. Add "next-steps" to routes.`);
}

console.log(`✅ BUYOUT NEXT-STEPS HARDFAIL PASS (LIVE=${live.length})`);
