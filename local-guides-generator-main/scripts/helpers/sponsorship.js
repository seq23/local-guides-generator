const fs = require('fs');
const path = require('path');
const sponsorCatalog = require('./sponsor_catalog');

const CTA_COPY = {
  text: 'Use the decision hub to get matched now, compare options, or use lookup tools before you submit anything.',
  button: 'View Next Steps',
};

function normalizeSlug(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase();
}

function isInDateWindow(b, now = new Date()) {
  if (!b) return false;
  const start = b.starts_on ? new Date(b.starts_on) : null;
  const end = b.ends_on ? new Date(b.ends_on) : null;
  if (start && Number.isNaN(start.getTime())) return false;
  if (end && Number.isNaN(end.getTime())) return false;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function loadBuyoutsSafe(repoRoot) {
  try {
    const fp = path.join(repoRoot || process.cwd(), 'data', 'buyouts.json');
    if (!fs.existsSync(fp)) return [];
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}


function loadSponsorshipsSafe(repoRoot) {
  try {
    const fp = path.join(repoRoot || process.cwd(), 'data', 'sponsorships.json');
    if (!fs.existsSync(fp)) return {};
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function getActiveVerticalBuyoutConfig(verticalKey, now = new Date()) {
  const buyouts = loadBuyoutsSafe(process.cwd());
  const rec = (buyouts || []).find((b) => {
    if (!b || b.live === false) return false;
    if (String(b.scope || '') !== 'vertical') return false;
    const key = String(verticalKey || '').trim();
    const recKey = String(b.verticalKey || b.vertical || '').trim();
    if (key && recKey && key !== recKey) return false;
    return isInDateWindow({ starts_on: b.starts_on || b.start_at, ends_on: b.ends_on || b.end_at }, now);
  }) || null;
  return rec;
}

function getActiveVerticalLeadRouting(verticalKey, now = new Date()) {
  const rec = getActiveVerticalBuyoutConfig(verticalKey, now);
  if (!rec || !rec.sponsor_slug) return null;
  const sponsor = sponsorCatalog.getSponsorBySlug(process.cwd(), rec.sponsor_slug);
  return {
    sponsor_slug: String(rec.sponsor_slug),
    sponsor_scope: 'vertical_buyout',
    campaign_slug: String(rec.campaign_slug || rec.id || ''),
    lead_target: String(rec.lead_target || (sponsor && sponsor.lead_email) || ''),
    sponsor_name: String((sponsor && sponsor.display_name) || rec.sponsor_slug || ''),
    sponsor_phone: String((sponsor && sponsor.phone) || ''),
    sponsor_website: String((sponsor && sponsor.website_url) || ''),
    sponsor_logo: String((sponsor && sponsor.assets && sponsor.assets.logo) || ''),
    assets: (sponsor && sponsor.assets) || {}
  };
}

function isLiveVerticalBuyout(buyouts = [], now = new Date()) {
  return (buyouts || []).some(
    (b) =>
      b &&
      b.live === true &&
      b.buyout === true &&
      b.scope === 'vertical' &&
      Array.isArray(b.targets) &&
      b.targets.some((t) => normalizeSlug(t) === 'all') &&
      isInDateWindow(b, now)
  );
}

function coreShouldRenderNextSteps({
  pageType,
  citySlug,
  stateCode,
  guideRoute,
  buyouts,
  now,
}) {
  const { resolveWinner } = require('./buyouts');

  if (!pageType) return false;
  if (!['home', 'city', 'guide', 'state'].includes(pageType)) return false;

  const ctx = {
    city: citySlug || null,
    state: stateCode || null,
    guideRoute: guideRoute || null,
  };

  const winner = resolveWinner(buyouts || [], ctx, now);
  if (!winner) return false;

  // Vertical buyout enables sponsor-owned CTA routing across covered surfaces, including guides.
  if (winner.scope === 'vertical') return true;

  // State buyout enables sponsor-owned CTA routing on the state page.
  if (winner.scope === 'state') {
    return pageType === 'state';
  }

  // City buyout enables sponsor-owned CTA routing on the city page.
  if (winner.scope === 'city') {
    return pageType === 'city';
  }

  return false;
}


// Backward-compatible signature:
// - NEW: shouldRenderNextSteps({ pageType, citySlug, stateCode, guideRoute, buyouts, now })
// - OLD: shouldRenderNextSteps(pageSet, ctx)
function shouldRenderNextSteps(arg1, arg2) {
  // NEW
  if (arg1 && typeof arg1 === 'object' && arg2 === undefined && ('pageType' in arg1 || 'buyouts' in arg1)) {
    const params = Object.assign({ buyouts: [], now: new Date() }, arg1);
    return coreShouldRenderNextSteps(params);
  }

  // OLD
  const ctx = arg2 || {};
  const buyouts = loadBuyoutsSafe(process.cwd());
  const pageType = ctx.pageType || null;
  const citySlug = ctx.citySlug || ctx.city_slug || null;
  const stateCode = ctx.stateCode || ctx.state || null;
  const guideRoute = ctx.guideRoute || ctx.route || null;
  return coreShouldRenderNextSteps({
    pageType,
    citySlug,
    stateCode,
    guideRoute,
    buyouts,
    now: new Date(),
  });
}

function getNextStepsCtaCopy() {
  return CTA_COPY.text;
}

function getNextStepsButtonCopy() {
  return CTA_COPY.button;
}

function getNextStepsHref({ distPath }) {
  try {
    if (!distPath) return null;
    const nextStepsIndex = path.join(distPath, 'next-steps', 'index.html');
    if (fs.existsSync(nextStepsIndex)) return '/next-steps/';
  } catch {
    // ignore
  }
  return null;
}


function isSponsorLive(sponsor) {
  if (!sponsor) return false;
  if (typeof sponsor.is_live === "boolean") return sponsor.is_live;
  if (typeof sponsor.live === "boolean") return sponsor.live;
  if (typeof sponsor.status === "string") return sponsor.status.toUpperCase() === "LIVE";
  return false;
}

module.exports = {
  CTA_COPY,
  isSponsorLive,
  isLiveVerticalBuyout,
  shouldRenderNextSteps,
  getNextStepsCtaCopy,
  getNextStepsButtonCopy,
  getNextStepsHref,
  loadSponsorshipsSafe,
  getActiveVerticalBuyoutConfig,
  getActiveVerticalLeadRouting,
};
