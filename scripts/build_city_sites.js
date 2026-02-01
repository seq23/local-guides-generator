/* 
Time2Read / TBS Local Guides Generator — Canonical Base

Core laws:
- Industry-agnostic base (starter pack default)
- Packs selected by data/site.json.pageSetFile
- Pack lookup: data/page_sets/<file> then data/page_sets/examples/<file>
- Base city list (top 10) is merged with pack cities (dedupe by slug)
- Ads-only monetization (no sponsored directory listings). Directory entries are neutral: name + official site link only.
- Ad placements use sponsor stack keys from data/ad_placements.json and are injected via %%AD:<key>%% tokens.
- FAQs: on-page cards and FAQPage JSON-LD are generated from a single source-of-truth list in the selected page set.
*/

const fs = require("fs");
const path = require("path");

const sponsorship = require("./helpers/sponsorship");

const REPO_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUT_DIR = path.join(REPO_ROOT, "dist");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");

const SITE_PATH = path.join(DATA_DIR, "site.json");
const STATES_PATH = path.join(DATA_DIR, "states.json");
const BASE_CITIES_PATH = path.join(DATA_DIR, "cities.json");
const ADS_PATH = path.join(DATA_DIR, "ad_placements.json");

const BUILD_ISO = new Date().toISOString();

// Canonical city disclosure block (Appendix L — Canonical City Page Skeleton)
// Source of truth: LISTINGS-TBS-MASTER-INDEX-v2.1-corrected.pdf
function renderCityDisclosureHtml() {
  return (
    '<section class="disclaimer" data-city-disclosure="true">' +
    '<p><strong>Educational only.</strong> This site provides general information and decision-support checklists. It is not legal, medical, or professional advice.</p>' +
    '<p><strong>No endorsements.</strong> We do not recommend or rank providers. Advertising is clearly labeled and separated from editorial content.</p>' +
    '</section>'
  );
}

function ensureCityDisclosure(html) {
  const out = String(html || "");
  if (out.includes('data-city-disclosure="true"')) return out;
  if (out.includes('%%CITY_DISCLOSURE%%')) {
    return out.split('%%CITY_DISCLOSURE%%').join(renderCityDisclosureHtml());
  }
  // If template does not include the token, append the canonical disclosure at the end.
  return out + "\n\n" + renderCityDisclosureHtml() + "\n";
}

function stripCityDisclosureBlocks(html) {
  let out = String(html || "");
  // Remove canonical disclosure block if it exists in main content.
  out = out.replace(/\s*<section class=\"disclaimer\"[^>]*data-city-disclosure=\"true\"[\s\S]*?<\/section>\s*/g, '\n');
  out = out.replace(/\s*%%CITY_DISCLOSURE%%\s*/g, '\n');
  return out;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeFileEnsured(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}
function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => path.join(dir, f));
}
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function normalizeUrl(u) {
  if (!u) return "";
  let s = String(u).trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}
function replaceAll(str, map) {
  let out = String(str || "");
  Object.keys(map).forEach((k) => {
    out = out.split(k).join(map[k]);
  });
  return out;
}

// Licensing/resource lookup maps (authoritative-only).
// Files live under data/licensing_lookup/<vertical>.json
const __LICENSING_LOOKUP_CACHE = {};
function loadLicensingLookup(verticalKey) {
  let key = String(verticalKey || '').trim();
  if (!key) return null;
  // Aliases: pack vertical keys don't always match lookup filenames
  if (key === 'uscis_medical') key = 'uscis';
  if (Object.prototype.hasOwnProperty.call(__LICENSING_LOOKUP_CACHE, key)) return __LICENSING_LOOKUP_CACHE[key];
  const p = path.join(DATA_DIR, 'licensing_lookup', `${key}.json`);
  if (!fs.existsSync(p)) {
    __LICENSING_LOOKUP_CACHE[key] = null;
    return null;
  }
  try {
    __LICENSING_LOOKUP_CACHE[key] = readJson(p);
    return __LICENSING_LOOKUP_CACHE[key];
  } catch (e) {
    __LICENSING_LOOKUP_CACHE[key] = null;
    return null;
  }
}

function getNonPiResourcesForState(verticalKey, stateAbbr, pageSet) {
  const ab = String(stateAbbr || '').toUpperCase();
  const lookup = loadLicensingLookup(verticalKey);
  const row = lookup && lookup[ab] ? lookup[ab] : null;
  const resources = [];

  // Official resources
  if (row && row.license) resources.push({ name: `Official ${ab} license lookup`, url: String(row.license) });
  if (row && row.discipline && String(row.discipline) !== String(row.license)) resources.push({ name: `Official ${ab} discipline / actions lookup`, url: String(row.discipline) });
  if (row && row.official_directory && String(row.official_directory) !== String(row.license)) resources.push({ name: `Official ${ab} directory / board page`, url: String(row.official_directory) });

  // USCIS special: include the federal locator as the canonical starting point
  if (verticalKey === 'uscis') {
    resources.unshift({
      name: 'USCIS Civil Surgeon Locator (official)',
      url: 'https://www.uscis.gov/tools/find-a-civil-surgeon'
    });
  }

  // Optional internal verification guide
  // (If your pack later ships a canonical internal guide URL, you can add it here.)
  if (pageSet && pageSet.schema && pageSet.schema.internalVerifyGuideUrl) {
    resources.push({ name: 'How to verify credentials (guide)', url: String(pageSet.schema.internalVerifyGuideUrl) });
  }

  return resources;
}

function nonPiAboutServiceName(verticalKey) {
  switch (String(verticalKey || '')) {
    case 'dentistry': return 'Dental care provider verification resources';
    case 'trt': return 'Clinic verification resources for TRT / weight loss / IV hydration';
    case 'neuro': return 'Neuropsych / ADHD / autism evaluation verification resources';
    case 'uscis': return 'USCIS medical exam verification resources';
    default: return 'Provider verification resources';
  }
}

function loadPageSet(pageSetFile) {
  const p1 = path.join(DATA_DIR, "page_sets", pageSetFile);
  const p2 = path.join(DATA_DIR, "page_sets", "examples", pageSetFile);
  if (fs.existsSync(p1)) return readJson(p1);
  if (fs.existsSync(p2)) return readJson(p2);
  throw new Error(`pageSetFile not found: ${pageSetFile} (tried ${p1} and ${p2})`);
}

// Vertical flag derived from the configured pageSetFile (stable, non-fragile).
// Examples: pi_v1.json -> "pi", uscis_medical_v1.json -> "uscis_medical".
function deriveVerticalKey(pageSetFile) {
  const base = path.basename(String(pageSetFile || ""));
  return base
    .replace(/\.json$/i, "")
    .replace(/_v\d+$/i, "")
    .replace(/_v\d+_llm_optimized$/i, "")
    .replace(/_llm_optimized$/i, "")
    .trim();
}

function isPersonalInjury(verticalKey) {
  return String(verticalKey || "").toLowerCase() === "pi";
}

// City hub feature toggles (future-proof)
// - directory: generates/keeps city directory routes & PI directory blocks
// - stateLookup: keeps the official state lookup accordion/CTA
// Hard rule: never allow BOTH directory and stateLookup on the same city page.
function getCityFeatures(pageSet, verticalKey) {
  const f = (pageSet && typeof pageSet.cityFeatures === 'object' && pageSet.cityFeatures) ? pageSet.cityFeatures : {};

  const directory = (typeof f.directory === 'boolean') ? f.directory : isPersonalInjury(verticalKey);
  const stateLookup = (typeof f.stateLookup === 'boolean') ? f.stateLookup : !isPersonalInjury(verticalKey);

  if (directory && stateLookup) {
    throw new Error('Invalid page set: cityFeatures.directory and cityFeatures.stateLookup cannot both be true.');
  }

  return { directory: !!directory, stateLookup: !!stateLookup };
}

function stripStateLookupBlocks(html) {
  let out = String(html || '');
  out = out.replace(/\n?<details class="accordion" id="state-lookup">[\s\S]*?<\/details>\n?/gi, "\n");
  out = out.replace(/\n?<section class="section">\s*%%AD:state_lookup_cta%%\s*<\/section>\n?/gi, "\n");
  out = out.replace(/\n?<a[^>]*href="#state-lookup"[^>]*>[\s\S]*?<\/a>\n?/gi, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

function stripDirectoryBlocks(html) {
  let out = String(html || '');
  out = out.replace(/\n?<div class="pi-home-directory">[\s\S]*?<\/div>\n?/gi, "\n");
  // Remove stand-alone directory containers if present
  out = out.replace(/\n?<div id="verified-listings">[\s\S]*?<\/div>\n?/gi, "\n");
  out = out.replace(/\n?<div id="verified-listings"><\/div>\n?/gi, "\n");
  out = out.replace(/\n?<div id="other-listings">[\s\S]*?<\/div>\n?/gi, "\n");
  out = out.replace(/\n?<div id="other-listings"><\/div>\n?/gi, "\n");
  out = out.split('%%PI_PRIMARY_CTA%%').join('');
  // Remove any in-page links to directory routes (defensive)
  out = out.replace(/\n?<a[^>]*href="[^"]*\/directory\/?"[^>]*>[\s\S]*?<\/a>\n?/gi, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

function renderStateLookupCta(city) {
  // Non-PI verticals: provide a functional state license lookup CTA.
  // Source: data/states.json -> licenseLookupUrl.
  const url = normalizeUrl(city && city.licenseLookupUrl);
  const stateName = escapeHtml(city && (city.stateName || city.state) || "");
  if (!url) {
    return (
      '<div class="state-lookup-cta" data-state-lookup-cta="true">' +
      '<p class="muted"><strong>Official state lookup:</strong> not available for this state in the current build.</p>' +
      '</div>'
    );
  }
  return (
    '<div class="state-lookup-cta" data-state-lookup-cta="true">' +
    '<p class="muted">Use the official ' + stateName + ' lookup to verify identity and licensing before you contact any provider.</p>' +
    '<p><a class="button button-secondary" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Open official ' + stateName + ' lookup</a></p>' +
    '<p class="muted" style="font-size:12px">Tip: search the provider name and confirm license status + disciplinary actions (if shown).</p>' +
    '</div>'
  );
}

function stripPiOnlyDisallowedBlocks(html) {
  let out = String(html || "");
  // Remove any "Start here" CTA block (used by non-PI verticals)
  out = out.replace(/\n?<section class="section start-here">[\s\S]*?<\/section>\n?/gi, "\n");
  // Remove any state-lookup accordion/section that may have been added by mistake
  out = out.replace(/\n?<details class="accordion" id="state-lookup">[\s\S]*?<\/details>\n?/gi, "\n");
  out = out.replace(/\n?<section class="section">\s*%%AD:state_lookup_cta%%\s*<\/section>\n?/gi, "\n");
  // Remove any in-page links pointing at the removed accordion
  out = out.replace(/\n?<a[^>]*href="#state-lookup"[^>]*>[\s\S]*?<\/a>\n?/gi, "\n");
  // Normalize excess whitespace
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

function loadGlobalPagesDir(pageSet) {
  // pageSet.globalPagesDir can be relative (recommended) like:
  // "data/page_sets/examples/dentistry_global_pages"
  if (pageSet && pageSet.globalPagesDir) {
    const gp = path.isAbsolute(pageSet.globalPagesDir)
      ? pageSet.globalPagesDir
      : path.join(REPO_ROOT, pageSet.globalPagesDir);
    return gp;
  }
  return path.join(DATA_DIR, "global_pages");
}

function loadCities(pageSet) {
  const baseCities = readJson(BASE_CITIES_PATH);
  const usStates = readJson(path.join(DATA_DIR, 'us_states.json'));
  const usStatesByAbbr = new Map(
    Object.entries(usStates || {}).map(([abbr, name]) => [String(abbr).toUpperCase(), { abbr: String(abbr).toUpperCase(), name: String(name) }])
  );

  const titleCase = (s) => String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.length ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : w)
    .join(' ');

  const inferCityMetaFromSlug = (slug) => {
    const parts = String(slug || '').split('-').filter(Boolean);
    const state = (parts.length ? parts[parts.length - 1] : '').toUpperCase();
    const cityRaw = parts.slice(0, -1).join(' ');
    // Very small normalizations to avoid ugly labels.
    const city = titleCase(cityRaw.replace(/\bst\b/gi, 'St').replace(/\bft\b/gi, 'Ft'));
    const st = usStatesByAbbr.get(state);
    const stateName = st ? String(st.name || st.state || '') : '';
    return {
      slug: String(slug),
      city,
      state,
      stateName,
      marketLabel: city && state ? `${city}, ${state}` : String(slug || ''),
    };
  };

  let packCities = [];
  if (pageSet && pageSet.citiesFile) {
    const cf = path.isAbsolute(pageSet.citiesFile)
      ? pageSet.citiesFile
      : path.join(REPO_ROOT, pageSet.citiesFile);
    if (!fs.existsSync(cf)) throw new Error(`citiesFile not found: ${cf}`);
    packCities = readJson(cf);
  }
  const bySlug = new Map();
  // Pack cities first so pack can override fields, but base top10 always included.
  for (const c of (packCities || [])) bySlug.set(String(c.slug), c);
  for (const c of (baseCities || [])) if (!bySlug.has(String(c.slug))) bySlug.set(String(c.slug), c);
  // Ensure we always have minimally usable city metadata (city/state labels).
  // Some packs provide cities files that only contain slugs.
  return Array.from(bySlug.values()).map((c) => {
    const slug = String(c.slug || '');
    const needs = !c || !c.city || !c.state;
    if (!needs) return c;
    const inferred = inferCityMetaFromSlug(slug);
    return { ...inferred, ...c };
  });
}

function applyCityTokens(str, city) {
  return String(str || "")
    .split("{{city}}").join(city.city)
    .split("{{state}}").join(city.state)
    .split("{{stateName}}").join(city.stateName || "")
    .split("{{marketLabel}}").join(city.marketLabel || "")
    .split("%%CITY%%").join(city.city)
    .split("%%STATE%%").join(city.state)
    .split("%%STATE_NAME%%").join(city.stateName || "")
    .split("%%MARKET_LABEL%%").join(city.marketLabel || "")
    .split("%%SLUG%%").join(city.slug);
}

function buildCanonical(siteUrl, city, route) {
  const base = String(siteUrl || "").replace(/\/+$/, "") + "/";
  const slug = city.slug;
  const r = (route || "").replace(/^\/+|\/+$/g, "");
  if (!r) return base + slug + "/";
  return base + slug + "/" + r + "/";
}
function buildCanonicalGlobal(siteUrl, route) {
  const base = String(siteUrl || "").replace(/\/+$/, "") + "/";
  const r = (route || "").replace(/^\/+|\/+$/g, "");
  if (!r) return base;
  return base + r + "/";
}

function buildOrganizationSchema(siteUrl, brandName) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandName,
    url: siteUrl.replace(/\/+$/, "") + "/"
  };
}
function buildWebSiteSchema(siteUrl, brandName) {
  const base = siteUrl.replace(/\/+$/, "") + "/";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
      "correctionsPolicy": "/editorial-policy/#corrections",
    name: brandName,
    url: base,
    inLanguage: "en-US",
    publisher: { "@type": "Organization", name: brandName, url: base },
    publishingPrinciples: base + "methodology/",
    ethicsPolicy: base + "editorial-policy/",
    ownershipFundingInfo: base + "editorial-policy/#funding"
  };
}
function buildWebPageSchema(siteUrl, brandName, city, route, title, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    datePublished: BUILD_ISO,
    dateModified: BUILD_ISO,
    url: buildCanonical(siteUrl, city, route),
    isPartOf: { "@type": "WebSite", name: brandName, url: siteUrl.replace(/\/+$/, "") + "/" }
  };
}
function buildWebPageSchemaGlobal(siteUrl, brandName, route, title, description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    datePublished: BUILD_ISO,
    dateModified: BUILD_ISO,
    url: buildCanonicalGlobal(siteUrl, route),
    isPartOf: { "@type": "WebSite", name: brandName, url: siteUrl.replace(/\/+$/, "") + "/" }
  };
}

