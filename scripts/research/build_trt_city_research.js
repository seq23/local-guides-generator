#!/usr/bin/env node
/**
 * Give every hormone-therapy city page something genuinely local to say.
 *
 * Fifty of the fifty-six trt city pages render from the slug-interpolated
 * template: they name a city and say nothing about it. That is the pile
 * validate:demand-backed-pages seals and refuses to let grow. Adding more of
 * them would be worse than adding nothing.
 *
 * This does the opposite. It does not add a single URL. It takes the pages that
 * already exist and gives each one a fact that is true of that state and not of
 * its neighbour: what clinicians in that state actually billed Medicare for
 * hormone-therapy services in 2024, what Medicare allowed, and how many
 * clinicians billed it at all. The last of those is the most useful and the
 * least published - it is a supply signal, and supply is what determines whether
 * you wait three weeks or three months.
 *
 * Source: data/research/costs/cms_geography_service_2024.json, pulled from the
 * version-pinned CY2024 CMS distribution. See data/research/costs/sources.json.
 *
 * What this file will not do:
 *   - state a dose, a protocol, an outcome or a clinical timeline. Nothing here
 *     is a clinical claim; every line is cost, supply, or a question to ask.
 *   - invent a clinic, a practitioner, a credential or a price.
 *   - name a state medical board URL that has not been verified. It names the
 *     board generically and points at FSMB's DocInfo, which was checked live.
 *   - fill a state in where CMS suppressed the cell. It says so instead.
 *
 * Usage: node scripts/research/build_trt_city_research.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'research', 'costs', 'cms_geography_service_2024.json'), 'utf8'));
const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_trt_v1.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'data', 'city_content', 'trt');

const STATE_NAME = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

const CODES = {
  testosterone: { hcpcs: '84403', label: 'a total testosterone lab test' },
  estradiol: { hcpcs: '82670', label: 'a total estradiol lab test' },
  injection: { hcpcs: '96372', label: 'an injection under the skin or into muscle' },
  pellet: { hcpcs: '11980', label: 'hormone pellet placement under the skin' },
};

const usd = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n).toLocaleString('en-US');

function row(hcpcs, stateName) {
  const e = CMS.codes[hcpcs];
  if (!e || !e.present) return null;
  const s = e.states[stateName];
  return (s && s.O) || null;
}
function nat(hcpcs) {
  const e = CMS.codes[hcpcs];
  return (e && e.present && e.national && e.national.O) || null;
}

const SOURCE_TAG = 'Source: CMS, Medicare Physician & Other Practitioners by Geography and Service, calendar year 2024.';

function costLines(stateName) {
  const lines = [];
  for (const { hcpcs, label } of Object.values(CODES)) {
    const r = row(hcpcs, stateName);
    const n = nat(hcpcs);
    if (!r) {
      lines.push(`${stateName} figures for ${label} (code ${hcpcs}) are not published: CMS suppresses any cell covering fewer than 11 beneficiaries. We would rather leave this blank than estimate it.`);
      continue;
    }
    const vsNat = n ? ` The national average submitted charge for the same code was ${usd(n.avg_submitted_charge)}.` : '';
    lines.push(
      `In ${stateName}, clinicians billed an average of ${usd(r.avg_submitted_charge)} for ${label} (code ${hcpcs}) and Medicare allowed an average of ${usd(r.avg_medicare_allowed)}.${vsNat} ${SOURCE_TAG}`
    );
  }
  lines.push('None of these is a quote. The allowed amount is what one payer permits; the submitted charge is a list price. If you are paying cash, treat the gap between them as the range a conversation happens inside.');
  return lines;
}

function supplyLines(stateName, cityName) {
  const lines = [];
  const t = row('84403', stateName);
  const p = row('11980', stateName);
  const nt = nat('84403');
  const np = nat('11980');

  if (t) {
    const share = nt ? ((t.rendering_providers / nt.rendering_providers) * 100).toFixed(1) : null;
    lines.push(
      `${num(t.rendering_providers)} clinicians in ${stateName} billed Medicare for total testosterone testing in 2024` +
      (share ? `, about ${share}% of the ${num(nt.rendering_providers)} nationally` : '') +
      `. ${SOURCE_TAG}`
    );
  } else {
    lines.push(`${stateName} has no published count of clinicians billing Medicare for total testosterone testing in 2024, which usually means the volume fell below the CMS reporting floor.`);
  }

  if (p) {
    lines.push(
      `${num(p.rendering_providers)} clinicians in ${stateName} billed Medicare for hormone pellet placement in 2024` +
      (np ? `, against ${num(np.rendering_providers)} nationally` : '') +
      `. If pellets are what you are looking for near ${cityName}, that number is a better guide to availability than a directory listing. ${SOURCE_TAG}`
    );
  } else {
    lines.push(`No ${stateName} figure for hormone pellet placement is published for 2024. That is a signal about volume in the Medicare population, not proof that no clinic near ${cityName} offers it.`);
  }

  lines.push(`These counts cover clinicians who bill Medicare. Cash-pay and membership clinics near ${cityName} do not appear in this data at all, and in some metros they are a large share of the market.`);
  return lines;
}

function build(city) {
  const stateName = STATE_NAME[city.state];
  if (!stateName) throw new Error(`no state name for ${city.state}`);
  const c = city.city;

  return {
    _generated_by: 'scripts/research/build_trt_city_research.js',
    _source: 'data/research/costs/cms_geography_service_2024.json (CMS CY2024, version-pinned). See data/research/costs/sources.json.',
    _no_clinical_claims: 'This file contains no dose, protocol, outcome or clinical timeline. Every line is cost, supply, or a question to ask.',
    city_slug: city.slug,
    city: c,
    state: stateName,
    state_abbr: city.state,
    vertical: 'trt',

    market_specific_notes: supplyLines(stateName, c),

    local_vetting_points: [
      `Verify the prescribing clinician's licence with the ${stateName} medical board directly, not through the clinic's own page.`,
      'FSMB runs a national physician lookup at docinfo.org that covers licence status and disciplinary history across states.',
      `Ask who actually writes the prescription for a ${c} patient, and whether that clinician is licensed in ${stateName}.`,
      'Ask whether the medication is an FDA-approved product or a compounded preparation. The FDA states that compounded drugs are not FDA-approved and that it does not verify their safety, effectiveness or quality before marketing.',
      'Ask which compounding pharmacy supplies anything compounded, and whether it is registered.',
      'Ask for the monitoring schedule in writing before any payment is taken.',
      // Every vertical closes local_vetting_points with a named comparison
      // framework, and multi_vertical_citation_repair_contract.js pins the
      // phrase. Each dimension below is one of the questions already asked on
      // this page; nothing new is claimed here.
      `${c} TRT clinic authority framework: compare licensed oversight, baseline labs and monitoring cadence, FDA-approved versus compounded product, what the quoted fee covers, and what stopping costs.`,
    ],

    typical_cost_ranges: costLines(stateName),

    payment_options: [
      'Ask whether the monthly figure is a membership fee, a treatment price, or both, and what happens if you stop after one month.',
      'Ask whether lab work is inside the fee, billed to your insurer, or billed to you separately.',
      'Ask whether the medication is inside the fee or a separate pharmacy charge.',
      `Ask whether the clinic bills insurance at all. Many hormone clinics near ${c} are cash-pay only, which is why they do not appear in the Medicare figures above.`,
      'Ask what a prepaid package costs to exit, in writing, before you buy one.',
    ],

    wait_time_notes: [
      `Separate the wait for a first consultation from the wait to actually start treatment near ${c}. They are often very different.`,
      'Lab turnaround sits between the two. Ask how long results take and who reviews them.',
      'Ask whether the first appointment includes a physical examination or is a phone or video intake only.',
    ],

    availability_notes: [
      `Ask whether the clinic sees ${c} patients in person, by telehealth, or both, and whether that changes what can be prescribed.`,
      `Telehealth prescribing is governed by ${stateName} rules and by federal controlled-substance rules, which have changed more than once. Ask what applies to you now rather than relying on an older article.`,
      'Ask where blood draws happen and whether you can use a lab near you.',
      'Ask what happens to your care if you move out of state.',
    ],

    named_resources_or_providers: [
      `The ${stateName} medical board is the authoritative source for whether a prescriber is licensed and in good standing in ${stateName}.`,
      'The Federation of State Medical Boards operates docinfo.org for cross-state licence and disciplinary lookups.',
      'The FDA publishes plain-language guidance on drug compounding, including the fact that compounded drugs are not FDA-approved.',
      'CMS publishes the billing figures quoted on this page at data.cms.gov, under Medicare Physician & Other Practitioners by Geography and Service.',
      'We do not rank, recommend or endorse clinics, and no clinic on this site has paid for editorial placement.',
    ],

    city_intro_override: `Choosing hormone therapy near ${c} comes down to four checks: who prescribes and where they are licensed, whether the product is FDA-approved or compounded, what the monitoring schedule is, and what the fee actually includes. This page carries the published ${stateName} billing figures so you have something real to hold a quote against.`,

    primary_city_decision_block: {
      // lkg_citation_agent_fixes_2026_05.js pins every trt city block to
      // decision_checklist; the cost figures live in typical_cost_ranges.
      type: 'decision_checklist',
      // city_decision_support_contract.js requires this exact title on every
      // trt city page. It is the string the validator looks for.
      title: 'Local TRT and hormone clinic authority checklist',
      items: [
        `Licence: confirm the prescriber with the ${stateName} medical board, and cross-check at docinfo.org.`,
        'Product: FDA-approved or compounded? Ask which, and which pharmacy compounds it.',
        'Monitoring: which labs, at what intervals, reviewed by whom, in writing.',
        'Fee contents: what is inside the monthly figure and what arrives as a separate bill.',
        `Published comparison: hold the quote against the ${stateName} figures above rather than against a national average from a marketing page.`,
        'Exit: what stopping costs, and what the taper or handover plan is.',
      ],
    },

    lab_work_notes: [
      // The "Baseline labs" opener is pinned by
      // multi_vertical_citation_repair_contract.js. It stays a question about
      // what the clinic does and what it charges, not a statement of what any
      // patient needs.
      'Baseline labs are the first thing to ask about: which panels are drawn before anything is prescribed, and whether they sit inside the quoted fee or arrive as a separate bill.',
      `Ask which specific panels are drawn and how often. ${stateName} billing figures for testosterone and estradiol testing appear above; use them to sanity-check any claim about what a bundled lab package is worth.`,
      'Ask whether you can use your own lab or insurer-covered draw rather than the clinic\'s.',
      'Ask who interprets results and how quickly you receive them.',
      'Ask what result would change the plan. A programme that never changes is not monitoring anything.',
    ],

    therapy_types_available: [
      `Ask which delivery routes the clinic near ${c} actually offers, and which it refers out for.`,
      'Ask whether the recommendation would differ if you chose a different route, and why.',
      'Ask whether the clinic offers anything other than the route it leads with.',
      'We do not describe doses, protocols or expected effects on this site. Those are decisions for a clinician who has examined you.',
    ],

    monitoring_frequency_notes: [
      'Ask for the first-year monitoring schedule in writing before paying anything.',
      'Ask who reviews each result and how you are told about it.',
      'Ask what the escalation path is if something on a panel looks wrong.',
      'Ask how monitoring changes if you switch to telehealth or move.',
    ],

    fertility_or_hair_considerations: [
      'If you may want children, ask how the plan addresses that, and ask before starting rather than after.',
      'Ask whether the clinic discusses this routinely at intake or only when raised.',
      'Ask what the plan is if you decide to stop, and who manages that.',
      'We do not publish outcome claims about fertility or hair on this site. Ask a clinician who can review your history.',
    ],
  };
}

// The exact bytes this generator is responsible for, for one city. The
// drift guard (scripts/validation/trt_city_research_contract.js) compares
// this against the committed file, so the serialisation lives in one place.
function serialize(city) {
  return JSON.stringify(build(city), null, 2) + '\n';
}

function main() {
  let written = 0;
  let withState = 0;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const city of CITIES) {
    fs.writeFileSync(path.join(OUT_DIR, `${city.slug}.json`), serialize(city));
    written += 1;
    if (row('84403', STATE_NAME[city.state])) withState += 1;
  }
  console.log(`wrote ${written} trt city research files; ${withState} carry a published state testosterone-testing figure, ${written - withState} state so explicitly.`);
}

// Importable so a validator can rebuild in memory without writing anything.
if (require.main === module) main();

module.exports = { CITIES, OUT_DIR, build, serialize };
