/**
 * Render the active pack into a static site under dist/.
 *
 * Purpose:
 * - Convert pack configuration, guide data, listings data, templates, ad placements,
 *   and query-routing data into static city, guide, and global pages.
 *
 * Inputs:
 * - Active pack state from data/site.json.
 * - Structured data under data/, template files under templates/, and helper modules under scripts/.
 *
 * Outputs:
 * - Static HTML and site artifacts in dist/.
 *
 * Side effects:
 * - Rewrites dist/.
 * - Emits content that downstream scripts use for sitemap, llms.txt, redirects, and validation.
 *
 * Use this when:
 * - Building a single active pack after prepare_site.js has resolved site state.
 */

const fs = require("fs");
const path = require("path");

const sponsorship = require("./helpers/sponsorship");
const buyouts = require("./helpers/buyouts");
const fanout = require("./helpers/fanout");
const { getPackSiteConfig } = require("./lib/pack_site_config");

const REPO_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUT_DIR = path.join(REPO_ROOT, "dist");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");

const SITE_PATH = path.join(DATA_DIR, "site.json");
const STATES_PATH = path.join(DATA_DIR, "states.json");
const BASE_CITIES_PATH = path.join(DATA_DIR, "cities.json");
const ADS_PATH = path.join(DATA_DIR, "ad_placements.json");

const BUILD_ISO = new Date().toISOString();

const COVERAGE_TARGETS_PATH = path.join(DATA_DIR, "research", "coverage", "coverage_targets.csv");
const SHARED_CITY_REGISTRY_PATH = path.join(DATA_DIR, "research", "shared", "us_city_registry.csv");
const COVERAGE_PROMOTED_PATH = path.join(DATA_DIR, "research", "coverage", "coverage_promoted.csv");
const COVERAGE_RUNTIME_SUPPORT_PATH = path.join(DATA_DIR, "research", "coverage", "coverage_runtime_support.csv");

function parseCsvRows(text) {
  const lines = String(text || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((v) => v.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = String(parts[idx] || '').trim();
    });
    return row;
  });
}

function loadCoveragePlanningMeta() {
  const meta = {
    phase2Planning: {
      coverageTargetsPresent: fs.existsSync(COVERAGE_TARGETS_PATH),
      sharedCityRegistryPresent: fs.existsSync(SHARED_CITY_REGISTRY_PATH),
      scopedVerticals: [],
      targetRows: 0,
      sharedRegistryRows: 0
    }
  };

  if (meta.phase2Planning.coverageTargetsPresent) {
    try {
      const rows = parseCsvRows(fs.readFileSync(COVERAGE_TARGETS_PATH, 'utf8'));
      const verticals = Array.from(new Set(rows.map((row) => row.vertical).filter(Boolean))).sort();
      meta.phase2Planning.scopedVerticals = verticals;
      meta.phase2Planning.targetRows = rows.length;
    } catch (err) {
      meta.phase2Planning.coverageTargetsError = err.message;
    }
  }

  if (meta.phase2Planning.sharedCityRegistryPresent) {
    try {
      const rows = parseCsvRows(fs.readFileSync(SHARED_CITY_REGISTRY_PATH, 'utf8'));
      meta.phase2Planning.sharedRegistryRows = rows.length;
    } catch (err) {
      meta.phase2Planning.sharedCityRegistryError = err.message;
    }
  }

  return meta;
}

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

function loadPageContracts() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'page_contracts.json'), 'utf8'));
  } catch (_) {
    return {};
  }
}

function shouldRenderDeterministicNextSteps(pageSet, opts) {
  if (!packHasNextStepsRoute(pageSet)) return false;
  const contracts = loadPageContracts();
  const conf = contracts && contracts.next_steps_required ? contracts.next_steps_required : {};
  const pageType = String((opts && opts.pageType) || '').trim();
  const route = String((opts && opts.route) || '/').trim();
  const routeNorm = route === '/' ? '/' : ('/' + route.replace(/^\/+|\/+$/g, '') + '/');
  const pageTypes = Array.isArray(conf.page_types) ? conf.page_types : [];
  const globalRoutes = new Set(Array.isArray(conf.global_routes) ? conf.global_routes : []);
  const keywords = Array.isArray(conf.guide_route_keywords) ? conf.guide_route_keywords : [];
  if (pageTypes.includes(pageType)) return true;
  if (globalRoutes.has(routeNorm)) return true;
  if (pageType === 'global' && /^\/guides\/.+\/$/.test(routeNorm)) {
    return keywords.some((kw) => routeNorm.includes(String(kw).toLowerCase()));
  }
  return false;
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
  // NORMALIZE_PAGE_SET_FILE: allow PAGE_SET_FILE to be either
  //  - examples/pi_v1.json (preferred)
  //  - data/page_sets/examples/pi_v1.json (legacy)
  if (typeof pageSetFile === 'string') {
    pageSetFile = pageSetFile.replace(/^\.\/?/, '');
    pageSetFile = pageSetFile.replace(/^data\/page_sets\//, '');
  }

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

// --- Authority-safe Connection Bubble (conversion layer) ---
// Provider type labels are contract-locked (must match request page enum exactly).
function providerTypeLabelForVertical(verticalKey) {
  const vk = String(verticalKey || '').toLowerCase();
  if (vk === 'pi') return 'Personal Injury Attorney';
  if (vk === 'dentistry') return 'Dentist (Cosmetic, Implant, or General Care)';
  if (vk === 'neuro') return 'Neuro Evaluation Provider';
  if (vk === 'trt') return 'Hormone / Wellness Clinic';
  if (vk === 'uscis_medical') return 'USCIS Medical Exam Provider';
  // Training/unknown packs: keep a generic label without implying a vertical.
  return 'provider';
}

function shouldRenderConnectionBubble(opts) {
  const pageKind = String(opts?.pageKind || '');
  const route = String(opts?.route || '').replace(/^\/+|\/+$/g, '');
  // Required surfaces:
  //  - Vertical home: /
  //  - Vertical guides hub: /guides/
  //  - Guide detail: /guides/<slug>/
  //  - City hub: /<city>/
  //  - State hub: /states/<ST>/
  if (pageKind === 'global') {
    return (route === '' || route === 'guides' || /^guides\/[^/]+$/.test(route));
  }
  if (pageKind === 'city') {
    return (route === '');
  }
  if (pageKind === 'state') {
    return /^states\/[A-Za-z]{2}$/.test(route);
  }
  return false;
}

function inferPageKindFromSrc(src) {
  const clean = String(src || '').trim();
  if (!clean || clean === '/') return 'global';
  if (clean === '/guides/') return 'global';
  if (clean === '/faq/') return 'global';
  if (clean === '/methodology/') return 'global';
  if (clean === '/request-assistance/') return 'request_assistance';
  if (clean.endsWith('/next-steps/')) return 'next_steps';
  if (/^\/guides\/[^/]+\/$/.test(clean)) return 'guide';
  if (/^\/states\/[A-Za-z]{2}\/$/.test(clean)) return 'state';
  if (/^\/[a-z0-9-]+\/$/.test(clean)) return 'city';
  return 'global';
}

function inferPageSlugFromSrc(src) {
  const clean = String(src || '').trim();
  if (!clean || clean === '/') return 'home';
  return clean.replace(/^\/+|\/+$/g, '') || 'home';
}

function inferMarketSlugFromSrc(src) {
  const clean = String(src || '').trim();
  const m = clean.match(/^\/([a-z0-9-]+)\//i);
  return m ? String(m[1]).toLowerCase() : '';
}

function buildTrackedHref(basePath, params) {
  const qs = [];
  Object.entries(params || {}).forEach(([k, v]) => {
    const val = String(v || '').trim();
    if (!val) return;
    qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(val));
  });
  return String(basePath || '') + (qs.length ? ('?' + qs.join('&')) : '');
}

function buildRequestAssistanceContext(verticalKey, ctx) {
  const label = providerTypeLabelForVertical(verticalKey);
  const labelLower = (label === 'provider') ? 'a provider' : label.toLowerCase();
  const src = String(ctx?.src || '').trim();
  const pt = (label === 'provider') ? '' : label;
  const pageKind = String(ctx?.pageKind || inferPageKindFromSrc(src));
  const pageSlug = String(ctx?.pageSlug || inferPageSlugFromSrc(src));
  const marketSlug = String(ctx?.marketSlug || inferMarketSlugFromSrc(src));
  const intentType = String(ctx?.intentType || 'direct_match');
  const buttonSource = String(ctx?.buttonSource || 'primary_cta');
  const href = buildTrackedHref('/request-assistance/', {
    pt,
    src,
    intent: intentType,
    button: buttonSource,
    vertical: verticalKey,
    page_kind: pageKind,
    page_slug: pageSlug,
    market: marketSlug
  });
  const nextStepsHref = buildTrackedHref(marketSlug ? ('/' + marketSlug + '/next-steps/') : '/next-steps/', {
    src,
    intent: 'decision_hub',
    button: 'next_steps_cta',
    vertical: verticalKey,
    page_kind: pageKind,
    page_slug: pageSlug,
    market: marketSlug
  });
  return { label, labelLower, src, pt, href, nextStepsHref, pageKind, pageSlug, marketSlug, intentType, buttonSource, verticalKey };
}

function conversionCopyForContext(pageType, verticalKey, ctx) {
  const info = buildRequestAssistanceContext(verticalKey, ctx);
  const marketLabel = String(ctx?.marketLabel || '').trim();
  const marketShort = marketLabel ? marketLabel.split(',')[0].trim() : 'your area';
  const lowerProvider = info.labelLower;

  if (pageType === 'city-primary') {
    return {
      eyebrow: 'Start here',
      heading: 'View your next steps for ' + escapeHtml(marketShort),
      body: 'Use the dedicated next-steps path once you understand the basics for ' + escapeHtml(marketShort) + '.',
      button: 'View Your Next Steps',
      variant: 'primary'
    };
  }

  if (pageType === 'city-inline') {
    return {
      eyebrow: 'Need help now?',
      heading: 'Get matched with a provider in ' + escapeHtml(marketShort),
      body: 'Use the callback path after you review the local framework, directory examples, and FAQs for ' + escapeHtml(marketShort) + '.',
      button: 'Get Matched With a Provider',
      variant: 'inline'
    };
  }

  if (pageType === 'state-primary') {
    return {
      eyebrow: 'Start here',
      heading: 'View your next steps for ' + escapeHtml(marketLabel || 'this state'),
      body: 'Use the state-level next-steps path after you narrow into the right city and support surface.',
      button: 'View Your Next Steps',
      variant: 'primary'
    };
  }

  if (pageType === 'state-inline') {
    return {
      eyebrow: 'Need help now?',
      heading: 'Get matched with a provider in ' + escapeHtml(marketLabel || 'this state'),
      body: 'Use the callback path only after you review the city coverage, request-city option, and state support guides.',
      button: 'Get Matched With a Provider',
      variant: 'inline'
    };
  }

  if (pageType === 'guides-hub-primary') {
    return {
      eyebrow: 'Use the guides, then act',
      heading: 'Use the guides, then get matched with a provider',
      body: 'When you are ready to move from research to action, use the callback path to hear from a relevant ' + escapeHtml(lowerProvider) + '.',
      button: 'Get Matched With a Provider',
      variant: 'primary'
    };
  }

  if (pageType === 'guides-hub-inline') {
    return {
      eyebrow: 'Next step',
      heading: 'View your next steps after you review the guides',
      body: 'Use the dedicated next-steps page when you want the full form, comparison path, and lookup tools in one place.',
      button: 'View Your Next Steps',
      variant: 'inline'
    };
  }

  if (pageType === 'global-primary') {
    return {
      eyebrow: 'Start here',
      heading: 'View your next steps',
      body: 'Use the dedicated next-steps path after you review the homepage short answer, provider preview, and state routing.',
      button: 'View Your Next Steps',
      variant: 'primary'
    };
  }

  if (pageType === 'global-inline') {
    return {
      eyebrow: 'Need help now?',
      heading: 'Get matched with a provider',
      body: 'This site is educational first, but you can still use the callback path after you narrow into the right state, city, or guide.',
      button: 'Get Matched With a Provider',
      variant: 'inline'
    };
  }

  if (pageType === 'guide-primary') {
    return {
      eyebrow: 'Use the guide, then decide',
      heading: 'Use this guide, then get matched with a provider',
      body: 'If this guide answers the basics and you want to hear from a relevant ' + escapeHtml(lowerProvider) + ', use the callback path.',
      button: 'Get Matched With a Provider',
      variant: 'primary'
    };
  }

  if (pageType === 'guide-inline') {
    return {
      eyebrow: 'Next step',
      heading: 'View your next steps once this guide gives you the basics',
      body: 'Use the dedicated next-steps page when you want the full form, comparison path, and lookup tools in one place.',
      button: 'View Your Next Steps',
      variant: 'inline'
    };
  }

  return {
    eyebrow: 'Need help?',
    heading: 'Get matched with a provider',
    body: 'Use the callback path when you want a relevant provider to reach out.',
    button: 'Get Matched With a Provider',
    variant: 'inline'
  };
}

function renderConversionCtaHtml(conversionTemplate, verticalKey, ctx) {
  const info = buildRequestAssistanceContext(verticalKey, ctx);
  const copy = conversionCopyForContext(String(ctx?.pageType || ''), verticalKey, ctx);
  let html = String(conversionTemplate || '');
  html = html.replace(/%%CTA_VARIANT%%/g, escapeHtml(copy.variant || 'inline'));
  html = html.replace(/%%CTA_MARKER%%/g, String(ctx?.marker || 'data-inline-conversion-cta="true"'));
  html = html.replace(/%%CTA_EYEBROW%%/g, copy.eyebrow || 'Next step');
  html = html.replace(/%%CTA_HEADING%%/g, copy.heading || 'Use the request-assistance tool');
  html = html.replace(/%%CTA_BODY%%/g, copy.body || '');
  html = html.replace(/%%CTA_BUTTON%%/g, copy.button || 'Request assistance');
  const isNextSteps = /next steps/i.test(String(copy.button || ''));
  html = html.replace(/%%CTA_HREF%%/g, escapeHtml(isNextSteps ? info.nextStepsHref : info.href));
  html = html.replace(/%%PROVIDER_TYPE_LABEL%%/g, escapeHtml(info.pt));
  html = html.replace(/%%PAGE_SRC%%/g, escapeHtml(info.src));
  html = html.replace(/%%BUTTON_SOURCE%%/g, escapeHtml(isNextSteps ? 'next_steps_cta' : info.buttonSource));
  html = html.replace(/%%INTENT_TYPE%%/g, escapeHtml(isNextSteps ? 'decision_hub' : info.intentType));
  html = html.replace(/%%MARKET_SLUG%%/g, escapeHtml(info.marketSlug));
  html = html.replace(/%%PAGE_KIND%%/g, escapeHtml(info.pageKind));
  html = html.replace(/%%VERTICAL_KEY%%/g, escapeHtml(info.verticalKey));
  return html;
}

function injectPrimaryConversionCta(mainHtml, conversionTemplate, verticalKey, ctx) {
  const marker = 'data-primary-conversion-cta="true"';
  if (String(mainHtml || '').includes(marker)) return String(mainHtml || '');
  const html = renderConversionCtaHtml(conversionTemplate, verticalKey, { ...ctx, pageType: ctx.pageType, marker });
  const out = String(mainHtml || '');
  if (out.includes('%%PRIMARY_CTA%%')) return out.replace(/%%PRIMARY_CTA%%/g, html);
  const anchors = [
    /(<section[^>]*data-short-answer="true"[\s\S]*?<\/section>)/i,
    /(<section[^>]*data-citation-summary="true"[\s\S]*?<\/section>)/i,
    /(<section class="hero"[\s\S]*?<\/section>)/i
  ];
  for (const re of anchors) {
    if (re.test(out)) return out.replace(re, '$1\n' + html);
  }
  return out + '\n' + html;
}

function injectInlineConversionCta(mainHtml, conversionTemplate, verticalKey, ctx) {
  const marker = 'data-inline-conversion-cta="true"';
  const out = String(mainHtml || '');
  if (out.includes(marker)) return out;
  const html = renderConversionCtaHtml(conversionTemplate, verticalKey, { ...ctx, pageType: ctx.pageType, marker });
  if (out.includes('%%MID_NEXT_STEPS%%')) return out.replace(/%%MID_NEXT_STEPS%%/g, html);
  const anchors = [
    /(<section[^>]*data-citation-summary="true"[\s\S]*?<\/section>)/i,
    /(<section[^>]*data-short-answer="true"[\s\S]*?<\/section>)/i,
    /(<section class="hero"[\s\S]*?<\/section>)/i
  ];
  for (const re of anchors) {
    if (re.test(out)) return out.replace(re, '$1\n' + html);
  }
  return out + '\n' + html;
}

function renderConnectionBubbleHtml(connectionBubbleTemplate, verticalKey, ctx) {
  const info = buildRequestAssistanceContext(verticalKey, ctx);

  let html = String(connectionBubbleTemplate || '');
  html = html.replace(/%%PROVIDER_TYPE_LABEL_LOWER%%/g, escapeHtml(info.labelLower));
  html = html.replace(/%%REQUEST_ASSISTANCE_HREF%%/g, escapeHtml(info.href));

  // Attach data attributes for tracking (defensive: inject into the primary button).
  if (!/data-provider-type=/.test(html)) {
    html = html.replace(
      /class="button button-primary connection-bubble__button"/,
      'class="button button-primary connection-bubble__button" data-provider-type="' + escapeHtml(info.pt) + '" data-page-slug="' + escapeHtml(info.pageSlug) + '" data-button-source="connection_bubble" data-intent-type="direct_match" data-market-slug="' + escapeHtml(info.marketSlug) + '" data-page-kind="' + escapeHtml(info.pageKind) + '" data-vertical-key="' + escapeHtml(info.verticalKey) + '"'
    );
  }

  return html;
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
  const title = stateName ? ("Verify a provider's license (" + stateName + ")") : "Verify a provider's license";
  if (!url) {
    return (
      '<div class="state-lookup-cta" data-state-lookup-cta="true">' +
      '<h3 class="lookup-title">' + title + '</h3>' +
      '<p class="muted">The official state database is not available for this state in the current build.</p>' +
      '</div>'
    );
  }
  return (
    '<div class="state-lookup-cta" data-state-lookup-cta="true">' +
    '<h3 class="lookup-title">' + title + '</h3>' +
    '<p class="muted">Use the official ' + stateName + ' database before you contact any provider. Confirm identity, current license status, and any public disciplinary actions shown there.</p>' +
    '<p><a class="button button-secondary" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">Open the official ' + stateName + ' database</a></p>' +
    '<p class="muted state-lookup-tip">Search the provider name first, then confirm license status, supervising clinician information, and any public actions shown by the state.</p>' +
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

function loadPromotedReadyCities(verticalKey) {
  const normalizeVertical = (value) => String(value || '').trim().toLowerCase().replace(/_/g, '-');
  const vk = normalizeVertical(verticalKey);
  if (!vk) return [];
  if (!fs.existsSync(COVERAGE_PROMOTED_PATH) || !fs.existsSync(COVERAGE_RUNTIME_SUPPORT_PATH)) return [];
  try {
    const promotedRows = parseCsvRows(fs.readFileSync(COVERAGE_PROMOTED_PATH, 'utf8'))
      .filter((row) => normalizeVertical(row.vertical || '') === vk)
      .filter((row) => String(row.publish_enabled || '').trim().toLowerCase() === 'true');
    const supportRows = parseCsvRows(fs.readFileSync(COVERAGE_RUNTIME_SUPPORT_PATH, 'utf8'))
      .filter((row) => normalizeVertical(row.vertical || '') === vk)
      .filter((row) => String(row.runtime_ready || '').trim().toLowerCase() === 'true');
    const supportBySlug = new Map(supportRows.map((row) => [String(row.city_slug || '').trim(), row]));
    return promotedRows
      .filter((row) => supportBySlug.has(String(row.city_slug || '').trim()))
      .map((row) => ({
        slug: String(row.city_slug || '').trim(),
        state: String(row.state_code || '').trim().toUpperCase(),
        status: 'live'
      }))
      .filter((row) => row.slug);
  } catch (err) {
    console.warn('WARN: failed to load promoted ready cities:', err.message);
    return [];
  }
}

function loadCities(pageSet, verticalKey) {
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
  const promotedReadyCities = loadPromotedReadyCities(verticalKey);
  const bySlug = new Map();
  // Pack cities first so pack can override fields, then promoted ready cities, then base top10.
  for (const c of (packCities || [])) bySlug.set(String(c.slug), c);
  for (const c of (promotedReadyCities || [])) if (!bySlug.has(String(c.slug))) bySlug.set(String(c.slug), c);
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

function buildOrganizationSchema(siteUrl, brandName, sameAs) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandName,
    url: siteUrl.replace(/\/+$/, "") + "/"
  };
  if (Array.isArray(sameAs)) schema.sameAs = sameAs.filter(Boolean);
  return schema;
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
function buildCollectionPageSchemaCity(siteUrl, brandName, city, route, title, description, verticalKey) {
  const serviceName = isPersonalInjury(verticalKey)
    ? 'Personal injury legal services'
    : (String(verticalKey || '').replace(/_/g, ' ') + ' services').trim();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    datePublished: BUILD_ISO,
    dateModified: BUILD_ISO,
    url: buildCanonical(siteUrl, city, route),
    about: {
      "@type": "Service",
      name: serviceName,
      areaServed: {
        "@type": "AdministrativeArea",
        name: String(city && (city.marketLabel || city.city || city.slug || ''))
      }
    },
    isPartOf: { "@type": "WebSite", name: brandName, url: siteUrl.replace(/\/+$/, "") + "/" }
  };
}

function buildArticleSchemaGlobal(siteUrl, brandName, route, title, description, options) {
  const opts = options || {};
  const pageUrl = buildCanonicalGlobal(siteUrl, route);
  const base = siteUrl.replace(/\/+$/, '') + '/';
  const keywords = Array.isArray(opts.keywords) ? opts.keywords.filter(Boolean).slice(0, 12) : [];
  const articleSection = String(opts.articleSection || 'Guide');
  const aboutName = String(opts.aboutName || title);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    inLanguage: 'en-US',
    url: pageUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    articleSection,
    datePublished: BUILD_ISO,
    dateModified: BUILD_ISO,
    author: { "@type": "Organization", name: brandName, url: base },
    publisher: { "@type": "Organization", name: brandName, url: base },
    about: { "@type": "Thing", name: aboutName },
    ...(keywords.length ? { keywords } : {})
  };
}

function buildKeywords(title, description, extras) {
  const raw = []
    .concat(Array.isArray(extras) ? extras : [])
    .concat(String(title || '').split(/[^A-Za-z0-9]+/))
    .concat(String(description || '').split(/[^A-Za-z0-9]+/));
  const stop = new Set(['the','and','for','with','this','that','from','into','your','about','only','guide','city','local','what','when','after','before','into','best','page','pages','overview']);
  const seen = new Set();
  const out = [];
  for (const token of raw) {
    const clean = String(token || '').trim();
    if (!clean) continue;
    if (clean.length < 3 || clean.length > 40) continue;
    const lower = clean.toLowerCase();
    if (stop.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(clean);
    if (out.length >= 12) break;
  }
  return out;
}

function renderHeadMeta(opts) {
  const pageType = String((opts && opts.pageType) || 'other');
  const title = escapeHtml(String((opts && opts.title) || ''));
  const description = escapeHtml(String((opts && opts.description) || ''));
  const canonical = escapeHtml(String((opts && opts.canonical) || ''));
  const brandName = escapeHtml(String((opts && opts.brandName) || ''));
  const section = escapeHtml(String((opts && opts.section) || pageType));
  const ogType = pageType === 'guide-detail' ? 'article' : 'website';
  const keywords = buildKeywords(opts && opts.title, opts && opts.description, opts && opts.keywords);
  const keywordString = escapeHtml(keywords.join(', '));
  return [
    '<meta property="og:title" content="' + title + '" />',
    '<meta property="og:description" content="' + description + '" />',
    '<meta property="og:url" content="' + canonical + '" />',
    '<meta property="og:type" content="' + ogType + '" />',
    '<meta property="og:site_name" content="' + brandName + '" />',
    '<meta name="twitter:card" content="summary" />',
    '<meta name="twitter:title" content="' + title + '" />',
    '<meta name="twitter:description" content="' + description + '" />',
    '<meta name="citation_title" content="' + title + '" />',
    '<meta name="citation_public_url" content="' + canonical + '" />',
    '<meta name="citation_author" content="' + brandName + '" />',
    '<meta name="citation_publisher" content="' + brandName + '" />',
    '<meta name="citation_publication_date" content="' + BUILD_ISO + '" />',
    '<meta name="citation_modified_date" content="' + BUILD_ISO + '" />',
    '<meta name="citation_language" content="en-US" />',
    '<meta name="citation_abstract" content="' + description + '" />',
    '<meta name="citation_section" content="' + section + '" />',
    '<meta name="citation_keywords" content="' + keywordString + '" />',
    '<meta name="page-family" content="' + escapeHtml(pageType) + '" />',
    (keywordString ? '<meta name="keywords" content="' + keywordString + '" />' : ''),
    (pageType === 'guide-detail' ? '<meta property="article:published_time" content="' + BUILD_ISO + '" />' : ''),
    (pageType === 'guide-detail' ? '<meta property="article:modified_time" content="' + BUILD_ISO + '" />' : '')
  ].filter(Boolean).join('\n');
}

function buildRequestAssistanceServiceSchema(siteUrl, brandName, route, title, description) {
  const pageUrl = buildCanonicalGlobal(siteUrl, route);
  const base = siteUrl.replace(/\/+$/, '') + '/';
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: title,
    description,
    serviceType: "Local provider routing and request assistance",
    url: pageUrl,
    provider: {
      "@type": "Organization",
      name: brandName,
      url: base
    },
    areaServed: {
      "@type": "Country",
      name: "United States"
    },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: pageUrl,
      availableLanguage: "en-US"
    },
    audience: {
      "@type": "Audience",
      audienceType: "People seeking help finding a relevant local provider category"
    }
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


function buildAnswerFaqSchema(question, answer) {
  const q = String(question || '').trim();
  const a = String(answer || '').replace(/\s+/g, ' ').trim();
  if (!q || !a) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a }
      }
    ]
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
  // - No competitor destination URLs in structured data
  const items = [];
  let pos = 1;
  const seen = new Set();
  for (const it of listings) {
    if (!it) continue;
    const name = String((it.firm_name || it.name || "")).trim();
    const key = name.toLowerCase();
    if (!name) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      "@type": "ListItem",
      position: pos++,
      item: {
        "@type": "Organization",
        name: name
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
  const cleanRoute = (route || "").replace(/^\/+|\/+$/g, "");
  const ld = [
    buildOrganizationSchema(siteUrl, brandName, (pageSet && pageSet.schema && pageSet.schema.sameAs) || []),
    buildWebSiteSchema(siteUrl, brandName),
    buildWebPageSchema(siteUrl, brandName, city, route, title, description),
    buildBreadcrumbs(siteUrl, city, route, title)
  ];

  if (cleanRoute === '' && city) {
    ld.push(buildCollectionPageSchemaCity(siteUrl, brandName, city, route, title, description, verticalKey));
  }

  // PI: Add a non-promotional directory ItemList schema to help LLM and search engines
  // answer neutral queries like "list of firms in [city/state]" without implying rankings.
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
  const answerSchema = buildAnswerFaqSchema(title, `${title}. ${description}`.trim());
  if (answerSchema) ld.push(answerSchema);
  }

  // Non-PI: Resource ItemList + FAQPage schema on city home pages (pack-controlled)
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};
  const itemListEnabled = schemaCfg && schemaCfg.itemListEnabled === true;
  const faqEnabled = schemaCfg && schemaCfg.faqEnabled === true;

  if (cleanRoute === "" && city) {
    const answerQuestion = title;
    const answerText = `${title}. ${description}`.trim();
    const answerSchema = buildAnswerFaqSchema(answerQuestion, answerText);
    if (answerSchema) ld.push(answerSchema);
  }

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
    buildOrganizationSchema(siteUrl, brandName, (pageSet && pageSet.schema && pageSet.schema.sameAs) || []),
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

function buildGuideHowToSchema(siteUrl, route, title, description) {
  const cleanRoute = String(route || '').replace(/^\/+|\/+$/g, '');
  if (!/^guides\/.+/.test(cleanRoute)) return null;
  const url = buildCanonicalGlobal(siteUrl, cleanRoute);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description: description,
    url,
    step: [
      { '@type': 'HowToStep', name: 'Clarify the real decision', text: 'Use the guide to identify what matters most in the decision before comparing providers or programs.' },
      { '@type': 'HowToStep', name: 'Compare the tradeoff', text: 'Use the comparison and caution sections to understand what is easy to miss.' },
      { '@type': 'HowToStep', name: 'Verify the next step', text: 'Move into methodology, FAQ, or local pages only after the decision path is clearer.' }
    ]
  };
}