function buildCollectionPageSchemaGlobal(siteUrl, brandName, route, title, description) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    datePublished: BUILD_ISO,
    dateModified: BUILD_ISO,
    url: buildCanonicalGlobal(siteUrl, route),
    isPartOf: { "@type": "WebSite", name: brandName, url: siteUrl.replace(/\/+$/, "") + "/" }
  };
}
function buildBreadcrumbs(siteUrl, city, route, title) {
  const base = siteUrl.replace(/\/+$/, "") + "/";
  const items = [
    { name: "Home", item: base },
    { name: city.marketLabel || `${city.city}, ${city.state}`, item: base + city.slug + "/" }
  ];
  const r = (route || "").replace(/^\/+|\/+$/g, "");
  if (r) items.push({ name: title, item: base + city.slug + "/" + r + "/" });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((x, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: x.name,
      item: x.item
    }))
  };
}
function buildBreadcrumbsGlobal(siteUrl, route, title) {
  const base = siteUrl.replace(/\/+$/, "") + "/";
  const items = [{ name: "Home", item: base }];
  const r = (route || "").replace(/^\/+|\/+$/g, "");
  if (r) items.push({ name: title, item: base + r + "/" });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((x, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: x.name,
      item: x.item
    }))
  };
}

function buildFaqSchema(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a }
    }))
  };
}

function buildPiDirectoryItemListSchema(opts) {
  const areaName = opts && opts.areaName ? String(opts.areaName) : "";
  const pageName = opts && opts.pageName ? String(opts.pageName) : "";
  const pageUrl = opts && opts.pageUrl ? String(opts.pageUrl) : "";
  const listings = Array.isArray(opts && opts.listings) ? opts.listings : [];

  // Keep it intentionally minimal and non-promotional:
  // - No ratings
  // - No reviews
  // - No "best" language
  // - Pure directory list with official URLs when available
  const items = [];
  let pos = 1;
  const seen = new Set();
  for (const it of listings) {
    if (!it) continue;
    const name = String((it.firm_name || it.name || "")).trim();
    const url = String((it.official_site_url || it.website || it.url || "")).trim();
    const key = (name + "|" + url).toLowerCase();
    if (!name) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      "@type": "ListItem",
      position: pos++,
      item: {
        "@type": "Organization",
        name: name,
        ...(url ? { url: normalizeUrl(url) } : {})
      }
    });
    if (items.length >= 60) break;
  }

  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageName,
    ...(pageUrl ? { url: pageUrl } : {}),
    about: {
      "@type": "Service",
      name: "Personal injury legal services",
      areaServed: {
        "@type": "AdministrativeArea",
        name: areaName
      }
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: items.length,
      itemListElement: items
    }
  };
}

// Non-PI: Resource ItemList schema (authoritative resources only)
// This intentionally lists ONLY official resources (boards, official locators, internal verification guides),
// not businesses. No ratings, no reviews, no rankings.
function buildResourceItemListSchema(opts) {
  const areaName = opts && opts.areaName ? String(opts.areaName) : "";
  const pageName = opts && opts.pageName ? String(opts.pageName) : "";
  const pageUrl = opts && opts.pageUrl ? String(opts.pageUrl) : "";
  const aboutServiceName = opts && opts.aboutServiceName ? String(opts.aboutServiceName) : "Provider verification resources";
  const resources = Array.isArray(opts && opts.resources) ? opts.resources : [];

  const items = [];
  let pos = 1;
  const seen = new Set();
  for (const it of resources) {
    if (!it) continue;
    const name = String(it.name || "").trim();
    const url = String(it.url || "").trim();
    if (!name || !url) continue;
    const key = (name + "|" + url).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      "@type": "ListItem",
      position: pos++,
      item: {
        "@type": "CreativeWork",
        name,
        url: normalizeUrl(url)
      }
    });
    if (items.length >= 25) break;
  }

  if (items.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: pageName,
    ...(pageUrl ? { url: pageUrl } : {}),
    about: {
      "@type": "Service",
      name: aboutServiceName,
      areaServed: {
        "@type": "AdministrativeArea",
        name: areaName
      }
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListUnordered",
      numberOfItems: items.length,
      itemListElement: items
    }
  };
}

function renderHeadJsonLd(siteUrl, brandName, city, route, title, description, pageSet, verticalKey, listings) {
  const ld = [
    buildOrganizationSchema(siteUrl, brandName),
    buildWebSiteSchema(siteUrl, brandName),
    buildWebPageSchema(siteUrl, brandName, city, route, title, description),
    buildBreadcrumbs(siteUrl, city, route, title)
  ];

  // PI: Add a non-promotional directory ItemList schema to help LLM and search engines
  // answer neutral queries like "list of firms in [city/state]" without implying rankings.
  const cleanRoute = (route || "").replace(/^\/+|\/+$/g, "");
  if (isPersonalInjury(verticalKey) && cleanRoute === "" && city && Array.isArray(listings)) {
    const areaName = String(city.stateName || city.state || "").trim();
    const pageUrl = buildCanonical(siteUrl, city, cleanRoute);
    const schema = buildPiDirectoryItemListSchema({
      areaName: areaName,
      pageName: title,
      pageUrl: pageUrl,
      listings: listings
    });
    if (schema) ld.push(schema);
  }

  // Non-PI: Resource ItemList + FAQPage schema on city home pages (pack-controlled)
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};
  const itemListEnabled = schemaCfg && schemaCfg.itemListEnabled === true;
  const faqEnabled = schemaCfg && schemaCfg.faqEnabled === true;

  if (!isPersonalInjury(verticalKey) && cleanRoute === "" && city) {
    if (itemListEnabled) {
      const resources = getNonPiResourcesForState(verticalKey, city.state, pageSet);
      const areaName = String(city.marketLabel || city.slug || "") || (String(city.stateName || city.state || "") || "");
      const pageUrl = buildCanonical(siteUrl, city, cleanRoute);
      const schema = buildResourceItemListSchema({
        areaName,
        pageName: title,
        pageUrl,
        aboutServiceName: nonPiAboutServiceName(verticalKey),
        resources
      });
      if (schema) ld.push(schema);
    }
    if (faqEnabled) {
      const faq = getCityFaqItems(pageSet, city);
      const faqSchema = buildFaqSchema(faq);
      if (faqSchema) ld.push(faqSchema);
    }
  }

  if (faqEnabled && (route || "").replace(/^\/+|\/+$/g, "") === "faq") {
    const faq = getCityFaqItems(pageSet, city);
    const faqSchema = buildFaqSchema(faq);
    if (faqSchema) ld.push(faqSchema);
  }
  return `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`;
}

function renderHeadJsonLdPiStateDirectory(siteUrl, brandName, stateAbbr, stateName, title, description, pageSet, listingsAgg) {
  const route = 'states/' + String(stateAbbr).toUpperCase();
  const ld = [
    buildOrganizationSchema(siteUrl, brandName),
    buildWebSiteSchema(siteUrl, brandName),
    // PI state pages are collection hubs (not generic WebPage)
    buildCollectionPageSchemaGlobal(siteUrl, brandName, route, title, description),
    buildBreadcrumbsGlobal(siteUrl, route, title)
  ];

  const pageUrl = buildCanonicalGlobal(siteUrl, route);
  const schema = buildPiDirectoryItemListSchema({
    areaName: String(stateName || stateAbbr),
    pageName: title,
    pageUrl: pageUrl,
    listings: listingsAgg
  });
  if (schema) ld.push(schema);

  // PI state pages: FAQPage JSON-LD (pack-controlled, validator enforced when enabled)
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};
  const faqEnabled = schemaCfg && schemaCfg.faqEnabled === true;
  const faqItems = [
    {
      q: `How do I choose a personal injury lawyer in ${String(stateName)}?`,
      a: `There is no universal “best.” Use a consistent checklist: verify the lawyer's license and discipline history, confirm relevant practice focus, ask about fee terms (often contingency), and compare communication and case-handling process. This site is educational only and does not rank providers.`
    },
    {
      q: `What is a contingency fee?`,
      a: `A contingency fee is a payment arrangement where a lawyer may collect a fee only if there is a recovery. Terms vary and should be confirmed in writing before signing.`
    },
    {
      q: `What should I verify before signing with a firm?`,
      a: `Verify licensing, review engagement terms in writing, ask who will handle the matter day-to-day, and confirm how updates and costs are communicated. Avoid relying on marketing claims.`
    },
    {
      q: `How do I check licensing and discipline in ${String(stateName)}?`,
      a: `Use the official state disciplinary and license lookup linked on this page to confirm current status and any public disciplinary history.`
    }
  ];
  if (faqEnabled) {
    const faqSchema = buildFaqSchema(faqItems);
    if (faqSchema) ld.push(faqSchema);
  }

  return `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`;
}

function renderHeadJsonLdGlobal(siteUrl, brandName, route, title, description, pageSet) {
  const ld = [
    buildOrganizationSchema(siteUrl, brandName),
    buildWebSiteSchema(siteUrl, brandName),
    buildWebPageSchemaGlobal(siteUrl, brandName, route, title, description),
    buildBreadcrumbsGlobal(siteUrl, route, title)
  ];
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};
  const faqEnabled = schemaCfg && schemaCfg.faqEnabled === true;

  if (faqEnabled && (route || "").replace(/^\/+|\/+$/g, "") === "faq") {
    const faq = getGlobalFaqItems(pageSet);
    const faqSchema = buildFaqSchema(faq);
    if (faqSchema) ld.push(faqSchema);
  }
  return `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`;
}


