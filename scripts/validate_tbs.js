#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const sponsorship = require("./helpers/sponsorship");

// --- JSON-LD / schema validation (locked rules) ---
const FORBIDDEN_SCHEMA_TOKENS = new Set([
  'AggregateRating',
  'Review',
  'ratingValue',
  'bestRating',
  'worstRating',
  'reviewCount'
]);

function extractJsonLdScriptContents(html) {
  const out = [];
  const re = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    out.push(String(m[1] || '').trim());
  }
  return out;
}

function flattenJsonLd(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    return parsed.flatMap(flattenJsonLd);
  }
  if (typeof parsed === 'object') return [parsed];
  return [];
}

function collectTypes(node) {
  const types = [];
  if (!node || typeof node !== 'object') return types;
  const t = node['@type'];
  if (Array.isArray(t)) {
    for (const x of t) if (x) types.push(String(x));
  } else if (t) {
    types.push(String(t));
  }
  return types;
}

function hasType(nodes, typeName) {
  const target = String(typeName || '');
  if (!target) return false;
  for (const n of nodes) {
    const types = collectTypes(n);
    if (types.includes(target)) return true;
  }
  return false;
}

function scanForForbiddenSchemaTokens(node) {
  if (!node) return false;
  if (Array.isArray(node)) {
    for (const it of node) if (scanForForbiddenSchemaTokens(it)) return true;
    return false;
  }
  if (typeof node !== 'object') {
    const s = String(node);
    for (const tok of FORBIDDEN_SCHEMA_TOKENS) {
      if (s === tok) return true;
    }
    return false;
  }

  // Keys
  for (const k of Object.keys(node)) {
    if (FORBIDDEN_SCHEMA_TOKENS.has(k)) return true;
  }
  // Values
  for (const v of Object.values(node)) {
    if (scanForForbiddenSchemaTokens(v)) return true;
  }
  return false;
}

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const scriptsDir = path.join(repoRoot, "scripts");

function fail(msg, hint) {
  console.error(`VALIDATION FAILED: ${msg}`);
  if (hint) console.error(`HINT: ${hint}`);
  process.exit(1);
}


function ok(msg) {
  console.log(`OK: ${msg}`);
}

function warn(msg) {
  console.warn(`WARN: ${msg}`);
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
      }`,
      "Remove markdown ``` fences from scripts/ files (allowlist: scripts/validate_tbs.js)."
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
 * 2b) LKG snapshot must exist (formalized step)
 **/
function assertLkgSnapshotExists() {
  const p = path.join(distDir, "_lkg_snapshot.json");
  if (!fs.existsSync(p)) {
    fail("Missing dist/_lkg_snapshot.json", "Run `npm run build` (preferred) or `npm run snapshot:lkg` before running validate.");
  }
  ok("LKG snapshot exists (dist/_lkg_snapshot.json)");
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
    fail(`Unresolved tokens found in dist (sample):\n${lines}\nTotal: ${hits.length}`, "Fix: unresolved %%TOKENS%% indicate a placeholder leak — ensure build scripts replace all tokens (ads, brand, FAQ, etc.).");
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
    fail(`Unresolved %%AD:...%% tokens remain in dist (sample):\n${lines}`, "Fix: ad injection did not run — ensure data/ad_placements.json exists and build injects %%AD:<key>%% blocks.");
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
    fail(`Required global pages missing in dist: ${missing.join(", ")}`, "Fix: ensure the selected pack includes required global pages and build_city_sites.js copies them into dist/.");
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
      ,"dist/states/"
      ,"dist/personal-injury/"
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
 * 7b) Non-PI city hub pages must be state-lookup only (no directory), and the lookup CTA must be functional
 *
 * Rules (locked):
 * - PI is the only vertical allowed to render a directory zone.
 * - All other verticals must render the state lookup accordion + CTA.
 * - No city hub may include both directory + state lookup.
 */
