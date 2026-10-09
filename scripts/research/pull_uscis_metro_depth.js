#!/usr/bin/env node
'use strict';
/**
 * Pull real local detail for the largest uscisexam.com metro pages.
 *
 * Writes into data/city_content/uscis_medical/<slug>.json:
 *   - civil_surgeon_locator: the nearest civil surgeons the official USCIS
 *     "Find a Civil Surgeon" locator returns for the metro centre (name,
 *     address, phone, languages), with the retrieval date and source.
 *   - cost_comparison_table: advertised base prices for the metro from a
 *     public booking aggregator, summarised as ranges, with what is included.
 *   - typical_cost_ranges[0]: the same range in one sentence (it is the item
 *     the page's lead checklist shows first).
 *
 * Usage: node scripts/research/pull_uscis_metro_depth.js [--dry-run]
 *
 * Fail before write: every metro is fetched and validated first; if any metro
 * returns fewer than MIN_SURGEONS locator rows or fewer than MIN_PRICES price
 * listings, nothing is written. This is a manual research pull, not a CI step.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'data', 'city_content', 'uscis_medical');
const LOCATOR_TYPE = '41091'; // dataTypeNum the USCIS page passes to its own locator
const LOCATOR_SOURCE = 'https://www.uscis.gov/tools/find-a-civil-surgeon';
const MAX_SURGEONS = 10;
const MIN_SURGEONS = 5;
const MIN_PRICES = 5;
const PRICE_RADIUS_MILES = 25;
const UA = 'Mozilla/5.0 (local-guides research pull; contact info@spryvc.com)';

// The five largest metros covered by the uscis_medical pack (Census MSA rank).
const METROS = [
  { slug: 'new-york-city-ny', label: 'New York City', center: [40.7128, -74.006], aggregator: 'new-york-city-ny', state: 'NY' },
  { slug: 'los-angeles-ca', label: 'Los Angeles', center: [34.0537, -118.2428], aggregator: 'los-angeles-ca', state: 'CA' },
  { slug: 'chicago-il', label: 'Chicago', center: [41.8837, -87.6323], aggregator: 'chicago-il', state: 'IL' },
  { slug: 'dallas-tx', label: 'Dallas', center: [32.7767, -96.797], aggregator: 'dallas-tx', state: 'TX' },
  { slug: 'houston-tx', label: 'Houston', center: [29.7604, -95.3698], aggregator: 'houston-tx', state: 'TX' }
];

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

function titleCase(s) {
  return String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Md|Pc|Llc|Llp|Pllc|Do|Ii|Iii|Nyc|Usa|Ny|Ca|Il|Tx)\b/g, (m) => m.toUpperCase());
}

async function pullLocator(metro) {
  const point = encodeURIComponent(`${metro.center[0]},${metro.center[1]}<=10000mi`).replace(/%2C/g, ',');
  const ids = await getJson(`https://www.uscis.gov/rest/locator/proximity/id/${point}/${LOCATOR_TYPE}/all/all/all?topic_id=1&page=0`);
  if (!Array.isArray(ids) || !ids.length) return [];
  const idList = ids.slice(0, MAX_SURGEONS).map((r) => r.id).join('+');
  const rows = await getJson(`https://www.uscis.gov/rest/locator/proximity/${point}/${LOCATOR_TYPE}/${idList}`);
  return (rows || []).map((r) => {
    let contacts = [];
    try { contacts = JSON.parse(r.contacts || '[]'); } catch (_) { contacts = []; }
    const c = contacts[0] || {};
    const doctor = [c.first_name, c.last_name].filter(Boolean).join(' ');
    const languages = Array.from(new Set(contacts.flatMap((x) => String(x.languages || '').split(',').map((s) => s.trim()).filter(Boolean))));
    return {
      practice: titleCase(r.name),
      doctor: doctor ? `Dr. ${titleCase(doctor)}` : '',
      address: [titleCase(r.address1), titleCase(r.address2), String(r.city || '').replace(/^(.*), ([A-Z]{2}) (\d{5})$/, (m, city, st, zip) => `${titleCase(city)}, ${st} ${zip}`)].filter(Boolean).join(', '),
      phone: String(c.phone || r.primary_phone || '').trim(),
      languages: languages.join(', '),
      miles_from_center: Math.round(Number(r.distance || 0) * 10) / 10
    };
  }).filter((r) => r.practice && r.address && r.phone);
}

function pageText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

async function pullPrices(metro) {
  const url = `https://www.easyime.com/uscis-immigration-doctors-${metro.aggregator}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  const t = pageText(await res.text());
  const re = new RegExp(`([A-Za-z .]+), ${metro.state} - (\\d{5}) [\\d.]+ ([\\d.]+) Miles Away.*?Adult \\$ (\\d+) Child \\$ (\\d+)(.{0,90})`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(t))) {
    const miles = Number(m[3]);
    if (miles > PRICE_RADIUS_MILES) continue;
    const tail = m[6];
    out.push({ zip: m[2], miles, adult: Number(m[4]), child: Number(m[5]), labsIncluded: /Labs included/.test(tail), vaccinesExtra: /Vaccinations extra/.test(tail) });
  }
  return { url, listings: out };
}

function stats(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const mid = s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  return { min: s[0], max: s[s.length - 1], median: mid, n: s.length };
}

function buildCostTable(metro, prices, retrieved) {
  const l = prices.listings;
  const adult = stats(l.map((x) => x.adult));
  const child = stats(l.map((x) => x.child));
  const labs = l.filter((x) => x.labsIncluded).length;
  const vax = l.filter((x) => x.vaccinesExtra).length;
  return {
    heading: `What civil surgeons near ${metro.label} advertise`,
    caption: `${adult.n} advertised listings within ${PRICE_RADIUS_MILES} miles of central ${metro.label}, checked ${retrieved}`,
    columns: ['Item', `${metro.label} (checked ${retrieved})`],
    rows: [
      { label: 'Adult base price', cells: [`$${adult.min} to $${adult.max} (median $${adult.median})`] },
      { label: 'Child base price', cells: [`$${child.min} to $${child.max} (median $${child.median})`] },
      { label: 'Blood work included in the base price', cells: [`${labs} of ${l.length} listings`] },
      { label: 'Vaccinations billed on top', cells: [`${vax} of ${l.length} listings`] }
    ],
    source: `Source: advertised prices on a public booking aggregator (${prices.url}), retrieved ${retrieved}. These are the offices' own advertised base prices, not a quote. Vaccines you cannot document, a positive TB screen (chest X-ray) and follow-up visits add to the total. Ask each office for one all-in figure before you book.`,
    summary: `Advertised base prices near ${metro.label} run $${adult.min} to $${adult.max} for an adult (median $${adult.median} across ${adult.n} listings checked ${retrieved}); ${labs} of ${l.length} include blood work, and ${vax} of ${l.length} bill vaccinations on top. Ask for the all-in number.`
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const retrieved = new Date().toISOString().slice(0, 10);
  const plans = [];
  for (const metro of METROS) {
    const fp = path.join(DIR, `${metro.slug}.json`);
    if (!fs.existsSync(fp)) throw new Error(`missing research file ${fp}`);
    const surgeons = await pullLocator(metro);
    const prices = await pullPrices(metro);
    if (surgeons.length < MIN_SURGEONS) throw new Error(`${metro.slug}: locator returned ${surgeons.length} usable rows (< ${MIN_SURGEONS}); nothing written`);
    if (prices.listings.length < MIN_PRICES) throw new Error(`${metro.slug}: ${prices.listings.length} price listings (< ${MIN_PRICES}); nothing written`);
    plans.push({ metro, fp, surgeons, prices });
    console.log(`${metro.slug}: ${surgeons.length} civil surgeons, ${prices.listings.length} price listings`);
  }
  if (dryRun) { console.log('dry run: nothing written'); return; }
  for (const { metro, fp, surgeons, prices } of plans) {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const table = buildCostTable(metro, prices, retrieved);
    data.civil_surgeon_locator = {
      heading: `Civil surgeons the USCIS locator lists nearest central ${metro.label}`,
      retrieved,
      source: LOCATOR_SOURCE,
      note: `These are the ${surgeons.length} offices the official USCIS locator returned nearest central ${metro.label} on ${retrieved}, in distance order. Listing here is not a ranking or an endorsement, and designations change: search the locator by your own ZIP code before you book.`,
      listings: surgeons
    };
    const { summary, ...tableOnly } = table;
    data.cost_comparison_table = tableOnly;
    const ranges = Array.isArray(data.typical_cost_ranges) ? data.typical_cost_ranges : [];
    data.typical_cost_ranges = [summary, ...ranges.filter((x) => !/^Advertised base prices near /.test(String(x)))];
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
  }
  console.log(`wrote ${plans.length} metro files`);
}

main().catch((e) => { console.error(`FAIL: ${e.message}`); process.exit(1); });
