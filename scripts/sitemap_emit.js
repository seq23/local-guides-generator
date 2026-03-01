#!/usr/bin/env node
/**
 * Emits dist/sitemap.xml
 *
 * - Uses SITE_URL (preferred) or falls back to data/site.json siteUrl.
 * - In CI: if it can't determine a usable base URL, it FAILS (prevents shipping bad sitemaps).
 * - Locally: if missing, it warns and no-ops (so dev flow isn't blocked).
 */
const fs = require("fs");
const path = require("path");

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function isCi() {
  return String(process.env.CI || "").toLowerCase() === "true";
}

function getBaseUrl() {
  const fromEnv = String(process.env.SITE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/,"");
  const site = readJson(path.join(process.cwd(), "data", "site.json"));
  const fromSite = site && typeof site.siteUrl === "string" ? site.siteUrl.trim() : "";
  if (fromSite) return fromSite.replace(/\/+$/,"");
  return "";
}

function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else out.push(p);
    }
  }
  return out;
}

function toUrlPath(distDir, filePath) {
  const rel = path.relative(distDir, filePath).replace(/\\/g, "/");
  // We only want canonical page URLs (folders with index.html):
  //   dist/foo/index.html -> /foo/
  //   dist/index.html     -> /
  if (!rel.endsWith("/index.html") && rel !== "index.html") return null;
  if (rel === "index.html") return "/";
  const folder = rel.slice(0, -"/index.html".length);
  return `/${folder}/`;
}

function xmlEscape(s) {
  return s
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

function main() {
  const distDir = path.join(process.cwd(), "dist");
  if (!fs.existsSync(distDir)) {
    console.error("sitemap_emit: dist/ not found. Run a build first.");
    process.exit(1);
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    const msg = "sitemap_emit: Missing SITE_URL (or data/site.json siteUrl).";
    if (isCi()) {
      console.error(msg + " Refusing to ship a broken sitemap in CI.");
      process.exit(1);
    } else {
      console.warn(msg + " Skipping sitemap generation locally.");
      return;
    }
  }

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    const msg = `sitemap_emit: SITE_URL is not a valid URL: ${baseUrl}`;
    if (isCi()) { console.error(msg); process.exit(1); }
    console.warn(msg + " Skipping locally.");
    return;
  }

  const files = walkFiles(distDir);
  const paths = [];
  for (const f of files) {
    const u = toUrlPath(distDir, f);
    if (u) paths.push(u);
  }

  // Deterministic ordering
  paths.sort((a,b)=>a.localeCompare(b));

  const urls = paths.map(p => {
    const loc = new URL(p, base).toString();
    return `  <url><loc>${xmlEscape(loc)}</loc></url>`;
  }).join("\n");

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  fs.writeFileSync(path.join(distDir, "sitemap.xml"), xml, "utf8");
  console.log(`sitemap_emit: wrote dist/sitemap.xml (${paths.length} urls) base=${base.origin}`);
}

main();
