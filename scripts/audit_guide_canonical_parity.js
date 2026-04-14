#!/usr/bin/env node
/**
 * GUIDE CANONICAL PARITY (GLOBAL AUDIT — RUN ONCE)
 *
 * This is a diagnostic audit (WARN-only). It writes:
 *   dist/_guide_canonical_parity_global.csv
 *
 * It compares:
 *   - Auto-generated canonical masters in docs/_generated_guides/*.md
 *   - Guide JSON files in each vertical's *_global_pages folder
 *
 * Master format:
 *   --- GUIDE START: <slug>
 *   ...
 *   --- GUIDE END: <slug>
 */
const fs = require("fs");
const path = require("path");

function _findFirstExisting(paths) {
  for (const x of (paths || [])) {
    if (!x) continue;
    try {
      if (fs.existsSync(x)) return x;
    } catch (e) {}
  }
  return null;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function norm(s) {
  return String(s || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseGuideBodiesFromMaster(mdText) {
  const out = {};
  const lines = String(mdText || "").split("\n");
  let curSlug = null;
  let buf = [];
  const flush = () => {
    if (curSlug) out[curSlug] = buf.join("\n").trim() + "\n";
    buf = [];
  };
  for (const line of lines) {
    const mStart = line.match(/^---\s*GUIDE START:\s*(.+?)\s*$/);
    if (mStart) {
      flush();
      curSlug = String(mStart[1] || "").trim();
      continue;
    }
    const mEnd = line.match(/^---\s*GUIDE END:\s*(.+?)\s*$/);
    if (mEnd) {
      flush();
      curSlug = null;
      continue;
    }
    if (curSlug) buf.push(line);
  }
  flush();
  return out;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");

  const mappings = [
    {
      name: "dentistry",
      master: _findFirstExisting([path.join(repoRoot, "docs", "_generated_guides", "dentistry_master.md")]),
      folder: _findFirstExisting([path.join(repoRoot, "data", "page_sets", "examples", "dentistry_global_pages")]),
      filename: (slug) => `guides_${slug}.json`,
    },
    {
      name: "neuro",
      master: _findFirstExisting([path.join(repoRoot, "docs", "_generated_guides", "neuro_master.md")]),
      folder: _findFirstExisting([path.join(repoRoot, "data", "page_sets", "examples", "neuro_global_pages")]),
      filename: (slug) => `guides_${slug}.json`,
    },
    {
      name: "uscis",
      master: _findFirstExisting([path.join(repoRoot, "docs", "_generated_guides", "uscis_medical_master.md")]),
      folder: _findFirstExisting([path.join(repoRoot, "data", "page_sets", "examples", "uscis_medical_global_pages")]),
      filename: (slug) => `guides_${slug}.json`,
    },
    {
      name: "trt",
      master: _findFirstExisting([path.join(repoRoot, "docs", "_generated_guides", "trt_master.md")]),
      folder: _findFirstExisting([path.join(repoRoot, "data", "page_sets", "examples", "trt_global_pages")]),
      filename: (slug) => `guides_trt_${slug}.json`,
    },
  ];

  const mismatches = [];

  for (const m of mappings) {
    if (!m.folder || !fs.existsSync(m.folder)) continue;
    if (!m.master || !fs.existsSync(m.master)) continue;

    const masterText = fs.readFileSync(m.master, "utf8");
    const masterBodies = parseGuideBodiesFromMaster(masterText);
    const slugs = Object.keys(masterBodies).sort();

    for (const slug of slugs) {
      const jsonPath = path.join(m.folder, m.filename(slug));
      if (!fs.existsSync(jsonPath)) {
        mismatches.push([m.name, slug, "missing_json", path.relative(repoRoot, jsonPath)]);
        continue;
      }

      const obj = readJson(jsonPath);
      const jsonBody = norm(obj.main_html || "");
      const masterRaw = String(masterBodies[slug] || "");
      const masterSansMeta = masterRaw
        .split("\n")
        .filter((ln) => !/^(Title|Description|Filename|Route):\s*/.test(ln.trim()))
        .join("\n");
      const masterBody = norm(masterSansMeta);

      if (jsonBody !== masterBody) {
        mismatches.push([m.name, slug, "content_mismatch", path.relative(repoRoot, jsonPath)]);
      }
    }
  }

  const outPath = path.join(repoRoot, "dist", "_guide_canonical_parity_global.csv");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const header = "vertical,slug,reason,file\n";
  const rows = mismatches.map((r) => r.map((x) => String(x).replace(/"/g, '""')).join(",")).join("\n");
  fs.writeFileSync(outPath, header + (rows ? rows + "\n" : ""), "utf8");

  if (mismatches.length) {
    console.log(`GUIDE CANONICAL PARITY (GLOBAL AUDIT): WARN (${mismatches.length} mismatches) -> dist/_guide_canonical_parity_global.csv`);
  } else {
    console.log("GUIDE CANONICAL PARITY (GLOBAL AUDIT): OK (0 mismatches)");
  }
}

if (require.main === module) main();
