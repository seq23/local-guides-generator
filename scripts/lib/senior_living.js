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
const MIN_ROWS = 10;
function facilitiesForPage(city) {
  const all = loadFacilities().facilities || [];
  const withDist = all.map((f) => ({ ...f, miles: milesBetween(city.lat, city.lng, f.lat, f.lng) }));
  withDist.sort((a, b) => (a.miles == null ? 1e9 : a.miles) - (b.miles == null ? 1e9 : b.miles));
  if (city.kind === 'hospital') return withDist.slice(0, MIN_ROWS);
  const own = String(city.licensed_city || city.city || '').toLowerCase();
  const inCity = city.neighborhood_of
    ? withDist.filter((f) => f.miles != null && f.miles <= 4)
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

function h1For(city) {
  if (city.kind === 'hospital') return 'Assisted living and memory care near ' + esc(city.hospital_name);
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
  const own = list.filter((f) => String(f.city || '').toLowerCase() === String(city.licensed_city || city.city).toLowerCase()).length;
  const lead = city.state === 'AR'
    ? 'Families in ' + esc(city.marketLabel) + ' often look east across the river. This directory lists communities licensed in Tennessee and Mississippi; Arkansas licenses its own separately. Below are the ' + list.length + ' licensed communities nearest to ' + esc(city.city) + ', ' + mc + ' of them with memory care.'
    : (own
      ? esc(city.city) + ' has ' + own + ' licensed assisted living ' + (own === 1 ? 'community' : 'communities') + ' in the ' + (city.state === 'MS' ? 'Mississippi' : 'Tennessee') + ' registry. Below ' + (own === 1 ? 'it is' : 'they are') + ' listed first, then the nearest others, ' + mc + ' of the ' + list.length + ' with memory care.'
      : 'The ' + (city.state === 'MS' ? 'Mississippi' : 'Tennessee') + ' registry lists no assisted living community with a ' + esc(city.city) + ' address, so below are the ' + list.length + ' licensed communities nearest to ' + esc(city.city) + ', ' + mc + ' of them with memory care.');
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
  return '<section class="section senior-directory" id="directory" data-senior-directory="true" data-directory-count="' + list.length + '">' +
    '<h2>Licensed assisted living and memory care ' + where + '</h2>' +
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
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', '@id': pageUrl + '#directory', name: 'Licensed assisted living and memory care near ' + (city.kind === 'hospital' ? city.hospital_name : city.marketLabel), numberOfItems: items.length, itemListOrder: 'https://schema.org/ItemListOrderAscending', itemListElement: items };
  return '<script type="application/ld+json" data-senior-directory-ld="true">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>';
}

function nearestHospitals(city) {
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_senior_living_v1.json'), 'utf8')).filter((c) => c.kind === 'hospital');
  return all.map((h) => ({ ...h, miles: milesBetween(city.lat, city.lng, h.lat, h.lng) })).sort((a, b) => a.miles - b.miles);
}

// The local off-ramps every city page carries: nearest hospital, the decisions
// families face next, and what this area's directory actually contains.
function cityLocalHtml(city) {
  if (city.kind === 'hospital') return hospitalLocalHtml(city);
  const list = facilitiesForPage(city);
  const near = list.filter((f) => f.miles != null).slice(0, 3);
  const hosp = nearestHospitals(city)[0];
  const mc = list.filter((f) => f.memory_care);
  const small = list.filter((f) => typeof f.total_beds === 'number' && f.total_beds <= 30);
  const nearestTxt = near.map((f) => esc(titleCaseName(f.name)) + ' (' + f.miles.toFixed(1) + ' miles, ' + esc(f.phone) + ')').join('; ');
  return '<section class="section senior-local" data-senior-local="true">' +
    '<h2>What families near ' + esc(city.city) + ' should know</h2>' +
    '<p><strong>Closest licensed communities:</strong> ' + nearestTxt + '. Distances are straight-line; allow for traffic on Poplar Avenue, I-240, US-78 and I-55 when you plan regular visits.</p>' +
    '<p><strong>Memory care:</strong> ' + mc.length + ' of the ' + list.length + ' communities listed here report a secured memory care unit to the state' + (mc.length ? ', the nearest being ' + esc(titleCaseName(mc[0].name)) + (mc[0].miles != null ? ' at ' + mc[0].miles.toFixed(1) + ' miles' : '') : '') + '. If your parent wanders or cannot be left alone safely, start with those. <a href="/guides/memory-care-when-is-it-time/">How to tell when it is time</a>.</p>' +
    '<p><strong>Small residences:</strong> ' + (small.length ? small.length + ' of the communities listed are licensed for 30 or fewer residents, which some parents find easier to settle into than a large building.' : 'every community listed here is licensed for more than 30 residents; ask about smaller wings or neighbourhoods inside them if your parent prefers a quieter setting.') + '</p>' +
    (hosp ? '<p><strong>Nearest major hospital:</strong> ' + esc(hosp.hospital_name) + ', about ' + hosp.miles.toFixed(1) + ' miles away. If your parent is being discharged there, see <a href="/' + hosp.slug + '/">communities near ' + esc(hosp.hospital_name) + '</a> and <a href="/guides/hospital-discharge-to-assisted-living-memphis/">what to have ready in 72 hours</a>.</p>' : '') +
    '<p><strong>Cost:</strong> no public source publishes a reliable ' + esc(city.city) + '-only price. Ask each community for an all-in monthly figure at your parent\'s assessed care level, and read <a href="/guides/assisted-living-cost-memphis/">what the monthly rate includes</a> before you compare quotes. If money may run out, ask whether the community accepts ' + (city.state === 'MS' ? 'Mississippi Medicaid waiver residents' : 'TennCare CHOICES') + ' and read <a href="/guides/when-the-money-runs-out-tenncare-choices/">when the money runs out</a>.</p>' +
    '<p><strong>Before you tour:</strong> use the <a href="/guides/questions-to-ask-on-a-tour/">40 tour questions</a>, check each licence with the state (<a href="/guides/tennessee-assisted-living-inspection-records/">how</a>), and take the residency agreement home to read (<a href="/guides/residency-agreement-fees-and-rules/">what to look for</a>). Short answers are on the <a href="/faq/">FAQ</a>.</p>' +
    '</section>';
}

function hospitalLocalHtml(city) {
  const list = facilitiesForPage(city);
  const mc = list.filter((f) => f.memory_care);
  const nearest = list[0];
  const allCities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_senior_living_v1.json'), 'utf8')).filter((c) => c.kind === 'city');
  const nearCities = allCities.map((c) => ({ ...c, miles: milesBetween(city.lat, city.lng, c.lat, c.lng) })).sort((a, b) => a.miles - b.miles).slice(0, 3);
  return '<section class="section senior-local" data-senior-local="true">' +
    '<h2>Leaving ' + esc(city.hospital_name) + ' for assisted living</h2>' +
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
    `- Memphis Senior Care Homes (${baseUrl}/) is a free guide for families choosing assisted living, memory care and senior care homes in the Memphis area: Shelby County TN, DeSoto County MS and Crittenden County AR.`,
    '- A property of The Industry Guides. ' + DISCLOSURE,
    `- Directory: every licensed facility from the state registries, ${tn} Tennessee Assisted Care Living Facilities (Tennessee Health Facilities Commission) and ${ms} Mississippi Personal Care Homes (Mississippi State Department of Health), ${mc} with memory care. Each city and hospital page lists the nearest ones with phone, licence and distance. Listing is free and never ordered by payment.`,
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
