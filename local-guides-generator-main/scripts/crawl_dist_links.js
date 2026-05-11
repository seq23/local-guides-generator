#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");
const outPath = path.join(repoRoot, "docs", "audits", "link_integrity_report.md");

function fail(msg){
  console.error("❌ LINK AUDIT FAIL:", msg);
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

const htmlFiles = walk(distRoot);
const broken = [];
const empty = [];

const hrefRe = /(href|src)=["']([^"']+)["']/g;

for (const f of htmlFiles){
  const rel = path.relative(distRoot, f);
  const html = fs.readFileSync(f,"utf8");
  let m;
  while ((m = hrefRe.exec(html)) !== null){
    const url = m[2];
    if (!url) continue;
    if (url === "" || url === "#"){
      empty.push({file: rel, url});
      continue;
    }
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:") || url.startsWith("tel:")) continue;
    if (url.startsWith("#")) continue;

    // normalize leading slash
    const u = url.split("#")[0].split("?")[0];
    const target = u.startsWith("/") ? u.slice(1) : path.join(path.dirname(rel), u);
    const candidateHtml = path.join(distRoot, target);
    const exists = fs.existsSync(candidateHtml) ||
      fs.existsSync(path.join(distRoot, target, "index.html")) ||
      fs.existsSync(candidateHtml + ".html");

    if (!exists){
      broken.push({file: rel, url});
    }
  }
}

let md = `# Link Integrity Report\n\nGenerated: ${new Date().toISOString()}\n\n`;
md += `Scanned HTML files: ${htmlFiles.length}\n\n`;
md += `## Empty/placeholder links\n\n`;
if (empty.length===0) md += `✅ None\n\n`;
else {
  for (const e of empty) md += `- ${e.file}: \`${e.url}\`\n`;
  md += `\n`;
}

md += `## Broken internal links\n\n`;
if (broken.length===0) md += `✅ None\n\n`;
else {
  for (const b of broken) md += `- ${b.file}: \`${b.url}\`\n`;
  md += `\n`;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md, "utf8");

if (empty.length || broken.length){
  fail(`Found ${empty.length} empty and ${broken.length} broken internal links. See docs/audits/link_integrity_report.md`);
}

console.log("✅ LINK AUDIT PASS");
