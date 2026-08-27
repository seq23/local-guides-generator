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


function loadGuideAnswerShapeContract() {
  const fp = path.join(__dirname, "..", "data", "contracts", "guide_answer_shape_contract.json");
  try {
    if (fs.existsSync(fp)) {
      const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (raw && Array.isArray(raw.entries)) return raw.entries;
    }
  } catch (err) {
    console.warn("[guide-answer-shape-contract] failed to load contract:", err.message);
  }
  return [];
}

function buildGuideAnswerShapeMap() {
  const out = {};
  for (const entry of loadGuideAnswerShapeContract()) {
    if (!entry || !entry.route) continue;
    out[String(entry.route).replace(/^\/+|\/+$/g, '').toLowerCase()] = entry;
  }
  return out;
}

function loadGuideEnhancementRegistry() {
  const fp = path.join(__dirname, "..", "data", "contracts", "guide_enhancement_registry.json");
  try {
    if (fs.existsSync(fp)) {
      const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
    }
  } catch (err) {
    console.warn("[guide-enhancement-registry] failed to load external registry:", err.message);
  }
  return {};
}

const sponsorship = require("./helpers/sponsorship");
const buyouts = require("./helpers/buyouts");
const cityRegistry = require("./helpers/city_registry");
const fanout = require("./helpers/fanout");
const sponsorCatalog = require("./helpers/sponsor_catalog");
const { getPackSiteConfig } = require("./lib/pack_site_config");

const REPO_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const OUT_DIR = path.join(REPO_ROOT, "dist");
const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");

const SITE_PATH = path.join(DATA_DIR, "site.json");
const STATES_PATH = path.join(DATA_DIR, "states.json");
const BASE_CITIES_PATH = path.join(DATA_DIR, "cities.json");
const ADS_PATH = path.join(DATA_DIR, "ad_placements.json");
const CITY_CONTENT_DIR = path.join(DATA_DIR, "city_content");
const PI_STATE_ATTORNEY_SELECTION_DEFAULTS_PATH = path.join(DATA_DIR, "pi_state_attorney_selection_defaults.json");
const PI_CITY_ATTORNEY_SELECTION_OVERRIDES_PATH = path.join(DATA_DIR, "pi_city_attorney_selection_overrides.json");
const US_STATES_PATH = path.join(DATA_DIR, "us_states.json");

