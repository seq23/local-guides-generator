#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadBuyouts, isLive } = require("./helpers/buyouts");
function resolvePageSetPath(repoRoot, pageSetFile) {
  if (!pageSetFile) return null;
  const direct = path.isAbsolute(pageSetFile) ? pageSetFile : path.join(repoRoot, pageSetFile);
  if (fs.existsSync(direct)) return direct;

  const candidates = [
    path.join(repoRoot, "data", "page_sets", pageSetFile),
    path.join(repoRoot, "data", "page_sets", "examples", pageSetFile),
    path.join(repoRoot, "data", "page_sets", "starter", pageSetFile),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const repoRoot = path.resolve(__dirname, "..");
const outPath = path.join(repoRoot, "docs", "audits", "buyout_click_audit_expected_urls.md");

const site = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "site.json"), "utf8"));
const pageSet = JSON.parse(fs.readFileSync((() => { const p = resolvePageSetPath(repoRoot, site.pageSetFile); if (!p) { throw new Error(`Missing pageSetFile: ${site.pageSetFile} (expected under data/page_sets/)`); } return p; })(), 'utf8'));
const verticalKey = pageSet.verticalKey || pageSet.vertical || path.basename(site.pageSetFile).replace(/\.json$/,"");

const all = loadBuyouts(repoRoot).filter(b => b && b.vertical === verticalKey);

function nextStepsUrl(b){
  if (b.scope==="vertical") return "/next-steps/";
  if (b.scope==="city") return `/${b.citySlug}/next-steps/`;
  if (b.scope==="state") return `/states/${String(b.state).toLowerCase()}/next-steps/`;
  if (b.scope==="category") return `/guides/${b.guideSlug}/next-steps/`;
  return "";
}

let md = `# Buyout Click Audit — Expected URLs\n\n`;
md += `Vertical: **${verticalKey}**\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `## Records\n\n`;

if (all.length===0){
  md += `No buyout records for this vertical.\n`;
} else {
  for (const b of all){
    md += `### ${b.id}\n`;
    md += `- scope: ${b.scope}\n`;
    md += `- LIVE: ${isLive(b) ? "YES" : "NO"} (requires record + live:true + date window)\n`;
    md += `- next steps URL: ${nextStepsUrl(b)}\n\n`;
  }
}

md += `\n## Manual click steps (only for LIVE buyouts)\n\n`;
md += `1. Open the scoped page (home/city/state/guide).\n`;
md += `2. Confirm a **Next Steps** CTA is present.\n`;
md += `3. Click the CTA → confirm it loads the Next Steps page.\n`;
md += `4. Confirm no competing conversion surfaces appear (no Submit Inquiry / for-providers / generic mailto).\n`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md, "utf8");
console.log(`✅ WROTE ${path.relative(repoRoot, outPath)}`);
