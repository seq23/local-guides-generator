#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * DIST COMPLIANCE SCAN (baseline)
 *
 * Goal:
 *   Keep a small set of "internal/editorial-only" strings from leaking onto
 *   core non-guide pages.
 *
 * Site reality:
 *   - dist/guides/** are editorial guide pages and ARE allowed to include
 *     "Last updated:".
 *   - All other dist/**/*.html pages must NOT include the banned tokens below.
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist");

function die(msg) {
  console.error(`❌ DIST COMPLIANCE SCAN FAIL: ${msg}`);
  process.exit(1);
}

function listHtmlFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...listHtmlFiles(p));
    } else if (e.isFile() && e.name.endsWith(".html")) {
      out.push(p);
    }
  }
  return out;
}

// Tokens that should never appear on non-guide pages.
// Keep this list tight—only include things we truly want to prevent.
const BANNED_TOKENS_GENERAL = [
  "Internal draft:",
  "DO NOT SHIP",
  "FIXME:",
  "TODO:",
  // "Last updated:" is allowed on guides; see guide policy below.
  "Last updated:",
];

function bannedTokensForFile(rel) {
  // Guides are editorial; allow "Last updated:" on guides.
  if (rel.startsWith("guides/")) {
    return BANNED_TOKENS_GENERAL.filter((t) => t !== "Last updated:");
  }
  return BANNED_TOKENS_GENERAL;
}

function main() {
  if (!fs.existsSync(distRoot)) {
    die("dist/ missing. Run build first.");
  }

  const files = listHtmlFiles(distRoot);
  const offenders = [];

  for (const abs of files) {
    const rel = path.relative(distRoot, abs).replace(/\\/g, "/");
    const html = fs.readFileSync(abs, "utf8");
    const banned = bannedTokensForFile(rel);

    for (const token of banned) {
      const idx = html.indexOf(token);
      if (idx !== -1) {
        // Provide a tiny context snippet for debugging.
        const start = Math.max(0, idx - 40);
        const end = Math.min(html.length, idx + token.length + 60);
        const snippet = html.slice(start, end).replace(/\s+/g, " ").trim();
        offenders.push({ rel, token, snippet });
      }
    }
  }

  if (offenders.length) {
    console.error("Found banned tokens in dist:");
    for (const o of offenders) {
      console.error(`- ${o.rel}: \"${o.token}\" ... ${o.snippet}`);
    }
    die(`Banned tokens found (${offenders.length}). Remove from templates/content or keep them in allowed locations.`);
  }

  console.log("✅ DIST COMPLIANCE SCAN PASS");
}

main();
