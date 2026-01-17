#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const scriptsDir = path.join(repoRoot, "scripts");

function fail(msg) {
  console.error(`VALIDATION FAILED: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walkFiles(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (predicate(p)) out.push(p);
    }
  }
  return out;
}

function rel(p) {
  return p.replace(repoRoot + path.sep, "").replaceAll("\\", "/");
}

/**
 * 1) No markdown fences in scripts/
 */
function assertNoMarkdownFencesInScripts() {
  const allowlist = new Set(["scripts/validate_tbs.js"]);
  const files = walkFiles(scriptsDir, (p) => p.endsWith(".js"));
  const offenders = [];
  for (const f of files) {
    const r = rel(f);
    if (allowlist.has(r)) continue;
    const txt = readText(f);
    if (txt.includes("```")) offenders.push(r);
  }
  if (offenders.length) {
    fail(
      `Markdown fences found in scripts/: ${offenders.slice(0, 10).join(", ")}${
        offenders.length > 10 ? " ..." : ""
      }`
    );
  }
  ok("No markdown fences in scripts/");
}

/**
 * 2) dist/ must exist
 */
function assertDistExists() {
  if (!fs.existsSync(distDir)) fail("dist/ does not exist");
  ok("dist/ exists");
}

/**
 * 3) Unresolved token scan (%%...%%)
 *    Allowlist: %%GUIDE_CARDS%% is allowed ONLY on dist/guides/index.html
 */
function assertNoUnresolvedTokensInDist() {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith(".html"));
  const tokenRegex = /%%[A-Z0-9_:\-]+%%/g;

  const allowTokensByPath = new Map([
    ["dist/guides/index.html", new Set(["%%GUIDE_CARDS%%"])]
  ]);

  const hits = [];
  for (const f of htmlFiles) {
    const r = rel(f);
    const txt = readText(f);
    const found = txt.match(tokenRegex) || [];
    if (!found.length) continue;

    const allowed = allowTokensByPath.get(r) || new Set();
    const unexpected = found.filter((t) => !allowed.has(t));
    if (unexpected.length === 0) continue;

    const sample = Array.from(new Set(unexpected)).slice(0, 3);
    hits.push({ file: r, sample });
    if (hits.length >= 12) break;
  }

  if (hits.length) {
    const lines = hits.map((h) => `${h.sample.join(", ")} in ${h.file}`).join("\n");
    fail(`Unresolved tokens found in dist (sample):\n${lines}\nTotal: ${hits.length}`);
  }

  ok("No unresolved %%TOKENS%% in dist (allowlist applied)");
}

/**
 * 4) Ad tokens must be resolved (no %%AD:...%%)
 */
function assertNoAdTokensInDist() {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith(".html"));
  const adTokenRegex = /%%AD:[a-z0-9_\-]+%%/gi;

  const hits = [];
  for (const f of htmlFiles) {
    const r = rel(f);
    const txt = readText(f);
    const found = txt.match(adTokenRegex) || [];
    if (found.length) {
      hits.push({ file: r, sample: Array.from(new Set(found)).slice(0, 3) });
      if (hits.length >= 10) break;
    }
  }

  if (hits.length) {
    const lines = hits.map((h) => `${h.sample.join(", ")} in ${h.file}`).join("\n");
    fail(`Unresolved %%AD:...%% tokens remain in dist (sample):\n${lines}`);
  }

  ok("Ad tokens resolved (no %%AD:...%% in dist)");
}

/**
 * 5) FAQ validation (10–12, no duplicate questions on the same page, default closed)
 */
