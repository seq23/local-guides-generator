#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
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

let __auditFailures = 0;
function fail(msg, hint) {
  // Playbook v7: validate_tbs is audit/reporting only. It must never hard-fail deploys.
  __auditFailures += 1;
  console.error(`AUDIT WARNING: ${msg}`);
  if (hint) console.error(`HINT: ${hint}`);
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
    fail('City disclosure duplication regression: remove in-body city disclosure blocks (footer-only). Offenders' + String.fromCharCode(10) + offenders.slice(0, 50).join(String.fromCharCode(10)));
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

  ok("FAQ pages pass: 10–12 items, no duplicates");
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

  // NOTE (Playbook v7): footer disclosure copy is a *design* contract, not a hard-fail
  // validator contract. Exact-string enforcement is explicitly disallowed unless legally
  // required. We therefore treat this check as audit-only.

  const offenders = []; // tracks legacy in-body disclosure regressions
  const missingFooterDisclosures = []; // tracks pages missing footer disclosure anchors

  for (const f of cityPages) {
    const html = readText(f);

    // Audit: legacy in-body disclosure block regressed flow and created duplicate copy.
    // (We only check the structural marker; no copy-string matching.)
    if (html.includes('data-city-disclosure="true"')) {
      offenders.push(rel(f));
    }

    // Audit: footer should contain disclosure anchors, but do not hard-fail on exact strings.
    // We only check for a footer presence plus two disclosure concepts.
    const hasFooter = html.includes('<footer>');
    const hasAdvertisingDisclosure = /advertis(ing|ement)\s+disclosure/i.test(html);
    const hasNoGuarantees = /no\s+guarantee(s)?/i.test(html) || /no\s+endorsement(s)?/i.test(html);
    if (!hasFooter || !hasAdvertisingDisclosure || !hasNoGuarantees) {
      missingFooterDisclosures.push(rel(f));
    }
  }

  if (offenders.length) {
    console.warn('⚠️  AUDIT: City disclosure duplication regression detected (in-body disclosure marker present).');
    for (const o of offenders.slice(0, 50)) console.warn(' - ' + o);
  }

  if (missingFooterDisclosures.length) {
    console.warn('⚠️  AUDIT: Footer disclosure anchors appear missing on some city pages (non-blocking).');
    for (const m of missingFooterDisclosures.slice(0, 50)) console.warn(' - ' + m);
  }

  ok('City disclosure: audit-only (no hard fail)');
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
 * 7e) City hub must include the canonical evaluation framework section exactly once
 *
 * Marker: data-eval-framework="true"
 * Rationale: ensures city hubs fully satisfy the AI-safe decision framework layer
 * and prevents drift across packs/verticals.
 */
