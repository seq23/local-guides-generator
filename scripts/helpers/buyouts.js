const fs = require('fs');
const path = require('path');

// Buyouts
// -------
// Source of truth: data/buyouts.json
//
// Supported scopes:
// - vertical: applies across an entire vertical pack (optionally filtered by verticalKey)
// - state: applies to a state hub + covered pages within that state
// - city: applies to a single city page
// - category: applies to a guide page ("guide buyout" in business language)
//
// Contract rule (runtime): if a LIVE buyout exists, we must suppress conversion surfaces
// (e.g., /for-providers/ links and mailto) and only render the contracted surface(s).

function parseIsoDate(s) {
  if (!s || typeof s !== 'string') return null;
  // Date-only ISO strings are interpreted in UTC by Date(). That's fine for contract windows.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isLive(rec, now = new Date()) {
  if (!rec || typeof rec !== 'object') return false;
  if (rec.live === false) return false;
  const starts = parseIsoDate(rec.starts_on);
  const ends = parseIsoDate(rec.ends_on);
  if (!starts || !ends) return false;
  return now >= starts && now <= ends;
}

function loadBuyouts(repoRoot) {
  const root = repoRoot || process.cwd();
  const fp = path.join(root, 'data', 'buyouts.json');
  let raw;
  try {
    raw = fs.readFileSync(fp, 'utf8');
  } catch (e) {
    // No buyouts file -> no buyouts.
    return [];
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid JSON in ${fp}: ${e.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`data/buyouts.json must be an array (got ${typeof data})`);
  }

  return data;
}

function matchesVerticalKey(rec, verticalKey) {
  if (!verticalKey) return true;
  // If the record declares a verticalKey, it must match.
  if (rec.verticalKey && typeof rec.verticalKey === 'string') {
    return rec.verticalKey === verticalKey;
  }
  // Backward compatibility: allow vertical_keys as an array.
  if (Array.isArray(rec.verticalKeys)) {
    return rec.verticalKeys.includes(verticalKey);
  }
  // If unspecified, treat as global (applies to all verticals).
  return true;
}

function targetsMatch(rec, ctx) {
  if (!rec || typeof rec !== 'object') return false;
  const scope = rec.scope;

  // Common context
  const citySlug = ctx && ctx.citySlug ? ctx.citySlug : null;
  const state = ctx && ctx.state ? ctx.state : null;
  const guideRoute = ctx && (ctx.guideRoute || ctx.guideSlug) ? (ctx.guideRoute || ctx.guideSlug) : null;
  const verticalKey = ctx && ctx.verticalKey ? ctx.verticalKey : null;

  if (scope === 'vertical') {
    if (!matchesVerticalKey(rec, verticalKey)) return false;
    return true;
  }

  if (scope === 'state') {
    if (!state) return false;
    return rec.state === state;
  }

  if (scope === 'city') {
    if (!citySlug) return false;
    return rec.citySlug === citySlug;
  }

  // "category" is the guide page buyout.
  if (scope === 'category') {
    if (!guideRoute) return false;
    return rec.guideSlug === guideRoute;
  }

  return false;
}

function precedence(scope) {
  // Higher wins.
  // Canonical: vertical overrides everything; then state; then city; then guide/category.
  if (scope === 'vertical') return 400;
  if (scope === 'state') return 300;
  if (scope === 'city') return 200;
  if (scope === 'category') return 100;
  return 0;
}

function resolveWinner(buyouts, ctx, now = new Date()) {
  const list = Array.isArray(buyouts) ? buyouts : [];
  const live = list.filter((b) => isLive(b, now) && targetsMatch(b, ctx));
  if (live.length === 0) return null;

  // Highest precedence first, then priority, then ends_on farther out.
  live.sort((a, b) => {
    const pa = precedence(a.scope);
    const pb = precedence(b.scope);
    if (pa !== pb) return pb - pa;

    const priA = typeof a.priority === 'number' ? a.priority : 0;
    const priB = typeof b.priority === 'number' ? b.priority : 0;
    if (priA !== priB) return priB - priA;

    const ea = parseIsoDate(a.ends_on);
    const eb = parseIsoDate(b.ends_on);
    const ta = ea ? ea.getTime() : 0;
    const tb = eb ? eb.getTime() : 0;
    return tb - ta;
  });

  return live[0];
}

function filterLiveForVertical(buyouts, verticalKey, now = new Date()) {
  const list = Array.isArray(buyouts) ? buyouts : [];
  return list.filter(
    (b) => isLive(b, now) && b.scope === 'vertical' && matchesVerticalKey(b, verticalKey)
  );
}

module.exports = {
  loadBuyouts,
  isLive,
  filterLiveForVertical,
  targetsMatch,
  resolveWinner,
};
