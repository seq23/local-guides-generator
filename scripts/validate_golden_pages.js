#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");

const contractsPath = path.join(repoRoot, "goldens", "marker_contracts.json");
let contracts = null;
if (fs.existsSync(contractsPath)) {
  try { contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8")); }
  catch(e){ fail("failed to parse goldens/marker_contracts.json: " + e.message); }
}


function fail(msg){
  console.error("❌ GOLDEN CONTRACT FAIL:", msg);
  process.exit(1);
}

if (!fs.existsSync(distRoot)) fail("dist/ missing. Run build first.");

function readHtml(rel){
  const p = path.join(distRoot, rel);
  if (!fs.existsSync(p)) fail(`dist missing file: ${rel}`);
  return fs.readFileSync(p, "utf8").replace(/\s+/g," ").trim();
}

function assertOrder(html, markers, label){
  let pos = 0;
  for (const m of markers){
    const idx = html.indexOf(m, pos);
    if (idx === -1) fail(`${label} missing marker: ${m}`);
    pos = idx + m.length;
  }
}

// Representative pages (must exist in example packs)
const city = readHtml("phoenix-az/index.html");
assertOrder(city, [
  'data-sponsored-placement="top"',
  'data-llm-bait="question"',
  'data-eval-framework="true"',
  'data-sponsored-placement="mid"',
  'data-example-providers="true"',
  'data-state-lookup-cta="true"',
  'data-faq-accordion="true"',
  'data-sponsored-placement="bottom"',
  'data-guides-micro="true"'
], "city");

const guidesHub = readHtml("guides/index.html");
if (!guidesHub.includes("<h1>Guides</h1>")) fail("guides hub missing H1 Guides");

console.log("✅ GOLDEN CONTRACT PASS (marker-order)");
