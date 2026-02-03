#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * PI KEYWORD CONTAINMENT
 *
 * Purpose:
 *   Prevent PI-regulated tokens (example: the standalone acronym "ICE") from leaking into
 *   NON-PI sites/content.
 *
 * Enforcement reality:
 *   - If the active page set is PI: SKIP (PI content can mention PI-regulated terms).
 *   - If the active page set is NOT PI: scan runtime sources that could affect generation:
 *       data/, templates/, scripts/
 *     and fail if we find standalone "ICE" outside PI-only areas.
 *
 * IMPORTANT:
 *   We match the standalone token "ICE" only (word boundary, uppercase), NOT substrings.
 *   This avoids false hits like "practice", "services", "pricing", "office", etc.
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

function die(msg) {
  console.error("❌ PI KEYWORD CONTAINMENT FAIL:", msg);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getActiveVerticalKey() {
  const sitePath = path.join(repoRoot, "data", "site.json");
  if (!fs.existsSync(sitePath)) return null;
  const site = readJson(sitePath);
  const pageSetFile = site.pageSetFile || "";
  const base = path.basename(pageSetFile);
  const noExt = base.replace(/\.json$/, "");
  return noExt.replace(/_v\d+$/, "");
}

function listFilesRecursive(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
        stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function isTextLike(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    ".js", ".json", ".md", ".html", ".css", ".txt", ".yml", ".yaml",
    ".csv", ".ts", ".tsx", ".jsx"
  ].includes(ext);
}

// Standalone tokens only (uppercase, word boundary)
const TOKEN_PATTERNS = [
  /\bICE\b/g,
];

// PI-only runtime areas that are allowed to contain PI tokens even when building non-PI sites.
function isAllowedPIOnlyPath(rel) {
  // PI vertical packs + PI global pages + PI datasets/taxonomy
  if (rel.startsWith("data/page_sets/examples/pi_")) return true;
  if (rel.startsWith("data/page_sets/pi_")) return true;

  if (rel.startsWith("data/taxonomy/pi_")) return true;
  if (rel.startsWith("data/pi_")) return true;
  if (rel.includes("/pi_guides_") || rel.includes("/pi_guides/")) return true;

  // If you keep PI-only sponsor artifacts:
  if (rel.startsWith("data/sponsors/pi")) return true;

  return false;
}

function main() {
  const verticalKey = getActiveVerticalKey();

  // If unknown, don't block.
  if (!verticalKey) {
    console.log("✅ PI KEYWORD CONTAINMENT PASS (skipped: unknown active page set)");
    process.exit(0);
  }

  // PI pack itself: allow PI tokens; containment is only for NON-PI builds.
  if (verticalKey === "pi") {
    console.log("✅ PI KEYWORD CONTAINMENT PASS (skipped: PI page set)");
    process.exit(0);
  }

  const scanDirs = [
    path.join(repoRoot, "data"),
    path.join(repoRoot, "templates"),
    path.join(repoRoot, "scripts"),
  ].filter((p) => fs.existsSync(p));

  const offenders = [];

  for (const dir of scanDirs) {
    for (const f of listFilesRecursive(dir)) {
      if (!isTextLike(f)) continue;

      const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
      // Exclude this validator itself (it contains PI token regex by design)
      if (rel === "scripts/validate_pi_keyword_containment.js") continue;

      // PI-only sources are allowed to contain PI tokens; they should not block non-PI builds.
      if (isAllowedPIOnlyPath(rel)) continue;

      let txt = "";
      try {
        txt = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }

      for (const re of TOKEN_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(txt)) {
          offenders.push({ rel, token: String(re) });
          break;
        }
      }
    }
  }

  if (offenders.length) {
    console.error("PI token leakage in NON-PI runtime sources:");
    for (const o of offenders) console.error(`- ${o.rel} matches ${o.token}`);
    die(`Found ${offenders.length} PI token hits in NON-PI runtime sources.`);
  }

  console.log("✅ PI KEYWORD CONTAINMENT PASS");
}

main();