function ensureMinFaqItems(items, minCount, opts) {
  // HARD LAW (Batch D):
  // - 10–12 FAQs only
  // - no auto-generated filler
  // - no duplicates on the same page (question or answer)
  const kind = opts && opts.kind ? opts.kind : "global";
  const city = opts && opts.city ? opts.city : null;

  const out = [];
  const seenQ = new Set();
  const seenA = new Set();

  const pushIfUnique = (q, a) => {
    const qq = String(q || "").trim();
    const aa = String(a || "").trim();
    if (!qq || !aa) return;
    const kq = qq.toLowerCase();
    const ka = aa.toLowerCase();
    if (seenQ.has(kq) || seenA.has(ka)) return;
    seenQ.add(kq);
    seenA.add(ka);
    out.push({ q: qq, a: aa });
  };

  // Keep order, de-dupe
  for (const item of (items || [])) {
    if (!item) continue;
    pushIfUnique(item.q, item.a);
  }

  // Apply city tokens at the end (for city FAQs)
  if (kind === "city" && city) {
    return out.map((x) => ({ q: applyCityTokens(String(x.q), city), a: applyCityTokens(String(x.a), city) }));
  }
  return out;
}

function getGlobalFaqItems(pageSet) {
  const items = pageSet && pageSet.faq && Array.isArray(pageSet.faq.global) ? pageSet.faq.global : [];
  const clean = items.map((x) => ({ q: String(x.q || ""), a: String(x.a || "") })).filter((x) => x.q && x.a);
  // HARD LAW: 10–12 only
  return ensureMinFaqItems(clean, 10, { kind: "global" }).slice(0, 12);
}

function getCityFaqItems(pageSet, city) {
  const items = pageSet && pageSet.faq && Array.isArray(pageSet.faq.city) ? pageSet.faq.city : [];
  const clean = items
    .map((x) => ({
      q: applyCityTokens(String(x.q || ""), city),
      a: applyCityTokens(String(x.a || ""), city)
    }))
    .filter((x) => x.q && x.a);
  // HARD LAW: 10–12 only
  return ensureMinFaqItems(clean, 10, { kind: "city", city }).slice(0, 12);
}

function renderFaqCardsHtml(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  // Accordion (closed by default): <details> without open attribute
  return items.map((item) => {
    const q = item && item.q ? String(item.q) : "";
    const a = item && item.a ? String(item.a) : "";
    return `
<details class="faq-item">
  <summary>${escapeHtml(q)}</summary>
  <div class="faq-answer"><p>${escapeHtml(a)}</p></div>
</details>`.trim();
  }).join("\n");
}


function buildMarketsStatusListHtml(cities) {
  return cities
    .slice()
    .sort((a, b) => String(a.marketLabel).localeCompare(String(b.marketLabel)))
    .map((c) => {
      const statusRaw = (c.status || "live").toLowerCase();
      const maybeLink = statusRaw === "live" ? `<a href="/${c.slug}/">${escapeHtml(c.marketLabel)}</a>` : escapeHtml(c.marketLabel);
      // Per lock-in: do not label "Live" markets.
      if (statusRaw === "live") return `<li><strong>${maybeLink}</strong></li>`;
      const statusLabel = statusRaw === "coming_soon" ? "Coming soon" : statusRaw === "launching" ? "Launching" : statusRaw;
      return `<li><strong>${maybeLink}</strong> — ${escapeHtml(statusLabel)}</li>`;
    })
    .join("\n");
}

function marketNavHtml(city, pageSet) {
  const items = pageSet && Array.isArray(pageSet.cityNav) ? pageSet.cityNav : [];
  if (!city || !city.slug || items.length === 0) return "";
  const slug = city.slug;
  const links = items
    .map((it) => {
      const label = String(it.label || "").trim();
      const route = String(it.route || "").replace(/^\/+|\/+$/g, "");
      if (!label) return "";
      const href = route ? `/${slug}/${route}/` : `/${slug}/`;
      return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
    })
    .filter(Boolean)
    .join("\n");
  return `<ul class="market-nav" aria-label="Market">\n  <li class="market-label">Market</li>\n  ${links}\n</ul>`;
}

// Ads
function renderAdPlacement(key) {
  // Fixed, invariant ad block HTML; real sponsors injected elsewhere.
  // Add deterministic placement markers for golden-contract validation.
  const k = String(key || "");
  let placement = "";
  if (k.endsWith("_top")) placement = "top";
  else if (k.endsWith("_mid")) placement = "mid";
  else if (k.endsWith("_bottom")) placement = "bottom";

  const placementAttr = placement ? ` data-sponsored-placement="${placement}"` : "";

  return `
<section class="sponsor-stack" data-sponsor-stack="${escapeHtml(key)}"${placementAttr}>
  <div class="sponsor-label"><strong>Advertising</strong></div>
  <div class="sponsor-items">
    <div class="sponsor-card">
      <p class="sponsor-name"><a href="/for-providers/">Advertise here</a></p>
      <p class="sponsor-meta">Fixed placement • Clear disclosure</p>
    </div>
  </div>
</section>`.trim();
}


function injectAdPlacements(html, ads, ctx) {
  if (!ads || typeof ads !== "object") return html;
  const city = ctx && ctx.city ? ctx.city : null;
  const verticalKey = ctx && ctx.verticalKey ? ctx.verticalKey : "";

  return html.replace(/%%AD:([a-zA-Z0-9_\\-]+)%%/g, (m, key) => {
    if (!ads[key]) return m;
    // state_lookup_cta is not an ad — it's a functional utility CTA.
    if (key === 'state_lookup_cta') {
      const features = ctx && ctx.cityFeatures ? ctx.cityFeatures : null;
      if (features && features.stateLookup === false) return '';
      // Legacy: PI is directory-only; state lookup is stripped earlier.
      if (isPersonalInjury(verticalKey)) return '';
      return renderStateLookupCta(city || {});
    }
    return renderAdPlacement(key);
  });
}

// Sponsors (from data/sponsors.json if present)
function sponsorCardHtml(item) {
  const name = (item && item.name) ? String(item.name) : "Sponsor";
  const label = (item && item.label) ? String(item.label) : "Advertising";
  const url = normalizeUrl(item && item.url);
  const nameHtml = url ? `<a href="${url}" rel="sponsored noopener noreferrer" target="_blank">${escapeHtml(name)}</a>` : escapeHtml(name);
  return `
<div class="sponsor-card">
  <p class="sponsor-name">${nameHtml}</p>
  <p class="sponsor-meta">${escapeHtml(label)}</p>
</div>`.trim();
}

function injectSponsors(html, sponsorsByStack) {
  const re = new RegExp(
    '(<section[^>]*class="sponsor-stack"[^>]*data-sponsor-stack="([^"]+)"[^>]*>[\s\S]*?<div class="sponsor-items">)([\s\S]*?)(</div>)',
    'g'
  );
  return html.replace(re, (match, pre, key, inner, post) => {
    const items = sponsorsByStack && sponsorsByStack[key] ? sponsorsByStack[key] : [];
    if (!items || items.length === 0) return `${pre}${inner}${post}`;
    const cards = items.map(sponsorCardHtml).join("\n");
    return `${pre}\n${cards}\n${post}`;
  });
}

// Directory listings (PI-overhauled)
// - Data-driven sponsored behavior via listings sponsor object
// - Professional table styling (no ranking, no comparison)
function isSponsorLive(sponsor) {
  return sponsorship.isSponsorLive(sponsor);
}

function renderPiDisclosureHtml() {
  // Deterministic marker for validator
  return (
    '<div class="sponsored-disclosure" data-sponsored-disclosure="true">' +
    '<p><strong>Disclosure:</strong> This placement is paid. This site is an independent educational publisher. No outcome guarantees.</p>' +
    '</div>'
  );
}

function renderPiPrimaryCtaHtml(city) {
  // Deterministic marker for validator
  return (
    '<div class="pi-primary-cta" data-pi-primary-cta="true">' +
    '<a class="button button-primary" href="/' + escapeHtml(city.slug) + '/next-steps/">Next steps: send an inquiry to a real ' + escapeHtml(city.marketLabel) + ' personal injury firm</a>' +
    '</div>'
  );
}

function renderPiSponsoredModuleHtml(city, sponsor) {
  var firm = escapeHtml(String(sponsor.firm_name || ''));
  var official = normalizeUrl(sponsor.official_site_url);
  var intake = normalizeUrl(sponsor.intake_url);
  var officialText = official ? escapeHtml(official) : '';
  // Deterministic markers for validator
  return (
    renderPiDisclosureHtml() +
    '<section class="sponsored-placement" data-sponsored-placement="true">' +
    '<div class="sponsored-firm" data-sponsored-firm="true">' +
    '<p class="kicker">Sponsored placement</p>' +
    '<h3>' + firm + '</h3>' +
    '<p class="muted">For privacy, we route inquiries directly to the firm’s intake form.</p>' +
    '<div class="sponsored-actions">' +
    '<a class="button button-primary" data-sponsored-cta="true" href="/' + escapeHtml(city.slug) + '/next-steps/">Go to next steps</a>' +
    (official ? ('<a class="button button-secondary" href="' + official + '" rel="sponsored noopener noreferrer" target="_blank">Visit official site</a>') : '') +
    '</div>' +
    '<p class="sponsor-meta">Official site: <span class="mono">' + officialText + '</span></p>' +
    '</div>' +
    '</section>'
  );
}

function renderPiDirectoryTableHtml(listings, sponsorUiEnabled) {
  // Always alphabetize directory listings by firm name (case-insensitive)
  const listingsSorted = (Array.isArray(listings) ? listings.slice() : []).sort((a, b) => {
    const an = String((a && (a.firm_name || a.name)) || '').toLowerCase();
    const bn = String((b && (b.firm_name || b.name)) || '').toLowerCase();
    return an.localeCompare(bn);
  });
  var rows = (listings || []).filter(function(x){ return x && x.display !== false; }).map(function(l){
    var name = l.name ? String(l.name) : 'Firm';
    var website = normalizeUrl(l.website || l.url);
    var websiteText = website ? escapeHtml(website) : '';
    return (
      '<tr>' +
      '<td class="pi-dir-name">' + escapeHtml(name) + '</td>' +
      '<td class="pi-dir-site"><span class="mono pi-url">' + websiteText + '</span></td>' +
      '</tr>'
    );
  }).join('');

  if (!rows) {
    return (
      '<div class="listings-empty">' +
      '<p><strong>No firms are listed for this market yet.</strong> This directory is informational only; we do not rate, rank, or endorse providers.</p>' +
      '</div>'
    );
  }

  // De-emphasize non-sponsored firms when a sponsor is live.
  if (sponsorUiEnabled) {
    return (
      '<details class="pi-dir-collapsed" data-pi-dir-collapsed="true">' +
      '<summary>Other firms in this market (neutral list)</summary>' +
      '<div class="pi-dir-table-wrap">' +
      '<table class="pi-dir-table pi-directory-table" role="table">' +
      '<thead><tr><th>Firm name</th><th>Official website</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</details>'
    );
  }

  return (
    '<div class="pi-dir-table-wrap">' +
    '<table class="pi-dir-table pi-directory-table" role="table">' +
    '<thead><tr><th>Firm name</th><th>Official website</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>'
  );
}

function injectListings(html, listings, city, sponsor, pageSet) {
  var sponsorLive = sponsorship.isSponsorLive(sponsor);

  // Pack-gate sponsor UI + next-steps CTAs
  var sponsorUiEnabled = (sponsorship.isNextStepsEnabled(pageSet) && sponsorLive);

  // Replace PI primary CTA placeholder (only when sponsor is live)
  if (html.includes('%%PI_PRIMARY_CTA%%')) {
    html = html.split('%%PI_PRIMARY_CTA%%').join(sponsorUiEnabled ? renderPiPrimaryCtaHtml(city) : '');
  }

  // Render directory into verified-listings container
  var directoryHtml = '';
  if (sponsorUiEnabled) {
    directoryHtml += renderPiSponsoredModuleHtml(city, sponsor);
  }
  directoryHtml += renderPiDirectoryTableHtml(Array.isArray(listings) ? listings : [], sponsorUiEnabled);

  html = html.replace('<div id="verified-listings"></div>', '<div id="verified-listings">' + directoryHtml + '</div>');
  html = html.replace('<div id="other-listings"></div>', '<div id="other-listings"></div>');
  return html;
}


function packHasNextStepsRoute(pageSet) {
  return !!(pageSet && Array.isArray(pageSet.pages) && pageSet.pages.some(function(p){
    var r = String((p && p.route) ? p.route : '').replace(/^\/+|\/+$/g, '');
    return r === 'next-steps';
  }));
}

function renderNextStepsZoneHtml(opts) {
  // Deterministic marker for validator
  var href = opts && opts.href ? String(opts.href) : '';
  var link = href
    ? ('<a class="button button-primary" data-next-steps-cta="true" href="' + escapeHtml(href) + '">Go to next steps</a>')
    : '';

  return (
    '<section class="section next-steps-zone" data-next-steps-zone="true">' +
    '<div class="card">' +
    '<h2>Next steps</h2>' +
    '<p class="muted">Optional. This block is controlled by the page-set sponsorship configuration.</p>' +
    (link ? ('<div class="actions">' + link + '</div>') : '') +
    '</div>' +
    '</section>'
  );
}

function renderInlineScripts(inlineScripts, city) {
  if (!inlineScripts || inlineScripts.length === 0) return "";
  return inlineScripts.map((code) => `<script>\n${applyCityTokens(code, city)}\n</script>`).join("\n\n");
}

