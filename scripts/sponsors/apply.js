#!/usr/bin/env node
/**
 * Sponsor System — APPLY
 *
 * Reads:
 *  - data/sponsor_intake/sponsors/*/sponsor.json
 *  - data/sponsor_intake/campaigns/*.json
 *
 * Generates:
 *  - assets/sponsors/<slug>/* + manifest.json
 *  - data/sponsors/global.json
 *  - data/sponsors/<citySlug>.json (only when needed)
 *  - optional: updates data/listings/<citySlug>.json sponsor blocks (when enabled)
 *
 * Optional:
 *  --upload-cf-images  uploads sponsor assets to Cloudflare Images and uses delivery URLs
 *
 * Guardrails:
 *  - Hard-fails on missing assets, missing sponsor references, invalid scope targets
 *  - Generated files have an AUTO-GENERATED header and should not be edited manually
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const REPO_ROOT = process.cwd();
const INTAKE_DIR = path.join(REPO_ROOT, "data", "sponsor_intake");
const SPONSORS_DIR = path.join(INTAKE_DIR, "sponsors");
const CAMPAIGNS_DIR = path.join(INTAKE_DIR, "campaigns");

const OUT_ASSETS_DIR = path.join(REPO_ROOT, "assets", "sponsors");
const OUT_SPONSORS_DIR = path.join(REPO_ROOT, "data", "sponsors");

const GENERATED_HDR = (label) =>
  `// AUTO-GENERATED — DO NOT EDIT\n// ${label}\n// Generated: ${new Date().toISOString()}\n`;

function die(msg) {
  console.error(`\nFATAL: ${msg}\n`);
  process.exit(1);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(`Failed to read JSON: ${p}\n${e.message}`);
  }
}

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p, exts));
    else if (!exts || exts.includes(path.extname(entry.name).toLowerCase())) out.push(p);
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sha256File(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function slugOk(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function parseDateOrNull(s) {
  if (s === null || s === undefined) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

function isActiveCampaign(c) {
  const now = new Date();
  const start = parseDateOrNull(c.starts_on);
  const end = parseDateOrNull(c.ends_on);
  if (!start) die(`Campaign ${c.campaign_slug} has invalid starts_on`);
  if (now < start) return false;
  if (end && now > end) return false;
  return true;
}

/**
 * Resolve city/state universe.
 * This repo’s runtime inventory patterns vary; we keep resolution strict but pluggable:
 * - If data/listings/ exists, city slugs = filenames without extension
 * - States can be inferred from city slug suffix "-tx" etc if present
 */
function getCityUniverse() {
  const listingsDir = path.join(REPO_ROOT, "data", "listings");
  if (!fs.existsSync(listingsDir)) return [];
  return fs.readdirSync(listingsDir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""));
}

function cityHasState(citySlug) {
  const m = citySlug.match(/-([a-z]{2})$/);
  return m ? m[1] : null;
}

function resolveScope(scope, cityUniverse) {
  const type = scope?.type;
  if (!type) die("Campaign scope.type missing");

  if (type === "site") {
    return { cities: [], mode: "site" }; // site-wide handled as global
  }
  if (type === "vertical") {
    return { cities: [], mode: "vertical" };
  }
  if (type === "city") {
    const cities = scope.cities || [];
    if (!Array.isArray(cities) || cities.length === 0) die("scope.cities must be a non-empty array");
    const missing = cities.filter(c => !cityUniverse.includes(c));
    if (missing.length) die(`Campaign city scope includes unknown city slugs: ${missing.join(", ")}`);
    return { cities, mode: "city" };
  }
  if (type === "state") {
    const states = (scope.states || []).map(s => String(s).toLowerCase());
    if (!Array.isArray(states) || states.length === 0) die("scope.states must be a non-empty array");
    const cities = cityUniverse.filter(c => states.includes(cityHasState(c)));
    if (cities.length === 0) die(`No city slugs matched state scope: ${states.join(", ")}`);
    return { cities, mode: "state" };
  }
  die(`Unknown scope.type: ${type}`);
}