function assertNonPiCityPagesStateLookupOnly() {
  const { pageSetFile } = loadPageSetForSite();
  const verticalKey = deriveVerticalKey(pageSetFile);
  if (verticalKey === 'pi') {
    ok('Non-PI city hub state-lookup check skipped (PI page set)');
    return;
  }

  const cityIndexFiles = walkFiles(distDir, (p) => p.endsWith(path.join('index.html')));
  const cityPages = cityIndexFiles.filter((p) => {
    const r = rel(p);
    if (r === 'dist/index.html') return false;
    const excludedPrefixes = [
      'dist/guides/',
      'dist/faq/',
      'dist/methodology/',
      'dist/for-providers/',
      'dist/about/',
      'dist/contact/',
      'dist/privacy/',
      'dist/disclaimer/',
      'dist/editorial-policy/'
      ,'dist/states/'
      ,'dist/personal-injury/'
    ];
    if (excludedPrefixes.some((pre) => r.startsWith(pre))) return false;
    return /^dist\/[^/]+\/index\.html$/.test(r);
  });

  const bad = [];
  for (const f of cityPages) {
    const html = readText(f);
    const hasDirectoryZone = html.includes('id="verified-listings"') || html.includes('id="other-listings"');
    const hasStateLookup = html.includes('id="state-lookup"');
    const hasStateLookupCta = html.includes('data-state-lookup-cta="true"');

    // Must NOT have directory zones
    if (hasDirectoryZone) {
      bad.push(`${rel(f)} (contains directory zone)`);
      if (bad.length >= 15) break;
      continue;
    }
    // Must have state lookup accordion + CTA
    if (!hasStateLookup || !hasStateLookupCta) {
      bad.push(`${rel(f)} (missing state lookup accordion/CTA)`);
      if (bad.length >= 15) break;
      continue;
    }
  }

  if (bad.length) {
    fail(`Non-PI city hub pages must be state-lookup only (no directory) and include functional CTA. Issues: ${bad.join(', ')}`);
  }

  ok('Non-PI city hub pages are state-lookup only (directory excluded)');
}

/**
 * 7c) Required zone: City disclosure must be present on ALL city pages
 *
 * Source of truth: Master Index Appendix L — Canonical City Page Skeleton (LOCKED)
 * Enforcement: Every city page (any route under dist/<city>/...) must include the marker.
 */
function assertCityPagesHaveCityDisclosure() {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith(path.join('index.html')));
  const cityPages = htmlFiles.filter((p) => {
    const r = rel(p);
    if (r === 'dist/index.html') return false;

    const excludedPrefixes = [
      'dist/guides/',
      'dist/faq/',
      'dist/methodology/',
      'dist/for-providers/',
      'dist/about/',
      'dist/contact/',
      'dist/privacy/',
      'dist/disclaimer/',
      'dist/editorial-policy/',
      'dist/states/',
      'dist/personal-injury/'
    ];
    if (excludedPrefixes.some((pre) => r.startsWith(pre))) return false;

    // Any page under dist/<city>/.../index.html counts as a city page.
    return /^dist\/[^/]+\/(?:.*\/)?index\.html$/.test(r);
  });

  const MARK = 'data-city-disclosure="true"';

  const missing = [];
  const dupes = [];

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

  for (const f of cityPages) {
    const html = readText(f);
    const c = countOccurrences(html, MARK);
    if (c === 0) missing.push(rel(f));
    if (c > 1) dupes.push(rel(f));
    if (missing.length >= 15 || dupes.length >= 15) break;
  }

  if (missing.length) {
    fail(`City pages missing required city disclosure zone (${MARK}): ${missing.join(', ')}`);
  }
  if (dupes.length) {
    fail(`City pages contain duplicate city disclosure blocks (must be exactly one): ${dupes.join(', ')}`);
  }

  ok('City pages include required city disclosure zone');
}


/**
 * 7d) City hub required-zone uniqueness + no accidental "compare providers" CTA
 *
 * Enforces:
 * - City hub must have exactly one FAQ accordion block.
 * - City hub must have exactly one state-lookup block if enabled (and none if disabled).
 * - City hub must have directory OR state-lookup (never both).
 * - City hub must not include a "Compare providers" CTA (not requested; non-functional).
 */
