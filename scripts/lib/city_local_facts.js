'use strict';
/**
 * What a city page can say that is true only of that city, from published data
 * already pulled into this repo. Nothing here is estimated or written by a model:
 * every number is a field of a research file, and every block names its source.
 *
 *   pi            NHTSA FARS fatal-crash census, city / county / state
 *                 (data/research/pi/fars_city_fatal_crashes.json,
 *                  scripts/research/pull_fars_city_fatal_crashes.py)
 *   trt, neuro    CMS Medicare Physician & Other Practitioners, by provider (city of
 *                 the practice address) and by geography (state, national)
 *                 (data/research/costs/cms_provider_city_<set>_2024.json,
 *                  data/research/costs/cms_geography_service_2024.json)
 *
 * WHY. With the shared checklist folded into the guides (scripts/lib/template_text.js),
 * a city page has to carry its own facts or it carries nothing; the Monday
 * quality sample read two cities' pages as one because they were one (Search
 * Readiness q1, 7 Nov 2026). USCIS and senior-living pages already lead with their
 * own researched facts and are not handled here.
 *
 * Each vertical returns { answer, html, faq } or null when the city has no data:
 *   answer  40-60 words, the citation-summary answer (answer_shape_contract.js)
 *   html    a <section> with the figures as a table and the source line
 *   faq     [{ q, a }] questions the figures answer, first in the city FAQ
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data');
const FARS_URL = 'https://www.nhtsa.gov/research-data/fatality-analysis-reporting-system-fars';
const CMS_PROVIDER_URL = 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service';
const CMS_GEO_URL = 'https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-geography-and-service';

const _json = new Map();
function readJson(rel) {
  if (_json.has(rel)) return _json.get(rel);
  const fp = path.join(DATA, rel);
  let v = null;
  try { v = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : null; } catch (_) { v = null; }
  _json.set(rel, v);
  return v;
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (x) => Number(x || 0).toLocaleString('en-US');
const usd = (x) => '$' + Number(x).toFixed(2);
const words = (t) => (String(t).replace(/<[^>]+>/g, ' ').match(/[A-Za-z0-9][\w'’-]*/g) || []).length;
const plural = (k, one, many) => (Number(k) === 1 ? one : many);

/** The first candidate answer that lands in 40-60 words, else the longest under 60. */
function fit(candidates) {
  // 58, not 60: answer_shape_contract.js counts a few tokens more than this does.
  const ok = candidates.filter(Boolean).find((c) => { const w = words(c); return w >= 42 && w <= 58; });
  if (ok) return ok;
  return candidates.filter(Boolean).filter((c) => words(c) <= 58).sort((a, b) => words(b) - words(a))[0] || '';
}

function cityName(city) { return String((city && (city.city || city.marketLabel)) || '').split(',')[0].trim(); }
function stateName(city) {
  const own = String((city && city.stateName) || '').trim();
  if (own) return own;
  const states = readJson('us_states.json') || {};
  return String(states[String((city && city.state) || '').toUpperCase()] || '').trim();
}
const aOrAn = (word) => (/^[aeiou]/i.test(String(word)) ? 'an ' : 'a ') + word;

// ---- personal injury: FARS ----------------------------------------------
function roadsText(list) {
  const r = (list || []).filter((x) => x && x[0] && x[1] > 1).slice(0, 3);
  if (!r.length) return '';
  return r.map(([name, k]) => esc(name.replace(/\s+/g, ' ')) + ' (' + k + ')').join(', ');
}