function stripTags(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFaqDetails(html) {
  const details = [];
  const detailsRegex = /<details\b[^>]*>[\s\S]*?<\/details>/gi;
  const matches = html.match(detailsRegex) || [];
  for (const block of matches) {
    const openAttr = /<details\b[^>]*\bopen\b[^>]*>/i.test(block);
    const summaryMatch = block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    const q = summaryMatch ? stripTags(summaryMatch[1]) : "";
    details.push({ q, openAttr });
  }
  return details;
}

function assertFaqPages() {
  const faqPages = walkFiles(distDir, (p) => p.endsWith(path.join("faq", "index.html")));

  if (!faqPages.length) {
    ok("FAQ pages: none detected (skipping FAQ count checks)");
    return;
  }

  const problems = [];

  for (const f of faqPages) {
    const r = rel(f);
    const html = readText(f);

    const hasFaqAccordion = /faq-accordion/i.test(html);
    const items = extractFaqDetails(html);

    if (hasFaqAccordion && items.length === 0) {
      problems.push(`${r}: faq-accordion present but 0 <details> items found`);
      continue;
    }

    if (items.length > 0) {
      if (items.length < 10 || items.length > 12) {
        problems.push(`${r}: FAQ count ${items.length} (must be 10–12)`);
      }

      const openCount = items.filter((i) => i.openAttr).length;
      if (openCount > 0) {
        problems.push(`${r}: ${openCount} FAQ items are expanded by default (<details open>)`);
      }

      const qs = items.map((i) => i.q).filter(Boolean);
      const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const seen = new Map();
      for (const q of qs) {
        const key = norm(q);
        seen.set(key, (seen.get(key) || 0) + 1);
      }
      const dups = Array.from(seen.entries())
        .filter(([, c]) => c > 1)
        .map(([k]) => k);

      if (dups.length) {
        problems.push(`${r}: duplicate FAQ questions detected (sample): \"${dups[0]}\"`);
      }
    }
  }

  if (problems.length) {
    fail(
      `FAQ validation failed:\n- ${problems.slice(0, 20).join("\n- ")}${
        problems.length > 20 ? "\n- ..." : ""
      }`
    );
  }

  ok("FAQ pages pass: 10–12 items, no duplicates, default closed");
}

/**
 * 6) Required global pages present
 */
function assertRequiredGlobalPages() {
  const required = [
    "dist/for-providers/index.html",
    "dist/about/index.html",
    "dist/contact/index.html",
    "dist/privacy/index.html",
    "dist/disclaimer/index.html",
    "dist/editorial-policy/index.html",
    "dist/methodology/index.html"
  ];

  const missing = required.filter((r) => !fs.existsSync(path.join(repoRoot, r)));
  if (missing.length) {
    fail(`Required global pages missing in dist: ${missing.join(", ")}`);
  }
  ok("Required global pages present");
}

/**
 * 7) City pages must include the auto guide block output (regression guard)
 */
function assertCityPagesHaveCityGuideBlock() {
  const cityIndexFiles = walkFiles(distDir, (p) => p.endsWith(path.join("index.html")));

  const cityPages = cityIndexFiles.filter((p) => {
    const r = rel(p);
    if (r === "dist/index.html") return false;

    const excludedPrefixes = [
      "dist/guides/",
      "dist/faq/",
      "dist/methodology/",
      "dist/for-providers/",
      "dist/about/",
      "dist/contact/",
      "dist/privacy/",
      "dist/disclaimer/",
      "dist/editorial-policy/"
    ];
    if (excludedPrefixes.some((pre) => r.startsWith(pre))) return false;

    return /^dist\/[^/]+\/index\.html$/.test(r);
  });

  const missing = [];
  for (const f of cityPages) {
    const html = readText(f);
    if (!html.includes("<h2>Guides for")) {
      missing.push(rel(f));
      if (missing.length >= 15) break;
    }
  }

  if (missing.length) {
    fail(`City pages missing auto guide block (expected '<h2>Guides for ...'): ${missing.join(", ")}`);
  }

  ok("City pages include auto-injected guides block");
}

/**
 * 8) PI Phase-2 Distribution governance enforcement (PI only)
 *
 * Policy source: Master Index — Post-Freeze Addendums (PI Distribution Vertical)
 *
 * Core rules enforced here:
 * - PI cities MUST declare exactly one monetization_mode
 * - Phase-2 allowlist cities MUST be DISTRIBUTION_SPONSORED_DIRECTORY
 * - All other PI cities MUST be EDUCATION_ONLY
 * - FULL_SITE_SPONSORSHIP is recognized but forbidden by default (hard fail)
 * - EDUCATION_ONLY cities MUST NOT show sponsorship/disclosure/CTA signals
 * - Sponsored-directory cities MUST show directory + exactly one sponsored block + proximate disclosure
 * - CTA is allowed ONLY inside the sponsored placement block
 * - Golden regression checks: houston-tx (sponsored) + denver-co (education-only)
 */

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadPageSetForSite() {
  const sitePath = path.join(repoRoot, "data", "site.json");
  const site = readJson(sitePath);
  const pageSetFile = String(site.pageSetFile || "").trim();
  if (!pageSetFile) fail("data/site.json missing pageSetFile");

  const p1 = path.join(repoRoot, "data", "page_sets", pageSetFile);
  const p2 = path.join(repoRoot, "data", "page_sets", "examples", pageSetFile);
  if (fs.existsSync(p1)) return { pageSet: readJson(p1), pageSetFile };
  if (fs.existsSync(p2)) return { pageSet: readJson(p2), pageSetFile };
  fail(`pageSetFile not found: ${pageSetFile} (tried ${rel(p1)} and ${rel(p2)})`);
}

function deriveVerticalKey(pageSetFile) {
  const base = path.basename(String(pageSetFile || ""));
  return base
    .replace(/\.json$/i, "")
    .replace(/_v\d+$/i, "")
    .split("_")[0]
    .toLowerCase();
}

function normalizeText(s) {
  return stripTags(String(s || "")).toLowerCase();
}

function assertPiPhase2DistributionGovernance() {
  const { pageSet, pageSetFile } = loadPageSetForSite();
  const verticalKey = deriveVerticalKey(pageSetFile);
  if (verticalKey !== "pi") {
    ok(`PI distribution governance: skipped (verticalKey=${verticalKey})`);
    return;
  }

  const citiesFileRel = String(pageSet.citiesFile || "").trim();
  if (!citiesFileRel) fail("PI page set missing citiesFile");

  const citiesFileAbs = path.isAbsolute(citiesFileRel)
    ? citiesFileRel
    : path.join(repoRoot, citiesFileRel);
  if (!fs.existsSync(citiesFileAbs)) {
    fail(`PI cities file not found: ${citiesFileRel}`);
  }

  const cities = readJson(citiesFileAbs);
  if (!Array.isArray(cities) || cities.length === 0) {
    fail(`PI cities file is empty or invalid: ${citiesFileRel}`);
  }

  const ALLOWED = new Set([
    "EDUCATION_ONLY",
    "DISTRIBUTION_SPONSORED_DIRECTORY",
    "FULL_SITE_SPONSORSHIP"
  ]);

  const PHASE2 = new Set([
    "houston-tx",
    "dallas-tx",
    "chicago-il",
    "atlanta-ga",
    "orlando-fl"
  ]);

  const GOLDEN_SPONSORED = "houston-tx";
  const GOLDEN_EDU = "denver-co";

  const bySlug = new Map();
  for (const c of cities) {
    const slug = String(c.slug || "").trim();
    if (!slug) fail(`PI city entry missing slug in ${citiesFileRel}`);
    if (bySlug.has(slug)) fail(`Duplicate PI city slug '${slug}' in ${citiesFileRel}`);
    bySlug.set(slug, c);

    const mode = c.monetization_mode;
    if (!mode) fail(`PI city '${slug}' has no monetization_mode assigned`);
    if (!ALLOWED.has(mode)) {
      fail(
        `PI city '${slug}' has invalid monetization_mode '${mode}'. Allowed: ${Array.from(ALLOWED).join(", ")}`
      );
    }

    if (mode === "FULL_SITE_SPONSORSHIP") {
      fail(`PI city '${slug}' uses FULL_SITE_SPONSORSHIP, which is forbidden by default`);
    }

    if (PHASE2.has(slug)) {
      if (mode !== "DISTRIBUTION_SPONSORED_DIRECTORY") {
        fail(`Phase-2 PI city '${slug}' must be DISTRIBUTION_SPONSORED_DIRECTORY (found ${mode})`);
      }
    } else {
      if (mode !== "EDUCATION_ONLY") {
        fail(`Non-Phase-2 PI city '${slug}' must be EDUCATION_ONLY (found ${mode})`);
      }
    }
  }

  // Golden slugs must exist
  if (!bySlug.has(GOLDEN_SPONSORED)) fail(`Golden sponsored city missing from PI cities: ${GOLDEN_SPONSORED}`);
  if (!bySlug.has(GOLDEN_EDU)) fail(`Golden education-only city missing from PI cities: ${GOLDEN_EDU}`);

  // Now enforce page-level behavior in dist/
  const SPONSORED_PLACEMENT_MARK = 'data-sponsored-placement="true"';
  const SPONSORED_FIRM_MARK = 'data-sponsored-firm="true"';
  const SPONSORED_DISCLOSURE_MARK = 'data-sponsored-disclosure="true"';

  const ctaPatterns = [
    /\brequest\s+(a\s+)?(confidential\s+)?consultation\b/i,
    /\bschedule\s+(a\s+)?(call|consultation)\b/i,
    /\bbook\s+(a\s+)?(call|consultation)\b/i,
    /\bcase\s+review\b/i,
    /\bfree\s+review\b/i,
    /\bspeak\s+with\s+(an\s+)?(attorney|lawyer)\b/i,
    /\bcall\s+now\b/i,
    /\bget\s+help\s+now\b/i
  ];

  function hasCta(text) {
    return ctaPatterns.some((re) => re.test(text));
  }

  // Semantic disclosure requirements
  function disclosureSemanticsOk(disclosureText) {
    const t = normalizeText(disclosureText);
    const paidOk = /(paid|sponsored|compensated)/i.test(t) && /(placement|listing|position)/i.test(t);
    const publisherOk = /(independent)/i.test(t) && /(educational|publisher)/i.test(t);
    const noGuaranteeOk = /(no\s+guarantee|no\s+guarantees|no\s+outcome\s+guarantee|no\s+outcomes\s+guaranteed)/i.test(t);
    return paidOk && publisherOk && noGuaranteeOk;
  }

  function assertEduCity(slug) {
    const cityHtmlPath = path.join(distDir, slug, "index.html");
    const dirHtmlPath = path.join(distDir, slug, "directory", "index.html");

    const filesToScan = [cityHtmlPath, dirHtmlPath].filter((p) => fs.existsSync(p));
    if (filesToScan.length === 0) {
      fail(`EDUCATION_ONLY PI city '${slug}' has no built pages in dist/ (missing ${rel(cityHtmlPath)})`);
    }

    for (const p of filesToScan) {
      const html = readText(p);
      if (html.includes(SPONSORED_PLACEMENT_MARK) || html.includes(SPONSORED_FIRM_MARK)) {
        fail(`EDUCATION_ONLY PI city '${slug}' renders sponsored placement markers in ${rel(p)}`);
      }
      if (html.includes(SPONSORED_DISCLOSURE_MARK)) {
        fail(`EDUCATION_ONLY PI city '${slug}' renders disclosure marker in ${rel(p)}`);
      }
      if (hasCta(html)) {
        fail(`EDUCATION_ONLY PI city '${slug}' contains CTA/intake language in ${rel(p)}`);
      }
    }
  }

  function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let idx = 0;
    let count = 0;
    while (true) {
      idx = haystack.indexOf(needle, idx);
      if (idx === -1) break;
      count += 1;
      idx += needle.length;
    }
    return count;
  }

  function assertSponsoredCity(slug) {
    const dirHtmlPath = path.join(distDir, slug, "directory", "index.html");
    if (!fs.existsSync(dirHtmlPath)) {
      fail(`Sponsored PI city '${slug}' must render directory page: missing ${rel(dirHtmlPath)}`);
    }
    const html = readText(dirHtmlPath);

    // Directory must still exist (basic zone check)
    if (!html.includes("id=\"verified-listings\"") && !html.includes("verified-listings")) {
      fail(`Sponsored PI city '${slug}' directory appears missing required listings zone in ${rel(dirHtmlPath)}`);
    }

    const placementCount = countOccurrences(html, SPONSORED_PLACEMENT_MARK);
    const firmCount = countOccurrences(html, SPONSORED_FIRM_MARK);
    const disclosureCount = countOccurrences(html, SPONSORED_DISCLOSURE_MARK);
    if (placementCount !== 1) {
      fail(`Sponsored PI city '${slug}' must have exactly one sponsored placement block (found ${placementCount})`);
    }
    if (firmCount !== 1) {
      fail(`Sponsored PI city '${slug}' must have exactly one sponsored firm block (found ${firmCount})`);
    }
    if (disclosureCount !== 1) {
      fail(`Sponsored PI city '${slug}' must have exactly one disclosure block (found ${disclosureCount})`);
    }

    const iDisclosure = html.indexOf(SPONSORED_DISCLOSURE_MARK);
    const iPlacement = html.indexOf(SPONSORED_PLACEMENT_MARK);
    if (iDisclosure === -1 || iPlacement === -1) {
      fail(`Sponsored PI city '${slug}' missing disclosure/placement markers (unexpected state)`);
    }
    if (iDisclosure > iPlacement) {
      fail(`Sponsored PI city '${slug}' disclosure must appear above sponsored placement`);
    }
    const PROXIMITY_CHARS = 2000;
    if (iPlacement - iDisclosure > PROXIMITY_CHARS) {
      fail(`Sponsored PI city '${slug}' disclosure is not proximate to sponsored placement (distance ${iPlacement - iDisclosure} chars)`);
    }

    // Extract disclosure block content for semantic checks (best-effort).
    // Strategy: grab a window starting at disclosure marker.
    const disclosureWindow = html.slice(iDisclosure, Math.min(html.length, iDisclosure + 2500));
    if (!disclosureSemanticsOk(disclosureWindow)) {
      fail(`Sponsored PI city '${slug}' disclosure does not satisfy semantic requirements`);
    }

    // CTA zone enforcement: CTA allowed only inside sponsored placement block.
    const iPlacementStart = html.indexOf(SPONSORED_PLACEMENT_MARK);
    // Heuristic: sponsored placement wrapper should be a single element; take a window around it.
    const placementWindow = html.slice(iPlacementStart, Math.min(html.length, iPlacementStart + 8000));

    // Outside content: remove the placement window once (best-effort) and scan remainder.
    const outside = html.replace(placementWindow, " ");
    if (hasCta(outside)) {
      fail(`Sponsored PI city '${slug}' contains CTA/intake language outside sponsored placement block`);
    }
  }

  // Enforce behavior for all PI cities
  for (const [slug, c] of bySlug.entries()) {
    const mode = c.monetization_mode;
    if (mode === "EDUCATION_ONLY") assertEduCity(slug);
    if (mode === "DISTRIBUTION_SPONSORED_DIRECTORY") assertSponsoredCity(slug);
  }

  ok("PI Phase-2 Distribution governance enforced (PI only)");
}

(function main() {
  assertNoMarkdownFencesInScripts();
  assertDistExists();
  assertRequiredGlobalPages();
  assertNoAdTokensInDist();
  assertNoUnresolvedTokensInDist();
  assertFaqPages();
  assertCityPagesHaveCityGuideBlock();
  assertPiPhase2DistributionGovernance();
})();
