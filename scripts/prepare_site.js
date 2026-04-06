#!/usr/bin/env node
/**
 * Prepare the active pack site state before a build.
 *
 * Purpose:
 * - Resolve the active page set, canonical site URL, and brand metadata.
 * - Write the active site contract into data/site.json.
 * - Enforce pack-level domain rules before rendering begins.
 *
 * Inputs:
 * - PAGE_SET_FILE environment variable or existing data/site.json state.
 * - Optional BRAND_NAME, SITE_URL, CI, REQUIRE_SITE_URL, and LKG_ENV environment variables.
 *
 * Outputs:
 * - Updated data/site.json for the active pack.
 *
 * Side effects:
 * - Can rewrite for-providers canonical inventory content.
 * - Fails hard on placeholder or missing site URLs.
 *
 * Use this when:
 * - Switching packs or preparing the repo for any build or validation run.
 */

const fs = require("fs");
const path = require("path");
const { getPackSiteConfig } = require("./lib/pack_site_config");

const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");
const sitePath = path.join(dataDir, "site.json");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function syncForProvidersCanonicalInventory() {
  const canonicalDoc = path.join(
    repoRoot,
    "docs/runbooks/monetization_ads_buyouts/02_CANONICAL_AD_SYSTEM_AND_CHECKLIST.md"
  );
  const forProvidersJson = path.join(repoRoot, "data/global_pages/for-providers.json");

  if (!fs.existsSync(canonicalDoc)) {
    die(`ERROR: Missing canonical doc: ${canonicalDoc}`);
  }
  if (!fs.existsSync(forProvidersJson)) {
    die(`ERROR: Missing for-providers source: ${forProvidersJson}`);
  }

  const md = fs.readFileSync(canonicalDoc, "utf8");
  const fenceRe = /```json\s*\n(\{[\s\S]*?"version"\s*:\s*"CANONICAL_AD_INVENTORY_V1"[\s\S]*?\})\s*\n```/m;
  const m = md.match(fenceRe);
  if (!m) {
    die(
      "ERROR: Could not find canonical inventory JSON fence (version CANONICAL_AD_INVENTORY_V1) in canonical doc."
    );
  }

  let canonical;
  try {
    canonical = JSON.parse(m[1]);
  } catch (e) {
    die(`ERROR: Canonical inventory JSON is not valid JSON. ${String(e)}`);
  }

  let fp;
  try {
    fp = JSON.parse(fs.readFileSync(forProvidersJson, "utf8"));
  } catch (e) {
    die(`ERROR: for-providers.json is not valid JSON. ${String(e)}`);
  }

  const html = String(fp.main_html || "");
  const scriptRe = /(<script[^>]+id="canonical-ad-inventory-v1"[^>]*>)([\s\S]*?)(<\/script>)/m;
  const sm = html.match(scriptRe);
  if (!sm) {
    die(
      'ERROR: for-providers.json main_html missing <script id="canonical-ad-inventory-v1"> tag.'
    );
  }

  const pretty = JSON.stringify(canonical, null, 2);
  const nextHtml = html.replace(scriptRe, `$1\n${pretty}\n$3`);
  if (nextHtml !== html) {
    fp.main_html = nextHtml;
    fs.writeFileSync(forProvidersJson, JSON.stringify(fp, null, 2) + "\n", "utf8");
    console.log("==> Synced /for-providers/ canonical ad inventory JSON from canonical doc.");
  }
}

