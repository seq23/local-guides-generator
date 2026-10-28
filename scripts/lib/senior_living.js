'use strict';
/**
 * The senior-living vertical (memphisseniorcarehomes.com).
 *
 * Everything this pack renders that the other five packs do not lives here, so
 * build_city_sites.js only asks "is this senior-living?" and calls in:
 *  - the licensed-facility directory (data/listings/senior-living/facilities.json,
 *    from the Tennessee Health Facilities Commission registry), shown on every
 *    city and hospital-proximity page, nearest first;
 *  - the intake embed slot the lead backend mounts into (assets/senior-intake.js
 *    and functions/api/senior-* belong to the backend, never to this file);
 *  - the referral disclosure in the footer (this site is paid by communities, so
 *    the shared "not a referral service" line would be false here);
 *  - the /for-providers/ offer for this site.
 *
 * The vertical's public id is `senior-living` (data/contracts/velocity_vertical_aliases.json);
 * the page-set file name gives the internal pack key `senior_living`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PACK_KEY = 'senior_living';
const PUBLIC_ID = 'senior-living';
const FACILITIES_PATH = path.join(ROOT, 'data', 'listings', 'senior-living', 'facilities.json');
const SEAT_SOURCE = path.join(ROOT, 'data', 'senior_seat.json');
const HOME_CITY_SLUG = 'memphis-tn';
const HOME_ZIP = '38104';
const DISCLOSURE = 'Our guide is free to families. Senior living communities pay us a referral fee or a flat fee when they accept a family we introduce, and some buy sponsored placements.';

function isSeniorLiving(verticalKey) {
  const v = String(verticalKey || '').trim().toLowerCase();
  return v === PACK_KEY || v === PUBLIC_ID;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let facilitiesCache = null;
function loadFacilities() {
  if (facilitiesCache) return facilitiesCache;
  const doc = JSON.parse(fs.readFileSync(FACILITIES_PATH, 'utf8'));
  facilitiesCache = doc;
  return doc;
}

function milesBetween(aLat, aLng, bLat, bLng) {
  if ([aLat, aLng, bLat, bLng].some((x) => typeof x !== 'number' || !isFinite(x))) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// The communities shown on one page: every licensed community in the page's own
// city first (a city page that hid one of its own communities would be a wrong
// directory), then the nearest others until the page shows at least MIN.
// A memory care page (kind care_type, care_type memory_care) lists only the
// communities the state records as having a secured unit; an assisted living
// page lists every licensed community, since each one holds an assisted living
// licence. A Memphis neighbourhood has no licensed city of its own, so its "own"
// communities are the ones within NEIGHBORHOOD_MILES of its centre.
const MIN_ROWS = 10;
const NEIGHBORHOOD_MILES = 4;
function facilitiesForPage(city) {
  let all = loadFacilities().facilities || [];
  if (city.kind === 'care_type' && city.care_type === 'memory_care') all = all.filter((f) => f.memory_care);
  const withDist = all.map((f) => ({ ...f, miles: milesBetween(city.lat, city.lng, f.lat, f.lng) }));
  withDist.sort((a, b) => (a.miles == null ? 1e9 : a.miles) - (b.miles == null ? 1e9 : b.miles));
  if (city.kind === 'hospital') return withDist.slice(0, MIN_ROWS);
  const own = String(city.licensed_city || city.city || '').toLowerCase();
  const inCity = city.neighborhood_of
    ? withDist.filter((f) => f.miles != null && f.miles <= NEIGHBORHOOD_MILES)
    : withDist.filter((f) => String(f.city || '').toLowerCase() === own);
  const rest = withDist.filter((f) => !inCity.includes(f));
  return inCity.concat(rest.slice(0, Math.max(0, MIN_ROWS - inCity.length)));
}

function intakeSlotHtml(citySlug, zip) {
  return '<div id="senior-intake" data-vertical="senior-living" data-city="' + esc(citySlug) + '" data-zip="' + esc(zip) + '"></div><script src="/assets/senior-intake.js" defer></script>';
}

function intakeSlotForCity(city) {
  return intakeSlotHtml(city.slug, city.primary_zip);
}

function intakeSlotForSite() {
  return intakeSlotHtml(HOME_CITY_SLUG, HOME_ZIP);
}

function titleCaseName(n) {
  const s = String(n || '');
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

function isMemoryCarePage(city) { return city.kind === 'care_type' && city.care_type === 'memory_care'; }
function isAssistedLivingPage(city) { return city.kind === 'care_type' && city.care_type === 'assisted_living'; }
// What a page covers, in running text ("memory care", "assisted living", or both).
function topicFor(city) {
  if (isMemoryCarePage(city)) return 'memory care';
  if (isAssistedLivingPage(city)) return 'assisted living';
  return 'assisted living and memory care';
}
function stateName(st) { return st === 'MS' ? 'Mississippi' : (st === 'AR' ? 'Arkansas' : 'Tennessee'); }
function aAn(word) { return (/^[aeiou]/i.test(String(word || '')) ? 'an ' : 'a ') + word; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
function sumBeds(list, key) { return list.reduce((a, f) => a + (typeof f[key] === 'number' ? f[key] : 0), 0); }

function h1For(city) {
  if (city.kind === 'hospital') return 'Assisted living and memory care near ' + esc(city.hospital_name);
  if (city.kind === 'care_type') return (isMemoryCarePage(city) ? 'Memory care in ' : 'Assisted living in ') + esc(city.marketLabel);
  return 'Assisted living and memory care in ' + esc(city.marketLabel);
}

function cityIntroHtml(city) {
  const list = facilitiesForPage(city);
  const mc = list.filter((f) => f.memory_care).length;
  const def = '<p class="site-definition" data-site-definition="true" data-senior-definition="true">' +
    'Assisted living is a licensed residence that helps with bathing, dressing, meals and medications while your parent keeps their own apartment. ' +
    'Memory care is a secured unit with staff trained in dementia. A care home is the everyday name for either one; Tennessee licenses both as Assisted Care Living Facilities and Mississippi as Personal Care Homes.' +
    '</p>';
  if (city.kind === 'hospital') {
    return '<section class="section senior-city-intro" data-senior-city-intro="hospital">' + def +
      '<p>If your parent is being discharged from <strong>' + esc(city.hospital_name) + '</strong> (' + esc(city.hospital_address) + ') and cannot safely go home, these are the ' + list.length + ' licensed assisted living communities closest to the hospital, ' + mc + ' of them with secured memory care beds. ' +
      'Ask the hospital case manager or discharge planner for the discharge summary, medication list and physician orders now: every community below will ask for them before it can assess your parent.</p>' +
      '<p class="muted">Read <a href="/guides/hospital-discharge-to-assisted-living-memphis/">From hospital to assisted living</a> for the timeline and what to have ready in 72 hours.</p>' +
      '</section>';
  }
  if (city.kind === 'care_type') return '<section class="section senior-city-intro" data-senior-city-intro="' + esc(city.care_type) + '">' + def + careTypeLeadHtml(city, list) + '</section>';
  if (city.neighborhood_of) {
    const near = list.filter((f) => f.miles != null && f.miles <= NEIGHBORHOOD_MILES);
    const first = list[0];
    const lead = near.length
      ? esc(city.city) + ' is a Memphis neighbourhood, so the state registry files its communities under Memphis. ' + plural(near.length, 'licensed assisted living community lies', 'licensed assisted living communities lie') + ' within ' + NEIGHBORHOOD_MILES + ' miles of the centre of ' + esc(city.city) + ' (ZIP ' + esc(city.primary_zip) + '); below ' + (near.length === 1 ? 'it is' : 'they are') + ' listed first, then the nearest others, ' + mc + ' of the ' + list.length + ' with memory care.'
      : 'No licensed assisted living community lies within ' + NEIGHBORHOOD_MILES + ' miles of the centre of ' + esc(city.city) + ' (ZIP ' + esc(city.primary_zip) + '). Below are the ' + list.length + ' licensed communities nearest to it, ' + mc + ' of them with memory care; the closest is ' + esc(titleCaseName(first.name)) + ', ' + first.miles.toFixed(1) + ' miles away in ' + esc(first.city) + '.';
    return '<section class="section senior-city-intro" data-senior-city-intro="neighborhood">' + def + '<p>' + lead + '</p></section>';
  }
  const own = list.filter((f) => String(f.city || '').toLowerCase() === String(city.licensed_city || city.city).toLowerCase()).length;
  const nearest = list[0];
  const lead = city.state === 'AR'
    ? 'Families in ' + esc(city.marketLabel) + ' often look east across the river. This directory lists communities licensed in Tennessee and Mississippi; Arkansas licenses its own separately. Below are the ' + list.length + ' licensed communities nearest to ' + esc(city.city) + ', ' + mc + ' of them with memory care.'
    : (own
      ? esc(city.city) + ' has ' + own + ' licensed assisted living ' + (own === 1 ? 'community' : 'communities') + ' in the ' + (city.state === 'MS' ? 'Mississippi' : 'Tennessee') + ' registry. Below ' + (own === 1 ? 'it is' : 'they are') + ' listed first, then the nearest others, ' + mc + ' of the ' + list.length + ' with memory care.'
      : 'The ' + (city.state === 'MS' ? 'Mississippi' : 'Tennessee') + ' registry lists no assisted living community with ' + aAn(esc(city.city)) + ' address' + (city.county ? ' (' + esc(city.county) + ')' : '') + ', so below are the ' + list.length + ' licensed communities nearest to ' + esc(city.city) + ', ' + mc + ' of them with memory care. The closest is ' + esc(titleCaseName(nearest.name)) + ' in ' + esc(nearest.city) + ', ' + nearest.miles.toFixed(1) + ' miles away; every row shows its distance.');
  return '<section class="section senior-city-intro" data-senior-city-intro="city">' + def + '<p>' + lead + '</p></section>';
}

function telHref(phone) {
  return 'tel:+1' + String(phone || '').replace(/\D/g, '');
}

function directoryHtml(city) {
  const doc = loadFacilities();
  const list = facilitiesForPage(city);
  const rows = list.map((f) => {
    const site = f.website ? '<a href="' + esc(f.website) + '" rel="nofollow noopener" target="_blank">Website</a>' : '<span class="muted">No website listed</span>';
    const dist = f.miles == null ? '' : f.miles.toFixed(1) + ' mi';
    return '<tr data-facility-license="' + esc(f.license_number) + '">' +
      '<td><strong>' + esc(titleCaseName(f.name)) + '</strong><br><span class="muted">' + esc(f.address) + ', ' + esc(f.city) + ', ' + esc(f.state) + ' ' + esc(f.zip) + '</span></td>' +
      '<td><a href="' + telHref(f.phone) + '">' + esc(f.phone) + '</a></td>' +
      '<td>' + (f.memory_care ? (typeof f.secured_beds === 'number' ? 'Yes (' + esc(f.secured_beds) + ' secured beds)' : 'Yes (licensed dementia unit)') : 'No') + '</td>' +
      '<td>' + esc(f.license_type) + '<br><span class="muted">' + (f.license_number_kind === 'registry_key' ? 'Licensed by MSDH' : 'Licence ' + esc(f.license_number)) + '</span></td>' +
      '<td>' + site + '</td>' +
      '<td>' + esc(dist) + '</td>' +
      '</tr>';
  }).join('');
  const fetched = String(doc.fetched_at || '').slice(0, 10);
  const where = city.kind === 'hospital' ? 'near ' + esc(city.hospital_name) : 'near ' + esc(city.marketLabel);
  const scope = isMemoryCarePage(city)
    ? '<p class="muted">Only communities with a secured memory care unit on their licence are listed here; the <a href="/' + esc(city.base_slug) + '/">' + esc(city.marketLabel) + ' page</a> lists every licensed community.</p>'
    : '';
  return '<section class="section senior-directory" id="directory" data-senior-directory="true" data-directory-count="' + list.length + '">' +
    '<h2>Licensed ' + topicFor(city) + ' ' + where + '</h2>' + scope +
    '<p class="muted">Every row is licensed by its state: Tennessee rows are Assisted Care Living Facilities licensed by the Tennessee Health Facilities Commission, Mississippi rows are Personal Care Homes licensed by the Mississippi State Department of Health. Listing is free and is not affected by who pays us. ' +
    'Memory care means the community reports secured beds (Tennessee) or holds a licensed Alzheimer\'s/dementia care unit (Mississippi). Distances are straight-line from ' + (city.kind === 'hospital' ? 'the hospital' : 'the centre of ' + esc(city.city)) + '.</p>' +
    '<div class="table-wrap"><table class="senior-directory-table"><thead><tr><th>Community</th><th>Phone</th><th>Memory care</th><th>Licence</th><th>Website</th><th>Distance</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="muted small">Sources: <a href="' + esc(doc.source && doc.source.registry_index) + '" rel="nofollow noopener" target="_blank">Tennessee Health Facilities Commission licensure reports</a> and the <a href="' + esc(doc.source && doc.source.ms_registry) + '" rel="nofollow noopener" target="_blank">Mississippi State Department of Health facilities directory</a>, fetched ' + esc(fetched) + '. ' +
    'Check a licence and its survey history before you sign anything: <a href="/guides/tennessee-assisted-living-inspection-records/">how to read a Tennessee inspection record</a>.</p>' +
    '<p class="muted small" data-senior-listing-disclosure="true"><strong>How we are paid:</strong> ' + DISCLOSURE + ' Paid or not, every licensed community appears here in distance order.</p>' +
    directoryJsonLd(city, list) +
    '</section>';
}

const SITE_URL = 'https://memphisseniorcarehomes.com';
function mapsUrl(f) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(f.name + ', ' + f.address + ', ' + f.city + ', ' + f.state + ' ' + f.zip);
}

// ItemList of LocalBusiness nodes for exactly the rows the page shows, with only
// facts the visible table carries (name, phone, address, map, licence type,
// memory care). additionalType is plain text, as the checklist asks.
function directoryJsonLd(city, list) {
  const pageUrl = SITE_URL + '/' + city.slug + '/';
  const items = list.map((f, i) => {
    const node = {
      '@type': 'LocalBusiness',
      '@id': pageUrl + '#facility-' + String(f.license_number).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      name: titleCaseName(f.name),
      additionalType: f.memory_care ? 'MemoryCareFacility' : 'AssistedLivingFacility',
      telephone: '+1-' + f.phone,
      address: { '@type': 'PostalAddress', streetAddress: f.address, addressLocality: f.city, addressRegion: f.state, postalCode: f.zip, addressCountry: 'US' },
      hasMap: mapsUrl(f),
      areaServed: city.kind === 'hospital' ? 'Memphis, TN' : city.marketLabel,
      description: f.license_type + (f.memory_care ? ', with memory care' : ''),
    };
    if (typeof f.lat === 'number' && typeof f.lng === 'number') node.geo = { '@type': 'GeoCoordinates', latitude: f.lat, longitude: f.lng };
    if (f.website) node.url = f.website;
    return { '@type': 'ListItem', position: i + 1, item: node };
  });
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', '@id': pageUrl + '#directory', name: 'Licensed ' + topicFor(city) + ' near ' + (city.kind === 'hospital' ? city.hospital_name : city.marketLabel), numberOfItems: items.length, itemListOrder: 'https://schema.org/ItemListOrderAscending', itemListElement: items };
  return '<script type="application/ld+json" data-senior-directory-ld="true">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';
}

const PAGES_PATH = path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_senior_living_v1.json');
let pagesCache = null;
function loadPages() {
  if (!pagesCache) pagesCache = JSON.parse(fs.readFileSync(PAGES_PATH, 'utf8'));
  return pagesCache;
}
function byDistance(city, rows) {
  return rows.map((r) => ({ ...r, miles: milesBetween(city.lat, city.lng, r.lat, r.lng) })).sort((a, b) => a.miles - b.miles);
}
// General hospitals only: the VA (veterans) and Delta Specialty (mental health)
// have pages of their own but are not "the nearest major hospital" for a family.
function nearestHospitals(city, opts) {
  const all = loadPages().filter((c) => c.kind === 'hospital' && c.slug !== city.slug && ((opts && opts.all) || c.general !== false));
  return byDistance(city, all);
}

// The local off-ramps every city page carries: nearest hospital, the decisions
// families face next, and what this area's directory actually contains.
function cityLocalHtml(city) {
  if (city.kind === 'hospital') return hospitalLocalHtml(city) + nearbyHtml(city);
  if (city.kind === 'care_type') return careTypeLocalHtml(city) + nearbyHtml(city);
  return areaLocalHtml(city) + nearbyHtml(city);
}

function areaLocalHtml(city) {
  const list = facilitiesForPage(city);
  const near = list.filter((f) => f.miles != null).slice(0, 3);
  const hosp = nearestHospitals(city)[0];
  const mc = list.filter((f) => f.memory_care);
  const small = list.filter((f) => typeof f.total_beds === 'number' && f.total_beds <= 30);
  const nearestTxt = near.map((f) => esc(titleCaseName(f.name)) + ' (' + f.miles.toFixed(1) + ' miles, ' + esc(f.phone) + ')').join('; ');
  return '<section class="section senior-local" data-senior-local="true" data-decision-routing-block="true">' +
    '<h2>What families near ' + esc(city.city) + ' should know</h2>' +
    '<p><strong>Closest licensed communities:</strong> ' + nearestTxt + '. Distances are straight-line; allow for traffic on ' + esc(city.roads || 'Poplar Avenue, I-240, US-78 and I-55') + ' when you plan regular visits.</p>' +
    '<p><strong>Memory care:</strong> ' + mc.length + ' of the ' + list.length + ' communities listed here report a secured memory care unit to the state' + (mc.length ? ', the nearest being ' + esc(titleCaseName(mc[0].name)) + (mc[0].miles != null ? ' at ' + mc[0].miles.toFixed(1) + ' miles' : '') : '') + '. If your parent wanders or cannot be left alone safely, start with those. <a href="/guides/memory-care-when-is-it-time/">How to tell when it is time</a>.</p>' +
    '<p><strong>Small residences:</strong> ' + (small.length ? small.length + ' of the communities listed are licensed for 30 or fewer residents, which some parents find easier to settle into than a large building.' : 'every community listed here is licensed for more than 30 residents; ask about smaller wings or neighbourhoods inside them if your parent prefers a quieter setting.') + '</p>' +
    (hosp ? '<p><strong>Nearest major hospital with a page here:</strong> ' + esc(hosp.hospital_name) + ', about ' + hosp.miles.toFixed(1) + ' miles away' + (hosp.miles > 15 ? ' (a closer local hospital may serve ' + esc(city.city) + '; this site covers the Memphis-area hospitals)' : '') + '. If your parent is being discharged there, see <a href="/' + hosp.slug + '/">communities near ' + esc(hosp.hospital_name) + '</a> and <a href="/guides/hospital-discharge-to-assisted-living-memphis/">what to have ready in 72 hours</a>.</p>' : '') +
    '<p><strong>Cost:</strong> no public source publishes a reliable ' + esc(city.city) + '-only price. Ask each community for an all-in monthly figure at your parent\'s assessed care level, and read <a href="/guides/assisted-living-cost-memphis/">what the monthly rate includes</a> before you compare quotes. If money may run out, ask whether the community accepts ' + (city.state === 'MS' ? 'Mississippi Medicaid waiver residents' : 'TennCare CHOICES') + ' and read <a href="/guides/when-the-money-runs-out-tenncare-choices/">when the money runs out</a>.</p>' +
    '<p><strong>Before you tour:</strong> use the <a href="/guides/questions-to-ask-on-a-tour/">40 tour questions</a>, check each licence with the state (<a href="/guides/tennessee-assisted-living-inspection-records/">how</a>), and take the residency agreement home to read (<a href="/guides/residency-agreement-fees-and-rules/">what to look for</a>). Short answers are on the <a href="/faq/">FAQ</a>.</p>' +
    '</section>';
}

function hospitalLocalHtml(city) {
  const list = facilitiesForPage(city);
  const mc = list.filter((f) => f.memory_care);
  const nearest = list[0];
  const nearCities = byDistance(city, loadPages().filter((c) => c.kind === 'city')).slice(0, 3);
  return '<section class="section senior-local" data-senior-local="true" data-decision-routing-block="true">' +
    '<h2>Leaving ' + esc(city.hospital_name) + ' for assisted living</h2>' +
    (city.hospital_note ? '<p data-senior-hospital-note="true"><strong>About this hospital:</strong> ' + esc(city.hospital_note) + '</p>' : '') +
    '<p><strong>Who to talk to:</strong> every unit at ' + esc(city.hospital_name) + ' has a case manager or discharge planner. Tell them on the first day that your parent cannot safely go home alone and that you are looking at assisted living, and ask whether your parent is an inpatient or under observation, because only inpatient days count toward Medicare\'s three-day rule for a rehab stay.</p>' +
    '<p><strong>Closest community:</strong> ' + (nearest ? esc(titleCaseName(nearest.name)) + ', ' + nearest.miles.toFixed(1) + ' miles away, ' + esc(nearest.phone) : 'see the directory above') + '. ' +
    (mc.length ? 'The nearest with secured memory care is ' + esc(titleCaseName(mc[0].name)) + ' (' + mc[0].miles.toFixed(1) + ' miles). ' : '') +
    'A community close to the hospital keeps follow-up appointments short in the first weeks, when they are most frequent.</p>' +
    '<p><strong>What every community will ask for:</strong> the discharge summary, a reconciled medication list showing what changed in hospital, physician orders confirming your parent can be cared for in assisted living, and a recent TB screening. Ask the case manager to send these to the communities you choose; with them ready, many communities can assess within a day or two of an opening.</p>' +
    '<p><strong>If rehab comes first:</strong> a skilled nursing stay after the hospital gives you a few weeks to tour. Use the <a href="/guides/questions-to-ask-on-a-tour/">tour questions</a>, check each licence (<a href="/guides/tennessee-assisted-living-inspection-records/">how</a>) and plan the money (<a href="/guides/how-families-pay-for-assisted-living/">how families pay</a>).</p>' +
    '<p><strong>If you would rather be near home:</strong> families often choose a community near where they live rather than near the hospital. The closest city pages are ' + nearCities.map((c) => '<a href="/' + c.slug + '/">' + esc(c.marketLabel) + '</a>').join(', ') + '. Short answers to common questions are on the <a href="/faq/">FAQ</a>.</p>' +
    '</section>';
}

function footerFor(footerHtml) {
  // This site is paid by the communities it introduces families to, so the shared
  // footer's "not ... a referral service" sentence would be untrue here.
  return String(footerHtml)
    .replace('It is not a law firm, medical provider, or referral service.', 'It is not a senior living community or a medical provider.')
    .replace('<div class="footer-meta">', '<p data-senior-disclosure="true"><strong>How we are paid.</strong> ' + DISCLOSURE + '</p>\n    <div class="footer-meta">');
}

function copySeatFile(outDir) {
  // data/senior_seat.json is written by the lead backend. Only whether the
  // exclusive seat is taken, and until when, is public: facility_id and start
  // never leave the repo (a live seat would otherwise name the paying facility).
  // Until the backend writes the file the seat is reported inactive.
  let seat = { active: false };
  if (fs.existsSync(SEAT_SOURCE)) {
    const raw = JSON.parse(fs.readFileSync(SEAT_SOURCE, 'utf8'));
    seat = { active: raw && raw.active === true };
    if (seat.active && raw.end) seat.end = String(raw.end);
  }
  fs.writeFileSync(path.join(outDir, '_seat.json'), JSON.stringify(seat) + '\n');
}

// The backend's matcher reads the directory at /data/facilities.json and keys
// rows on license_number (scripts/validation/senior_living_facilities_contract.js
// holds it present and unique).
function publishFacilities(outDir) {
  const dir = path.join(outDir, 'data');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(FACILITIES_PATH, path.join(dir, 'facilities.json'));
}

module.exports = {
  PACK_KEY, PUBLIC_ID, DISCLOSURE, FACILITIES_PATH,
  isSeniorLiving, loadFacilities, facilitiesForPage, milesBetween,
  intakeSlotHtml, intakeSlotForCity, intakeSlotForSite,
  h1For, cityIntroHtml, directoryHtml, footerFor, copySeatFile, publishFacilities, cityLocalHtml, directoryJsonLd,
};

// The three products this site sells to communities. Kept in code rather than in
// the page JSON because they are this site's own prices, not cost figures about
// care, and scripts/validation/senior_living_site_contract.js pins them.
const PRODUCTS = [
  {
    id: 'exclusive-lead-routing',
    name: 'Exclusive lead routing',
    price: '$249/month',
    terms: 'First 2 months free, then a 6-month term.',
    points: [
      'Every fitting Memphis-area family lead goes to you first, with full details.',
      "Plus one month's rent when a family you receive moves in.",
      'One community holds the seat at a time.',
    ],
    cta: 'mailto',
  },
  {
    id: 'lead-flat',
    name: 'A lead, flat',
    price: '$800',
    terms: 'Pay when you accept a teaser.',
    points: [
      'We email you a teaser: care level, memory needs, budget band, timing and area, with no contact details.',
      'Accept it and you receive the family\'s full details and are charged the flat fee.',
      'Decline it and you owe nothing.',
    ],
    cta: 'teaser',
  },
  {
    id: 'lead-move-in',
    name: 'A lead, on move-in',
    price: "One month's rent",
    terms: 'Accept the teaser and pay only if they move in.',
    points: [
      'Same teaser, same full details when you accept.',
      "You pay one month's rent only if the family moves in.",
      'If they do not move in, you owe nothing.',
    ],
    cta: 'teaser',
  },
];

function productsHtml(contactEmail) {
  const mail = 'mailto:' + contactEmail + '?subject=' + encodeURIComponent('Exclusive lead routing — Memphis Senior Care Homes') +
    '&body=' + encodeURIComponent('Community name:\nLicence number:\nYour name and role:\nPhone:\nMemory care beds (yes/no):\nAreas you serve:\n');
  const tiers = PRODUCTS.map((p) => '<div class="tier" data-senior-product="' + p.id + '">' +
    '<h3>' + esc(p.name) + '</h3>' +
    '<p class="price-anchor">' + esc(p.price) + '</p>' +
    '<p><strong>' + esc(p.terms) + '</strong></p>' +
    '<ul>' + p.points.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
    (p.cta === 'mailto'
      ? '<div class="actions"><a class="btn primary" href="' + esc(mail) + '">Ask about the exclusive seat</a></div>'
      : '<p class="muted">The accept buttons are in each teaser email. Ask us to start sending teasers: <a href="mailto:' + esc(contactEmail) + '">' + esc(contactEmail) + '</a>.</p>') +
    '</div>').join('');
  return '<section class="section for-providers-commercial" data-offer="senior-living-leads" data-senior-products="' + PRODUCTS.length + '">' +
    '<h2>Three ways to receive Memphis-area families</h2>' +
    '<div class="tiers">' + tiers + '</div>' +
    '<h3>What we do not promise</h3>' +
    '<p>We do not guarantee a number of families. How many come in depends on the season, your care levels and your availability. Your listing in the directory is free, stays neutral and is never reordered because of a purchase.</p>' +
    '</section>';
}

module.exports.PRODUCTS = PRODUCTS;
module.exports.productsHtml = productsHtml;

// Extra llms.txt block for this site: what it is, the directory, and how to cite.
function llmsAboutLines(baseUrl) {
  const doc = loadFacilities();
  const rows = doc.facilities || [];
  const tn = rows.filter((f) => f.state === 'TN').length;
  const ms = rows.filter((f) => f.state === 'MS').length;
  const mc = rows.filter((f) => f.memory_care).length;
  return [
    '## About this site',
    `- Memphis Senior Care Homes (${baseUrl}/) is a free guide for families choosing assisted living, memory care and senior care homes in the Memphis area: Shelby, Tipton and Fayette Counties TN, DeSoto and Marshall Counties MS, and Crittenden County AR.`,
    '- A property of The Industry Guides. ' + DISCLOSURE,
    `- Directory: every licensed facility from the state registries, ${tn} Tennessee Assisted Care Living Facilities (Tennessee Health Facilities Commission) and ${ms} Mississippi Personal Care Homes (Mississippi State Department of Health), ${mc} with memory care. Each town, Memphis neighbourhood, hospital and care-type page (memory care or assisted living by town) lists the nearest ones with phone, licence and distance. Listing is free and never ordered by payment.`,
    `- Guides: ${baseUrl}/guides/ (12 decision guides: choosing, levels of care, cost, paying, memory care, care assessments, tour questions, inspection records, contracts, hospital discharge, a parent who refuses, when money runs out). Short answers: ${baseUrl}/faq/.`,
    '- Every dollar figure on the site is taken from a named public source (CareScout cost of care survey, VA pension rates, TennCare CHOICES memos) or omitted.',
    '',
    '## How to cite',
    `- Cite the specific guide or city page URL, for example "Memphis Senior Care Homes, What Assisted Living Costs in the Memphis Area, ${baseUrl}/guides/assisted-living-cost-memphis/".`,
    '- For facility facts (licence, beds, memory care), cite the state registry named on the page as the primary source.',
    '',
  ];
}
module.exports.llmsAboutLines = llmsAboutLines;

// Home page preview: a neutral sample of licensed communities, one per area,
// so the home page shows real places before a family picks a city page.
function homePreviewHtml() {
  const rows = loadFacilities().facilities || [];
  const pick = [];
  for (const city of ['Memphis', 'Germantown', 'Collierville', 'Bartlett', 'Cordova', 'Southaven', 'Olive Branch', 'Arlington']) {
    const f = rows.find((r) => r.city === city && !pick.includes(r));
    if (f) pick.push(f);
  }
  const cards = pick.map((f) => '<div class="card"><h3>' + esc(titleCaseName(f.name)) + '</h3><p class="muted">' + esc(f.city) + ', ' + esc(f.state) + ' · <a href="' + telHref(f.phone) + '">' + esc(f.phone) + '</a>' + (f.memory_care ? ' · memory care' : '') + '</p></div>').join('');
  return '<section class="section" data-home-provider-preview="true">' +
    '<h2>Licensed communities across the Memphis area</h2>' +
    '<p class="muted">A sample, one per area, in no order of preference. Each city page lists every licensed community near it, with licence numbers and distances.</p>' +
    '<div class="grid">' + cards + '</div>' +
    '</section>';
}
module.exports.homePreviewHtml = homePreviewHtml;

// ---------------------------------------------------------------------------
// Care-type pages (kind care_type): "memory care <town>" and "assisted living
// <town>" for the biggest markets. Each carries facts that only hold for that
// type of care in that town (secured beds, licensed capacity, assisted-living-
// only communities, licence status), so it is never a copy of the town page.
// ---------------------------------------------------------------------------
function inOwnCity(city, list) {
  const own = String(city.licensed_city || city.city || '').toLowerCase();
  return list.filter((f) => String(f.city || '').toLowerCase() === own);
}

function careTypeLeadHtml(city, list) {
  const inTown = inOwnCity(city, list);
  const far = list.length ? list[list.length - 1] : null;
  if (isMemoryCarePage(city)) {
    if (!inTown.length) {
      const n = list[0];
      return '<p>No community with ' + aAn(esc(city.city)) + ' address reports a secured memory care unit to the state. The nearest memory care is ' + esc(titleCaseName(n.name)) + ' in ' + esc(n.city) + ', ' + n.miles.toFixed(1) + ' miles away; below are the ' + list.length + ' memory care communities nearest to ' + esc(city.city) + '.</p>';
    }
    const tn = inTown.filter((f) => f.state === 'TN');
    const ms = inTown.filter((f) => f.state === 'MS');
    const parts = [];
    if (tn.length) parts.push(sumBeds(tn, 'secured_beds') + ' secured beds between ' + (tn.length === 1 ? 'it' : 'them') + ' in the Tennessee Health Facilities Commission bed report');
    if (ms.length) parts.push(plural(ms.length, 'home holds', 'homes hold') + ' a licensed Alzheimer\'s/Dementia Care Unit in the Mississippi directory, which publishes no bed count for the unit');
    return '<p>Memory care is a secured unit inside a licensed community, so what matters is whether the state records one. ' + esc(city.city) + ' has ' + plural(inTown.length, 'community', 'communities') + ' with a secured memory care unit on ' + (inTown.length === 1 ? 'its licence' : 'their licences') + ': ' + parts.join('; ') + '. ' +
      'Below ' + (inTown.length === 1 ? 'it is' : 'they are') + ' listed first, then the nearest memory care elsewhere, ' + list.length + ' in all' + (far && far.miles != null ? ', the farthest ' + far.miles.toFixed(1) + ' miles away' : '') + '.</p>';
  }
  const lic = city.state === 'MS'
    ? 'a Personal Care Home - Assisted Living licence from the Mississippi State Department of Health'
    : 'an Assisted Care Living Facility licence from the Tennessee Health Facilities Commission';
  const alOnly = inTown.filter((f) => !f.memory_care);
  if (!inTown.length) {
    // A town with no licensed community of its own: say so, and give the
    // nearest ones with their real distances, never a "0 communities" count.
    const n = list[0];
    const nearest3 = list.slice(0, 3).map((f) => esc(titleCaseName(f.name)) + ' in ' + esc(f.city) + ' (' + f.miles.toFixed(1) + ' miles)');
    const states = Array.from(new Set(list.map((f) => f.state)));
    return '<p>Every community below holds an assisted living licence. No licensed assisted living community has ' + aAn(esc(city.city)) + ' address in the ' + (city.state === 'MS' ? 'Mississippi State Department of Health directory' : 'Tennessee Health Facilities Commission bed report') + ', so families in ' + esc(city.city) + ' choose among the communities in nearby towns. ' +
      'The nearest is ' + esc(titleCaseName(n.name)) + ' in ' + esc(n.city) + ', ' + n.miles.toFixed(1) + ' miles from the centre of ' + esc(city.city) + ' (ZIP ' + esc(city.primary_zip) + '); the next nearest are ' + nearest3.slice(1).join(' and ') + '. ' +
      'Below are the ' + list.length + ' licensed communities nearest to ' + esc(city.city) + ', ' + list.filter((f) => !f.memory_care).length + ' of them assisted living only' + (states.length > 1 ? ', across the ' + states.map(stateName).join(' and ') + ' registries' : '') + ', the farthest ' + list[list.length - 1].miles.toFixed(1) + ' miles away.</p>';
  }
  return '<p>Every community below holds an assisted living licence. ' + esc(city.city) + ' has ' + plural(inTown.length, 'community', 'communities') + ' with ' + lic + ', licensed for ' + sumBeds(inTown, 'total_beds') + ' residents in total. ' +
    (alOnly.length
      ? plural(alOnly.length, 'of them offers', 'of them offer') + ' assisted living only, with no secured memory care unit' + (inTown.length - alOnly.length ? '; the other ' + (inTown.length - alOnly.length) + ' also run' + (inTown.length - alOnly.length === 1 ? 's' : '') + ' one' : '') + '. '
      : 'Every one of them also runs a secured memory care unit. ') +
    'Below the ' + esc(city.city) + ' communities come first, then the nearest others, ' + list.length + ' in all.</p>';
}

function careTypeLocalHtml(city) {
  const list = facilitiesForPage(city);
  const hosp = nearestHospitals(city)[0];
  const linkBase = '<a href="/' + esc(city.base_slug) + '/">every licensed community near ' + esc(city.marketLabel) + '</a>';
  const sibling = loadPages().find((p) => p.kind === 'care_type' && p.base_slug === city.base_slug && p.care_type !== city.care_type);
  const sibLink = sibling ? '<a href="/' + esc(sibling.slug) + '/">' + esc(sibling.linkLabel) + '</a>' : '';
  const money = '<p><strong>Paying for it:</strong> no public source publishes a reliable ' + esc(city.city) + '-only price for ' + topicFor(city) + '. Ask each community for an all-in monthly figure at your parent\'s assessed care level and read <a href="/guides/assisted-living-cost-memphis/">what the monthly rate includes</a>. If money may run out, ask whether it accepts ' + (city.state === 'MS' ? 'Mississippi Medicaid waiver residents' : 'TennCare CHOICES') + ' (<a href="/guides/when-the-money-runs-out-tenncare-choices/">when the money runs out</a>).</p>';
  const hospP = hosp ? '<p><strong>Nearest major hospital with a page here:</strong> ' + esc(hosp.hospital_name) + ', about ' + hosp.miles.toFixed(1) + ' miles away (<a href="/' + esc(hosp.slug) + '/">communities near it</a>).</p>' : '';
  if (isMemoryCarePage(city)) {
    const tn = list.filter((f) => f.state === 'TN' && typeof f.secured_beds === 'number' && f.secured_beds > 0);
    const largest = tn.slice().sort((a, b) => b.secured_beds - a.secured_beds).slice(0, 3);
    const wing = tn.find((f) => typeof f.total_beds === 'number' && f.total_beds > f.secured_beds);
    const ms = list.filter((f) => f.state === 'MS');
    return '<section class="section senior-local" data-senior-local="true" data-decision-routing-block="true" data-senior-care-type="memory_care">' +
      '<h2>Choosing memory care near ' + esc(city.city) + '</h2>' +
      (largest.length ? '<p><strong>Largest secured units nearby:</strong> ' + largest.map((f) => esc(titleCaseName(f.name)) + ' (' + f.secured_beds + ' secured beds, ' + f.miles.toFixed(1) + ' miles)').join('; ') + '. A larger unit is more likely to have an opening, but ask how many residents share each staff member on the night shift.</p>' : '') +
      (wing ? '<p><strong>Memory care is usually a wing:</strong> at ' + esc(titleCaseName(wing.name)) + ', ' + wing.secured_beds + ' of its ' + wing.total_beds + ' licensed beds are secured. If your parent starts in assisted living there, ask whether a move into the secured unit later needs a new assessment and a new contract.</p>' : '') +
      (ms.length ? '<p><strong>In Mississippi:</strong> ' + plural(ms.length, 'community', 'communities') + ' listed here ' + (ms.length === 1 ? 'is a Personal Care Home' : 'are Personal Care Homes') + ' with a licensed Alzheimer\'s/Dementia Care Unit. The state directory does not publish the size of the unit, so ask each one how many secured beds it has.</p>' : '') +
      '<p><strong>When it is time:</strong> a diagnosis alone is not the trigger; wandering, getting lost or not being safe alone is. <a href="/guides/memory-care-when-is-it-time/">How to tell when it is time</a>, and <a href="/guides/activities-of-daily-living-care-levels/">how the care assessment sets the level</a>.</p>' +
      '<p><strong>Ask on the tour:</strong> how the unit is secured, how many staff are on the unit at night, what dementia training they have, and what behaviour would make the community ask your parent to leave. The full list is in the <a href="/guides/questions-to-ask-on-a-tour/">40 tour questions</a>.</p>' +
      money + hospP +
      '<p><strong>Not memory care yet?</strong> See ' + (sibLink || linkBase) + ', or ' + linkBase + '.</p>' +
      '</section>';
  }
  const sizes = list.filter((f) => typeof f.total_beds === 'number' && f.total_beds > 0);
  const min = sizes.reduce((a, f) => Math.min(a, f.total_beds), Infinity);
  const max = sizes.reduce((a, f) => Math.max(a, f.total_beds), 0);
  const small = sizes.filter((f) => f.total_beds <= 30);
  const withMc = list.filter((f) => f.memory_care && f.miles != null).sort((a, b) => a.miles - b.miles).slice(0, 3);
  const flagged = list.filter((f) => f.state === 'TN' && f.license_status && f.license_status !== 'Licensed');
  return '<section class="section senior-local" data-senior-local="true" data-decision-routing-block="true" data-senior-care-type="assisted_living">' +
    '<h2>Choosing assisted living near ' + esc(city.city) + '</h2>' +
    (sizes.length ? '<p><strong>Size:</strong> the communities listed here are licensed for between ' + min + ' and ' + max + ' residents. ' + (small.length ? small.map((f) => esc(titleCaseName(f.name)) + ' (' + f.total_beds + ')').join(', ') + (small.length === 1 ? ' is' : ' are') + ' licensed for 30 or fewer, which some parents find easier to settle into.' : 'None is licensed for 30 or fewer residents; ask about smaller wings if your parent prefers a quieter setting.') + '</p>' : '') +
    (withMc.length ? '<p><strong>If memory loss may progress:</strong> a community that also runs a secured unit lets your parent move within the same building later. Nearest with one: ' + withMc.map((f) => esc(titleCaseName(f.name)) + ' (' + f.miles.toFixed(1) + ' miles)').join('; ') + '. See ' + (sibLink || linkBase) + '.</p>' : '') +
    (flagged.length ? '<p><strong>Licence status:</strong> the Tennessee bed report lists ' + flagged.map((f) => esc(titleCaseName(f.name)) + ' as &ldquo;' + esc(f.license_status) + '&rdquo;').join('; ') + '. Ask the community why and read its survey record before you sign: <a href="/guides/tennessee-assisted-living-inspection-records/">how to read a Tennessee inspection record</a>.</p>' : '<p><strong>Licence status:</strong> every Tennessee community listed here shows a plain &ldquo;Licensed&rdquo; status in the state bed report. Still read the latest survey before you sign: <a href="/guides/tennessee-assisted-living-inspection-records/">how to read a Tennessee inspection record</a>.</p>') +
    '<p><strong>Which level of care:</strong> assisted living fits a parent who needs help with bathing, dressing, meals or medications but is safe on their own. <a href="/guides/levels-of-care-tennessee/">Levels of care explained</a> and <a href="/guides/activities-of-daily-living-care-levels/">how the assessment sets the price</a>.</p>' +
    money + hospP +
    '<p><strong>Before you tour:</strong> use the <a href="/guides/questions-to-ask-on-a-tour/">40 tour questions</a> and take the <a href="/guides/residency-agreement-fees-and-rules/">residency agreement</a> home to read. Every type of care in one list: ' + linkBase + '.</p>' +
    '</section>';
}

// ---------------------------------------------------------------------------
// Internal links: every area, hospital and care-type page links to its nearest
// neighbours, the hospitals around it and the relevant care-type pages. One
// list (data/page_sets/examples/cities_senior_living_v1.json) drives these, the
// home grid, the FAQ and guides-hub link lists and the discharge guide.
// ---------------------------------------------------------------------------
function linkLabelFor(p) {
  if (p.linkLabel) return p.linkLabel;
  if (p.kind === 'hospital') return 'Near ' + p.hospital_name;
  return p.marketLabel;
}
function linkTo(p, withMiles) {
  return '<a href="/' + esc(p.slug) + '/">' + esc(linkLabelFor(p)) + '</a>' + (withMiles && typeof p.miles === 'number' ? ' (' + p.miles.toFixed(1) + ' mi)' : '');
}
function nearbyHtml(city) {
  const pages = loadPages();
  const others = (pred) => byDistance(city, pages.filter((p) => p.slug !== city.slug && pred(p)));
  const areas = others((p) => p.kind === 'city' && p.slug !== city.base_slug);
  const hospitals = others((p) => p.kind === 'hospital');
  const care = pages.filter((p) => p.kind === 'care_type');
  const careFor = (slug) => care.filter((p) => p.base_slug === slug);
  const rows = [];
  if (city.kind === 'care_type') {
    const base = pages.find((p) => p.slug === city.base_slug);
    const same = byDistance(city, care.filter((p) => p.care_type === city.care_type && p.base_slug !== city.base_slug)).slice(0, 4);
    rows.push(['This town', [linkTo(base)].concat(careFor(city.base_slug).filter((p) => p.slug !== city.slug).map((p) => linkTo(p)))]);
    rows.push([city.care_type === 'memory_care' ? 'Memory care nearby' : 'Assisted living nearby', same.map((p) => linkTo(p, true))]);
    rows.push(['Nearby areas', areas.slice(0, 4).map((p) => linkTo(p, true))]);
  } else {
    rows.push(['Nearby areas', areas.slice(0, city.kind === 'hospital' ? 4 : 6).map((p) => linkTo(p, true))]);
    const own = careFor(city.slug);
    let careLinks = own.map((p) => linkTo(p));
    if (!own.length) {
      const markets = byDistance(city, pages.filter((p) => careFor(p.slug).length)).slice(0, city.kind === 'hospital' ? 2 : 1);
      careLinks = markets.flatMap((m) => careFor(m.slug).map((p) => linkTo({ ...p, miles: m.miles }, true)));
    }
    rows.push(['By type of care', careLinks]);
  }
  rows.push([city.kind === 'hospital' ? 'Other hospitals nearby' : 'Hospitals nearby', hospitals.slice(0, 3).map((p) => linkTo(p, true))]);
  return '<section class="section senior-nearby" data-senior-nearby="true">' +
    '<h2>Nearby pages</h2>' +
    rows.filter((r) => r[1].length).map((r) => '<p><strong>' + esc(r[0]) + ':</strong> ' + r[1].join(' · ') + '</p>').join('') +
    '<p class="muted small">Distances are straight-line. Every page lists the licensed communities nearest to it.</p>' +
    '</section>';
}

const AREA_GROUPS = [
  ['By city', (p) => p.kind === 'city' && !p.neighborhood_of],
  ['Memphis neighbourhoods', (p) => p.kind === 'city' && !!p.neighborhood_of],
  ['Near a hospital', (p) => p.kind === 'hospital'],
  ['By type of care', (p) => p.kind === 'care_type'],
];
// Home page grid: one card per page (homepage_v2 turns them into chips).
function areaGridHtml() {
  const pages = loadPages();
  return AREA_GROUPS.flatMap(([, pred]) => pages.filter(pred)).map((p) => '<div class="card"><h3><a href="/' + esc(p.slug) + '/">' + esc(linkLabelFor(p)) + '</a></h3></div>').join('\n    ');
}
// FAQ page and guides hub: the same pages as grouped inline lists.
function areaLinksHtml() {
  const pages = loadPages();
  return AREA_GROUPS.map(([label, pred]) => '<p><strong>' + esc(label) + ':</strong> ' + pages.filter(pred).map((p) => linkTo(p)).join(' · ') + '</p>').join('');
}
// The hospital-discharge guide: every hospital page with its address.
function hospitalListHtml() {
  return '<ul>' + loadPages().filter((p) => p.kind === 'hospital').map((p) => '<li>' + linkTo(p) + ' (' + esc(p.hospital_address) + ')</li>').join('') + '</ul>';
}

// One FAQ per page whose answer only that page can give (it leads the pack's
// shared city FAQ, so the FAQPage schema carries it too).
function cityFaqItem(city) {
  const list = facilitiesForPage(city);
  const near = list[0];
  const mc = list.find((f) => f.memory_care);
  const at = (f) => titleCaseName(f.name) + ' (' + f.address + ', ' + f.city + ', ' + f.miles.toFixed(1) + ' miles, ' + f.phone + ')';
  if (!near) return null;
  if (city.kind === 'hospital') {
    return { q: 'Which licensed assisted living community is closest to ' + city.hospital_name + '?', a: at(near) + '. ' + (mc === near ? 'It also has secured memory care.' : (mc ? 'The nearest with secured memory care is ' + at(mc) + '.' : '')) };
  }
  if (isMemoryCarePage(city)) {
    const inTown = inOwnCity(city, list);
    const tn = inTown.filter((f) => f.state === 'TN');
    return { q: 'How much memory care is there in ' + city.city + '?', a: inTown.length
      ? city.city + ' has ' + plural(inTown.length, 'community', 'communities') + ' with a secured memory care unit' + (tn.length ? ', ' + sumBeds(tn, 'secured_beds') + ' secured beds in the Tennessee bed report' : '') + '. The nearest to the centre is ' + at(near) + '.'
      : 'No community with ' + aAn(city.city) + ' address reports a secured memory care unit. The nearest is ' + at(near) + '.' };
  }
  if (isAssistedLivingPage(city)) {
    const inTown = inOwnCity(city, list);
    if (!inTown.length) return { q: 'Is there a licensed assisted living community in ' + city.city + '?', a: 'No licensed assisted living community has ' + aAn(city.city) + ' address in the state registry. The nearest is ' + at(near) + '.' + (mc && mc !== near ? ' The nearest with secured memory care is ' + at(mc) + '.' : '') };
    return { q: 'How many assisted living communities are licensed in ' + city.city + '?', a: city.city + ' has ' + plural(inTown.length, 'licensed assisted living community', 'licensed assisted living communities') + ', licensed for ' + sumBeds(inTown, 'total_beds') + ' residents in total; ' + inTown.filter((f) => !f.memory_care).length + ' of them have no secured memory care unit. The nearest to the centre is ' + at(near) + '.' };
  }
  if (city.neighborhood_of) {
    const n = list.filter((f) => f.miles != null && f.miles <= NEIGHBORHOOD_MILES).length;
    return { q: 'Is there licensed assisted living within ' + NEIGHBORHOOD_MILES + ' miles of ' + city.city + '?', a: (n ? 'Yes: ' + plural(n, 'licensed community', 'licensed communities') + ' within ' + NEIGHBORHOOD_MILES + ' miles of the centre of ' + city.city + '. ' : 'No: none within ' + NEIGHBORHOOD_MILES + ' miles of the centre of ' + city.city + '. ') + 'The closest is ' + at(near) + '.' };
  }
  const own = inOwnCity(city, list).length;
  return { q: 'Which licensed community is closest to the centre of ' + city.city + '?', a: at(near) + '. ' + (own ? city.city + ' has ' + plural(own, 'licensed community', 'licensed communities') + ' of its own.' : 'No licensed assisted living community has ' + aAn(city.city) + ' address, so every one listed is in a nearby town.') + (mc && mc !== near ? ' The nearest with secured memory care is ' + at(mc) + '.' : '') };
}

// The longest title Google shows in full is about 65 characters (Search
// Readiness item b1). `%%PAGE_TOPIC%% %%PLACE_PHRASE%%` is the title, so the
// topic gets whatever the place phrase leaves. Both labels are true of these
// pages - they list licensed assisted living and memory care - so preferring
// the specific one and stepping down only when it would not fit loses nothing.
const TITLE_BUDGET = 65;
// The phrase the templates render, resolved the same way applyCityTokens
// resolves %%PLACE_PHRASE%%, so a length budget is computed on the real title.
function placePhraseFor(city) {
  if (city && city.placePhrase) return String(city.placePhrase).trim();
  return city && city.marketLabel ? `in ${String(city.marketLabel).trim()}` : '';
}
const TOPIC_FULL = 'Assisted Living & Memory Care';
const TOPIC_SHORT = 'Senior Care';
function defaultTopicWithinTitleBudget(city) {
  const place = placePhraseFor(city);
  if (!place) return TOPIC_FULL;
  return `${TOPIC_FULL} ${place}`.length <= TITLE_BUDGET ? TOPIC_FULL : TOPIC_SHORT;
}

// `Next Steps: %%PAGE_TOPIC_NS%% %%PLACE_PHRASE%%` is the next-steps <title>,
// and the two longest hospital anchors ("near Saint Francis Hospital-Park
// Avenue") pushed it to 66-67 characters. Same step-down as the directory
// title: both labels are true, so prefer the specific one while it fits.
function nextStepsTopicWithinTitleBudget(city) {
  const place = placePhraseFor(city);
  const full = 'Assisted Living';
  if (!place) return full;
  return `Next Steps: ${full} ${place}`.length <= TITLE_BUDGET ? full : TOPIC_SHORT;
}

// The meta description has to sit between 120 and 160 characters (Search
// Readiness item b2) across place phrases that range from "in Cordova, TN" to
// "near Baptist Memorial Hospital-Collierville". One fixed sentence cannot do
// that: the short towns came out at 112 and the hospital anchors at 179. So the
// tail steps down to the longest true wording that still fits, and up when
// there is room. Every variant says the same three things the page does.
const NEXT_STEPS_TAILS = [
  ': settle care needs and budget, check state licences, and get free introductions to licensed communities.',
  ': settle care needs and budget, check state licences, and get free introductions to communities.',
  ': settle care needs and budget, check state licences, and get free introductions.',
  ': settle care needs and budget, check licences, get free introductions.',
];
const META_MIN = 120;
const META_MAX = 160;
function nextStepsMetaDescription(city, mcp, alp) {
  const topic = mcp ? 'memory care' : (alp ? 'assisted living' : 'assisted living or memory care');
  // Same fallback as the %%PLACE_PHRASE%% token in build_city_sites.js
  // applyCityTokens: a care-type page carries no placePhrase, and dropping the
  // town from the description would be a worse defect than the length it fixes.
  const place = String((city && city.placePhrase) || (city && city.marketLabel ? `in ${city.marketLabel}` : '')).trim();
  const head = `Next steps for ${topic}${place ? ' ' + place : ''}`;
  const fitting = NEXT_STEPS_TAILS.filter((t) => (head + t).length <= META_MAX);
  // The longest tail that fits; if none does the shortest is still the best
  // available, and the b2 validator reports it rather than this guessing.
  const chosen = fitting.length ? fitting[0] : NEXT_STEPS_TAILS[NEXT_STEPS_TAILS.length - 1];
  const out = head + chosen;
  if (out.length >= META_MIN) return out;
  // Shorter than the floor even with the longest tail: add the one further true
  // clause rather than padding with words that say nothing.
  return `${out.slice(0, -1)}, with no cost to the family.`;
}

// Title/description tokens for the page templates (senior_living_v1.json).
function pageTopicTokens(city) {
  const mcp = isMemoryCarePage(city), alp = isAssistedLivingPage(city);
  // Search copy reserves space for the publication name. Keep the full place
  // and topic in the visible heading; use familiar hospital abbreviations here.
  const label = String(city.marketLabel || '').replace(/Baptist Memorial Hospital-/, 'Baptist ')
    .replace('Methodist Le Bonheur Germantown Hospital', 'Methodist Germantown')
    .replace('Saint Francis Hospital-', 'St Francis ').replace('Park Avenue', 'Park Ave')
    .replace(/ Hospital$/, '').replace('Memphis VA Medical Center', 'Memphis VA');
  const shortPlace = String(city.city || label).replace(/,\s*(TN|MS|AR)$/, '');
  const topic = mcp ? 'Memory Care' : (alp ? 'Assisted Living' : 'Care');
  return {
    '%%SENIOR_SEARCH_TITLE%%': `${topic} ${city.kind === 'hospital' ? 'near' : 'in'} ${label}`,
    '%%SENIOR_NEXT_SEARCH_TITLE%%': `Next: ${mcp ? 'Memory Care ' : (alp ? 'Assisted Living ' : '')}${city.kind === 'hospital' ? label : shortPlace}`,
    // Length-aware, because this token is the whole <title> on the directory
    // pages: senior_living_v1.json renders `%%PAGE_TOPIC%% %%PLACE_PHRASE%%`.
    // The hospital anchor pages have long place phrases ("near Saint Francis
    // Hospital-Park Avenue"), so the full topic pushed the title to 68-69
    // characters and failed Search Readiness item b1 (title 30-65). A title
    // Google truncates spends the result line on words nobody reads, so the
    // topic steps down to the shorter true label instead of being cut off.
    '%%PAGE_TOPIC%%': mcp ? 'Memory Care Communities' : (alp ? 'Assisted Living Communities' : (city.pageTopic || defaultTopicWithinTitleBudget(city))),
    '%%PAGE_TOPIC_LC%%': topicFor(city),
    '%%PAGE_TOPIC_OR%%': mcp ? 'memory care' : (alp ? 'assisted living' : 'assisted living or memory care'),
    '%%PAGE_TOPIC_NS%%': mcp ? 'Memory Care' : (alp ? 'Licensed Assisted Living' : nextStepsTopicWithinTitleBudget(city)),
    '%%PAGE_TOPIC_FACTS%%': mcp ? 'phone numbers, secured beds' : (alp ? 'phone numbers, licensed beds' : 'phone numbers'),
    '%%NEXT_LABEL%%': city.kind === 'care_type' ? topicFor(city) + ' in ' + city.marketLabel : city.marketLabel,
    '%%NEXT_STEPS_META%%': nextStepsMetaDescription(city, mcp, alp),
  };
}

module.exports.facilitiesForPage = facilitiesForPage;
module.exports.loadPages = loadPages;
module.exports.nearbyHtml = nearbyHtml;
module.exports.areaGridHtml = areaGridHtml;
module.exports.areaLinksHtml = areaLinksHtml;
module.exports.hospitalListHtml = hospitalListHtml;
module.exports.cityFaqItem = cityFaqItem;
module.exports.pageTopicTokens = pageTopicTokens;
module.exports.topicFor = topicFor;
module.exports.NEIGHBORHOOD_MILES = NEIGHBORHOOD_MILES;