function loadSponsors() {
  if (!fs.existsSync(SPONSORS_DIR)) die(`Missing sponsors dir: ${SPONSORS_DIR}`);
  const out = {};
  const sponsorFolders = fs.readdirSync(SPONSORS_DIR).filter(n => fs.statSync(path.join(SPONSORS_DIR, n)).isDirectory());
  for (const folder of sponsorFolders) {
    const sponsorJsonPath = path.join(SPONSORS_DIR, folder, "sponsor.json");
    if (!fs.existsSync(sponsorJsonPath)) continue;
    const s = readJson(sponsorJsonPath);
    if (!s.sponsor_slug) die(`Missing sponsor_slug in ${sponsorJsonPath}`);
    if (!slugOk(s.sponsor_slug)) die(`Invalid sponsor_slug '${s.sponsor_slug}' in ${sponsorJsonPath}`);
    out[s.sponsor_slug] = { sponsor: s, dir: path.join(SPONSORS_DIR, folder) };
  }
  return out;
}

function loadCampaigns() {
  if (!fs.existsSync(CAMPAIGNS_DIR)) ensureDir(CAMPAIGNS_DIR);
  const files = fs.readdirSync(CAMPAIGNS_DIR).filter(f => f.endsWith(".json")).map(f => path.join(CAMPAIGNS_DIR, f));
  return files.map(p => ({ path: p, campaign: readJson(p) }));
}

function ingestAssets(sponsors) {
  ensureDir(OUT_ASSETS_DIR);
  const manifests = {};
  for (const [slug, meta] of Object.entries(sponsors)) {
    const sponsor = meta.sponsor;
    const intakeAssetsDir = path.join(meta.dir, "assets");
    if (!fs.existsSync(intakeAssetsDir)) die(`Missing assets folder for sponsor ${slug}: ${intakeAssetsDir}`);

    const outDir = path.join(OUT_ASSETS_DIR, slug);
    ensureDir(outDir);

    // Validate all referenced assets exist and copy
    const assetMap = sponsor.assets || {};
    const copied = {};
    for (const [key, rel] of Object.entries(assetMap)) {
      const src = path.join(meta.dir, rel);
      if (!fs.existsSync(src)) die(`Sponsor ${slug} missing asset for '${key}': ${src}`);
      const dstName = path.basename(rel);
      const dst = path.join(outDir, dstName);
      copyFile(src, dst);
      copied[key] = {
        filename: dstName,
        sha256: sha256File(dst),
        local_path: `assets/sponsors/${slug}/${dstName}`
      };
    }

    // Write manifest
    const manifest = {
      sponsor_slug: slug,
      generated_at: new Date().toISOString(),
      assets: copied
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    manifests[slug] = manifest;
  }
  return manifests;
}

/**
 * Optional Cloudflare Images upload.
 * Requirements:
 * - CF_ACCOUNT_ID and CF_API_TOKEN env vars
 * - Token scopes should include Cloudflare Images write/upload.
 *
 * This uses curl to avoid SDK dependencies.
 * It dedupes by sha256 using a local map file: data/_generated/cf_images_map.json
 */
function uploadToCloudflareImages(manifests, sponsors, force=false) {
  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!account || !token) die("CF_ACCOUNT_ID and CF_API_TOKEN must be set for --upload-cf-images");

  const genDir = path.join(REPO_ROOT, "data", "_generated");
  ensureDir(genDir);
  const mapPath = path.join(genDir, "cf_images_map.json");
  let map = {};
  if (fs.existsSync(mapPath)) map = readJson(mapPath);

  for (const [slug, manifest] of Object.entries(manifests)) {
    map[slug] = map[slug] || {};
    const outDir = path.join(OUT_ASSETS_DIR, slug);

    for (const [key, info] of Object.entries(manifest.assets)) {
      const sha = info.sha256;
      const filePath = path.join(REPO_ROOT, info.local_path);

      const existing = map[slug][key];
      if (existing && existing.sha256 === sha && !force) {
        // already uploaded
        continue;
      }

      // upload
      const name = `${slug}-${key}`;
      const cmd = [
        "curl", "-s",
        "https://api.cloudflare.com/client/v4/accounts/" + account + "/images/v1",
        "-H", "Authorization: Bearer " + token,
        "-F", "file=@" + filePath,
        "-F", "id=" + name,
        "-F", "metadata={\"sponsor_slug\":\"" + slug + "\",\"asset_key\":\"" + key + "\",\"sha256\":\"" + sha + "\"}"
      ];
      let res;
      try {
        res = execFileSync(cmd[0], cmd.slice(1), { encoding: "utf8" });
      } catch (e) {
        die(`Cloudflare Images upload failed for ${slug}:${key}\n${e.message}`);
      }
      let json;
      try { json = JSON.parse(res); } catch { die(`Cloudflare Images response not JSON:\n${res}`); }
      if (!json.success) die(`Cloudflare Images upload error for ${slug}:${key}\n${JSON.stringify(json.errors)}`);

      const variants = json.result?.variants || [];
      if (!variants.length) die(`Cloudflare Images upload returned no variants for ${slug}:${key}`);

      map[slug][key] = {
        sha256: sha,
        cf_id: json.result.id,
        variant: variants[0]
      };
    }
  }

  fs.writeFileSync(mapPath, JSON.stringify(map, null, 2));
  return map;
}