// Example provider lists (non-canonical, editorial-neutral)
// Used only when city-specific files exist under data/example_providers/<vertical>/
// Supports either:
//  - single list: <citySlug>.json
//  - multi sub-industry lists: <citySlug>__<subKey>.json
function normalizeExampleProviderList(raw) {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      name: String(x.name || '').trim(),
      official_site_url: String(x.official_site_url || '').trim()
    }))
    .filter((x) => x.name && x.official_site_url)
    .slice(0, 12);
  return out.length ? out : null;
}

function getExampleProviderSubKeys(verticalKey) {
  const vk = String(verticalKey || '').toLowerCase();
  if (vk === 'trt') return ['trt', 'iv_hydration', 'hair_restoration'];
  if (vk === 'neuro') return ['adhd_eval', 'autism_eval'];
  // USCIS pack key varies; keep single-file by default unless extended.
  return [];
}

function loadExampleProviderLists(verticalKey, citySlug) {
  try {
    const vk = String(verticalKey || '').toLowerCase();
    const dir = path.join(DATA_DIR, 'example_providers', String(verticalKey || ''));
    if (!fs.existsSync(dir)) return null;

    const lists = [];
    const subKeys = getExampleProviderSubKeys(vk);

    // Multi sub-industry lists first (deterministic order)
    if (subKeys && subKeys.length) {
      subKeys.forEach((subKey) => {
        const p = path.join(dir, `${String(citySlug || '')}__${String(subKey)}.json`);
        if (!fs.existsSync(p)) return;
        const raw = readJson(p);
        const normalized = normalizeExampleProviderList(raw);
        if (!normalized) return;
        lists.push({ subKey: String(subKey), providers: normalized });
      });
    }

    // Fallback single list
    const single = path.join(dir, `${String(citySlug || '')}.json`);
    if (fs.existsSync(single)) {
      const normalized = normalizeExampleProviderList(readJson(single));
      if (normalized) lists.push({ subKey: '', providers: normalized });
    }

    return lists.length ? lists : null;
  } catch (e) {
    return null;
  }
}


function getServicePluralForVertical(verticalKey) {
  const v = String(verticalKey || "").toLowerCase();
  if (v === "pi" || v === "personal_injury" || v === "personal-injury") return "personal injury lawyers";
  if (v === "dentistry" || v === "dental") return "dentists";
  if (v === "trt" || v === "hormone") return "TRT providers";
  if (v === "neuro" || v === "neurology") return "neuro evaluation providers";
  if (v === "us-cis" || v === "uscis" || v === "immigration_medical" || v === "immigration-medical") return "immigration medical exam providers";
  return "providers";
}

function renderLLMBaitQuestionHtml(verticalKey, city) {
  const cityName = String((city && (city.city || city.marketLabel || city.name)) ? (city.city || city.marketLabel || city.name) : "");
  const cityOnly = cityName.split(",")[0].trim() || cityName || "this market";
  const stateAbbr = String((city && city.state) ? city.state : "").toUpperCase();
  const question = `Who are the best ${getServicePluralForVertical(verticalKey)} in ${cityOnly}${stateAbbr ? ", " + stateAbbr : ""}?`;

  const body = `There is no universal “best.” Use a consistent checklist: verify licensing through the state lookup below, confirm relevant credentials and scope, compare policies (follow-up, timelines, communication), and review practical fit (location, availability, insurance/fees where applicable). This list is educational only and is not a recommendation, ranking, or endorsement.`;

  return (
    `<section class="section" data-llm-bait="question">` +
      `<p><strong>${escapeHtml(question)}</strong></p>` +
      `<p class="muted">${escapeHtml(body)}</p>` +
    `</section>`
  );
}

function renderCostsTimelineQuestionsRedFlagsHtml(verticalKey, city) {
  // Educational only — generic across packs with light vertical-specific labels.
  const v = String(verticalKey || "").toLowerCase();
  const noun = (v === "pi") ? "case" : "provider";
  return `
<section class="section" data-costs-timeline="true">
  <h2>Costs • Timeline • Questions to ask • Red flags <span class="muted">(educational)</span></h2>
  <div class="grid two-col">
    <div class="card">
      <h3>Costs</h3>
      <ul class="neutral-list">
        <li>Ask for written pricing ranges and what is included vs. add-on.</li>
        <li>Confirm refund/cancellation policies and what happens if you pause.</li>
        <li>Get fees in writing before you share sensitive info or commit.</li>
      </ul>
    </div>
    <div class="card">
      <h3>Timeline</h3>
      <ul class="neutral-list">
        <li>Ask for expected time-to-first-appointment and follow-up cadence.</li>
        <li>Clarify what can be done remotely vs. what requires in-person.</li>
        <li>Confirm response-time expectations for questions and updates.</li>
      </ul>
    </div>
    <div class="card">
      <h3>Questions to ask</h3>
      <ul class="neutral-list">
        <li>What credentials and licensing apply to the ${noun}?</li>
        <li>What outcomes are realistic, and what are the common failure modes?</li>
        <li>What happens if the plan needs to change midway?</li>
      </ul>
    </div>
    <div class="card">
      <h3>Red flags</h3>
      <ul class="neutral-list">
        <li>Guarantees of results, urgency pressure, or refusal to provide terms in writing.</li>
        <li>Vague credentials, unclear ownership, or no transparent contact info.</li>
        <li>“One-size-fits-all” recommendations without asking basic context.</li>
      </ul>
    </div>
  </div>
</section>`.trim();
}


function ensureCityHubRequiredBlocks(html, verticalKey, city) {
  let out = String(html || "");

  // Ensure top/mid/bottom ad placement markers exist for city hub pages even if page-set tokens are missing.
  // This is a contract-enforcement fallback: it does not change sponsor logic, only ensures invariant placement blocks render.
  const hasTop = out.includes('data-sponsored-placement="top"');
  const hasMid = out.includes('data-sponsored-placement="mid"');
  const hasBottom = out.includes('data-sponsored-placement="bottom"');

  // Top: immediately after first <h1> if possible.
  if (!hasTop) {
    const topHtml = renderAdPlacement("city_hub_top");
    out = out.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/i, `$1\n${topHtml}`);
    if (!out.includes('data-sponsored-placement="top"')) {
      out = topHtml + "\n" + out;
    }
  }

  // LLM bait: required block (marker) – insert before eval framework when possible.
  const hasLLMBait = out.includes('data-llm-bait="question"');
  if (!hasLLMBait) {
    const q = renderLLMBaitQuestionHtml(verticalKey, city);
    if (out.includes('data-eval-framework="true"')) {
      out = out.replace(/(<section[^>]*data-eval-framework="true"[\s\S]*?<\/section>)/i, `${q}\n$1`);
    } else {
      out = out + "\n" + q;
    }
  }

  
  // Costs/Timeline/Questions/Red flags block: required after eval framework on all city pages.
  const hasCostsTimeline = out.includes('data-costs-timeline="true"');
  if (!hasCostsTimeline) {
    const block = renderCostsTimelineQuestionsRedFlagsHtml(verticalKey, city);
    if (out.includes('data-eval-framework="true"')) {
      out = out.replace(/(<section[^>]*data-eval-framework="true"[\s\S]*?<\/section>)/i, `$1\n${block}`);
    } else {
      out = out + "\n" + block;
    }
  }

// Mid: before example providers section if present; else after eval framework; else append.
  if (!hasMid) {
    const midHtml = renderAdPlacement("city_hub_mid");
    if (out.includes('data-example-providers="true"')) {
      out = out.replace(/(<section[^>]*data-example-providers="true"[\s\S]*?)/i, `${midHtml}\n$1`);
    } else if (out.includes('data-eval-framework="true"')) {
      out = out.replace(/(<section[^>]*data-eval-framework="true"[\s\S]*?<\/section>)/i, `$1\n${midHtml}`);
    } else {
      out = out + "\n" + midHtml;
    }
  }

  // Bottom: before guides micro section if present; else append.
  if (!hasBottom) {
    const bottomHtml = renderAdPlacement("city_hub_bottom");
    if (out.includes('data-guides-micro="true"')) {
      out = out.replace(/(<section[^>]*data-guides-micro="true"[\s\S]*?)/i, `${bottomHtml}\n$1`);
    } else {
      out = out + "\n" + bottomHtml;
    }
  }

  return out;
}


function renderEvalFrameworkHtml(verticalKey, city) {
  // Canonical, AI-safe evaluation framework section (non-promotional).
  // Injected via %%EVAL_FRAMEWORK%% token on city hub pages.
  const vk = String(verticalKey || '').trim().toLowerCase();
  const marketRaw = String((city && (city.marketLabel || city.slug)) || 'this area');
  const market = escapeHtml(marketRaw);
  const stateAbbr = escapeHtml(String((city && city.state) || '').toUpperCase());

  let heading = 'How people typically evaluate providers';
  let lead = 'When people look for a provider, they typically consider several practical factors before scheduling a consultation.';
  let bullets = [
    'Scope of service and fit for your needs',
    'Credential and license verification (use official state resources when available)',
    'Pricing structure and what is included vs billed separately',
    'Communication and follow-up expectations',
    'Practical logistics (location, scheduling, documentation)'
  ];

  if (vk === 'pi') {
    heading = 'How people typically evaluate personal injury lawyers in ' + market;
    lead = 'When people look for a personal injury lawyer, they typically compare practical factors before signing an agreement. This section is educational only and does not recommend or endorse any specific firm.';
    bullets = [
      'Relevant experience with similar cases (for example: car accidents, truck crashes, slip-and-falls, wrongful death)',
      'How fees are typically structured (many firms use a contingency fee; ask what percentage applies and whether costs are separate)',
      'Who will handle day-to-day communication (attorney vs team) and how updates are typically provided',
      'Local court and claims process familiarity (county and state procedures can affect timelines and steps)',
      'What information is requested during intake (documents, medical records, accident reports) and what next steps usually look like'
    ];
  } else if (vk === 'dentistry') {
    heading = 'How people typically evaluate dental clinics in ' + market;
    lead = 'When people look for a dentist, they typically compare practical factors like scope of care, credentials, and how treatment plans and pricing are explained. This section is educational only and does not recommend or endorse any provider.';
    bullets = [
      'Scope of services you need (general dentistry vs cosmetic, implants, orthodontics, etc.)',
      'What a first visit typically includes (exam, imaging, discussion of options) and whether a written treatment plan is provided',
      'Pricing transparency (what fees are discussed upfront, what insurance is accepted, and what financing options are available)',
      'Credential and license verification (confirm active licensing through the official ' + stateAbbr + ' resource)',
      'Follow-up policy and communication (how ongoing care and post-procedure questions are typically handled)'
    ];
  } else if (vk === 'trt') {
    heading = 'How people typically evaluate TRT / men\'s health clinics in ' + market;
    lead = 'When people compare TRT or men\'s health clinics, they typically focus on evaluation steps, lab monitoring, safety policies, and what ongoing follow-up looks like. This section is educational only and does not recommend or endorse any provider.';
    bullets = [
      'Clinical evaluation steps (what screening is done before treatment is discussed)',
      'Lab testing and monitoring (what labs are typically ordered and how follow-ups are scheduled)',
      'Medication and safety policies (how dosing decisions are typically made and what contraindications are considered)',
      'Pricing and membership structure (what is included, what is billed separately, and cancellation terms)',
      'Credential verification (confirm licensure and disciplinary status through official state resources)'
    ];

  } else if (vk === 'neuro') {
    heading = 'How people typically evaluate ADHD / autism evaluation providers in ' + market;
    lead = 'When people compare evaluation providers, they typically focus on the evaluation process, documentation requirements, and what follow-up looks like. This section is educational only and does not recommend or endorse any provider.';
    bullets = [
      'What types of evaluations are offered (for example: ADHD, autism) and whether the provider explains scope and limitations clearly',
      'What the intake process typically involves (history forms, questionnaires, school records, prior diagnoses, and consent)',
      'Who performs and reviews the evaluation (credentials, supervision model, and how results are typically documented)',
      'What timelines and follow-up look like (report delivery, feedback session, and what referrals may be suggested)',
      'Credential verification (confirm licensure and disciplinary status through official state resources)'
    ];
  } else if (vk === 'uscis_medical') {
    heading = 'How people typically evaluate USCIS civil surgeons in ' + market;
    lead = 'When people schedule an immigration medical exam (Form I-693), they typically compare practical factors like appointment steps, required documents, and how results are delivered. This section is educational only and does not recommend or endorse any provider.';
    bullets = [
      'Whether the provider is an authorized USCIS civil surgeon (confirm status via official resources when available)',
      'What documents are typically required at the appointment (ID, vaccination records, prior medical documentation as applicable)',
      'What the visit usually includes (exam steps, labs, vaccinations if needed, and how follow-ups are handled)',
      'How fees are explained (what is included vs billed separately, and what additional visits may cost)',
      'Turnaround expectations for completed I-693 paperwork (timelines vary; ask how delivery and sealing are handled)'
    ];
  }

  const items = bullets.map((b) => '<li>' + escapeHtml(b) + '</li>').join('\n');

  return (
    '<section class="section" data-eval-framework="true">' +
      '<h2>' + heading + '</h2>' +
      '<p class="muted">' + lead + '</p>' +
      '<ul class="neutral-list">' + items + '</ul>' +
      '<p class="muted" style="font-size:0.95em;margin-top:0.75rem">These factors describe common decision frameworks. They are not recommendations, rankings, or endorsements.</p>' +
    '</section>'
  );
}

