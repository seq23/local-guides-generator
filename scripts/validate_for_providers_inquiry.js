#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const dist = path.join(repoRoot, "dist");
const fp = path.join(dist, "for-providers", "index.html");

function fail(msg){
  console.error("❌ FOR-PROVIDERS INQUIRY FAIL:", msg);
  process.exit(1);
}

if (!fs.existsSync(fp)) fail("dist/for-providers/index.html missing. Run build first.");

const html = fs.readFileSync(fp, "utf8");
const mailtos = Array.from(html.matchAll(/href=["'](mailto:[^"']+)["']/g)).map(m=>m[1]);

if (mailtos.length===0) fail("No mailto links found on for-providers page.");

const uniq = Array.from(new Set(mailtos));
if (uniq.length !== 1){
  fail(`Found multiple different mailto templates on for-providers page (${uniq.length}). Must be exactly 1.`);
}

const body = decodeURIComponent((uniq[0].split("body=")[1]||"").replace(/\+/g,"%20"));
const requiredLines = [
  "Full name:",
  "Work email:",
  "Phone:",
  "Firm name:",
  "Firm type:",
  "Interested in:",
  "Primary markets:",
  "Estimated monthly budget:",
  "How did you find us?"
];

for (const r of requiredLines){
  if (!body.includes(r)) fail(`Mailto body missing required line: ${r}`);
}

const forbidden = ["pack", "vertical / pack", "Preferred next step", "inventory + availability", "custom proposal"];
for (const f of forbidden){
  if (body.toLowerCase().includes(f.toLowerCase())) fail(`Mailto body contains forbidden field/jargon: ${f}`);
}

console.log("✅ FOR-PROVIDERS INQUIRY PASS (single template + required capture)");