function renderHeadJsonLdGlobal(siteUrl, brandName, route, title, description, pageSet) {
  const cleanRoute = (route || "").replace(/^\/+|\/+$/g, "");
  const primaryPageSchema = (cleanRoute === 'guides' || cleanRoute === 'faq')
    ? buildCollectionPageSchemaGlobal(siteUrl, brandName, route, title, description)
    : buildWebPageSchemaGlobal(siteUrl, brandName, route, title, description);
  const ld = [
    buildOrganizationSchema(siteUrl, brandName, (pageSet && pageSet.schema && pageSet.schema.sameAs) || []),
    buildWebSiteSchema(siteUrl, brandName),
    primaryPageSchema,
    buildBreadcrumbsGlobal(siteUrl, route, title)
  ];
  const answerSchema = buildAnswerFaqSchema(title, `${title}. ${description}`.trim());
  if (answerSchema) ld.push(answerSchema);

  if (/^guides\/.+/.test(cleanRoute)) {
    ld.push(buildArticleSchemaGlobal(siteUrl, brandName, route, title, description, {
      articleSection: 'Guide',
      aboutName: title,
      keywords: buildKeywords(title, description, ['guide', 'short answer', 'decision support'])
    }));
    const howToSchema = buildGuideHowToSchema(siteUrl, route, title, description);
    if (howToSchema) ld.push(howToSchema);
  }

  if (cleanRoute === 'guides') {
    const guideSchemaDir = loadGlobalPagesDir(pageSet);
    const guideItems = selectPriorityGuideSummaries(guideSchemaDir, 8).map((g, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: normalizeUrl(siteUrl.replace(/\/+$/, '') + g.route),
      name: g.title
    }));
    if (guideItems.length) {
      ld.push({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListOrder: 'https://schema.org/ItemListUnordered',
        numberOfItems: guideItems.length,
        itemListElement: guideItems
      });
    }
  }
  const schemaCfg = (pageSet && pageSet.schema) ? pageSet.schema : {};
  const faqEnabled = schemaCfg && schemaCfg.faqEnabled === true;

  if (cleanRoute === "request-assistance") {
    ld.push(buildRequestAssistanceServiceSchema(siteUrl, brandName, route, title, description));
  }

  if (faqEnabled && cleanRoute === "faq") {
    const faq = getGlobalFaqItems(pageSet);
    const faqSchema = buildFaqSchema(faq);
    if (faqSchema) ld.push(faqSchema);
  }
  return `<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>`;
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
function renderAdPlacement(key, opts) {
  // Fixed, invariant ad block HTML; real sponsors injected elsewhere.
  // Add deterministic placement markers for golden-contract validation.
  const k = String(key || "");
  let placement = "";
  if (k.endsWith("_top")) placement = "top";
  else if (k.endsWith("_mid")) placement = "mid";
  else if (k.endsWith("_bottom")) placement = "bottom";

  const placementAttr = placement ? ` data-sponsored-placement="${placement}"` : "";
  const hero = opts && opts.hero === true;
  const allowForProvidersLink = !(opts && opts.allowForProvidersLink === false);
  const cls = hero ? 'sponsor-stack is-buyout-hero' : 'sponsor-stack';

  // Under LIVE buyouts, conversion surfaces like /for-providers/ are contract-forbidden.
  // Keep the placement marker (for layout + audit) but remove the link.
  const labelText = allowForProvidersLink ? 'Advertising' : 'Sponsored';
  const headline = allowForProvidersLink
    ? '<p class="sponsor-name"><a href="/for-providers/">Advertise here</a></p>'
    : '<p class="sponsor-name">Sponsored placement</p>';

  // Guide pages: treat sponsor blocks as complementary content with dedicated styling.
  // We keep the same internal structure for validator stability; only wrapper element + class differs.
  const isGuidePlacement = /(^|_)guide(_|$)/.test(k);
  const wrapperTag = isGuidePlacement ? 'aside' : 'section';
  const wrapperAttrs = isGuidePlacement
    ? ` role="complementary" class="${cls} guide-sponsor"`
    : ` class="${cls}"`;

  return `
<!-- PRESERVED ZONE: AD BLOCK START (${escapeHtml(key)}) -->
<${wrapperTag}${wrapperAttrs} data-sponsor-stack="${escapeHtml(key)}"${placementAttr} aria-label="Advertising block: ${escapeHtml(key)}">
  <div class="sponsor-stack__inner">
    <div class="sponsor-stack__header">
      <div class="sponsor-label"><strong>${labelText}</strong></div>
      <div class="sponsor-stack__meta">Sponsored placement • fixed inventory • disclosed</div>
    </div>

    <div class="sponsor-items">
      <div class="sponsor-card sponsor-card--empty" data-sponsored-empty="true">
        <div class="badges"><span class="badge badge-sponsored">ADVERTISING</span></div>
        <div class="sponsor-meta">Disclosed advertising inventory. See <a href="/for-providers/">Advertising &amp; Provider Info</a> for surfaces, pricing, and rules.</div>
      </div>
    </div>
  </div>
</${wrapperTag}>
<!-- PRESERVED ZONE: AD BLOCK END (${escapeHtml(key)}) -->`.trim();
}

function loadBuyoutsSafe(repoRoot) {
  const fp = path.join(repoRoot || process.cwd(), "data", "buyouts.json");
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}


