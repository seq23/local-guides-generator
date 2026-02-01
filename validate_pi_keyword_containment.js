#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const keywords = [
  "ICE",
  "Immigration and Customs Enforcement",
  "immigration enforcement",
  "immigration-enforcement",
  "enforcement activity"
];

const allowedDir = path.join(repoRoot, "data", "page_sets", "examples", "pi_global_pages");

function fail(msg){
  console.error("❌ PI KEYWORD CONTAINMENT FAIL:", msg);
  process.exit(1);
}

function walk(dir){
  let out=[];
  for (const name of fs.readdirSync(dir)){
    const p=path.join(dir,name);
    const st=fs.statSync(p);
    if (st.isDirectory()) out=out.concat(walk(p));
    else if (p.endsWith(".json") || p.endsWith(".md") || p.endsWith(".txt")) out.push(p);
  }
  return out;
}

// This validator is intended to prevent specific PI/immigration-related terms from leaking into
// runtime site content. It must NOT scan documentation/training materials.
//
// Exclusions are intentionally conservative: docs/ contains training and generated guides that may
// legitimately mention these terms (e.g., "ICE") as part of examples or templates.
const EXCLUDE_DIRS = new Set([
  path.join(repoRoot, "node_modules"),
  path.join(repoRoot, "dist"),
  path.join(repoRoot, ".git"),
  path.join(repoRoot, "docs"),
  path.join(repoRoot, "releases"),
  path.join(repoRoot, "goldens"),
  path.join(repoRoot, "assets")
]);

function isExcluded(p){
  for (const d of EXCLUDE_DIRS){
    if (p === d || p.startsWith(d + path.sep)) return true;
  }
  return false;
}

const allFiles = walk(repoRoot).filter(p => !isExcluded(p));
const hits=[];
for (const f of allFiles){
  const txt = fs.readFileSync(f,"utf8");
  const rel = path.relative(repoRoot, f);
  for (const k of keywords){
    if (txt.includes(k)){
      const allowed = f.startsWith(allowedDir);
      if (!allowed){
        hits.push({file: rel, keyword: k});
      }
    }
  }
}
if (hits.length){
  console.error("Keyword leakage outside PI guides:");
  for (const h of hits.slice(0,100)){
    console.error(`- ${h.file} contains "${h.keyword}"`);
  }
  fail(`Found ${hits.length} keyword hits outside PI guides folder.`);
}
console.log("✅ PI KEYWORD CONTAINMENT PASS");
