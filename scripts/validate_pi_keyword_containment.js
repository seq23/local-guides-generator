#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * PI KEYWORD CONTAINMENT
 *
 * Purpose:
 *   Ensure PI-specific regulated keywords (e.g., "ICE") do not leak into
 *   non-PI runtime content.
 *
 * Site reality + enforcement:
 *   - This validator ONLY runs (hard-fail) when the active page set is PI.
 *   - We DO NOT scan docs/, training/, archives, or dist/ output.
 *     Docs and training can contain example content; it must not block builds.
 *   - We scan only runtime sources that can affect generation:
 *       data/, templates/, scripts/
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
        // Skip node_modules and dist if present
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

function main() {
  const verticalKey = getActiveVerticalKey();
  if (!verticalKey || verticalKey !== "pi") {
    console.log("✅ PI KEYWORD CONTAINMENT PASS (skipped: non-PI page set)");
    process.exit(0);
  }

  // Keywords to contain (case-insensitive). Keep this list tight and explicit.
  const keywords = ["ICE"]; // Extend only when you intentionally add PI-only tokens.

  // Directories that can affect generation/runtime.
  const scanDirs = [
    path.join(repoRoot, "data"),
    path.join(repoRoot, "templates"),
    path.join(repoRoot, "scripts"),
  ].filter((p) => fs.existsSync(p));

  const offenders = [];
  for (const dir of scanDirs) {
    for (const f of listFilesRecursive(dir)) {
      if (!isTextLike(f)) continue;

      // Explicit exclusions inside scanned dirs
      const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
      if (rel.startsWith("data/page_sets/examples/pi_v1")) continue; // PI pack itself can mention PI terms
      if (rel.startsWith("data/page_sets/examples/pi_")) continue;
      if (rel.includes("/pi_guides_") || rel.includes("/pi_guides/")) continue;

      let txt = "";
      try {
        txt = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      const lower = txt.toLowerCase();
      for (const k of keywords) {
        const kl = k.toLowerCase();
        if (lower.includes(kl)) {
          offenders.push({ rel, keyword: k });
          break;
        }
      }
    }
  }

  if (offenders.length) {
    console.error("Keyword leakage in runtime sources (PI page set):");
    for (const o of offenders) console.error(`- ${o.rel} contains "${o.keyword}"`);
    die(`Found ${offenders.length} keyword hits outside PI-only runtime areas.`);
  }

  console.log("✅ PI KEYWORD CONTAINMENT PASS");
}

main();