function injectAdPlacements(html, ads, ctx) {
  if (!ads || typeof ads !== "object") return html;
  const city = ctx && ctx.city ? ctx.city : null;
  const verticalKey = ctx && ctx.verticalKey ? ctx.verticalKey : "";

  // BUYOUT HERO RENDERING (authoritative):
  // - Non-buyout pages MUST NOT render hero sponsor blocks.
  // - If a LIVE page-scope buyout wins for this page (guide/city/state), the TOP placement renders hero-style.
  // - Under LIVE buyouts, conversion surfaces like /for-providers/ must be removed from sponsor blocks.
  // - Placements remain fixed inventory surfaces; do not remove slots that are sold (sales parity + golden contract).
  let topIsHero = false;
  let suppressMid = false;
  let suppressBottom = false;
  let allowForProvidersLink = true;
  try {
    const all = loadBuyoutsSafe(REPO_ROOT);
    const active = buyouts.getActiveBuyouts(all, new Date());
    const pageType = (ctx && ctx.pageType) ? String(ctx.pageType) : (ctx && ctx.guideRoute ? 'guide' : (city ? 'city' : ''));
    const bctx = {
      city: city && city.slug ? String(city.slug) : undefined,
      state: city && city.state ? String(city.state) : (ctx && ctx.stateCode ? String(ctx.stateCode) : undefined),
      guideRoute: (ctx && ctx.guideRoute) ? String(ctx.guideRoute) : undefined,
      verticalKey: verticalKey
    };
    const winner = buyouts.resolveWinner(active, bctx, new Date());
    if (winner && winner.buyout === true) {
      // Under LIVE buyouts, remove the generic /for-providers link from sponsor stacks.
      allowForProvidersLink = false;

      if (winner.scope === 'vertical') {
        // Vertical buyout: runtime CTA is enabled elsewhere.
        // Keep fixed inventory placements intact (golden contract + sales parity).
        topIsHero = false;
      } else if (winner.scope === 'category' || winner.scope === 'city' || winner.scope === 'state') {
        // Page-scope buyout: Top becomes hero, and other placements are suppressed (exclusive surface).
        const scopeMatches = (winner.scope === pageType) || (pageType === 'guide' && winner.scope === 'category');
        if (scopeMatches) {
          topIsHero = true;
        }
      }
    }
  } catch (e) {
    // noop — absence/invalid buyouts.json should not break builds.
  }

  return html.replace(/%%AD:([a-zA-Z0-9_\-]+)%%/g, (m, key) => {
    const cfg = ads && ads[key] ? ads[key] : null;
    // state_lookup_cta is not an ad — it's a functional utility CTA.
    if (key === 'state_lookup_cta') {
      if (!cfg || cfg.enabled !== true) return '';
      const features = ctx && ctx.cityFeatures ? ctx.cityFeatures : null;
      if (features && features.stateLookup === false) return '';
      // Legacy: PI is directory-only; state lookup is stripped earlier.
      if (isPersonalInjury(verticalKey)) return '';
      return renderStateLookupCta(city || {});
    }
    if (!cfg || cfg.enabled !== true) return '';
    const k = String(key);
    const isTop = k.endsWith('_top');
    const isMid = k.endsWith('_mid');
    const isBottom = k.endsWith('_bottom');

    if (isMid && suppressMid) return '';
    if (isBottom && suppressBottom) return '';

    return renderAdPlacement(key, {
      hero: Boolean(isTop && topIsHero),
      allowForProvidersLink,
    });
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
  var cards = listingsSorted.filter(function(x){ return x && x.display !== false; }).map(function(l){
    var name = (l.firm_name || l.name) ? String(l.firm_name || l.name) : 'Firm';
    var compare = String(
      l.practice_focus ||
      l.notes ||
      (Array.isArray(l.practice_areas) ? l.practice_areas.join(', ') : '') ||
      ''
    ).trim();
    if (!compare) compare = 'Compare scope, written policies, and first-step requirements';
    var attrs = [
      compare,
      'City listing example',
      'Use the questions and evidence guides before you contact anyone'
    ].filter(Boolean).slice(0,3).map(function(item){ return '<li>' + escapeHtml(item) + '</li>'; }).join('');
    return '<article class="provider-card" data-provider-card="true">' +
      '<h3 class="provider-card__name">' + escapeHtml(name) + '</h3>' +
      '<p class="provider-card__meta" data-provider-card-meta="true">Personal injury law firm</p>' +
      '<ul class="provider-card__attributes" data-provider-card-attributes="true">' + attrs + '</ul>' +
      '</article>';
  }).join('');

  if (!cards) {
    return '<div class="listings-empty">' +
      '<p><strong>No firms are listed for this market yet.</strong> This directory is informational only; we do not rate, rank, or endorse providers.</p>' +
      '</div>';
  }

  if (sponsorUiEnabled) {
    return '<details class="pi-dir-collapsed" data-pi-dir-collapsed="true">' +
      '<summary>Other firms in this market (neutral list)</summary>' +
      '<div class="provider-directory-grid">' + cards + '</div>' +
      '</details>';
  }

  return '<div class="provider-directory-grid">' + cards + '</div>';
}

function injectListings(html, listings, city, sponsor, pageSet) {
  var sponsorLive = sponsorship.isSponsorLive(sponsor);

  // Pack-gate sponsor UI + next-steps CTAs
  var sponsorUiEnabled = (sponsorship.shouldRenderNextSteps(pageSet) && sponsorLive);

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
  var href = opts && opts.href ? String(opts.href) : '';
  if (!href) return '';
  return (
    '<section class="section next-steps-zone" data-next-steps-zone="true">' +
    '<div class="card">' +
    '<h2>Next steps</h2>' +
    '<p class="muted" data-next-steps-teaser="true">Use the dedicated next-steps page when you want the full callback form, comparison path, and lookup tools in one place.</p>' +
    '<div class="actions"><a class="button button-primary" data-next-steps-cta="true" href="' + escapeHtml(href) + '">View Next Steps</a></div>' +
    '</div>' +
    '</section>'
  );
}

function loadGlobalPageByRoute(pageSet, wantedRoute) {
  var globalPagesDir = loadGlobalPagesDir(pageSet);
  if (!globalPagesDir || !fs.existsSync(globalPagesDir)) return null;
  var target = String(wantedRoute || '').replace(/\/+$/g, '') || '/';
  for (const fp of listJsonFiles(globalPagesDir)) {
    try {
      const raw = readJson(fp);
      const routeRaw = String(raw.route || '').trim();
      const route = routeRaw ? (routeRaw.startsWith('/') ? routeRaw : ('/' + routeRaw.replace(/^\/+/, ''))) : '/';
      const normalized = route.replace(/\/+$/g, '') || '/';
      if (normalized === target) return raw;
    } catch (_) {}
  }
  return null;
}

function extractRequestAssistanceHtml(pageSet) {
  var page = loadGlobalPageByRoute(pageSet, '/request-assistance');
  if (!page || !page.main_html) {
    try {
      var fallbackPath = path.join(DATA_DIR, 'global_pages', 'request-assistance.json');
      if (fs.existsSync(fallbackPath)) {
        page = readJson(fallbackPath);
      }
    } catch (_) {}
  }
  if (!page || !page.main_html) return '';
  return String(page.main_html || '');
}

function stripRequestAssistanceHero(requestAssistanceHtml) {
  return String(requestAssistanceHtml || '').replace(/<section class="hero ra-hero"[\s\S]*?<\/section>/i, '');
}

function renderDedicatedNextStepsHubHtml(opts) {
  var compareHref = String(opts && opts.compareHref ? opts.compareHref : '/guides/');
  var toolsHref = String(opts && opts.toolsHref ? opts.toolsHref : '/faq/');
  var requestAssistanceHtml = stripRequestAssistanceHero(String(opts && opts.requestAssistanceHtml ? opts.requestAssistanceHtml : ''));
  var marketLabel = String(opts && opts.marketLabel ? opts.marketLabel : 'this market');
  var pageTitle = String(opts && opts.pageTitle ? opts.pageTitle : 'Next steps');
  return (
    '<section class="hero" data-next-steps-page-hero="true">' +
      '<p class="kicker">Next steps</p>' +
      '<h1>' + escapeHtml(pageTitle) + '</h1>' +
      '<p class="muted">Use this page when you want everything in one place: the full callback form, the comparison path, and the lookup tools path.</p>' +
    '</section>' +
    '<section class="section next-steps-page-shell" data-next-steps-page-shell="true">' +
      '<div class="card" data-next-steps-page-intro="true">' +
        '<h2>Choose how to move forward in ' + escapeHtml(marketLabel) + '</h2>' +
        '<p data-next-steps-answer="true">This page is the only place where the full next-steps decision hub should appear. Use the full provider callback form below if you already want to hear from a provider, compare the education-first options before you decide, or use the lookup tools path when you want the fastest self-serve route.</p>' +
      '</div>' +
      '<div class="grid" data-next-steps-cards="true">' +
        '<div class="card" data-next-steps-card="direct-match">' +
          '<h3>Get matched with a provider</h3>' +
          '<p>The full callback form lives directly on this page below. Use it when you want a provider call back without leaving the decision hub.</p>' +
          '<p class="actions"><a class="button button-primary" data-next-steps-primary="true" href="#request-assistance-form">Jump to the full form</a></p>' +
        '</div>' +
        '<div class="card" data-next-steps-card="compare">' +
          '<h3>Compare your options</h3>' +
          '<p>Review the education-first guides before you decide which provider type, market, or program structure fits.</p>' +
          '<p class="actions"><a class="button button-secondary" data-next-steps-compare="true" href="' + escapeHtml(compareHref) + '">Compare Options</a></p>' +
        '</div>' +
        '<div class="card" data-next-steps-card="tools">' +
          '<h3>Use lookup tools</h3>' +
          '<p>Start with the FAQ and verification-style lookup surfaces when you want the fastest self-serve path.</p>' +
          '<p class="actions"><a class="button button-secondary" data-next-steps-tools="true" href="' + escapeHtml(toolsHref) + '">Use Lookup Tools</a></p>' +
        '</div>' +
      '</div>' +
      '<ul class="neutral-list" data-next-steps-checklist="true">' +
        '<li>Use the full form on this page when you want a provider call back.</li>' +
        '<li>Use the comparison path when you still need to review costs, timing, or questions to ask.</li>' +
        '<li>Use the lookup tools path when you want the fastest self-serve route before you submit anything.</li>' +
      '</ul>' +
      '<p class="muted" data-next-steps-routing="true">The same routing system can capture all three paths while keeping the public experience useful and education-first.</p>' +
    '</section>' +
    requestAssistanceHtml
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
      category: String(x.category || x.type || x.specialty || '').trim(),
      city: String(x.city || '').trim(),
      state: String(x.state || '').trim(),
      attributes: Array.isArray(x.attributes) ? x.attributes.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 4) : [],
      offers_therapy: x.offers_therapy === true,
      offers_peptide_programs: x.offers_peptide_programs === true,
      peptide_program_notes: String(x.peptide_program_notes || '').trim(),
      peptide_program_source: String(x.peptide_program_source || 'unknown').trim() || 'unknown'
    }))
    .filter((x) => x.name)
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


  // LLM bait: required block (marker) – must sit immediately above the directory/listings block.
  // If present elsewhere, remove + re-insert deterministically.
  const baitRe = /<section[^>]*data-llm-bait="question"[\s\S]*?<\/section>/m;
  if (baitRe.test(out)) {
    out = out.replace(baitRe, '');
  }

  const q = renderLLMBaitQuestionHtml(verticalKey, city);
  // Prefer inserting immediately above the first listings/directory block.
  if (out.includes('data-example-providers="true"')) {
    out = out.replace(/(<section[^>]*data-example-providers="true"[\s\S]*?<\/section>)/m, `${q}
$1`);
  } else if (out.includes('data-pi-home-directory="true"')) {
    out = out.replace(/(<section[^>]*data-pi-home-directory="true"[\s\S]*?<\/section>)/m, `${q}
$1`);
  } else if (out.includes('data-listings-block="true"')) {
    out = out.replace(/(<section[^>]*data-listings-block="true"[\s\S]*?<\/section>)/m, `${q}
$1`);
  } else if (out.includes('data-eval-framework="true"')) {
    // Fallback: keep it above eval framework.
    out = out.replace(/(<section[^>]*data-eval-framework="true"[\s\S]*?<\/section>)/m, `${q}
$1`);
  } else {
    // Last resort: place after hero.
    out = injectAfterSection(out, 'data-city-hero', q);
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

  // Dedupe: if template already contained sponsor slots, keep first occurrence per placement.
  for (const plc of ["top", "mid", "bottom"]) {
    let seen = 0;
    const re = new RegExp("(<section[^>]*data-sponsored-placement=\"" + plc + "\"[^>]*>[\\s\\S]*?<\/section>)", "gi");
    out = out.replace(re, (m) => {
      seen += 1;
      return seen === 1 ? m : "";
    });
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
      'Whether the clinic also offers add-on services like weight loss programs, IV support, or peptide programs — and what extra monitoring those services require',
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
    '<section class="section answer-block" data-eval-framework="true">' +
      '<h2>' + heading + '</h2>' +
      '<p class="answer-context"><strong>Direct answer:</strong> ' + lead + '</p>' +
      '<p class="answer-when" data-eval-priority="true"><strong>What usually matters most:</strong> People tend to make a better decision when they compare fit, verification, process, and follow-up before they compare convenience or marketing language.</p>' +
      '<p class="answer-tradeoff" data-eval-tradeoff="true"><strong>Common mistake:</strong> Moving too fast on a price quote, a “best/top” claim, or a rushed intake before the service scope and documentation requirements are clear.</p>' +
      '<p class="answer-best-for" data-eval-best-for="true"><strong>Best for:</strong> readers who still need to decide which questions should narrow the field before they compare providers or programs.</p>' +
      '<p class="answer-avoid-if" data-eval-avoid-if="true"><strong>Do not use this section as:</strong> a ranking, endorsement, or substitute for official verification.</p>' +
      '<p class="answer-cost-outcome" data-eval-cost-outcome="true"><strong>Cost vs outcome tradeoff:</strong> a faster quote or lighter intake can feel easier now, but the more useful path is usually the one that explains scope, verification, and follow-up clearly enough to reduce rework later.</p>' +
      '<ul class="neutral-list">' + items + '</ul>' +
      '<p class="muted answer-microcopy" style="font-size:0.95em;margin-top:0.75rem">These factors describe common decision frameworks. They are not recommendations, rankings, or endorsements.</p>' +
    '</section>'
  );
}



function renderLocalizedConclusionHtml(verticalKey, city) {
  const vk = String(verticalKey || '').trim().toLowerCase();
  const marketRaw = String((city && (city.marketLabel || city.slug)) || 'this market');
  const market = escapeHtml(marketRaw);
  const stateName = escapeHtml(String((city && (city.stateName || city.state)) || 'this state'));

  const map = {
    pi: {
      factor: 'injury seriousness, treatment timeline, and how much uncertainty still exists around fault and insurer pressure',
      caution: 'a fast consultation pitch is not the same thing as a clean fit for your case'
    },
    dentistry: {
      factor: 'how clearly the office explains diagnosis, alternatives, sequencing, and what is included in the written plan',
      caution: 'the lowest headline number can hide the most expensive long-term path'
    },
    neuro: {
      factor: 'what the evaluation is actually meant to answer, who performs it, and what the report can realistically support afterward',
      caution: 'faster scheduling is not automatically better if the scope is too thin for the real decision'
    },
    trt: {
      factor: 'whether the clinic explains candidacy, labs, monitoring, and tradeoffs instead of just selling convenience',
      caution: 'a simple monthly pitch can mask weak follow-up or weak safety structure'
    },
    uscis_medical: {
      factor: 'whether document handling, vaccination questions, and sealed-form logistics are explained clearly before the appointment',
      caution: 'the real risk is usually paperwork friction, not just finding a nearby appointment'
    }
  };
  const item = map[vk] || {
    factor: 'fit, verification, and what happens next',
    caution: 'marketing confidence is not the same thing as decision clarity'
  };

  return (
    '<section class="localized-conclusion" data-localized-conclusion="true" data-localized-conclusion-strength="true">' +
      '<h2>What usually matters most in ' + market + '</h2>' +
      '<p data-localized-primary="true">In ' + market + ', people usually make a better decision when they focus first on ' + escapeHtml(item.factor) + '.</p>' +
      '<p data-localized-why="true"><strong>Why this matters:</strong> City pages should help you slow the decision down enough to compare the right questions against ' + stateName + ' verification steps, not just click the nearest option.</p>' +
      '<p data-localized-tradeoff="true"><strong>Watch for this tradeoff:</strong> ' + escapeHtml(item.caution) + '.</p>' +
    '</section>'
  );
}

function renderStateAuthorityBlockHtml(stateName, cityCount) {
  return (
    '<section class="state-authority-block" data-state-authority-block="true" data-state-authority-strength="true">' +
      '<h2>How to use this state page well</h2>' +
      '<p data-state-authority-direct="true"><strong>Direct answer:</strong> A state page should help you understand what stays constant across the state and which questions still need a city-level page.</p>' +
      '<p data-state-authority-dominance="true">This page is strongest when you use it as a synthesis layer: statewide verification, statewide rules-of-thumb, and clean routing into ' + escapeHtml(String(cityCount || 0)) + ' city hubs where local comparison starts to matter.</p>' +
      '<p data-state-authority-tradeoff="true"><strong>Common mistake:</strong> Treating a state page like a ranking page instead of a routing and verification page.</p>' +
      '<p data-state-authority-use="true"><strong>Use this page for:</strong> statewide boundaries, official resources, and deciding which city page or guide should come next.</p>' +
    '</section>'
  );
}

function renderGuideGroupsHtml(groups) {
  const rendered = (Array.isArray(groups) ? groups : []).map((group) => {
    const items = (Array.isArray(group.items) ? group.items : []).map((item) => '<li><a href="' + escapeHtml(String(item.href || '#')) + '" data-decision-anchor="true">' + escapeHtml(String(item.label || 'Guide')) + '</a></li>').join('');
    return '<div class="guide-group-card" data-guide-group="true"><h3>' + escapeHtml(String(group.heading || 'Start here')) + '</h3><ul class="neutral-list">' + items + '</ul></div>';
  }).join('');
  return '<section class="section guide-groups" data-guide-groups="true" data-guides="true"><h2>Compare these guides next</h2><p class="muted">Use these grouped guide paths to move forward by intent instead of scanning one long undifferentiated list.</p><div class="guide-group-grid">' + rendered + '</div></section>';
}

