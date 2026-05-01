const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "data", "site.json"), "utf8"));
const pageSet = JSON.parse(fs.readFileSync(path.join(root, site.pageSetFile), "utf8"));
const contract = JSON.parse(fs.readFileSync(path.join(root, "data", "contracts", "guide_answer_shape_contract.json"), "utf8"));
const distDir = path.join(root, "dist");
const contractMap = new Map((contract.entries || []).map((entry) => [String(entry.route || ""), entry]));
const problems = [];

for (const page of (pageSet.globalPages || [])) {
  const route = String(page.route || "");
  if (!route.startsWith("/guides/") || route === "/guides/") continue;
  const entry = contractMap.get(route);
  if (!entry) continue;
  const rel = route.replace(/^\/+|\/+$/g, "");
  const htmlPath = path.join(distDir, rel, "index.html");
  if (!fs.existsSync(htmlPath)) {
    problems.push(`missing rendered guide file for ${route}`);
    continue;
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  if (!html.includes('data-guide-top-module="true"')) problems.push(`${route}: missing rendered top module marker`);
  if (!html.includes(`data-guide-top-module-type="${entry.top_module_type}"`)) problems.push(`${route}: missing expected top module type ${entry.top_module_type}`);
}

if (problems.length) {
  console.error("FAIL: " + problems.join("\n"));
  process.exit(1);
}
console.log("OK: phase2 rendered guide answer-shape markers present for active pack routes");