function buildSponsorBlocks(sponsor, manifest, cfMapForSlug=null) {
  // returns a normalized sponsor block used by your sponsor stacks and nextStepsSponsor
  const slug = sponsor.sponsor_slug;
  const assets = sponsor.assets || {};
  const getAssetUrl = (key) => {
    if (cfMapForSlug && cfMapForSlug[key] && cfMapForSlug[key].variant) return cfMapForSlug[key].variant;
    const m = manifest.assets[key];
    return m ? `/${m.local_path}` : null;
  };

  return {
    sponsorSlug: slug,
    displayName: sponsor.display_name,
    ctaText: sponsor.cta_text,
    ctaUrl: sponsor.cta_url,
    website: sponsor.website,
    disclosure: sponsor.disclosure,
    assets: {
      logo: getAssetUrl("logo"),
      hero: getAssetUrl("hero"),
      ad_300x250: getAssetUrl("ad_300x250"),
      ad_728x90: getAssetUrl("ad_728x90")
    }
  };
}

function writeGeneratedJson(p, obj, label) {
  ensureDir(path.dirname(p));
  const body = JSON.stringify(obj, null, 2);
  const out = GENERATED_HDR(label) + body + "\n";
  fs.writeFileSync(p, out);
}

function stripGeneratedHeader(content) {
  // remove leading // AUTO-GENERATED header lines
  return content.replace(/^\/\/ AUTO-GENERATED[\s\S]*?\n(?=\{|\[)/, "");
}

function main() {
  const args = process.argv.slice(2);
  const uploadCf = args.includes("--upload-cf-images");
  const forceCf = args.includes("--force");

  const sponsors = loadSponsors();
  const campaigns = loadCampaigns();
  const cityUniverse = getCityUniverse();

  // Basic campaign validation
  for (const { path: p, campaign: c } of campaigns) {
    if (!c.campaign_slug) die(`Missing campaign_slug in ${p}`);
    if (!c.sponsor_slug) die(`Missing sponsor_slug in ${p}`);
    if (!sponsors[c.sponsor_slug]) die(`Campaign ${c.campaign_slug} references missing sponsor_slug: ${c.sponsor_slug}`);
    if (!c.scope || !c.scope.type) die(`Campaign ${c.campaign_slug} missing scope.type`);
  }

  const manifests = ingestAssets(sponsors);
  let cfMap = null;
  if (uploadCf) {
    cfMap = uploadToCloudflareImages(manifests, sponsors, forceCf);
  }

  // Active campaigns only
  const active = campaigns
    .map(x => x.campaign)
    .filter(isActiveCampaign);

  // Build global stacks and city overrides
  const global = {
    version: 1,
    generated_at: new Date().toISOString(),
    stacks: {
      header_leaderboard: [],
      sidebar_300x250: [],
      in_content: []
    },
    nextStepsSponsor: null
  };

  const cityOverrides = {}; // citySlug -> {stacks, nextStepsSponsor}
  const touchListings = []; // city slugs to update listing sponsor blocks

  for (const c of active) {
    const sponsorMeta = sponsors[c.sponsor_slug];
    const sponsor = sponsorMeta.sponsor;
    const manifest = manifests[sponsor.sponsor_slug];
    const cfForSlug = cfMap ? (cfMap[sponsor.sponsor_slug] || {}) : null;

    const block = buildSponsorBlocks(sponsor, manifest, cfForSlug);

    const resolved = resolveScope(c.scope, cityUniverse);

    const ads = c.placements?.ads || {};
    const nextStepsEnabled = !!c.placements?.next_steps?.enabled;
    const listingsEnabled = !!c.placements?.listings?.enabled;

    const applyToObj = (obj) => {
      if (ads.header_leaderboard) obj.stacks.header_leaderboard.push(block);
      if (ads.sidebar_300x250) obj.stacks.sidebar_300x250.push(block);
      if (ads.in_content) obj.stacks.in_content.push(block);
      if (nextStepsEnabled) obj.nextStepsSponsor = block;
    };

    if (resolved.mode === "site" || resolved.mode === "vertical") {
      applyToObj(global);
      // listingsEnabled for site-wide means “all listings” — intentionally not supported without explicit city list
      if (listingsEnabled) {
        console.warn(`WARN: listings.enabled=true for ${c.campaign_slug} with scope ${resolved.mode}. This script does NOT mass-edit all listings. Use city/state scopes.`);
      }
    } else {
      for (const city of resolved.cities) {
        cityOverrides[city] = cityOverrides[city] || {
          version: 1,
          generated_at: new Date().toISOString(),
          stacks: { header_leaderboard: [], sidebar_300x250: [], in_content: [] },
          nextStepsSponsor: null
        };
        applyToObj(cityOverrides[city]);
        if (listingsEnabled) touchListings.push(city);
      }
    }
  }

  // Write outputs
  ensureDir(OUT_SPONSORS_DIR);
  writeGeneratedJson(path.join(OUT_SPONSORS_DIR, "global.json"), global, "data/sponsors/global.json");
  for (const [city, obj] of Object.entries(cityOverrides)) {
    writeGeneratedJson(path.join(OUT_SPONSORS_DIR, `${city}.json`), obj, `data/sponsors/${city}.json`);
  }

  // Optional listings sponsor injection
  const listingsDir = path.join(REPO_ROOT, "data", "listings");
  const uniqueTouch = Array.from(new Set(touchListings));
  for (const city of uniqueTouch) {
    const p = path.join(listingsDir, `${city}.json`);
    if (!fs.existsSync(p)) die(`Listings file missing for city ${city}: ${p}`);
    const listing = readJson(p);
    // keep minimal: attach sponsor slug and CTA
    const sponsorCfg = cityOverrides[city]?.nextStepsSponsor || global.nextStepsSponsor;
    if (!sponsorCfg) continue;
    listing.sponsor = {
      sponsorSlug: sponsorCfg.sponsorSlug,
      displayName: sponsorCfg.displayName,
      ctaText: sponsorCfg.ctaText,
      ctaUrl: sponsorCfg.ctaUrl,
      disclosure: sponsorCfg.disclosure
    };
    fs.writeFileSync(p, JSON.stringify(listing, null, 2) + "\n");
  }

  console.log(`OK: sponsors applied. active_campaigns=${active.length}, city_overrides=${Object.keys(cityOverrides).length}`);
  if (uploadCf) console.log("OK: Cloudflare Images mode enabled (URLs stored in data/_generated/cf_images_map.json)");
}

main();