function pi(city) {
  const fars = readJson('research/pi/fars_city_fatal_crashes.json');
  const e = fars && fars.cities && fars.cities[city.slug];
  if (!e) return null;
  const [y1, y0] = (fars.years || []).map(String);
  const c1 = e.years[y1] && e.years[y1].city; const c0 = y0 && e.years[y0] && e.years[y0].city;
  const k1 = e.years[y1] && e.years[y1].county;
  const st = fars.states && fars.states[e.state] && fars.states[e.state][y1];
  if (!c1) return null;
  const place = cityName(city);
  const county = e.county || '';
  const roads = roadsText(c1.top_trafficways);
  const trend = c0 ? (c1.fatal_crashes === c0.fatal_crashes ? 'the same as' : (c1.fatal_crashes > c0.fatal_crashes ? 'up from ' : 'down from ') + n(c0.fatal_crashes) + ' in') + ' ' + y0 : '';
  // "is": the answer is also the page's definition paragraph (b4 wants "X is ...").
  const lookup = 'the first check on any lawyer is the ' + esc(e.state) + ' attorney licence record';
  let answer;
  if (c1.fatal_crashes > 0) {
    const head = 'In ' + y1 + ' the federal crash census (NHTSA FARS) recorded ' + n(c1.fatal_crashes) + ' fatal ' + plural(c1.fatal_crashes, 'crash', 'crashes') + ' in ' + esc(place) + (trend ? ', ' + trend : '') + ', and ' + n(c1.deaths) + ' ' + plural(c1.deaths, 'person', 'people') + ' died in them.';
    const ped = c1.pedestrian_first_harmful_event ? ' ' + n(c1.pedestrian_first_harmful_event) + ' began with a pedestrian being struck.' : '';
    const cty = k1 ? ' ' + esc(county) + ' as a whole recorded ' + n(k1.fatal_crashes) + '.' : '';
    const tail = ' If you were hurt in a crash here, ' + lookup + '.';
    const tailShort = ' After a crash, ' + lookup + '.';
    answer = fit([head + ped + cty + tail, head + ped + tail, head + cty + tail, head + ped + cty + tailShort, head + tail, head + ped + cty]);
  } else {
    answer = fit(['The federal crash census (NHTSA FARS) coded no fatal crash to ' + esc(place) + ' in ' + y1 + (y0 ? ' or ' + y0 : '') + '; crashes on roads around it are counted for the county or the state, where ' + esc(e.state) + ' recorded ' + n(st ? st.fatal_crashes : 0) + '. This is a count of deaths only; ' + lookup + '.']);
  }
  const row = (label, f) => '<tr><th scope="row">' + label + '</th><td>' + f(c1) + '</td>' + (c0 ? '<td>' + f(c0) + '</td>' : '') + (k1 ? '<td>' + f(k1) + '</td>' : '') + (st ? '<td>' + f(st) + '</td>' : '') + '</tr>';
  const head = '<tr><th scope="col">Measure</th><th scope="col">' + esc(place) + ' ' + y1 + '</th>' + (c0 ? '<th scope="col">' + esc(place) + ' ' + y0 + '</th>' : '') + (k1 ? '<th scope="col">' + esc(county) + ' ' + y1 + '</th>' : '') + (st ? '<th scope="col">' + esc(e.state) + ' ' + y1 + '</th>' : '') + '</tr>';
  const table = '<table class="data-table" data-city-fars-table="true"><caption>Fatal crashes recorded by NHTSA FARS</caption><thead>' + head + '</thead><tbody>' +
    row('Fatal crashes', (x) => n(x.fatal_crashes)) +
    row('People killed', (x) => n(x.deaths)) +
    row('First harmful event: pedestrian struck', (x) => n(x.pedestrian_first_harmful_event)) +
    row('First harmful event: cyclist struck', (x) => n(x.pedalcyclist_first_harmful_event)) +
    row('In the dark', (x) => n(x.in_dark_conditions)) +
    row('On a Saturday or Sunday', (x) => n(x.on_weekends)) +
    '</tbody></table>';
  const roadLine = roads ? '<p data-city-fars-roads="true">Roads with the most fatal crashes in ' + esc(place) + ' in ' + y1 + ': ' + roads + '.</p>' : '';
  const month = c1.top_month && c1.top_month[1] > 1 ? '<p>The worst month in ' + y1 + ' was ' + esc(c1.top_month[0]) + ', with ' + n(c1.top_month[1]) + ' fatal crashes.</p>' : '';
  const html = '<section class="section" data-city-local-facts="pi">' +
    '<h2>How many fatal crashes happen in ' + esc(place) + '?</h2>' +
    table + roadLine + month +
    '<p class="muted" data-city-local-source="true">Source: <a href="' + FARS_URL + '" rel="nofollow noopener">NHTSA FARS</a>, ' + y1 + (y0 ? ' and ' + y0 : '') + '. Fatal crashes only' + (county ? '; ' + esc(county) + ' includes the roads around ' + esc(place) : '') + '.</p>' +
    '</section>';
  const faq = [];
  if (c1.fatal_crashes > 0) {
    faq.push({ q: 'How many people died in crashes in ' + place + ' in ' + y1 + '?', a: n(c1.deaths) + ' people died in ' + n(c1.fatal_crashes) + ' fatal crashes that NHTSA FARS coded to ' + place + ' in ' + y1 + (c0 ? ', against ' + n(c0.deaths) + ' in ' + y0 : '') + '.' });
    if (roads) faq.push({ q: 'Which roads in ' + place + ' had the most fatal crashes in ' + y1 + '?', a: 'In NHTSA FARS for ' + y1 + ': ' + roads.replace(/&amp;/g, '&') + '.' });
    if (c1.pedestrian_first_harmful_event) faq.push({ q: 'How many fatal crashes in ' + place + ' involved a pedestrian?', a: 'In ' + y1 + ', ' + n(c1.pedestrian_first_harmful_event) + ' of the ' + n(c1.fatal_crashes) + ' fatal crashes in ' + place + ' began with a pedestrian being struck, and ' + n(c1.pedalcyclist_first_harmful_event) + ' with a cyclist (NHTSA FARS).' });
  }
  if (k1) faq.push({ q: 'How many fatal crashes did ' + county + ' record in ' + y1 + '?', a: county + ' recorded ' + n(k1.fatal_crashes) + ' fatal crashes and ' + n(k1.deaths) + ' deaths in ' + y1 + ' (NHTSA FARS), which includes the roads around ' + place + '.' });
  return { answer, html, faq };
}

