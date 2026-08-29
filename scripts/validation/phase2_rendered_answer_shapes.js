/**
 * Phase 2: the rendered guide answer-shape markers must actually be in the HTML.
 *
 * This gate examined ZERO pages and printed OK on every run, in every workflow,
 * for every pack.
 *
 * It iterated `pageSet.globalPages` -- an array that does not exist in any of
 * the five packs. The packs declare `globalPagesDir`, a DIRECTORY, and that is
 * what scripts/build_city_sites.js reads (loadGlobalPagesDir). So the loop body
 * never ran once: no route was resolved, no dist file was opened, no marker was
 * checked, and `problems` was empty for the only reason that nothing was ever
 * looked at. A guard that could not reach what it governs.
 *
 * It was invisible because the failure mode is silence. Proof it was inert: the
 * validator produced byte-identical output with dist present and with dist
 * deleted entirely -- the one thing it exists to read made no difference to its
 * verdict.
 *
 * Reading the same source the build reads, the contract covers 70 guide routes
 * across the five packs (dentistry 13, neuro 22, pi 6, trt 18, uscis 11) that
 * were never being checked.
 *
 * Rule 0: examining nothing is now a hard failure, not a pass.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "data", "site.json"), "utf8"));
const pageSet = JSON.parse(fs.readFileSync(path.join(root, site.pageSetFile), "utf8"));
const contract = JSON.parse(fs.readFileSync(path.join(root, "data", "contracts", "guide_answer_shape_contract.json"), "utf8"));
const distDir = path.join(root, "dist");
const contractMap = new Map((contract.entries || []).map((entry) => [String(entry.route || ""), entry]));
const problems = [];

// Resolve routes exactly the way the build does: pageSet.globalPagesDir, one
// JSON file per page. `pageSet.globalPages` is kept as a fallback only so an
// older pack shape still works; every current pack uses the directory.
function activeRoutes() {
  const routes = [];
  const dir = pageSet.globalPagesDir
    ? (path.isAbsolute(pageSet.globalPagesDir)
        ? pageSet.globalPagesDir
        : path.join(root, pageSet.globalPagesDir))
    : null;
  if (dir && fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const route = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")).route;
        if (route) routes.push(String(route));
      } catch {
        problems.push(`unreadable global page source: ${path.join(pageSet.globalPagesDir, name)}`);
      }
    }
  }
  for (const page of pageSet.globalPages || []) {
    const route = String(page.route || "");
    if (route) routes.push(route);
  }
  return routes;
}

const routes = activeRoutes();
let guideRoutes = 0;
let examined = 0;

for (const route of routes) {
  if (!route.startsWith("/guides/") || route === "/guides/") continue;
  guideRoutes += 1;
  const entry = contractMap.get(route);
  if (!entry) continue;
  examined += 1;
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

// Rule 0. Passing while having opened no rendered page is the exact defect this
// file carried: the verdict must be backed by pages actually read.
if (examined === 0) {
  console.error(
    "FAIL: phase2 rendered answer-shape gate examined 0 guide routes and cannot vouch for anything.\n" +
      `  active pack:            ${site.pageSetFile}\n` +
      `  globalPagesDir:         ${pageSet.globalPagesDir || "(not declared)"}\n` +
      `  routes resolved:        ${routes.length}\n` +
      `  guide routes:           ${guideRoutes}\n` +
      `  contract entries:       ${contractMap.size}\n` +
      "  Either the pack resolves no guide routes, or none of them appears in\n" +
      "  data/contracts/guide_answer_shape_contract.json. A gate that examines nothing\n" +
      "  passes for the wrong reason, so this is a failure."
  );
  process.exit(1);
}

if (problems.length) {
  console.error("FAIL: " + problems.join("\n"));
  process.exit(1);
}
console.log(
  `OK: phase2 rendered guide answer-shape markers verified on ${examined} rendered guide page(s) ` +
    `of ${guideRoutes} guide route(s) in ${site.pageSetFile}`
);