function assertCityHubZonesAndNoCompareCta() {
  const { pageSet } = loadPageSetForSite();
  const features = (pageSet && pageSet.cityFeatures) ? pageSet.cityFeatures : { directory: false, stateLookup: true };

  const cityIndexFiles = walkFiles(distDir, (p) => p.endsWith(path.join('index.html')));
  const cityHubPages = cityIndexFiles.filter((p) => {
    const r = rel(p);
    if (r === 'dist/index.html') return false;

    const excludedPrefixes = [
      'dist/guides/',
      'dist/faq/',
      'dist/methodology/',
      'dist/for-providers/',
      'dist/about/',
      'dist/contact/',
      'dist/privacy/',
      'dist/disclaimer/',
      'dist/editorial-policy/',
      'dist/states/',
      'dist/personal-injury/'
    ];
    if (excludedPrefixes.some((pre) => r.startsWith(pre))) return false;

    // City hub only: dist/<city>/index.html
    return /^dist\/[^/]+\/index\.html$/.test(r);
  });

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

  const problems = [];

  for (const f of cityHubPages) {
    const r = rel(f);
    const html = readText(f);

    // "Compare providers" CTA guard (case-insensitive)
    if (/compare\s+providers/i.test(html)) {
      problems.push(`${r}: contains "Compare providers" CTA text`);
    }

    const faqIdCount = countOccurrences(html, 'id="city-faq"');
    const faqAccordionCount = countOccurrences(html, 'class="faq-accordion"');
    if (faqIdCount !== 1) problems.push(`${r}: expected exactly 1 city FAQ block (id="city-faq"), found ${faqIdCount}`);
    if (faqAccordionCount !== 1) problems.push(`${r}: expected exactly 1 faq-accordion block, found ${faqAccordionCount}`);

    const stateLookupIdCount = countOccurrences(html, 'id="state-lookup"');
    const hasDirectoryZone = html.includes('id="verified-listings"') || html.includes('id="other-listings"');

    if (features && features.stateLookup) {
      if (stateLookupIdCount !== 1) {
        problems.push(`${r}: stateLookup enabled but expected exactly 1 state-lookup block, found ${stateLookupIdCount}`);
      }
    } else {
      if (stateLookupIdCount !== 0) {
        problems.push(`${r}: stateLookup disabled but found ${stateLookupIdCount} state-lookup block(s)`);
      }
    }

    if (features && features.directory) {
      if (!hasDirectoryZone) problems.push(`${r}: directory enabled but directory zone not found`);
    } else {
      if (hasDirectoryZone) problems.push(`${r}: directory disabled but directory zone found`);
    }

    // Never both
    const hasStateLookup = stateLookupIdCount > 0;
    if (hasStateLookup && hasDirectoryZone) {
      problems.push(`${r}: has BOTH directory + state-lookup (must be one or the other)`);
    }

    if (problems.length >= 25) break;
  }

  if (problems.length) {
    fail(`City hub required-zone validation failed:\n- ${problems.join('\n- ')}`);
  }

  ok('City hub zones are unique and no "Compare providers" CTA detected');
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

/**
 * 7e) Page contracts (required zones by page type)
 *
 * Purpose:
 * - Prevent silent template drift across verticals.
 * - Fail build if required blocks are missing or forbidden blocks appear.
 *
 * Contract source of truth: data/page_contracts.json
 */
function getPageTypeForDistPath(distRelPath) {
  // distRelPath is like: dist/<...>/index.html
  // Global top-level pages that are NOT city pages.
  if (/^dist\/(about|contact|privacy|disclaimer|editorial-policy|methodology|for-providers|faq)\/index\.html$/i.test(distRelPath)) {
    return "global";
  }
  if (distRelPath === "dist/guides/index.html") return "guides_hub";
  if (distRelPath === "dist/personal-injury/index.html") return "pi_hub";
  if (/^dist\/states\/[A-Z]{2}\/index\.html$/i.test(distRelPath)) return "pi_state";
  if (/^dist\/guides\/[^/]+\/index\.html$/i.test(distRelPath)) return "guide";
  if (/^dist\/[^/]+\/faq\/index\.html$/i.test(distRelPath)) return "city_faq";
  if (/^dist\/[^/]+\/next-steps\/index\.html$/i.test(distRelPath)) return "city_next_steps";
  if (/^dist\/[^/]+\/index\.html$/i.test(distRelPath)) return "city_hub";
  return "other";
}

function assertPageContracts() {
  const contractsPath = path.join(repoRoot, "data", "page_contracts.json");
  if (!fs.existsSync(contractsPath)) {
    fail(`Missing page contracts file: ${rel(contractsPath)}`);
  }
  const contracts = readJson(contractsPath);

  const htmlFiles = walkFiles(distDir, (p) => p.endsWith(".html"));
  const problems = [];

  function checkContract(name, contract, html, r) {
    const requireList = Array.isArray(contract.require) ? contract.require : [];
    const forbidList = Array.isArray(contract.forbid) ? contract.forbid : [];

    for (const needle of requireList) {
      if (!html.includes(needle)) {
        problems.push(`${r}: contract '${name}' missing required marker: ${needle}`);
        if (problems.length >= 60) return;
      }
    }
    for (const needle of forbidList) {
      if (html.includes(needle)) {
        problems.push(`${r}: contract '${name}' contains forbidden marker: ${needle}`);
        if (problems.length >= 60) return;
      }
    }
  }

  for (const f of htmlFiles) {
    const r = rel(f);
    const html = readText(f);

    // Apply baseline contract to all pages.
    if (contracts.all_pages) checkContract("all_pages", contracts.all_pages, html, r);

    // Apply page-type contract where defined.
    const t = getPageTypeForDistPath(r);
    if (t !== "other" && contracts[t]) {
      checkContract(t, contracts[t], html, r);
    }

    if (problems.length >= 60) break;
  }

  if (problems.length) {
    fail(`Page contract validation failed (sample):\n- ${problems.join("\n- ")}`);
  }

  ok("Page contracts pass (required zones enforced)");
}

function parseJsonLdNodesFromHtml(html, fileRelForErrors) {
  const blocks = extractJsonLdScriptContents(html);
  const allNodes = [];
  for (const b of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(b);
    } catch (e) {
      fail(`JSON-LD is not valid JSON in ${fileRelForErrors}`);
    }
    const nodes = flattenJsonLd(parsed);
    for (const n of nodes) {
      if (scanForForbiddenSchemaTokens(n)) {
        fail(`JSON-LD contains forbidden schema fields/types in ${fileRelForErrors}`);
      }
      allNodes.push(n);
    }
  }
  return allNodes;
}