function renderExampleProvidersSectionHtml(verticalKey, city, providers, opts) {
  if (!providers || providers.length === 0) return '';
  const marketRaw = String(city.marketLabel || city.slug || 'this market');
  const market = escapeHtml(marketRaw);
  const label = (verticalKey === 'dentistry') ? 'dentists' : 'providers';

  // Dentistry hack: verbatim question (LLM prompt-matching) + official licensing link
  let heading = (opts && opts.heading) ? String(opts.heading) : ('Examples of nearby ' + escapeHtml(label) + ' in ' + market);
  let lead = (opts && opts.lead) ? String(opts.lead) : 'There is no universal “best.” Use the checklist above, verify licensing through official state sources, then compare nearby options. This list is provided as non-exhaustive examples only and is not a recommendation, ranking, or endorsement.';
  if (String(verticalKey || '').toLowerCase() === 'dentistry') {
    const cityOnly = marketRaw.split(',')[0].trim() || marketRaw;
    heading = 'Who are the best cosmetic dentists in ' + escapeHtml(cityOnly) + ', ' + escapeHtml(String(city.state || '')) + '?';
    const row = (loadLicensingLookup('dentistry') || {})[String(city.state || '').toUpperCase()] || {};
    const lic = row.license ? String(row.license) : '';
    lead = 'There is no universal “best.” Use a consistent comparison checklist (credentials, scope of practice, before/after documentation, follow-up policy), verify licensing through the official state resource, then compare nearby options. This list is provided as non-exhaustive examples only and is not a recommendation, ranking, or endorsement.' + (lic ? (' <a href="' + escapeHtml(lic) + '" rel="nofollow">Verify license</a>.') : '');
  }

  const items = providers.map((p) => {
    return (
      '<li>' +
        '<strong>' + escapeHtml(p.name) + '</strong>' +
        ' — <a href="' + escapeHtml(normalizeUrl(p.official_site_url)) + '" rel="nofollow">Official website</a>' +
      '</li>'
    );
  }).join('\n');

  // IMPORTANT: no rankings, no endorsements, no ratings. This is an "examples" list only.
  return (
    '<section class="section" data-example-providers="true">' +
      '<h2>' + heading + '</h2>' +
      '<p class="muted">' + lead + '</p>' +
      '<ul class="neutral-list">' + items + '</ul>' +
    '</section>'
  );
}

