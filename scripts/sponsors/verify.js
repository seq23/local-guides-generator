#!/usr/bin/env node
/**
 * Sponsor System — VERIFY
 * Checks:
 * - sponsor.json references valid files
 * - campaigns reference real sponsors
 * - generated outputs exist
 * - optional: Cloudflare Images map consistency
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = process.cwd();
const INTAKE_DIR = path.join(REPO_ROOT, "data", "sponsor_intake");
const SPONSORS_DIR = path.join(INTAKE_DIR, "sponsors");
const CAMPAIGNS_DIR = path.join(INTAKE_DIR, "campaigns");
const OUT_GLOBAL = path.join(REPO_ROOT, "data", "sponsors", "global.json");

function die(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) { console.log(`OK: ${msg}`); }

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8").replace(/^\/\/.*\n/gm, ""));
}

function exists(p) { return fs.existsSync(p); }

function main() {
  if (!exists(SPONSORS_DIR)) die(`missing ${SPONSORS_DIR}`);
  if (!exists(CAMPAIGNS_DIR)) die(`missing ${CAMPAIGNS_DIR}`);

  const sponsors = {};
  const sponsorFolders = fs.readdirSync(SPONSORS_DIR).filter(n => fs.statSync(path.join(SPONSORS_DIR, n)).isDirectory());
  for (const folder of sponsorFolders) {
    const p = path.join(SPONSORS_DIR, folder, "sponsor.json");
    if (!exists(p)) continue;
    const s = readJson(p);
    sponsors[s.sponsor_slug] = { sponsor: s, dir: path.join(SPONSORS_DIR, folder) };

    const assets = s.assets || {};
    for (const [k, rel] of Object.entries(assets)) {
      const fp = path.join(SPONSORS_DIR, folder, rel);
      if (!exists(fp)) die(`sponsor ${s.sponsor_slug} missing asset ${k}: ${fp}`);
    }
  }
  ok(`loaded sponsors: ${Object.keys(sponsors).length}`);

  const campaigns = fs.readdirSync(CAMPAIGNS_DIR).filter(f => f.endsWith(".json")).map(f => path.join(CAMPAIGNS_DIR, f));
  for (const p of campaigns) {
    const c = readJson(p);
    if (!sponsors[c.sponsor_slug]) die(`campaign ${c.campaign_slug} references missing sponsor_slug: ${c.sponsor_slug}`);
    if (!c.scope || !c.scope.type) die(`campaign ${c.campaign_slug} missing scope.type`);
  }
  ok(`campaigns validated: ${campaigns.length}`);

  if (!exists(OUT_GLOBAL)) die(`missing generated file: ${OUT_GLOBAL}`);
  ok(`generated output present: data/sponsors/global.json`);

  console.log("PASS ✅");
}

main();
