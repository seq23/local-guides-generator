#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadBuyouts, filterLiveForVertical } = require("./helpers/buyouts");

// Resolve pageSetFile configured in data/site.json to an actual JSON file path.
// pageSetFile must be a canonical repo-relative path under data/page_sets/.
// Example packs still use the same canonical form, e.g. data/page_sets/examples/pi_v1.json
function resolvePageSetPath(repoRoot, pageSetFile) {
  if (!pageSetFile || typeof pageSetFile !== "string") return null;

  const normalized = pageSetFile.replace(/^\.\//, "").trim();

  if (!normalized.startsWith("data/page_sets/")) {
    return null;
  }

  const abs = path.join(repoRoot, normalized);
  if (!fs.existsSync(abs)) {
    return null;
  }

  return abs;
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
  fail(`Could not resolve pageSetFile "${pageSetFile}". Expected canonical repo-relative path under data/page_sets/.`);
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
