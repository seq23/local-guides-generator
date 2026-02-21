#!/usr/bin/env node
/**
 * Emits:
 *  - dist/indexnow.txt (key)
 *  - dist/robots.txt (sitemap line appended if missing)
 *
 * Rules:
 *  - If INDEXNOW_KEY is not set, do nothing (safe no-op).
 *  - If INDEXNOW_KEY is set in CI, require SITE_URL (or INDEXNOW_HOST/INDEXNOW_HOSTS) to be configured
 *    to avoid generating a wrong keyLocation.
 *  - Supports the common mistake where INDEXNOW_KEY secret contains multiple lines including INDEXNOW_HOSTS=...
 */
const fs = require("fs");
const path = require("path");
const { getIndexNowConfig } = require("./lib/indexnow_config");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const cfg = getIndexNowConfig();
  if (!cfg.key) {
    // No secret, no-op.
    return;
  }

  // Determine host to use for keyLocation + sitemap URL.
  const host = cfg.primaryHost;
  if (cfg.ci && !host) {
    console.error(
      "INDEXNOW_KEY is set but no host is configured. Set SITE_URL (recommended) or INDEXNOW_HOST / INDEXNOW_HOSTS."
    );
    process.exit(1);
  }

  const distDir = path.join(process.cwd(), "dist");
  ensureDir(distDir);

  // indexnow.txt: MUST be key only.
  const indexNowPath = path.join(distDir, "indexnow.txt");
  fs.writeFileSync(indexNowPath, cfg.key, "utf8");

  // robots.txt: ensure it contains a sitemap pointer for the configured host if available,
  // otherwise keep existing robots untouched.
  const robotsPath = path.join(distDir, "robots.txt");
  let robots = "";
  if (fs.existsSync(robotsPath)) robots = fs.readFileSync(robotsPath, "utf8");
  const sitemapLine = host ? `Sitemap: https://${host}/sitemap.xml` : "";

  if (sitemapLine) {
    const hasSitemap = robots.toLowerCase().includes("sitemap:");
    if (!hasSitemap) {
      robots = robots ? robots.trimEnd() + "\n" : "";
      robots += sitemapLine + "\n";
      fs.writeFileSync(robotsPath, robots, "utf8");
    }
  }

  // Optional sanity log (never prints secret)
  console.log(`IndexNow: wrote dist/indexnow.txt${host ? ` (host=${host})` : ""}`);
}

main();
