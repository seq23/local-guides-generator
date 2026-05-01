const fs = require('fs');
const path = require('path');

// Buyouts
// -------
// Source of truth: data/buyouts.json
//
// Supported runtime scopes after normalization:
// - vertical
// - state
// - city
//
// Contract rule (runtime): if a LIVE buyout exists, we must suppress conversion surfaces
// (e.g., /for-providers/ links and mailto) and only render the contracted surface(s).


function normalizeBuyoutRecord(rec) {
  if (!rec || typeof rec !== 'object') return null;
  if (rec.scope && rec.targets) return rec;
  const type = String(rec.type || '').trim().toLowerCase();
  if (!type) return rec;
  const sponsorSlug = String(rec.sponsor_slug || '').trim();
  const verticalKey = String(rec.vertical || rec.verticalKey || '').trim() || undefined;
  const starts = String(rec.start_at || rec.starts_on || '').trim();
  const ends = String(rec.end_at || rec.ends_on || '').trim();
  const status = String(rec.status || '').trim().toLowerCase();
  const live = status ? status === 'live' : (rec.live !== false);
  const common = {
    id: rec.id || '',
    sponsor_slug: sponsorSlug,
    verticalKey,
    starts_on: starts || '1900-01-01',
    ends_on: ends || '2099-12-31',
    live,
    buyout: true,
    priority: typeof rec.priority === 'number' ? rec.priority : (type === 'vertical' ? 400 : type === 'state' ? 300 : 200),
    cta_takeover: rec.cta_takeover !== false,
    directory_cta_takeover: rec.directory_cta_takeover === true
  };
  if (type === 'vertical') {
    return { ...common, scope: 'vertical', targets: ['ALL'], states: Array.isArray(rec.states) ? rec.states : [], cities: Array.isArray(rec.cities) ? rec.cities : [] };
  }
  if (type === 'state') {
    const st = String(rec.state || '').trim().toUpperCase();
    return { ...common, scope: 'state', targets: st ? [st] : [], state: st, cities: Array.isArray(rec.cities) ? rec.cities : [] };
  }
  if (type === 'city') {
    const cities = Array.isArray(rec.cities) ? rec.cities.map((s)=>String(s).trim().toLowerCase()).filter(Boolean) : [];
    return { ...common, scope: 'city', targets: cities, state: String(rec.state || '').trim().toUpperCase() || undefined };
  }
  return rec;
}
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

  return data.map(normalizeBuyoutRecord).filter(Boolean);
}



function loadSponsorships(repoRoot) {
  const root = repoRoot || process.cwd();
  const fp = path.join(root, 'data', 'sponsorships.json');
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
}

function cityIncludedInStateBuyout(registry, stateAbbr, citySlug) {
  const states = registry && registry.state_buyouts ? registry.state_buyouts : {};
  const rec = states[String(stateAbbr || '').toUpperCase()] || states[String(stateAbbr || '').toLowerCase()] || null;
  if (!rec) return false;
  const included = []
    .concat(Array.isArray(rec.cities_included) ? rec.cities_included : [])
    .concat(Array.isArray(rec.extra_cities) ? rec.extra_cities : [])
    .map((s) => String(s).trim().toLowerCase());
  return included.includes(String(citySlug || '').trim().toLowerCase());
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
  const citySlug = ctx && (ctx.citySlug || ctx.city) ? String(ctx.citySlug || ctx.city) : null;
  const state = ctx && ctx.state ? String(ctx.state) : null;
  const guideRoute = ctx && (ctx.guideRoute || ctx.guideSlug) ? String(ctx.guideRoute || ctx.guideSlug) : null;
  const verticalKey = ctx && ctx.verticalKey ? ctx.verticalKey : null;

  const targets = Array.isArray(rec.targets) ? rec.targets.map((t) => String(t)) : null;

  if (scope === 'vertical') {
    if (!matchesVerticalKey(rec, verticalKey)) return false;
    // Canonical: targets:["ALL"] means full pack.
    if (!targets) return true; // legacy support
    return targets.some((t) => String(t).trim().toLowerCase() === 'all');
  }

  if (scope === 'state') {
    if (!state) return false;
    const stateMatch = targets
      ? targets.some((t) => String(t).trim().toUpperCase() === state.trim().toUpperCase())
      : String(rec.state || '').trim().toUpperCase() === state.trim().toUpperCase();
    if (!stateMatch) return false;
    if (citySlug) {
      const registry = loadSponsorships(process.cwd());
      return cityIncludedInStateBuyout(registry, state, citySlug);
    }
    return true;
  }

  if (scope === 'city') {
    if (!citySlug) return false;
    if (targets) return targets.some((t) => String(t).trim().toLowerCase() === citySlug.trim().toLowerCase());
    // legacy support
    return String(rec.citySlug || '').trim().toLowerCase() === citySlug.trim().toLowerCase();
  }

    // Guide surfaces are vertical-buyout only. Standalone guide buyouts are not valid in the current model.
  if (scope === 'category' || scope === 'guide') {
    return false;
  }

  return false;
}


function precedence(scope) {
  // Higher wins.
  // Canonical: vertical overrides everything; then state; then city; then guide/category.
  if (scope === 'vertical') return 400;
  if (scope === 'state') return 300;
  if (scope === 'city') return 200;
  if (scope === 'category' || scope === 'guide') return 100;
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