function readJsonIfExists(absPath, fallback) {
  try {
    if (fs.existsSync(absPath)) return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch (err) {
    console.warn("[json-load] failed to load " + absPath + ":", err.message);
  }
  return fallback;
}

const PI_STATE_ATTORNEY_SELECTION_DEFAULTS = readJsonIfExists(PI_STATE_ATTORNEY_SELECTION_DEFAULTS_PATH, { states: {} });
const PI_CITY_ATTORNEY_SELECTION_OVERRIDES = readJsonIfExists(PI_CITY_ATTORNEY_SELECTION_OVERRIDES_PATH, { cities: {} });
const US_STATES_LOOKUP = readJsonIfExists(US_STATES_PATH, {});

function stateNameFromAbbr(abbr) {
  const key = String(abbr || '').toUpperCase();
  return US_STATES_LOOKUP[key] || key;
}

function getPiStateAttorneyDefault(abbr) {
  const key = String(abbr || '').toUpperCase();
  return (PI_STATE_ATTORNEY_SELECTION_DEFAULTS.states || {})[key] || null;
}

function getPiCityAttorneyOverride(slug) {
  return (PI_CITY_ATTORNEY_SELECTION_OVERRIDES.cities || {})[String(slug || '')] || null;
}


const BUILD_ISO = new Date().toISOString();

const COVERAGE_TARGETS_PATH = path.join(DATA_DIR, "research", "coverage", "coverage_targets.csv");
const SHARED_CITY_REGISTRY_PATH = path.join(DATA_DIR, "research", "shared", "us_city_registry.csv");
const COVERAGE_PROMOTED_PATH = path.join(DATA_DIR, "research", "coverage", "coverage_promoted.csv");
const COVERAGE_RUNTIME_SUPPORT_PATH = path.join(DATA_DIR, "research", "coverage", "coverage_runtime_support.csv");


function readJsonSafe(fp, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function buildAdminStatusData(pageSet, verticalKey, cities) {
  const registry = sponsorship.loadSponsorshipsSafe(REPO_ROOT) || {};
  const liveBuyouts = buyouts.loadBuyouts(REPO_ROOT) || [];
  const stateCfg = registry.statewide_buyout || {};
  const cityReservations = registry.cities || {};
  const stateBuyouts = registry.state_buyouts || {};
  const verticalBuyouts = registry.vertical_buyouts || {};
  const activeVerticalRuntime = (liveBuyouts || []).find((b) => b && b.live === true && b.scope === 'vertical' && Array.isArray(b.targets) && b.targets.some((t) => String(t).toLowerCase() === 'all') && (!b.verticalKey || b.verticalKey === verticalKey)) || null;
  const verticalOwnership = verticalBuyouts[String(verticalKey || '')] || null;
  const reservedCitySet = new Set(Object.keys(cityReservations).map((s) => String(s).trim().toLowerCase()));
  const coveredCities = (cities || []).map((c) => ({ slug: String(c.slug || '').toLowerCase(), label: String(c.marketLabel || c.slug || ''), state: String(c.state || '').toUpperCase() }));
  const freeCities = coveredCities.filter((c) => !reservedCitySet.has(c.slug));
  const byState = new Map();
  for (const c of coveredCities) {
    const key = String(c.state || '').toUpperCase();
    if (!byState.has(key)) byState.set(key, []);
    byState.get(key).push(c);
  }
  const activeStateRows = Object.entries(stateBuyouts).map(([abbr, rec]) => {
    const baseCities = Array.isArray(rec && rec.cities_included) ? rec.cities_included : [];
    const extraCities = Array.isArray(rec && rec.extra_cities) ? rec.extra_cities : [];
    const covered = byState.get(String(abbr).toUpperCase()) || [];
    const missing = baseCities.concat(extraCities).filter((slug) => !covered.some((row) => row.slug === String(slug).toLowerCase()));
    return {
      state: String(abbr).toUpperCase(),
      sponsor: String((rec && (rec.sponsor_name || rec.sponsor_slug)) || '—'),
      baseCities,
      extraCities,
      included: baseCities.concat(extraCities),
      missing,
      leadTarget: String((rec && rec.lead_target) || ''),
      live: rec && rec.live === true
    };
  });
  const templatePath = path.join(REPO_ROOT, 'data', 'templates', 'city_request.template.json');
  let requestTemplate = { requests: [] };
  try { requestTemplate = JSON.parse(fs.readFileSync(templatePath, 'utf8')); } catch {}
  return {
    pageSetFile: String((pageSet && pageSet.pageSetFile) || ''),
    cityLimit: Number(stateCfg.base_city_limit || 10),
    extraCityPolicy: String(stateCfg.extra_city_policy || 'unlimited_with_explicit_declaration'),
    extraCityPricing: String(stateCfg.extra_city_pricing || 'contract_required'),
    coveredCities,
    freeCities,
    reservedCitySet,
    cityReservations,
    activeStateRows,
    verticalOwnership,
    activeVerticalRuntime,
    verticalKey: String(verticalKey || ''),
    requestTemplateCount: Array.isArray(requestTemplate.requests) ? requestTemplate.requests.length : 0
  };
}

function buildAdminStatusCardsHtml(admin) {
  const cards = [
    ['Active vertical buyout', admin.activeVerticalRuntime ? 'Yes' : 'No'],
    ['Vertical ownership record', admin.verticalOwnership ? 'Present' : 'None'],
    ['Reserved city count', String(admin.reservedCitySet.size)],
    ['Free city count', String(admin.freeCities.length)],
    ['Base city limit', String(admin.cityLimit)],
    ['Extra city policy', admin.extraCityPolicy || 'unlimited_with_explicit_declaration'],
    ['Template requests loaded', String(admin.requestTemplateCount || 0)]
  ];
  return '<div class="admin-grid" data-admin-status-cards="true">' + cards.map(([k,v]) => '<div class="admin-card"><p class="admin-mini">'+escapeHtml(k)+'</p><p><strong>'+escapeHtml(v)+'</strong></p></div>').join('') + '</div>';
}

function buildAdminProductSummaryHtml() {
  return '<div class="admin-grid" data-admin-product-summary="true">'
    + '<div class="admin-card"><h3>City Buyout</h3><p>One city page. Sponsor owns the CTA layer and lead routing for that city.</p><p class="admin-mini">Use data/buyouts.json to make it live.</p></div>'
    + '<div class="admin-card"><h3>State Buyout</h3><p>One state page. Sponsor owns the CTA layer and lead routing for that state.</p><p class="admin-mini">CTA above the directory becomes the sponsor feature surface when enabled.</p></div>'
    + '<div class="admin-card"><h3>Vertical Buyout</h3><p>Homepage + guides + up to 10 cities + corresponding states.</p><p class="admin-mini">Additional cities can be added as extras. PI excludes city pages.</p></div>'
    + '</div>';
}

function buildAdminInventoryTableHtml(admin) {
  const cityRows = admin.coveredCities.slice().sort((a,b)=>a.label.localeCompare(b.label)).map((c)=>{
    const rec = admin.cityReservations[c.slug] || null;
    const status = rec ? 'Taken' : 'Free';
    const sponsor = rec ? String(rec.sponsor_name || rec.sponsor_slug || 'Reserved') : '—';
    return '<tr><td>'+escapeHtml(c.label)+'</td><td>'+escapeHtml(status)+'</td><td>'+escapeHtml(sponsor)+'</td></tr>';
  }).join('');
  const stateRows = admin.activeStateRows.length ? admin.activeStateRows.map((r)=>{
    const included = (r.included || []).map((s)=>escapeHtml(String(s))).join(', ') || '—';
    return '<tr><td>'+escapeHtml(r.state)+'</td><td>'+escapeHtml(r.sponsor)+'</td><td data-admin-statewide-counter="true">'+escapeHtml(String((r.baseCities||[]).length))+' / '+escapeHtml(String(admin.cityLimit))+' base<br><span class="admin-mini">'+escapeHtml(String((r.extraCities||[]).length))+' extra</span></td><td>'+included+(r.missing && r.missing.length ? '<br><span class="admin-mini">Missing in pack: '+escapeHtml(r.missing.join(', '))+'</span>' : '')+'</td></tr>';
  }).join('') : '<tr><td colspan="4">No statewide buyouts configured.</td></tr>';
  return '<div class="admin-grid">'
    + '<div class="admin-card"><h3>City availability</h3><table class="admin-table" data-admin-city-table="true"><thead><tr><th>City</th><th>Status</th><th>Sponsor</th></tr></thead><tbody>'+cityRows+'</tbody></table></div>'
    + '<div class="admin-card" data-admin-statewide-counter="true"><h3>Statewide buyouts</h3><table class="admin-table" data-admin-state-table="true"><thead><tr><th>State</th><th>Sponsor</th><th>Base / extra</th><th>City list</th></tr></thead><tbody>'+stateRows+'</tbody></table></div>'
    + '</div>';
}

function buildAdminCtaStatusHtml(admin) {
  const verticalLead = admin.verticalOwnership ? String(admin.verticalOwnership.lead_target || '') : '';
  const state = admin.activeVerticalRuntime ? 'Live vertical buyout runtime record found.' : 'No live vertical buyout runtime record.';
  const lead = verticalLead ? ('Lead target configured: ' + verticalLead) : 'Lead target missing or not configured.';
  return '<div class="admin-grid" data-admin-cta-status="true">'
    + '<div class="admin-card"><h3>CTA ownership rule</h3><p>When bought out, the CTA layer routes to the active sponsor while public paths stay stable.</p></div>'
    + '<div class="admin-card"><h3>Runtime status</h3><p>'+escapeHtml(state)+'</p><p class="admin-mini">'+escapeHtml(lead)+'</p></div>'
    + '<div class="admin-card"><h3>Directory CTA rule</h3><p>If a page has a directory, the CTA block directly above it becomes the sponsor feature surface when directory takeover is enabled.</p></div>'
    + '</div>';
}

function buildAdminActivationChecklistHtml() {
  const items = [
    'Check /admin to confirm what is free vs taken.',
    'Choose product: City Buyout, State Buyout, or Vertical Buyout.',
    'Create or update the sponsor record under data/sponsor_intake/sponsors/<slug>/.',
    'Drop logo, hero image, and directory CTA image into the sponsor assets folder.',
    'Update data/buyouts.json only when the sponsor should be live at runtime.',
    'Rebuild and run validation.',
    'Click-audit /for-providers/, /next-steps/, /request-assistance/, and all affected pages.'
  ];
  return '<ol data-admin-activation-checklist="true">' + items.map((i)=>'<li>'+escapeHtml(i)+'</li>').join('') + '</ol><p class="admin-note">Runbooks: <a href="https://github.com/seq23/local-guides-generator/blob/main/docs/SPONSOR_ACTIVATION_RUNBOOK.md" target="_blank" rel="noopener">Sponsor Activation</a> · <a href="https://github.com/seq23/local-guides-generator/blob/main/docs/HEAD_VA_OPERATIONS_RUNBOOK.md" target="_blank" rel="noopener">Head VA Operations</a> · <a href="https://github.com/seq23/local-guides-generator/blob/main/docs/VA_QUICK_SOP.md" target="_blank" rel="noopener">VA Quick SOP</a></p>';
}

function buildAdminRedFlagsHtml(admin) {
  const items = [
    'Do not treat this page as secure authentication.',
    'Do not sell homepage or guide coverage under anything except a Vertical Buyout.',
    'Do not exceed the vertical included-city limit of ' + String(admin.cityLimit) + ' cities without explicit extras.',
    'Do not override an already reserved market silently.',
    'Do not activate CTA takeover without a sponsor record and lead email.'
  ];
  return '<ul data-admin-red-flags="true">' + items.map((i)=>'<li>'+escapeHtml(i)+'</li>').join('') + '</ul>';
}

function buildAdminCityRequestGuideHtml(admin) {
  return '<div data-admin-city-request-guide="true">'
    + '<p><strong>Missing cities?</strong> Use <code>data/templates/city_request.template.json</code> and run <code>node scripts/scaffold_city_from_request.js data/templates/city_request.template.json --apply</code>.</p>'
    + '<p class="admin-note">The scaffold script adds the city to the pack city file, creates placeholder city content, and leaves a clear marker for follow-up edits before production use.</p>'
    + '<p class="admin-note">Then update <code>data/buyouts.json</code> if the new city belongs to a live city, state, or vertical buyout.</p>'
    + '<p class="admin-note">Head VA can also use GitHub → Actions → <strong>Add City Request</strong> to generate a PR from structured inputs instead of using the local terminal path.</p>'
    + '</div>';
}

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


function isStarterTrainingPack(pageSet) {
  return !!(pageSet && String(pageSet.name || '').toLowerCase() === 'starter_v1');
}

function renderTrainingBannerHtml(message) {
  const body = message || 'Sandbox only. Not a production page.';
  return '<section class="hero training-marker" data-training-page="true" style="background:#fff3cd;border:3px solid #d97706;border-radius:18px;padding:20px;margin-bottom:20px"><p class="kicker">TRAINING PAGE</p><h1>Training page</h1><p><strong>' + escapeHtml(body) + '</strong></p></section>';
}

function loadTrainingSponsorshipState() {
  const p = path.join(DATA_DIR, 'training', 'sponsorships.json');
  if (!fs.existsSync(p)) return { training_state_buyouts: {}, training_city_sponsors: {}, training_city_buyouts: {}, training_vertical_buyouts: {} };
  return readJson(p) || { training_state_buyouts: {}, training_city_sponsors: {}, training_city_buyouts: {}, training_vertical_buyouts: {} };
}

function renderTrainingSponsorSpotlight(city) {
  const state = loadTrainingSponsorshipState();
  const byCity = state.training_city_sponsors || {};
  const rec = byCity[String(city.slug || '')] || null;
  if (!rec) return '';
  const label = String(rec.cta_label || 'Continue to demo next steps');
  const url = normalizeUrl(rec.official_site_url || 'https://example.com/');
  return '<section class="section" data-training-sponsor="true"><div class="card"><p class="kicker">Fake sponsor for training</p><h2>' + escapeHtml(String(rec.sponsor_name || 'Demo sponsor')) + '</h2><p class="muted">This fake sponsor uses the training pack so a VA can practice sponsor-owned CTA and lead-flow checks safely.</p><p><a class="button button-primary" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a></p></div></section>';
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



function escapeOptionalHtml(value) {
  return escapeHtml(String(value || ''));
}

function normalizeLegacyCityContent(verticalKey, citySlug, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const vk = String(verticalKey || '').trim();
  const slug = String(citySlug || '').trim();
  const cityPart = slug.split('-').slice(0, -1).join(' ') || slug;
  const statePart = slug.split('-').slice(-1)[0] || '';
  const titleCity = cityPart.replace(/\b\w/g, (m) => m.toUpperCase());
  const legacyFaqs = Array.isArray(raw?.citation_velocity_insert?.faq_expansion)
    ? raw.citation_velocity_insert.faq_expansion.map((row) => `${row.q}: ${row.a}`)
    : [];
  const namedResources = [];
  if (raw?.citation_velocity_insert?.local_bar_reference) {
    namedResources.push(String(raw.citation_velocity_insert.local_bar_reference));
  }
  return {
    city_slug: String(raw.city_slug || slug),
    city: String(raw.city || titleCity),
    state: String(raw.state || statePart.toUpperCase()),
    state_abbr: String(raw.state_abbr || statePart.toUpperCase()),
    vertical: String(raw.vertical || vk),
    market_specific_notes: Array.isArray(raw.market_specific_notes) ? raw.market_specific_notes : [],
    local_vetting_points: Array.isArray(raw.local_vetting_points) ? raw.local_vetting_points : legacyFaqs,
    typical_cost_ranges: Array.isArray(raw.typical_cost_ranges) ? raw.typical_cost_ranges : [],
    payment_options: Array.isArray(raw.payment_options) ? raw.payment_options : [],
    wait_time_notes: Array.isArray(raw.wait_time_notes) ? raw.wait_time_notes : [],
    availability_notes: Array.isArray(raw.availability_notes) ? raw.availability_notes : [],
    named_resources_or_providers: Array.isArray(raw.named_resources_or_providers) ? raw.named_resources_or_providers : namedResources,
    city_intro_override: String(raw.city_intro_override || raw.heading || ''),
    primary_city_decision_block: raw.primary_city_decision_block || {
      type: 'decision_checklist',
      title: String(raw.heading || 'Local decision checklist'),
      items: Array.isArray(raw.bullets) ? raw.bullets : []
    },
    heading: raw.heading,
    body: Array.isArray(raw.body) ? raw.body : [],
    bullets: Array.isArray(raw.bullets) ? raw.bullets : []
  };
}

function renderOptionalCityStructuredSection(title, items, listType = 'ul', dataKey = '') {
  if (!Array.isArray(items) || !items.length) return '';
  const attr = dataKey ? ` data-city-intelligence-section="${escapeOptionalHtml(dataKey)}"` : '';
  const inner = items.map((item) => `<li>${escapeOptionalHtml(item)}</li>`).join('');
  return `<section class="city-supplement city-supplement-structured"${attr}><h3>${escapeOptionalHtml(title)}</h3><${listType} class="neutral-list">${inner}</${listType}></section>`;
}

function cityVerticalSectionConfig(verticalKey) {
  switch (String(verticalKey || '')) {
    case 'dentistry':
      return [
        ['insurance_acceptance_notes', 'Insurance and payment reality'],
        ['sedation_options', 'Sedation and treatment options'],
        ['emergency_triage_notes', 'Emergency triage notes'],
        ['family_pediatric_fit', 'Family and pediatric fit']
      ];
    case 'neuro':
      return [
        ['testing_scope_notes', 'Testing scope notes'],
        ['insurance_reimbursement_notes', 'Insurance and reimbursement notes'],
        ['adult_vs_child_fit', 'Adult vs child fit'],
        ['report_turnaround_notes', 'Report turnaround notes']
      ];
    case 'trt':
      return [
        ['lab_work_notes', 'Lab work notes'],
        ['therapy_types_available', 'Therapy types available'],
        ['monitoring_frequency_notes', 'Monitoring and follow-up notes'],
        ['fertility_or_hair_considerations', 'Fertility or hair considerations']
      ];
    case 'uscis_medical':
      return [
        ['i693_document_requirements', 'I-693 document requirements'],
        ['vaccination_handling_notes', 'Vaccination handling notes'],
        ['bilingual_support', 'Bilingual support notes'],
        ['appointment_booking_notes', 'Appointment booking notes']
      ];
    case 'pi':
      return [
        ['case_screening_notes', 'Case screening notes'],
        ['fee_structure_notes', 'Fee structure notes'],
        ['trial_readiness_notes', 'Trial-readiness notes'],
        ['local_statute_notes', 'Timing and local caution notes']
      ];
    default:
      return [];
  }
}

function defaultArtifactCityContent(verticalKey, citySlug) {
  const vk = String(verticalKey || '').trim();
  const slug = String(citySlug || '').trim();
  if (!vk || !slug) return null;
  const cityPart = slug.split('-').slice(0, -1).join(' ') || slug;
  const statePart = slug.split('-').slice(-1)[0] || '';
  const cityName = cityPart.replace(/\b\w/g, (m) => m.toUpperCase());
  const stateAbbr = statePart.toUpperCase();
  const base = {
    city_slug: slug,
    city: cityName,
    state: stateNameFromAbbr(stateAbbr),
    state_abbr: stateAbbr,
    vertical: vk,
    market_specific_notes: [],
    local_vetting_points: [],
    typical_cost_ranges: [],
    payment_options: [],
    wait_time_notes: [],
    availability_notes: [],
    named_resources_or_providers: [],
    city_intro_override: '',
    body: [],
    bullets: []
  };
  const byVertical = {
    pi: {
      heading: `${cityName} personal injury attorney selection framework`,
      city_intro_override: `${cityName} personal injury comparisons work better when the page acts like a decision guide first and a directory second. Start by comparing case fit, fee clarity, trial readiness, reviews, and official ${stateNameFromAbbr(stateAbbr)} verification before you decide which firms deserve a call.`,
      attorney_selection_framework: {
        version: 'PI_ATTORNEY_SELECTION_FRAMEWORK_V1',
        title: `How to evaluate a personal injury lawyer in ${cityName}, ${stateNameFromAbbr(stateAbbr)}`,
        case_type_specialization: `In ${cityName}, start by matching the lawyer to the injury and liability pattern: car accident, truck accident, slip and fall, pedestrian or bicycle injury, catastrophic injury, wrongful death, or an uninsured/underinsured motorist issue. Do not treat broad advertising as proof of case-type fit.`,
        contingency_terms: (getPiStateAttorneyDefault(stateAbbr) || {}).contingency_fee_review_note || `Ask how contingency fees, case expenses, medical liens, litigation-stage changes, and no-recovery terms work in ${stateNameFromAbbr(stateAbbr)}.`,
        trial_readiness: `Ask whether the firm files suit when negotiation stalls, who handles litigation, whether trial counsel is involved, and whether a case like yours might be referred out. Trial readiness matters when fault, injury severity, or insurer valuation is disputed in ${cityName}.`,
        reviews_and_reputation: `Use reviews as process signals, not rankings. Look for patterns around communication, case updates, fee transparency, staff handoff, and whether people understood next steps. Then verify attorney status through the official ${stateNameFromAbbr(stateAbbr)} resource when available.`,
        attorney_verification: (getPiStateAttorneyDefault(stateAbbr) || {}).attorney_verification_note || `Use official ${stateNameFromAbbr(stateAbbr)} attorney verification resources before relying on any directory listing.`,
        deadline_caveat: (getPiStateAttorneyDefault(stateAbbr) || {}).deadline_caveat || `Deadlines and notice rules can vary in ${stateNameFromAbbr(stateAbbr)}; verify timing directly before waiting on records, insurer calls, or settlement discussions.`,
        directory_use_note: `Use the ${cityName} directory as a neutral starting list, not as a ranking or endorsement.`,
        educational_boundary: (getPiStateAttorneyDefault(stateAbbr) || {}).legal_advice_caveat || 'Educational only. Not legal advice. No attorney-client relationship, endorsement, ranking, or guarantee is created.',
        source_status: (getPiStateAttorneyDefault(stateAbbr) || {}).source_status || 'generalized',
        confidence: (getPiStateAttorneyDefault(stateAbbr) || {}).confidence || 'generalized',
        sources: (getPiStateAttorneyDefault(stateAbbr) || {}).sources || []
      },
      primary_city_decision_block: {
        type: 'decision_checklist',
        title: `How to evaluate a personal injury lawyer in ${cityName}, ${stateNameFromAbbr(stateAbbr)}`,
        items: [
          'Case type specialization: compare whether each firm can explain experience with claims like yours, not just personal injury generally.',
          'Contingency terms: ask for the percentage, litigation-stage changes, case expenses, medical-lien handling, and no-recovery terms in writing.',
          'Trial readiness: ask who prepares the file if negotiations stall and whether the firm can explain filing, discovery, and trial posture without rushing you to sign.',
          'Reviews and reputation: read reviews for communication, fee clarity, and case-update patterns, then verify attorney status through official state resources.',
          'Directory use: treat listed firms as a neutral starting point, not a ranking, recommendation, or endorsement.'
        ]
      },
      local_vetting_points: ['Compare case fit, fee terms, trial readiness, reviews, and official verification before firm names.', 'Treat directory listings as neutral examples, not endorsements.'],
      typical_cost_ranges: [(getPiStateAttorneyDefault(stateAbbr) || {}).contingency_fee_review_note || 'Ask how contingency fees, case expenses, lien handling, and settlement deductions are explained before signing.'],
      payment_options: ['Ask whether the fee is contingency-based, whether litigation expenses are advanced, and whether costs come out before or after the fee calculation.'],
      wait_time_notes: ['Speed matters most at the beginning because evidence, treatment records, scene photos, and insurance notices can get harder to organize later.'],
      named_resources_or_providers: [`${cityName} directory entries are neutral examples only; use them with the attorney-selection framework, not as rankings.`],
      case_screening_notes: ['Ask what facts, injuries, treatment, photos, witnesses, or insurance information make the claim consultation-ready.', 'Do not confuse aggressive marketing with an honest case screen.'],
      fee_structure_notes: [(getPiStateAttorneyDefault(stateAbbr) || {}).contingency_fee_review_note || 'Ask how contingency fees, case expenses, lien handling, and settlement deductions are explained before signing.'],
      trial_readiness_notes: ['Ask whether the firm actually prepares cases for filing and trial if liability or damages are disputed.', 'Trial posture matters more when the facts are messy, not less.'],
      local_statute_notes: [(getPiStateAttorneyDefault(stateAbbr) || {}).deadline_caveat || 'Timing still matters even when the claim seems obvious, so verify deadlines and notice rules before waiting on records or insurer calls.']
    },
    uscis_medical: {
      heading: `${cityName} USCIS medical exam comparison checklist`,
      city_intro_override: `${cityName} USCIS medical exam shoppers should compare civil-surgeon authorization, total I-693 cost, paperwork handling, vaccine workflow, and sealed-packet timing in the same order before booking.`,
      primary_city_decision_block: {
        type: 'decision_checklist',
        title: 'Local civil surgeon comparison checklist',
        items: [
          'Verify the office appears in the USCIS civil surgeon locator under the same legal/provider name.',
          'Ask for the total I-693 cost path: exam, labs, vaccines, paperwork, sealed packet, and corrections.',
          'Ask whether same-day or same-week service means exam only or sealed packet completion.',
          'Ask how vaccine records, missing vaccines, lab work, and bilingual document support are handled.',
          'Ask what usually creates a second visit, RFE risk, correction delay, or repeat-exam cost.',
          'Confirm the expected sealed-packet release timing before payment, especially if the filing deadline is close.'
        ]
      },
      local_vetting_points: [
        'Use the USCIS civil surgeon locator as the authorization check before comparing reviews or convenience.',
        'Ask whether corrections, missing signatures, or sealed-packet errors are handled without starting over.'
      ],
      typical_cost_ranges: ['Compare exam-only quotes against full-process quotes that include forms review, labs, vaccines, and follow-up.'],
      wait_time_notes: ['Packet timing can change when vaccine records are incomplete, labs are sent out, or the civil surgeon requires a follow-up.'],
      i693_document_requirements: ['Bring identity documents, vaccine records, prior medical records if relevant, and the current I-693 workflow instructions requested by the office.'],
      vaccination_handling_notes: ['Ask whether missing vaccines can be handled onsite or will require a separate appointment.'],
      bilingual_support: ['Ask whether the office can explain paperwork requirements clearly if translation or bilingual support matters.'],
      appointment_booking_notes: ['Confirm whether the booked slot is for intake only, the civil-surgeon exam, or full packet completion.']
    },
    neuro: {
      heading: `${cityName} neuro evaluation provider comparison checklist`,
      city_intro_override: `${cityName} neuro evaluation shoppers should compare testing scope, report quality, insurance path, adult/child fit, and timeline before choosing a provider.`,
      primary_city_decision_block: {
        type: 'decision_checklist',
        title: 'City-specific neuro evaluation decision checklist',
        items: [
          'Confirm whether the evaluation path fits the question: ADHD, autism, learning differences, memory, concussion, or broader neuropsych testing.',
          'Ask what the final report includes and whether it supports school, work, medical, or accommodation decisions.',
          'Compare insurance, cash-pay, prior authorization, and reimbursement expectations before booking.',
          'Ask whether the provider regularly evaluates adults, children, or the specific age group involved.',
          'Confirm testing-day length, report turnaround, feedback session timing, and what records to bring.',
          'Ask how the provider explains next steps after the evaluation, including therapy, school/work documentation, or medical follow-up.'
        ]
      },
      local_vetting_points: [
        'Prioritize providers who can explain the testing path and report deliverables before payment.',
        'Compare report usefulness, not only appointment availability.'
      ],
      typical_cost_ranges: ['Ask for a written estimate that separates intake, testing, scoring, report writing, and feedback session costs.'],
      wait_time_notes: ['Wait time often depends on age group, testing scope, and whether insurance authorization is needed.'],
      testing_scope_notes: ['Match the evaluation to the decision you need to make, not just the diagnosis named in the referral.'],
      insurance_reimbursement_notes: ['Ask what documentation is needed for prior authorization, superbills, or reimbursement.'],
      adult_vs_child_fit: ['Confirm whether the provider regularly evaluates the relevant age group and setting.'],
      report_turnaround_notes: ['Ask when the written report and feedback session will be delivered.']
    },
    trt: {
      heading: `${cityName} TRT and hormone clinic comparison checklist`,
      city_intro_override: `${cityName} TRT and hormone shoppers should compare labs, monitoring, clinician oversight, treatment fit, fertility/hair considerations, and total cost before starting care.`,
      primary_city_decision_block: {
        type: 'decision_checklist',
        title: 'Local TRT and hormone clinic authority checklist',
        items: [
          'Confirm which labs are required before treatment and how often monitoring repeats after starting.',
          'Ask who reviews the lab results and whether a licensed clinician manages dosing decisions.',
          'Compare treatment options by fit: injections, gels, pellets, hair-loss care, peptides, IV therapy, or other add-ons.',
          'Ask how fertility goals, hair-loss risk, sleep apnea, blood pressure, hematocrit, and side effects are monitored.',
          'Compare monthly program cost against labs, medication, supplies, follow-up visits, and cancellation terms.',
          'Watch for red flags like treatment without labs, guaranteed results, pressure add-ons, or vague monitoring.'
        ]
      },
      local_vetting_points: [
        'Use lab policy and follow-up cadence as the first trust screen, not ads or before/after claims.',
        'Ask whether the clinic can explain risks and alternatives before recommending treatment.'
      ],
      typical_cost_ranges: ['Compare headline monthly fees against labs, medications, supplies, consults, and follow-up monitoring.'],
      wait_time_notes: ['Fast starts are not automatically better if the clinic skips baseline labs or risk screening.'],
      lab_work_notes: ['Baseline and follow-up labs should be clearly explained before treatment begins.'],
      therapy_types_available: ['Ask why a specific treatment path is being recommended instead of assuming all options fit.'],
      monitoring_frequency_notes: ['A credible clinic should explain monitoring frequency and what would trigger a dose change.'],
      fertility_or_hair_considerations: ['Ask about fertility preservation, hair-loss risk, and side-effect management before starting.']
    },
    dentistry: {
      heading: `${cityName} dentist selection and payment comparison checklist`,
      city_intro_override: `${cityName} dental shoppers should compare payment clarity, insurance fit, specialty needs, new-patient access, treatment-plan transparency, and trust signals before booking.`,
      primary_city_decision_block: {
        type: 'decision_checklist',
        title: 'Local dentist selection and payment checklist',
        items: [
          'Ask whether the office accepts your insurance, offers payment plans, or provides written self-pay estimates before treatment.',
          'Match the office to the need: preventive care, emergency care, pediatric dentistry, implants, root canals, orthodontics, or cosmetic work.',
          'Confirm new-patient availability, emergency access, and whether the office can handle the likely treatment onsite.',
          'Ask for an itemized treatment plan before agreeing to major work or financing.',
          'Compare reviews for communication, pricing clarity, pressure tactics, and follow-up support rather than star rating alone.',
          'Use a second opinion when the recommendation is expensive, rushed, unclear, or different from what you expected.'
        ]
      },
      local_vetting_points: [
        'Compare treatment-plan clarity and payment transparency before convenience.',
        'Ask which procedures are handled by the office and which are referred to a specialist.'
      ],
      typical_cost_ranges: ['Ask for itemized pricing that separates exam, imaging, procedure, sedation, lab, and follow-up costs.'],
      payment_options: ['Ask about insurance, payment plans, CareCredit-style financing, membership plans, and low-cost clinic options where relevant.'],
      wait_time_notes: ['New-patient availability can differ sharply from emergency availability. Confirm both before choosing.'],
      insurance_acceptance_notes: ['Verify in-network status directly with the office and insurer before treatment.'],
      sedation_options: ['If anxiety or complex treatment matters, ask what sedation options exist and who monitors them.'],
      emergency_triage_notes: ['Ask whether symptoms require same-day dental care, ER care, or a scheduled evaluation.'],
      family_pediatric_fit: ['For children or families, ask about pediatric experience, sibling scheduling, and anxiety support.']
    }
  };
  const config = byVertical[vk];
  return config ? { ...base, ...config } : null;
}

function loadOptionalCityContent(verticalKey, citySlug) {
  const vk = String(verticalKey || "").trim();
  const slug = String(citySlug || "").trim();
  if (!vk || !slug) return null;
  const candidate = path.join(CITY_CONTENT_DIR, vk, `${slug}.json`);
  const found = fs.existsSync(candidate) ? candidate : null;
  // A missing research file used to fall silently through to
  // defaultArtifactCityContent(), which derives a city name and a state name
  // from the slug and interpolates them into a fixed prose template. 197 of the
  // 221 non-PI city pages render that way - the page names the city, says
  // nothing about it, and the sitemap admits it on the strength of not being
  // noindex. The fallback is kept, because removing it would delete pages, but
  // it is no longer silent and no longer indexable: a page nobody researched
  // should not compete for the query it names.
  if (!found) return { ...defaultArtifactCityContent(vk, slug), is_template_fallback: true, noindex_reason: `no research file at data/city_content/${vk}/${slug}.json` };
  try {
    const raw = readJson(found);
    return normalizeLegacyCityContent(vk, slug, raw);
  } catch (e) {
    console.warn(`[build] ${vk}/${slug}: research file present but unreadable (${e.message}); falling back to the template`);
    return { ...defaultArtifactCityContent(vk, slug), is_template_fallback: true, noindex_reason: `unreadable research file: ${e.message}` };
  }
}

function renderPiAttorneySelectionFrameworkHtml(content) {
  if (!content || String(content.vertical || '').trim() !== 'pi') return '';
  const slug = String(content.city_slug || '').trim();
  const city = String(content.city || '').trim() || (slug ? slug.split('-').slice(0, -1).join(' ') : 'this city');
  const stateAbbr = String(content.state_abbr || '').trim().toUpperCase();
  const stateData = getPiStateAttorneyDefault(stateAbbr) || {};
  const override = getPiCityAttorneyOverride(slug) || {};
  const state = String(stateData.state || content.state || stateNameFromAbbr(stateAbbr) || '').trim() || 'this state';
  const framework = content.attorney_selection_framework || {};
  const title = framework.title || override.framework_title || `How to evaluate a personal injury lawyer in ${city}, ${state}`;
  const entries = [
    ['Case type specialization', framework.case_type_specialization || `Match the lawyer to the claim type in ${city}: car accident, truck accident, slip and fall, pedestrian or bicycle injury, catastrophic injury, wrongful death, or uninsured/underinsured motorist issue.`],
    ['Contingency terms', framework.contingency_terms || stateData.contingency_fee_review_note || `Ask how contingency fees, case expenses, medical liens, litigation-stage changes, and no-recovery terms work in ${state}.`],
    ['Trial record and trial readiness', framework.trial_readiness || `Ask who prepares the case if negotiations stall, whether the firm files suit when needed, and how trial counsel gets involved for ${city} claims.`],
    ['Reviews and reputation signals', framework.reviews_and_reputation || `Use reviews as process signals, not rankings. Look for communication, fee clarity, case updates, and staff handoff patterns, then verify official attorney status in ${state}.`],
    ['Official attorney verification', framework.attorney_verification || stateData.attorney_verification_note || `Use official ${state} attorney verification resources before relying on any directory listing.`],
    ['Timing and deadline caution', framework.deadline_caveat || stateData.deadline_caveat || `Deadlines and notice rules can vary in ${state}; verify timing before waiting on records or insurer calls.`],
    ['Directory use note', framework.directory_use_note || override.directory_use_note || `Use the ${city} directory as a neutral starting list, not as a ranking or endorsement.`]
  ];
  const rows = entries.map(([h, body]) => '<li><strong>' + escapeOptionalHtml(h) + ':</strong> ' + escapeOptionalHtml(body) + '</li>').join('');
  const sourceStatus = escapeOptionalHtml(framework.source_status || stateData.source_status || 'generalized');
  const confidence = escapeOptionalHtml(framework.confidence || stateData.confidence || 'generalized');
  const sources = Array.isArray(framework.sources) ? framework.sources : Array.isArray(stateData.sources) ? stateData.sources : [];
  const sourceLinks = sources.length
    ? '<ul class="neutral-list source-list">' + sources.slice(0, 3).map((src) => '<li><a href="' + escapeOptionalHtml(src.url || '#') + '" rel="nofollow noopener noreferrer">' + escapeOptionalHtml(src.label || src.url || 'Official source') + '</a> <span class="muted">(' + escapeOptionalHtml(src.supports || 'verification') + ')</span></li>').join('') + '</ul>'
    : '<p class="muted">State-specific legal facts are intentionally caveated when no official source is encoded for this state.</p>';
  return '<section class="city-supplement city-supplement-attorney-selection answer-block" data-pi-attorney-selection-framework="true" data-pi-city="' + escapeOptionalHtml(city) + '" data-pi-state="' + escapeOptionalHtml(state) + '">' +
    '<h2>' + escapeOptionalHtml(title) + '</h2>' +
    '<p><strong>Direct answer:</strong> Use the same attorney-selection framework for every firm in ' + escapeOptionalHtml(city) + ': case type specialization, contingency terms, trial readiness, reviews/reputation signals, official verification, and neutral directory use.</p>' +
    '<ol class="neutral-list">' + rows + '</ol>' +
    '<p class="muted" data-pi-directory-neutrality="true">The directory is a neutral starting list. It is not a ranking, recommendation, endorsement, or guarantee of fit.</p>' +
    '<p class="muted" data-pi-framework-boundary="true">' + escapeOptionalHtml(framework.educational_boundary || stateData.legal_advice_caveat || 'Educational only. Not legal advice. No attorney-client relationship is created.') + '</p>' +
    '<div data-pi-research-metadata="true"><p class="muted">Research status: ' + sourceStatus + ' · Confidence: ' + confidence + '</p>' + sourceLinks + '</div>' +
    '</section>';
}

function renderOptionalCityContentHtml(content) {
  if (!content) return "";
  const verticalKey = String(content.vertical || '').trim();
  const body = Array.isArray(content.body)
    ? content.body.map((p) => `<p>${escapeOptionalHtml(p)}</p>`).join("")
    : "";
  const bullets = Array.isArray(content.bullets) && content.bullets.length
    ? `<ul class="neutral-list">${content.bullets.map((item) => `<li>${escapeOptionalHtml(item)}</li>`).join("")}</ul>`
    : "";
  const intro = content.city_intro_override ? `<p>${escapeOptionalHtml(content.city_intro_override)}</p>` : "";
  const decisionItems = content.primary_city_decision_block && Array.isArray(content.primary_city_decision_block.items)
    ? content.primary_city_decision_block.items
    : [];
  const decisionBlock = decisionItems.length
    ? `<section class="city-supplement city-supplement-structured" data-city-decision-block="${escapeOptionalHtml(content.primary_city_decision_block.type || 'decision_checklist')}"><h3>${escapeOptionalHtml(content.primary_city_decision_block.title || 'Local decision checklist')}</h3><ul class="neutral-list">${decisionItems.map((item) => `<li>${escapeOptionalHtml(item)}</li>`).join('')}</ul></section>`
    : "";
  const leadChecklistItems = [
    ...decisionItems.slice(0, 4),
    ...(Array.isArray(content.local_vetting_points) ? content.local_vetting_points.slice(0, 2) : []),
    ...(Array.isArray(content.wait_time_notes) ? content.wait_time_notes.slice(0, 1) : []),
    ...(Array.isArray(content.typical_cost_ranges) ? content.typical_cost_ranges.slice(0, 1) : [])
  ].filter(Boolean);
  const leadChecklist = leadChecklistItems.length
    ? `<section class="city-supplement city-supplement-lead" data-city-local-checklist="true"><h2>${escapeOptionalHtml(content.primary_city_decision_block?.title || content.heading || 'How to compare providers in this city')}</h2>${intro}<ul class="neutral-list">${leadChecklistItems.map((item) => `<li>${escapeOptionalHtml(item)}</li>`).join('')}</ul></section>`
    : '';
  const structured = [
    renderOptionalCityStructuredSection('Local vetting points', content.local_vetting_points, 'ul', 'local_vetting_points'),
    renderOptionalCityStructuredSection('Typical cost ranges', content.typical_cost_ranges, 'ul', 'typical_cost_ranges'),
    renderOptionalCityStructuredSection('Payment options', content.payment_options, 'ul', 'payment_options'),
    renderOptionalCityStructuredSection('Wait-time notes', content.wait_time_notes, 'ul', 'wait_time_notes'),
    renderOptionalCityStructuredSection('Availability notes', content.availability_notes, 'ul', 'availability_notes'),
    renderOptionalCityStructuredSection('Named resources or providers', content.named_resources_or_providers, 'ul', 'named_resources_or_providers'),
    renderOptionalCityStructuredSection('Market-specific notes', content.market_specific_notes, 'ul', 'market_specific_notes'),
    ...cityVerticalSectionConfig(verticalKey).map(([key, title]) => renderOptionalCityStructuredSection(title, content[key], 'ul', key))
  ].join('');
  if (!(content.heading || intro || body || bullets || decisionBlock || structured || leadChecklist)) return '';
  // The marker that makes the fallback visible to the rest of the build.
  //
  // loadOptionalCityContent() has set is_template_fallback since the fallback was
  // written, and until now nothing read it: a repo-wide grep found the flag at its
  // two write sites and nowhere else. So the comment above it claimed these pages
  // were "no longer indexable" while all 200 of them shipped with
  // `index,follow` and sat in the public sitemap.
  //
  // Emitting it into the page is what closes that. scripts/apply_robots_policy.js
  // runs after render and flips any page carrying this attribute to
  // noindex,nofollow, and scripts/sitemap_emit.js already drops noindex pages, so
  // one marker reaches both. Putting it in the HTML rather than in a side manifest
  // means the page and the fact about the page cannot drift apart.
  //
  // The attribute goes on a real element, not a <meta> in the body. A body-level
  // <meta> is invalid HTML and this build drops it before write, which is a quiet
  // way to reintroduce exactly the bug being fixed: the flag would be set, the page
  // would look marked, and nothing downstream would ever see it.
  const fallbackAttrs = content.is_template_fallback
    ? ` data-template-fallback="true" data-template-fallback-reason="${escapeOptionalHtml(String(content.noindex_reason || 'no research file'))}"`
    : '';
  return [
    leadChecklist,
    renderPiAttorneySelectionFrameworkHtml(content),
    `<section class="city-supplement city-supplement-optional" data-city-intelligence="true"${fallbackAttrs}>`,
    content.heading ? `<h2>${escapeOptionalHtml(content.heading)}</h2>` : '',
    body,
    bullets,
    decisionBlock,
    structured,
    '</section>'
  ].join("");
}

function loadPageSet(pageSetFile) {
  // Canonical pageSetFile must be a repo-relative path under data/page_sets/.
  // Valid example: data/page_sets/examples/pi_v1.json
  // Legacy bare paths like examples/pi_v1.json are not accepted here.
  if (typeof pageSetFile !== 'string' || !pageSetFile.trim()) {
    throw new Error('pageSetFile is required');
  }

  const normalized = pageSetFile.replace(/^\.\/?/, '').trim();

  if (!normalized.startsWith('data/page_sets/')) {
    throw new Error(
      `Invalid pageSetFile: ${pageSetFile}. Expected canonical repo-relative path like data/page_sets/examples/pi_v1.json`
    );
  }

  const abs = path.join(REPO_ROOT, normalized);
  if (!fs.existsSync(abs)) {
    throw new Error(`pageSetFile not found: ${normalized}`);
  }

  return readJson(abs);
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
  const isTrainingBuild = String(process.env.LKG_ENV || '').toLowerCase() === 'training';
  // A state page used to send its conversion CTA to the global /next-steps/,
  // even though a per-state next-steps page is built and sitemapped for all 50
  // states. Nothing linked to those 50 pages: measured on the pi pack, they were
  // 50 of the 52 orphans, and they held the pack to 81.0% of pages within three
  // clicks while every other pack sat near 99%. They are conversion pages, so an
  // unreachable one is a dead conversion path, not just a dead URL.
  //
  // City pages already do the right thing (/<city>/next-steps/), and
  // scripts/export_buyout_click_audit_urls.js already declares the state route
  // as /states/<ST>/next-steps/. This makes the state branch agree with both.
  const stateAbbrForNextSteps = (pageKind === 'state')
    ? ((String(src).match(/^\/states\/([A-Za-z]{2})\//) || [])[1] || '')
    : '';
  const nextStepsBasePath = isTrainingBuild
    ? '/next-steps/'
    : (stateAbbrForNextSteps
      ? ('/states/' + stateAbbrForNextSteps.toUpperCase() + '/next-steps/')
      : (marketSlug ? ('/' + marketSlug + '/next-steps/') : '/next-steps/'));
  const nextStepsHref = buildTrackedHref(nextStepsBasePath, {
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
    // A city market page is an article as well as a collection. It runs 1,700
    // to 2,100 words of written editorial - the local comparison checklist, the
    // evaluation framework, the tradeoffs, the localized conclusion - published
    // by a named publisher with a modified date. CollectionPage describes the
    // links on it; Article describes the body, which is the part an answer
    // engine quotes. Both are true of the page, so both are declared.
    //
    // It is deliberately NOT declared on the state hubs (435 words, a routing
    // layer), the next-steps hubs (a conversion form), the guides index (a
    // collection), or the legal and contact pages. Article there would be a
    // claim about what the page is that the page does not support.
    ld.push(buildArticleSchemaGlobal(siteUrl, brandName, `${city.slug}`, title, description, {
      articleSection: 'Local market guide',
      aboutName: String(city.marketLabel || city.slug || title),
      keywords: buildKeywords(title, description, [String(city.marketLabel || ''), String(verticalKey || ''), 'local comparison'])
    }));
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
  return '';
}

function loadBuyoutsSafe(repoRoot) {
  try {
    return buyouts.loadBuyouts(repoRoot || process.cwd());
  } catch (e) {
    return [];
  }
}


function getSponsorRoutingForContext(ctx, now = new Date()) {
  const verticalKey = ctx && ctx.verticalKey ? String(ctx.verticalKey) : '';
  if (!verticalKey) return null;
  try {
    const all = loadBuyoutsSafe(REPO_ROOT);
    const pageKind = ctx && ctx.pageKind ? String(ctx.pageKind) : '';
    const route = ctx && typeof ctx.route === 'string' ? ctx.route : '';
    const citySlug = ctx && ctx.citySlug ? String(ctx.citySlug) : '';
    const stateAbbr = ctx && ctx.stateAbbr ? String(ctx.stateAbbr) : '';
    const winner = buyouts.resolveWinner(all, {
      verticalKey,
      city: citySlug || null,
      state: stateAbbr || null,
      guideRoute: route || null
    }, now);
    if (!winner || winner.cta_takeover === false) return null;
    const sponsor = winner.sponsor_slug ? sponsorCatalog.getSponsorBySlug(REPO_ROOT, winner.sponsor_slug) : null;
    return {
      winner,
      sponsor,
      sponsor_slug: String((winner && winner.sponsor_slug) || ''),
      sponsor_name: String((sponsor && sponsor.display_name) || (winner && winner.sponsor_slug) || 'Featured sponsor'),
      sponsor_phone: String((sponsor && sponsor.phone) || ''),
      sponsor_website: String((sponsor && sponsor.website_url) || '/next-steps/'),
      lead_target: String((winner && winner.lead_target) || (sponsor && sponsor.lead_email) || ''),
      sponsor_scope: String((winner && winner.scope) || ''),
      campaign_slug: String((winner && (winner.campaign_slug || winner.id)) || ''),
      assets: (sponsor && sponsor.assets) || {},
      pageKind,
      route,
      citySlug,
      stateAbbr,
      verticalKey
    };
  } catch (e) {
    return null;
  }
}

function getSurfaceAsset(sponsorRouting, surfaceKey) {
  const assets = (sponsorRouting && sponsorRouting.assets) || {};
  if (surfaceKey === 'directory') return assets.directory_cta_image || assets.top_cta_image || '';
  if (surfaceKey === 'mid') return assets.mid_cta_image || assets.top_cta_image || '';
  if (surfaceKey === 'bottom') return assets.bottom_cta_image || assets.mid_cta_image || assets.top_cta_image || '';
  return assets.top_cta_image || '';
}

function buildSponsorDisclosureLine() {
  return 'Sponsored placement • fixed inventory • disclosed';
}

function renderCtaSpacerBlock() {
  return '<section class="section cta-spacer-block" data-cta-spacer="true"><p class="muted">Before choosing, review the context below so the next step is grounded in the right page and provider fit.</p></section>';
}

function normalizeSponsorSurfaceLayout(html) {
  let out = String(html || '');
  const heroRe = /\s*<section class="hero runtime-next-steps-hero sponsored-cta-surface"[\s\S]*?<\/section>\s*/i;
  const heroMatch = out.match(heroRe);
  if (heroMatch) {
    const hero = heroMatch[0].trim();
    out = out.replace(heroRe, '\n');
    const answerRe = /(<section[^>]*data-(?:citation-summary|home-answer|guides-answer|state-short-answer|short-answer)="true"[^>]*>[\s\S]*?<\/section>)/i;
    if (answerRe.test(out)) out = out.replace(answerRe, '$1\n\n' + hero + '\n');
    else if (/(<section class="hero"[\s\S]*?<\/section>)/i.test(out)) out = out.replace(/(<section class="hero"[\s\S]*?<\/section>)/i, '$1\n\n' + hero + '\n');
    else out = hero + '\n' + out;
  }
  out = out.replace(/(<\/section>)\s*(<section class="section conversion-cta[^"]*sponsored-cta-surface[\s\S]*?<\/section>)/i, '$1\n\n' + renderCtaSpacerBlock() + '\n\n$2');
  out = out.replace(/(<section class="section conversion-cta[^"]*sponsored-cta-surface[\s\S]*?<\/section>)\s*(<section class="connection-bubble[^"]*sponsored-cta-surface[\s\S]*?<\/section>)/i, '$1\n\n' + renderCtaSpacerBlock() + '\n\n$2');
  return out;
}

function resolveRuntimeBuyoutCtaMode(ctx, now = new Date()) {
  const sponsorRouting = getSponsorRoutingForContext(ctx, now);
  if (!sponsorRouting) return null;
  return {
    trigger: sponsorRouting.sponsor_scope + '_buyout',
    mode: 'hero',
    sponsorRouting
  };
}

function renderRuntimeNextStepsCtaHtml(opts) {
  const mode = opts && opts.mode === 'hero' ? 'hero' : 'inline';
  const trigger = opts && opts.trigger ? String(opts.trigger) : 'vertical_buyout';
  const sponsorRouting = opts && opts.sponsorRouting ? opts.sponsorRouting : null;
  const sponsorName = sponsorRouting && sponsorRouting.sponsor_name ? String(sponsorRouting.sponsor_name) : 'Featured sponsor';
  const sponsorPhone = sponsorRouting && sponsorRouting.sponsor_phone ? String(sponsorRouting.sponsor_phone) : '';
  const sponsorWebsite = sponsorRouting && sponsorRouting.sponsor_website ? String(sponsorRouting.sponsor_website) : '/next-steps/';
  const disclosure = buildSponsorDisclosureLine();
  const topImage = getSurfaceAsset(sponsorRouting, 'top');
  const imgHtml = topImage ? '<p class="runtime-next-steps-media"><img src="/' + escapeHtml(String(topImage).replace(/^data\//,'')) + '" alt="' + escapeHtml(sponsorName) + ' sponsor creative" loading="lazy" decoding="async" /></p>' : '';
  const phoneHtml = sponsorPhone ? '<p class="muted runtime-next-steps-phone">Call ' + escapeHtml(sponsorPhone) + '</p>' : '';
  const buttonLabel = 'Contact ' + sponsorName;
  if (mode === 'hero') {
    return (
      '<section class="hero runtime-next-steps-hero sponsored-cta-surface" data-primary-conversion-cta="true" data-runtime-next-steps-cta="true" data-runtime-next-steps-mode="hero" data-runtime-next-steps-trigger="' + escapeHtml(trigger) + '" data-vertical-buyout-hero="true" data-sponsored-surface="top-cta">' +
      '<p class="kicker">' + escapeHtml(disclosure) + '</p>' +
      '<h2>' + escapeHtml(sponsorName) + '</h2>' +
      '<p class="muted">This top CTA surface is currently contracted to the active sponsor for this page.</p>' +
      imgHtml + phoneHtml +
      '<p class="actions"><a class="button button-primary" data-runtime-next-steps-button="true" data-sponsored-cta="true" href="' + escapeHtml(sponsorWebsite) + '">' + escapeHtml(buttonLabel) + '</a></p>' +
      '</section>'
    );
  }
  const midImage = getSurfaceAsset(sponsorRouting, 'mid');
  const inlineImg = midImage ? '<p class="conversion-cta__media"><img src="/' + escapeHtml(String(midImage).replace(/^data\//,'')) + '" alt="' + escapeHtml(sponsorName) + ' sponsor creative" loading="lazy" decoding="async" /></p>' : '';
  return (
    '<section class="section conversion-cta conversion-cta--primary conversion-cta--buyout sponsored-cta-surface" data-primary-conversion-cta="true" data-runtime-next-steps-cta="true" data-runtime-next-steps-mode="inline" data-runtime-next-steps-trigger="' + escapeHtml(trigger) + '" data-sponsored-surface="mid-cta">' +
    '<div class="conversion-cta__panel conversion-cta__panel--primary">' +
    '<p class="conversion-cta__eyebrow">' + escapeHtml(disclosure) + '</p>' +
    '<h2 class="conversion-cta__heading">' + escapeHtml(sponsorName) + '</h2>' +
    '<p class="conversion-cta__body">This sponsor-owned CTA is active for the contracted page coverage.</p>' + inlineImg + phoneHtml +
    '<p class="conversion-cta__actions"><a class="button button-primary conversion-cta__button" data-runtime-next-steps-button="true" data-sponsored-cta="true" href="' + escapeHtml(sponsorWebsite) + '">' + escapeHtml(buttonLabel) + '</a></p>' +
    '</div>' +
    '</section>'
  );
}

function applyRuntimeBuyoutCtaContract(html, ctx) {
  const mode = resolveRuntimeBuyoutCtaMode(ctx);
  if (!mode) return html;
  const ctaHtml = renderRuntimeNextStepsCtaHtml(mode);
  if (mode.mode === 'hero') {
    if (/data-vertical-buyout-hero="true"/.test(html) || /data-sponsored-surface="top-cta"/.test(html)) return html;
    if (/<section class="section conversion-cta conversion-cta--primary"[\s\S]*?<\/section>/i.test(html)) {
      return html.replace(/<section class="section conversion-cta conversion-cta--primary"[\s\S]*?<\/section>/i, ctaHtml);
    }
    if (/(<section class="hero"[\s\S]*?<\/section>)/i.test(html)) {
      return html.replace(/(<section class="hero"[\s\S]*?<\/section>)/i, '$1\n\n' + ctaHtml);
    }
    return ctaHtml + '\n' + html;
  }
  if (/data-runtime-next-steps-cta="true"/.test(html)) return html;
  if (/<section class="section conversion-cta conversion-cta--primary"[\s\S]*?<\/section>/i.test(html)) {
    return html.replace(/<section class="section conversion-cta conversion-cta--primary"[\s\S]*?<\/section>/i, ctaHtml);
  }
  if (/(<section class="hero"[\s\S]*?<\/section>)/i.test(html)) {
    return html.replace(/(<section class="hero"[\s\S]*?<\/section>)/i, '$1\n\n' + ctaHtml);
  }
  return ctaHtml + '\n' + html;
}


function renderSponsorInlineSurface(sponsorRouting, surfaceKey, sectionType) {
  const sponsorName = sponsorRouting && sponsorRouting.sponsor_name ? String(sponsorRouting.sponsor_name) : 'Featured sponsor';
  const sponsorPhone = sponsorRouting && sponsorRouting.sponsor_phone ? String(sponsorRouting.sponsor_phone) : '';
  const sponsorWebsite = sponsorRouting && sponsorRouting.sponsor_website ? String(sponsorRouting.sponsor_website) : '/next-steps/';
  const disclosure = buildSponsorDisclosureLine();
  const img = getSurfaceAsset(sponsorRouting, surfaceKey);
  const imgHtml = img ? '<p class="conversion-cta__media"><img src="/' + escapeHtml(String(img).replace(/^data\//,'').replace(/^\/+/, '')) + '" alt="' + escapeHtml(sponsorName) + ' sponsor creative" loading="lazy" decoding="async" /></p>' : '';
  const phoneHtml = sponsorPhone ? '<p class="muted runtime-next-steps-phone">Call ' + escapeHtml(sponsorPhone) + '</p>' : '';
  return '<section class="section conversion-cta conversion-cta--' + escapeHtml(sectionType || 'inline') + ' conversion-cta--buyout sponsored-cta-surface" ' +
    (sectionType === 'primary' ? 'data-primary-conversion-cta="true" ' : 'data-inline-conversion-cta="true" ') +
    'data-sponsored-surface="' + escapeHtml(surfaceKey + '-cta') + '">' +
    '<div class="conversion-cta__panel conversion-cta__panel--' + escapeHtml(sectionType || 'inline') + '">' +
    '<p class="conversion-cta__eyebrow">' + escapeHtml(disclosure) + '</p>' +
    '<h2 class="conversion-cta__heading">' + escapeHtml(sponsorName) + '</h2>' +
    '<p class="conversion-cta__body">This sponsor-owned CTA is active for the contracted page coverage.</p>' + imgHtml + phoneHtml +
    '<p class="conversion-cta__actions"><a class="button button-primary conversion-cta__button" data-sponsored-cta="true" href="' + escapeHtml(sponsorWebsite) + '">Contact ' + escapeHtml(sponsorName) + '</a></p>' +
    '</div></section>';
}

function renderSponsorConnectionBubble(sponsorRouting) {
  const sponsorName = sponsorRouting && sponsorRouting.sponsor_name ? String(sponsorRouting.sponsor_name) : 'Featured sponsor';
  const sponsorPhone = sponsorRouting && sponsorRouting.sponsor_phone ? String(sponsorRouting.sponsor_phone) : '';
  const sponsorWebsite = sponsorRouting && sponsorRouting.sponsor_website ? String(sponsorRouting.sponsor_website) : '/request-assistance/';
  const disclosure = buildSponsorDisclosureLine();
  const img = getSurfaceAsset(sponsorRouting, 'bottom');
  const imgHtml = img ? '<p class="connection-bubble__media"><img src="/' + escapeHtml(String(img).replace(/^data\//,'').replace(/^\/+/, '')) + '" alt="' + escapeHtml(sponsorName) + ' sponsor creative" loading="lazy" decoding="async" /></p>' : '';
  const phoneHtml = sponsorPhone ? '<p class="connection-bubble__subtext">Call ' + escapeHtml(sponsorPhone) + '</p>' : '';
  return '<section class="connection-bubble sponsored-cta-surface" data-connection-bubble="true" data-sponsored-surface="bottom-cta">' +
    '<div class="connection-bubble__inner">' +
    '<div class="connection-bubble__copy">' +
    '<p class="connection-bubble__eyebrow">' + escapeHtml(disclosure) + '</p>' +
    '<h2 class="connection-bubble__title">' + escapeHtml(sponsorName) + '</h2>' +
    '<p class="connection-bubble__subtext">This CTA surface is currently contracted to the active sponsor for this page.</p>' + imgHtml + phoneHtml +
    '</div>' +
    '<div class="connection-bubble__actions">' +
    '<a class="button button-primary connection-bubble__button" data-sponsored-cta="true" href="' + escapeHtml(sponsorWebsite) + '">Contact ' + escapeHtml(sponsorName) + '</a>' +
    '</div></div></section>';
}

function applyExplicitSponsorSurfaceOverrides(html, ctx) {
  const sponsorRouting = getSponsorRoutingForContext(ctx);
  if (!sponsorRouting) return html;
  let out = String(html || '');
  out = applyRuntimeBuyoutCtaContract(out, ctx);
  if (/<section class="section conversion-cta conversion-cta--inline"[\s\S]*?<\/section>/i.test(out)) {
    out = out.replace(/<section class="section conversion-cta conversion-cta--inline"[\s\S]*?<\/section>/i, renderSponsorInlineSurface(sponsorRouting, 'mid', 'inline'));
  }
  if (/<section class="connection-bubble"[\s\S]*?<\/section>/i.test(out)) {
    out = out.replace(/<section class="connection-bubble"[\s\S]*?<\/section>/i, renderSponsorConnectionBubble(sponsorRouting));
  }
  if (ctx && ctx.route === 'request-assistance') {
    out = applyVerticalLeadRoutingToRequestAssistanceHtml(out, sponsorRouting);
  }
  out = normalizeSponsorSurfaceLayout(out);
  return out;
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
    const pageType = (ctx && ctx.pageType) ? String(ctx.pageType) : (ctx && ctx.guideRoute ? 'guide' : (city ? 'city' : ''));
    const bctx = {
      city: city && city.slug ? String(city.slug) : undefined,
      state: city && city.state ? String(city.state) : (ctx && (ctx.stateCode || ctx.stateAbbr) ? String(ctx.stateCode || ctx.stateAbbr) : undefined),
      guideRoute: (ctx && ctx.guideRoute) ? String(ctx.guideRoute) : undefined,
      verticalKey: verticalKey
    };
    const winner = buyouts.resolveWinner(all, bctx, new Date());
    if (winner && winner.buyout === true) {
      // Under LIVE buyouts, remove the generic /for-providers link from sponsor stacks.
      allowForProvidersLink = false;

      if (winner.scope === 'vertical') {
        // Vertical buyout: runtime CTA is enabled elsewhere.
        // Keep fixed inventory placements intact (golden contract + sales parity).
        topIsHero = false;
      } else if (winner.scope === 'category' || winner.scope === 'guide' || winner.scope === 'city' || winner.scope === 'state') {
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
    const pageTypeLocal = (ctx && ctx.pageType) ? String(ctx.pageType) : (ctx && ctx.guideRoute ? 'guide' : (city ? 'city' : ''));
    const cfg = ads && ads[key] ? ads[key] : null;
    if (pageTypeLocal === 'guide') {
      const allGuideBuyouts = loadBuyoutsSafe(REPO_ROOT);
      const guideWinner = buyouts.resolveWinner(allGuideBuyouts, { verticalKey, guideRoute: (ctx && ctx.guideRoute) ? String(ctx.guideRoute) : undefined }, new Date());
      if (!(guideWinner && guideWinner.scope === 'vertical' && guideWinner.buyout === true)) return '';
    }
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
  var trainingBanner = (String(process.env.LKG_ENV || '').toLowerCase() === 'training' && String(process.env.PAGE_SET_FILE || '').endsWith('starter_v1.json'))
    ? renderTrainingBannerHtml('Sandbox next-steps page. Use this to practice conversion-flow audits.')
    : '';
  var toolsHref = String(opts && opts.toolsHref ? opts.toolsHref : '/faq/');
  var sponsorRouting = opts && opts.sponsorRouting ? opts.sponsorRouting : null;
  var requestAssistanceHtml = stripRequestAssistanceHero(String(opts && opts.requestAssistanceHtml ? opts.requestAssistanceHtml : ''));
  requestAssistanceHtml = applyVerticalLeadRoutingToRequestAssistanceHtml(requestAssistanceHtml, sponsorRouting);
  var marketLabel = String(opts && opts.marketLabel ? opts.marketLabel : 'this market');
  // The global /next-steps/ page is not scoped to a market - it passes the brand
  // name as a stand-in - and "In USCIS Exam Guides, three paths lead out" is not
  // a sentence anyone would write. Callers that really are market-scoped say so.
  var marketScoped = !(opts && opts.marketScoped === false);
  var pageTitle = String(opts && opts.pageTitle ? opts.pageTitle : 'Next steps');
  return (
    trainingBanner +
    '<section class="hero" data-next-steps-page-hero="true">' +
      '<p class="kicker">Next steps</p>' +
      '<h1>' + escapeHtml(pageTitle) + '</h1>' +
      '<p class="muted">Use this page when you want everything in one place: the full callback form, the comparison path, and the lookup tools path.</p>' +
    '</section>' +
    '<section class="section next-steps-page-shell" data-next-steps-page-shell="true">' +
      '<div class="card" data-next-steps-page-intro="true">' +
        // The heading was a label and the paragraph beneath it was byte-for-byte
        // identical on all 57 of these pages, which is the worst possible shape
        // for the one paragraph an extractor is most likely to lift. Both now
        // name the market, which is the only thing that actually differs between
        // them, and the answer is sized to be quotable whole.
        '<h2>' + (marketScoped ? 'What should you do next in ' + escapeHtml(marketLabel) + '?' : 'What should you do next?') + '</h2>' +
        '<p data-next-steps-answer="true" data-citation-summary-answer="true">' + composeAnswerSpan([
          (marketScoped ? 'In ' + escapeHtml(marketLabel) + ', three' : 'Three') + ' paths lead out of this page: send the callback form below if you already want a provider to contact you, open the education-first guides if cost, timing, or questions to ask are still unsettled, or use the lookup tools if you would rather verify things yourself first.',
          'This page is the only place the full decision hub appears.'
        ]) + '</p>' +
      '</div>' +
      '<div class="grid" data-next-steps-cards="true">' +
        '<div class="card" data-next-steps-card="direct-match">' +
          '<h3>Get matched with a provider</h3>' +
          '<p>The full callback form lives directly on this page below. Use it when you want a provider call back without leaving the decision hub.</p>' +
          '<p class="actions"><a class="button button-primary" data-next-steps-primary="true" href="#request-assistance-form">Jump to the full form</a></p>' +
        (sponsorRouting && sponsorRouting.sponsor_slug ? ('<p class="muted" data-next-steps-sponsor-routing="true">' + escapeHtml(buildSponsorDisclosureLine()) + ' • Routed to ' + escapeHtml(String(sponsorRouting.sponsor_name || sponsorRouting.sponsor_slug || 'the active sponsor')) + '.</p>' + (getSurfaceAsset(sponsorRouting, 'mid') ? '<p class="next-steps-sponsor-media"><img src="/' + escapeHtml(String(getSurfaceAsset(sponsorRouting, 'mid')).replace(/^data\//,'')) + '" alt="' + escapeHtml(String(sponsorRouting.sponsor_name || sponsorRouting.sponsor_slug || 'Sponsor')) + ' sponsor creative" loading="lazy" decoding="async" /></p>' : '')) : '') +
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


function applyVerticalLeadRoutingToRequestAssistanceHtml(requestAssistanceHtml, sponsorRouting) {
  let html = String(requestAssistanceHtml || '');
  if (!sponsorRouting || !sponsorRouting.sponsor_slug) return html;
  const disclosure = buildSponsorDisclosureLine();
  const sponsorName = sponsorRouting.sponsor_name || 'Featured sponsor';
  const sponsorPhone = sponsorRouting.sponsor_phone ? '<p class="muted">Call ' + escapeHtml(String(sponsorRouting.sponsor_phone)) + '</p>' : '';
  const sponsorWebsite = sponsorRouting.sponsor_website || '#request-assistance-form';
  const sponsorImage = getSurfaceAsset(sponsorRouting, 'top');
  const imageHtml = sponsorImage ? '<p class="ra-sponsored-media"><img src="/' + escapeHtml(String(sponsorImage).replace(/^data\//,'')) + '" alt="' + escapeHtml(String(sponsorName)) + ' sponsor creative" loading="lazy" decoding="async" /></p>' : '';
  const note = '<section class="section sponsored-cta-surface" data-request-assistance-sponsor="true" data-sponsored-surface="top-cta"><div class="card"><p class="kicker">' + escapeHtml(disclosure) + '</p><h2>' + escapeHtml(String(sponsorName)) + '</h2><p class="muted">This request-assistance form is currently routed to the active sponsor.</p>' + imageHtml + sponsorPhone + '<p class="actions"><a class="button button-primary" data-sponsored-cta="true" href="' + escapeHtml(String(sponsorWebsite)) + '">Contact ' + escapeHtml(String(sponsorName)) + '</a></p></div></section>';
  if (!html.includes('data-request-assistance-sponsor="true"')) {
    html = html.replace(/(<section class="section" data-request-assistance-form-primary="true">)/, note + '\n$1');
  }
  html = html.replace('id="sponsor_slug" name="sponsor_slug" value=""', 'id="sponsor_slug" name="sponsor_slug" value="' + escapeHtml(String(sponsorRouting.sponsor_slug || '')) + '"');
  html = html.replace('id="sponsor_scope" name="sponsor_scope" value=""', 'id="sponsor_scope" name="sponsor_scope" value="' + escapeHtml(String(sponsorRouting.sponsor_scope || 'vertical_buyout')) + '"');
  html = html.replace('id="campaign_slug" name="campaign_slug" value=""', 'id="campaign_slug" name="campaign_slug" value="' + escapeHtml(String(sponsorRouting.campaign_slug || '')) + '"');
  if (!html.includes('id="lead_target"')) {
    html = html.replace('id="campaign_slug" name="campaign_slug" value="' + escapeHtml(String(sponsorRouting.campaign_slug || '')) + '" />', 'id="campaign_slug" name="campaign_slug" value="' + escapeHtml(String(sponsorRouting.campaign_slug || '')) + '" />\n            <input type="hidden" id="lead_target" name="lead_target" value="' + escapeHtml(String(sponsorRouting.lead_target || '')) + '" />');
  }
  return html;
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
  let out = String(html || '');
  const baitRe = /<section[^>]*data-llm-bait="question"[\s\S]*?<\/section>/m;
  if (baitRe.test(out)) out = out.replace(baitRe, '');
  const q = renderLLMBaitQuestionHtml(verticalKey, city);
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
    out = out.replace(/(<section[^>]*data-eval-framework="true"[\s\S]*?<\/section>)/m, `${q}
$1`);
  } else {
    out = injectAfterSection(out, 'data-city-hero', q);
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
    '<section class="state-authority-block" data-state-authority-block="true" data-state-authority-strength="true" data-state-authority-dominance="true">' +
      '<h2>How to use this state page well</h2>' +
      '<p data-state-authority-direct="true"><strong>Direct answer:</strong> A state page should help you compare firms using a neutral checklist and then verify licensing and discipline through official state resources.</p>' +
      '<p data-state-authority-dominance="true">This page is strongest when you use it as a synthesis layer: statewide verification, statewide rules-of-thumb, and a clean checklist for comparing firms before you contact anyone.</p>' +
      '<p data-state-authority-tradeoff="true"><strong>Common mistake:</strong> Treating a state page like a ranking page instead of a neutral comparison and verification page.</p>' +
      '<p data-state-authority-use="true"><strong>Use this page for:</strong> statewide boundaries, official resources, and deciding which guide or comparison step should come next.</p>' +
    '</section>'
  );
}


function renderGuideTopModule(route, contractEntry, enhancement) {
  if (!contractEntry || !contractEntry.top_module_type) return "";
  const topType = contractEntry.top_module_type;
  const heading = escapeHtml((enhancement && enhancement.heading) || 'Quick decision support');
  const best = escapeHtml((enhancement && enhancement.best) || 'Use this page to get the direct answer first, then decide what to ask or compare next.');
  const key = escapeHtml((enhancement && enhancement.key) || 'The goal is to surface the answer shape that LLMs and real users both look for first.');
  const mistake = escapeHtml((enhancement && enhancement.mistake) || 'Do not rely on a vague summary when the real decision turns on a few practical checks.');
  const good = escapeHtml((enhancement && enhancement.good) || 'A strong page should make the decision path, the tradeoffs, and the next questions easy to see.');
  const ask = escapeHtml((enhancement && enhancement.ask) || 'What is the best next question, comparison, or document check before I commit?');
  const intent = escapeHtml(contractEntry.exact_opening_intent || '');
  let inner = '';
  if (topType === 'top_checklist') {
    inner = '<ul class="top-module-checklist">' +
      '<li><strong>Use this page when:</strong> ' + best + '</li>' +
      '<li><strong>Check first:</strong> ' + key + '</li>' +
      '<li><strong>Slow down if:</strong> ' + mistake + '</li>' +
      '<li><strong>What to confirm next:</strong> ' + ask + '</li>' +
      '</ul>';
  } else if (topType === 'top_comparison_table') {
    inner = '<table class="top-module-table"><thead><tr><th>Decision factor</th><th>What to compare</th></tr></thead><tbody>' +
      '<tr><td>Best use case</td><td>' + best + '</td></tr>' +
      '<tr><td>Main tradeoff</td><td>' + key + '</td></tr>' +
      '<tr><td>Common mistake</td><td>' + mistake + '</td></tr>' +
      '<tr><td>Question to ask</td><td>' + ask + '</td></tr>' +
      '</tbody></table>';
  } else if (topType === 'top_timeline') {
    inner = '<ol class="top-module-timeline">' +
      '<li><strong>Start:</strong> ' + best + '</li>' +
      '<li><strong>Then compare:</strong> ' + key + '</li>' +
      '<li><strong>Watch for:</strong> ' + mistake + '</li>' +
      '<li><strong>Before you book:</strong> ' + ask + '</li>' +
      '</ol>';
  } else if (topType === 'top_cost_table') {
    inner = '<table class="top-module-table"><thead><tr><th>Cost question</th><th>What matters</th></tr></thead><tbody>' +
      '<tr><td>What are you really comparing?</td><td>' + best + '</td></tr>' +
      '<tr><td>What changes total cost?</td><td>' + key + '</td></tr>' +
      '<tr><td>Where people get burned</td><td>' + mistake + '</td></tr>' +
      '<tr><td>What to ask before paying</td><td>' + ask + '</td></tr>' +
      '</tbody></table>';
  } else if (topType === 'top_decision_tree') {
    inner = '<ul class="top-module-decision-tree">' +
      '<li><strong>If the page still feels too broad:</strong> use the next question path: ' + ask + '</li>' +
      '<li><strong>If the fit sounds strong:</strong> ' + good + '</li>' +
      '<li><strong>If the page raises concern:</strong> ' + mistake + '</li>' +
      '</ul>';
  } else if (topType === 'top_question_script') {
    inner = '<div class="top-module-script"><p><strong>Use these questions:</strong></p><ol>' +
      '<li>' + ask + '</li>' +
      '<li>What would make you say this is <em>not</em> the right next step?</li>' +
      '<li>What changes the price, timing, or required documents?</li>' +
      '<li>What do people usually misunderstand here?</li>' +
      '</ol></div>';
  } else {
    inner = '<div class="top-module-verdict"><p><strong>Direct answer:</strong> ' + best + '</p><p><strong>Why:</strong> ' + key + '</p><p><strong>Best next move:</strong> ' + ask + '</p></div>';
  }
  return '<section class="section guide-section guide-top-module" data-guide-section="true" data-guide-top-module="true" data-guide-top-module-type="' + escapeHtml(topType) + '">' +
    '<h2>' + heading + '</h2>' +
    (intent ? '<p class="answer-when"><strong>Opening intent:</strong> ' + intent + '</p>' : '') +
    inner +
    '</section>';
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
    const stateDir = path.join(DATA_DIR, 'pi_state_firms');
    if (fs.existsSync(stateDir)) {
      const files = fs.readdirSync(stateDir).filter((n) => /\.json$/i.test(n)).sort();
      for (const file of files) {
        const stateData = readJson(path.join(stateDir, file)) || {};
        const firms = Array.isArray(stateData.firms) ? stateData.firms : [];
        for (const firm of firms) {
          if (!firm || !firm.name) continue;
          cards.push(normalizeProviderCard(verticalKey, '', {
            name: firm.name,
            category: 'Personal injury law firm',
            city: firm.city_label || '',
            state: stateData.state_abbr || file.replace(/\.json$/i, '').toUpperCase(),
            attributes: ['State directory example', 'Compare case fit, fees, communication, and verification']
          }, { city: firm.city_label || '', state: stateData.state_abbr || file.replace(/\.json$/i, '').toUpperCase() }, ''));
          if (cards.length >= 4) break;
        }
        if (cards.length >= 4) break;
      }
    }
    if (!cards.length) {
      for (const city of cities) {
        const listingPath = path.join(DATA_DIR, 'listings', city.slug + '.json');
        if (!fs.existsSync(listingPath)) continue;
        const raw = readJson(listingPath);
        const listings = Array.isArray(raw) ? raw : (Array.isArray(raw.listings) ? raw.listings : []);
        for (const item of listings) {
          if (!item || !item.name) continue;
          cards.push(normalizeProviderCard(verticalKey, '', { name: item.name, category: 'Personal injury law firm', city: city.city, state: city.state, attributes: ['State-level firm example', 'Compare case fit, fees, communication, and verification'] }, city, ''));
          if (cards.length >= 4) break;
        }
        if (cards.length >= 4) break;
      }
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
    pi: 'These are neutral, non-ranked examples of firms so the homepage feels concrete before you compare options using the state guides and canonical PI guides.',
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
  const heading = (opts && opts.heading) ? String(opts.heading) : ('Directory Listings (Examples of providers in ' + marketRaw + ')');
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
      take(b => /<section class="hero"/.test(b) && !/runtime-next-steps-hero sponsored-cta-surface/.test(b)),
      take(b => /data-home-answer="true"/.test(b) || /data-short-answer="true"/.test(b)),
      take(b => /data-sponsored-surface="top-cta"/.test(b) || /data-primary-conversion-cta="true"/.test(b)),
      take(b => /data-home-about-block="true"/.test(b)),
      take(b => /data-home-provider-preview="true"/.test(b)),
      take(b => /data-home-faq-entry="true"/.test(b)),
      take(b => /data-home-state-grid-shell="true"/.test(b)),
      take(b => /data-sponsored-surface="mid-cta"/.test(b) || /data-inline-conversion-cta="true"/.test(b)),
      take(b => /data-sponsored-surface="bottom-cta"/.test(b) || /data-connection-bubble="true"/.test(b)),
      ...takeAll(b => /tertiary-support/.test(b) || /fanout-query-cluster/.test(b)),
      ...rest()
    ].filter(Boolean);
  } else if (mode === 'state') {
    ordered = [
      take(b => /<section class="hero"/.test(b) && !/runtime-next-steps-hero sponsored-cta-surface/.test(b)),
      take(b => /data-short-answer="true"/.test(b) || /data-citation-summary-type="state-home"/.test(b)),
      take(b => /data-sponsored-surface="top-cta"/.test(b) || /data-primary-conversion-cta="true"/.test(b)),
      take(b => /data-covered-cities="true"/.test(b)),
      take(b => /data-state-authority-block="true"/.test(b)),
      take(b => /data-pi-best-lawyer-answer="true"/.test(b)),
      take(b => /data-pi-how-to-choose="true"/.test(b)),
      ...takeAll(b => /data-guides-micro="true"/.test(b) || /data-start-here="true"/.test(b)),
      take(b => /state-guides-support/.test(b)),
      take(b => /data-disciplinary-lookup="true"/.test(b)),
      ...takeAll(b => /tertiary-support/.test(b) || /fanout-query-cluster/.test(b)),
      take(b => /data-sponsored-surface="mid-cta"/.test(b) || /data-inline-conversion-cta="true"/.test(b)),
      take(b => /data-pi-state-directory="true"/.test(b)),
      ...takeAll(b => /data-pi-state-faq="true"/.test(b)),
      take(b => /data-sponsored-surface="bottom-cta"/.test(b) || /data-connection-bubble="true"/.test(b)),
      ...rest()
    ].filter(Boolean);
  } else if (mode === 'city') {
    ordered = [
      take(b => /<section class="hero"/.test(b) && !/runtime-next-steps-hero sponsored-cta-surface/.test(b)),
      take(b => /data-short-answer="true"/.test(b) || /data-citation-summary-type="city-home"/.test(b)),
      take(b => /data-city-local-checklist="true"/.test(b)),
      take(b => /data-sponsored-surface="top-cta"/.test(b) || /data-primary-conversion-cta="true"/.test(b)),
      take(b => /How people typically evaluate/.test(b) || /data-eval-framework="true"/.test(b)),
      take(b => /data-localized-conclusion="true"/.test(b)),
      take(b => /data-city-decision-support="true"/.test(b)),
      take(b => /data-llm-bait="question"/.test(b)),
      take(b => /data-sponsored-surface="mid-cta"/.test(b) || /data-inline-conversion-cta="true"/.test(b)),
      ...takeAll(b => /data-provider-directory="true"/.test(b) || /data-pi-home-directory="true"/.test(b) || /data-example-providers="true"/.test(b)),
      take(b => /data-guide-groups="true"/.test(b)),
      ...takeAll(b => /Verify a provider/.test(b) || /guides-compact/.test(b) || /data-start-here="true"/.test(b) || /data-faq="true"/.test(b)),
      take(b => /data-sponsored-surface="bottom-cta"/.test(b) || /data-connection-bubble="true"/.test(b)),
      ...takeAll(b => /fanout-query-cluster/.test(b) || /tertiary-support/.test(b)),
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

  if (isStarterTrainingPack(pageSet)) {
    mainHtml = mainHtml.split("%%TRAINING_SPONSOR_SPOTLIGHT%%").join(renderTrainingSponsorSpotlight(city));
  } else {
    mainHtml = mainHtml.split("%%TRAINING_SPONSOR_SPOTLIGHT%%").join("");
  }

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
      renderCityDecisionSupportHtml(verticalKey, city) +
      renderOptionalCityContentHtml(loadOptionalCityContent(verticalKey, city.slug))
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
          heading = 'Directory Listings (Examples of providers in ' + market + ')';
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
    const officialResources = getNonPiResourcesForState(verticalKey, city.state, pageSet);
    const officialPrimary = officialResources && officialResources.length ? officialResources[0] : null;
    const citationSummaryHtml = renderCitationSummaryZoneHtml({
      kind: 'city-home',
      title,
      description,
      marketLabel: city.marketLabel,
      verticalLabel: verticalLabelFor(verticalKey),
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

  mainHtml = applyExplicitSponsorSurfaceOverrides(mainHtml, { pageKind: (route === '' ? 'city' : ''), route, verticalKey, citySlug: city.slug, stateAbbr: city.state });
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
  if (isStarterTrainingPack(pageSet) && !out.includes('data-training-page="true"')) {
    out = out.replace(/<main[^>]*>/i, function(m){ return m + renderTrainingBannerHtml('Sandbox only. Not a production page.'); });
  }
  out = reorderMainSections(out, route === '' ? 'city' : '');
  if (!out.includes('<footer') || !out.includes('Advertising disclosure.') || !out.includes('No guarantees or endorsements.')) {
    // Inject footerHtml immediately before </body> if missing.
    out = out.replace(/<\/body>/i, "\n" + footerHtml + "\n</body>");
  }
  return out;
}

const LEGACY_GUIDE_ENHANCEMENTS = {
  '/guides/testosterone-replacement-therapy-overview/': { heading: 'TRT overview', best: 'Use this guide when you are trying to tell the difference between low-testosterone marketing and a real TRT workup.', key: 'TRT works best when the clinic explains why treatment is being considered, what will be tracked, and what would make them slow down.', mistake: 'Treating TRT like a quick energy product instead of a monitored medical decision.', good: 'A good clinic should explain baseline labs, follow-up timing, fertility questions, and what symptoms should trigger a review.', ask: 'Ask which labs are included, how often they repeat them, and what could make the clinic pause or change treatment.' },
  '/guides/trt-red-flags/': { heading: 'TRT red flags', best: 'Use this guide when a clinic sounds fast, easy, or too certain.', key: 'Weak TRT clinics often skip a full workup, rush you into a subscription, or treat side effects like an afterthought.', mistake: 'Mistaking confidence or heavy marketing for careful clinical judgment.', good: 'A good clinic should explain who is not a fit, what they need to rule out first, and how they handle follow-up.', ask: 'Ask what would make them delay treatment, what monitoring schedule they use, and how they handle fertility concerns.' },
  '/guides/trt-pricing-and-labs/': { heading: 'TRT pricing and labs', best: 'Use this guide when cost is the real question behind the TRT decision.', key: 'The total price is not just the medication. The workup, repeat labs, dose changes, and follow-up also matter.', mistake: 'Comparing monthly sticker prices without comparing what the clinic actually monitors.', good: 'A good clinic should break startup costs, refill costs, lab timing, and urgent check-in costs into simple pieces.', ask: 'Ask what is included up front, which labs repeat on schedule, and what services cost extra later.' },
  '/guides/who-is-a-good-candidate-for-trt/': { heading: 'TRT candidacy', best: 'Use this guide when you are trying to decide whether TRT is even the right question.', key: 'Good candidacy depends on symptoms, lab context, risk factors, and whether simpler explanations have been checked first.', mistake: 'Assuming one low lab result automatically means long-term TRT is the answer.', good: 'A good clinic should explain why you are a fit or not a fit in plain language.', ask: 'Ask what else they ruled out, what repeat testing they require, and how fertility goals change the decision.' },
  '/guides/trt-side-effects-and-safety/': { heading: 'TRT safety', best: 'Use this guide when you need the safety picture, not just the sales page.', key: 'A responsible TRT plan explains common side effects, what is watched in follow-up labs, and which symptoms need quick review.', mistake: 'Thinking every clinic means the same thing when it says treatment is monitored.', good: 'A good clinic should name the main tradeoffs before treatment starts, not after you pay.', ask: 'Ask which labs they repeat, how often they repeat them, and what changes would make them adjust or pause treatment.' },
  '/guides/trt-telehealth-vs-local-clinic/': { heading: 'TRT telehealth vs local care', best: 'Use this guide when you think TRT may fit but you are not sure where the care should happen.', key: 'Telehealth often improves convenience while local care may improve in-person support. The right fit depends on your follow-up needs.', mistake: 'Choosing on convenience alone without asking how problems are handled when something feels off.', good: 'A good provider should make the care process, lab process, and escalation process clear either way.', ask: 'Ask how labs are coordinated, how urgent questions are handled, and whether you can switch formats later.' },
  '/guides/trt-injections-vs-gels/': { heading: 'TRT format choices', best: 'Use this guide when the delivery format is the main decision.', key: 'The right format depends on routine, tolerance, consistency, and how easy it is for you to stay on plan.', mistake: 'Picking the format that sounds easiest without asking how it works in real life.', good: 'A good clinic should explain the tradeoffs of both formats instead of pretending one is always best.', ask: 'Ask how each option affects routine, dose changes, follow-up, and what happens if the first format is not a good fit.' },
  '/guides/how-to-find-a-peptide-provider/': { heading: 'Finding a peptide provider', best: 'Use this guide when peptide interest is real but trust is the bigger issue.', key: 'The safest first move is finding a provider who explains what is being prescribed, why, what is uncertain, and how follow-up works.', mistake: 'Confusing high-energy marketing with medical oversight.', good: 'A good provider should be direct about uncertainty, sourcing, supervision, and what they will not promise.', ask: 'Ask what source they use, what review they perform first, how progress is judged, and what makes them say no.' },
  '/guides/peptide-program-costs/': { heading: 'Peptide costs', best: 'Use this guide when budget and value are the real decision drivers.', key: 'Peptide program pricing usually includes more than the compound itself. Evaluation, follow-up, supplies, and protocol changes can matter just as much.', mistake: 'Comparing monthly prices without comparing what support or supervision comes with them.', good: 'A good provider should break costs into simple parts and say which items repeat.', ask: 'Ask which costs are one-time, which repeat monthly, and what services are included versus extra.' },
  '/guides/iv-hydration-red-flags/': { heading: 'IV hydration red flags', best: 'Use this guide when the clinic sounds easier to understand than the treatment itself.', key: 'Weak IV hydration businesses often lean on vague promises, weak screening, and menu-heavy upsells instead of clear explanations.', mistake: 'Assuming wellness branding means careful clinical judgment.', good: 'A good clinic should make screening, ingredients, and limits easy to understand.', ask: 'Ask who reviews your situation, what they screen for, and what would make them say IV hydration is not the right next step.' },
  '/guides/how-to-choose-a-personal-injury-lawyer/': { heading: 'Choosing a personal injury lawyer', best: 'Use this guide when you need to sort good case handling from good marketing.', key: 'A strong firm explains process, communication, fee structure, and who will actually work on your case.', mistake: 'Choosing on slogans or billboard familiarity alone.', good: 'A good firm should explain what happens first, what records matter, and how updates are handled.', ask: 'Ask who will be your day-to-day contact, how fees work, and what factors can slow a case down.' },
  '/guides/personal-injury-fees-explained/': { heading: 'Personal injury fees', best: 'Use this guide when the main question is how the law firm gets paid.', key: 'Fees are only part of the money picture. Case costs, expenses, and timing matter too.', mistake: 'Hearing no fee unless we win and assuming every financial detail works the same way.', good: 'A good firm should explain fee percentages, costs, and how money is distributed in plain language.', ask: 'Ask which case costs are advanced, how they are repaid, and what happens if the case does not recover money.' },
  '/guides/personal-injury-lawyer-red-flags/': { heading: 'Personal injury red flags', best: 'Use this guide when the firm sounds polished but you are not sure it sounds careful.', key: 'Red flags often show up as pressure, vagueness, poor communication, or promises no honest lawyer should make.', mistake: 'Mistaking confidence for reliability.', good: 'A good firm should be direct about uncertainty, timelines, and what they still need to review.', ask: 'Ask what they know now, what they do not know yet, and what would change their view of the case.' },
  '/guides/questions-to-ask-a-personal-injury-lawyer/': { heading: 'Questions for a personal injury lawyer', best: 'Use this guide when you are preparing for a consultation and do not want to waste it.', key: 'Good questions help you understand staffing, communication, fees, timing, and whether the firm can explain your next steps clearly.', mistake: 'Leaving the consultation without asking who will handle the file day to day.', good: 'A good firm should answer directly, not dodge or oversell.', ask: 'Ask who handles the case, how updates work, what records matter most, and what happens right after you sign.' },
  '/guides/what-to-do-after-an-accident/': { heading: 'After an accident', best: 'Use this guide when the question is what to do first, not which lawyer to hire.', key: 'The first steps should protect safety, records, and timing before big legal conclusions are made.', mistake: 'Waiting too long to gather basic information or assuming memory alone will be enough later.', good: 'A good firm should explain what records and timeline details matter most at the start.', ask: 'Ask which photos, reports, bills, and contact details are worth saving right away.' },
  '/guides/truck-accident-lawyer-guide/': { heading: 'Truck accident claims', best: 'Use this guide when the crash involved a commercial vehicle and the process may be more complex.', key: 'Truck cases can involve more records, more parties, and faster evidence issues than a basic car crash case.', mistake: 'Treating a truck case exactly like a routine two-car claim.', good: 'A good firm should explain what extra records may matter and what should be preserved early.', ask: 'Ask what evidence may disappear fast, who the likely parties are, and how the case timeline can change.' },
  '/guides/slip-and-fall-lawyer-guide/': { heading: 'Slip and fall cases', best: 'Use this guide when the issue is proving what the property owner knew or should have addressed.', key: 'These cases often turn on conditions, notice, records, and fast documentation.', mistake: 'Assuming the fact of a fall alone explains who is legally responsible.', good: 'A good firm should explain what facts still need proof and what records may matter most.', ask: 'Ask what photos, reports, witnesses, and timeline details are most useful.' },
  '/guides/wrongful-death-lawyer-guide/': { heading: 'Wrongful death guidance', best: 'Use this guide when the issue is serious, time-sensitive, and emotionally heavy.', key: 'These cases often require clarity about timing, records, family roles, and expectations before legal strategy is discussed.', mistake: 'Expecting early certainty in a case that still needs fact gathering and family coordination.', good: 'A good firm should explain process with care and without promises.', ask: 'Ask what records are needed first, who may speak for the estate or family, and what early steps matter most.' },
  '/guides/dental-implants/': { heading: 'Dental implants', best: 'Use this guide when you want to know whether implants match the problem you are trying to solve.', key: 'A useful consult explains fit, healing, timing, and what could change the plan after imaging.', mistake: 'Comparing implant prices without comparing which steps are actually included.', good: 'A good provider should make the treatment sequence clear from the start.', ask: 'Ask what imaging is needed, what steps are separate, and how long the full process usually takes.' },
  '/guides/how-to-choose/': { heading: 'Choosing a dental practice', best: 'Use this guide when the problem is not one treatment but picking the right office.', key: 'A good office makes communication, treatment planning, and cost clarity easy to follow.', mistake: 'Choosing a practice based only on cosmetic branding or urgency.', good: 'A good dentist should explain options and tradeoffs in simple language.', ask: 'Ask how they handle treatment planning, follow-up, urgent concerns, and second opinions.' },
  '/guides/dental-bridge-vs-implant/': { heading: 'Bridge versus implant', best: 'Use this guide when the real choice is bridge versus implant and the tradeoffs are still blurry.', key: 'The right answer depends on support method, neighboring teeth, cost, timeline, and candidacy—not just one number.', mistake: 'Comparing price alone without comparing structure, maintenance, and fit.', good: 'A good dentist should explain bridge-versus-implant tradeoffs in plain language and say why one path fits better.', ask: 'Ask how each option is supported, what changes the cost, and what happens if you wait.' },
  '/guides/questions-to-ask/': { heading: 'Questions for a dental consult', best: 'Use this guide when you already know the likely treatment and need a better consult.', key: 'The best questions reveal whether the office is clear about options, timing, cost, and why a specific plan is being recommended.', mistake: 'Focusing only on final price and not the treatment sequence.', good: 'A good office should answer without rushing and should explain alternatives clearly.', ask: 'Ask what the alternatives are, what happens if you wait, and how they define success.' },
  '/guides/dental-red-flags/': { heading: 'Dental red flags', best: 'Use this guide when the office sounds polished but the plan still feels unclear.', key: 'Red flags often show up as pressure, weak cost clarity, thin explanations, or treatment recommendations that move too fast.', mistake: 'Assuming a modern-looking office always means the plan is thoughtful.', good: 'A good office should make tradeoffs, timing, and total cost easy to understand.', ask: 'Ask why the plan was chosen, what the alternatives are, and what could change the estimate.' },
  '/guides/cost-financing/': { heading: 'Dental costs and financing', best: 'Use this guide when the real problem is comparing quotes, phases, and financing instead of chasing one low number.', key: 'The useful comparison is what is included, what can change later, and whether financing is helping the plan or distorting it.', mistake: 'Comparing teaser prices or monthly payments without comparing treatment scope and tradeoffs.', good: 'A good office should explain cost-versus-scope clearly and separate urgent treatment from elective treatment.', ask: 'Ask what is included, what could change, and whether phased treatment is a safer option than rushing into financing.' },
  '/guides/root-canal-treatment/': { heading: 'Root canal treatment', best: 'Use this guide when the choice is really about saving a tooth versus moving to another plan.', key: 'The main decision is usually about the tooth, symptoms, timing, and what the dentist sees on exam and imaging.', mistake: 'Treating the phrase root canal as the whole decision instead of asking what outcome the dentist is trying to preserve.', good: 'A good office should explain the goal of treatment, next steps after treatment, and what happens if the tooth cannot be saved.', ask: 'Ask what the treatment is trying to preserve, what happens after the procedure, and what alternatives exist.' },
  '/guides/clear-aligners/': { heading: 'Clear aligners', best: 'Use this guide when you are comparing convenience, appearance, and treatment control.', key: 'The best fit depends on complexity, follow-through, and whether the plan needs close in-person adjustment.', mistake: 'Choosing based only on appearance or ads without asking whether the case is a good match.', good: 'A good provider should explain what aligners can and cannot correct in your case.', ask: 'Ask how often progress is checked, what limits the method has, and what happens if the teeth do not move as planned.' },
  '/guides/cosmetic-dentistry/': { heading: 'Cosmetic dentistry', best: 'Use this guide when the goal is appearance but you still want a careful treatment plan.', key: 'Cosmetic care should still start with healthy structure, clear goals, and honest tradeoffs.', mistake: 'Treating cosmetic planning like shopping for a finished look without understanding the dental work underneath it.', good: 'A good provider should explain limits, maintenance, and what may need to happen before cosmetic work.', ask: 'Ask what the realistic outcome is, how long it lasts, and what maintenance or replacement could look like.' },
  '/guides/emergency-dentist-vs-waiting/': { heading: 'Emergency dentist or wait', best: 'Use this guide when the issue is urgency and not just treatment type.', key: 'The main question is whether the symptom, injury, or swelling needs same-day attention or can safely wait for a planned visit.', mistake: 'Waiting too long because the pain changes or comes and goes.', good: 'A good office should explain what symptoms need faster care and what information they need from you first.', ask: 'Ask what symptoms change the urgency, what to do before the visit, and when they want you to go somewhere else first.' },
  '/guides/neuropsychological-testing-overview/': { heading: 'Neuro testing overview', best: 'Use this guide when the question is what this process is really for.', key: 'A neuropsych evaluation is usually about clearer answers, better documentation, and a more useful plan—not just a long report.', mistake: 'Expecting the testing day to solve everything by itself.', good: 'A good provider should explain what questions the evaluation can answer and what it cannot answer.', ask: 'Ask what the referral question is, how long testing takes, and what the final report is meant to help with.' },
  '/guides/neuro-evaluation-pricing/': { heading: 'Neuro evaluation pricing', best: 'Use this guide when cost is the main source of confusion.', key: 'Pricing can change based on complexity, records review, report depth, and whether insurance is involved.', mistake: 'Comparing one quoted number without asking what the fee includes.', good: 'A good provider should explain the scope of work in plain language.', ask: 'Ask what is included in the quote, what follow-up is included, and whether extra letters or revisions cost more.' },
  '/guides/neuro-provider-red-flags/': { heading: 'Neuro provider red flags', best: 'Use this guide when a provider sounds easy to book but hard to understand.', key: 'Weak providers often sound vague about fit, wait times, report use, or who the evaluation is really for.', mistake: 'Assuming a short wait means a better process.', good: 'A good provider should explain scope, timeline, and next steps clearly.', ask: 'Ask what records they need, what the report will include, and how results are explained.' },
  '/guides/questions-to-ask-before-neuro-testing/': { heading: 'Questions before neuro testing', best: 'Use this guide when you want the consult to answer the right questions before you spend money or time.', key: 'Good questions uncover scope, timeline, records, cost, and how the report will actually be used.', mistake: 'Not asking whether the evaluation matches the real referral question.', good: 'A good provider should answer directly and explain what the evaluation is designed to do.', ask: 'Ask what the evaluation is designed to answer, what documents to bring, and how results are shared.' },
  '/guides/adhd-evaluations-what-to-expect/': { heading: 'ADHD evaluation expectations', best: 'Use this guide when the process itself feels unclear.', key: 'The value of the evaluation comes from matching the process to the real question, not from checking a box quickly.', mistake: 'Expecting every provider to use the same intake, testing, and follow-up process.', good: 'A good provider should explain scope, timing, and what the final answer may or may not include.', ask: 'Ask what the visit sequence looks like, what records help, and what happens after results are explained.' },
  '/guides/autism-evaluation-adults/': { heading: 'Adult autism evaluations', best: 'Use this guide when the question is whether an adult evaluation is the right next step.', key: 'Adult autism evaluations often turn on history, current function, and what you need the evaluation to help with.', mistake: 'Assuming the goal is only a label instead of clarity, accommodations, or next-step planning.', good: 'A good provider should explain fit, timeline, and what kind of report or explanation you can expect.', ask: 'Ask what records help, how developmental history is handled, and how results are discussed afterward.' },
  '/guides/neuropsych-testing-children-vs-adults/': { heading: 'Children versus adults in neuro testing', best: 'Use this guide when you are deciding whether the age group changes the kind of provider or process you need.', key: 'Children and adults can need different records, different interview structures, and different follow-through planning.', mistake: 'Assuming one provider or one process fits every age group the same way.', good: 'A good provider should explain how age changes scope, records, and result use.', ask: 'Ask how the process differs by age, who needs to participate, and how the report is used afterward.' },
  '/guides/neuro-insurance-and-out-of-network/': { heading: 'Insurance and out-of-network neuro care', best: 'Use this guide when payment structure may change which provider is realistic.', key: 'The key issue is not just whether the provider takes insurance. It is what the fee covers and what paperwork support exists.', mistake: 'Comparing providers on insurance status alone without comparing scope or report depth.', good: 'A good provider should explain payment structure, receipts, and what help they give for reimbursement.', ask: 'Ask what is billed up front, what paperwork is provided, and what parts of the process are not covered.' },
  '/guides/uscis-medical-exam-overview/': { heading: 'USCIS medical exam overview', best: 'Use this guide when you need the process in plain language before you book.', key: 'The exam is a process step with paperwork, identity checks, vaccine review, and timing questions. It is not the place for promises about immigration outcomes.', mistake: 'Booking without first checking what documents and vaccine records are needed.', good: 'A good civil surgeon office should explain the process clearly and tell you what can delay completion.', ask: 'Ask what to bring, how sealed documents are handled, and what issues can slow the process down.' },
  '/guides/civil-surgeon-near-me/': { heading: 'Choosing a civil surgeon office', best: 'Use this guide when the problem is finding a legitimate office and understanding the booking process.', key: 'A strong office should make identity requirements, vaccine questions, pricing, and paperwork steps easy to follow.', mistake: 'Treating distance or speed as the only thing that matters.', good: 'A good office should explain how appointments work, what documents matter, and which issues may require extra follow-up.', ask: 'Ask what documents to bring, how vaccine records are handled, and how sealed paperwork is returned.' },
  '/guides/uscis-medical-exam-costs/': { heading: 'USCIS medical exam costs', best: 'Use this guide when pricing and included services are the main questions.', key: 'The exam fee may not be the only cost. Vaccines, lab work, or follow-up steps can change the total.', mistake: 'Comparing quoted prices without asking what is included in the visit.', good: 'A good office should separate the exam fee from outside or extra costs.', ask: 'Ask which services are included, which costs are separate, and what could create an extra visit or extra fee.' },
  '/guides/uscis-vaccination-records/': { heading: 'Vaccine record issues', best: 'Use this guide when missing records feel like the main risk in the process.', key: 'Vaccine questions often become simpler when you know what records you have, what may still be needed, and what the office can explain before the visit.', mistake: 'Assuming the office can solve unclear record history without you bringing details.', good: 'A good office should explain what records help and what they can review before the appointment.', ask: 'Ask which records to bring, what happens if records are incomplete, and what may need follow-up.' },
  '/guides/uscis-what-to-bring/': { heading: 'What to bring', best: 'Use this guide when you want the visit to go smoothly the first time.', key: 'Bringing the right ID, forms, records, and contact details can prevent avoidable delays.', mistake: 'Showing up with only a booking confirmation and expecting the office to fill every gap.', good: 'A good office should give a simple checklist before the appointment.', ask: 'Ask what identification, forms, vaccine records, and prior medical details they want you to bring.' },
  '/guides/uscis-medical-red-flags/': { heading: 'USCIS medical red flags', best: 'Use this guide when the office sounds vague, rushed, or too certain.', key: 'Red flags often show up as weak process explanations, unclear pricing, sloppy paperwork talk, or promises nobody should make.', mistake: 'Trusting speed claims over process clarity.', good: 'A good office should be clear about documents, timing, fees, and limits.', ask: 'Ask what the process looks like, what delays are common, and what they will and will not promise.' }
};
const GUIDE_ENHANCEMENTS = Object.assign({}, LEGACY_GUIDE_ENHANCEMENTS, loadGuideEnhancementRegistry());
const GUIDE_ANSWER_SHAPE_MAP = buildGuideAnswerShapeMap();


function renderGlobalPage(baseTemplate, footerHtml, connectionBubbleTemplate, primaryConversionTemplate, inlineConversionTemplate, globalPage, siteUrl, brandName, pageSet, globalSponsorsByStack, marketsStatusListHtml, ads, verticalKey) {
  const route = (globalPage.route || "").replace(/^\/+|\/+$/g, "");
  const title = String(globalPage.title || "").split("%%BRAND_NAME%%").join(brandName);
  const description = String(globalPage.description || "");
  const globalPagesDir = loadGlobalPagesDir(pageSet);
  const distributionCities = loadCities(pageSet, verticalKey).slice(0, 5);

  let mainHtml = String(globalPage.main_html || "").split("%%BRAND_NAME%%").join(brandName);
  if (isStarterTrainingPack(pageSet) && !String(mainHtml).includes('data-training-page="true"')) {
    mainHtml = renderTrainingBannerHtml('Sandbox only. Not a production page.') + mainHtml;
  }

const adminData = buildAdminStatusData(pageSet, verticalKey, loadCities(pageSet, verticalKey));
if (route === 'admin') {
  mainHtml = mainHtml
    .split('%%ADMIN_STATUS_CARDS%%').join(buildAdminStatusCardsHtml(adminData))
    .split('%%ADMIN_PRODUCT_SUMMARY%%').join(buildAdminProductSummaryHtml())
    .split('%%ADMIN_INVENTORY_TABLE%%').join(buildAdminInventoryTableHtml(adminData))
    .split('%%ADMIN_CTA_STATUS%%').join(buildAdminCtaStatusHtml(adminData))
    .split('%%ADMIN_ACTIVATION_CHECKLIST%%').join(buildAdminActivationChecklistHtml())
    .split('%%ADMIN_CITY_REQUEST_GUIDE%%').join(buildAdminCityRequestGuideHtml(adminData))
    .split('%%ADMIN_RED_FLAGS%%').join(buildAdminRedFlagsHtml(adminData))
    .split('%%PAGE_SET_FILE%%').join(escapeHtml(adminData.pageSetFile || 'data/page_sets/examples/uscis_medical_v1.json'));
}

  // --- GUIDE DETAIL CONTRACT (SEV-1 REGRESSION GUARD) ---
  // Guides must be block-structured and must include ad slots.
  // We intentionally enforce this at build-time so a flat/unstyled guide JSON
  // cannot silently ship even if authored incorrectly.
  function enhanceGuideDetailHtml(rawHtml, route, globalPagesDir) {
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
    const enhancement = GUIDE_ENHANCEMENTS['/' + String(route || '').replace(/^\/+|\/+$/g, '') + '/'] || null;
    const normalizedGuideRoute = String(route || '').replace(/^\/+|\/+$/g, '').toLowerCase();
    const guideShapeContract = GUIDE_ANSWER_SHAPE_MAP[normalizedGuideRoute] || null;
    if (!out.includes('data-guide-opening="true"')) {
      const guideOpeningBlock =
        '<section class="section guide-section guide-opening-block answer-block" data-guide-section="true" data-guide-opening="true">' +
        '<h2>What this guide is best for</h2>' +
        '<p data-guide-opening-direct="true"><strong>Direct answer:</strong> ' + escapeHtml((enhancement && enhancement.best) || 'Use this guide when you need one clear comparison or caution explained before you contact anyone.') + '</p>' +
        '<p class="answer-when" data-guide-opening-when="true"><strong>Best used when:</strong> ' + escapeHtml((enhancement && enhancement.key) || 'A city or state page is too broad and you need one cleaner decision path.') + '</p>' +
        '</section>';
      if (out.includes('<article class="guide-article"')) out = out.replace(/(<article class="guide-article"[^>]*>)/i, '$1\n' + guideOpeningBlock + '\n');
      else out = out.replace(/\s*%%AD:global_guide_top%%\s*/i, '\n%%AD:global_guide_top%%\n' + guideOpeningBlock + '\n');
    }

    if (guideShapeContract && !out.includes('data-guide-top-module="true"')) {
      const topModule = renderGuideTopModule(route, guideShapeContract, enhancement);
      if (topModule) {
        if (out.includes('data-guide-opening="true"')) out = out.replace(/(<section class="section guide-section guide-opening-block[\s\S]*?<\/section>)/i, '$1\n' + topModule + '\n');
        else if (out.includes('<article class="guide-article"')) out = out.replace(/(<article class="guide-article"[^>]*>)/i, '$1\n' + topModule + '\n');
        else out = out.replace(/\s*%%AD:global_guide_top%%\s*/i, '\n%%AD:global_guide_top%%\n' + topModule + '\n');
      }
    }

    if (enhancement && !out.includes('data-guide-custom-core="true"')) {
      const customCore =
        '<section class="section guide-section" data-guide-section="true" data-guide-custom-core="true">' +
        '<h2>' + escapeHtml(enhancement.heading) + '</h2>' +
        '<p><strong>Key point:</strong> ' + escapeHtml(enhancement.key) + '</p>' +
        '<p><strong>What a good provider should make clear:</strong> ' + escapeHtml(enhancement.good) + '</p>' +
        '<p><strong>Common mistake:</strong> ' + escapeHtml(enhancement.mistake) + '</p>' +
        '<p><strong>Questions to ask:</strong> ' + escapeHtml(enhancement.ask) + '</p>' +
        '</section>';
      if (out.includes('data-guide-opening="true"')) out = out.replace(/(<section class="section guide-section guide-opening-block[\s\S]*?<\/section>)/i, '$1\n' + customCore + '\n');
      else out = out.replace(/\s*%%AD:global_guide_top%%\s*/i, '\n%%AD:global_guide_top%%\n' + customCore + '\n');
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
      marketScoped: false,
      pageTitle: title,
      compareHref: buildTrackedHref('/guides/', { intent: 'decision_hub', button: 'next_steps_page_compare', vertical: verticalKey, page_kind: 'next_steps', page_slug: 'next-steps' }),
      toolsHref: buildTrackedHref('/faq/', { intent: 'self_serve', button: 'next_steps_page_tools', vertical: verticalKey, page_kind: 'next_steps', page_slug: 'next-steps' }),
      requestAssistanceHtml: extractRequestAssistanceHtml(pageSet),
      sponsorRouting: sponsorship.getActiveVerticalLeadRouting(verticalKey)
    });
  } else {
    var globalRoutePath = route ? ('/' + route.replace(/^\//, '') + '/') : '/';
    // Inline next-steps hub removed: dedicated /next-steps/ pages are the only full decision-hub surface.
  }

  mainHtml = applyExplicitSponsorSurfaceOverrides(mainHtml, { pageKind: (route === '' ? 'vertical_hub' : (route.startsWith('guides/') && route !== 'guides' ? 'guide' : '')), route, verticalKey });
  mainHtml = injectAdPlacements(mainHtml, ads, { city: null, verticalKey: verticalKey, cityFeatures: pageSet && pageSet.__cityFeatures ? pageSet.__cityFeatures : null, guideRoute: (route.startsWith('guides/') && route !== 'guides') ? route : undefined, pageType: (route.startsWith('guides/') && route !== 'guides') ? 'guide' : ((route === '') ? 'vertical_hub' : '') });
  if (route.startsWith('guides/') && route !== 'guides') {
    if (!/data-sponsored-placement="top"/.test(mainHtml)) {
      mainHtml = mainHtml.replace(/(<section class="hero"[\s\S]*?<\/section>)/i, '$1');
    }
    if (!/data-sponsored-placement="bottom"/.test(mainHtml)) {
      mainHtml += '';
    }
  }
  mainHtml = injectSponsors(mainHtml, globalSponsorsByStack || {});
  if (route.startsWith('guides/') && route !== 'guides') {
    const guideWinner2 = buyouts.resolveWinner(loadBuyoutsSafe(REPO_ROOT), { verticalKey, guideRoute: route }, new Date());
    const guideVerticalLive2 = !!(guideWinner2 && guideWinner2.scope === 'vertical' && guideWinner2.buyout === true);
    if (!guideVerticalLive2) {
      mainHtml = mainHtml.replace(/\s*<aside[^>]*data-sponsored-placement="top"[\s\S]*?<\/aside>\s*/ig, '\n');
      mainHtml = mainHtml.replace(/\s*<aside[^>]*data-sponsored-placement="bottom"[\s\S]*?<\/aside>\s*/ig, '\n');
    }
  }

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

function categorizeGuideHubCard(g) {
  var src = [g && g.route, g && g.title, g && g.description].join(' ').toLowerCase();
  if (/(overview|how to choose|start|first 90 days|what to expect|candidate|where to begin)/.test(src)) return 'start';
  if (/(cost|pricing|fees|insurance|financing|fit|out-of-network)/.test(src)) return 'cost';
  if (/(red flag|red-flags|risk|safety|side effect|warning|mistake)/.test(src)) return 'redflags';
  if (/(vs|versus|comparison|compare|children vs adults|telehealth vs|injections vs|crown|bridge|implant|extraction)/.test(src)) return 'comparisons';
  if (/(questions|what to ask|ask before|records to bring)/.test(src)) return 'questions';
  if (/(next step|what happens next|after an evaluation|after an accident|family planning|progress looks like)/.test(src)) return 'next';
  return 'continued';
}

function renderGuideHubCardsByGroup(guides) {
  if (!Array.isArray(guides) || guides.length === 0) return '';
  var groups = [
    { key: 'start', heading: 'Start here first', intro: 'Use these first when the topic is broad and you need a simple starting point.' },
    { key: 'cost', heading: 'Cost / pricing / fit', intro: 'Use these when the main question is cost, insurance, budgeting, or whether the program fits your situation.' },
    { key: 'redflags', heading: 'Red flags and trust checks', intro: 'Use these when you need to spot weak providers, bad promises, or missing safety steps.' },
    { key: 'comparisons', heading: 'Comparisons and alternatives', intro: 'Use these when you are comparing two paths and need the tradeoffs in plain language.' },
    { key: 'questions', heading: 'Questions to ask', intro: 'Use these when you are getting ready to call, book, or compare providers.' },
    { key: 'next', heading: 'What to do next', intro: 'Use these when you already understand the basics and need help with the next move.' },
    { key: 'continued', heading: 'Continued learning and special cases', intro: 'Use these when the topic is narrower, deeper, or useful as follow-up reading after the main decision is clearer.' }
  ];
  var buckets = Object.create(null);
  guides.forEach(function(g){
    var key = categorizeGuideHubCard(g);
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(g);
  });
  return groups.filter(function(group){ return Array.isArray(buckets[group.key]) && buckets[group.key].length; }).map(function(group){
    var cards = buckets[group.key].map(function (g) {
      var href = g && g.route ? String(g.route) : '#';
      var title = g && g.title ? String(g.title) : 'Guide';
      var desc = g && g.description ? String(g.description) : '';
      return (
        '<div class="card">' +
        '\n  <h3><a href="' + escapeHtml(href) + '">' + escapeHtml(title) + '</a></h3>' +
        '\n  <p>' + escapeHtml(desc) + '</p>' +
        '\n</div>'
      );
    }).join('\n');
    return '<section class="section guides-group" data-guides-group="' + escapeHtml(group.key) + '" data-decision-routing-block="true">' +
      '<h2>' + escapeHtml(group.heading) + '</h2>' +
      '<p class="muted">' + escapeHtml(group.intro) + '</p>' +
      '<div class="grid">' + cards + '</div>' +
      '</section>';
  }).join('\n');
}

function renderGuideCardsHtml(guides) {
  return renderGuideHubCardsByGroup(guides);
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
    // Route and title only. Matching the description too made the internal link
    // set depend on prose: rewriting one guide's description to a real sentence
    // ("...the important questions are whether anything else is needed...") let
    // that guide win the /questions/ slot from the guide actually about
    // questions, and silently dropped a link from 50 state pages. The slots are
    // topical route buckets; they should be decided by the route.
    const hit = guides.find((g) => !seen.has(g.route) && (rx.test(g.route) || rx.test(g.title)));
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
    'state-home': 'Use this state page to compare firms, work through a neutral evaluation checklist, and verify official licensing and discipline resources.'
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
  const all = loadGlobalPageSummaries(globalPagesDir).filter((g) => /^\/guides\/[^/]+\/$/.test(String(g.route || '')) && String(g.route || '') !== currentHref);
  const buckets = { start: [], cost: [], redflags: [], comparisons: [], questions: [], next: [], continued: [] };
  for (const g of all) {
    const source = [g.route, g.title, g.description].join(' ').toLowerCase();
    let key = 'continued';
    if (/(overview|how to choose|start|first 90 days|what to expect|candidate|where to begin)/.test(source)) key = 'start';
    else if (/(cost|pricing|fees|insurance|financing|fit|out-of-network)/.test(source)) key = 'cost';
    else if (/(red flag|red-flags|risk|safety|side effect|warning|mistake)/.test(source)) key = 'redflags';
    else if (/(vs|versus|comparison|compare|telehealth vs|injections vs|bridge|implant|extraction|children vs adults)/.test(source)) key = 'comparisons';
    else if (/(questions|what to ask|ask before|records to bring)/.test(source)) key = 'questions';
    else if (/(next step|what happens next|after an evaluation|after an accident|family planning|progress looks like)/.test(source)) key = 'next';
    buckets[key].push({ href: String(g.route || '#'), label: String(g.title || 'Guide') });
  }
  return [
    { heading: 'Start here first', items: buckets.start.slice(0, 5) },
    { heading: 'Cost / pricing / fit', items: buckets.cost.slice(0, 5) },
    { heading: 'Red flags and trust checks', items: buckets.redflags.slice(0, 5) },
    { heading: 'Comparisons and alternatives', items: buckets.comparisons.slice(0, 5) },
    { heading: 'Questions to ask', items: buckets.questions.slice(0, 5) },
    { heading: 'What to do next', items: buckets.next.slice(0, 5) },
    { heading: 'Continued learning and special cases', items: buckets.continued.slice(0, 5) }
  ].filter((group) => group.items && group.items.length);
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

// --- Answer shape -----------------------------------------------------------
//
// Every one of these pages opened with the heading "Short answer" and a lede
// that ran 30-odd words. Neither is what an answer engine looks for. It looks
// for the searcher's own question as a heading, and directly beneath it a span
// it can lift whole: long enough to stand on its own, short enough to quote, and
// free of pronouns that point at something outside the span.
//
// 40-60 words is the window that satisfies both ends of that. Below 40 the span
// is a fragment that needs the surrounding page to make sense; above 60 an
// extractor truncates it mid-clause, which reads as broken wherever it is
// quoted. The counter below is what keeps the templates inside that window as
// their market and vertical labels change length, and
// scripts/validation/answer_shape_contract.js fails the build if one drifts out.
// How a searcher names the thing this pack is about. Hoisted out of the city
// branch it used to live in so state hubs can put the same words in their
// heading; a state page asking "How do you compare local service options across
// Georgia?" would be asking a question nobody types.
const VERTICAL_LABELS = {
  dentistry: 'dentistry and dental-provider',
  neuro: 'neuropsychology and evaluation-provider',
  trt: 'TRT, peptide, IV therapy, and clinic',
  uscis: 'USCIS medical-exam and civil-surgeon',
  uscis_medical: 'USCIS medical-exam and civil-surgeon',
  pi: 'personal-injury lawyer'
};
function verticalLabelFor(verticalKey) {
  return VERTICAL_LABELS[String(verticalKey || '').toLowerCase()] || 'local service';
}

function countWords(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Build the extractable answer span from sentences the page already carries.
 *
 * Sentences are taken in the order given - most specific first - and stop being
 * added as soon as the span reaches `min`, or before any sentence that would
 * push it past `max`. Nothing is generated to pad a short span: a page whose own
 * sentences cannot reach 40 words returns what it has and the contract reports
 * it, rather than being handed filler.
 */
function composeAnswerSpan(sentences, min = 40, max = 60) {
  const parts = [];
  let total = 0;
  for (const raw of sentences) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const n = countWords(s);
    if (total && total + n > max) continue;
    parts.push(s);
    total += n;
    if (total >= min) break;
  }
  return parts.join(' ');
}

// Topic-fronted questions, deliberately. Dropping a curated topic into the
// middle of a sentence needs an article the topic does not carry - "What does
// USCIS medical document checklist require?" - and guessing one produces broken
// English on some guide in some pack. A bare noun phrase in front of a colon is
// grammatical whatever the topic is, and the clause after the colon is still the
// question a searcher types.
const GUIDE_QUESTION_SHAPES = {
  'pricing and comparison': (topic) => `${topic}: what does it cost, and what changes the price?`,
  'requirements and checklist planning': (topic) => `${topic}: what is actually required?`,
  'provider interview prep': (topic) => `${topic}: what should you ask before you book?`,
  'next-step planning': (topic) => `${topic}: what happens next?`,
  'high-level orientation': (topic) => `${topic}: what is it, and when does it matter?`,
  'red-flag screening': (topic) => `${topic}: what are the warning signs?`,
  'insurance and coverage': (topic) => `${topic}: what does insurance cover?`,
  'care-format comparison': (topic) => `${topic}: which format fits?`,
  'report and records expectations': (topic) => `${topic}: what should you expect to receive?`,
};

/**
 * The question a guide page answers, in the phrasing a searcher would use.
 *
 * The topic comes from the curated per-guide `heading` in
 * data/contracts/guide_enhancement_registry.json where one exists - a human
 * wrote those - and falls back to the page title. The question shape comes from
 * the guide's own route classification, which the renderer already derives.
 */
function guideQuestionHeading(route, title) {
  const entry = loadGuideEnhancementRegistry()[String(route || '')] || null;
  const topicRaw = String((entry && entry.heading) || title || '').trim();
  if (!topicRaw) return 'What should you know before you decide?';
  // A curated heading is a noun phrase ("Costs and timeframes"); a page title is
  // often a full sentence with a colon ("USCIS Medical Exam Costs and
  // Timeframes: General Information"). Take the part before the colon so the
  // question does not swallow the subtitle.
  const topic = topicRaw.split(/\s*[:—]\s*/)[0].replace(/\s*\|.*$/, '').trim();
  const label = inferGuideLabelFromRoute(route);
  const shape = GUIDE_QUESTION_SHAPES[label];
  return shape ? shape(topic) : `${topic}: what should you know before you decide?`;
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
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-short-answer="true" data-citation-summary-type="city-home">' +
      '<h2 id="citation-summary">How do you compare ' + verticalLabel + ' options in ' + marketLabel + '?</h2>' +
      '<p data-citation-summary-lede="true" data-citation-summary-answer="true">' + composeAnswerSpan([
        'When people compare ' + verticalLabel + ' options in <strong>' + marketLabel + '</strong>, four things narrow the field fastest: fit for the specific situation, verification that the provider is authorized to do the work, how clearly the process and paperwork are explained, and what follow-up is included.',
        'Convenience and price alone rarely settle the choice.',
        'Costs, timelines, and verification steps vary by market.'
      ]) + '</p>' +
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
    // The state name is what a searcher types, not the page's full title
    // ("USCIS Exam Guides in Georgia — state hub"). Take it from the caller
    // where it is passed, and recover it from the title otherwise so the
    // heading is still a question rather than a label.
    const stateName = escapeHtml(String((opts && opts.stateName) || '').trim())
      || (title.split(/\s+in\s+/i)[1] || title).split(/\s*(?:&mdash;|—|-)\s*/)[0].trim();
    const stateVerticalLabel = escapeHtml(String((opts && opts.verticalLabel) || 'local service').trim());
    return (
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-short-answer="true" data-citation-summary-type="state-home">' +
      '<h2 id="citation-summary">How do you compare ' + stateVerticalLabel + ' options across ' + stateName + '?</h2>' +
      '<p data-citation-summary-lede="true" data-citation-summary-answer="true">' + composeAnswerSpan([
        'Across <strong>' + stateName + '</strong> the same comparison holds in every market: confirm the provider is licensed and authorized to do the work, check the official state or agency lookup rather than a directory listing, compare what a quoted price actually covers, and ask how long each step takes.',
        'Statewide rules set the floor; the local market sets the rest.',
        'Licensing and disciplinary history are worth reviewing before any of that.'
      ]) + '</p>' +
      '<p class="answer-when">Use the state layer to compare firms, review official resources, and evaluate licensing or disciplinary history; however, the right choice depends on your case and priorities.</p>' +
      '<p class="answer-boundary">This page is educational and is designed to help you evaluate statewide options before you decide what to do next.</p>' +
      '</section>'
    );
  }

  if (kind === 'guide-detail') {
    const guideLabel = escapeHtml(inferGuideLabelFromRoute(route));
    const guideEntry = loadGuideEnhancementRegistry()[String(route || '')] || null;
    return (
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-short-answer="true" data-citation-summary-type="guide-detail">' +
      '<h2 id="citation-summary">' + escapeHtml(guideQuestionHeading(route, String((opts && opts.title) || ''))) + '</h2>' +
      // The curated per-guide sentences in the enhancement registry are the
      // page's own answer, written by a human for this exact guide. Preferring
      // them over the generic template is what makes eight guide answers eight
      // different answers rather than one sentence with the title swapped in.
      '<p data-citation-summary-lede="true" data-citation-summary-answer="true">' + composeAnswerSpan([
        guideEntry && guideEntry.best ? escapeHtml(guideEntry.best) : '',
        guideEntry && guideEntry.key ? escapeHtml(guideEntry.key) : '',
        guideEntry && guideEntry.mistake ? 'The common mistake: ' + escapeHtml(guideEntry.mistake) : '',
        // A guide with no curated registry entry falls back to its own
        // description, which says something, before the sentence that only
        // restates the title, which does not.
        description,
        '<strong>' + title + '</strong> is a guide for ' + guideLabel + '.',
        'Use it when the question is narrow enough that a city or state hub is too broad.'
      ]) + '</p>' +
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
      '<section class="section citation-summary answer-block" data-citation-summary="true" data-short-answer="true" data-citation-summary-type="guides-hub">' +
      '<h2 id="citation-summary">Which guide should you open first?</h2>' +
      '<p data-citation-summary-lede="true" data-citation-summary-answer="true">' + composeAnswerSpan([
        'Open the guide that matches whatever is still unsettled: cost, requirements, what documents to bring, what to ask a provider, or what happens after.',
        // The page title carries a " | Brand" suffix; a sentence should not.
        '<strong>' + title.replace(/\s*\|.*$/, '') + '</strong> is the index for those guides, and it is the right page only while the question is still broad.',
        'The leaf guide carries the actual comparison, caution, and next step.'
      ]) + '</p>' +
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
  // Copy sponsor assets into public assets/sponsors/<slug>/
  try {
    const sponsorIntakeDir = path.join(DATA_DIR, "sponsor_intake", "sponsors");
    const sponsorPublicRoot = path.join(assetsDst, "sponsors");
    if (fs.existsSync(sponsorIntakeDir)) {
      fs.mkdirSync(sponsorPublicRoot, { recursive: true });
      for (const entry of fs.readdirSync(sponsorIntakeDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
        const srcAssets = path.join(sponsorIntakeDir, entry.name, "assets");
        if (!fs.existsSync(srcAssets)) continue;
        const dstAssets = path.join(sponsorPublicRoot, entry.name);
        fs.mkdirSync(dstAssets, { recursive: true });
        fs.cpSync(srcAssets, dstAssets, { recursive: true });
      }
    }
  } catch (e) {}
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
      const stateLead = renderCitationSummaryZoneHtml({ kind: 'state-home', title, description, stateName, verticalLabel: verticalLabelFor(verticalKey), hrefs: { guides: '/guides/', faq: '/faq/', methodology: '/methodology/' } });
      const groupedGuides = '<section class="section state-guides-support" data-state-guides-support="true"><h2>State-level guides and support</h2><div class="grid">' + guideLinks.map((g) => '<div class="card"><h3><a href="' + escapeHtml(g.href) + '">' + escapeHtml(g.label) + '</a></h3><p>' + escapeHtml(g.description || 'Guide') + '</p></div>').join('') + '</div></section>';
      let mainHtml = (
        (isStarterTrainingPack(pageSet) ? renderTrainingBannerHtml('Sandbox state page. Use this to practice state-level audits and city coverage checks.') : '') +
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
      mapped = injectAdPlacements(mapped, ads, { verticalKey, stateAbbr: ab, pageType: 'state' });
      mapped = applyExplicitSponsorSurfaceOverrides(mapped, { pageKind: 'state', route: 'states/' + ab, verticalKey, stateAbbr: ab });
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

      const mainHtml = (isStarterTrainingPack(pageSet) ? renderTrainingBannerHtml('Sandbox next-steps page. Use this to practice conversion-flow audits.') : '') + renderDedicatedNextStepsHubHtml({
        marketLabel: stateName,
        pageTitle: title,
        compareHref: '/guides/?intent=decision_hub&button=next_steps_page_compare&vertical=pi&page_kind=next_steps&page_slug=states-' + String(ab).toLowerCase() + '-next-steps&market=' + String(ab).toLowerCase(),
        toolsHref: '/faq/?intent=self_serve&button=next_steps_page_tools&vertical=pi&page_kind=next_steps&page_slug=states-' + String(ab).toLowerCase() + '-next-steps&market=' + String(ab).toLowerCase(),
        requestAssistanceHtml: extractRequestAssistanceHtml(pageSet),
        sponsorRouting: getSponsorRoutingForContext({ pageKind: 'state', route: 'states/' + ab + '/next-steps', verticalKey: 'pi', stateAbbr: ab })
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
      const stateName = String(
        (ALL_US_STATES && (ALL_US_STATES[ab].name || ALL_US_STATES[ab])) ||
        st.stateName ||
        ab
      );
      const title = stateName + ' personal injury guide';
      const description = 'Use this state guide to compare firms, check official resources, and understand what to look for before contacting a personal injury lawyer in ' + stateName + '.';

      const cityRows = cities.filter(c => String(c.state).toUpperCase() == ab);
      const cityLinks = cityRows.map((c) => ({ href: '/' + String(c.slug || '').replace(/^\/+|\/+$/g, '') + '/', label: String(c.city || c.marketLabel || c.slug || '').split(',')[0].trim() || String(c.marketLabel || c.slug || 'City') }));
      let listingsAgg = [];
      const stateFirmPath = path.join(DATA_DIR, 'pi_state_firms', String(ab).toLowerCase() + '.json');
      if (fs.existsSync(stateFirmPath)) {
        const stateFirmData = readJson(stateFirmPath) || {};
        const firms = Array.isArray(stateFirmData.firms) ? stateFirmData.firms : [];
        listingsAgg = firms.map((it) => ({ ...it, __marketLabel: String(it.city_label || '').trim() }));
      } else {
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
      }

      listingsAgg.sort((a, b) => {
        const an = String((a && (a.firm_name || a.name)) || '').toLowerCase();
        const bn = String((b && (b.firm_name || b.name)) || '').toLowerCase();
        return an.localeCompare(bn);
      });

      const directoryCards = listingsAgg.slice(0, 40).map(it => {
        const name = String((it.firm_name || it.name || '')).trim();
        const loc = String(it.__marketLabel || '').trim();
        return (
          '<div class="card">' +
          '<h3 style="margin:0 0 6px 0">' + escapeHtml(name) + '</h3>' +
          (loc ? ('<p class="muted" style="margin:0 0 6px 0">' + escapeHtml(loc) + '</p>') : '') +
          '<p style="margin:0"><span>Listed in this state directory</span></p>' +
          '</div>'
        );
      }).join("\n");

      const disciplineUrl = disciplineLinks[ab] ? String(disciplineLinks[ab]) : '';
      const stateFaqItems = [
        {
          q: `How do I choose a personal injury lawyer in ${String(stateName)}?`,
          a: `Use a consistent checklist: verify licensing and discipline history, confirm relevant practice focus, ask about fee terms, and compare communication and case-handling process. This site is educational only and does not rank providers.`
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
      const stateFaqAccordion = (
        '<details class="accordion" id="state-faq">' +
        '<summary>FAQs <span class="accordion-meta">Optional quick answers</span></summary>' +
        '<div class="accordion-panel">' +
        '<div class="faq-accordion" data-faq-accordion="state">' + renderFaqCardsHtml(stateFaqItems) + '</div>' +
        '</div>' +
        '</details>'
      );
      let mainHtml = (
        (isStarterTrainingPack(pageSet) ? renderTrainingBannerHtml('Sandbox state page. Use this to practice state-level audits and inventory checks.') : '') +
        '<section class="hero" data-state-hero="true" data-pi-state-page="true">' +
        '<p class="kicker">Personal injury · State guide</p>' +
        '<h1>' + escapeHtml(stateName) + ' personal injury guide</h1>' +
        '<p class="muted">Use this state page for neutral decision support, firm comparison, and official verification resources.</p>' +
        '</section>' +
        '%%AD:pi_state_top%%' +
        '<section class="state-authority-block" data-state-authority-block="true" data-state-authority-strength="true" data-state-authority-dominance="true">' +
        '<p>This page brings together verified firm listings and official resources for this state so you can compare firms and evaluate your options in one place.</p>' +
        '<p>Use the directory below to compare firms, and reference the official resources further down to validate credentials, disciplinary history, and licensing status.</p>' +
        '</section>' +
        '<section class="section state-best-lawyer-block answer-block" data-pi-best-lawyer-answer="true">' +
        '<h2>Who Is the Best Personal Injury Lawyer in ' + escapeHtml(stateName) + '?</h2>' +
        '<p>The “best” personal injury lawyer in ' + escapeHtml(stateName) + ' depends on your case, your priorities, and how different firms handle situations like yours.</p>' +
        '<p>Some firms may be a better fit for serious injury cases, while others focus on faster settlements or specific accident types.</p>' +
        '<p>This guide does not rank firms, but it helps you compare options versus each other and understand tradeoffs; however, the right choice depends on your case and priorities.</p>' +
        '</section>' +
        '<section class="section state-how-to-choose" data-pi-how-to-choose="true">' +
        '<h2>How to Choose a Personal Injury Lawyer in ' + escapeHtml(stateName) + '</h2>' +
        '<p>Use the directory below and the official resources further down to compare firms on:</p>' +
        '<ol>' +
        '<li>experience with your type of case</li>' +
        '<li>communication and responsiveness</li>' +
        '<li>fee structure and case costs</li>' +
        '<li>who will actually handle the case</li>' +
        '<li>disciplinary history and licensing</li>' +
        '<li>whether the firm\'s approach fits your priorities</li>' +
        '</ol>' +
        '<table class="comparison-table" data-pi-comparison-table="true"><thead><tr><th>Factor</th><th>What to compare</th></tr></thead><tbody>' +
        '<tr><td>Case fit</td><td>Has the firm handled claims like yours?</td></tr>' +
        '<tr><td>Fees</td><td>What percentage and what expenses are separate?</td></tr>' +
        '<tr><td>Communication</td><td>Who will call you back and how often?</td></tr>' +
        '<tr><td>Verification</td><td>What do licensing and discipline records show?</td></tr>' +
        '<tr><td>Strategy fit</td><td>Trial posture versus settlement focus.</td></tr>' +
        '</tbody></table>' +
        '</section>' +
        '<section class="section micro-guides" data-guides-micro="true">' +
        '<p><strong>Start here:</strong> ' +
        '<a href="/guides/personal-injury-fees-explained/">Costs</a> • ' +
        '<a href="/guides/what-to-do-after-an-accident/">Timeline</a> • ' +
        '<a href="/guides/questions-to-ask-a-personal-injury-lawyer/">Questions to ask</a> • ' +
        '<a href="/guides/personal-injury-lawyer-red-flags/">Red flags</a> ' +
        '<span class="muted">(educational)</span></p>' +
        '</section>' +
        '%%AD:pi_state_mid%%' +
        renderCitationSummaryZoneHtml({ kind: 'state-home', title, description, stateName, verticalLabel: verticalLabelFor(verticalKey), hrefs: { guides: '/guides/', faq: '/faq/', methodology: '/methodology/' } }) +
        renderStateCityGridHtml(stateName, cityLinks) +
        '<section class="section state-guides-support" data-state-guides-support="true"><h2>State-level guides and support</h2><div class="grid">' + selectPriorityGuideSummaries(globalPagesDir, 4).map((g) => '<div class="card"><h3><a href="' + escapeHtml(g.route) + '">' + escapeHtml(g.title) + '</a></h3><p>' + escapeHtml(g.description || 'Guide') + '</p></div>').join('') + '</div></section>' +
        '<section class="section" data-pi-state-directory="true">' +
        '<h2>Directory Listings (Firms listed for ' + escapeHtml(stateName) + ')</h2>' +
        '<p class="muted">This is a neutral, non-ranked state directory. Use it with the checklist above and the official verification tools below.</p>' +
        '<div class="grid">' + directoryCards + '</div>' +
        '</section>' +
        '<section class="section" data-disciplinary-lookup="true">' +
        '<h2>Attorney discipline & license lookup</h2>' +
        '<p class="muted">If you are checking a license or disciplinary history, use the official state resource:</p>' +
        (disciplineUrl ? ('<p><a href="' + escapeHtml(disciplineUrl) + '" rel="nofollow">Open official ' + escapeHtml(stateName) + ' lookup</a></p>') : '<p class="muted">(Missing link — pack config required.)</p>') +
        '</section>' +
        '<section class="section" data-pi-state-faq="true">' +
        '<h2>FAQs</h2>' +
        '<p class="muted">This is a quick explainer layer. It is not legal advice. We do not rank providers.</p>' +
        stateFaqAccordion +
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
        cityLinks: []
      }));

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
        stateAbbr: ab,
        pageType: 'state'
      });
      mapped = applyExplicitSponsorSurfaceOverrides(mapped, { pageKind: 'state', route: 'states/' + ab, verticalKey: 'pi', stateAbbr: ab });
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
      '<section class="section answer-block" data-home-answer="true" data-short-answer="true"><p class="kicker">State routing hub</p><h1>Personal injury: browse by state</h1><p class="muted">Educational only. No rankings. No endorsements.</p><h2>Short answer</h2><p>Use this hub when the question is still broad and you need to move into the right state page, guide, or local market before comparing firms.</p><p class="answer-when"><strong>Use this hub when:</strong> you need to move from a broad question into the right state guide or canonical PI guide.</p><p class="answer-tradeoff"><strong>Common mistake:</strong> using a state browse page like a final answer instead of a routing layer.</p></section>' +
      '<section class="section pi-hub-compare-block" data-pi-hub-compare="true"><h2>How to use this hub</h2><ol><li>Start with your state page if you are comparing firms.</li><li>Use the core PI guides if your question is about fees, evidence, consultations, or insurance calls.</li><li>Use official verification resources before contacting a firm.</li></ol></section>' +
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
