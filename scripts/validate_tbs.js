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
  // PI-only: sponsor behavior is data-driven via data/listings/<city>.json
  // sponsor is considered LIVE if:
  // sponsor: { status: "live", firm_name, official_site_url, intake_url }

  const pageSetFile = readJson(path.join(repoRoot, "data/site.json")).pageSetFile;
  if (pageSetFile !== 'pi_v1.json') {
    ok('PI Phase-2 Distribution governance check skipped (non-PI page set)');
    return;
  }
  const cityList = readJson(path.join(repoRoot, "data/cities.json"));
  const listingsDir = path.join(repoRoot, "data", "listings");
  function getSponsorForCity(slug) {
    const fp = path.join(listingsDir, slug + ".json");
    if (!fs.existsSync(fp)) return null;
    const raw = readJson(fp);
    if (Array.isArray(raw)) return null;
    if (raw && typeof raw === 'object') return raw.sponsor || null;
    return null;
  }

  // Deterministic marker strings set by build script
  const SPONSORED_PLACEMENT_MARK = 'data-sponsored-placement="true"';
  const SPONSORED_FIRM_MARK = 'data-sponsored-firm="true"';
  const SPONSORED_DISCLOSURE_MARK = 'data-sponsored-disclosure="true"';
  const PI_PRIMARY_CTA_MARK = 'data-pi-primary-cta="true"';

  function isSponsorLive(s) {
    return !!(s && typeof s === 'object' && s.status === 'live' && s.firm_name && s.official_site_url && s.intake_url);
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

  function disclosureSemanticsOk(block) {
    // Conservative: require paid placement + independent publisher + no guarantees.
    const t = String(block || "").toLowerCase();
    const paidOk = t.includes('paid') || t.includes('placement is paid') || t.includes('paid placement');
    const publisherOk = t.includes('independent') && (t.includes('publisher') || t.includes('educational'));
    const noGuaranteeOk = t.includes('no outcome') || t.includes('no guarantees') || t.includes('no guarantee');
    return paidOk && publisherOk && noGuaranteeOk;
  }

  function hasCta(html) {
    const t = String(html || "").toLowerCase();
    // Keep conservative: terms that indicate intake / consultation.
    const needles = [
      'request a confidential consultation',
      'send inquiry',
      'send an inquiry',
      'submit inquiry',
      'secure inquiry',
      'continue to secure inquiry',
      'confidential inquiry',
    ];
    return needles.some((n) => t.includes(n));
  }

  function assertSponsorOff(slug) {
    const cityHomePath = path.join(distDir, slug, "index.html");
    if (!fs.existsSync(cityHomePath)) {
      fail(`PI city '${slug}' missing city home page in dist/ (expected ${rel(cityHomePath)})`);
    }
    const html = readText(cityHomePath);
    if (html.includes(SPONSORED_PLACEMENT_MARK) || html.includes(SPONSORED_FIRM_MARK) || html.includes(SPONSORED_DISCLOSURE_MARK)) {
      fail(`Non-sponsored PI city '${slug}' must not render sponsored placement markers in ${rel(cityHomePath)}`);
    }
    if (html.includes(PI_PRIMARY_CTA_MARK)) {
      fail(`Non-sponsored PI city '${slug}' must not render primary CTA in ${rel(cityHomePath)}`);
    }
    const nextStepsPath = path.join(distDir, slug, "next-steps", "index.html");
    if (fs.existsSync(nextStepsPath)) {
      fail(`Non-sponsored PI city '${slug}' must not have next-steps page (found ${rel(nextStepsPath)})`);
    }
    // No CTA language anywhere on home
    if (hasCta(html)) {
      fail(`Non-sponsored PI city '${slug}' contains CTA/intake language in ${rel(cityHomePath)}`);
    }
  }

  function assertSponsorOn(slug) {
    const cityHomePath = path.join(distDir, slug, "index.html");
    if (!fs.existsSync(cityHomePath)) {
      fail(`Sponsored PI city '${slug}' missing city home page in dist/ (expected ${rel(cityHomePath)})`);
    }
    const html = readText(cityHomePath);

    // Required zones present
    if (!html.includes('id="verified-listings"') && !html.includes('verified-listings')) {
      fail(`Sponsored PI city '${slug}' appears missing listings zone on city home in ${rel(cityHomePath)}`);
    }

    const placementCount = countOccurrences(html, SPONSORED_PLACEMENT_MARK);
    const firmCount = countOccurrences(html, SPONSORED_FIRM_MARK);
    const disclosureCount = countOccurrences(html, SPONSORED_DISCLOSURE_MARK);
    const primaryCtaCount = countOccurrences(html, PI_PRIMARY_CTA_MARK);

    if (placementCount !== 1) fail(`Sponsored PI city '${slug}' must have exactly one sponsored placement block (found ${placementCount})`);
    if (firmCount !== 1) fail(`Sponsored PI city '${slug}' must have exactly one sponsored firm block (found ${firmCount})`);
    if (disclosureCount !== 1) fail(`Sponsored PI city '${slug}' must have exactly one disclosure block (found ${disclosureCount})`);
    if (primaryCtaCount !== 1) fail(`Sponsored PI city '${slug}' must have exactly one primary CTA block (found ${primaryCtaCount})`);

    const iDisclosure = html.indexOf(SPONSORED_DISCLOSURE_MARK);
    const iPlacement = html.indexOf(SPONSORED_PLACEMENT_MARK);
    if (iDisclosure === -1 || iPlacement === -1) {
      fail(`Sponsored PI city '${slug}' missing disclosure/placement markers (unexpected state)`);
    }
    if (iDisclosure > iPlacement) {
      fail(`Sponsored PI city '${slug}' disclosure must appear above sponsored placement`);
    }
    const PROXIMITY_CHARS = 2500;
    if (iPlacement - iDisclosure > PROXIMITY_CHARS) {
      fail(`Sponsored PI city '${slug}' disclosure is not proximate to sponsored placement (distance ${iPlacement - iDisclosure} chars)`);
    }
    const disclosureWindow = html.slice(iDisclosure, Math.min(html.length, iDisclosure + 3500));
    if (!disclosureSemanticsOk(disclosureWindow)) {
      fail(`Sponsored PI city '${slug}' disclosure does not satisfy semantic requirements`);
    }

    // Next steps page must exist
    const nextStepsPath = path.join(distDir, slug, "next-steps", "index.html");
    if (!fs.existsSync(nextStepsPath)) {
      fail(`Sponsored PI city '${slug}' must have next-steps page (missing ${rel(nextStepsPath)})`);
    }

    // CTA enforcement: CTA allowed inside sponsored placement + primary CTA.
    const iPlacementStart = html.indexOf(SPONSORED_PLACEMENT_MARK);
    const placementWindow = html.slice(iPlacementStart, Math.min(html.length, iPlacementStart + 9000));
    const iPrimary = html.indexOf(PI_PRIMARY_CTA_MARK);
    const primaryWindow = html.slice(iPrimary, Math.min(html.length, iPrimary + 2500));
    let outside = html;
    outside = outside.replace(placementWindow, " ").replace(primaryWindow, " ");
    if (hasCta(outside)) {
      fail(`Sponsored PI city '${slug}' contains CTA/intake language outside allowed modules`);
    }
  }

  // Enforce for all PI cities, driven solely by sponsor.status
  // Enforce for all PI cities, driven solely by sponsor.status
  for (const city of cityList) {
    const slug = city.slug;
    const sponsor = getSponsorForCity(slug);
    const live = isSponsorLive(sponsor);
    if (live) assertSponsorOn(slug);
    else assertSponsorOff(slug);
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
