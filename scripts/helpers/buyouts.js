const fs = require('fs');
const path = require('path');

// Canonical precedence (low → high)
const PRECEDENCE = {
  guide: 1,
  city: 2,
  state: 3,
  vertical: 4,
};

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function parseDate(d) {
  // d is YYYY-MM-DD
  const [y,m,day] = d.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m-1, day, 0, 0, 0));
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
}

function isActive(b, nowUtc = todayUtc()) {
  if (!b || !b.buyout) return false;
  if (b.live !== true) return false;
  if (!b.starts_on || !b.ends_on) return true;
  const s = parseDate(b.starts_on);
  const e = parseDate(b.ends_on);
  return nowUtc >= s && nowUtc < e;
}

function normalizeGuideTarget(t) {
  let x = String(t || '').trim();
  if (!x) return x;
  if (!x.startsWith('/')) x = '/' + x;
  if (!x.endsWith('/')) x += '/';
  return x;
}

function loadBuyouts(repoRoot = process.cwd()) {
  const p = path.join(repoRoot, 'data', 'buyouts.json');
  const arr = readJsonSafe(p);
  return Array.isArray(arr) ? arr : [];
}

function getActiveBuyouts(repoRoot = process.cwd(), nowUtc = todayUtc()) {
  return loadBuyouts(repoRoot).filter((b) => isActive(b, nowUtc));
}

function targetsMatch(scope, targets, ctx) {
  if (!Array.isArray(targets) || !targets.length) return false;
  if (scope === 'vertical') return targets.includes('ALL');
  if (scope === 'city') return !!ctx.city && targets.includes(ctx.city);
  if (scope === 'state') return !!ctx.state && targets.includes(String(ctx.state).toLowerCase());
  if (scope === 'guide') {
    const route = normalizeGuideTarget(ctx.guideRoute);
    const normTargets = targets.map(normalizeGuideTarget);
    return !!route && normTargets.includes(route);
  }
  return false;
}

function resolveWinner(activeBuyouts, ctx) {
  const applicable = activeBuyouts.filter((b) => targetsMatch(b.scope, b.targets, ctx));
  if (!applicable.length) return null;
  applicable.sort((a,b) => {
    const pa = PRECEDENCE[a.scope] || 0;
    const pb = PRECEDENCE[b.scope] || 0;
    if (pa !== pb) return pb - pa;
    // higher priority wins
    const ra = typeof a.priority === 'number' ? a.priority : 0;
    const rb = typeof b.priority === 'number' ? b.priority : 0;
    if (ra !== rb) return rb - ra;
    // stable fallback
    return String(a.id||'').localeCompare(String(b.id||''));
  });
  return applicable[0];
}

function getActiveVerticalBuyout(activeBuyouts) {
  return activeBuyouts.find((b) => b.scope === 'vertical' && b.targets && b.targets.includes('ALL')) || null;
}

function isExcludedFromVertical(activeBuyouts, ctx) {
  // Excluded if a lower-tier buyout is active for this exact page (guide/city/state)
  const winner = resolveWinner(activeBuyouts, ctx);
  if (!winner) return false;
  if (winner.scope === 'vertical') return false;
  // if any non-vertical winner owns the page, vertical is excluded here
  return true;
}

module.exports = {
  PRECEDENCE,
  loadBuyouts,
  getActiveBuyouts,
  resolveWinner,
  getActiveVerticalBuyout,
  isExcludedFromVertical,
  normalizeGuideTarget,
};
