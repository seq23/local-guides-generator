#!/usr/bin/env node
const { execSync } = require("child_process");

const FORBIDDEN_PREFIXES = [
  "index.html",
  "about.html",
  "privacy.html",
  "methodology.html",
  "guides/",
  "hubs/",
  "cities/",
  "verticals/",
];

const ALLOWED_PREFIXES = [
  "reference/",
  "_reference_index/",
  "data/reference/",
  "sitemaps/sitemap_reference.xml",
  "llms.txt",
  ".build/",
];

const out = execSync("git diff --name-only", { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const bad = out.filter((file) => {
  if (ALLOWED_PREFIXES.some((p) => file.startsWith(p))) return false;
  return FORBIDDEN_PREFIXES.some((p) => file.startsWith(p));
});

if (bad.length) {
  console.error("guard_visible_surfaces failed:");
  for (const f of bad) console.error(` - ${f}`);
  process.exit(1);
}

console.log("guard_visible_surfaces: OK");