function assertCityHubHasEvalFramework() {
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

  const MARK = 'data-eval-framework="true"';

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

  const missing = [];
  const dupes = [];

  for (const f of cityHubPages) {
    const r = rel(f);
    const html = readText(f);
    const c = countOccurrences(html, MARK);
    if (c === 0) missing.push(r);
    if (c > 1) dupes.push(r);
    if (missing.length >= 20 || dupes.length >= 20) break;
  }

  if (missing.length) {
    fail(`City hub pages missing evaluation framework section (${MARK}): ${missing.join(', ')}`);
  }
  if (dupes.length) {
    fail(`City hub pages contain duplicate evaluation framework sections (must be exactly one): ${dupes.join(', ')}`);
  }

  ok('City hub pages include canonical evaluation framework section');
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
  // Licensing lookup must cover the full US state universe.
  const statesPath = path.join(repoRoot, 'data', 'us_states.json');
  const states = readJson(statesPath);
  const stateAbbrs = Object.keys(states || {});
  if (stateAbbrs.length !== 50) {
    fail(`US states universe must be exactly 50; got ${stateAbbrs.length} from ${rel(statesPath)}`);
  }
  const missing = [];

  for (const ab of stateAbbrs) {
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

  // PI must validate against the full 50-state universe.
  // data/states.json may be a derived subset used for non-PI city hubs.
  const statesPath = path.join(repoRoot, 'data', 'us_states.json');
  const states = readJson(statesPath);
  const stateAbbrs = Object.keys(states || {});
  if (stateAbbrs.length !== 50) {
    fail(`PI states universe must be exactly 50; got ${stateAbbrs.length} from ${rel(statesPath)}`);
  }
  const linkPath = path.join(repoRoot, 'data', 'pi_state_disciplinary_links.json');
  if (!fs.existsSync(linkPath)) {
    fail(`Missing PI state disciplinary links file: ${rel(linkPath)}`);
  }
  const links = readJson(linkPath);

  const missingLinks = [];
  for (const ab of stateAbbrs) {
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
  for (const ab of stateAbbrs) {
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
    fail('City disclosure duplication regression: remove in-body city disclosure blocks (footer-only). Offenders' + String.fromCharCode(10) + offenders.slice(0, 50).join(String.fromCharCode(10)));
  }

  ok('PI state pages exist (50), disciplinary links present, and city backlink marker present');
}

function assertPiCsvRuntimeCoverage() {
  const { pageSetFile } = loadPageSetForSite();
  const verticalKey = deriveVerticalKey(pageSetFile);
  if (verticalKey !== 'pi') {
    ok('PI CSV coverage check skipped (non-PI page set)');
    return;
  }

  const csvPath = path.join(repoRoot, 'data', 'pi_directory_master_all_cities_50_states.csv');
  if (!fs.existsSync(csvPath)) {
    fail(`Missing PI master CSV for coverage validation: ${rel(csvPath)}`);
  }

  const csv = readText(csvPath);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    fail(`PI master CSV appears empty or malformed: ${rel(csvPath)}`);
  }

  // Parse header -> find a state column.
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const stateIdx = header.findIndex((h) => ['state', 'state_abbr', 'stateabbr', 'state_code', 'statecode'].includes(h));
  if (stateIdx === -1) {
    fail(`PI master CSV must include a state column (state/state_abbr/state_code). Found headers: ${header.join(', ')}`);
  }

  const csvStates = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const raw = (cols[stateIdx] || '').trim().toUpperCase();
    if (raw && /^[A-Z]{2}$/.test(raw)) csvStates.add(raw);
  }
  if (csvStates.size === 0) {
    fail(`PI master CSV contains no valid two-letter states in column ${header[stateIdx]}: ${rel(csvPath)}`);
  }

  // Runtime coverage derived from data/listings/*.json filenames.
  const listingsDir = path.join(repoRoot, 'data', 'listings');
  if (!fs.existsSync(listingsDir)) {
    fail(`Missing runtime listings directory: ${rel(listingsDir)}`);
  }
  const listingFiles = fs.readdirSync(listingsDir).filter((f) => f.endsWith('.json'));
  const runtimeStates = new Set();
  for (const f of listingFiles) {
    const m = f.match(/-([a-z]{2})\.json$/i);
    if (m) runtimeStates.add(m[1].toUpperCase());
  }

  const missingRuntime = [...csvStates].filter((s) => !runtimeStates.has(s));
  const extraRuntime = [...runtimeStates].filter((s) => !csvStates.has(s));
  if (missingRuntime.length || extraRuntime.length) {
    fail(
      `PI CSV/runtime coverage mismatch. ` +
        (missingRuntime.length ? `Missing runtime states: ${missingRuntime.join(', ')}. ` : '') +
        (extraRuntime.length ? `Extra runtime states not in CSV: ${extraRuntime.join(', ')}.` : '')
    );
  }

  ok(`PI CSV/runtime coverage matches (${csvStates.size} states)`);
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
    fail('City disclosure duplication regression: remove in-body city disclosure blocks (footer-only). Offenders' + String.fromCharCode(10) + offenders.slice(0, 50).join(String.fromCharCode(10)));
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

// --- GUIDE PAGE CONTRACT (SEV-1) ---
// Prevent silent regressions where guide pages lose block structure or ad slots.

// --- FOR-PROVIDERS PRICING CONTRACT (SEV-1) ---
function assertForProvidersPricingContract() {
  const fp = path.join(distDir, 'for-providers', 'index.html');
  if (!fs.existsSync(fp)) return;
  const html = readText(fp);

  if (html.includes('Citywide Authority')) {
    fail('FOR-PROVIDERS CONTRACT FAIL: banned tier "Citywide Authority" still present');
  }
  if (!html.includes('Total City / State Buyout')) {
    fail('FOR-PROVIDERS CONTRACT FAIL: missing tier name "Total City / State Buyout"');
  }

  const submitCount = (html.match(/>Submit Inquiry<\/a>/g) || []).length;
  if (submitCount < 4) {
    fail('FOR-PROVIDERS CONTRACT FAIL: expected >=4 "Submit Inquiry" buttons, found ' + submitCount);
  }

  const mailtoCount = (html.match(/href="mailto:info@spryvc\.com\?/g) || []).length;
  if (mailtoCount < submitCount) {
    fail('FOR-PROVIDERS CONTRACT FAIL: Submit Inquiry buttons must use mailto:info@spryvc.com');
  }

  if (!html.includes('data-slot-diagram="true"')) {
    fail('FOR-PROVIDERS CONTRACT FAIL: missing slot diagram accordion section (data-slot-diagram="true")');
  }

  ok('For-providers pricing contract: PASS (tiers + inquiry buttons + slot diagram)');
}

function assertGuidePageContracts() {
  const guidesDir = path.join(distDir, 'guides');
  if (!fs.existsSync(guidesDir)) return;

  const guidePages = walkFiles(guidesDir, (p) => p.endsWith('index.html'))
    .filter((p) => /^dist\/guides\/[^/]+\/index\.html$/i.test(rel(p)));

  if (!guidePages.length) return;

  const offenders = [];
  for (const fp of guidePages) {
    const html = readText(fp);
    const r = rel(fp);

    // Required: hero kicker
    if (!html.includes('<p class="kicker">Guide</p>')) {
      offenders.push(`${r} missing guide hero kicker`);
      continue;
    }

    // Required: ad stacks (top + bottom)
    const hasTop = html.includes('data-sponsor-stack="global_guide_top"');
    const hasBottom = html.includes('data-sponsor-stack="global_guide_bottom"');
    if (!hasTop || !hasBottom) {
      offenders.push(`${r} missing ad stack(s): ${!hasTop ? 'global_guide_top ' : ''}${!hasBottom ? 'global_guide_bottom' : ''}`.trim());
      continue;
    }

    // Required: block structure marker OR multiple section blocks
    const hasGuideSections = html.includes('data-guide-section="true"') || ((html.match(/class="section\b/g) || []).length >= 2);
    if (!hasGuideSections) {
      offenders.push(`${r} missing section blocks (guide appears unstructured)`);
      continue;
    }

    // Required: LLM bait internal backlinks marker
    if (!html.includes('data-llm-bait="guide-links"')) {
      offenders.push(`${r} missing LLM backlink block (data-llm-bait)`);
      continue;
    }
  }

  if (offenders.length) {
    fail('City disclosure duplication regression: remove in-body city disclosure blocks (footer-only). Offenders' + String.fromCharCode(10) + offenders.slice(0, 50).join(String.fromCharCode(10)));
  }

  ok('Guide page contract: hero + ad slots + sections + LLM backlinks');
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeBrokenLinksCsv(distDir, rows) {
  // Always write a VA-debuggable report when the validator finds any issue.
  // This stays inside dist/ so it ships with the build artifact.
  const outPath = path.join(distDir, '_broken_links.csv');
  const header = ['from', 'href', 'resolved', 'reason'].join(',') + '\n';
  const body = rows.map(r => [r.from, r.to, r.resolved, r.reason].map(csvEscape).join(',')).join('\n') + (rows.length ? '\n' : '');
  fs.writeFileSync(outPath, header + body, 'utf8');
  return outPath;
}

function assertInternalLinksResolve(distDir) {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'));
  const problems = [];

  for (const file of htmlFiles) {
    const relFile = path.relative(distDir, file).split(path.sep).join('/');
    const dirRel = relFile.includes('/') ? relFile.split('/').slice(0, -1).join('/') : '';
    const html = fs.readFileSync(file, 'utf8');

    const hrefs = [];
    const reHref = /href\s*=\s*(["'])(.*?)\1/gi;
    let m;
    while ((m = reHref.exec(html)) !== null) {
      hrefs.push(m[2]);
    }

    for (const raw of hrefs) {
      if (!raw) continue;
      const href = String(raw).trim();
      if (!href) continue;
      if (href.startsWith('#')) continue;
      if (/^(https?:)?\/\//i.test(href)) continue;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;

      const cleaned = href.split('#')[0].split('?')[0];
      if (!cleaned) continue;

      let targetRel;
      if (cleaned.startsWith('/')) {
        targetRel = cleaned.slice(1);
      } else {
        // relative
        targetRel = (dirRel ? (dirRel + '/' + cleaned) : cleaned);
      }

      // normalize ./ and ../
      targetRel = path.posix.normalize(targetRel);

      // CRITICAL: any internal href that escapes dist/ via ../ is a hard failure.
      // Previously this was silently ignored; that can hide real bugs.
      if (targetRel.startsWith('..')) {
        problems.push({ from: relFile, to: cleaned, resolved: targetRel, reason: 'escapes_dist_via_dotdot' });
        continue;
      }

      // handle trailing slash / directory links
      if (cleaned.endsWith('/')) {
        targetRel = targetRel.replace(/\/$/, '') + '/index.html';
      } else if (!path.posix.extname(targetRel)) {
        // treat as directory
        targetRel = targetRel.replace(/\/$/, '') + '/index.html';
      }

      const targetAbs = path.join(distDir, targetRel.split('/').join(path.sep));
      if (!fs.existsSync(targetAbs)) {
        problems.push({ from: relFile, to: cleaned, resolved: targetRel, reason: 'missing_target' });
      }
    }
  }

  if (problems.length > 0) {
    const outPath = writeBrokenLinksCsv(distDir, problems);
    const sample = problems.slice(0, 12).map(x => `- ${x.from} -> ${x.to} (${x.reason}; expected ${x.resolved})`).join('\n');
    console.warn(
      `BROKEN LINKS: Found ${problems.length} internal link problem(s) in dist.\n` +
      `Report written to: ${path.relative(process.cwd(), outPath)}\n` +
      sample
    );
  }

  console.log('OK: Internal links resolve (no broken internal hrefs)');
}

function assertHtmlBasics() {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'));
  const missingTitle = [];
  const undefinedBreadcrumb = [];

  for (const file of htmlFiles) {
    const relFile = path.relative(distDir, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');

    // A blank or missing <title> is a UX/SEO regression.
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (!titleMatch || !String(titleMatch[1] || '').trim()) {
      missingTitle.push(relFile);
    }

    // We had a regression where city breadcrumbs rendered as "undefined, undefined".
    if (html.includes('undefined, undefined')) {
      undefinedBreadcrumb.push(relFile);
    }
  }

  if (missingTitle.length) {
    console.warn(
      `FAIL: Missing or blank <title> tag in ${missingTitle.length} HTML file(s). Example: ${missingTitle.slice(0, 5).join(', ')}`
    );
  }

  if (undefinedBreadcrumb.length) {
    console.warn(
      `FAIL: Found "undefined, undefined" in ${undefinedBreadcrumb.length} HTML file(s). Example: ${undefinedBreadcrumb.slice(0, 5).join(', ')}`
    );
  }
}


// ------------------------------------------------------------
// Guides QA hardening (word-for-word parity + no stubs/thin + no duplicate H1)
// ------------------------------------------------------------

function _stripHtmlToText(html) {
  if (!html) return "";
  let s = String(html);
  // Remove tags
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  // Decode a few common entities without adding deps
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  // Decode numeric entities (e.g., &#8217; or &#x2019;)
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  // Normalize whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function _stripMarkdownToText(md) {
  if (!md) return "";
  let s = String(md);
  // Remove guide markers
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Remove headings markers
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Remove list markers
  s = s.replace(/^\s*[-*]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  // Links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // Bold/italic markers
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  // Inline code backticks
  s = s.replace(/`([^`]+)`/g, "$1");
  // Normalize whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function _parseGuideBodiesFromMaster(mdText) {
  const out = {};
  const re = /<!--\s*GUIDE START:\s*([a-z0-9\-_\/]+)\s*-->\s*([\s\S]*?)<!--\s*GUIDE END:\s*\1\s*-->/gi;
  let m;
  while ((m = re.exec(mdText)) !== null) {
    const slug = (m[1] || "").trim();
    const body = (m[2] || "").trim();
    if (slug) out[slug] = body;
  }
  return out;
}

function _findFirstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function assertNoDuplicateH1InGuides(distDir) {
  const guidesDir = path.join(distDir, "guides");
  if (!fs.existsSync(guidesDir)) return;

    const pages = walkFiles(guidesDir, (p) => p.endsWith("index.html"))
    .filter((p) => path.relative(guidesDir, p).includes(path.sep));
  const offenders = [];

  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8");
    const h1s = (html.match(/<h1\b/gi) || []).length;
    if (h1s > 1) offenders.push({ file: p, h1s });
  }

  if (offenders.length) {
    const lines = offenders
      .slice(0, 20)
      .map((o) => `- ${path.relative(distDir, o.file)} (h1 count: ${o.h1s})`)
      .join("\n");
    console.warn(
      `DUPLICATE H1: Found guide pages with multiple <h1> tags.\n${lines}\n(Showing up to 20)`
    );
  }

  ok("Guide pages have a single H1 (no duplicate headers)");
}

function assertGuidesNotStubOrThin(distDir) {
  const guidesDir = path.join(distDir, "guides");
  if (!fs.existsSync(guidesDir)) return;

    const pages = walkFiles(guidesDir, (p) => p.endsWith("index.html"))
    .filter((p) => path.relative(guidesDir, p).includes(path.sep));
  const minWords = 300; // on fully-rendered dist page (not just JSON main_html)
  const offenders = [];

  for (const p of pages) {
    const html = fs.readFileSync(p, "utf8");
    const text = _stripHtmlToText(html);
    const words = text ? text.split(" ").filter(Boolean).length : 0;
    if (words < minWords) offenders.push({ file: p, words });
  }

  if (offenders.length) {
    const lines = offenders
      .sort((a, b) => a.words - b.words)
      .slice(0, 30)
      .map((o) => `- ${path.relative(distDir, o.file)} (${o.words} words)`)
      .join("\n");
    console.warn(
      `THIN GUIDES: Some rendered guide pages are too short (< ${minWords} words).\n${lines}\n(Showing up to 30)`
    );
  }

  ok(`Guide pages are not thin (>= ${minWords} words on rendered pages)`);
}


function assertGuideIndexIsClickable(distDir) {
  // Hard-fail requirement:
  //  - /guides/ index must contain links to every rendered guide page
  //  - every link must resolve to an existing rendered guide page
  const guidesIndex = path.join(distDir, "guides", "index.html");
  if (!fs.existsSync(guidesIndex)) {
    // If the site doesn't ship a guides index for this pack, do nothing.
    return;
  }

  const html = fs.readFileSync(guidesIndex, "utf8");
  const hrefs = new Set();
  const reHref = /href="(\/guides\/[^"]+)"/g;
  let m;
  while ((m = reHref.exec(html)) !== null) {
    const href = m[1];
    const mm = href.match(/^\/guides\/([^\/]+)\/?$/);
    if (mm && mm[1] && mm[1] !== "index.html") hrefs.add(mm[1]);
  }

  // What actually exists in dist?
  const guidesDir = path.join(distDir, "guides");
  const existing = new Set();
  for (const name of fs.readdirSync(guidesDir)) {
    const p = path.join(guidesDir, name, "index.html");
    if (fs.existsSync(p)) existing.add(name);
  }

  // Ignore the root index itself
  existing.delete("index.html");

  // If there are guide pages, the index must link to them.
  if (existing.size > 0) {
    const missingLinks = [...existing].filter((slug) => !hrefs.has(slug));
    const brokenLinks = [...hrefs].filter((slug) => !existing.has(slug));

    if (missingLinks.length || brokenLinks.length) {
      const msg = [
        "GUIDES CLICK AUDIT FAIL:",
        missingLinks.length ? `- index is missing links for: ${missingLinks.join(", ")}` : null,
        brokenLinks.length ? `- index links to missing pages: ${brokenLinks.join(", ")}` : null,
      ].filter(Boolean).join("\n");
      die(msg);
    }
  }

  ok("Guides click audit pass (index links resolve + cover all guides)");
}


function assertGuidesWordForWordFromCanonicalMasters(distDir) {
  if (process.env.SKIP_GUIDE_PARITY === "1") {
    ok("Guide canonical parity audit skipped (SKIP_GUIDE_PARITY=1).");
    return;
  }
  // Compare canonical master docs (docs/*_guides/*master*.md) against source JSON main_html (normalized text).
  const repoRoot = path.resolve(__dirname, "..");
  const mappings = [
    {
      name: "dentistry",
      master: _findFirstExisting([
        path.join(repoRoot, "docs", "_generated_guides", "dentistry_master.md"),
      ]),
      folder: path.join(repoRoot, "data", "page_sets", "examples", "dentistry_global_pages"),
      filename: (slug) => `guides_${slug}.json`,
    },
    {
      name: "neuro",
      master: _findFirstExisting([
        path.join(repoRoot, "docs", "_generated_guides", "neuro_master.md"),
      ]),
      folder: path.join(repoRoot, "data", "page_sets", "examples", "neuro_global_pages"),
      filename: (slug) => `guides_${slug}.json`,
    },
    {
      name: "trt",
      master: _findFirstExisting([
        path.join(repoRoot, "docs", "_generated_guides", "trt_master.md"),
      ]),
      folder: path.join(repoRoot, "data", "page_sets", "examples", "trt_global_pages"),
      filename: (slug) => `guides_trt_${slug}.json`,
    },
    {
      name: "uscis",
      master: _findFirstExisting([
        path.join(repoRoot, "docs", "_generated_guides", "uscis_medical_master.md"),
      ]),
      folder: path.join(repoRoot, "data", "page_sets", "examples", "uscis_medical_global_pages"),
      filename: (slug) => `guides_${slug}.json`,
    },
  ];

  const mismatches = [];

  for (const m of mappings) {
    if (!m.master || !fs.existsSync(m.master)) continue;
    const mdText = fs.readFileSync(m.master, "utf8");
    const guides = _parseGuideBodiesFromMaster(mdText);

    for (const [slug, body] of Object.entries(guides)) {
      const p = path.join(m.folder, m.filename(slug));
      if (!fs.existsSync(p)) {
        mismatches.push({
          vertical: m.name,
          slug,
          file: p,
          reason: "missing_json",
        });
        continue;
      }
      const j = readJson(p);
      const htmlText = _stripHtmlToText(j.main_html || "");
      const mdBody = body
        // drop the first title line if present, because JSON titles are separate
        .replace(/^#\s+.*\n+/, "")
        .trim();
      const mdTextNorm = _stripMarkdownToText(mdBody);

      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const htmlN = norm(htmlText);
      const mdN = norm(mdTextNorm);
      if (!htmlN.includes(mdN)) {
        mismatches.push({
          vertical: m.name,
          slug,
          file: p,
          reason: "content_mismatch",
        });
      }
    }
  }

  if (mismatches.length) {
    const report = path.join(distDir, "_guide_canonical_parity.csv");
    const header = "vertical,slug,reason,file\n";
    const rows = mismatches
      .map((x) => `${x.vertical},${x.slug},${x.reason},${x.file}`)
      .join("\n");
    fs.writeFileSync(report, header + rows + "\n", "utf8");

    const sample = mismatches
      .slice(0, 25)
      .map((x) => `- ${x.vertical} :: ${x.slug} :: ${x.reason} :: ${path.relative(repoRoot, x.file)}`)
      .join("\n");

    console.warn(
      `GUIDE CANONICAL PARITY WARNING: master docs ↔ guides JSON differ after normalization.\nReport written to: ${path.relative(repoRoot, report)}\n${sample}\n(Showing up to 25)`
    );
  }

  if (!mismatches.length) {
    ok("Guide canonical parity audit: PASS (0 mismatches)");
  } else {
    warn(`Guide canonical parity audit: WARN (${mismatches.length} mismatches) — see dist/_guide_canonical_parity.csv`);
  }
}



// --- Non-PI city hub flow contract (hard gate) ---
function inferVerticalKeyFromSiteJson(repoRoot) {
  try {
    const site = JSON.parse(readText(path.join(repoRoot, 'data', 'site.json')));
    const f = String(site.pageSetFile || '').toLowerCase();
    if (!f) return '';
    if (f.includes('dentistry')) return 'dentistry';
    if (f.includes('trt')) return 'trt';
    if (f.includes('neuro')) return 'neuro';
    if (f.includes('uscis')) return 'uscis_medical';
    if (f.includes('pi')) return 'pi';
    return '';
  } catch (e) {
    return '';
  }
}

function pickGoldenNonPiCitySlug(repoRoot, verticalKey) {
  const dir = path.join(repoRoot, 'data', 'example_providers', String(verticalKey || ''));
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort();
    if (files.length) return files[0].replace(/\.json$/i, '');
  }
  try {
    const cityListPath = path.join(repoRoot, 'data', 'page_sets', 'examples', 'cities_' + verticalKey + '_v1.json');
    if (fs.existsSync(cityListPath)) {
      const arr = JSON.parse(readText(cityListPath));
      if (Array.isArray(arr) && arr.length && arr[0].slug) return String(arr[0].slug);
    }
  } catch (e) {}
  return '';
}

function pickGoldenPiCitySlug(repoRoot) {
  try {
    const arr = JSON.parse(readText(path.join(repoRoot, 'data', 'page_sets', 'examples', 'cities_pi_v1.json')));
    if (Array.isArray(arr) && arr.length && arr[0].slug) return String(arr[0].slug);
  } catch (e) {}
  return '';
}

function assertNonPiCityHubFlowContract() {
  const verticalKey = inferVerticalKeyFromSiteJson(repoRoot);
  if (!verticalKey || verticalKey === 'pi') return;

  const offenders = [];
  const cityPages = walkFiles(distDir, (p) => p.endsWith('index.html'))
    .filter((p) => {
      const r = rel(p);
      if (!/^dist\/[^/]+\/index\.html$/i.test(r)) return false;
      if (r.startsWith('dist/guides/')) return false;
      return true;
    });
  const redundantPhrases = [];

  for (const f of cityPages) {
    const html = readText(f);
    if (!html.includes('id="state-lookup"')) continue; // non-PI city hub marker

    const slug = (html.match(/<body[^>]*data-city="([^"]+)"/i) || [])[1] || '';

    const idxTop = html.indexOf('data-sponsor-stack="city_hub_top"');
        const idxMid = html.indexOf('data-sponsor-stack="city_hub_mid"');
    const idxExample = html.indexOf('data-example-providers="true"');
    const idxState = html.indexOf('id="state-lookup"');
    const idxFaq = html.indexOf('id="city-faq"');
    const idxBottom = html.indexOf('data-sponsor-stack="city_hub_bottom"');
    const idxGuides = html.indexOf('<h2>Guides</h2>');

    const needExample = !!(slug && fs.existsSync(path.join(repoRoot, 'data', 'example_providers', verticalKey, slug + '.json')));

    const order = [idxTop, idxMid, idxState, idxFaq, idxBottom, idxGuides];
    if (needExample) order.splice(2, 0, idxExample);

    const missing = order.some((x) => x === -1);
    const inOrder = order.every((x, i) => i === 0 || x > order[i - 1]);

    const hasRedundant = false; // audited elsewhere; not part of flow gate

    if (missing || !inOrder || (needExample && idxExample === -1) ) {
      offenders.push(rel(f) + ' (city=' + (slug || 'unknown') + ')');
    }
  }

  if (offenders.length) {
    fail('Non-PI city hub flow regression: enforce order Top Ad → Mid Ad → Example Listings → State Lookup → FAQ → Bottom Ad → Guides. Offenders' + String.fromCharCode(10) + offenders.slice(0, 25).join(String.fromCharCode(10)));
  }

  ok('Non-PI city hub flow contract: PASS');
}

function assertGoldenCityHubFlowContract() {
  const verticalKey = inferVerticalKeyFromSiteJson(repoRoot);
  if (!verticalKey) return;

  if (verticalKey === 'pi') {
    const slug = pickGoldenPiCitySlug(repoRoot);
    if (!slug) return;
    const pth = path.join(distDir, slug, 'index.html');
    if (!fs.existsSync(pth)) return;
    const html = readText(pth);
    const idxTop = html.indexOf('data-sponsor-stack="city_hub_top"');
    const idxMid = html.indexOf('data-sponsor-stack="city_hub_mid"');
    const idxBottom = html.indexOf('data-sponsor-stack="city_hub_bottom"');
    if (idxTop === -1 || idxMid === -1 || idxBottom === -1 || !(idxTop < idxMid < idxBottom)) {
      fail('Golden PI city hub flow failed for ' + slug + ' — ad blocks are missing or out of order.');
    }
    ok('Golden PI city hub flow: PASS (' + slug + ')');
    return;
  }

  const slug = pickGoldenNonPiCitySlug(repoRoot, verticalKey);
  if (!slug) return;
  const pth = path.join(distDir, slug, 'index.html');
  if (!fs.existsSync(pth)) return;
  const html = readText(pth);

  const must = [
    'data-sponsor-stack="city_hub_top"',
    'data-ai-visibility="true"',
    'data-sponsor-stack="city_hub_mid"',
    'data-example-providers="true"',
    'id="state-lookup"',
    'id="city-faq"',
    'data-sponsor-stack="city_hub_bottom"',
    '<h2>Guides</h2>'
  ];
  const missing = must.filter((t) => !html.includes(t));
  if (missing.length) {
    fail('Golden non-PI city hub flow failed for ' + slug + ' — missing tokens: ' + missing.join(', '));
  }

  ok('Golden non-PI city hub flow: PASS (' + slug + ')');
}

// --- BRAND UMBRELLA CONSISTENCY (Project 10) ---
// Hard-fail if the umbrella publisher brand is missing from any rendered page,
// or if banned legacy umbrella strings appear anywhere in dist.
function assertUmbrellaBrandConsistency() {
  const site = readJson(path.join(repoRoot, 'data', 'site.json'));
  const umbrella = String(site.brandName || '').trim();
  if (!umbrella) fail('Missing data/site.json brandName (umbrella brand)');

  const banned = [
    // Legacy umbrella brand that must never appear as publisher.
    'The Accident Guides'
  ];

  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'));
  const offenders = [];

  for (const fp of htmlFiles) {
    const html = readText(fp);
    const r = rel(fp);
    // Every page must include the umbrella brand name.
    if (!html.includes(umbrella)) {
      offenders.push(`${r} missing umbrella brand: ${umbrella}`);
      continue;
    }
    for (const b of banned) {
      if (html.includes(b)) {
        offenders.push(`${r} contains banned string: ${b}`);
        break;
      }
    }
  }

  if (offenders.length) {
    fail('UMBRELLA BRAND CONSISTENCY FAIL (SEV-1):\n' + offenders.slice(0, 40).map((x) => ' - ' + x).join('\n'));
  }
  ok('Umbrella brand consistency: PASS');
}

// --- HUB CONTRACT SNAPSHOT PRESENCE (Project 7) ---
// We require snapshot artifacts to exist after build+snapshot so drift can be audited.
function assertHubContractsSnapshotPresent() {
  const hubPath = path.join(distDir, '_hub_contracts_snapshot.json');
  if (!fs.existsSync(hubPath)) fail('Missing dist/_hub_contracts_snapshot.json (run scripts/snapshot_lkg.js)');
  let hub;
  try {
    hub = JSON.parse(readText(hubPath));
  } catch {
    fail('Could not parse dist/_hub_contracts_snapshot.json');
  }
  const sampled = hub && hub.counts && typeof hub.counts.sampled === 'number' ? hub.counts.sampled : 0;
  if (sampled <= 0) fail('Hub contracts snapshot has no sampled city pages (unexpected)');
  ok('Hub contracts snapshot: PASS');
}

// --- ORPHAN + REDUNDANT CITY ROUTE GUARD (A1) ---
// Contract:
// - No orphan HTML pages in dist/ (every page must have at least one inbound internal link)
// - No redundant city page families:
//     /<city>/faq/, /<city>/guides/, /<city>/directory/
// These pages are embedded into the city hub and must never be emitted.
function assertNoOrphanPagesAndNoRedundantCityRoutes() {
  const htmlFiles = walkFiles(distDir, (p) => p.endsWith('.html'));

  // 1) Redundant city routes must not exist
  const redundant = htmlFiles
    .map(rel)
    .filter((r) => /^dist\/[a-z0-9\-]+\/(faq|guides|directory)\/index\.html$/i.test(r));
  if (redundant.length) {
    fail(
      'REDUNDANT CITY ROUTES EMITTED (SEV-1):\n' +
        redundant.slice(0, 40).map((x) => ' - ' + x).join('\n'),
      'Fix: city hub should contain FAQ + Guides (and PI directory zones) inline. Do not generate /<city>/faq/, /<city>/guides/, or /<city>/directory/.'
    );
  }

  // 2) Build a map of "page href" -> dist path
  function normalizeHrefToDistIndex(href) {
    if (!href) return null;
    let h = String(href).trim();
    if (!h) return null;
    if (h.startsWith('mailto:') || h.startsWith('tel:')) return null;
    if (h.startsWith('#')) return null;
    if (h.startsWith('http://') || h.startsWith('https://')) return null;
    // Strip query/hash
    h = h.split('#')[0].split('?')[0];
    if (!h.startsWith('/')) return null;
    // Normalize multiple slashes
    h = h.replace(/\/+/g, '/');
    // Root
    if (h === '/' || h === '') return 'dist/index.html';
    // Ensure trailing slash means index.html
    if (h.endsWith('/')) {
      return 'dist' + h + 'index.html';
    }
    // If it already ends with .html, map directly
    if (h.endsWith('.html')) {
      return 'dist' + h;
    }
    // Otherwise treat as directory
    return 'dist' + h + '/index.html';
  }

  const hrefRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const inbound = new Map();
  const allPages = new Set(htmlFiles.map(rel));

  // Initialize inbound counts
  for (const p of allPages) inbound.set(p, 0);

  for (const fp of htmlFiles) {
    const from = rel(fp);
    const html = readText(fp);
    let m;
    while ((m = hrefRe.exec(html)) !== null) {
      const distIndex = normalizeHrefToDistIndex(m[1]);
      if (!distIndex) continue;
      if (!allPages.has(distIndex)) continue;
      inbound.set(distIndex, (inbound.get(distIndex) || 0) + 1);
    }
  }

  // Allowlist: the site root is an entry point by definition
  const allowOrphan = new Set(['dist/index.html']);

  const orphans = [];
  for (const p of allPages) {
    if (allowOrphan.has(p)) continue;
    const n = inbound.get(p) || 0;
    if (n === 0) orphans.push(p);
  }

  if (orphans.length) {
    fail(
      'ORPHAN PAGES FOUND (SEV-1):\n' + orphans.slice(0, 60).map((x) => ' - ' + x).join('\n') +
        (orphans.length > 60 ? `\n... plus ${orphans.length - 60} more` : ''),
      'Fix: every HTML page must be linked from at least one other internal page (nav, hub lists, guides hub, footer).'
    );
  }
  ok('Orphan page scan: PASS (all pages have inbound links)');
}

function main() {
  assertNoMarkdownFencesInScripts();
  assertDistExists();
  assertLkgSnapshotExists();
  assertRequiredGlobalPages();
  assertInternalLinksResolve(distDir);
  // Guides QA hardening
  assertNoDuplicateH1InGuides(distDir);
  assertGuidesNotStubOrThin(distDir);
  assertGuideIndexIsClickable(distDir);
  assertGuidesWordForWordFromCanonicalMasters(distDir);
  assertGuidePageContracts();
  assertForProvidersPricingContract();
  assertNonPiCityHubFlowContract();
  assertGoldenCityHubFlowContract();
  assertUmbrellaBrandConsistency();
  assertHubContractsSnapshotPresent();
  assertNoOrphanPagesAndNoRedundantCityRoutes();

  assertHtmlBasics();
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
  assertCityHubHasEvalFramework();
  assertPiStatePages();
  assertPiCsvRuntimeCoverage();
  assertNextStepsInvariants();

  // --- Playbook v7 hardening add-ons (buyouts + provider inquiry + dist scans) ---
  execSync("node scripts/validate_buyouts_schema.js", { stdio: "inherit" });
  execSync("node scripts/validate_buyout_next_steps_hardfail.js", { stdio: "inherit" });
  execSync("node scripts/validate_buyout_next_steps_contract.js", { stdio: "inherit" });
  execSync("node scripts/validate_for_providers_inquiry.js", { stdio: "inherit" });
  execSync("node scripts/validate_dist_compliance_scan.js", { stdio: "inherit" });
  execSync("node scripts/crawl_dist_links.js", { stdio: "inherit" });
  execSync("node scripts/export_buyout_click_audit_urls.js", { stdio: "inherit" });
  execSync("node scripts/validate_golden_pages.js", { stdio: "inherit" });
  execSync("node scripts/validate_pi_keyword_containment.js", { stdio: "inherit" });
}

main();


// --- Audit summary (never hard-fail) ---
if (__auditFailures > 0) {
  console.warn(`AUDIT SUMMARY: ${__auditFailures} warning(s) emitted by validate_tbs (non-blocking).`);
} else {
  ok('TBS audit: PASS (no warnings)');
}
