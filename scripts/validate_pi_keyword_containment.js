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

// Directories that are non-runtime documentation/sandbox artifacts.
// These must not be scanned for keyword containment.
const IGNORE_PREFIXES = [
  "docs/",
  "assets/",
  "releases/",
  "goldens/",
  ".github/",
];

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

const allFiles = walk(repoRoot)
  .filter(p => !p.includes(path.join(repoRoot,"node_modules")))
  .filter(p => !p.includes(path.join(repoRoot,"dist")))
  .filter(p => !p.includes(path.join(repoRoot,".git")))
  .filter(p => {
    const rel = path.relative(repoRoot, p).replace(/\\/g, "/");
    return !IGNORE_PREFIXES.some(prefix => rel.startsWith(prefix));
  });
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