// ---- personal injury: a state's own FARS figures ------------------------
// /states/<ST>/next-steps/ was the shared callback form under two sentences
// that changed only the state's name, so any two of the 50 were 0.82-0.87
// alike (Search Readiness q1, 10 Nov 2026: SD, NJ, HI, MT). Each state's FARS
// census and its own attorney-discipline lookup are what only it can say.
function ordinal(k) { const m = k % 100; return k + ((m >= 11 && m <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[k % 10] || 'th')); }

function piState(abbr, sname, builtSlugs) {
  const fars = readJson('research/pi/fars_city_fatal_crashes.json');
  const e = fars && fars.states && fars.states[sname];
  const [y1, y0] = ((fars && fars.years) || []).map(String);
  const s1 = e && e[y1]; const s0 = e && y0 && e[y0];
  if (!s1) return null;
  const disc = readJson('pi_state_disciplinary_links.json') || {};
  const lookupUrl = /^https?:\/\//.test(String(disc[String(abbr).toUpperCase()] || '')) ? String(disc[String(abbr).toUpperCase()]) : '';
  const st = esc(sname);
  const trend = s0 ? (s1.fatal_crashes === s0.fatal_crashes ? 'the same as' : (s1.fatal_crashes > s0.fatal_crashes ? 'up from ' : 'down from ') + n(s0.fatal_crashes) + ' in') + ' ' + y0 : '';
  const roads = roadsText(s1.top_trafficways);
  const head = 'In ' + y1 + ' the federal crash census (NHTSA FARS) recorded ' + n(s1.fatal_crashes) + ' fatal ' + plural(s1.fatal_crashes, 'crash', 'crashes') + ' in ' + st + (trend ? ', ' + trend : '') + ', and ' + n(s1.deaths) + ' ' + plural(s1.deaths, 'person', 'people') + ' died.';
  const ped = s1.pedestrian_first_harmful_event ? ' ' + n(s1.pedestrian_first_harmful_event) + ' began with a pedestrian being struck.' : '';
  const dark = s1.in_dark_conditions ? ' ' + n(s1.in_dark_conditions) + ' happened in the dark.' : '';
  const tail = ' If you were hurt in a crash, the first check on any lawyer is the ' + st + ' attorney licence record.';
  const answer = fit([head + ped + dark + tail, head + ped + tail, head + dark + tail, head + tail, head + ped + dark]);
  const row = (label, f) => '<tr><th scope="row">' + label + '</th><td>' + f(s1) + '</td>' + (s0 ? '<td>' + f(s0) + '</td>' : '') + '</tr>';
  const table = '<table class="data-table" data-state-fars-table="true"><caption>Fatal crashes in ' + st + ' recorded by NHTSA FARS</caption><thead><tr><th scope="col">Measure</th><th scope="col">' + y1 + '</th>' + (s0 ? '<th scope="col">' + y0 + '</th>' : '') + '</tr></thead><tbody>' +
    row('Fatal crashes', (x) => n(x.fatal_crashes)) +
    row('People killed', (x) => n(x.deaths)) +
    row('First harmful event: pedestrian struck', (x) => n(x.pedestrian_first_harmful_event)) +
    row('First harmful event: cyclist struck', (x) => n(x.pedalcyclist_first_harmful_event)) +
    row('In the dark', (x) => n(x.in_dark_conditions)) +
    row('On a Saturday or Sunday', (x) => n(x.on_weekends)) +
    '</tbody></table>';
  const month = s1.top_month && s1.top_month[1] > 1 ? esc(s1.top_month[0]) + ', with ' + n(s1.top_month[1]) + ' fatal crashes' : '';
  const roads0 = s0 ? roadsText(s0.top_trafficways) : '';
  const month0 = s0 && s0.top_month && s0.top_month[1] > 1 ? esc(s0.top_month[0]) + ' (' + n(s0.top_month[1]) + ')' : '';
  const ranked = Object.entries(fars.states).filter(([, v]) => v && v[y1]).map(([k, v]) => [k, v[y1].fatal_crashes]).sort((a, b) => b[1] - a[1]);
  const pos = ranked.findIndex(([k]) => k === sname);
  const share = s1.fatal_crashes ? Math.round((100 * (s1.pedestrian_first_harmful_event || 0)) / s1.fatal_crashes) : 0;
  // The covered cities in this state, each with its own FARS count.
  const cityRows = Object.entries((fars && fars.cities) || {})
    // Only cities the pack actually publishes: a folded city 301s elsewhere.
    .filter(([slug, c]) => c && c.state === sname && c.years && c.years[y1] && c.years[y1].city && (!builtSlugs || builtSlugs.has(slug)))
    .sort((a, b) => String(a[1].city).localeCompare(String(b[1].city)))
    .map(([slug, c]) => '<li><a href="/' + esc(slug) + '/">' + esc(c.city) + '</a>: ' + n(c.years[y1].city.fatal_crashes) + ' fatal ' + plural(c.years[y1].city.fatal_crashes, 'crash', 'crashes') + (c.county && c.years[y1].county ? ', ' + esc(c.county) + ' ' + n(c.years[y1].county.fatal_crashes) : '') + '</li>');
  const cityList = cityRows.length ? '<ul class="neutral-list" data-state-fars-cities="true">' + cityRows.join('') + '</ul>' : '';
  // A <div>, not a <section>: it sits inside the next-steps page shell, and a
  // nested </section> ended the shell early for the section passes after it.
  const html = '<div class="card" data-state-local-facts="pi">' +
    '<h2>How many fatal crashes happen in ' + st + '?</h2>' + table +
    (roads ? '<p data-state-fars-roads="true">' + st + ' roads with the most fatal crashes in ' + y1 + ': ' + roads + (month ? '; peak month ' + month : '') + '.</p>' : '') +
    (pos >= 0 ? '<p data-state-fars-rank="true">' + st + ' ranked ' + ordinal(pos + 1) + ' of ' + ranked.length + ' for fatal crashes in ' + y1 + (share ? ', ' + share + '% of them pedestrian' : '') + '.</p>' : '') +
    (roads0 || month0 ? '<p data-state-fars-prior="true">' + y0 + ': ' + [roads0, month0 ? 'peak month ' + month0 : ''].filter(Boolean).join('; ') + '.</p>' : '') +
    cityList +
    (lookupUrl ? '<p>Before you sign with a firm, look the lawyer up in the ' + st + ' <a href="' + esc(lookupUrl) + '" rel="nofollow noopener">attorney licence and discipline records</a>.</p>' : '') +
    '<p class="muted" data-state-local-source="true">Source: <a href="' + FARS_URL + '" rel="nofollow noopener">NHTSA FARS</a>, ' + y1 + (y0 ? ' and ' + y0 : '') + '. Fatal crashes only; counts, not rates.</p>' +
    '</div>';
  // The next-steps answer's own clause: what differs about this state's roads.
  // The state's own words carry the answer, so it needs only the shortest
  // shared tail (composeNextStepsAnswer picks the shortest that fits 40-60).
  const un = (t) => String(t).replace(/&amp;/g, '&');
  const lead = roads ? 'the roads with the most fatal crashes in ' + y1 + ' were ' + un(roads) + (month ? ', and the worst month was ' + un(month) : '') + (roads0 ? '; in ' + y0 + ' they were ' + un(roads0) : '') : (month ? 'the worst month for fatal crashes in ' + y1 + ' was ' + un(month) : '');
  return { answer, html, lead };
}