function assertSchemaJsonLdAndRequirements() {
  const site = JSON.parse(readText(path.join(repoRoot, 'data', 'site.json')));
  const pageSetFile = String(site.pageSetFile || '').trim();
  if (!pageSetFile) return;

  // Determine pageSet path (examples/ or root)
  let pageSetPath = path.join(repoRoot, 'data', 'page_sets', 'examples', pageSetFile);
  if (!fs.existsSync(pageSetPath)) {
    pageSetPath = path.join(repoRoot, 'data', 'page_sets', pageSetFile);
  }
  const pageSet = fs.existsSync(pageSetPath) ? JSON.parse(readText(pageSetPath)) : {};

  // Derive vertical key robustly even when site.pageSetFile uses subpaths like "examples/pi_v1.json"
  const base = path.basename(pageSetFile).replace(/\.json$/i, '').toLowerCase();
  const name = String(pageSet.name || base).toLowerCase();
  let verticalKey = String(pageSet.vertical || '').toLowerCase();
  if (!verticalKey) {
    const s = name;
    if (s.startsWith('pi')) verticalKey = 'pi';
    else if (s.startsWith('dentistry')) verticalKey = 'dentistry';
    else if (s.startsWith('trt')) verticalKey = 'trt';
    else if (s.startsWith('neuro')) verticalKey = 'neuro';
    else if (s.startsWith('uscis_medical') || s.startsWith('uscis')) verticalKey = 'uscis_medical';
    else if (s.startsWith('starter')) verticalKey = 'starter';
    else verticalKey = s;
  }
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};
  const itemListEnabled = schemaCfg && schemaCfg.itemListEnabled === true;
  const faqEnabled = schemaCfg && schemaCfg.faqEnabled === true;

  // Global A1/A2: parse all JSON-LD and block forbidden fields
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'));
  for (const f of htmlFiles) {
    const r = rel(f);
    const html = readText(f);
    // This function hard-fails on parse or forbidden tokens
    parseJsonLdNodesFromHtml(html, r);
  }
  ok('Schema: JSON-LD parses and forbidden fields/types are absent');

  // D2: If disabled, schema types MUST NOT appear (prevents half-on drift)
  // We do NOT forbid baseline schemas (Organization/WebSite/WebPage/BreadcrumbList). Only CollectionPage and FAQPage.
  const requireCollection = itemListEnabled;
  const requireFaq = faqEnabled;

  // City pages: dist/<slug>/index.html (all packs)
  const cities = JSON.parse(readText(path.join(repoRoot, 'data', 'cities.json')));
  const cityHomeFiles = cities
    .map((c) => path.join(distDir, c.slug, 'index.html'))
    .filter((p) => fs.existsSync(p));

  for (const p of cityHomeFiles) {
    const r = rel(p);
    const nodes = parseJsonLdNodesFromHtml(readText(p), r);
    const hasCollection = hasType(nodes, 'CollectionPage');
    const hasFaq = hasType(nodes, 'FAQPage');

    if (verticalKey === 'pi') {
      // PI city pages: require CollectionPage when itemListEnabled; FAQPage not required.
      if (requireCollection && !hasCollection) fail(`PI city page missing required CollectionPage JSON-LD: ${r}`);
      if (!requireCollection && hasCollection) fail(`schema.itemListEnabled is false but CollectionPage JSON-LD exists: ${r}`);
      // If faqEnabled is false, block FAQPage on city pages (rare but keeps drift in check)
      if (!requireFaq && hasFaq) fail(`schema.faqEnabled is false but FAQPage JSON-LD exists: ${r}`);
    } else {
      // Non-PI city pages: require both CollectionPage + FAQPage when enabled
      if (requireCollection && !hasCollection) fail(`Non-PI city page missing required CollectionPage JSON-LD: ${r}`);
      if (!requireCollection && hasCollection) fail(`schema.itemListEnabled is false but CollectionPage JSON-LD exists: ${r}`);

      if (requireFaq && !hasFaq) fail(`Non-PI city page missing required FAQPage JSON-LD: ${r}`);
      if (!requireFaq && hasFaq) fail(`schema.faqEnabled is false but FAQPage JSON-LD exists: ${r}`);
    }
  }

  // PI state pages: dist/states/<AB>/index.html
  if (verticalKey === 'pi') {
    const stateDir = path.join(distDir, 'states');
    const stateFiles = fs.existsSync(stateDir)
      ? fs.readdirSync(stateDir).map((d) => path.join(stateDir, d, 'index.html')).filter((p) => fs.existsSync(p))
      : [];
    for (const p of stateFiles) {
      const r = rel(p);
      const nodes = parseJsonLdNodesFromHtml(readText(p), r);
      const hasCollection = hasType(nodes, 'CollectionPage');
      const hasFaq = hasType(nodes, 'FAQPage');

      if (requireCollection && !hasCollection) fail(`PI state page missing required CollectionPage JSON-LD: ${r}`);
      if (!requireCollection && hasCollection) fail(`schema.itemListEnabled is false but CollectionPage JSON-LD exists: ${r}`);

      if (requireFaq && !hasFaq) fail(`PI state page missing required FAQPage JSON-LD: ${r}`);
      if (!requireFaq && hasFaq) fail(`schema.faqEnabled is false but FAQPage JSON-LD exists: ${r}`);
    }
  }

  ok('Schema: per-pack requirements enforced via pack flags');
}

