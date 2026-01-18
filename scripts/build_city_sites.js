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

const REPO_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUT_DIR = path.join(REPO_ROOT, "dist");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");

const SITE_PATH = path.join(DATA_DIR, "site.json");
const STATES_PATH = path.join(DATA_DIR, "states.json");
const BASE_CITIES_PATH = path.join(DATA_DIR, "cities.json");
const ADS_PATH = path.join(DATA_DIR, "ad_placements.json");

const BUILD_ISO = new Date().toISOString();

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
  return Array.from(bySlug.values());
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

function renderHeadJsonLd(siteUrl, brandName, city, route, title, description, pageSet) {
  const ld = [
    buildOrganizationSchema(siteUrl, brandName),
    buildWebSiteSchema(siteUrl, brandName),
    buildWebPageSchema(siteUrl, brandName, city, route, title, description),
    buildBreadcrumbs(siteUrl, city, route, title)
  ];
  if ((route || "").replace(/^\/+|\/+$/g, "") === "faq") {
    const faq = getCityFaqItems(pageSet, city);
    const faqSchema = buildFaqSchema(faq);
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
  if ((route || "").replace(/^\/+|\/+$/g, "") === "faq") {
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
  return `
<section class="sponsor-stack" data-sponsor-stack="${escapeHtml(key)}">
  <div class="sponsor-label"><strong>Advertising</strong></div>
  <div class="sponsor-items">
    <div class="sponsor-card">
      <p class="sponsor-name"><a href="/for-providers/">Advertise here</a></p>
      <p class="sponsor-meta">Fixed placement • Clear disclosure</p>
    </div>
  </div>
</section>`.trim();
}
function injectAdPlacements(html, ads) {
  if (!ads || typeof ads !== "object") return html;
  return html.replace(/%%AD:([a-zA-Z0-9_\\-]+)%%/g, (m, key) => {
    if (!ads[key]) return m;
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
  return !!(sponsor && typeof sponsor === 'object' && sponsor.status === 'live' && sponsor.firm_name && sponsor.official_site_url && sponsor.intake_url);
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

function renderPiDirectoryTableHtml(listings, sponsorLive) {
  var rows = (listings || []).filter(function(x){ return x && x.display !== false; }).map(function(l){
    var name = l.name ? String(l.name) : 'Firm';
    var website = normalizeUrl(l.website || l.url);
    var websiteText = website ? escapeHtml(website) : '';
    return (
      '<tr>' +
      '<td class="pi-dir-name">' + escapeHtml(name) + '</td>' +
      '<td class="pi-dir-site"><span class="mono">' + websiteText + '</span></td>' +
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
  if (sponsorLive) {
    return (
      '<details class="pi-dir-collapsed" data-pi-dir-collapsed="true">' +
      '<summary>Other firms in this market (neutral list)</summary>' +
      '<div class="pi-dir-table-wrap">' +
      '<table class="pi-dir-table" role="table">' +
      '<thead><tr><th>Firm name</th><th>Official website</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>' +
      '</details>'
    );
  }

  return (
    '<div class="pi-dir-table-wrap">' +
    '<table class="pi-dir-table" role="table">' +
    '<thead><tr><th>Firm name</th><th>Official website</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>'
  );
}

function injectListings(html, listings, city, sponsor) {
  var sponsorLive = isSponsorLive(sponsor);

  // Replace PI primary CTA placeholder (only when sponsor is live)
  if (html.includes('%%PI_PRIMARY_CTA%%')) {
    html = html.split('%%PI_PRIMARY_CTA%%').join(sponsorLive ? renderPiPrimaryCtaHtml(city) : '');
  }

  // Render directory into verified-listings container
  var directoryHtml = '';
  if (sponsorLive) {
    directoryHtml += renderPiSponsoredModuleHtml(city, sponsor);
  }
  directoryHtml += renderPiDirectoryTableHtml(Array.isArray(listings) ? listings : [], sponsorLive);

  html = html.replace('<div id="verified-listings"></div>', '<div id="verified-listings">' + directoryHtml + '</div>');
  html = html.replace('<div id="other-listings"></div>', '<div id="other-listings"></div>');
  return html;
}

function renderInlineScripts(inlineScripts, city) {
  if (!inlineScripts || inlineScripts.length === 0) return "";
  return inlineScripts.map((code) => `<script>\n${applyCityTokens(code, city)}\n</script>`).join("\n\n");
}

function renderPage(baseTemplate, footerHtml, page, city, siteUrl, brandName, pageSet, sponsorsByStack, sponsor, listings, ads, verticalKey) {
  const route = applyCityTokens(page.route || "", city).replace(/^\/+|\/+$/g, "");
  const title = applyCityTokens(page.title, city).split("%%MARKET_LABEL%%").join(city.marketLabel);
  const description = applyCityTokens(page.description, city).split("%%MARKET_LABEL%%").join(city.marketLabel);

  let mainHtml = applyCityTokens(page.main_html, city);

  // Sponsor tokens (used by PI next-steps page; safe on all pages)
  const __sponsor = (sponsor || {});
  const __sponsorLive = isSponsorLive(__sponsor);
  mainHtml = mainHtml
    .split("%%SPONSOR_FIRM_NAME%%").join(__sponsorLive ? escapeHtml(String(__sponsor.firm_name)) : "")
    .split("%%SPONSOR_OFFICIAL_SITE_URL%%").join(__sponsorLive ? escapeHtml(String(normalizeUrl(__sponsor.official_site_url))) : "")
    .split("%%SPONSOR_INTAKE_URL%%").join(__sponsorLive ? escapeHtml(String(normalizeUrl(__sponsor.intake_url))) : "");


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

  // PI vertical is directory-only: defensively strip state lookup + CTA blocks if present.
  if (isPersonalInjury(verticalKey)) {
    mainHtml = stripPiOnlyDisallowedBlocks(mainHtml);
  }

  mainHtml = injectAdPlacements(mainHtml, ads);
  mainHtml = injectSponsors(mainHtml, sponsorsByStack);
  mainHtml = injectListings(mainHtml, listings, city, sponsor || {});

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
    "%%HEAD_JSON_LD%%": renderHeadJsonLd(siteUrl, brandName, city, route, title, description, pageSet),
    "%%FOOTER%%": footerHtml,
    "%%BRAND_NAME%%": escapeHtml(brandName)
  });
  return mapped;
}

function renderGlobalPage(baseTemplate, footerHtml, globalPage, siteUrl, brandName, pageSet, globalSponsorsByStack, marketsStatusListHtml, ads) {
  const route = (globalPage.route || "").replace(/^\/+|\/+$/g, "");
  const title = String(globalPage.title || "").split("%%BRAND_NAME%%").join(brandName);
  const description = String(globalPage.description || "");

  let mainHtml = String(globalPage.main_html || "").split("%%BRAND_NAME%%").join(brandName);

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

  mainHtml = injectAdPlacements(mainHtml, ads);
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
  const ads = readJson(ADS_PATH);

  const pageSetFile = site.pageSetFile || "starter_v1.json";
  const pageSet = loadPageSet(pageSetFile);
  const verticalKey = deriveVerticalKey(pageSetFile);

  const brandName = String(site.brandName || "Local Guides").trim();
  const siteUrl = String(site.siteUrl || "https://example.com").trim();

  const cities = loadCities(pageSet).map((c) => {
    const st = states[c.state] || {};
    return {
      ...c,
      stateName: c.stateName || st.stateName || "",
      stateSlug: c.stateSlug || st.stateSlug || ""
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

  const marketsStatusListHtml = buildMarketsStatusListHtml(cities);

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
      ads
    );
    writeFileEnsured(outPathForGlobal(route), html);
  }

  // Build city pages
  for (const city of cities) {
    const cityListings = listingsByCity ? (listingsByCity[city.slug] || []) : [];
    for (const p of (pageSet.pages || [])) {
      const route = applyCityTokens(p.route || "", city).replace(/^\/+|\/+$/g, "");
      const __sponsor = (sponsorByCity[city.slug] || {});
      const __sponsorLive = isSponsorLive(__sponsor);
      if (route === 'next-steps' && !__sponsorLive) {
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
        sponsorByCity[city.slug] || {},
        cityListings,
        ads,
        verticalKey
      );
      writeFileEnsured(outPathFor(city, route), html);
    }
  }

  // Write build meta
  writeFileEnsured(path.join(OUT_DIR, "_build.json"), JSON.stringify({ buildIso: BUILD_ISO, pageSetFile, cities: cities.length }, null, 2));

  console.log(`Built dist with pageSetFile=${pageSetFile}, cities=${cities.length}`);
}

build();