// ---- Medicare figures: TRT and neuro ------------------------------------
const CMS_SETS = {
  trt: {
    file: 'research/costs/cms_provider_city_trt_2024.json',
    lead: '84403',
    codes: [['84403', 'Total testosterone lab test (84403)'], ['11980', 'Hormone pellet placement (11980)'], ['J1071', 'Testosterone cypionate injection (J1071)']],
    service: 'total testosterone testing',
    ask: 'Ask any clinic near {place} which labs its monthly fee includes and which arrive as a separate bill.',
  },
  neuro: {
    file: 'research/costs/cms_provider_city_neuro_2024.json',
    lead: '96132',
    codes: [['96132', 'Neuropsychological evaluation, first hour (96132)'], ['96133', 'Each additional hour (96133)'], ['96136', 'Test administration, first 30 minutes (96136)']],
    service: 'a neuropsychological evaluation',
    ask: 'Ask any practice near {place} for an hours estimate, because an evaluation is billed by the hour.',
  },
};

function cms(vk, city) {
  const set = CMS_SETS[vk];
  if (!set) return null;
  const prov = readJson(set.file);
  const geo = readJson('research/costs/cms_geography_service_2024.json');
  const place = cityName(city);
  const sname = stateName(city);
  const key = place.toUpperCase() + '|' + String(city.state || '').toUpperCase();
  const cc = (prov && prov.cities && prov.cities[key] && prov.cities[key].codes) || {};
  const geoState = (code) => geo && geo.codes && geo.codes[code] && geo.codes[code].states && geo.codes[code].states[sname] && geo.codes[code].states[sname].O;
  const geoNat = (code) => geo && geo.codes && geo.codes[code] && geo.codes[code].national && geo.codes[code].national.O;
  const lead = set.lead;
  const sLead = geoState(lead); const nLead = geoNat(lead); const cLead = cc[lead];
  if (!sLead && !cLead) return null;
  const ask = set.ask.split('{place}').join(esc(place));
  const cityClause = cLead
    ? n(cLead.rendering_providers) + ' of those billing from ' + aOrAn(esc(place)) + ' practice address are in CMS’s published rows, at a service-weighted ' + usd(cLead.avg_submitted_charge_service_weighted)
    : 'no clinician with ' + aOrAn(esc(place)) + ' practice address appears in CMS’s published rows for the code';
  const stateClause = sLead ? 'In 2024, ' + n(sLead.rendering_providers) + ' clinicians in ' + esc(sname) + ' billed Medicare for ' + set.service + ' at an average ' + usd(sLead.avg_submitted_charge) + ', and Medicare allowed ' + usd(sLead.avg_medicare_allowed) : '';
  const answer = fit([
    stateClause ? stateClause + '; ' + cityClause + '. These are Medicare figures, not a cash-pay quote. ' + ask : '',
    stateClause ? stateClause + '; ' + cityClause + '. ' + ask : '',
    stateClause ? stateClause + '; ' + cityClause + '. These are Medicare figures, not a quote.' : '',
    cLead ? 'In 2024, ' + cityClause + ' (CMS, Medicare). ' + ask + ' These are Medicare figures, not a cash-pay quote.' : '',
  ]);
  const rows = set.codes.map(([code, label]) => {
    const c = cc[code]; const s = geoState(code); const nat = geoNat(code);
    if (!c && !s) return '';
    return '<tr><th scope="row">' + esc(label) + '</th>' +
      '<td>' + (c ? n(c.rendering_providers) + ' clinicians, ' + n(c.beneficiaries) + ' patients' + (c.avg_submitted_charge_service_weighted ? ', ' + usd(c.avg_submitted_charge_service_weighted) + ' billed' : '') : 'none published') + '</td>' +
      '<td>' + (s ? n(s.rendering_providers) + ' clinicians, ' + usd(s.avg_submitted_charge) + ' billed, ' + usd(s.avg_medicare_allowed) + ' allowed' : 'none published') + '</td>' +
      '<td>' + (nat ? usd(nat.avg_submitted_charge) + ' billed' : '') + '</td></tr>';
  }).join('');
  if (!rows) return null;
  const topType = cLead && cLead.provider_types ? Object.entries(cLead.provider_types).sort((a, b) => b[1] - a[1])[0] : null;
  const html = '<section class="section" data-city-local-facts="' + esc(vk) + '">' +
    '<h2>What did clinicians in ' + esc(place) + ' bill Medicare in 2024?</h2>' +
    '<table class="data-table" data-city-cms-table="true"><caption>Medicare, calendar year 2024</caption><thead><tr><th scope="col">Service</th><th scope="col">' + esc(place) + ' practice addresses</th><th scope="col">' + esc(sname) + '</th><th scope="col">National</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (topType ? '<p>The largest group billing ' + esc(lead) + ' from ' + esc(place) + ' addresses was ' + esc(topType[0]) + ' (' + n(topType[1]) + ' of ' + n(cLead.rendering_providers) + ').</p>' : '') +
    '<p class="muted" data-city-local-source="true">Source: CMS Medicare data, 2024, <a href="' + CMS_PROVIDER_URL + '" rel="nofollow noopener">by provider</a> and <a href="' + CMS_GEO_URL + '" rel="nofollow noopener">by state</a>; Medicare patients only.</p>' +
    '</section>';
  const faq = [];
  // The state question only where the city has no figures of its own: two
  // cities of one state asking it is the same Q&A twice.
  if (sLead && !cLead) faq.push({ q: 'How many clinicians in ' + sname + ' billed Medicare for ' + set.service + ' in 2024?', a: n(sLead.rendering_providers) + ' clinicians, at an average billed charge of ' + usd(sLead.avg_submitted_charge) + (nLead ? ' against ' + usd(nLead.avg_submitted_charge) + ' nationally' : '') + ' (CMS, 2024).' });
  if (cLead) faq.push({ q: 'How many ' + place + ' practices billed Medicare for ' + set.service + ' in 2024?', a: n(cLead.rendering_providers) + ' clinicians with ' + aOrAn(place) + ' practice address, for ' + n(cLead.beneficiaries) + ' patients (CMS, 2024). A practice address is not catchment, so the metro has more.' });
  else faq.push({ q: 'Do any ' + place + ' practices appear in the Medicare data for ' + set.service + '?', a: 'Not in the 2024 published rows: CMS leaves out clinicians with fewer than 11 Medicare patients for a code, and cash-pay clinics do not bill Medicare at all.' });
  // Neuro research files already carry the city / state / national table
  // (cost_comparison_table); a second table of the same figures adds nothing.
  return { answer, html: vk === 'neuro' ? '' : html, faq };
}

