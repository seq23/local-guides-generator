const fs = require('fs');
const path = require('path');

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
  const registry = loadSponsorshipsSafe(process.cwd());
  const recs = registry && registry.vertical_buyouts ? registry.vertical_buyouts : {};
  const rec = recs[String(verticalKey || '')] || null;
  if (!rec) return null;
  if (rec.live === false) return null;
  return rec;
}

function getActiveVerticalLeadRouting(verticalKey, now = new Date()) {
  const rec = getActiveVerticalBuyoutConfig(verticalKey, now);
  if (!rec || !rec.sponsor_slug) return null;
  return {
    sponsor_slug: String(rec.sponsor_slug),
    sponsor_scope: 'vertical_buyout',
    campaign_slug: String(rec.campaign_slug || ''),
    lead_target: String(rec.lead_target || ''),
    sponsor_name: String(rec.sponsor_name || rec.sponsor_slug || '')
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

  // Vertical buyout enables Next Steps CTA across eligible surfaces.
  if (winner.scope === 'vertical') return true;

    // State buyout may enable a locked next-steps CTA on the state page only.
  if (winner.scope === 'state') {
    return pageType === 'state';
  }

  // City/guide buyouts do not enable the Next Steps CTA surface.
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