function renderCityDecisionSupportHtml(verticalKey, city) {
  const vk = String(verticalKey || '').trim().toLowerCase();
  const marketRaw = String((city && (city.marketLabel || city.slug)) || 'this area');
  const market = escapeHtml(marketRaw);
  const config = {
    pi: {
      title: 'What to clarify before you sign anything in ' + market,
      lead: 'The useful version of a PI city page is not just who advertises nearby. It is whether the firm fits the accident type, explains fees clearly, protects evidence early, and sounds careful around insurer contact and case timing.',
      cards: [
        ['Case type and file fit', 'Ask whether the firm regularly handles your kind of case and what makes it stronger or weaker. A serious city page should help readers compare case fit instead of flattening every injury into the same shortlist.'],
        ['Fee and cost clarity', 'Use the city page to slow down around contingency language. The right question is not just whether the consultation is free. It is how fees, costs, liens, and settlement deductions are actually explained before you sign.'],
        ['Evidence and timing', 'Good firms usually ask early about photos, witnesses, records, scene conditions, and treatment timing. If a page never sounds interested in facts, that is useful information.'],
        ['Insurance pressure and statements', 'Many readers need help because insurer calls start before the medical picture is stable. A useful city page should make room for caution around recorded statements, early narratives, and pressure to move too fast.']
      ],
      groups: [
        { heading: 'Start here first', items: [
          { href: '/guides/what-to-do-after-an-accident/', label: 'What to do first' },
          { href: '/guides/evidence-checklist-after-an-accident/', label: 'Evidence checklist' },
          { href: '/guides/questions-to-ask-a-personal-injury-lawyer/', label: 'Questions to ask' },
          { href: '/guides/personal-injury-lawyer-red-flags/', label: 'Lawyer red flags' }
        ]},
        { heading: 'By case type', items: [
          { href: '/guides/car-accidents/', label: 'Car accidents' },
          { href: '/guides/truck-accidents/', label: 'Truck accidents' },
          { href: '/guides/slip-and-fall/', label: 'Slip and fall' },
          { href: '/guides/wrongful-death/', label: 'Wrongful death' }
        ]},
        { heading: 'After you know your direction', items: [
          { href: '/guides/recorded-statements-and-insurance-calls/', label: 'Insurance calls' },
          { href: '/guides/personal-injury-fees-explained/', label: 'Fee guide' },
          { href: '/guides/product-liability/', label: 'Product liability' },
          { href: '/guides/workplace-injuries/', label: 'Workplace injuries' }
        ]}
      ]
    },
    dentistry: {
      title: 'What to clarify before you book in ' + market,
      lead: 'The useful version of a dental city page is not just who is nearby. It is whether the office matches the kind of treatment you need, explains costs cleanly, and knows when specialist care or a second opinion makes more sense.',
      cards: [
        ['Treatment scope and fit', 'Ask whether your issue sounds cosmetic, restorative, periodontal, urgent, or surgical. City pages should help people match the office to the problem instead of forcing every case into the same generic shortlist.'],
        ['Pricing clarity', 'Ask what the estimate includes, what may change after imaging, and which parts of the plan are urgent versus elective. The best dental quotes feel broken into stages, not bundled into one stressful number.'],
        ['Generalist vs specialist', 'Before you book, ask whether this sounds like general dental care or whether an endodontist, periodontist, oral surgeon, or cosmetic-focused provider should weigh in. Fit matters more than broad marketing claims.'],
        ['When to slow down', 'If the plan is expensive, irreversible, or poorly explained, use the city page to pivot into the second-opinion and red-flag guides before committing. Pressure is not proof that treatment is urgent.']
      ],
      groups: [
        { heading: 'Start here first', items: [
          { href: '/guides/how-to-choose/', label: 'How to choose a dentist' },
          { href: '/guides/questions-to-ask/', label: 'Questions to ask' },
          { href: '/guides/dental-red-flags/', label: 'Dental red flags' },
          { href: '/guides/dental-second-opinion/', label: 'Second opinion' }
        ]},
        { heading: 'By treatment type', items: [
          { href: '/guides/dental-implants/', label: 'Dental implants' },
          { href: '/guides/veneers/', label: 'Veneers' },
          { href: '/guides/emergency-dentist-vs-waiting/', label: 'Emergency vs waiting' }
        ]},
        { heading: 'After you know your direction', items: [
          { href: '/faq/', label: 'FAQ hub' }
        ]}
      ]
    },
    neuro: {
      title: 'What to clarify before you book in ' + market,
      lead: 'The useful version of a city page is not just who exists locally. It is whether the evaluation scope, report quality, timing, and follow-up path match the reason you are looking in the first place.',
      cards: [
        ['Pricing and scope', 'Ask whether intake, testing, scoring, report writing, and feedback are included. A lower number is not automatically better if the report or follow-up is too thin to support school, work, or treatment decisions.'],
        ['Report and feedback', 'Confirm what arrives in writing, how long delivery usually takes, and whether someone will walk you through the results in plain language. This matters more than generic claims about comprehensive testing.'],
        ['Records to gather', 'Before you contact anyone, organize prior diagnoses, school or work history, questionnaires, and outside records that could affect scope. Missing context often creates delay or unnecessary repeat testing.'],
        ['What happens next', 'Ask what decisions the evaluation can realistically support after the report: accommodations, therapy referrals, medication follow-up, coaching, or more testing. Good providers explain next steps without overselling certainty.']
      ],
      groups: [
        { heading: 'Start here first', items: [
          { href: '/guides/questions-to-ask-before-neuro-testing/', label: 'Questions to ask' },
          { href: '/guides/neuro-provider-red-flags/', label: 'Provider red flags' },
          { href: '/guides/neuro-evaluation-pricing/', label: 'Pricing' }
        ]},
        { heading: 'By evaluation format', items: [
          { href: '/guides/telehealth-vs-in-person-neuro/', label: 'Telehealth vs in person' },
          { href: '/guides/what-a-neuro-report-includes/', label: 'Report contents' },
          { href: '/guides/what-to-expect-after-a-neuro-evaluation/', label: 'After the evaluation' }
        ]},
        { heading: 'After you know your direction', items: [
          { href: '/guides/neuro-insurance-and-out-of-network/', label: 'Insurance / out of network' }
        ]}
      ]
    },
    trt: {
      title: 'What to clarify before you book in ' + market,
      lead: 'The useful version of a TRT city page is not just which clinic is nearby. It is whether the clinic explains candidacy, labs, risks, and the difference between hormone, peptide, IV, or weight-loss style offers clearly enough to trust the shortlist.',
      cards: [
        ['Candidacy and diagnosis', 'Ask what symptoms, labs, and history are being used before anyone recommends treatment. A strong city page should help you compare clinics on evaluation discipline, not just on convenience.'],
        ['Labs and monitoring', 'Use the city page to compare what is included before treatment starts and what follow-up exists after it starts. Real clinic differences show up in monitoring, not just in marketing claims.'],
        ['TRT vs adjacent services', 'Some clinics bundle TRT, peptides, IV hydration, weight loss, and hair services together. The right question is whether the clinic can explain why one path fits better than another instead of routing every reader into the same sale.'],
        ['When to slow down', 'If pricing is vague, side effects are minimized, or the page sounds universally optimistic, use the guides below before booking. Pressure is not proof that treatment fit is strong.']
      ],
      groups: [
        { heading: 'Start here first', items: [
          { href: '/guides/testosterone-replacement-therapy-overview/', label: 'TRT overview' },
          { href: '/guides/who-is-a-good-candidate-for-trt/', label: 'TRT candidacy' },
          { href: '/guides/trt-pricing-and-labs/', label: 'TRT pricing' },
          { href: '/guides/trt-red-flags/', label: 'TRT red flags' }
        ]},
        { heading: 'By treatment type', items: [
          { href: '/guides/iv-hydration-therapy-overview/', label: 'IV hydration overview' },
          { href: '/guides/testosterone-and-hair-loss-explained/', label: 'Hair restoration context' },
          { href: '/guides/peptides-vs-trt/', label: 'Peptides vs TRT' },
          { href: '/guides/medical-weight-loss-programs-overview/', label: 'Medical weight loss overview' }
        ]},
        { heading: 'After you know your direction', items: [
          { href: '/guides/trt-side-effects-and-safety/', label: 'TRT side effects and safety' },
          { href: '/guides/peptide-program-costs/', label: 'Peptide program costs' },
          { href: '/guides/iv-hydration-red-flags/', label: 'IV hydration red flags' }
        ]}
      ]
    },
    uscis_medical: {
      title: 'What to confirm before you schedule in ' + market,
      lead: 'The useful version of a city page is not just where a civil surgeon is located. It is what the office includes, what you need to bring, and how the paperwork handoff actually works.',
      cards: [
        ['Authorization and exam scope', 'Confirm the office is a USCIS-designated civil surgeon and ask what the quoted visit actually covers. Some offices bundle paperwork and basic steps; others price parts separately.'],
        ['Documents and records', 'Ask for the office checklist before you book. Identification, vaccination records, and clinic-specific instructions matter more than generic internet lists when timing is tight.'],
        ['Turnaround and delays', 'Ask when the sealed paperwork or pickup instructions should be ready, what delays are common, and what happens if additional follow-up items are needed after the appointment.'],
        ['After the appointment', 'Before you leave, clarify how the office handles final paperwork, whether anything else is pending, and what instructions apply to your next immigration filing step.']
      ],
      groups: [
        { heading: 'Start here first', items: [
          { href: '/guides/uscis-medical-exam-overview/', label: 'Exam overview' },
          { href: '/guides/i-693-medical-exam-requirements/', label: 'I-693 requirements' },
          { href: '/guides/document-checklist/', label: 'Document checklist' },
          { href: '/guides/questions-to-ask-a-civil-surgeon/', label: 'Questions to ask' }
        ]},
        { heading: 'By situation', items: [
          { href: '/guides/uscis-vaccination-requirements/', label: 'Vaccination requirements' },
          { href: '/guides/costs-and-timeframes/', label: 'Costs and timeframes' }
        ]},
        { heading: 'After you know your direction', items: [
          { href: '/guides/after-your-exam-next-steps/', label: 'After-exam next steps' }
        ]}
      ]
    }
  };
  const entry = config[vk];
  if (!entry) return '';
  const attrMap = {
    pi: ['data-city-case-fit-clarity="true"', 'data-city-fee-clarity="true"', 'data-city-evidence-timing="true"', 'data-city-insurance-caution="true"'],
    dentistry: ['data-city-treatment-scope="true"', 'data-city-pricing-clarity="true"', 'data-city-specialist-fit="true"', 'data-city-second-opinion-check="true"'],
    neuro: ['data-city-pricing-expectations="true"', 'data-city-report-expectations="true"', 'data-city-records-expectations="true"', 'data-city-next-step-expectations="true"'],
    trt: ['data-city-candidacy-clarity="true"', 'data-city-monitoring-clarity="true"', 'data-city-treatment-selection="true"', 'data-city-trust-checks="true"'],
    uscis_medical: ['data-city-authorization-check="true"', 'data-city-document-check="true"', 'data-city-turnaround-check="true"', 'data-city-after-exam-check="true"']
  };
  const attrs = attrMap[vk] || [];
  const cards = entry.cards.map((item, idx) => '<div class="card" data-city-support-card="' + escapeHtml(String(idx + 1)) + '" ' + (attrs[idx] || '') + '><h3>' + escapeHtml(item[0]) + '</h3><p>' + escapeHtml(item[1]) + '</p></div>').join('');
  return (
    '<section class="section" data-city-decision-support="true" data-city-decision-support-vertical="' + escapeHtml(vk) + '">' +
      '<h2>' + entry.title + '</h2>' +
      '<p class="muted">' + escapeHtml(entry.lead) + '</p>' +
      '<div class="grid-2">' + cards + '</div>' +
    '</section>' +
    renderGuideGroupsHtml(entry.groups).replace('data-guide-groups="true"', 'data-guide-groups="true" data-city-decision-links="true"')
  );
}

function inferProviderCategory(verticalKey, subKey, provider) {
  const explicit = String((provider && provider.category) || '').trim();
  if (explicit) return explicit;
  const vk = String(verticalKey || '').toLowerCase();
  const sk = String(subKey || '').toLowerCase();
  if (vk === 'pi') return 'Personal injury law firm';
  if (vk === 'dentistry') return 'Dental provider';
  if (vk === 'neuro') return sk === 'autism_eval' ? 'Autism evaluation provider' : 'Neuro evaluation provider';
  if (vk === 'trt') return sk === 'iv_hydration' ? 'IV hydration clinic' : (sk === 'hair_restoration' ? 'Hair restoration provider' : 'Hormone optimization clinic');
  if (vk === 'uscis_medical' || vk === 'uscis') return 'Civil surgeon / immigration medical exam provider';
  return 'Provider';
}

function defaultProviderAttributes(verticalKey, subKey, provider, city) {
  const attrs = Array.isArray(provider && provider.attributes) ? provider.attributes.map((v) => String(v || '').trim()).filter(Boolean) : [];
  if (provider && provider.offers_therapy === true) attrs.push('Offers therapy follow-up');
  if (provider && provider.offers_peptide_programs === true) attrs.push('May also offer peptide programs');
  const vk = String(verticalKey || '').toLowerCase();
  const sk = String(subKey || '').toLowerCase();
  if (vk === 'pi') {
    attrs.push('Use the city page to compare fit, fees, and case handling');
    attrs.push('Verify license and disciplinary history before you contact any firm');
  } else if (vk === 'dentistry') {
    attrs.push('Compare treatment scope, written plan clarity, and follow-up expectations');
    attrs.push('Verify dental licensing through the official state resource');
  } else if (vk === 'neuro') {
    attrs.push(sk === 'autism_eval' ? 'Use this when you are comparing autism evaluation options' : 'Use this when you are comparing ADHD / neuro evaluation options');
    attrs.push('Ask what the report, testing scope, and feedback session actually include');
  } else if (vk === 'trt') {
    attrs.push(sk === 'iv_hydration' ? 'Compare IV protocols, pricing, and supervision' : 'Compare evaluation steps, monitoring, and follow-up clarity');
    attrs.push('Ask what is included before treatment starts and what is billed separately');
  } else if (vk === 'uscis_medical' || vk === 'uscis') {
    attrs.push('Confirm documents, vaccination records, and sealed-form handling before you book');
    attrs.push('Verify current civil-surgeon status and ask how paperwork is returned');
  } else {
    attrs.push('Use the guide layer before you contact any provider');
  }
  return Array.from(new Set(attrs)).slice(0, 4);
}

function normalizeProviderCard(verticalKey, subKey, provider, city, verifyUrl) {
  const locationCity = String((provider && provider.city) || (city && city.city) || '').trim();
  const locationState = String((provider && provider.state) || (city && city.state) || '').trim().toUpperCase();
  return {
    name: String((provider && provider.name) || '').trim(),
    city: locationCity,
    state: locationState,
    category: inferProviderCategory(verticalKey, subKey, provider),
    attributes: defaultProviderAttributes(verticalKey, subKey, provider, city),
    verifyUrl: normalizeUrl(verifyUrl || '')
  };
}