// ---- dentistry: a state's dental shortage designations (HRSA) -----------
// The 17 dentistry state hubs were one comparison paragraph with the state's
// name swapped in (Search Readiness q1, 10 Nov 2026: AZ/OH 0.74 alike), and most
// have no researched city. HRSA's dental HPSA designations are the public,
// state-level fact about how hard a dentist is to reach there
// (data/research/dentistry/hrsa_dental_hpsa_by_state.json,
//  scripts/research/pull_hrsa_dental_hpsa.py). No dollar figures: see
// data/research/dentistry/coverage_and_plan_mechanics_sources_2026-08-27.json.
const HRSA_URL = 'https://data.hrsa.gov/data/download';
const HRSA_FIND_URL = 'https://data.hrsa.gov/tools/shortage-area/hpsa-find';
function dentistryState(ab, sname, cities) {
  const doc = readJson('research/dentistry/hrsa_dental_hpsa_by_state.json');
  const h = doc && doc.states && doc.states[ab];
  if (!h || !h.designations) return null;
  const st = esc(sname);
  const people = h.people_covered >= 1e6 ? (h.people_covered / 1e6).toFixed(1) + ' million' : n(Math.round(h.people_covered / 1000) * 1000);
  const dentists = n(Math.round(h.dentists_needed));
  const kinds = n(h.geographic) + ' whole ' + plural(h.geographic, 'area', 'areas') + ', ' + n(h.population_groups) + ' population ' + plural(h.population_groups, 'group', 'groups') + ' (mostly low-income residents)' + ' and ' + n(h.facilities) + ' ' + plural(h.facilities, 'clinic or facility', 'clinics or facilities');
  const head = 'HRSA lists ' + n(h.designations) + ' dental shortage designations in ' + st + ': ' + kinds + '.';
  const ppl = ' About ' + people + ' people live in the areas and groups they cover, and ' + dentists + ' more full-time dentists are needed to lift them.';
  const tail = ' A shortage designation is a federal finding, not a closed door.';
  const answer = fit([head + ppl + tail, head + ppl, 'HRSA lists ' + n(h.designations) + ' dental shortage designations in ' + st + '.' + ppl + tail]);
  const top = (h.top_counties || []).map((c) => esc(String(c.county).replace(/, [A-Z]{2}$/, '')) + ' (' + c.max_score + ')');
  const des = (h.top_designations || []).filter((d) => d && d.name);
  const cityRows = (cities || []).map((c) => {
    const cc = readJson('city_content/dentistry/' + c.slug + '.json');
    const sna = cc && cc.safety_net_access;
    const k = sna ? ['free_low_cost', 'dental_school'].reduce((t, key) => t + (Array.isArray(sna[key]) ? sna[key].length : 0), 0) : 0;
    return k ? '<li><a href="/' + esc(c.slug) + '/">' + esc(c.marketLabel || c.slug) + '</a>: ' + n(k) + ' free, low-cost or dental-school ' + plural(k, 'clinic', 'clinics') + ' researched from their own pages</li>' : '';
  }).filter(Boolean).join('');
  const html = '<section class="section" data-state-local-facts="dentistry">' +
    '<h2>Where is ' + st + ' short of dentists?</h2>' +
    '<table class="data-table" data-state-hpsa-table="true"><caption>Dental shortage designations in ' + st + ', HRSA</caption><tbody>' +
    '<tr><th scope="row">Designations in force</th><td>' + n(h.designations) + '</td></tr>' +
    '<tr><th scope="row">Whole areas</th><td>' + n(h.geographic) + '</td></tr>' +
    '<tr><th scope="row">Population groups</th><td>' + n(h.population_groups) + '</td></tr>' +
    '<tr><th scope="row">Clinics and facilities</th><td>' + n(h.facilities) + '</td></tr>' +
    '<tr><th scope="row">Rural or partly rural</th><td>' + n(h.rural_or_partly_rural) + '</td></tr>' +
    '<tr><th scope="row">Counties touched</th><td>' + n(h.counties_with_designation) + '</td></tr>' +
    '<tr><th scope="row">Dentists needed</th><td>' + dentists + '</td></tr>' +
    '</tbody></table>' +
    (top.length ? '<p data-state-hpsa-counties="true">' + st + ' counties with the highest dental shortage scores (0-26, higher is worse): ' + top.join(', ') + '.</p>' : '') +
    (des.length ? '<p>Highest-scored ' + st + ' designations:</p><ol data-state-hpsa-designations="true">' + des.map((d) => '<li>' + esc(String(d.name).replace(/^LI-/, 'Low-income residents, ').replace(/^MSFW-/, 'Farmworkers, ')) + (d.county ? ', ' + esc(d.county) : '') + ' (' + d.score + ')</li>').join('') + '</ol>' : '') +
    (cityRows ? '<ul class="neutral-list" data-state-hpsa-cities="true">' + cityRows + '</ul>' : '') +
    '<p>Check your own address in <a href="' + HRSA_FIND_URL + '" rel="nofollow noopener">HRSA\u2019s HPSA Find</a>.</p>' +
    '<p class="muted" data-state-local-source="true">Source: <a href="' + HRSA_URL + '" rel="nofollow noopener">HRSA Data Warehouse, HPSA - Dental Health</a>' + (doc.source && doc.source.fetched_on ? ', read ' + esc(doc.source.fetched_on) : '') + '. Designated status only.</p>' +
    '</section>';
  return { answer, html };
}