/**
 * SOFT WARNING: Non-PI licensing lookup completeness (URLs)
 *
 * Purpose:
 * - Non-PI verticals rely on data/licensing_lookup/<vertical>.json.
 * - We do NOT hard-fail on missing/empty URLs (UX issue, not build-breaker).
 * - We DO print a clear WARN summary so missing state links are visible.
 */
function warnNonPiLicensingLookupUrlsIfMissing() {
  const { pageSet, pageSetFile } = loadPageSetForSite();
  const verticalKey = deriveVerticalKey(pageSetFile);
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};

  // Only applies to non-PI verticals where resource lookups are expected.
  if (verticalKey === 'pi' || verticalKey === 'starter') return;
  if (schemaCfg && schemaCfg.itemListEnabled !== true) return;

  const lookupKey = (verticalKey === 'uscis_medical' || verticalKey === 'uscis') ? 'uscis' : verticalKey;
  const lookupPath = path.join(repoRoot, 'data', 'licensing_lookup', `${lookupKey}.json`);
  if (!fs.existsSync(lookupPath)) {
    // Missing file is still a hard error (system/config drift)
    fail(`Missing licensing lookup file: ${rel(lookupPath)}`);
  }

  const lookup = readJson(lookupPath);
  const statesPath = path.join(repoRoot, 'data', 'states.json');
  const states = readJson(statesPath);
  const missing = [];

  for (const ab of Object.keys(states)) {
    const entry = lookup[ab];
    if (!entry || typeof entry !== 'object') {
      missing.push(ab);
      continue;
    }
    const values = Object.values(entry)
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter(Boolean);
    const hasHttp = values.some((v) => /^https?:\/\//i.test(v));
    if (!hasHttp) missing.push(ab);
  }

  if (missing.length) {
    const sample = missing.slice(0, 12).join(', ');
    warn(`Non-PI licensing lookups: missing/empty URLs for ${missing.length} states in ${rel(lookupPath)}. Sample: ${sample}${missing.length > 12 ? ' ...' : ''}`);
  } else {
    ok(`Non-PI licensing lookups: all states have at least one URL in ${rel(lookupPath)}`);
  }
}