function readExistingSite() {
  try {
    if (!fs.existsSync(sitePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(sitePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

const EXISTING_SITE = readExistingSite();
const PACK_SITE = getPackSiteConfig(process.env.PAGE_SET_FILE || EXISTING_SITE?.pageSetFile || "");
const FALLBACK_BRAND_NAME = String(PACK_SITE?.brandName || EXISTING_SITE?.brandName || "The Industry Guides").trim() || "The Industry Guides";
const FALLBACK_SITE_URL = String(PACK_SITE?.siteUrl || EXISTING_SITE?.siteUrl || "").trim();
const BRAND_NAME = String(process.env.BRAND_NAME || FALLBACK_BRAND_NAME).trim() || FALLBACK_BRAND_NAME;
const SITE_URL = String(process.env.SITE_URL || FALLBACK_SITE_URL).trim();

const CI = String(process.env.CI || '').toLowerCase() === 'true';
const REQUIRE_SITE_URL = String(process.env.REQUIRE_SITE_URL || '').toLowerCase() === '1' || !!process.env.INDEXNOW_KEY;
if (!SITE_URL || /placeholder-domain\.invalid/i.test(SITE_URL)) {
  console.error('prepare_site requires a real SITE_URL. Refusing placeholder domains.');
  process.exit(1);
}

if (CI && REQUIRE_SITE_URL && (!SITE_URL || /placeholder-domain\.invalid/i.test(SITE_URL))) {
  console.error('CI build requires SITE_URL to be set to the deployed canonical domain.');
  process.exit(1);
}

const PAGE_SET_FILE = process.env.PAGE_SET_FILE;
const LKG_ENV = (process.env.LKG_ENV || "baseline").toLowerCase();

function normalizeInputPath(raw) {
  return String(raw || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function normalizeToCanonicalPageSetPath(rawPageSetFile) {
  const s0 = normalizeInputPath(rawPageSetFile);
  if (!s0) return "";

  const needle = "data/page_sets/";
  const idx = s0.indexOf(needle);
  if (idx === -1) {
    die(
      'ERROR: PAGE_SET_FILE must be a repo-relative path under data/page_sets/.\n' +
      `Received: "${rawPageSetFile}"\n` +
      'Use a canonical path like: data/page_sets/examples/uscis_medical_v1.json'
    );
  }

  const rel = s0.slice(idx + needle.length).replace(/^\/+/, "");
  if (!rel) {
    die(`ERROR: PAGE_SET_FILE resolved to an empty path from: "${rawPageSetFile}"`);
  }

  return `${needle}${rel}`;
}

if (!PAGE_SET_FILE) {
  die(
    "ERROR: PAGE_SET_FILE is required. Refusing to default to starter_v1.\n" +
      "Set PAGE_SET_FILE to a real page set (e.g. data/page_sets/examples/trt_v1.json).\n" +
      "For training builds only, set LKG_ENV=training and PAGE_SET_FILE=data/page_sets/starter_v1.json."
  );
}

if (LKG_ENV !== "training" && PAGE_SET_FILE.endsWith("starter_v1.json")) {
  die(
    "ERROR: starter_v1.json is TRAINING ONLY and not allowed for baseline builds.\n" +
      "Choose a canonical page set explicitly (e.g. data/page_sets/examples/trt_v1.json)."
  );
}

const PAGE_SET_FILE_CANONICAL = normalizeToCanonicalPageSetPath(PAGE_SET_FILE);
if (!PAGE_SET_FILE_CANONICAL) {
  die('ERROR: PAGE_SET_FILE is required (e.g. data/page_sets/examples/pi_v1.json)');
}

const pageSetAbs = path.join(repoRoot, PAGE_SET_FILE_CANONICAL);
if (!fs.existsSync(pageSetAbs)) {
  die(`ERROR: PAGE_SET_FILE does not exist: ${PAGE_SET_FILE_CANONICAL}`);
}

// Enforce sales parity deterministically: keep /for-providers/ embedded inventory in sync.
syncForProvidersCanonicalInventory();

ensureDir(dataDir);

const site = {
  brandName: BRAND_NAME,
  siteUrl: SITE_URL,
  // Store the canonical repo-relative path to remove ambiguity everywhere.
  pageSetFile: PAGE_SET_FILE_CANONICAL,
  buildIso: new Date().toISOString(),
};

fs.writeFileSync(sitePath, JSON.stringify(site, null, 2) + "\n", "utf8");

console.log("WROTE: data/site.json");
console.log("brandName:", BRAND_NAME);
console.log("siteUrl:", SITE_URL);
console.log("pageSetFile:", PAGE_SET_FILE_CANONICAL);
console.log("LKG_ENV:", LKG_ENV);