function renderStructuredProviderCardsSectionHtml(opts) {
  const heading = escapeHtml(String((opts && opts.heading) || 'Examples of providers'));
  const lead = String((opts && opts.lead) || '').trim();
  const cards = Array.isArray(opts && opts.cards) ? opts.cards : [];
  const preview = opts && opts.preview === true;
  const verifyUrl = normalizeUrl((opts && opts.verifyUrl) || '');
  if (!cards.length) return '';
  return (
    '<section class="section provider-directory-section' + (preview ? ' provider-directory-section--preview' : '') + '" data-provider-directory="true"' + (preview ? ' data-home-provider-preview="true"' : '') + '>' +
      '<h2>' + heading + '</h2>' +
      (lead ? ('<p class="muted">' + lead + '</p>') : '') +
      '<div class="provider-directory-grid">' +
      cards.map((card) => {
        const attrs = (Array.isArray(card.attributes) ? card.attributes : []).slice(0, 4).map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
        const meta = [card.category, [card.city, card.state].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
        return (
          '<article class="provider-card" data-provider-card="true">' +
            '<h3 class="provider-card__name">' + escapeHtml(card.name) + '</h3>' +
            '<p class="provider-card__meta" data-provider-card-meta="true">' + escapeHtml(meta) + '</p>' +
            '<ul class="provider-card__attributes" data-provider-card-attributes="true">' + attrs + '</ul>' +
            (verifyUrl ? ('<p class="provider-card__verify"><a href="' + escapeHtml(verifyUrl) + '" rel="nofollow">Verify license / registry</a></p>') : '') +
          '</article>'
        );
      }).join('') +
      '</div>' +
    '</section>'
  );
}

function renderHomepageFaqEntryHtml(brandName) {
  const safeBrand = escapeHtml(String(brandName || 'this site'));
  return (
    '<section class="section faq-entry-card" data-home-faq-entry="true">' +
      '<h2>Need quick answers first?</h2>' +
      '<p class="muted">Use the FAQ when you want definitions, costs, timing questions, and fast clarification before you open a state page.</p>' +
      '<p class="actions"><a class="button button-secondary" href="/faq/">Open the FAQ for ' + safeBrand + '</a></p>' +
    '</section>'
  );
}

function buildRequestCityHref(brandName, stateName) {
  const subject = 'Add my city to ' + String(brandName || 'this guide') + ' — ' + String(stateName || '').trim();
  const body = 'Hi — please add this city: ';
  return 'mailto:info@spry.vc?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}

function renderStateCityGridHtml(stateName, cityLinks) {
  const cards = (Array.isArray(cityLinks) ? cityLinks : []).map((item) =>
    '<a class="state-city-card" href="' + escapeHtml(String(item.href || '#')) + '"><span class="state-city-card__name">' + escapeHtml(String(item.label || 'City')) + '</span><span class="state-city-card__meta">City page</span></a>'
  ).join('');
  return (
    '<section class="section state-cities-block" data-covered-cities="true">' +
      '<h2>Cities we cover in ' + escapeHtml(String(stateName || 'this state')) + '</h2>' +
      '<div class="state-city-grid">' + cards + '</div>' +
    '</section>'
  );
}

function renderRequestCitySectionHtml(brandName, stateName) {
  const href = buildRequestCityHref(brandName, stateName);
  return (
    '<section class="section request-city-block" data-request-city="true">' +
      '<h2>Don’t see your city yet?</h2>' +
      '<p class="muted">Tell us which city you want added and we\'ll add it here.</p>' +
      '<p class="actions"><a class="button button-secondary" href="' + escapeHtml(href) + '">Request your city</a></p>' +
    '</section>'
  );
}

function collectHomepageProviderPreviewCards(verticalKey, pageSet, brandName) {
  const vk = String(verticalKey || '').toLowerCase();
  const cities = loadCities(pageSet, verticalKey).slice(0, 12);
  const cards = [];
  if (vk === 'pi') {
    for (const city of cities) {
      const listingPath = path.join(DATA_DIR, 'listings', city.slug + '.json');
      if (!fs.existsSync(listingPath)) continue;
      const raw = readJson(listingPath);
      const listings = Array.isArray(raw) ? raw : (Array.isArray(raw.listings) ? raw.listings : []);
      for (const item of listings) {
        if (!item || !item.name) continue;
        cards.push(normalizeProviderCard(verticalKey, '', { name: item.name, category: 'Personal injury law firm', city: city.city, state: city.state, attributes: ['City directory example', 'Use the city page to compare case fit and fee clarity'] }, city, ''));
        if (cards.length >= 4) break;
      }
      if (cards.length >= 4) break;
    }
  } else {
    for (const city of cities) {
      const lists = loadExampleProviderLists(verticalKey, city.slug) || [];
      for (const entry of lists) {
        for (const provider of entry.providers || []) {
          const verifyRow = (loadLicensingLookup(verticalKey) || {})[String(city.state || '').toUpperCase()] || {};
          const verifyUrl = verifyRow.license || verifyRow.url || city.licenseLookupUrl || '';
          cards.push(normalizeProviderCard(verticalKey, entry.subKey || '', provider, city, verifyUrl));
          if (cards.length >= 4) break;
        }
        if (cards.length >= 4) break;
      }
      if (cards.length >= 4) break;
    }
  }
  const leadMap = {
    pi: 'These are neutral, non-ranked examples of local firms to make the homepage feel grounded before you narrow into a state or city page.',
    dentistry: 'These are neutral, non-ranked examples of dental providers so the homepage feels concrete before you narrow into a state or city page.',
    neuro: 'These are neutral, non-ranked examples of evaluation providers so the homepage feels concrete before you narrow into a state or city page.',
    trt: 'These are neutral, non-ranked examples of clinics and providers so the homepage feels concrete before you narrow into a state or city page.',
    uscis_medical: 'These are neutral, non-ranked examples of civil surgeons and immigration medical exam providers so the homepage feels concrete before you narrow into a state or city page.'
  };
  if (!cards.length) return '';
  return renderStructuredProviderCardsSectionHtml({
    heading: 'Examples of providers',
    lead: leadMap[vk] || 'These are neutral, non-ranked examples to ground the page before you narrow into a state or city page.',
    cards,
    preview: true,
    verifyUrl: ''
  });
}

function renderExampleProvidersSectionHtml(verticalKey, city, providers, opts) {
  if (!providers || providers.length === 0) return '';
  const marketRaw = String(city.marketLabel || city.slug || 'this market');
  const market = escapeHtml(marketRaw);
  const verifyLookup = loadLicensingLookup(verticalKey) || {};
  const verifyRow = verifyLookup[String(city.state || '').toUpperCase()] || {};
  const verifyUrl = verifyRow.license || verifyRow.url || city.licenseLookupUrl || '';
  const heading = (opts && opts.heading) ? String(opts.heading) : ('Examples of providers in ' + marketRaw);
  const lead = (opts && opts.lead) ? String(opts.lead) : 'These are non-ranked, non-sponsored examples of providers that help show what exists locally. Use the guide layer and official verification resources before you contact anyone.';
  const cards = providers.map((provider) => normalizeProviderCard(verticalKey, opts && opts.subKey || '', provider, city, verifyUrl));
  return renderStructuredProviderCardsSectionHtml({ heading, lead, cards, verifyUrl });
}


function reorderMainSections(html, mode) {
  html = String(html || '');
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!mainMatch) return html;
  const mainInner = mainMatch[1];
  const blockRe = /<(section|details)\b[\s\S]*?<\/\1>/gi;
  const blocks = mainInner.match(blockRe) || [];
  if (!blocks.length) return html;

  const used = new Set();
  function take(predicate) {
    const idx = blocks.findIndex((b, i) => !used.has(i) && predicate(b));
    if (idx === -1) return '';
    used.add(idx);
    return blocks[idx];
  }
  function takeAll(predicate) {
    const out = [];
    blocks.forEach((b, i) => {
      if (!used.has(i) && predicate(b)) { used.add(i); out.push(b); }
    });
    return out;
  }
  function rest() {
    return blocks.filter((_, i) => !used.has(i));
  }

  let ordered = [];
  if (mode === 'home') {
    ordered = [
      take(b => /<section class="hero"/.test(b)),
      take(b => /data-primary-conversion-cta="true"/.test(b)),
      take(b => /data-home-answer="true"/.test(b) || /data-short-answer="true"/.test(b)),
      take(b => /data-home-about-block="true"/.test(b)),
      take(b => /data-home-provider-preview="true"/.test(b)),
      take(b => /data-home-faq-entry="true"/.test(b)),
      take(b => /data-home-state-grid-shell="true"/.test(b)),
      take(b => /data-inline-conversion-cta="true"/.test(b)),
      ...takeAll(b => /data-sponsored-placement="mid"/.test(b) || /data-sponsor-stack="global_home_mid"/.test(b)),
      ...takeAll(b => /tertiary-support/.test(b) || /fanout-query-cluster/.test(b) || /data-sponsored-placement="tertiary"/.test(b)),
      ...rest()
    ].filter(Boolean);
  } else if (mode === 'state') {
    ordered = [
      take(b => /<section class="hero"/.test(b)),
      ...takeAll(b => /data-sponsored-placement="top"/.test(b)),
      take(b => /data-short-answer="true"/.test(b) || /data-citation-summary-type="state-home"/.test(b)),
      take(b => /data-primary-conversion-cta="true"/.test(b)),
      take(b => /data-state-authority-block="true"/.test(b)),
      ...takeAll(b => /data-guides-micro="true"/.test(b) || /data-start-here="true"/.test(b)),
      ...takeAll(b => /data-sponsored-placement="mid"/.test(b)),
      ...takeAll(b => /data-covered-cities="true"/.test(b)),
      take(b => /data-request-city="true"/.test(b)),
      take(b => /state-guides-support/.test(b)),
      ...takeAll(b => /data-pi-state-faq="true"/.test(b) || /data-disciplinary-lookup="true"/.test(b)),
      ...takeAll(b => /tertiary-support/.test(b) || /fanout-query-cluster/.test(b)),
      take(b => /data-inline-conversion-cta="true"/.test(b)),
      ...rest()
    ].filter(Boolean);
  } else if (mode === 'city') {
    ordered = [
      take(b => /<section class="hero"/.test(b)),
      ...takeAll(b => /data-sponsored-placement="top"/.test(b)),
      take(b => /data-primary-conversion-cta="true"/.test(b)),
      take(b => /data-short-answer="true"/.test(b) || /data-citation-summary-type="city-home"/.test(b)),
      take(b => /How people typically evaluate/.test(b) || /data-eval-framework="true"/.test(b)),
      take(b => /data-localized-conclusion="true"/.test(b)),
      take(b => /data-city-decision-support="true"/.test(b)),
      ...takeAll(b => /data-sponsored-placement="mid"/.test(b)),
      take(b => /data-llm-bait="question"/.test(b)),
      ...takeAll(b => /data-provider-directory="true"/.test(b) || /data-pi-home-directory="true"/.test(b) || /data-example-providers="true"/.test(b)),
      take(b => /data-guide-groups="true"/.test(b)),
      ...takeAll(b => /Verify a provider/.test(b) || /guides-compact/.test(b) || /data-start-here="true"/.test(b) || /data-faq="true"/.test(b)),
      ...takeAll(b => /data-sponsored-placement="bottom"/.test(b)),
      ...takeAll(b => /fanout-query-cluster/.test(b) || /tertiary-support/.test(b)),
      take(b => /data-inline-conversion-cta="true"/.test(b)),
      ...rest()
    ].filter(Boolean);
  } else if (mode === 'guides-hub') {
    ordered = [
      take(b => /<section class="hero"/.test(b)),
      take(b => /data-short-answer="true"/.test(b) || /data-citation-summary-type="guides-hub"/.test(b)),
      take(b => /data-primary-conversion-cta="true"/.test(b)),
      take(b => /data-inline-conversion-cta="true"/.test(b)),
      ...rest()
    ].filter(Boolean);
  } else {
    return html;
  }

  const newMain = mainMatch[0].replace(mainInner, '\n' + ordered.join('\n\n') + '\n');
  return html.replace(mainMatch[0], newMain);
}

function renderPage(baseTemplate, footerHtml, connectionBubbleTemplate, primaryConversionTemplate, inlineConversionTemplate, page, city, siteUrl, brandName, pageSet, sponsorsByStack, sponsor, listings, ads, verticalKey) {
  const route = applyCityTokens(page.route || "", city).replace(/^\/+|\/+$/g, "");
  const title = applyCityTokens(page.title, city).split("%%MARKET_LABEL%%").join(city.marketLabel);
  const description = applyCityTokens(page.description, city).split("%%MARKET_LABEL%%").join(city.marketLabel);
  const globalPagesDir = loadGlobalPagesDir(pageSet);

  let mainHtml = applyCityTokens(page.main_html, city);

  // Sponsor tokens (used by PI next-steps page; safe on all pages)
  const __sponsor = (sponsor || {});
  const __sponsorLive = (sponsorship.shouldRenderNextSteps(pageSet) && sponsorship.isSponsorLive(__sponsor));
  const __sponsorName = __sponsor.firm_name || __sponsor.name || '';
  mainHtml = mainHtml
    .split("%%SPONSOR_FIRM_NAME%%").join(__sponsorLive ? escapeHtml(String(__sponsorName)) : "")
    .split("%%SPONSOR_OFFICIAL_SITE_URL%%").join(__sponsorLive ? escapeHtml(String(normalizeUrl(__sponsor.official_site_url))) : "")
    .split("%%SPONSOR_INTAKE_URL%%").join(__sponsorLive ? escapeHtml(String(normalizeUrl(__sponsor.intake_url))) : "");

  // Inject canonical evaluation framework (AI-safe) on city hub pages
  if (route === '' && mainHtml.includes("%%EVAL_FRAMEWORK%%")) {
    mainHtml = mainHtml.split("%%EVAL_FRAMEWORK%%").join(
      renderLLMBaitQuestionHtml(verticalKey, city) +
      renderEvalFrameworkHtml(verticalKey, city) +
      renderLocalizedConclusionHtml(verticalKey, city) +
      renderCityDecisionSupportHtml(verticalKey, city)
    );
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
    mainHtml = mainHtml.replace(/<section class="section guides-compact"[\s\S]*?<\/section>\s*/g, '');
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

  if (route === '') {
    mainHtml = injectPrimaryConversionCta(mainHtml, primaryConversionTemplate, verticalKey, {
      pageType: 'city-primary',
      src: '/' + city.slug + '/',
      marketLabel: city.marketLabel || '',
      intentType: 'direct_match',
      buttonSource: 'primary_cta'
    });
    mainHtml = injectInlineConversionCta(mainHtml, inlineConversionTemplate, verticalKey, {
      pageType: 'city-inline',
      src: '/' + city.slug + '/',
      marketLabel: city.marketLabel || '',
      intentType: 'decision_hub',
      buttonSource: 'next_steps_cta'
    });
  }


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
          lead = 'Below are non-exhaustive examples of nearby providers that offer this service. Some listed clinics may also offer peptide programs. Confirm services, supervision, pricing, and follow-up directly with the clinic. This list is provided for educational context only and is not a recommendation, ranking, or endorsement.';
        }

        if (v === 'neuro') {
          if (s === 'adhd_eval') heading = 'Examples of ADHD evaluation providers in ' + market;
          else if (s === 'autism_eval') heading = 'Examples of autism evaluation providers in ' + market;
          lead = 'Below are non-exhaustive examples of nearby providers that offer evaluation services. Some listed providers may also offer therapy. Confirm services, age range, wait times, insurance, and follow-up care directly with the provider. This list is provided for educational context only and is not a recommendation, ranking, or endorsement.';
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

  if (route === '' && !mainHtml.includes('data-citation-summary="true"')) {
    const verticalLabelMap = {
      dentistry: 'dentistry and dental-provider',
      neuro: 'neuropsychology and evaluation-provider',
      trt: 'TRT, peptide, IV therapy, and clinic',
      uscis: 'USCIS medical-exam and civil-surgeon',
      uscis_medical: 'USCIS medical-exam and civil-surgeon',
      pi: 'personal-injury lawyer'
    };
    const officialResources = getNonPiResourcesForState(verticalKey, city.state, pageSet);
    const officialPrimary = officialResources && officialResources.length ? officialResources[0] : null;
    const citationSummaryHtml = renderCitationSummaryZoneHtml({
      kind: 'city-home',
      title,
      description,
      marketLabel: city.marketLabel,
      verticalLabel: verticalLabelMap[String(verticalKey || '').toLowerCase()] || 'local service',
      officialResourceName: officialPrimary && officialPrimary.name ? officialPrimary.name : 'official state verification source',
      officialResourceUrl: officialPrimary && officialPrimary.url ? normalizeUrl(officialPrimary.url) : '',
      hrefs: {
        guides: '/guides/',
        faq: '/faq/',
        methodology: '/methodology/',
        requestAssistance: '/request-assistance/'
      }
    });
    if (mainHtml.includes('<section class="hero"')) {
      mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/, '$1\n' + citationSummaryHtml);
    } else {
      mainHtml = citationSummaryHtml + '\n' + mainHtml;
    }
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

  // Normalize golden markers on the *final* city hub HTML (templates may omit these attrs).
  // FAQ marker
  html = html.replace(/(<details[^>]*id="city-faq"[^>]*)(>)/, (m, a, b) => {
    if (/data-faq=/i.test(a)) return m;
    return `${a} data-faq="true"${b}`;
  });

  // State lookup marker (accept legacy data-state-lookup-cta too, but ensure one stable marker)
  html = html.replace(/(<details[^>]*id="state-lookup"[^>]*)(>)/, (m, a, b) => {
    if (/data-state-lookup=/i.test(a) || /data-state-lookup-cta=/i.test(a)) return m;
    return `${a} data-state-lookup="true"${b}`;
  });

  // Guides marker (attach to the Guides section wrapper)
  html = html.replace(/(<section[^>]*)(>\s*<h2>Guides<\/h2>)/, (m, a, b) => {
    if (/data-guides=/i.test(a)) return m;
    return `${a} data-guides="true"${b}`;
  });

  return html;
}

    mainHtml = stripForbiddenInlineBlocks(mainHtml);

  const cityFanoutCluster = fanout.buildFanoutCluster({
    verticalKey,
    pageKind: "city",
    route: route ? `/${city.slug}/${route}/` : `/${city.slug}/`,
    title,
    marketLabel: city.marketLabel
  }, pageSet);
  const cityFanoutHtml = fanout.renderFanoutClusterHtml(cityFanoutCluster);
  if (route !== 'next-steps' && cityFanoutHtml && !mainHtml.includes('data-fanout-query-cluster="true"')) {
    mainHtml += "\n" + cityFanoutHtml;
  }

// Next-steps zone injection (global buyout OR sponsor-driven)
  // - Global: pack-controlled via sponsorship.globalNextStepsEnabled
  // - Sponsor-driven: pack sponsorship.nextStepsEnabled + sponsor live
  if (route === 'next-steps') {
    mainHtml = renderDedicatedNextStepsHubHtml({
      marketLabel: city.marketLabel || city.slug,
      pageTitle: title,
      compareHref: buildTrackedHref('/guides/', { intent: 'decision_hub', button: 'next_steps_page_compare', vertical: verticalKey, page_kind: 'next_steps', page_slug: city.slug + '-next-steps', market: city.slug }),
      toolsHref: buildTrackedHref('/faq/', { intent: 'self_serve', button: 'next_steps_page_tools', vertical: verticalKey, page_kind: 'next_steps', page_slug: city.slug + '-next-steps', market: city.slug }),
      requestAssistanceHtml: extractRequestAssistanceHtml(pageSet)
    });
    if (cityFanoutHtml && !mainHtml.includes('data-fanout-query-cluster="true"')) {
      mainHtml += "\n" + cityFanoutHtml;
    }
  }

  mainHtml = injectAdPlacements(mainHtml, ads, { city: city, verticalKey: verticalKey, cityFeatures: (pageSet && pageSet.__cityFeatures) ? pageSet.__cityFeatures : null });
  mainHtml = injectSponsors(mainHtml, sponsorsByStack);
  mainHtml = injectListings(mainHtml, listings, city, sponsor || {}, pageSet);

  // City hub invariants (golden contracts): ensure required blocks/markers exist in final HTML.
  // IMPORTANT: run AFTER ad/listings injection so we can de-dupe final sponsor stacks.
  if (typeof route === "string" && route === "" && typeof ensureCityHubRequiredBlocks === "function") {
    mainHtml = ensureCityHubRequiredBlocks(mainHtml, verticalKey, city);
  }

  const inline = renderInlineScripts(page.inline_scripts || [], city);

  const connectionBubbleHtml = shouldRenderConnectionBubble({ pageKind: 'city', route })
    ? renderConnectionBubbleHtml(connectionBubbleTemplate, verticalKey, { src: '/' + city.slug + '/' })
    : '';

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
    "%%HEAD_META%%": renderHeadMeta({ pageType: route === "" ? "city-home" : "city-detail", title, description, canonical: buildCanonical(siteUrl, city, route), brandName, section: route === "" ? "City home" : "City detail", keywords: [city.city, city.state, verticalKey] }),
    "%%HEAD_JSON_LD%%": renderHeadJsonLd(siteUrl, brandName, city, route, title, description, pageSet, verticalKey, listings),
    "%%FOOTER%%": footerHtml,
    "%%CONNECTION_BUBBLE%%": connectionBubbleHtml,
    "%%BRAND_NAME%%": escapeHtml(brandName)
    ,"%%OPTIONAL_TOP_NAV%%": (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
  });
  // Last-mile safety: ensure footer disclosure exists on every page.
  // Some regressions have produced city pages without the shared footer injection.
  let out = mapped;
  out = reorderMainSections(out, route === '' ? 'city' : '');
  if (!out.includes('<footer') || !out.includes('Advertising disclosure.') || !out.includes('No guarantees or endorsements.')) {
    // Inject footerHtml immediately before </body> if missing.
    out = out.replace(/<\/body>/i, "\n" + footerHtml + "\n</body>");
  }
  return out;
}