// ---- state hubs ---------------------------------------------------------
// A state page's own facts: the state's Medicare figures (trt, neuro), the
// USCIS field office each covered city's ZIP codes go to (uscis), and one row per
// covered city. The comparison advice every state page printed is on the guides
// (Search Readiness q1, 7 Nov 2026: /states/VA/ and /states/WV/ were 0.83 alike).
function forState(verticalKey, abbr, sname, cities) {
  const vk = String(verticalKey || '').toLowerCase();
  const ab = String(abbr || '').toUpperCase();
  const list = (cities || []).slice().sort((a, b) => String(a.marketLabel || a.slug).localeCompare(String(b.marketLabel || b.slug)));
  if (vk === 'trt' || vk === 'neuro') {
    const set = CMS_SETS[vk];
    const geo = readJson('research/costs/cms_geography_service_2024.json');
    const prov = readJson(set.file);
    const st = (code) => geo && geo.codes && geo.codes[code] && geo.codes[code].states && geo.codes[code].states[sname] && geo.codes[code].states[sname].O;
    const nat = (code) => geo && geo.codes && geo.codes[code] && geo.codes[code].national && geo.codes[code].national.O;
    const lead = st(set.lead); const nl = nat(set.lead);
    if (!lead) return null;
    const rank = (() => {
      const all = Object.entries((geo.codes[set.lead] && geo.codes[set.lead].states) || {}).filter(([, v]) => v && v.O).map(([k, v]) => [k, v.O.rendering_providers]).sort((x, y) => y[1] - x[1]);
      const i = all.findIndex(([k]) => k === sname);
      return i >= 0 ? { pos: i + 1, of: all.length } : null;
    })();
    const answer = fit([
      'In 2024, ' + n(lead.rendering_providers) + ' clinicians in ' + esc(sname) + ' billed Medicare for ' + set.service + (rank ? ', number ' + rank.pos + ' of the ' + rank.of + ' states and territories CMS published,' : '') + ' at an average ' + usd(lead.avg_submitted_charge) + ' billed' + (nl ? ' against ' + usd(nl.avg_submitted_charge) + ' nationally' : '') + ', and Medicare allowed ' + usd(lead.avg_medicare_allowed) + '. These are Medicare figures, not a cash-pay quote; the city pages below carry each city\u2019s own.',
      'In 2024, ' + n(lead.rendering_providers) + ' clinicians in ' + esc(sname) + ' billed Medicare for ' + set.service + ' at an average ' + usd(lead.avg_submitted_charge) + ' billed, and Medicare allowed ' + usd(lead.avg_medicare_allowed) + '. These are Medicare figures, not a cash-pay quote; the city pages below carry each city\u2019s own.',
    ]);
    const rows = set.codes.map(([code, label]) => { const x = st(code); const y = nat(code); return x ? '<tr><th scope="row">' + esc(label) + '</th><td>' + n(x.rendering_providers) + '</td><td>' + usd(x.avg_submitted_charge) + '</td><td>' + usd(x.avg_medicare_allowed) + '</td><td>' + (y ? usd(y.avg_submitted_charge) : '') + '</td></tr>' : ''; }).join('');
    const cityRows = list.map((c) => {
      const cc = prov && prov.cities && prov.cities[cityName(c).toUpperCase() + '|' + ab];
      const x = cc && cc.codes && cc.codes[set.lead];
      return '<li><a href="/' + esc(c.slug) + '/">' + esc(c.marketLabel || c.slug) + '</a>: ' + (x ? n(x.rendering_providers) + ' clinicians billing ' + set.lead + ' from city practice addresses' : 'none in the published ' + set.lead + ' rows') + '</li>';
    }).join('');
    const html = '<section class="section" data-state-local-facts="' + esc(vk) + '"><h2>What did ' + esc(sname) + ' clinicians bill Medicare in 2024?</h2>' +
      (rows ? '<table class="data-table"><thead><tr><th scope="col">Service</th><th scope="col">Clinicians</th><th scope="col">Average billed</th><th scope="col">Medicare allowed</th><th scope="col">National billed</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      (cityRows ? '<ul class="neutral-list">' + cityRows + '</ul>' : '') +
      '<p class="muted">Source: CMS Medicare data, 2024, <a href="' + CMS_GEO_URL + '" rel="nofollow noopener">by state</a> and <a href="' + CMS_PROVIDER_URL + '" rel="nofollow noopener">by provider</a>; Medicare patients only.</p></section>';
    return { answer, html };
  }
  if (vk === 'dentistry') return dentistryState(ab, sname, list);
  if (vk.includes('uscis')) {
    const fo = readJson('research/uscis_medical/field_office_assignments.json');
    const rows = list.map((c) => {
      const r = fo && fo.cities && fo.cities[c.slug];
      const o = r && r.field_offices && r.field_offices[0];
      return o ? { c, o } : null;
    }).filter(Boolean);
    if (!rows.length) return null;
    const offices = [...new Set(rows.map((x) => x.o.office_name))];
    const answer = fit([
      'In ' + esc(sname) + ', green card interviews for the ZIP codes of the cities we cover are held at the ' + offices.slice(0, 2).map(esc).join(' and ') + ' Field Office' + (offices.length > 1 ? 's' : '') + ', and the civil surgeon who completes Form I-693 is a doctor USCIS designates; confirm one in the USCIS locator before you book, and ask what the quoted fee covers.',
      'In ' + esc(sname) + ', green card interviews for the ZIP codes we cover are held at the ' + esc(offices[0]) + ' Field Office. A civil surgeon is a doctor USCIS designates to complete Form I-693; confirm one in the USCIS locator before you book.',
    ]);
    const html = '<section class="section" data-state-local-facts="uscis"><h2>Which USCIS field office serves each ' + esc(sname) + ' city?</h2><ul class="neutral-list">' +
      rows.map(({ c, o }) => '<li><a href="/' + esc(c.slug) + '/">' + esc(c.marketLabel || c.slug) + '</a>: ' + esc(o.office_name) + ' Field Office, ' + esc(o.street) + ', ' + esc(o.office_city) + ', ' + esc(o.office_state) + ' ' + esc(o.office_zip) + '</li>').join('') +
      '</ul><p class="muted">Source: USCIS ZIP code assignment file' + (fo.source && fo.source.file_vintage ? ' (' + esc(fo.source.file_vintage) + ')' : '') + '. Your own notice names your office.</p></section>';
    return { answer, html };
  }
  return null;
}

function forCity(verticalKey, city) {
  const vk = String(verticalKey || '').toLowerCase();
  if (!city || !city.slug) return null;
  if (vk === 'pi' || vk === 'personal_injury' || vk === 'personal-injury') return pi(city);
  if (vk === 'trt' || vk === 'neuro') return cms(vk, city);
  return null;
}

module.exports = { forCity, forState, piState, fit, words, CMS_PROVIDER_URL, CMS_GEO_URL };
