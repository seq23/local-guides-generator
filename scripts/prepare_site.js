#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

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

const BRAND_NAME = process.env.BRAND_NAME || "The Industry Guides";
const SITE_URL = process.env.SITE_URL || "https://example.com";

const CI = String(process.env.CI || '').toLowerCase() === 'true';
const REQUIRE_SITE_URL = String(process.env.REQUIRE_SITE_URL || '').toLowerCase() === '1' || !!process.env.INDEXNOW_KEY;
if (CI && REQUIRE_SITE_URL && (!SITE_URL || SITE_URL.includes('example.com'))) {
  console.error('CI build requires SITE_URL to be set to the deployed domain (e.g. https://theaccidentguides.com).');
  process.exit(1);
}

const PAGE_SET_FILE = process.env.PAGE_SET_FILE;
const LKG_ENV = (process.env.LKG_ENV || "baseline").toLowerCase();

function normalizeInputPath(raw) {
  return String(raw || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

function normalizeToPageSetsRel(rawPageSetFile) {
  const s0 = normalizeInputPath(rawPageSetFile);
  if (!s0) return "";

  // Strip any leading repo root prefix up to and including data/page_sets/
  const idx = s0.indexOf("data/page_sets/");
  const s1 = idx >= 0 ? s0.slice(idx + "data/page_sets/".length) : s0;

  // Some callers pass page_sets/... (without the leading data/)
  const s2 = s1.replace(/^page_sets\//, "");

  // If someone passes an absolute path that happens to end with data/page_sets/...,
  // the idx strip above handles it.
  return s2.replace(/^\/+/, "");
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
      "Choose an examples/* page set explicitly (e.g. data/page_sets/examples/trt_v1.json)."
  );
}

const PAGE_SET_FILE_REL = normalizeToPageSetsRel(PAGE_SET_FILE);
if (!PAGE_SET_FILE_REL) {
  die('ERROR: PAGE_SET_FILE is required (e.g. data/page_sets/examples/pi_v1.json)');
}

// Enforce sales parity deterministically: keep /for-providers/ embedded inventory in sync.
syncForProvidersCanonicalInventory();

ensureDir(dataDir);

const site = {
  brandName: BRAND_NAME,
  siteUrl: SITE_URL,
  // Store relative to data/page_sets/ (e.g. examples/pi_v1.json)
  pageSetFile: PAGE_SET_FILE_REL,
  buildIso: new Date().toISOString(),
};

fs.writeFileSync(sitePath, JSON.stringify(site, null, 2) + "\n", "utf8");

console.log("WROTE: data/site.json");
console.log("brandName:", BRAND_NAME);
console.log("siteUrl:", SITE_URL);
console.log("pageSetFile:", PAGE_SET_FILE_REL);
console.log("LKG_ENV:", LKG_ENV);