/**
 * 7f) PI state hub pages (state > city)
 * Requirements:
 * - For PI page sets only: dist/states/<AB>/index.html must exist for ALL 50 states.
 * - Each state page must include disciplinary lookup block with official link.
 * - Each PI city hub must include a backlink to its state hub.
 */
function assertPiStatePages() {
  const { pageSetFile } = loadPageSetForSite();
  const verticalKey = deriveVerticalKey(pageSetFile);
  if (verticalKey !== 'pi') {
    ok('PI state pages check skipped (non-PI page set)');
    return;
  }

  const statesPath = path.join(repoRoot, 'data', 'states.json');
  const states = readJson(statesPath);
  const linkPath = path.join(repoRoot, 'data', 'pi_state_disciplinary_links.json');
  if (!fs.existsSync(linkPath)) {
    fail(`Missing PI state disciplinary links file: ${rel(linkPath)}`);
  }
  const links = readJson(linkPath);

  const missingLinks = [];
  for (const ab of Object.keys(states)) {
    const url = links[ab];
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      missingLinks.push(ab);
    }
  }
  if (missingLinks.length) {
    fail(`PI disciplinary lookup links missing or invalid for: ${missingLinks.join(', ')}`);
  }

  const missingPages = [];
  const badPages = [];
  for (const ab of Object.keys(states)) {
    const f = path.join(distDir, 'states', String(ab).toUpperCase(), 'index.html');
    if (!fs.existsSync(f)) {
      missingPages.push('states/' + ab);
      continue;
    }
    const html = readText(f);
    if (!html.includes('data-pi-state-page="true"') || !html.includes('data-disciplinary-lookup="true"')) {
      badPages.push('states/' + ab + ' (missing required markers)');
      continue;
    }
    const expected = String(links[ab]);
    if (!html.includes(expected)) {
      badPages.push('states/' + ab + ' (disciplinary link mismatch)');
    }
  }
  if (missingPages.length) {
    fail(`PI requires 50 state pages. Missing: ${missingPages.slice(0,15).join(', ')}${missingPages.length>15?' ...':''}`);
  }
  if (badPages.length) {
    fail(`PI state pages failed validation: ${badPages.slice(0,15).join(', ')}${badPages.length>15?' ...':''}`);
  }

  // City backlink check (PI city hubs only)
  const citiesPath = path.join(repoRoot, 'data', 'cities.json');
  const allCities = readJson(citiesPath);
  const citySlugs = Object.keys(allCities || {});
  const offenders = [];
  for (const slug of citySlugs) {
    const f = path.join(distDir, slug, 'index.html');
    if (!fs.existsSync(f)) continue;
    const html = readText(f);
    if (!html.includes('data-pi-state-backlink=\"true\"')) {
      offenders.push('dist/' + slug + '/index.html');
      if (offenders.length >= 10) break;
    }
  }
  if (offenders.length) {
    fail(`PI city pages must include state backlink. Missing in sample: ${offenders.join(', ')}`);
  }

  ok('PI state pages exist (50), disciplinary links present, and city backlink marker present');
}

