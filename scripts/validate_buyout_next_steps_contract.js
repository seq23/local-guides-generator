#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadBuyouts, filterLiveForVertical } = require("./helpers/buyouts");

// Resolve pageSetFile configured in data/site.json to an actual JSON file path.
// Packs live under data/page_sets/ (or data/page_sets/examples/ for starter/example packs).
function resolvePageSetPath(repoRoot, pageSetFile) {
  if (!pageSetFile || typeof pageSetFile !== "string") return null;
  const normalized = pageSetFile.replace(/^\.\//, "");
  const directAbs = path.join(repoRoot, normalized);
  if (fs.existsSync(directAbs)) return directAbs;
  const p1 = path.join(repoRoot, "data", "page_sets", normalized);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(repoRoot, "data", "page_sets", "examples", normalized);
  if (fs.existsSync(p2)) return p2;
  return null;
}

function fail(msg){
  console.error("❌ BUYOUT NEXT-STEPS CONTRACT FAIL:", msg);
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");
if (!fs.existsSync(distRoot)) fail("dist/ missing. Run build before validation.");

const site = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "site.json"), "utf8"));
const pageSetFile = site.pageSetFile;
const pageSetPath = resolvePageSetPath(repoRoot, pageSetFile);
if (!pageSetPath){
  fail(`Could not resolve pageSetFile "${pageSetFile}". Expected under data/page_sets/ or data/page_sets/examples/.`);
}
const pageSet = JSON.parse(fs.readFileSync(pageSetPath, "utf8"));
const verticalKey = pageSet.verticalKey || pageSet.vertical || path.basename(pageSetFile).replace(/\.json$/,"");

const buyouts = loadBuyouts(repoRoot);
const live = filterLiveForVertical(buyouts, verticalKey);

if (live.length === 0){
  console.log("✅ BUYOUT CONTRACT SKIP (no LIVE buyouts)");
  process.exit(0);
}

const forbiddenMarkers = [
  "Submit Inquiry",
  "Open Email to Submit",
  "/for-providers/",
  "mailto:info@spryvc.com"
];

function readHtml(rel){
  const p = path.join(distRoot, rel, "index.html");
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function mustNotContain(html, rel){
  for (const m of forbiddenMarkers){
    if (html.includes(m)) fail(`${rel} contains forbidden conversion surface under LIVE buyout: ${m}`);
  }
}

function mustContain(html, rel){
  if (!html.includes('data-next-steps-cta="true"')) fail(`${rel} missing Next Steps CTA marker data-next-steps-cta="true" under LIVE buyout`);
}

function assertExists(rel){
  const p = path.join(distRoot, rel, "index.html");
  if (!fs.existsSync(p)) fail(`Expected page missing under LIVE buyout: /${rel}/`);
}

for (const b of live){
  if (b.scope === "vertical"){
    assertExists("next-steps");
    const home = readHtml("") || readHtml("index") || readHtml(".") || fs.readFileSync(path.join(distRoot,"index.html"),"utf8");
    mustContain(home, "/");
    mustNotContain(home, "/");
  }
  if (b.scope === "city"){
    assertExists(`${b.citySlug}/next-steps`);
    const cityHtml = readHtml(`${b.citySlug}`);
    if (!cityHtml) fail(`Missing city page for ${b.citySlug}`);
    mustContain(cityHtml, `/${b.citySlug}/`);
    mustNotContain(cityHtml, `/${b.citySlug}/`);
  }
  if (b.scope === "state"){
    assertExists(`states/${b.state.toLowerCase()}/next-steps`);
    const stateHtml = readHtml(`states/${b.state.toLowerCase()}`);
    if (!stateHtml) fail(`Missing state page for ${b.state}`);
    mustContain(stateHtml, `/states/${b.state.toLowerCase()}/`);
    mustNotContain(stateHtml, `/states/${b.state.toLowerCase()}/`);
  }
  if (b.scope === "category"){
    assertExists(`guides/${b.guideSlug}/next-steps`);
    const guideHtml = readHtml(`guides/${b.guideSlug}`);
    if (!guideHtml) fail(`Missing guide page for ${b.guideSlug}`);
    mustContain(guideHtml, `/guides/${b.guideSlug}/`);
    mustNotContain(guideHtml, `/guides/${b.guideSlug}/`);
  }
}

console.log(`✅ BUYOUT NEXT-STEPS CONTRACT PASS (LIVE=${live.length})`);
