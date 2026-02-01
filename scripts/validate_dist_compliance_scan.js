/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");

function fail(msg){
  console.error("❌ DIST COMPLIANCE SCAN FAIL:", msg);
  process.exit(1);
}
if (!fs.existsSync(distRoot)) fail("dist/ missing. Run build first.");

function walk(dir){
  let out=[];
  for (const name of fs.readdirSync(dir)){
    const p=path.join(dir,name);
    const st=fs.statSync(p);
    if (st.isDirectory()) out=out.concat(walk(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
}

const banned = [
  "AI visibility",
  "Official verification resources",
  "Disclosure & disclaimers",
  "Last updated:",
  "The Accident Guides" // banned umbrella
];

const files = walk(distRoot);
const hits = [];

for (const f of files){
  const rel = path.relative(distRoot, f);
  const html = fs.readFileSync(f,"utf8");
  for (const token of banned){
    if (html.includes(token)){
      const idx = html.indexOf(token);
      const snippet = html.slice(Math.max(0, idx-40), Math.min(html.length, idx+40)).replace(/\s+/g," ");
      hits.push({file: rel, token, snippet});
    }
  }
}

if (hits.length){
  console.error("Found banned tokens in dist:");
  for (const h of hits.slice(0,100)){
    console.error(`- ${h.file}: "${h.token}" ... ${h.snippet}`);
  }
  fail(`Banned tokens found (${hits.length}). Remove from templates/content or ensure footer-only policy pages.`);
}

console.log("✅ DIST COMPLIANCE SCAN PASS");
