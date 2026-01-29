#!/usr/bin/env node
/**
 * sync_guides.js
 *
 * Goal: make guides "drop-in" by treating the folder as the source of truth.
 * - Any JSON in a vertical's *_global_pages folder with route "/guides/<slug>/" is a guide.
 * - Filenames are normalized to the repo convention so other tooling stays deterministic.
 * - The vertical's guides hub JSON (guides.json) is updated with guide_cards[] (route/title/description).
 * - A canonical markdown document is regenerated (filename/slug/title/plain-text content).
 *
 * This script is intentionally conservative:
 * - It never edits guide ROUTES.
 * - It only renames files when it can do so safely (no overwrite).
 */

const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function normalizeRouteToSlug(route) {
  // route like "/guides/some-slug/" -> "some-slug"
  if (!route || typeof route !== "string") return null;
  const parts = route.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] !== "guides") return null;
  return parts[1];
}

function stripHtmlToText(html) {
  if (!html || typeof html !== "string") return "";
  // Remove scripts/styles
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Replace breaks/paras with newlines
  s = s.replace(/<\/(p|div|section|li|h\d)>/gi, "\n");
  // Drop tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode a few entities minimally
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&quot;/g, "\"");
  // Collapse whitespace
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

function canonicalGuideFilename(verticalName, slug) {
  if (verticalName === "trt") return `guides_trt_${slug}.json`;
  if (verticalName === "pi") return `${slug}.json`;
  return `guides_${slug}.json`;
}

function listJsonFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f));
}

function safeRename(oldPath, newPath) {
  if (oldPath === newPath) return { changed: false };
  if (fs.existsSync(newPath)) {
    // If same content, we can delete the old file; otherwise bail hard.
    const a = fs.readFileSync(oldPath, "utf8");
    const b = fs.readFileSync(newPath, "utf8");
    if (a === b) {
      fs.unlinkSync(oldPath);
      return { changed: true, note: "dedup_deleted_old" };
    }
    throw new Error(`Refusing to rename: target exists with different content:\n  from: ${oldPath}\n  to:   ${newPath}`);
  }
  fs.renameSync(oldPath, newPath);
  return { changed: true };
}

function syncVertical(repoRoot, v) {
  const folder = path.join(repoRoot, v.folderRel);
  if (!fs.existsSync(folder)) return { vertical: v.name, skipped: true, reason: "missing_folder" };

  const jsonFiles = listJsonFiles(folder);
  const guides = [];
  const renames = [];

  // 1) Discover guides by route
  for (const filePath of jsonFiles) {
    const base = path.basename(filePath);
    // skip the hub itself
    if (base === "guides.json") continue;

    let j;
    try {
      j = readJson(filePath);
    } catch (e) {
      continue;
    }
    if (!isObject(j)) continue;

    const route = j.route;
    const slug = normalizeRouteToSlug(route);
    if (!slug) continue;

    // Only treat as guide if it is NOT the hub route "/guides/"
    if (route === "/guides/") continue;

    const expectedName = canonicalGuideFilename(v.name, slug);
    const expectedPath = path.join(folder, expectedName);

    // rename if needed
    const currentPath = filePath;
    const currentName = path.basename(currentPath);
    if (currentName !== expectedName) {
      const res = safeRename(currentPath, expectedPath);
      if (res.changed) renames.push({ from: currentName, to: expectedName });
    }

    // read again from expected path (post-rename)
    const finalJson = readJson(expectedPath);
    guides.push({
      slug,
      route: finalJson.route,
      title: String(finalJson.title || "").trim() || slug,
      description: String(finalJson.description || "").trim(),
      file: path.basename(expectedPath),
      text: stripHtmlToText(finalJson.main_html || ""),
    });
  }

  // 2) Update hub guide_cards in guides.json (if present)
  const hubPath = path.join(folder, "guides.json");
  if (fs.existsSync(hubPath)) {
    const hub = readJson(hubPath);
    hub.guide_cards = guides
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((g) => ({ route: g.route, title: g.title, description: g.description }));
    writeJson(hubPath, hub);
  }

  // 3) Write canonical markdown doc
  const outDir = path.join(repoRoot, "docs", "_generated_guides");
  ensureDir(outDir);
  const outPath = path.join(outDir, `${v.name}_guides_canonical.md`);
  const lines = [];
  lines.push(`# ${v.name.toUpperCase()} Guides — Canonical (Auto-Generated)`);
  lines.push("");
  lines.push(`Generated from: ${v.folderRel}`);
  lines.push("");
  lines.push(`Total guides: ${guides.length}`);
  lines.push("");
  for (const g of guides.slice().sort((a, b) => a.slug.localeCompare(b.slug))) {
    lines.push(`---`);
    lines.push(`## ${g.title}`);
    lines.push(`- slug: \`${g.slug}\``);
    lines.push(`- route: \`${g.route}\``);
    lines.push(`- file: \`${g.file}\``);
    if (g.description) lines.push(`- description: ${g.description}`);
    lines.push("");
    lines.push(g.text || "");
    lines.push("");
  }
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  return { vertical: v.name, guideCount: guides.length, renames };
}

function main() {
  const repoRoot = process.cwd();

  const verticals = [
    { name: "dentistry", folderRel: "data/page_sets/examples/dentistry_global_pages" },
    { name: "neuro", folderRel: "data/page_sets/examples/neuro_global_pages" },
    { name: "uscis", folderRel: "data/page_sets/examples/uscis_medical_global_pages" },
    { name: "trt", folderRel: "data/page_sets/examples/trt_global_pages" },
    { name: "pi", folderRel: "data/page_sets/examples/pi_global_pages" },
  ];

  const results = verticals.map((v) => syncVertical(repoRoot, v));

  // Summary
  let totalGuides = 0;
  let totalRenames = 0;
  for (const r of results) {
    if (r && r.guideCount != null) {
      totalGuides += r.guideCount;
      totalRenames += (r.renames || []).length;
    }
  }
  console.log(`SYNC GUIDES: done. guides=${totalGuides} renames=${totalRenames}`);
}

main();