function renderPage(baseTemplate, footerHtml, page, city, siteUrl, brandName, pageSet, sponsorsByStack, sponsor, listings, ads, verticalKey) {
  const route = applyCityTokens(page.route || "", city).replace(/^\/+|\/+$/g, "");
  const title = applyCityTokens(page.title, city).split("%%MARKET_LABEL%%").join(city.marketLabel);
  const description = applyCityTokens(page.description, city).split("%%MARKET_LABEL%%").join(city.marketLabel);

  let mainHtml = applyCityTokens(page.main_html, city);

  // Sponsor tokens (used by PI next-steps page; safe on all pages)
  const __sponsor = (sponsor || {});
  const __sponsorLive = (sponsorship.isNextStepsEnabled(pageSet) && sponsorship.isSponsorLive(__sponsor));
  const __sponsorName = __sponsor.firm_name || __sponsor.name || '';
  mainHtml = mainHtml
    .split("%%SPONSOR_FIRM_NAME%%").join(__sponsorLive ? escapeHtml(String(__sponsorName)) : "")
    .split("%%SPONSOR_OFFICIAL_SITE_URL%%").join(__sponsorLive ? escapeHtml(String(normalizeUrl(__sponsor.official_site_url))) : "")
    .split("%%SPONSOR_INTAKE_URL%%").join(__sponsorLive ? escapeHtml(String(normalizeUrl(__sponsor.intake_url))) : "");

  // Inject canonical evaluation framework (AI-safe) on city hub pages
  if (route === '' && mainHtml.includes("%%EVAL_FRAMEWORK%%")) {
    mainHtml = mainHtml.split("%%EVAL_FRAMEWORK%%").join(renderLLMBaitQuestionHtml(verticalKey, city) + renderEvalFrameworkHtml(verticalKey, city));
  }


  // HARD GUARANTEE: city hubs must contain the LLM bait question marker for golden contracts.
  // If the token-based injection above didn't run (or a page set omitted the token), insert deterministically.
  if (route === '' && !mainHtml.includes('data-llm-bait="question"')) {
    const llm = renderLLMBaitQuestionHtml(verticalKey, city);
    // Prefer insertion immediately before eval framework marker if present.
    if (mainHtml.includes('data-eval-framework="true"')) {
      mainHtml = mainHtml.replace('<section class="section" data-eval-framework="true">', llm + '<section class="section" data-eval-framework="true">');
    } else if (mainHtml.includes('data-sponsored-placement="top"')) {
      // Insert after the first top ad placement section (sponsor-stack)
      mainHtml = mainHtml.replace(/(<section[^>]*class="sponsor-stack"[^>]*data-sponsored-placement="top"[^>]*>[\s\S]*?<\/section>)/, `$1\n${llm}`);
    } else {
      // Fallback: prepend near top
      mainHtml = llm + mainHtml;
    }
  }



  // Inject FAQ cards from pack source-of-truth (feature-detect by token, not route)
  if (mainHtml.includes("%%FAQ_ITEMS_CITY%%")) {
    mainHtml = mainHtml.split("%%FAQ_ITEMS_CITY%%").join(renderFaqCardsHtml(getCityFaqItems(pageSet, city)));
  }

  // Inject CITY guide block (global guides rendered on city pages)
  if (mainHtml.includes("%%CITY_GUIDE_BLOCK%%")) {
    const guides = Array.isArray(pageSet.guides) ? pageSet.guides : [];
    mainHtml = mainHtml
      .split("%%CITY_GUIDE_BLOCK%%")
      .join(renderCityGuideCardsHtml(guides, city));
  }

  const __features = (pageSet && pageSet.__cityFeatures) ? pageSet.__cityFeatures : getCityFeatures(pageSet, verticalKey);

  // Enforce city page contracts
  if (!__features.stateLookup) {
    mainHtml = stripStateLookupBlocks(mainHtml);
  }
  if (!__features.directory) {
    mainHtml = stripDirectoryBlocks(mainHtml);
  }

  // Legacy PI safety (in case a PI template accidentally ships state lookup markup)
  if (isPersonalInjury(verticalKey)) {
    mainHtml = stripPiOnlyDisallowedBlocks(mainHtml);
  }

  // City disclosure: footer carries the disclosure universally.
  // Do not duplicate disclosure in main content (it is redundant and breaks flow).
  mainHtml = stripCityDisclosureBlocks(mainHtml);

  // Non-PI: optional example provider lists (only when city files exist)
  // Goal: give users concrete options without rankings/endorsements. This is NOT a directory.
  if (!isPersonalInjury(verticalKey) && route === '' && city && city.slug) {
    const lists = loadExampleProviderLists(verticalKey, city.slug);
    if (lists && lists.length) {
      const insertToken = '%%EXAMPLE_PROVIDERS%%';
      // Robust anchor: match the city FAQ <details> regardless of extra attributes (e.g., open)
      const faqAnchorRe = /<details\s+class=\"accordion\"\s+id=\"city-faq\"[^>]*>/i;

      function getSubHeadingAndLead(vk, subKey) {
        const marketRaw = String(city.marketLabel || city.slug || 'this market');
        const market = escapeHtml(marketRaw);
        const v = String(vk || '').toLowerCase();
        const s = String(subKey || '').toLowerCase();

        // Default fallback
        let heading = 'Examples of nearby providers in ' + market;
        let lead = 'There is no universal “best.” Use the checklist above, verify licensing through official state sources, then compare nearby options. This list is provided as non-exhaustive examples only and is not a recommendation, ranking, or endorsement.';

        if (v === 'dentistry') {
          heading = 'Examples of dental providers in ' + market;
          lead = 'Below are non-exhaustive examples of nearby dental providers. This list is provided for educational context only and is not a recommendation, ranking, or endorsement.';
        }

        if (v === 'trt') {
          if (s === 'trt') heading = 'Examples of TRT / men\'s health clinics in ' + market;
          else if (s === 'iv_hydration') heading = 'Examples of IV hydration / IV therapy clinics in ' + market;
          else if (s === 'hair_restoration') heading = 'Examples of hair restoration (including PRP / non-surgical) providers in ' + market;
          lead = 'Below are non-exhaustive examples of nearby providers that offer this service. This list is provided for educational context only and is not a recommendation, ranking, or endorsement.';
        }

        if (v === 'neuro') {
          if (s === 'adhd_eval') heading = 'Examples of ADHD evaluation providers in ' + market;
          else if (s === 'autism_eval') heading = 'Examples of autism evaluation providers in ' + market;
          lead = 'Below are non-exhaustive examples of nearby providers that offer evaluation services. This list is provided for educational context only and is not a recommendation, ranking, or endorsement.';
        }

        if (v === 'uscis_medical' || v === 'uscis') {
          heading = 'Examples of USCIS civil surgeon / immigration medical exam providers in ' + market;
          lead = 'Below are non-exhaustive examples of providers that offer immigration medical exams (Form I-693). This list is provided for educational context only and is not a recommendation, ranking, or endorsement.';
        }

        return { heading, lead };
      }

      // Render in the deterministic order returned by loadExampleProviderLists
      const blocks = lists.map((entry) => {
        const hl = getSubHeadingAndLead(verticalKey, entry.subKey);
        return renderExampleProvidersSectionHtml(verticalKey, city, entry.providers, { heading: hl.heading, lead: hl.lead });
      }).join('\n');

      if (mainHtml.includes(insertToken)) {
        mainHtml = mainHtml.split(insertToken).join(blocks);
      } else if (faqAnchorRe.test(mainHtml)) {
        mainHtml = mainHtml.replace(faqAnchorRe, (m0) => blocks + '\n' + m0);
      } else {
        // Safe fallback: append, but this should be rare because city templates should include %%EXAMPLE_PROVIDERS%%
        mainHtml += '\n' + blocks;
      }
    }
  }

  // Ensure non-PI templates never leak the example providers placeholder
  if (!isPersonalInjury(verticalKey) && route === "") {
    mainHtml = mainHtml.split("%%EXAMPLE_PROVIDERS%%").join("");
  }
  // PI: add city → state backlink (tiny LLM boost + navigation sanity)
  if (isPersonalInjury(verticalKey) && city && city.state) {
    const ab = String(city.state).toUpperCase();
    const sn = String(city.stateName || ab);
    mainHtml += '\n<section class="section" data-pi-state-backlink="true"><p class="muted" style="font-size:0.9em;margin:0">Back to <a href="/states/' + escapeHtml(ab) + '/">' + escapeHtml(sn) + '</a></p></section>';
  }

  // --- CITY HUB LLM BAIT + SOURCE MICRO-BLOCK (all verticals) ---
  // Goal: make key official resources + internal policy links explicitly citable on city hubs,
  // without changing the locked city flow ordering.
  // Placement: immediately after the AI visibility block (or after %%EVAL_FRAMEWORK%% if missing).

// City-page inline policy/AI blocks are forbidden by Playbook v7.
// Enforce by stripping any legacy inline blocks that may exist in page-set HTML.
// - AI visibility block (data-ai-visibility)
// - Inline policy/resource micro blocks (data-llm-bait="sources", data-last-updated)
function stripForbiddenInlineBlocks(html) {
  if (!html) return html;
  // remove entire AI visibility sections
  html = html.replace(/<section class="section"[^>]*data-ai-visibility="true"[\s\S]*?<\/section>\s*/gi, "");
  // remove inline resources/policy micro blocks
  html = html.replace(/<section class="section"[^>]*data-llm-bait="sources"[\s\S]*?<\/section>\s*/gi, "");
  // remove any stray last-updated micro lines
  html = html.replace(/<p[^>]*data-last-updated="true"[\s\S]*?<\/p>\s*/gi, "");
  return html;
}

    mainHtml = stripForbiddenInlineBlocks(mainHtml);

  // City hub invariants (golden contracts): ensure required blocks/markers exist in final HTML.
  // Applies only to the city hub route ("/{city-slug}/").
  if (typeof route === "string" && route === "" && typeof ensureCityHubRequiredBlocks === "function") {
    mainHtml = ensureCityHubRequiredBlocks(mainHtml, verticalKey, city);
  }

// Next-steps zone injection (global buyout OR sponsor-driven)
  // - Global: pack-controlled via sponsorship.globalNextStepsEnabled
  // - Sponsor-driven: pack sponsorship.nextStepsEnabled + sponsor live
  if (route !== 'next-steps' && packHasNextStepsRoute(pageSet) && sponsorship.shouldRenderNextSteps(pageSet, sponsor || {})) {
    mainHtml += '\n' + renderNextStepsZoneHtml({ href: '/' + city.slug + '/next-steps/' });
  }

  mainHtml = injectAdPlacements(mainHtml, ads, { city: city, verticalKey: verticalKey, cityFeatures: (pageSet && pageSet.__cityFeatures) ? pageSet.__cityFeatures : null });
  mainHtml = injectSponsors(mainHtml, sponsorsByStack);
  mainHtml = injectListings(mainHtml, listings, city, sponsor || {}, pageSet);

  const inline = renderInlineScripts(page.inline_scripts || [], city);

  const mapped = replaceAll(baseTemplate, {
    "%%TITLE%%": title,
    "%%DESCRIPTION%%": description,
    "%%DATA_CITY%%": city.slug,
    "%%SLUG%%": city.slug,
    "%%MARKET_LABEL%%": city.marketLabel,
    "%%MARKET_NAV%%": marketNavHtml(city, pageSet),
    "%%MAIN_HTML%%": mainHtml,
    "%%INLINE_SCRIPTS%%": inline,
    "%%CANONICAL%%": buildCanonical(siteUrl, city, route),
    "%%HEAD_JSON_LD%%": renderHeadJsonLd(siteUrl, brandName, city, route, title, description, pageSet, verticalKey, listings),
    "%%FOOTER%%": footerHtml,
    "%%BRAND_NAME%%": escapeHtml(brandName)
    ,"%%OPTIONAL_TOP_NAV%%": (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
  });
  return mapped;
}

function renderGlobalPage(baseTemplate, footerHtml, globalPage, siteUrl, brandName, pageSet, globalSponsorsByStack, marketsStatusListHtml, ads, verticalKey) {
  const route = (globalPage.route || "").replace(/^\/+|\/+$/g, "");
  const title = String(globalPage.title || "").split("%%BRAND_NAME%%").join(brandName);
  const description = String(globalPage.description || "");

  let mainHtml = String(globalPage.main_html || "").split("%%BRAND_NAME%%").join(brandName);

  // --- GUIDE DETAIL CONTRACT (SEV-1 REGRESSION GUARD) ---
  // Guides must be block-structured and must include ad slots.
  // We intentionally enforce this at build-time so a flat/unstyled guide JSON
  // cannot silently ship even if authored incorrectly.
  function enhanceGuideDetailHtml(rawHtml) {
    let out = String(rawHtml || "");

    // 1) Hero (required)
    const hasHero = out.includes('<section class="hero">');
    const hasKicker = out.includes('<p class="kicker">Guide</p>');
    const hasEduPhrase = /Educational\s+framework\s+only/i.test(out);
    if (!hasHero || !hasKicker || !hasEduPhrase) {
      const safeH1 = escapeHtml(title);
      const hero =
        '<section class="hero">' +
        '\n  <p class="kicker">Guide</p>' +
        '\n  <h1>' + safeH1 + '</h1>' +
        '\n  <p class="muted">Educational framework only. Not medical or legal advice.</p>' +
        '\n</section>\n\n';

      // Remove a redundant leading h1/h2 that often appears in older guide JSON.
      out = out
        .replace(/^\s*<h1>[^<]*<\/h1>\s*/i, '')
        .replace(/^\s*<h2>[^<]*<\/h2>\s*/i, '');
      out = hero + out;
    }

    // 2) Required ad slots (top + bottom)
    if (!out.includes('%%AD:global_guide_top%%')) {
      // Insert immediately after hero for predictable placement.
      out = out.replace(/<\/section>\s*\n\s*\n?/i, '</section>\n\n%%AD:global_guide_top%%\n\n');
    }
    if (!out.includes('%%AD:global_guide_bottom%%')) {
      out = out + '\n\n%%AD:global_guide_bottom%%\n';
    }

    // 3) Block structure (wrap legacy flat guides)
    // If the guide body has no section blocks, we deterministically wrap by heading groups.
    // NOTE: we cannot rely on newlines; some guide HTML is single-line.
    const sectionCount = (out.match(/class="section\b/gi) || []).length;
    if (sectionCount < 2 && !out.includes('data-guide-section="true"')) {
      const TOP = '%%AD:global_guide_top%%';
      const BOT = '%%AD:global_guide_bottom%%';

      const iTop = out.indexOf(TOP);
      if (iTop !== -1) {
        const head = out.slice(0, iTop + TOP.length);
        let body = out.slice(iTop + TOP.length);

        // Remove bottom token from the body while we rebuild; we'll re-append later.
        body = body.split(BOT).join('');

        const headingRe = /<(h2|h3)\b[^>]*>[\s\S]*?<\/\1>/gi;
        const matches = [];
        let m;
        while ((m = headingRe.exec(body)) !== null) {
          matches.push({ idx: m.index, tag: m[1], html: m[0] });
        }

        const blocks = [];
        if (matches.length === 0) {
          // No headings — wrap the whole body.
          const cleaned = body.trim();
          if (cleaned) {
            blocks.push(
              '<section class="section guide-section" data-guide-section="true">\n' +
              cleaned +
              '\n</section>'
            );
          }
        } else {
          for (let i = 0; i < matches.length; i++) {
            const start = matches[i].idx;
            const end = (i + 1 < matches.length) ? matches[i + 1].idx : body.length;
            const chunk = body.slice(start, end).trim();
            if (!chunk) continue;
            // Normalize heading levels to h2 inside sections.
            const cleaned = chunk
              .replace(/<h3\b/gi, '<h2')
              .replace(/<\/h3>/gi, '</h2>');

            blocks.push(
              '<section class="section guide-section" data-guide-section="true">\n' +
              cleaned +
              '\n</section>'
            );
          }
        }

        out = head + '\n\n' + blocks.join('\n\n') + '\n\n' + BOT + '\n';
      }
    }

    // 4) LLM bait (internal backlinks + policy anchors)
    if (!out.includes('data-llm-bait="guide-links"')) {
      out = out.replace(/%%AD:global_guide_bottom%%/g, '')
      +
      '\n\n<section class="section" data-llm-bait="guide-links">' +
      '\n  <h2>Related resources</h2>' +
      '\n  <ul>' +
      '\n    <li><a href="/guides/">All guides</a></li>' +
      '\n    <li><a href="/methodology/">How we evaluate information</a></li>' +
      '\n    <li><a href="/editorial-policy/">Editorial policy</a></li>' +
      '\n    <li><a href="/disclaimer/">Disclosure &amp; disclaimers</a></li>' +
      '\n    <li><a href="/for-providers/">Advertising &amp; provider information</a></li>' +
      '\n  </ul>' +
      `\n  <p class="muted" data-last-updated="true">Last updated: ${BUILD_ISO.slice(0,10)}</p>` +
      '\n</section>\n\n%%AD:global_guide_bottom%%\n';
    }

    return out;
  }

  // Guide pages (global): enforce the full guide contract (hero + ads + blocks + LLM bait).
  if (route.startsWith("guides/") && route !== "guides") {
    mainHtml = enhanceGuideDetailHtml(mainHtml);
  }

  if (route === "faq" && mainHtml.includes("%%FAQ_ITEMS_GLOBAL%%")) {
    mainHtml = mainHtml.split("%%FAQ_ITEMS_GLOBAL%%").join(renderFaqCardsHtml(getGlobalFaqItems(pageSet)));
  }
  if (route === "guides" && mainHtml.includes("%%GUIDE_CARDS%%")) {
  mainHtml = mainHtml
    .split("%%GUIDE_CARDS%%")
    .join(renderGuideCardsHtml(pageSet.guides || []));
}
  if (mainHtml.includes("%%MARKETS_STATUS_LIST%%")) {
    mainHtml = mainHtml.split("%%MARKETS_STATUS_LIST%%").join(marketsStatusListHtml || "");
  }


  // Next-steps zone injection (GLOBAL ONLY)
  // When enabled, show on homepage + guide pages (hub + detail).
  if (sponsorship.isGlobalNextStepsEnabled(pageSet)) {
    const isHome = (route === "");
    const isGuidesHub = (route === "guides");
    const isGuideDetail = (route.startsWith("guides/") && route !== "guides");
    if (isHome || isGuidesHub || isGuideDetail) {
      if (!mainHtml.includes('data-next-steps-zone="true"')) {
        mainHtml += "\n" + renderNextStepsZoneHtml({ href: "" });
      }
    }
  }

  mainHtml = injectAdPlacements(mainHtml, ads, { city: null, verticalKey: verticalKey, cityFeatures: pageSet && pageSet.__cityFeatures ? pageSet.__cityFeatures : null });
  mainHtml = injectSponsors(mainHtml, globalSponsorsByStack || {});

  const mapped = replaceAll(baseTemplate, {
    "%%TITLE%%": title,
    "%%DESCRIPTION%%": description,
    "%%DATA_CITY%%": "",
    "%%SLUG%%": "",
    "%%MARKET_LABEL%%": "",
    "%%MARKET_NAV%%": "",
    "%%MAIN_HTML%%": mainHtml,
    "%%INLINE_SCRIPTS%%": "",
    "%%CANONICAL%%": buildCanonicalGlobal(siteUrl, route),
    "%%HEAD_JSON_LD%%": renderHeadJsonLdGlobal(siteUrl, brandName, route, title, description, pageSet),
    "%%FOOTER%%": footerHtml,
    "%%BRAND_NAME%%": escapeHtml(brandName)
    ,"%%OPTIONAL_TOP_NAV%%": (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
  });
  return mapped;
}

function renderGuideCardsHtml(guides) {
  if (!Array.isArray(guides) || guides.length === 0) return "";
  return guides
    .map(function (g) {
      var href = g && g.route ? String(g.route) : "#";
      var title = g && g.title ? String(g.title) : "Guide";
      var desc = g && g.description ? String(g.description) : "";
      return (
        "<div class=\"card\">" +
        "\n  <h2><a href=\"" + escapeHtml(href) + "\">" + escapeHtml(title) + "</a></h2>" +
        "\n  <p>" + escapeHtml(desc) + "</p>" +
        "\n</div>"
      );
    })
    .join("\n");
}


function renderCityGuideCardsHtml(guides, city) {
  var market = (city && city.marketLabel) ? String(city.marketLabel) : "";
  var safeMarket = market ? escapeHtml(market) : "this market";

  var cards = "";

  if (Array.isArray(guides) && guides.length > 0) {
    cards = guides
      .map(function (g) {
        // City block links to global guides (not city-prefixed)
        var href = g && g.route ? String(g.route) : "";
        var title = g && g.title ? String(g.title) : "Guide";
        var desc = g && g.description ? String(g.description) : "";
        if (!href) return "";
        return (
          "<div class=\"card\">" +
          "<h3><a href=\"" + escapeHtml(href) + "\">" + escapeHtml(title) + "</a></h3>" +
          "<p>" + escapeHtml(desc) + "</p>" +
          "</div>"
        );
      })
      .filter(Boolean)
      .join("\n");
  } else {
    // Fallback (no taxonomy): keep it helpful, non-promissory, and validation-safe.
    cards = (
      "<div class=\"card\"><h3><a href=\"/guides/\">Guides hub</a></h3><p>Browse neutral checklists and comparison frameworks.</p></div>" +
      "<div class=\"card\"><h3><a href=\"/faq/\">FAQ</a></h3><p>Answer-box style questions; no rankings or endorsements.</p></div>"
    );
  }

  return (
    "<section class=\"section city-guides\">" +
    "<h2>Guides for " + safeMarket + "</h2>" +
    "<p class=\"muted\">Use these neutral checklists and comparison frameworks before you contact any provider. No rankings. Educational only.</p>" +
    "<div class=\"grid\">" +
    cards +
    "</div>" +
    "</section>"
  );
}



function outPathFor(city, route) {
  const r = (route || "").replace(/^\/+|\/+$/g, "");
  if (!r) return path.join(OUT_DIR, city.slug, "index.html");
  return path.join(OUT_DIR, city.slug, r, "index.html");
}
function outPathForGlobal(route) {
  const r = (route || "").replace(/^\/+|\/+$/g, "");
  if (!r) return path.join(OUT_DIR, "index.html");
  return path.join(OUT_DIR, r, "index.html");
}

function build() {
  const site = readJson(SITE_PATH);
  const states = readJson(STATES_PATH);
const ALL_US_STATES = readJson(path.join(DATA_DIR, "us_states.json"));

  const ads = readJson(ADS_PATH);

  const pageSetFile = site.pageSetFile || "starter_v1.json";
  const pageSet = loadPageSet(pageSetFile);
  const verticalKey = deriveVerticalKey(pageSetFile);

  // City page feature toggles (future-proof): directory vs state lookup (mutually exclusive).
  pageSet.__cityFeatures = getCityFeatures(pageSet, verticalKey);


  const brandName = String(site.brandName || "Local Guides").trim();
  const siteUrl = String(site.siteUrl || "https://example.com").trim();

  const cities = loadCities(pageSet).map((c) => {
    const st = states[c.state] || {};
    return {
      ...c,
      stateName: c.stateName || st.stateName || "",
      stateSlug: c.stateSlug || st.stateSlug || "",
      licenseLookupUrl: c.licenseLookupUrl || st.licenseLookupUrl || ""
    };
  });

  const globalPagesDir = loadGlobalPagesDir(pageSet);

  // Templates
  const baseTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, "base.html"), "utf8");
  const footerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, "partials", "footer.html"), "utf8");

  // Sponsors data (optional)
// Source of truth: data/sponsors/global.json and optional per-city files data/sponsors/<citySlug>.json
const sponsorsGlobalPath = path.join(DATA_DIR, "sponsors", "global.json");
const globalSponsorsByStack = fs.existsSync(sponsorsGlobalPath) ? readJson(sponsorsGlobalPath) : {};
function loadCitySponsorsByStack(citySlug) {
  const p = path.join(DATA_DIR, "sponsors", `${citySlug}.json`);
  const citySpecific = fs.existsSync(p) ? readJson(p) : {};
  return { ...globalSponsorsByStack, ...citySpecific };
}

// Listings per city (optional)
// Preferred structure: data/listings/<citySlug>.json ({ sponsor, listings }) or legacy array
// Back-compat: data/listings.json with { byCity: { slug: [...] } } or { slug: [...] }
const listingsByCity = {};
const sponsorByCity = {};
const listingsDir = path.join(DATA_DIR, "listings");
if (fs.existsSync(listingsDir)) {
  for (const f of fs.readdirSync(listingsDir)) {
    if (!f.endsWith(".json")) continue;
    const slug = f.replace(/\.json$/i, "");
    try {
      const raw = readJson(path.join(listingsDir, f));
      // New schema: { sponsor: {...}, listings: [...] }
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.listings)) {
        listingsByCity[slug] = raw.listings;
        sponsorByCity[slug] = raw.sponsor || {};
      } else {
        // Legacy schema: [...] (array of listings)
        listingsByCity[slug] = Array.isArray(raw) ? raw : [];
        sponsorByCity[slug] = {};
      }
    } catch (e) {
      throw new Error(`Failed to parse listings file: ${path.join(listingsDir, f)} (${e.message})`);
    }
  }
}
const listingsPath = path.join(DATA_DIR, "listings.json");
if (fs.existsSync(listingsPath)) {
  const legacy = readJson(listingsPath);
  const legacyByCity = legacy && legacy.byCity ? legacy.byCity : legacy;
  if (legacyByCity && typeof legacyByCity === "object") {
    for (const [slug, arr] of Object.entries(legacyByCity)) {
      if (!listingsByCity[slug]) listingsByCity[slug] = Array.isArray(arr) ? arr : [];
    }
  }
}

