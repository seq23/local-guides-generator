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

const BRAND_NAME = process.env.BRAND_NAME || "The Industry Guides";
const SITE_URL = process.env.SITE_URL || "https://example.com";

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