function renderGlobalPage(baseTemplate, footerHtml, connectionBubbleTemplate, primaryConversionTemplate, inlineConversionTemplate, globalPage, siteUrl, brandName, pageSet, globalSponsorsByStack, marketsStatusListHtml, ads, verticalKey) {
  const route = (globalPage.route || "").replace(/^\/+|\/+$/g, "");
  const title = String(globalPage.title || "").split("%%BRAND_NAME%%").join(brandName);
  const description = String(globalPage.description || "");
  const globalPagesDir = loadGlobalPagesDir(pageSet);
  const distributionCities = loadCities(pageSet, verticalKey).slice(0, 5);

  let mainHtml = String(globalPage.main_html || "").split("%%BRAND_NAME%%").join(brandName);

  // --- GUIDE DETAIL CONTRACT (SEV-1 REGRESSION GUARD) ---
  // Guides must be block-structured and must include ad slots.
  // We intentionally enforce this at build-time so a flat/unstyled guide JSON
  // cannot silently ship even if authored incorrectly.
  function enhanceGuideDetailHtml(rawHtml) {
    let out = String(rawHtml || "");

    // Normalize legacy "heading-like" paragraphs into real headings so guides
    // across packs render with consistent section blocks.
    // (We do NOT change the words; we only change the tag wrapper.)
    function promoteParagraphHeadings(html) {
      const isAllCaps = (s) => {
        const t = String(s || '').trim();
        if (!/[A-Z]/.test(t)) return false;
        // Ignore strings that are mostly punctuation.
        const letters = t.replace(/[^A-Za-z]/g, '');
        if (!letters) return false;
        return letters === letters.toUpperCase();
      };

      return String(html || '').replace(/<p>\s*([^<]+?)\s*<\/p>/g, (m, inner) => {
        const t = String(inner || '').trim();
        const len = t.length;
        if (len < 3 || len > 90) return m;

        // All-caps labels (often used as headings in older PI guides).
        if (isAllCaps(t)) {
          return `<h2>${t}</h2>`;
        }

        // Short colon-ended labels (e.g., "Primary question people ask:").
        if (/:\s*$/.test(t) && len <= 80) {
          return `<h3>${t}</h3>`;
        }

        // Common title-case labels.
        if (/^(Authority Note|Key Takeaways|Quick Answer|What\s+to\s+do\s+next)$/i.test(t)) {
          return `<h3>${t}</h3>`;
        }

        return m;
      });
    }

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

    // 2.5) Promote heading-like paragraphs before we build section blocks.
    out = promoteParagraphHeadings(out);

    // 3) Block structure (wrap legacy flat guides)
    // If the guide body has NO section blocks, we deterministically wrap by heading groups.
    // NOTE: we cannot rely on newlines; some guide HTML is single-line.
    const sectionCount = (out.match(/class="section\b/gi) || []).length;

    // If sections exist but are not yet marked as guide sections, upgrade them in-place.
    // This lets older guides (some packs) pick up the same guide styling.
    if (sectionCount > 0 && !out.includes('data-guide-section="true"')) {
      out = out.replace(
        /<section class="section\b([^"]*)"/gi,
        '<section class="section guide-section$1" data-guide-section="true"'
      );
    }

    // Ensure an outer article wrapper exists around guide body (after TOP token).
    // This unifies layout across packs even when guides already contain sections.
    if (!out.includes('class="guide-article"')) {
      const TOP = '%%AD:global_guide_top%%';
      const BOT = '%%AD:global_guide_bottom%%';
      const iTop = out.indexOf(TOP);
      if (iTop !== -1 && !out.includes('data-guide-layout="v1"')) {
        const head = out.slice(0, iTop + TOP.length);
        let body = out.slice(iTop + TOP.length);
        // Keep bottom token out of the wrapper so it stays predictable.
        const parts = body.split(BOT);
        const bodyCore = parts[0] || '';
        const tail = (parts.length > 1) ? (BOT + parts.slice(1).join(BOT)) : '';
        const wrapped =
          '\n\n<article class="guide-article" data-guide-layout="v1">\n' +
          bodyCore.trim() +
          '\n</article>\n\n';
        out = head + wrapped + tail;
      }
    }
    if (sectionCount === 0 && !out.includes('data-guide-section="true"')) {
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
          // No headings — build readable blocks without changing copy.
          // We only segment by existing block-level elements and wrap them.
          const cleaned = body.trim();
          if (cleaned) {
            const segRe = /<(p|ul|ol|blockquote|table|pre)\b[\s\S]*?<\/\1>/gi;
            const segs = [];
            let m;
            while ((m = segRe.exec(cleaned))) segs.push(m[0]);

            if (segs.length >= 2) {
              for (const seg of segs) {
                blocks.push(
                  '<section class="section guide-section" data-guide-section="true">\n' +
                  seg +
                  '\n</section>'
                );
              }
            } else {
              blocks.push(
                '<section class="section guide-section" data-guide-section="true">\n' +
                cleaned +
                '\n</section>'
              );
            }
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
    if (!out.includes('data-guide-opening="true"')) {
      const guideOpeningBlock =
        '<section class="section guide-section guide-opening-block answer-block" data-guide-section="true" data-guide-opening="true">' +
        '<h2>What this guide is best for</h2>' +
        '<p data-guide-opening-direct="true"><strong>Direct answer:</strong> Use this guide when you need one clear comparison or caution explained before you contact anyone.</p>' +
        '<p class="answer-when" data-guide-opening-when="true"><strong>Best used when:</strong> a city or state page is too broad and you need one cleaner decision path.</p>' +
        '</section>';
      out = out.replace(/(<article class="guide-article"[^>]*>)/i, '$1\n' + guideOpeningBlock + '\n');
    }

    if (!out.includes('data-guide-comparison="true"')) {
      const groupedLinks = renderGuideGroupsHtml(buildGuideDecisionGroups(route, globalPagesDir))
        .replace('class="section guide-groups"', 'class="section guide-groups comparison-block"')
        .replace('data-guide-groups="true"', 'data-guide-groups="true" data-guide-comparison="true"');
      out = out.replace(/\s*%%AD:global_guide_bottom%%\s*/i, '\n\n' + groupedLinks + '\n\n%%AD:global_guide_bottom%%\n');
    }

    return out;
  }

  // Guide pages (global): enforce the full guide contract (hero + ads + blocks + LLM bait).
  if (route.startsWith("guides/") && route !== "guides") {
    mainHtml = enhanceGuideDetailHtml(mainHtml, route, globalPagesDir);
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
  if (mainHtml.includes("%%STATE_GRID%%")) {
    mainHtml = mainHtml.split("%%STATE_GRID%%").join('<div class="state-card-grid" data-home-state-grid="true">' + (marketsStatusListHtml || '') + '</div>');
  }
  if (route === '' && mainHtml.includes("%%HOME_PROVIDER_PREVIEW%%")) {
    mainHtml = mainHtml.split("%%HOME_PROVIDER_PREVIEW%%").join(collectHomepageProviderPreviewCards(verticalKey, pageSet, brandName));
  }
  if (route === '' && mainHtml.includes("%%HOME_FAQ_ENTRY%%")) {
    mainHtml = mainHtml.split("%%HOME_FAQ_ENTRY%%").join(renderHomepageFaqEntryHtml(brandName));
  }
  if (route === '') {
    if (false && !mainHtml.includes('data-distribution-priority-block="true"')) {
      const globalDistributionHtml = renderInternalDistributionZoneHtml({
        kind: 'home',
        title,
        buildIso: BUILD_ISO,
        guideLinks: selectPriorityGuideSummaries(globalPagesDir, 6).map((g) => ({ href: g.route, label: g.title, description: g.description })),
        primaryLinks: [
          { href: '/guides/', label: 'Guides hub', description: 'Start here when the question is still broad.' },
          { href: '/faq/', label: 'FAQ', description: 'Fast clarifications and common definitions.' },
          { href: '/methodology/', label: 'Methodology', description: 'Editorial and verification boundaries.' }
        ].concat(selectPriorityGuideSummaries(globalPagesDir, 4).map((g) => ({ href: g.route, label: g.title, description: g.description }))),
        cityLinks: distributionCities.map((c) => ({ href: '/' + c.slug + '/', label: c.marketLabel || c.slug, description: 'Local hub' }))
      });
      if (mainHtml.includes('<section class="hero"')) {
        mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/, '$1\n' + globalDistributionHtml);
      } else {
        mainHtml = globalDistributionHtml + '\n' + mainHtml;
      }
    }
    mainHtml = injectPrimaryConversionCta(mainHtml, primaryConversionTemplate, verticalKey, {
      pageType: 'global-primary',
      src: '/',
      marketLabel: brandName
    });
    mainHtml = injectInlineConversionCta(mainHtml, inlineConversionTemplate, verticalKey, {
      pageType: 'global-inline',
      src: '/',
      marketLabel: brandName
    });
    mainHtml = injectRecentlyRefreshedBlock(mainHtml, renderRecentlyRefreshedHtml({
      kind: 'home',
      buildIso: BUILD_ISO,
      guideLinks: selectPriorityGuideSummaries(globalPagesDir, 6).map((g) => ({ href: g.route, label: g.title })),
      primaryLinks: [{ href: '/guides/', label: 'Guides hub' }],
      cityLinks: distributionCities.map((c) => ({ href: '/' + c.slug + '/', label: c.marketLabel || c.slug }))
    }));
  }

  if (route === 'guides') {
    if (!mainHtml.includes('data-citation-summary="true"')) {
      const guidesHubCitationHtml = renderCitationSummaryZoneHtml({
        kind: 'guides-hub',
        title,
        description,
        hrefs: {
          faq: '/faq/',
          methodology: '/methodology/',
          requestAssistance: '/request-assistance/'
        }
      });
      if (mainHtml.includes('<section class="hero"')) {
        mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/, '$1\n' + guidesHubCitationHtml);
      } else {
        mainHtml = guidesHubCitationHtml + '\n' + mainHtml;
      }
    }
    if (false && !mainHtml.includes('data-distribution-priority-block="true"')) {
      const guidesHubDistributionHtml = renderInternalDistributionZoneHtml({
        kind: 'guides-hub',
        title,
        buildIso: BUILD_ISO,
        guideLinks: selectPriorityGuideSummaries(globalPagesDir, 6).map((g) => ({ href: g.route, label: g.title, description: g.description })),
        primaryLinks: selectPriorityGuideSummaries(globalPagesDir, 6).map((g) => ({ href: g.route, label: g.title, description: g.description })),
        cityLinks: [
          { href: '/faq/', label: 'FAQ', description: 'Clarify definitions and common questions.' },
          { href: '/methodology/', label: 'Methodology', description: 'Editorial and verification boundaries.' },
          { href: '/request-assistance/', label: 'Get matched with a provider', description: 'Owned callback route after the right guide is clear.' }
        ]
      });
      if (mainHtml.includes('data-citation-summary-type="guides-hub"')) {
        mainHtml = mainHtml.replace(/(<section class="section citation-summary[^"]*"[\s\S]*?<\/section>)/, '$1\n' + guidesHubDistributionHtml);
      } else if (mainHtml.includes('<section class="hero"')) {
        mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/, '$1\n' + guidesHubDistributionHtml);
      } else {
        mainHtml = guidesHubDistributionHtml + '\n' + mainHtml;
      }
    }
    mainHtml = injectPrimaryConversionCta(mainHtml, primaryConversionTemplate, verticalKey, {
      pageType: 'guides-hub-primary',
      src: '/guides/',
      marketLabel: 'Guides',
      intentType: 'direct_match',
      buttonSource: 'primary_cta'
    });
    mainHtml = injectInlineConversionCta(mainHtml, inlineConversionTemplate, verticalKey, {
      pageType: 'guides-hub-inline',
      src: '/guides/',
      marketLabel: 'Guides',
      intentType: 'direct_match',
      buttonSource: 'inline_conversion_cta'
    });
    mainHtml = injectRecentlyRefreshedBlock(mainHtml, renderRecentlyRefreshedHtml({
      kind: 'guides-hub',
      buildIso: BUILD_ISO,
      guideLinks: selectPriorityGuideSummaries(globalPagesDir, 6).map((g) => ({ href: g.route, label: g.title })),
      primaryLinks: [{ href: '/guides/', label: 'Guides hub' }],
      cityLinks: []
    }));
  }

  if (route.startsWith('guides/') && route !== 'guides') {
    if (!mainHtml.includes('data-citation-summary="true"')) {
      const guideCitationHtml = renderCitationSummaryZoneHtml({
        kind: 'guide-detail',
        title,
        description,
        route: '/' + route + '/',
        hrefs: {
          guides: '/guides/',
          nextSteps: '/next-steps/',
          requestAssistance: '/request-assistance/',
          methodology: '/methodology/'
        }
      });
      if (mainHtml.includes('</section>')) {
        mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/, '$1\n' + guideCitationHtml);
      } else {
        mainHtml = guideCitationHtml + '\n' + mainHtml;
      }
    }
    mainHtml = injectPrimaryConversionCta(mainHtml, primaryConversionTemplate, verticalKey, {
      pageType: 'guide-primary',
      src: '/' + route + '/',
      marketLabel: title,
      intentType: 'direct_match',
      buttonSource: 'primary_cta'
    });
    mainHtml = injectInlineConversionCta(mainHtml, inlineConversionTemplate, verticalKey, {
      pageType: 'guide-inline',
      src: '/' + route + '/',
      marketLabel: title,
      intentType: 'direct_match',
      buttonSource: 'inline_conversion_cta'
    });
    mainHtml = injectRecentlyRefreshedBlock(mainHtml, renderRecentlyRefreshedHtml({
      kind: 'guides-hub',
      buildIso: BUILD_ISO,
      guideLinks: [{ href: '/' + route + '/', label: title }],
      primaryLinks: [{ href: '/guides/', label: 'Guides hub' }],
      cityLinks: []
    }));
  }

  if (route !== '' && route !== 'guides' && !route.startsWith('guides/') && !route.endsWith('next-steps') && route !== 'request-assistance' && route !== 'methodology' && route !== 'faq' && !mainHtml.includes('data-decision-routing-block="true"')) {
    const genericDistributionHtml = renderInternalDistributionZoneHtml({
      kind: 'home',
      title,
      buildIso: BUILD_ISO,
      guideLinks: selectPriorityGuideSummaries(globalPagesDir, 4).map((g) => ({ href: g.route, label: g.title, description: g.description })),
      primaryLinks: [
        { href: '/guides/', label: 'Guides hub', description: 'Start with the main decision paths.' },
        { href: '/faq/', label: 'FAQ', description: 'Clarify common questions fast.' },
        { href: '/methodology/', label: 'Methodology', description: 'See how the site handles neutrality and verification.' }
      ],
      cityLinks: []
    });
    if (mainHtml.includes('<section class="hero"')) {
      mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/, '$1\n' + genericDistributionHtml);
    } else {
      mainHtml = genericDistributionHtml + '\n' + mainHtml;
    }
  }

  // Next-steps zone injection (GLOBAL pages + guides pages that are implemented as global routes)
  // This is the LIVE BUYOUT CTA (Option A): only for an active vertical buyout, suppressed on excluded pages.
  if (route === 'next-steps') {
    mainHtml = renderDedicatedNextStepsHubHtml({
      marketLabel: brandName,
      pageTitle: title,
      compareHref: buildTrackedHref('/guides/', { intent: 'decision_hub', button: 'next_steps_page_compare', vertical: verticalKey, page_kind: 'next_steps', page_slug: 'next-steps' }),
      toolsHref: buildTrackedHref('/faq/', { intent: 'self_serve', button: 'next_steps_page_tools', vertical: verticalKey, page_kind: 'next_steps', page_slug: 'next-steps' }),
      requestAssistanceHtml: extractRequestAssistanceHtml(pageSet)
    });
  } else {
    var globalRoutePath = route ? ('/' + route.replace(/^\//, '') + '/') : '/';
    // Inline next-steps hub removed: dedicated /next-steps/ pages are the only full decision-hub surface.
  }

  mainHtml = injectAdPlacements(mainHtml, ads, { city: null, verticalKey: verticalKey, cityFeatures: pageSet && pageSet.__cityFeatures ? pageSet.__cityFeatures : null });
  if (route.startsWith('guides/') && route !== 'guides') {
    if (!/data-sponsored-placement="top"/.test(mainHtml)) {
      mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/i, '$1\n\n' + renderAdPlacement('global_guide_top', {}));
    }
    if (!/data-sponsored-placement="bottom"/.test(mainHtml)) {
      mainHtml += '\n\n' + renderAdPlacement('global_guide_bottom', {});
    }
  }
  mainHtml = injectSponsors(mainHtml, globalSponsorsByStack || {});

  const globalFanoutCluster = fanout.buildFanoutCluster({
    verticalKey,
    pageKind: fanout.classifyPageKind({ route: route ? ('/' + route + '/') : '/' }),
    route: route ? ('/' + route + '/') : '/',
    title,
    description
  }, pageSet);
  const globalFanoutHtml = fanout.renderFanoutClusterHtml(globalFanoutCluster);
  if (globalFanoutHtml && !mainHtml.includes('data-fanout-query-cluster="true"')) {
    mainHtml += "\n" + globalFanoutHtml;
  }

  const connectionBubbleHtml = shouldRenderConnectionBubble({ pageKind: 'global', route })
    ? renderConnectionBubbleHtml(connectionBubbleTemplate, verticalKey, { src: route ? ('/' + route + '/') : '/' })
    : '';

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
    "%%HEAD_META%%": renderHeadMeta({ pageType: route === "" ? "home" : (route === "guides" ? "guides-hub" : (route.startsWith("guides/") ? "guide-detail" : "global")), title, description, canonical: buildCanonicalGlobal(siteUrl, route), brandName, section: route.startsWith("guides/") ? "Guide" : (route === "guides" ? "Guides hub" : "Global"), keywords: [verticalKey, route.replace(/\//g, " "), title] }),
    "%%HEAD_JSON_LD%%": renderHeadJsonLdGlobal(siteUrl, brandName, route, title, description, pageSet),
    "%%FOOTER%%": footerHtml,
    "%%CONNECTION_BUBBLE%%": connectionBubbleHtml,
    "%%BRAND_NAME%%": escapeHtml(brandName)
    ,"%%OPTIONAL_TOP_NAV%%": (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
  });
  // Last-mile safety: ensure footer disclosure exists on every page.
  // Some regressions have produced city pages without the shared footer injection.
  let out = mapped;
  out = reorderMainSections(out, route === '' ? 'home' : (route === 'guides' ? 'guides-hub' : (route.startsWith('states/') ? 'state' : '')));
  if (!out.includes('<footer') || !out.includes('Advertising disclosure.') || !out.includes('No guarantees or endorsements.')) {
    // Inject footerHtml immediately before </body> if missing.
    out = out.replace(/<\/body>/i, "\n" + footerHtml + "\n</body>");
  }
  return out;
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
  // The larger city-specific guide listing block is intentionally retired.
  // City pages keep the compact grouped comparison module instead.
  return "";
}



function inferGuideLabelFromRoute(route) {
  const r = String(route || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  if (r.includes('pricing') || r.includes('cost') || r.includes('fees')) return 'pricing and comparison';
  if (r.includes('red-flags')) return 'red-flag screening';
  if (r.includes('questions')) return 'provider interview prep';
  if (r.includes('insurance')) return 'insurance and coverage';
  if (r.includes('telehealth')) return 'care-format comparison';
  if (r.includes('report')) return 'report and records expectations';
  if (r.includes('overview')) return 'high-level orientation';
  if (r.includes('requirements') || r.includes('checklist')) return 'requirements and checklist planning';
  if (r.includes('next-steps')) return 'next-step planning';
  return 'decision support';
}


function stripHtmlTags(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/[#*_`>\-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadGlobalPageSummaries(globalPagesDir) {
  const out = [];
  if (!globalPagesDir || !fs.existsSync(globalPagesDir)) return out;
  for (const fp of listJsonFiles(globalPagesDir)) {
    try {
      const raw = readJson(fp);
      const routeRaw = String(raw.route || '').trim();
      const route = routeRaw ? (routeRaw.startsWith('/') ? routeRaw : ('/' + routeRaw.replace(/^\/+/, ''))) : '/';
      out.push({
        route: route.endsWith('/') ? route : route + '/',
        title: stripHtmlTags(raw.title || path.basename(fp, '.json')),
        description: stripHtmlTags(raw.description || ''),
        file: path.basename(fp)
      });
    } catch (_) {}
  }
  return out.sort((a, b) => String(a.route).localeCompare(String(b.route)));
}

function selectPriorityGuideSummaries(globalPagesDir, limit) {
  const guides = loadGlobalPageSummaries(globalPagesDir).filter((p) => /^\/guides\/[^/]+\/$/.test(String(p.route || '')));
  const wanted = [
    /cost|pricing|fees/i,
    /questions/i,
    /red-flags/i,
    /next-steps|after-your/i,
    /overview|requirements|checklist/i,
    /insurance|report|choose|timeline|telehealth|safety/i
  ];
  const chosen = [];
  const seen = new Set();
  for (const rx of wanted) {
    const hit = guides.find((g) => !seen.has(g.route) && (rx.test(g.route) || rx.test(g.title) || rx.test(g.description)));
    if (hit) {
      seen.add(hit.route);
      chosen.push(hit);
    }
  }
  for (const g of guides) {
    if (chosen.length >= (limit || 6)) break;
    if (seen.has(g.route)) continue;
    chosen.push(g);
    seen.add(g.route);
  }
  return chosen.slice(0, limit || 6);
}

function renderInternalDistributionZoneHtml(opts) {
  const kind = String((opts && opts.kind) || '').trim();
  const title = escapeHtml(String((opts && opts.title) || 'Priority surfaces'));
  const guideLinks = Array.isArray(opts && opts.guideLinks) ? opts.guideLinks : [];
  const cityLinks = Array.isArray(opts && opts.cityLinks) ? opts.cityLinks : [];
  const primaryLinks = Array.isArray(opts && opts.primaryLinks) ? opts.primaryLinks : [];
  const buildStamp = escapeHtml(String((opts && opts.buildIso) || BUILD_ISO));
  const deploymentLabel = buildStamp.slice(0, 10) || 'this deploy';

  const linkList = (items, attr) => {
    if (!items.length) return '';
    return '<ul ' + attr + '="true">' + items.map((item) => {
      const href = escapeHtml(String(item.href || '#'));
      const label = escapeHtml(String(item.label || item.href || 'Page'));
      const desc = stripHtmlTags(item.description || '');
      return '<li><a href="' + href + '">' + label + '</a>' + (desc ? ' <span class="muted">— ' + escapeHtml(desc) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  };

  const priorityIntroByKind = {
    'home': 'Use these owned routes first when you want the clearest path into guides, next steps, and local markets.',
    'guides-hub': 'Use these guide routes first when the question is still broad but not purely local.',
    'city-home': 'Use this lighter routing block only after the main framework and next-steps CTA.',
    'state-home': 'Use this state page as a routing layer into city hubs, core guides, and official verification paths.'
  };
  const priorityPrimary = primaryLinks.length ? primaryLinks : guideLinks;

  const hiddenCityLinks = (cityLinks.length && kind !== 'city-home')
    ? '<div class="visually-hidden" aria-hidden="true" data-distribution-city-links="true">' + linkList(cityLinks, 'data-distribution-city-links-hidden') + '</div>'
    : '';

  return (
    '<section class="section distribution-priority decision-routing-block" data-distribution-priority-block="true" data-decision-routing-block="true" data-distribution-kind="' + escapeHtml(kind) + '">' +
    '<h2>Start here</h2>' +
    '<p class="muted">' + escapeHtml(priorityIntroByKind[kind] || 'Use these priority routes first.') + '</p>' +
    linkList(priorityPrimary, 'data-distribution-priority-links') +
    hiddenCityLinks +
    '</section>'
  );
}

function renderRecentlyRefreshedHtml(opts) {
  return '';
  const kind = String((opts && opts.kind) || '').trim();
  const guideLinks = Array.isArray(opts && opts.guideLinks) ? opts.guideLinks : [];
  const primaryLinks = Array.isArray(opts && opts.primaryLinks) ? opts.primaryLinks : [];
  const buildStamp = escapeHtml(String((opts && opts.buildIso) || BUILD_ISO));

  const linkList = (items, attr) => {
    if (!items.length) return '';
    return '<ul ' + attr + '="true">' + items.map((item) => {
      const href = escapeHtml(String(item.href || '#'));
      const label = escapeHtml(String(item.label || item.href || 'Page'));
      return '<li><a href="' + href + '" data-decision-anchor="true">' + label + '</a></li>';
    }).join('') + '</ul>';
  };

  const freshPrimary = (guideLinks.length ? guideLinks : primaryLinks).slice(0, 4);
  if (!freshPrimary.length) return '';

  return (
    '<section class="section distribution-fresh distribution-fresh--quiet" data-distribution-fresh-block="true" data-distribution-kind="' + escapeHtml(kind) + '" data-distribution-build="' + buildStamp + '">' +
    '<h3>Recently refreshed</h3>' +
    linkList(freshPrimary, 'data-distribution-fresh-links') +
    '</section>'
  );
}

function injectRecentlyRefreshedBlock(mainHtml, refreshHtml) {
  const marker = 'data-distribution-fresh-block="true"';
  if (!refreshHtml) return String(mainHtml || '');
  if (String(mainHtml || '').includes(marker)) return String(mainHtml || '');
  return String(mainHtml || '') + '\n' + refreshHtml;
}

function buildGuideDecisionGroups(route, globalPagesDir) {
  const currentRoute = String(route || '').replace(/^\/+|\/+$/g, '');
  const currentHref = currentRoute ? ('/' + currentRoute + '/') : '/';
  const all = selectPriorityGuideSummaries(globalPagesDir, 18).filter((g) => String(g.route || '') !== currentHref);
  const start = [];
  const bySituation = [];
  const next = [];

  for (const g of all) {
    const href = String(g.route || '#');
    const label = String(g.title || 'Guide');
    const bucketSource = (href + ' ' + label + ' ' + String(g.description || '')).toLowerCase();
    const item = { href, label };

    if (/(questions|red-flag|red flag|cost|pricing|fees|requirements|checklist|documents|overview)/.test(bucketSource)) {
      if (start.length < 4) start.push(item);
      else if (bySituation.length < 4) bySituation.push(item);
      else if (next.length < 4) next.push(item);
      continue;
    }

    if (/(car|truck|slip|wrongful|adhd|autism|therapy|trt|iv|hair|peptide|civil surgeon|vaccination|document|i-693|insurance|report|timeline|telehealth|workplace|product liability|after your exam)/.test(bucketSource)) {
      if (bySituation.length < 4) bySituation.push(item);
      else if (start.length < 4) start.push(item);
      else if (next.length < 4) next.push(item);
      continue;
    }

    if (next.length < 4) next.push(item);
    else if (start.length < 4) start.push(item);
    else if (bySituation.length < 4) bySituation.push(item);
  }

  const dedupe = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = String(item.href || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const groups = [
    { heading: 'Start here first', items: dedupe(start).slice(0, 4) },
    { heading: 'By situation', items: dedupe(bySituation).slice(0, 4) },
    { heading: 'After you know your direction', items: dedupe(next).slice(0, 4) }
  ].filter((group) => Array.isArray(group.items) && group.items.length);

  return groups;
}

function normalizeGuideSections(html) {
  let out = String(html || '');
  out = out.replace(/<section class="section guide-section" data-guide-section="true">\s*<h2 id="([^"]+)">([^<]+)<\/h2>\s*<\/section>\s*<section class="section guide-section" data-guide-section="true">\s*<h2>\2<\/h2>/gi,
    '<section class="section guide-section" data-guide-section="true"><h2 id="$1">$2</h2>');
  out = out.replace(/<section class="section guide-section" data-guide-section="true">\s*<h2 id="([^"]+)">([^<]+)<\/h2>\s*<\/section>/gi,
    '<section class="section guide-section" data-guide-section="true"><h2 id="$1">$2</h2></section>');
  out = out.replace(/(<section class="section guide-section" data-guide-section="true"><h2 id="([^"]+)">([^<]+)<\/h2><\/section>)\s*(<section class="section guide-section" data-guide-section="true">\s*<h2>\3<\/h2>)/gi,
    '$4');
  return out;
}

function renderGuideOpeningHtml(title) {
  const safeTitle = escapeHtml(String(title || 'This guide'));
  return (
    '<section class="section guide-opening-block answer-block" data-guide-opening="true">' +
    '<h2>What this guide is best for</h2>' +
    '<p data-guide-opening-direct="true"><strong>Direct answer:</strong> ' + safeTitle + ' is most useful when you need one decision path clarified before you contact anyone.</p>' +
    '<p class="answer-when" data-guide-opening-when="true"><strong>Best used when:</strong> the question is narrow enough that a city or state hub is too broad.</p>' +
    '</section>'
  );
}

function renderCitationSummaryZoneHtml(opts) {
  const kind = String((opts && opts.kind) || '').trim();
  if (!kind) return '';

  const title = escapeHtml(String((opts && opts.title) || 'This page'));
  const description = escapeHtml(String((opts && opts.description) || ''));
  const route = String((opts && opts.route) || '').trim();
  const hrefs = Object.assign({
    guides: '/guides/',
    faq: '/faq/',
    methodology: '/methodology/',
    requestAssistance: '/request-assistance/',
    nextSteps: '/next-steps/'
  }, (opts && opts.hrefs) || {});

  if (kind === 'city-home') {
    const marketLabel = escapeHtml(String((opts && opts.marketLabel) || 'this market'));
    const verticalLabel = escapeHtml(String((opts && opts.verticalLabel) || 'local services'));
    return (
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-citation-summary-type="city-home">' +
      '<h2 id="citation-summary">Short answer</h2>' +
      '<p data-citation-summary-lede="true">People using <strong>' + marketLabel + '</strong> to research ' + verticalLabel + ' usually start by figuring out what to verify first, which questions narrow the field fastest, and what differences matter before they contact anyone.</p>' +
      '<p class="answer-when">Most people compare fit, process clarity, follow-up expectations, and whether the provider or program explains the next step in plain language, but convenience alone is rarely the full answer.</p>' +
      '<p class="answer-tradeoff">Costs, timelines, and verification steps can vary by market, so this page works best as a local orientation layer before a person decides which guide, official lookup, or callback path to use.</p>' +
      '<p class="answer-boundary">This page is educational and is designed to help you understand the local decision before you choose what to do next.</p>' +
      '<ul class="visually-hidden" data-citation-key-points="true">' +
      '<li>This page works best as a local orientation layer before contacting providers.</li>' +
      '<li>Use an official verification source when licensing, credentials, or lookup requirements need to be confirmed.</li>' +
      '<li>Use the guide layer and next-steps flow only after the local comparison questions are clear.</li>' +
      '</ul>' +
      '<p class="visually-hidden" data-citation-routing-links="true">Fast path: <a href="' + escapeHtml(hrefs.guides) + '">guides</a>, <a href="' + escapeHtml(hrefs.faq) + '">FAQ</a>, <a href="' + escapeHtml(hrefs.requestAssistance) + '">get matched with a provider</a>, and <a href="' + escapeHtml(hrefs.methodology) + '">methodology</a>.</p>' +
      '</section>'
    );
  }


  if (kind === 'state-home') {
    return (
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-citation-summary-type="state-home">' +
      '<h2 id="citation-summary">Short answer</h2>' +
      '<p data-citation-summary-lede="true"><strong>' + title + '</strong> works best when the question is still broad and you need to narrow it into the right city page, guide, or statewide verification step.</p>' +
      '<p class="answer-when">Use the state layer to see which cities are covered, what official resources matter, and which local page should come next.</p>' +
      '<p class="answer-boundary">This page is educational and is designed to help you understand the statewide decision before you choose what to do next.</p>' +
      '</section>'
    );
  }

  if (kind === 'guide-detail') {
    const guideLabel = escapeHtml(inferGuideLabelFromRoute(route));
    return (
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-citation-summary-type="guide-detail">' +
      '<h2 id="citation-summary">Short answer</h2>' +
      '<p data-citation-summary-lede="true"><strong>' + title + '</strong> is a guide for ' + guideLabel + '. ' + description + '</p>' +
      '<p class="answer-when">Use this guide when the question is narrow enough that you need one cleaner comparison, caution, or next step.</p>' +
      '<p class="answer-tradeoff">The goal is not reassurance alone; it is to make the next move clearer without pretending the decision is already settled.</p>' +
      '<p class="answer-boundary">This guide is educational and is designed to help you understand one decision more clearly before you choose what to do next.</p>' +
      '<ul class="visually-hidden" data-citation-key-points="true">' +
      '<li>This page is meant to answer one decision question clearly before a person contacts a provider.</li>' +
      '<li>It should be paired with the guide hub, methodology page, and next-steps page instead of treated like a ranking or endorsement.</li>' +
      '<li>When local help is needed, use the owned provider-callback route rather than guessing from generic search results.</li>' +
      '</ul>' +
      '<p class="visually-hidden" data-citation-routing-links="true">Related owned routes: <a href="' + escapeHtml(hrefs.guides) + '">guides hub</a>, <a href="' + escapeHtml(hrefs.nextSteps) + '">next steps</a>, <a href="' + escapeHtml(hrefs.requestAssistance) + '">get matched with a provider</a>, and <a href="' + escapeHtml(hrefs.methodology) + '">methodology</a>.</p>' +
      '</section>'
    );
  }

  if (kind === 'guides-hub') {
    return (
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-citation-summary-type="guides-hub">' +
      '<h2 id="citation-summary">Short answer</h2>' +
      '<p data-citation-summary-lede="true"><strong>' + title + '</strong> is the owned guide index for this pack. It helps when the question is still broad and you need to choose the best guide before opening a single leaf page.</p>' +
      '<p class="answer-when">Most people use this page to narrow a broad topic into cost, red flags, questions to ask, requirements, or next steps, but the best next click depends on what still feels unclear.</p>' +
      '<p class="answer-tradeoff">The hub is not the final answer; the goal is to route you into the one guide that makes the decision cleaner fastest.</p>' +
      '<p class="answer-boundary">This page is educational and is designed to help you understand which decision path to open next.</p>' +
      '<ul class="visually-hidden" data-citation-key-points="true">' +
      '<li>Use this page when the question is still broad and needs to be narrowed into a single guide.</li>' +
      '<li>Leaf guides should carry the real pricing, trust, red-flag, requirements, or next-step answer blocks.</li>' +
      '<li>The FAQ and methodology pages explain boundaries, definitions, and how to read the site safely.</li>' +
      '</ul>' +
      '<p class="visually-hidden" data-citation-routing-links="true">Primary owned routes: <a href="' + escapeHtml(hrefs.faq) + '">FAQ</a>, <a href="' + escapeHtml(hrefs.methodology) + '">methodology</a>, and <a href="' + escapeHtml(hrefs.requestAssistance) + '">get matched with a provider</a>.</p>' +
      '</section>'
    );
  }

  return '';
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

  const pageSetFile = site.pageSetFile;
  if (!pageSetFile) {
    console.error("ERROR: data/site.json is missing pageSetFile. Run prepare/build with PAGE_SET_FILE set.");
    process.exit(1);
  }
  const pageSet = loadPageSet(pageSetFile);
  pageSet.__pageSetFile = pageSetFile;
  const verticalKey = deriveVerticalKey(pageSetFile);

  // City page feature toggles (future-proof): directory vs state lookup (mutually exclusive).
  pageSet.__cityFeatures = getCityFeatures(pageSet, verticalKey);


  const packSite = getPackSiteConfig(site.pageSetFile || process.env.PAGE_SET_FILE || pageSetFile || '');
  const brandName = String(site.brandName || packSite?.brandName || "Local Guides").trim();
  const siteUrl = String(site.siteUrl || packSite?.siteUrl || "").trim();
  if (!siteUrl || /placeholder-domain\.invalid/i.test(siteUrl)) {
    throw new Error(`Invalid siteUrl for pack ${site.pageSetFile || process.env.PAGE_SET_FILE || pageSetFile || 'unknown'}: ${siteUrl || '(empty)'}`);
  }
  const fanoutRecords = [];

  const cities = loadCities(pageSet, verticalKey).map((c) => {
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
  const footerHtmlRaw = fs.readFileSync(path.join(TEMPLATES_DIR, "partials", "footer.html"), "utf8");
  const connectionBubbleTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'partials', 'connection_bubble.html'), 'utf8');
  const primaryConversionTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'partials', 'primary_conversion_cta.html'), 'utf8');
  const inlineConversionTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'partials', 'inline_conversion_cta.html'), 'utf8');
  const footerHtml = footerHtmlRaw
    .replace(/%%CURRENT_YEAR%%/g, String(new Date().getFullYear()))
    .replace(/%%BRAND_NAME%%/g, escapeHtml(brandName));

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
  // (home/faq/methodology + guides_*), while core policy pages remain shared.
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
        '<h3 style="margin:0 0 6px 0"><a href="/states/' + escapeHtml(abbr) + '/">' + escapeHtml(name) + '</a></h3>' +
        '<p class="muted" style="margin:0">State hub</p>' +
        '</div>'
      );
    }).join("\n");

    return '<div class="grid" data-markets-status-list="states">' + cards + '</div>';
  }

  if (isPersonalInjury(verticalKey)) {
    marketsStatusListHtml = buildStatesStatusListHtml(ALL_US_STATES);
  } else {
    const coveredStates = {};
    cities.forEach((c) => {
      const ab = String(c.state || '').toUpperCase();
      if (!ab) return;
      const canonical = (ALL_US_STATES && ALL_US_STATES[ab] && ALL_US_STATES[ab].stateName) || '';
      coveredStates[ab] = { stateName: String(c.stateName || canonical || ab) };
    });
    marketsStatusListHtml = buildStatesStatusListHtml(coveredStates);
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
      connectionBubbleTemplate,
      primaryConversionTemplate,
      inlineConversionTemplate,
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
    fanoutRecords.push(fanout.buildFanoutCluster({
      verticalKey,
      pageKind: fanout.classifyPageKind({ route: route ? ('/' + route + '/') : '/' }),
      route: route ? ('/' + route + '/') : '/',
      title: String(gp.title || '').split('%%BRAND_NAME%%').join(brandName),
      description: String(gp.description || '')
    }, pageSet));
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
      if (route === 'next-steps' && !shouldRenderDeterministicNextSteps(pageSet, { pageType: 'city', route: '/' + (cityData.city_slug || cityData.slug || city.slug) + '/' })) {
        continue;
      }

      const html = renderPage(
        baseTemplate,
        footerHtml,
        connectionBubbleTemplate,
        primaryConversionTemplate,
        inlineConversionTemplate,
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
      fanoutRecords.push(fanout.buildFanoutCluster({
        verticalKey,
        pageKind: 'city',
        route: route ? `/${city.slug}/${route}/` : `/${city.slug}/`,
        title: applyCityTokens(p.title, city).split('%%MARKET_LABEL%%').join(city.marketLabel),
        marketLabel: city.marketLabel
      }, pageSet));
    }
  }



  if (!isPersonalInjury(verticalKey)) {
    function outPathForState(abbr) {
      return path.join(OUT_DIR, 'states', String(abbr).toUpperCase(), 'index.html');
    }
    const stateMap = new Map();
    for (const city of cities) {
      const ab = String(city.state || '').toUpperCase();
      if (!ab) continue;
      if (!stateMap.has(ab)) stateMap.set(ab, { abbr: ab, name: String(city.stateName || ALL_US_STATES[ab] || ab), cities: [] });
      stateMap.get(ab).cities.push(city);
    }
    function renderGenericStatePageHtml(stateInfo) {
      const ab = String(stateInfo.abbr || '').toUpperCase();
      const stateName = String(stateInfo.name || ALL_US_STATES[ab] || ab);
      const title = brandName + ' in ' + stateName + ' — state hub';
      const description = 'Use this state hub to narrow into covered cities, provider examples, official verification resources, and next steps in ' + stateName + '.';
      const guideLinks = selectPriorityGuideSummaries(globalPagesDir, 4).map((g) => ({ href: g.route, label: g.title, description: g.description }));
      const cityLinks = stateInfo.cities.slice().sort((a,b)=>String(a.marketLabel||a.slug).localeCompare(String(b.marketLabel||b.slug))).map((c) => ({ href: '/' + c.slug + '/', label: c.marketLabel || c.slug }));
      const stateLead = renderCitationSummaryZoneHtml({ kind: 'state-home', title, description, hrefs: { guides: '/guides/', faq: '/faq/', methodology: '/methodology/' } });
      const groupedGuides = '<section class="section state-guides-support" data-state-guides-support="true"><h2>State-level guides and support</h2><div class="grid">' + guideLinks.map((g) => '<div class="card"><h3><a href="' + escapeHtml(g.href) + '">' + escapeHtml(g.label) + '</a></h3><p>' + escapeHtml(g.description || 'Guide') + '</p></div>').join('') + '</div></section>';
      let mainHtml = (
        '<section class="hero" data-state-hero="true"><p class="kicker">' + escapeHtml(brandName) + ' · State hub</p><h1>' + escapeHtml(brandName) + ' in ' + escapeHtml(stateName) + '</h1><p class="muted">Use this state page to narrow into covered cities, official verification resources, and the next decision path.</p></section>' +
        '%%AD:state_hub_top%%' +
        stateLead +
        '%%PRIMARY_CTA%%' +
        '%%AD:state_hub_mid%%' +
        renderStateAuthorityBlockHtml(stateName, cityLinks.length) +
        renderStateCityGridHtml(stateName, cityLinks) +
        renderRequestCitySectionHtml(brandName, stateName) +
        groupedGuides +
        '%%MID_NEXT_STEPS%%' +
        '<section class="section tertiary-support" data-tertiary-support="true"><h2>Need a lighter support path?</h2><p class="muted"><a href="/faq/">FAQ</a> · <a href="/methodology/">Methodology</a> · <a href="/guides/">Guides hub</a></p></section>'
      );
      mainHtml = injectPrimaryConversionCta(mainHtml, primaryConversionTemplate, verticalKey, {
        pageType: 'state-primary', src: '/states/' + ab + '/', marketLabel: stateName, intentType: 'direct_match', buttonSource: 'primary_cta'
      });
      mainHtml = injectInlineConversionCta(mainHtml, inlineConversionTemplate, verticalKey, {
        pageType: 'state-inline', src: '/states/' + ab + '/', marketLabel: stateName, intentType: 'decision_hub', buttonSource: 'inline_conversion_cta'
      });
      const stateFanoutCluster = fanout.buildFanoutCluster({ verticalKey, pageKind: 'state', route: '/states/' + ab + '/', title, stateName }, pageSet);
      const stateFanoutHtml = fanout.renderFanoutClusterHtml(stateFanoutCluster);
      if (stateFanoutHtml && !mainHtml.includes('data-fanout-query-cluster="true"')) mainHtml += '\n' + stateFanoutHtml;
      const connectionBubbleHtml = shouldRenderConnectionBubble({ pageKind: 'state', route: 'states/' + ab }) ? renderConnectionBubbleHtml(connectionBubbleTemplate, verticalKey, { src: '/states/' + ab + '/' }) : '';
      let mapped = replaceAll(baseTemplate, {
        '%%TITLE%%': title,
        '%%DESCRIPTION%%': description,
        '%%DATA_CITY%%': 'state-' + ab,
        '%%SLUG%%': 'states/' + ab,
        '%%MARKET_LABEL%%': escapeHtml(stateName),
        '%%MARKET_NAV%%': '<a href="/">Home</a> · <a href="/states/' + escapeHtml(ab) + '/">' + escapeHtml(stateName) + '</a>',
        '%%MAIN_HTML%%': mainHtml,
        '%%INLINE_SCRIPTS%%': '',
        '%%CANONICAL%%': buildCanonicalGlobal(siteUrl, 'states/' + ab),
        '%%HEAD_META%%': renderHeadMeta({ pageType: 'state-home', title, description, canonical: buildCanonicalGlobal(siteUrl, 'states/' + ab), brandName, section: 'State hub', keywords: [verticalKey, stateName, 'state hub'] }),
        '%%HEAD_JSON_LD%%': renderHeadJsonLdGlobal(siteUrl, brandName, 'states/' + ab, title, description, pageSet),
        '%%FOOTER%%': footerHtml,
        '%%CONNECTION_BUBBLE%%': connectionBubbleHtml,
        '%%BRAND_NAME%%': escapeHtml(brandName),
        '%%OPTIONAL_TOP_NAV%%': ''
      });
      mapped = injectAdPlacements(mapped, ads, { verticalKey, stateAbbr: ab });
      mapped = reorderMainSections(mapped, 'state');
      return mapped;
    }
    for (const stateInfo of Array.from(stateMap.values()).sort((a,b)=>String(a.name).localeCompare(String(b.name)))) {
      const html = renderGenericStatePageHtml(stateInfo);
      writeFileEnsured(outPathForState(stateInfo.abbr), html);
      fanoutRecords.push(fanout.buildFanoutCluster({ verticalKey, pageKind: 'state', route: '/states/' + stateInfo.abbr + '/', title: brandName + ' in ' + stateInfo.name + ' — state hub', stateName: stateInfo.name }, pageSet));
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

      // Priority 0 (PI state buyout): explicit state sponsor file, if present and LIVE.
      try {
        const p = path.join(DATA_DIR, 'state_sponsors', `${ab.toLowerCase()}.json`);
        if (fs.existsSync(p)) {
          const s0 = readJson(p) || {};
          if (sponsorship.isSponsorLive(s0)) return s0;
        }
      } catch (_) {
        // ignore
      }

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
      const stateName = String(st.stateName || ALL_US_STATES[ab] || ab);
      const title = 'Next steps — ' + stateName + ' personal injury';
      const description = 'Sponsor contact and preparation checklist for personal injury in ' + stateName + '. Educational only.';

      const mainHtml = renderDedicatedNextStepsHubHtml({
        marketLabel: stateName,
        pageTitle: title,
        compareHref: '/guides/?intent=decision_hub&button=next_steps_page_compare&vertical=pi&page_kind=next_steps&page_slug=states-' + String(ab).toLowerCase() + '-next-steps&market=' + String(ab).toLowerCase(),
        toolsHref: '/faq/?intent=self_serve&button=next_steps_page_tools&vertical=pi&page_kind=next_steps&page_slug=states-' + String(ab).toLowerCase() + '-next-steps&market=' + String(ab).toLowerCase(),
        requestAssistanceHtml: extractRequestAssistanceHtml(pageSet)
      });

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
        '%%HEAD_META%%': renderHeadMeta({ pageType: 'state-next-steps', title, description, canonical: buildCanonicalGlobal(siteUrl, 'states/' + ab + '/next-steps'), brandName, section: 'State next steps', keywords: ['state next steps', stateName, 'personal injury'] }),
        '%%HEAD_JSON_LD%%': '',
        '%%FOOTER%%': footerHtml,
        '%%CONNECTION_BUBBLE%%': '',
        '%%BRAND_NAME%%': escapeHtml(brandName),
        '%%OPTIONAL_TOP_NAV%%': (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
      });
      // Last-mile safety: ensure footer disclosure exists on every page.
  // Some regressions have produced city pages without the shared footer injection.
  let out = mapped;
  out = reorderMainSections(out, 'state');
  if (!out.includes('<footer') || !out.includes('Advertising disclosure.') || !out.includes('No guarantees or endorsements.')) {
    // Inject footerHtml immediately before </body> if missing.
    out = out.replace(/<\/body>/i, "\n" + footerHtml + "\n</body>");
  }
  return out;
    }

    function renderPiStatePageHtml(stateAbbr) {
      const ab = String(stateAbbr).toUpperCase();
      const st = states[ab] || {};
      // For PI, states.json may only include states present in the current
      // city page set. The PI experience (hub + state pages) must be a full
      // 50-state universe regardless of which cities are present.
      const stateName = String(
        (ALL_US_STATES && (ALL_US_STATES[ab].name || ALL_US_STATES[ab])) ||
        st.stateName ||
        ab
      );
      const title = stateName + ' personal injury guide';
      const description = 'Browse covered cities, compare local paths, and move into next steps in ' + stateName + '.';

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
        const phone = it.phone || '';
        const loc = String(it.__marketLabel || '').trim();
        return (
          '<div class="card">' +
          '<h3 style="margin:0 0 6px 0">' + escapeHtml(name) + '</h3>' +
          (loc ? ('<p class="muted" style="margin:0 0 6px 0">' + escapeHtml(loc) + '</p>') : '') +
          '<p style="margin:0">' +
          '<span>Listed in this state directory</span>' +
          (phone ? ' · <span>' + escapeHtml(String(phone)) + '</span>' : '') +
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
        '<details class="accordion" id="state-faq">' +
        '<summary>FAQs <span class="accordion-meta">Optional quick answers</span></summary>' +
        '<div class="accordion-panel">' +
        '<div class="faq-accordion" data-faq-accordion="state">' + renderFaqCardsHtml(stateFaqItems) + '</div>' +
        '</div>' +
        '</details>'
      );
      let mainHtml = (
        '<section class="hero" data-state-hero="true" data-pi-state-page="true">' +
        '<p class="kicker">Personal injury · State guide</p>' +
        '<h1>' + escapeHtml(stateName) + ' personal injury guide</h1>' +
        '<p class="muted">Browse covered cities, compare local paths, and move into next steps.</p>' +
        '</section>' +

        '%%AD:pi_state_top%%' +

        renderStateAuthorityBlockHtml(stateName, cityRows.length) +

        '<section class="section micro-guides" data-guides-micro="true">' +
        '<p><strong>Start here:</strong> ' +
        '<a href="/guides/#costs">Costs</a> • ' +
        '<a href="/guides/#timeline">Timeline</a> • ' +
        '<a href="/guides/#questions">Questions to ask</a> • ' +
        '<a href="/guides/#red-flags">Red flags</a> ' +
        '<span class="muted">(educational)</span></p>' +
        '</section>' +
        '%%AD:pi_state_mid%%' +
        renderCitationSummaryZoneHtml({ kind: 'state-home', title, description, hrefs: { guides: '/guides/', faq: '/faq/', methodology: '/methodology/' } }) +
        renderStateCityGridHtml(stateName, cityRows.slice().sort((a,b)=>String(a.marketLabel||a.slug).localeCompare(String(b.marketLabel||b.slug))).map((c) => ({ href: '/' + c.slug + '/', label: c.marketLabel || c.slug }))) +
        renderRequestCitySectionHtml(brandName, stateName) +
        '<section class="section state-guides-support" data-state-guides-support="true"><h2>State-level guides and support</h2><div class="grid">' + selectPriorityGuideSummaries(globalPagesDir, 4).map((g) => '<div class="card"><h3><a href="' + escapeHtml(g.route) + '">' + escapeHtml(g.title) + '</a></h3><p>' + escapeHtml(g.description || 'Guide') + '</p></div>').join('') + '</div></section>' +
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

      mainHtml = injectPrimaryConversionCta(mainHtml, primaryConversionTemplate, verticalKey, {
        pageType: 'state-primary',
        src: '/states/' + ab + '/',
        marketLabel: stateName,
        intentType: 'direct_match',
        buttonSource: 'primary_cta'
      });
      mainHtml = injectInlineConversionCta(mainHtml, inlineConversionTemplate, verticalKey, {
        pageType: 'state-inline',
        src: '/states/' + ab + '/',
        marketLabel: stateName,
        intentType: 'direct_match',
        buttonSource: 'inline_conversion_cta'
      });
      mainHtml = injectRecentlyRefreshedBlock(mainHtml, renderRecentlyRefreshedHtml({
        kind: 'state-home',
        buildIso: BUILD_ISO,
        guideLinks: selectPriorityGuideSummaries(globalPagesDir, 3).map((g) => ({ href: g.route, label: g.title, description: g.description })),
        primaryLinks: [{ href: '/states/' + ab + '/', label: stateName }].concat(selectPriorityGuideSummaries(globalPagesDir, 2).map((g) => ({ href: g.route, label: g.title, description: g.description }))),
        cityLinks: cityRows.slice(0, 4).map((c) => ({ href: '/' + c.slug + '/', label: c.marketLabel || c.slug, description: 'City PI hub in ' + stateName }))
      }));

      // Next-steps on PI state pages:
      // - sponsor-driven (based on any live sponsor in the state's cities) OR
      // - global buyout switch
      // Default remains OFF because all packs ship educationOnly=true.
      const stateSponsor = selectPiStateSponsor(ab);
      // Inline next-steps hub removed from state pages; dedicated state /next-steps/ pages own the full experience.

      const stateFanoutCluster = fanout.buildFanoutCluster({
        verticalKey,
        pageKind: 'state',
        route: '/states/' + ab + '/',
        title,
        stateName
      }, pageSet);
      const stateFanoutHtml = fanout.renderFanoutClusterHtml(stateFanoutCluster);
      if (stateFanoutHtml && !mainHtml.includes('data-fanout-query-cluster="true"')) {
        mainHtml += '\n' + stateFanoutHtml;
      }

      const connectionBubbleHtml = shouldRenderConnectionBubble({ pageKind: 'state', route: 'states/' + ab })
        ? renderConnectionBubbleHtml(connectionBubbleTemplate, verticalKey, { src: '/states/' + ab + '/' })
        : '';

      let mapped = replaceAll(baseTemplate, {
        '%%TITLE%%': title,
        '%%DESCRIPTION%%': description,
        '%%DATA_CITY%%': 'state-' + ab,
        '%%SLUG%%': 'states/' + ab,
        '%%MARKET_LABEL%%': escapeHtml(stateName),
        '%%MARKET_NAV%%': '<a href="/">Home</a> · <a href="/states/' + escapeHtml(ab) + '/">' + escapeHtml(stateName) + '</a>',
        '%%MAIN_HTML%%': mainHtml,
        '%%INLINE_SCRIPTS%%': '',
        '%%CANONICAL%%': buildCanonicalGlobal(siteUrl, 'states/' + ab),
        '%%HEAD_META%%': renderHeadMeta({ pageType: 'state-home', title, description, canonical: buildCanonicalGlobal(siteUrl, 'states/' + ab), brandName, section: 'State directory', keywords: [stateName, 'personal injury', 'directory'] }),
        '%%HEAD_JSON_LD%%': renderHeadJsonLdPiStateDirectory(siteUrl, brandName, ab, stateName, title, description, pageSet, listingsAgg),
        '%%FOOTER%%': footerHtml,
        '%%CONNECTION_BUBBLE%%': connectionBubbleHtml,
        '%%BRAND_NAME%%': escapeHtml(brandName),
        '%%OPTIONAL_TOP_NAV%%': (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
      });
      mapped = injectAdPlacements(mapped, ads, {
        verticalKey: 'pi',
        stateAbbr: ab
      });
      mapped = reorderMainSections(mapped, 'state');
      return mapped;
    }

    // Write all 50 state pages (unconditional)
    const piStateAbbrs = Object.keys(ALL_US_STATES || {});
    for (const ab of piStateAbbrs) {
      const html = renderPiStatePageHtml(ab);
      writeFileEnsured(outPathForPiState(ab), html);
      const stateName = String((ALL_US_STATES && ALL_US_STATES[ab] && ALL_US_STATES[ab].name) || ((states[ab] || {}).stateName) || ab);
      fanoutRecords.push(fanout.buildFanoutCluster({ verticalKey, pageKind: 'state', route: '/states/' + ab + '/', title: 'Personal injury lawyers in ' + stateName + ' — guide by city', stateName }, pageSet));
    }

    // Write PI state next-steps pages when enabled (sponsor-driven or global switch).
    for (const ab of piStateAbbrs) {
      const s = selectPiStateSponsor(ab);
      if (!shouldRenderDeterministicNextSteps(pageSet, { pageType: 'state', route: '/states/' + ab + '/' })) continue;
      const html = renderPiStateNextStepsPageHtml(ab, s);
      writeFileEnsured(outPathForPiStateNextSteps(ab), html);
    }

    // Optional PI hub route (/personal-injury/)
    const piHubFanoutCluster = fanout.buildFanoutCluster({ verticalKey, pageKind: 'global-detail', route: '/personal-injury/', title: 'Personal injury — browse by state' }, pageSet);
    const piHubFanoutHtml = fanout.renderFanoutClusterHtml(piHubFanoutCluster);
    const piHubRoutingHtml = renderInternalDistributionZoneHtml({
      kind: 'home',
      title: 'Personal injury — browse by state',
      buildIso: BUILD_ISO,
      guideLinks: selectPriorityGuideSummaries(globalPagesDir, 4).map((g) => ({ href: g.route, label: g.title, description: g.description })),
      primaryLinks: [
        { href: '/guides/', label: 'Guides hub', description: 'Start with the main decision paths.' },
        { href: '/faq/', label: 'FAQ', description: 'Clarify common PI questions quickly.' },
        { href: '/methodology/', label: 'Methodology', description: 'See neutrality and verification rules.' }
      ],
      cityLinks: []
    });
    const piHubMainHtml = (
      '<section class="section answer-block" data-home-answer="true" data-short-answer="true"><p class="kicker">State routing hub</p><h1>Personal injury: browse by state</h1><p class="muted">Educational only. No rankings. No endorsements.</p><h2>Short answer</h2><p>Use this hub when the question is still broad and you need to move into the right state page, guide, or local market before comparing firms.</p><p class="answer-when"><strong>Use this hub when:</strong> you need to move from a broad state question into the right state page, guide, or local market.</p><p class="answer-tradeoff"><strong>Common mistake:</strong> using a state browse page like a final answer instead of a routing layer.</p></section>' +
      marketsStatusListHtml +
      piHubRoutingHtml +
      (piHubFanoutHtml ? ('\n' + piHubFanoutHtml) : '')
    );
    const piHubHtml = replaceAll(baseTemplate, {
      '%%TITLE%%': 'Personal injury — browse by state',
      '%%DESCRIPTION%%': 'Browse personal injury guides and directories by U.S. state. Educational only. No rankings.',
      '%%DATA_CITY%%': '',
      '%%SLUG%%': 'personal-injury',
      '%%MARKET_LABEL%%': '',
      '%%MARKET_NAV%%': '',
      '%%MAIN_HTML%%': piHubMainHtml,
      '%%INLINE_SCRIPTS%%': '',
      '%%CANONICAL%%': buildCanonicalGlobal(siteUrl, 'personal-injury'),
      '%%HEAD_META%%': renderHeadMeta({ pageType: 'pi-hub', title: 'Personal injury — browse by state', description: 'Browse personal injury by state.', canonical: buildCanonicalGlobal(siteUrl, 'personal-injury'), brandName, section: 'Personal injury hub', keywords: ['personal injury', 'states', 'browse by state'] }),
      '%%HEAD_JSON_LD%%': renderHeadJsonLdGlobal(siteUrl, brandName, 'personal-injury', 'Personal injury — browse by state', 'Browse personal injury by state.', pageSet),
      '%%FOOTER%%': footerHtml,
      '%%CONNECTION_BUBBLE%%': '',
      '%%BRAND_NAME%%': escapeHtml(brandName),
      '%%OPTIONAL_TOP_NAV%%': (isPersonalInjury(verticalKey) ? '<a href="/personal-injury/">Personal Injury</a>' : '')
    });
    writeFileEnsured(outPathForGlobal('personal-injury'), piHubHtml);
    fanoutRecords.push(piHubFanoutCluster);
  }

  fanout.writeFanoutExport(OUT_DIR, fanoutRecords, pageSet, verticalKey);

  // Write build meta
  const coveragePlanningMeta = loadCoveragePlanningMeta();
  writeFileEnsured(path.join(OUT_DIR, "_build.json"), JSON.stringify({ buildIso: BUILD_ISO, pageSetFile, cities: cities.length, ...coveragePlanningMeta }, null, 2));

  console.log(`Built dist with pageSetFile=${pageSetFile}, cities=${cities.length}`);
}

build();
