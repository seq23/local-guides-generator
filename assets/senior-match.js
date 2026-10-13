/**
 * Memphis Senior Care Homes - the ONE matcher.
 *
 * Shared by the browser wizard (assets/senior-intake.js loads this file first and
 * reads window.SeniorMatch) and by the lead backend (lib/senior/*.mjs imports it),
 * so the list a family sees and the list of communities that get a teaser can
 * never be computed by two different rules. Pinned by tests/senior/*.test.mjs.
 *
 * Health answers stay as tiers and flags, never free text:
 *   care tier 1 = 0-1 day-to-day tasks needing help, 2 = 2-4, 3 = 5-6 (the
 *   skilled-nursing boundary: assisted living is not the right fit, so tier 3
 *   is an off-ramp, never routed to a community).
 *
 * Facility rows (data/listings/senior-living/facilities.json, published at
 * /data/facilities.json) are read through normalizeFacility, which accepts the
 * field-name variants documented in docs/SENIOR_LEAD_RUNBOOK.md.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SeniorMatch = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ADL_TASKS = ['bathing', 'dressing', 'transferring', 'medications', 'mobility', 'eating'];
  var WHO_FOR = ['myself', 'parent', 'spouse', 'professional'];
  var RADII = ['10', '20', '30', 'anywhere'];
  var BUDGET_BANDS = {
    under_3000: { label: 'Under $3,000 a month', min: 0, max: 3000 },
    '3000_4500': { label: '$3,000 - $4,500 a month', min: 3000, max: 4500 },
    '4500_6000': { label: '$4,500 - $6,000 a month', min: 4500, max: 6000 },
    over_6000: { label: '$6,000+ a month', min: 6000, max: Infinity }
  };
  var PAYERS = {
    savings: 'Savings or income',
    ltc_insurance: 'Long-term-care insurance',
    va: 'VA benefits',
    home_sale: 'Selling a home',
    medicaid: 'Medicaid or TennCare'
  };
  var TIMELINES = {
    this_week: 'This week (hospital discharge)',
    within_30: 'Within 30 days',
    one_to_three_months: 'In 1-3 months',
    planning: 'Just planning'
  };
  var TAGS = ['pets', 'faith', 'social', 'quiet', 'dining', 'smoking'];
  var DEMENTIA = ['yes', 'no', 'not_sure'];

  function tierFromAdl(tasks) {
    var n = 0;
    (tasks || []).forEach(function (t) { if (ADL_TASKS.indexOf(t) !== -1) n += 1; });
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    return 3;
  }

  /** Why this lead cannot be sold to a community, or '' when it can. */
  function offRampReason(lead) {
    if (Number(lead.care_tier) >= 3) return 'tier3_skilled_nursing';
    var payers = (lead.payers || []).filter(Boolean);
    if (payers.length && payers.every(function (p) { return p === 'medicaid'; })) return 'medicaid_only';
    return '';
  }

  function slug(t) {
    return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(String(v).replace(/[$,\s]/g, ''));
    return isFinite(n) && n > 0 ? n : null;
  }

  function truthyFlag(v) {
    return v === true || v === 1 || v === 'yes' || v === 'true' || v === 'Yes';
  }

  /** One facility row, whatever spelling the listings file used. */
  function normalizeFacility(f) {
    f = f || {};
    var services = [].concat(f.care_types || [], f.services || [], f.care_levels || []).map(function (s) {
      return String(s).toLowerCase().replace(/[\s-]+/g, '_');
    });
    var rates = f.rates || f.monthly_rate || {};
    var rateMin = num(f.rate_min != null ? f.rate_min : (f.monthly_rate_min != null ? f.monthly_rate_min : (rates && rates.min)));
    var rateMax = num(f.rate_max != null ? f.rate_max : (f.monthly_rate_max != null ? f.monthly_rate_max : (rates && rates.max)));
    if (rateMin == null && typeof f.monthly_rate !== 'object') rateMin = num(f.monthly_rate);
    if (rateMax == null) rateMax = rateMin;
    if (rateMin == null) rateMin = rateMax;
    var lat = num(f.lat != null ? f.lat : (f.latitude != null ? f.latitude : (f.geo && f.geo.lat)));
    var lngRaw = f.lng != null ? f.lng : (f.lon != null ? f.lon : (f.longitude != null ? f.longitude : (f.geo && (f.geo.lng != null ? f.geo.lng : f.geo.lon))));
    var lng = lngRaw == null || lngRaw === '' ? null : Number(lngRaw);
    if (lng !== null && !isFinite(lng)) lng = null;
    var email = String(f.email || f.lead_email || f.contact_email || '').trim();
    return {
      // Stable id: an explicit id/slug, else the state licence number, else name + ZIP.
      id: String(f.id || f.facility_id || f.slug || f.license_number || slug((f.name || '') + ' ' + (f.zip || ''))).trim(),
      name: String(f.name || f.display_name || '').trim(),
      phone: String(f.phone || '').trim(),
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
      address: String(f.address || f.street || '').trim(),
      city: String(f.city || '').trim(),
      zip: String(f.zip || f.postal_code || '').trim().slice(0, 5),
      url: String(f.url || f.website || f.website_url || '').trim(),
      lat: lat,
      lng: lng,
      memory_care: truthyFlag(f.memory_care) || services.indexOf('memory_care') !== -1,
      rate_min: rateMin,
      rate_max: rateMax,
      no_teasers: truthyFlag(f.no_teasers)
    };
  }

  function facilityList(doc) {
    var rows = Array.isArray(doc) ? doc : (doc && (doc.facilities || doc.listings || doc.items)) || [];
    return rows.map(normalizeFacility).filter(function (f) { return f.id && f.name; });
  }

  function haversine(a, b) {
    var R = 3958.8;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(b[0] - a[0]);
    var dLng = toRad(b[1] - a[1]);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function pointFor(f, zips) {
    if (f.lat != null && f.lng != null) return [f.lat, f.lng];
    var z = zips && zips[f.zip];
    return z ? [z[0], z[1]] : null;
  }

  /** Miles from the lead's zip to the facility, or null when either point is unknown. */
  function distanceMiles(lead, f, zips) {
    var origin = zips && zips[String(lead.zip || '').slice(0, 5)];
    var p = pointFor(f, zips);
    if (!origin || !p) return null;
    return Math.round(haversine(origin, p) * 10) / 10;
  }

  function rateFits(f, band) {
    var b = BUDGET_BANDS[band];
    if (!b) return true;
    if (f.rate_min == null && f.rate_max == null) return true; // unknown rate never excludes
    var lo = f.rate_min == null ? f.rate_max : f.rate_min;
    var hi = f.rate_max == null ? f.rate_min : f.rate_max;
    return lo < b.max && hi >= b.min;
  }

  /** The hard filters: memory-care match, tier <= 2, rate within band when known. */
  function fits(f, lead) {
    if (Number(lead.care_tier) >= 3) return false;
    if (truthyFlag(lead.memory_care) && !f.memory_care) return false;
    return rateFits(f, lead.budget_band);
  }

  function byDistance(a, b) {
    if (a.distance == null && b.distance == null) return a.name.localeCompare(b.name);
    if (a.distance == null) return 1;
    if (b.distance == null) return -1;
    return a.distance - b.distance || a.name.localeCompare(b.name);
  }

  function withDistance(list, lead, zips) {
    return list.map(function (f) {
      var o = {};
      for (var k in f) o[k] = f[k];
      o.distance = distanceMiles(lead, f, zips);
      return o;
    });
  }

  /**
   * What the family sees: `matches` pass the hard filters and the radius, nearest first;
   * `others` is everything else in the file, so the family always sees every community.
   */
  function results(facilities, lead, zips) {
    var radius = lead.radius && lead.radius !== 'anywhere' ? Number(lead.radius) : null;
    var all = withDistance(facilities, lead, zips);
    var matches = [];
    var others = [];
    all.forEach(function (f) {
      var inRadius = radius == null || f.distance == null || f.distance <= radius;
      (fits(f, lead) && inRadius ? matches : others).push(f);
    });
    return { matches: matches.sort(byDistance), others: others.sort(byDistance) };
  }

  /**
   * Who gets a teaser in the open round: every fitting community with an email that has
   * not opted out (no_teasers) and is not excluded, nearest first.
   */
  function openRoundTargets(facilities, lead, zips, exclude) {
    var skip = exclude || [];
    return withDistance(facilities, lead, zips)
      .filter(function (f) { return f.email && !f.no_teasers && skip.indexOf(f.id) === -1 && fits(f, lead); })
      .sort(byDistance);
  }

  return {
    ADL_TASKS: ADL_TASKS,
    WHO_FOR: WHO_FOR,
    RADII: RADII,
    BUDGET_BANDS: BUDGET_BANDS,
    PAYERS: PAYERS,
    TIMELINES: TIMELINES,
    TAGS: TAGS,
    DEMENTIA: DEMENTIA,
    MAX_ACCEPTS: 5,
    tierFromAdl: tierFromAdl,
    offRampReason: offRampReason,
    normalizeFacility: normalizeFacility,
    facilityList: facilityList,
    distanceMiles: distanceMiles,
    fits: fits,
    results: results,
    openRoundTargets: openRoundTargets
  };
});