function assertNextStepsInvariants() {
  const { pageSet } = loadPageSetForSite();
  const pack = pageSet || {};

  const eduOnly = (pack.educationOnly === true);
  const globalEnabled = sponsorship.isGlobalNextStepsEnabled(pack);
  const sponsorEnabled = sponsorship.isNextStepsEnabled(pack);

  const ZONE_MARK = 'data-next-steps-zone="true"';

  // Helper: collect relevant dist paths
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith(path.join('index.html')));

  // Identify core page types
  const homePath = path.join(distDir, 'index.html');
  const guidesHubPath = path.join(distDir, 'guides', 'index.html');

  const guideDetailPages = htmlFiles.filter((p) => /^dist\/guides\/[^/]+\/index\.html$/i.test(rel(p)));
  const statePages = htmlFiles.filter((p) => /^dist\/states\/[A-Z]{2}\/index\.html$/i.test(rel(p)));
  const cityPages = htmlFiles.filter((p) => {
    const r = rel(p);
    if (r === 'dist/index.html') return false;
    if (r.startsWith('dist/guides/')) return false;
    if (r.startsWith('dist/about/')) return false;
    return /^dist\/[^/]+\/(?:.*\/)?index\.html$/i.test(r) && !/^dist\/(about|contact|privacy|disclaimer|editorial-policy|methodology|for-providers|faq)\/index\.html$/i.test(r);
  });

  function readIfExists(fp) {
    if (!fp) return '';
    try {
      if (!require('fs').existsSync(fp)) return '';
      return readText(fp);
    } catch (_e) {
      return '';
    }
  }

  function assertNoNextStepsZonesAnywhere() {
    const offenders = [];
    for (const f of htmlFiles) {
      const html = readText(f);
      if (html.includes(ZONE_MARK)) {
        offenders.push(rel(f));
        if (offenders.length >= 15) break;
      }
    }
    if (offenders.length) {
      fail(`educationOnly=true: next-steps zones must not exist anywhere. Found: ${offenders.join(', ')}`);
    }

    const nextStepsPages = htmlFiles.filter((p) => /\/next-steps\/index\.html$/i.test(rel(p)));
    if (nextStepsPages.length) {
      fail(`educationOnly=true: next-steps pages must not exist anywhere. Found: ${nextStepsPages.slice(0, 10).map(rel).join(', ')}`);
    }
  }

  function assertGlobalZonesExist() {
    const missing = [];
    const home = readIfExists(homePath);
    const guidesHub = readIfExists(guidesHubPath);
    const piHubPath = path.join(distDir, 'personal-injury', 'index.html');
    const piHub = readIfExists(piHubPath);

    if (!home.includes(ZONE_MARK)) missing.push('dist/index.html (home)');
    if (!guidesHub.includes(ZONE_MARK)) missing.push('dist/guides/index.html (guides hub)');

    // Optional PI hub route: if present, it must include the zone under global buyout.
    if (piHub && !piHub.includes(ZONE_MARK)) missing.push('dist/personal-injury/index.html (PI hub)');

    for (const f of guideDetailPages) {
      const html = readText(f);
      if (!html.includes(ZONE_MARK)) {
        missing.push(rel(f));
        if (missing.length >= 15) break;
      }
    }

    // City pages: require the zone on the city landing page (dist/<city>/index.html).
    // We explicitly DO NOT require the zone on the next-steps page itself.
    for (const f of cityPages) {
      const r = rel(f);
      if (!/\/index\.html$/i.test(r)) continue;
      if (/\/next-steps\/index\.html$/i.test(r)) continue;
      const html = readText(f);
      if (!html.includes(ZONE_MARK)) {
        missing.push(r);
        if (missing.length >= 15) break;
      }
    }

    // PI state pages (dist/states/<AB>/index.html) — required when present
    for (const f of statePages) {
      const html = readText(f);
      if (!html.includes(ZONE_MARK)) {
        missing.push(rel(f));
        if (missing.length >= 15) break;
      }
    }

    if (missing.length) {
      fail(`globalNextStepsEnabled=true: missing required next-steps zone marker (${ZONE_MARK}) on required pages. Sample: ${missing.join(', ')}`);
    }
  }

  function assertSponsorDrivenOnly() {
    // When global is off and educationOnly is false, next-steps zones/pages should only appear
    // for cities with a live sponsor AND sponsorship.nextStepsEnabled=true.
    // We infer sponsor liveness from data/listings/<city>.json (sponsor object).

    const listingsDir = path.join(repoRoot, 'data', 'listings');
    const sponsorsDir = path.join(repoRoot, 'data', 'sponsors');
    const fs = require('fs');

    function getSponsorForCity(slug) {
      // Priority 1: listing sponsor (data/listings/<city>.json)
      const fp = path.join(listingsDir, slug + '.json');
      if (fs.existsSync(fp)) {
        let raw;
        try { raw = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_e) { raw = null; }
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.sponsor) {
          return raw.sponsor;
        }
      }

      // Priority 2: optional override (data/sponsors/<city>.json -> nextStepsSponsor)
      return getNextStepsSponsorOverride(slug);
    }

    function getNextStepsSponsorOverride(slug) {
      const fp = path.join(sponsorsDir, slug + '.json');
      if (!fs.existsSync(fp)) return null;
      try {
        const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
        if (raw && typeof raw === 'object') {
          return raw.nextStepsSponsor || null;
        }
      } catch (_e) {
        return null;
      }
      return null;
    }

    const cityListPath = path.join(repoRoot, 'data', 'cities.json');
    const cities = JSON.parse(require('fs').readFileSync(cityListPath, 'utf8'));

    const unexpected = [];

    // If sponsor-driven is disabled, nothing should exist.
    if (!sponsorEnabled) {
      for (const f of htmlFiles) {
        const html = readText(f);
        if (html.includes(ZONE_MARK) || /\/next-steps\/index\.html$/i.test(rel(f))) {
          unexpected.push(rel(f));
          if (unexpected.length >= 15) break;
        }
      }
      if (unexpected.length) {
        fail(`globalNextStepsEnabled=false and nextStepsEnabled=false: next-steps zones/pages must not exist. Found: ${unexpected.join(', ')}`);
      }
      return;
    }

    // sponsorEnabled=true: allow only for sponsor-live cities
    for (const city of cities) {
      const slug = city.slug;
      const sponsor = getSponsorForCity(slug);
      const live = sponsorship.isSponsorLive(sponsor);
      const cityAnyZoneFiles = htmlFiles.filter((p) => rel(p).startsWith('dist/' + slug + '/'));
      for (const f of cityAnyZoneFiles) {
        const r = rel(f);
        const html = readText(f);
        const hasZone = html.includes(ZONE_MARK);
        const isNextStepsPage = /\/next-steps\/index\.html$/i.test(r);
        if ((hasZone || isNextStepsPage) && !live) {
          unexpected.push(`${r} (sponsor not live)`);
          if (unexpected.length >= 15) break;
        }
      }
      if (unexpected.length >= 15) break;
    }

    if (unexpected.length) {
      fail(`globalNextStepsEnabled=false (sponsor-driven only): next-steps zones/pages found for non-live sponsor cities. Sample: ${unexpected.join(', ')}`);
    }
  }

  // Invariants
  if (eduOnly) {
    assertNoNextStepsZonesAnywhere();
    ok('Next-steps invariants: educationOnly=true => no next-steps zones/pages anywhere');
    return;
  }

  if (globalEnabled) {
    assertGlobalZonesExist();
    ok('Next-steps invariants: globalNextStepsEnabled=true => zones exist on home/guides/city pages');
    return;
  }

  assertSponsorDrivenOnly();
  ok('Next-steps invariants: sponsor-driven mode enforced');
}

(function main() {
  assertNoMarkdownFencesInScripts();
  assertDistExists();
  assertLkgSnapshotExists();
  assertRequiredGlobalPages();
  assertNoAdTokensInDist();
  assertNoUnresolvedTokensInDist();
  assertPageContracts();
  assertSchemaJsonLdAndRequirements();
  warnNonPiLicensingLookupUrlsIfMissing();
  assertFaqPages();
  assertCityPagesHaveCityGuideBlock();
  assertCityPagesHaveCityDisclosure();
  assertNonPiCityPagesStateLookupOnly();
  assertCityHubZonesAndNoCompareCta();
  assertPiStatePages();
  assertNextStepsInvariants();
})();
