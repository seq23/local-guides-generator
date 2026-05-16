#!/usr/bin/env node
/**
 * Renames guide JSON files to canonical naming:
 * - uscis_medical: guides_${slug}.json
 * - neuro: guides_${slug}.json
 * - trt: guides_trt_${slug}.json
 *
 * Uses git mv when possible to preserve history.
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

function run(cmd) {
  return cp.execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf-8").trim();
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function readJson(p) {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function slugFromJson(j, fallback) {
  const s =
    j?.slug ||
    j?.meta?.slug ||
    j?.page?.slug ||
    j?.data?.slug ||
    null;
  if (typeof s === "string" && s.trim()) return s.trim();
  return fallback;
}

function isTracked(repoRoot, relPath) {
  try {
    run(`cd "${repoRoot}" && git ls-files --error-unmatch "${relPath}"`);
    return true;
  } catch {
    return false;
  }
}

function safeGitMv(repoRoot, fromAbs, toAbs) {
  const fromRel = path.relative(repoRoot, fromAbs);
  const toRel = path.relative(repoRoot, toAbs);
  if (isTracked(repoRoot, fromRel)) {
    run(`cd "${repoRoot}" && git mv "${fromRel}" "${toRel}"`);
  } else {
    fs.renameSync(fromAbs, toAbs);
  }
}

function main() {
  const repoRoot = process.cwd();
  const examplesRoot = path.join(repoRoot, "data", "page_sets", "examples");

  const verticals = [
    { name: "uscis", folder: "uscis_medical_global_pages", prefix: "guides_", suffix: ".json" },
    { name: "neuro", folder: "neuro_global_pages", prefix: "guides_", suffix: ".json" },
    { name: "trt", folder: "trt_global_pages", prefix: "guides_trt_", suffix: ".json" },
  ];

  const report = [];
  const collisions = [];

  for (const v of verticals) {
    const dir = path.join(examplesRoot, v.folder);
    if (!exists(dir)) {
      report.push({ vertical: v.name, status: "SKIP (missing folder)", dir });
      continue;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));

    for (const f of files) {
      // Only touch guide-ish files. You can broaden this if you want.
      const isGuideCandidate =
        f.startsWith("guides_") || f.startsWith("guides_trt_");

      if (!isGuideCandidate) continue;

      const fromAbs = path.join(dir, f);
      let j;
      try {
        j = readJson(fromAbs);
      } catch (e) {
        report.push({ vertical: v.name, file: f, status: "SKIP (bad json)" });
        continue;
      }

      const fallbackSlug = f.replace(/\.json$/, "").replace(/^guides_trt_/, "").replace(/^guides_/, "");
      const slug = slugFromJson(j, fallbackSlug);

      const targetName = `${v.prefix}${slug}${v.suffix}`;
      const toAbs = path.join(dir, targetName);

      if (path.basename(fromAbs) === targetName) {
        report.push({ vertical: v.name, file: f, status: "OK (already canonical)" });
        continue;
      }

      if (exists(toAbs)) {
        collisions.push({ vertical: v.name, from: f, to: targetName, reason: "target exists" });
        continue;
      }

      safeGitMv(repoRoot, fromAbs, toAbs);
      report.push({ vertical: v.name, from: f, to: targetName, status: "RENAMED" });
    }
  }

  console.log("=== RENAME REPORT ===");
  for (const r of report) console.log(JSON.stringify(r));
  if (collisions.length) {
    console.log("\n=== COLLISIONS (manual) ===");
    for (const c of collisions) console.log(JSON.stringify(c));
    process.exitCode = 2;
  }
}

main();