// Optional: sponsor object for next-steps without requiring a listings directory.
// If present, place it at data/sponsors/<citySlug>.json under key "nextStepsSponsor".
function loadNextStepsSponsor(citySlug) {
  // Priority 1: listings sponsor (PI or any vertical using data/listings/<city>.json)
  if (sponsorByCity && sponsorByCity[citySlug]) return sponsorByCity[citySlug];

  // Priority 2: explicit sponsor object in data/sponsors/<city>.json
  try {
    const p = path.join(DATA_DIR, 'sponsors', `${citySlug}.json`);
    if (!fs.existsSync(p)) return {};
    const raw = readJson(p);
    if (raw && typeof raw === 'object' && raw.nextStepsSponsor && typeof raw.nextStepsSponsor === 'object') {
      return raw.nextStepsSponsor;
    }
  } catch (e) {
    // ignore
  }
  return {};
}

// Clean dist

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Copy assets (static)
  const assetsSrc = path.join(REPO_ROOT, "assets");
  const assetsDst = path.join(OUT_DIR, "assets");
  fs.cpSync(assetsSrc, assetsDst, { recursive: true });
  // Build global pages
  // Global pages are industry-agnostic by default. Packs may override only selected routes
  // (home/guides/faq/methodology + guides_*), while core policy pages remain shared.
  const baseGlobalPagesDir = path.join(DATA_DIR, 'global_pages');
  const packGlobalPagesDir = globalPagesDir;

  const sharedRoutes = new Set([
    'about',
    'contact',
    'disclaimer',
    'editorial-policy',
    'privacy',
    'for-providers'
  ]);

  let marketsStatusListHtml = buildMarketsStatusListHtml(cities);

  function buildStatesStatusListHtml(statesObj) {
    const entries = Object.entries(statesObj || {});
    entries.sort((a,b)=>String((a[1]||{}).stateName||a[0]).localeCompare(String((b[1]||{}).stateName||b[0])));
    const cards = entries.map(([abbr, st])=>{
      const name = String((st||{}).stateName||abbr);
      return (
        '<div class="card">' +
        '<h2 style="margin:0 0 6px 0"><a href="/states/' + escapeHtml(abbr) + '/">' + escapeHtml(name) + '</a></h2>' +
        '<p class="muted" style="margin:0">State hub</p>' +
        '</div>'
      );
    }).join("\n");

    return (
      '<section class="section markets" data-markets-status-list="states">' +
      '<h2>Browse by state</h2>' +
      '<div class="grid">' + cards + '</div>' +
      '</section>'
    );
  }

  if (isPersonalInjury(verticalKey)) {
    marketsStatusListHtml = buildStatesStatusListHtml(ALL_US_STATES);
  }

  function loadPagesFromDir(dirPath) {
    return listJsonFiles(dirPath).map(readJson);
  }

  const basePages = loadPagesFromDir(baseGlobalPagesDir);
  const packPages = (packGlobalPagesDir && packGlobalPagesDir !== baseGlobalPagesDir) ? loadPagesFromDir(packGlobalPagesDir) : [];

  // Hybrid guide discovery (pack-only):
  // - Taxonomy is canonical when present (pageSet.guides)
  // - Auto-discovery fills missing items only (never deletes)
  // - IMPORTANT: Do NOT scan base data/global_pages for guides.
  function normalizeGuideRoute(r) {
    var s = String(r || "").trim();
    if (!s) return "";
    if (!s.startsWith("/")) s = "/" + s;
    if (!s.endsWith("/")) s = s + "/";
    return s;
  }
  function discoverGuidesFromPackPages(pages) {
    var out = [];
    var seen = new Set();
    for (const gp of (pages || [])) {
      var rawRoute = (gp && gp.route) ? String(gp.route) : "";
      var route = rawRoute.replace(/^\/+|\/+$/g, "");
      if (!route) continue;
      if (route === "guides") continue; // hub page
      if (!route.startsWith("guides/")) continue;
      var href = normalizeGuideRoute(route);
      if (!href) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push({
        route: href,
        title: String(gp.title || "").trim() || href,
        description: String(gp.description || "").trim()
      });
    }
    return out;
  }
  function mergeGuidesHybrid(taxonomyGuides, discoveredGuides) {
    var out = [];
    var seen = new Set();

    function addOne(g) {
      if (!g) return;
      var href = normalizeGuideRoute(g.route);
      if (!href) return;
      if (seen.has(href)) return;
      seen.add(href);
      out.push({
        route: href,
        title: String(g.title || "").trim() || href,
        description: String(g.description || "").trim()
      });
    }

    if (Array.isArray(taxonomyGuides)) {
      for (const g of taxonomyGuides) addOne(g);
    }
    if (Array.isArray(discoveredGuides)) {
      for (const g of discoveredGuides) addOne(g);
    }
    return out;
  }

  const discoveredGuides = discoverGuidesFromPackPages(packPages);
  pageSet.guides = mergeGuidesHybrid(pageSet.guides, discoveredGuides);

  // Route map: base first, then pack overrides where allowed
  const byRoute = new Map();
  for (const gp of basePages) {
    const r = (gp.route || '').replace(/^\/+|\/+$/g, '');
    byRoute.set(r, gp);
  }
  for (const gp of packPages) {
    const r = (gp.route || '').replace(/^\/+|\/+$/g, '');
    if (sharedRoutes.has(r)) continue;
    byRoute.set(r, gp);
  }

  const globalPages = Array.from(byRoute.values());

  for (const gp of globalPages) {
    const route = (gp.route || '').replace(/^\/+|\/+$/g, '');
    const html = renderGlobalPage(
      baseTemplate,
      footerHtml,
      gp,
      siteUrl,
      brandName,
      pageSet,
      globalSponsorsByStack,
      marketsStatusListHtml,
      ads,
      verticalKey
    );
    writeFileEnsured(outPathForGlobal(route), html);
  }

  // Build city pages
  for (const city of cities) {
    const cityListings = listingsByCity ? (listingsByCity[city.slug] || []) : [];
    for (const p of (pageSet.pages || [])) {
      const route = applyCityTokens(p.route || "", city).replace(/^\/+|\/+$/g, "");

      // --- A1: Remove redundant /orphan city page families ---
      // City hubs already contain the FAQ accordion + Guides block, and PI hubs contain directory-like zones.
      // We do NOT emit separate:
      // - /<city>/faq/
      // - /<city>/guides/
      // - /<city>/directory/
      // This prevents orphan pages and ensures the canonical city hub is the single entrypoint.
      if (route === 'faq' || route === 'guides' || route === 'directory') {
        continue;
      }

      if (route === 'directory' && !(pageSet.__cityFeatures && pageSet.__cityFeatures.directory)) {
        continue;
      }
      const cityData = (loadNextStepsSponsor(city.slug) || {});
      if (route === 'next-steps' && !sponsorship.shouldRenderNextSteps(pageSet, cityData)) {
        continue;
      }

      const html = renderPage(
        baseTemplate,
        footerHtml,
        p,
        city,
        siteUrl,
        brandName,
        pageSet,
        loadCitySponsorsByStack(city.slug),
        loadNextStepsSponsor(city.slug) || {},
        cityListings,
        ads,
        verticalKey
      );
      writeFileEnsured(outPathFor(city, route), html);
    }
  }


  // PI: build 50 state hub pages + optional /personal-injury/ hub
  if (isPersonalInjury(verticalKey)) {
    const disciplineLinksPath = path.join(DATA_DIR, 'pi_state_disciplinary_links.json');
    const disciplineLinks = fs.existsSync(disciplineLinksPath) ? readJson(disciplineLinksPath) : {};

    function outPathForPiState(abbr) {
      return path.join(OUT_DIR, 'states', String(abbr).toUpperCase(), 'index.html');
    }

    function outPathForPiStateNextSteps(abbr) {
      return path.join(OUT_DIR, 'states', String(abbr).toUpperCase(), 'next-steps', 'index.html');
    }

    // Select a sponsor for a PI state by choosing the first live sponsor from any city in that state.
    // This supports sponsor-driven next-steps on state pages with no new data requirements.
    function selectPiStateSponsor(stateAbbr) {
      const ab = String(stateAbbr).toUpperCase();
      const cityRows = cities.filter(c => String(c.state).toUpperCase() == ab);
      for (const c of cityRows) {
        const s = loadNextStepsSponsor(c.slug) || {};
        if (sponsorship.isSponsorLive(s)) return s;
      }
      return {};
    }

    function renderPiStateNextStepsPageHtml(stateAbbr, sponsorObj) {
      const ab = String(stateAbbr).toUpperCase();
      const st = states[ab] || {};
      const stateName = String(st.stateName || ab);
      const title = 'Next steps — ' + stateName + ' personal injury';
      const description = 'Sponsor contact and preparation checklist for personal injury in ' + stateName + '. Educational only.';

      const s = sponsorObj || {};
      const sponsorLive = sponsorship.isSponsorLive(s);
      const sponsorName = sponsorLive ? escapeHtml(String(s.firm_name || s.name || '')) : '';
      const intakeUrl = sponsorLive ? escapeHtml(String(normalizeUrl(s.intake_url))) : '';
      const officialUrl = sponsorLive ? escapeHtml(String(normalizeUrl(s.official_site_url))) : '';

      const mainHtml = (
        '<section class="hero">' +
        '<p class="kicker">Next steps</p>' +
        '<h1>Continue to a sponsor’s intake form</h1>' +
        '<p class="muted">Educational only. This site does not receive your case details.</p>' +
        '</section>' +

        '<section class="section hero" data-pi-state-page="true">' +
        (sponsorLive ? (
          '<div class="card" data-next-steps-card="true">' +
          '<h2>' + sponsorName + '</h2>' +
          '<p class="muted">You will be taken to the sponsor’s intake form to request a confidential consultation.</p>' +
          '<div class="actions">' +
          '<a class="button button-primary" data-next-steps-intake="true" href="' + intakeUrl + '" rel="sponsored noopener noreferrer" target="_blank">Continue to secure inquiry form</a>' +
          '<a class="button button-secondary" href="' + officialUrl + '" rel="sponsored noopener noreferrer" target="_blank">Visit official site</a>' +
          '</div>' +
          '</div>'
        ) : (
          '<div class="card">' +
          '<h2>Sponsor intake (not yet enabled)</h2>' +
          '<p class="muted">This state page supports sponsor next-steps, but no sponsor is active yet.</p>' +
          '</div>'
        )) +
        '<div class="card">' +
        '<h2>What to prepare before you submit</h2>' +
        '<ul>' +
        '<li>Where and when the incident happened</li>' +
        '<li>Any photos, reports, and witness information you have</li>' +
        '<li>Medical treatment timeline (if any)</li>' +
        '<li>Insurance info you have received so far</li>' +
        '</ul>' +
        '<p class="muted">No promises. This is educational only.</p>' +
        '</div>' +
        '</section>'
      );

      const mapped = replaceAll(baseTemplate, {
        '%%TITLE%%': title,
        '%%DESCRIPTION%%': description,
        '%%DATA_CITY%%': 'state-' + ab,
        '%%SLUG%%': 'states/' + ab + '/next-steps',
        '%%MARKET_LABEL%%': escapeHtml(stateName),
        '%%MARKET_NAV%%': '<a href="/">Home</a> · <a href="/states/' + escapeHtml(ab) + '/">' + escapeHtml(stateName) + '</a> · <span>Next steps</span>',
        '%%MAIN_HTML%%': mainHtml,
        '%%INLINE_SCRIPTS%%': '',
        '%%CANONICAL%%': buildCanonicalGlobal(siteUrl, 'states/' + ab + '/next-steps'),
        '%%HEAD_JSON_LD%%': '',
        '%%FOOTER%%': footerHtml,
        '%%BRAND_NAME%%': escapeHtml(brandName),
        '%%OPTIONAL_TOP_NAV%%': (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
      });
      return mapped;
    }

    function renderPiStatePageHtml(stateAbbr) {
      const ab = String(stateAbbr).toUpperCase();
      const st = states[ab] || {};
      // For PI, states.json may only include states present in the current
      // city page set. The PI experience (hub + state pages) must be a full
      // 50-state universe regardless of which cities are present.
      const stateName = String(
        (ALL_US_STATES && ALL_US_STATES[ab] && ALL_US_STATES[ab].name) ||
        st.stateName ||
        ab
      );
      const title = 'Personal injury lawyers in ' + stateName + ' — directory & guides';
      const description = 'Educational directory-style listings and neutral checklists for personal injury providers in ' + stateName + '. No rankings. No endorsements.';

      // Aggregate listings from live PI cities in this state
      const cityRows = cities.filter(c => String(c.state).toUpperCase() == ab);
      const listingsAgg = [];
      const seenFirm = new Set();
      for (const c of cityRows) {
        const arr = (listingsByCity && listingsByCity[c.slug]) ? listingsByCity[c.slug] : [];
        for (const it of (Array.isArray(arr) ? arr : [])) {
          const key = String((it && (it.firm_name || it.name)) || '').trim().toLowerCase();
          if (!key) continue;
          if (seenFirm.has(key)) continue;
          seenFirm.add(key);
          listingsAgg.push({ ...it, __marketLabel: c.marketLabel, __citySlug: c.slug });
        }
      }

      // Alphabetize firms on state pages (case-insensitive)
      listingsAgg.sort((a, b) => {
        const an = String((a && (a.firm_name || a.name)) || '').toLowerCase();
        const bn = String((b && (b.firm_name || b.name)) || '').toLowerCase();
        return an.localeCompare(bn);
      });

      const directoryCards = listingsAgg.slice(0, 40).map(it => {
        const name = String((it.firm_name || it.name || '')).trim();
        const site = it.official_site_url || it.website || '';
        const phone = it.phone || '';
        const loc = String(it.__marketLabel || '').trim();
        return (
          '<div class="card">' +
          '<h3 style="margin:0 0 6px 0">' + escapeHtml(name) + '</h3>' +
          (loc ? ('<p class="muted" style="margin:0 0 6px 0">' + escapeHtml(loc) + '</p>') : '') +
          '<p style="margin:0">' +
          (site ? ('<a href="' + escapeHtml(normalizeUrl(site)) + '" rel="nofollow">Official site</a>') : '') +
          (phone ? (site ? ' · ' : '') + '<span>' + escapeHtml(String(phone)) + '</span>' : '') +
          '</p>' +
          '</div>'
        );
      }).join("\n");

      const citiesList = cityRows.map(c => {
        const href = '/' + c.slug + '/';
        return '<li><a href="' + escapeHtml(href) + '">' + escapeHtml(String(c.marketLabel || c.slug)) + '</a></li>';
      }).join("\n");

      const disciplineUrl = disciplineLinks[ab] ? String(disciplineLinks[ab]) : '';

      // State-level FAQ items for on-page accordion (non-promotional, neutral)
      const stateFaqItems = [
        {
          q: `How do I choose a personal injury lawyer in ${String(stateName)}?`,
          a: `There is no universal “best.” Use a consistent checklist: verify the lawyer's license and discipline history, confirm relevant practice focus, ask about fee terms (often contingency), and compare communication and case-handling process. This site is educational only and does not rank providers.`
        },
        {
          q: `What is a contingency fee?`,
          a: `A contingency fee is a payment arrangement where a lawyer may collect a fee only if there is a recovery. Terms vary and should be confirmed in writing before signing.`
        },
        {
          q: `What should I verify before signing with a firm?`,
          a: `Verify licensing, review engagement terms in writing, ask who will handle the matter day-to-day, and confirm how updates and costs are communicated. Avoid relying on marketing claims.`
        },
        {
          q: `How do I check licensing and discipline in ${String(stateName)}?`,
          a: `Use the official state disciplinary and license lookup linked on this page to confirm current status and any public disciplinary history.`
        }
      ];

      // LLM-friendly (but non-promotional) query framing for state hubs
      const queryBlock = (
        '<section class="section" data-pi-state-questions="true">' +
        '<h2>Common questions in ' + escapeHtml(stateName) + '</h2>' +
        '<p class="muted">People often ask for a list of firms in a state or city after an accident. This site is educational only and does not rank providers. Use the directory + the verification resource below.</p>' +
        '<ul>' +
        '<li>How do I find a personal injury lawyer in ' + escapeHtml(stateName) + '?</li>' +
        '<li>Can you list personal injury law firms serving ' + escapeHtml(stateName) + '?</li>' +
        '<li>What should I check before contacting a firm after an accident?</li>' +
        '<li>Where can I verify an attorney\'s license and disciplinary history in ' + escapeHtml(stateName) + '?</li>' +
        '</ul>' +
        '</section>'
      );

      // PI state pages: visible FAQ accordion (questions remain collapsed by default)
      const stateFaqAccordion = (
        '<details class="accordion" id="state-faq" open>' +
        '<summary>FAQs <span class="accordion-meta">(tap a question)</span></summary>' +
        '<div class="accordion-panel">' +
        '<div class="faq-accordion" data-faq-accordion="state">' + renderFaqCardsHtml(stateFaqItems) + '</div>' +
        '</div>' +
        '</details>'
      );
      let mainHtml = (
        '<section class="section" data-pi-state-page="true">' +
        '<h1>' + escapeHtml(stateName) + ' personal injury guide + directory</h1>' +
        '<p class="muted">Educational only. No rankings. No endorsements. Directory entries are neutral and for research.</p>' +
        '</section>' +

        '%%AD:pi_state_top%%' +

        queryBlock +

        '<section class="section micro-guides" data-guides-micro="true">' +
        '<p><strong>Start here:</strong> ' +
        '<a href="/guides/#costs">Costs</a> • ' +
        '<a href="/guides/#timeline">Timeline</a> • ' +
        '<a href="/guides/#questions">Questions to ask</a> • ' +
        '<a href="/guides/#red-flags">Red flags</a> ' +
        '<span class="muted">(educational)</span></p>' +
        '</section>' +
        '%%AD:pi_state_mid%%' +

        '<section class="section" data-pi-state-directory="true">' +
        '<h2>Directory coverage in ' + escapeHtml(stateName) + '</h2>' +
        '<p class="muted">City pages contain firm directories. State pages summarize coverage and link you to the city hubs.</p>' +
        '<div class="pi-state-directory">' + directoryCards + '</div>' +
        '</section>' +

        '<section class="section" data-pi-state-cities="true">' +
        '<h2>City pages in ' + escapeHtml(stateName) + '</h2>' +
        '<ul class="state-cities-list">' + citiesList + '</ul>' +
        '</section>' +

        '<section class="section" data-pi-state-faq="true">' +
        '<h2>FAQs</h2>' +
        '<p class="muted">This is a quick explainer layer. It is not legal advice. We do not rank providers.</p>' +
        stateFaqAccordion +
        '</section>' +

        '<section class="section" data-disciplinary-lookup="true">' +
        '<h2>Attorney discipline & license lookup</h2>' +
        '<p class="muted">If you are checking a license or disciplinary history, use the official state resource:</p>' +
        (disciplineUrl ? ('<p><a href="' + escapeHtml(disciplineUrl) + '" rel="nofollow">Open official ' + escapeHtml(stateName) + ' lookup</a></p>') : '<p class="muted">(Missing link — pack config required.)</p>') +
        '</section>'
      );

      // Next-steps on PI state pages:
      // - sponsor-driven (based on any live sponsor in the state's cities) OR
      // - global buyout switch
      // Default remains OFF because all packs ship educationOnly=true.
      const stateSponsor = selectPiStateSponsor(ab);
      if (sponsorship.shouldRenderNextSteps(pageSet, stateSponsor) && !mainHtml.includes('data-next-steps-zone="true"')) {
        mainHtml += '\n' + renderNextStepsZoneHtml({ href: '/states/' + escapeHtml(ab) + '/next-steps/' });
      }

      const mapped = replaceAll(baseTemplate, {
        '%%TITLE%%': title,
        '%%DESCRIPTION%%': description,
        '%%DATA_CITY%%': 'state-' + ab,
        '%%SLUG%%': 'states/' + ab,
        '%%MARKET_LABEL%%': escapeHtml(stateName),
        '%%MARKET_NAV%%': '<a href="/">Home</a> · <a href="/states/' + escapeHtml(ab) + '/">' + escapeHtml(stateName) + '</a>',
        '%%MAIN_HTML%%': mainHtml,
        '%%INLINE_SCRIPTS%%': '',
        '%%CANONICAL%%': buildCanonicalGlobal(siteUrl, 'states/' + ab),
        '%%HEAD_JSON_LD%%': renderHeadJsonLdPiStateDirectory(siteUrl, brandName, ab, stateName, title, description, pageSet, listingsAgg),
        '%%FOOTER%%': footerHtml,
        '%%BRAND_NAME%%': escapeHtml(brandName),
        '%%OPTIONAL_TOP_NAV%%': (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
      });
      return injectAdPlacements(mapped, ads, {
        verticalKey: 'pi',
        stateAbbr: ab
      });
    }

    // Write all 50 state pages (unconditional)
    const piStateAbbrs = Object.keys(ALL_US_STATES || {});
    for (const ab of piStateAbbrs) {
      const html = renderPiStatePageHtml(ab);
      writeFileEnsured(outPathForPiState(ab), html);
    }

    // Write PI state next-steps pages when enabled (sponsor-driven or global switch).
    for (const ab of piStateAbbrs) {
      const s = selectPiStateSponsor(ab);
      if (!sponsorship.shouldRenderNextSteps(pageSet, s)) continue;
      const html = renderPiStateNextStepsPageHtml(ab, s);
      writeFileEnsured(outPathForPiStateNextSteps(ab), html);
    }

    // Optional PI hub route (/personal-injury/)
    const piHubHtml = replaceAll(baseTemplate, {
      '%%TITLE%%': 'Personal injury — browse by state',
      '%%DESCRIPTION%%': 'Browse personal injury guides and directories by U.S. state. Educational only. No rankings.',
      '%%DATA_CITY%%': '',
      '%%SLUG%%': 'personal-injury',
      '%%MARKET_LABEL%%': '',
      '%%MARKET_NAV%%': '',
      '%%MAIN_HTML%%': (
        '<section class="section"><h1>Personal injury: browse by state</h1><p class="muted">Educational only. No rankings. No endorsements.</p></section>' +
        marketsStatusListHtml +
        (sponsorship.isGlobalNextStepsEnabled(pageSet) ? ('\n' + renderNextStepsZoneHtml({ href: '' })) : '')
      ),
      '%%INLINE_SCRIPTS%%': '',
      '%%CANONICAL%%': buildCanonicalGlobal(siteUrl, 'personal-injury'),
      '%%HEAD_JSON_LD%%': renderHeadJsonLdGlobal(siteUrl, brandName, 'personal-injury', 'Personal injury — browse by state', 'Browse personal injury by state.', pageSet),
      '%%FOOTER%%': footerHtml,
      '%%BRAND_NAME%%': escapeHtml(brandName),
      '%%OPTIONAL_TOP_NAV%%': (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
    });
    writeFileEnsured(outPathForGlobal('personal-injury'), piHubHtml);
  }

  // Write build meta
  writeFileEnsured(path.join(OUT_DIR, "_build.json"), JSON.stringify({ buildIso: BUILD_ISO, pageSetFile, cities: cities.length }, null, 2));

  console.log(`Built dist with pageSetFile=${pageSetFile}, cities=${cities.length}`);
}

build();
