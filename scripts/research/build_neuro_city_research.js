#!/usr/bin/env node
/**
 * Give every neuro-evaluation city page something genuinely local to say.
 *
 * Fifty of the fifty-six neuro city pages render from the slug-interpolated
 * template: they name a city and say nothing about it. The other six carry
 * hand-written prose that is equally non-local - "Atlanta neuro-evaluation
 * shoppers usually need a cleaner comparison of testing depth" is true of
 * everywhere, which makes it a fact about nobody. That is the pile
 * validate:demand-backed-pages seals and refuses to let grow.
 *
 * This is the neuro counterpart of build_trt_city_research.js. It adds no URL
 * and retires nothing; it gives each page that already exists facts that are
 * true of that city and not of the next one.
 *
 * TWO DESIGN NOTES THAT WERE PAID FOR IN MEASUREMENT.
 *
 * 1. Short beats thorough. The first version of this script added ~1,270 words
 *    per page, of which about 200 varied by state and the rest was well-meant
 *    generic advice ("ask whether the clinic bills insurance"). Measured on the
 *    rendered pages it moved the Boston/Chicago pair from 0.78 Dice to 0.94 -
 *    it took two pages that passed the duplication bar and made them fail it.
 *    More words, worse pages. Every line below has to earn its place by varying
 *    between cities; generic advice that could sit on any page in the country
 *    was cut rather than kept.
 *
 * 2. State data cannot differentiate cities in the same state. With state-level
 *    figures alone, San Diego and San Francisco render at 0.99 Dice, because
 *    they genuinely share a state. So this script leads with CITY-level figures
 *    from the CMS by-Provider-and-Service file, where San Diego is 42 clinicians
 *    at a $196.80 service-weighted charge and San Francisco is 22 at $546.78.
 *    Those are different pages because those are different places.
 *
 * Sources, both CMS CY2024, both from the 2026-05-21 release so they are
 * internally consistent:
 *   data/research/costs/cms_provider_city_neuro_2024.json  (city level)
 *     via scripts/research/pull_cms_provider_city_neuro.js
 *   data/research/costs/cms_geography_service_2024.json    (state level)
 *     via scripts/research/pull_cms_geo_service_costs.js
 * Both re-verified live against the CMS API on 2026-08-27.
 *
 * The practice-address limit is stated on every page that uses a city figure,
 * because it is the one that could mislead. Rndrng_Prvdr_City is the address on
 * the claim, not a catchment area. Newark is the clearest case: New Jersey has
 * 71 practice cities in this data and not one of them is Newark, because NJ
 * neuropsychology bills from the suburbs. A page that printed "0 providers in
 * Newark" without that sentence would be false in effect while true in fact.
 *
 * The Medicare-population caveat matters more here than in any other vertical
 * in this repo, and every page carries it. Many people searching for a
 * neuropsychological evaluation are parents seeking an ADHD or autism
 * evaluation for a child, and Medicare fee-for-service covers almost none of
 * them.
 *
 * What this file will not do:
 *   - state a diagnosis, test battery, cut score, outcome or clinical timeline.
 *   - invent a clinic, practitioner, credential, wait time or price.
 *   - name a state psychology board URL. Fifty could not be verified
 *     individually, so boards are named generically and asppb.net - the one
 *     national directory checked live, HTTP 200 on 2026-08-27 - is the only
 *     external organisation named.
 *   - fill a city or state in where CMS published nothing. It says so instead.
 *
 * Usage: node scripts/research/build_neuro_city_research.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'research', 'costs', 'cms_geography_service_2024.json'), 'utf8'));
const CITY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'research', 'costs', 'cms_provider_city_neuro_2024.json'), 'utf8'));
const CITIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'page_sets', 'examples', 'cities_neuro_v1.json'), 'utf8'));
const OUT_DIR = path.join(ROOT, 'data', 'city_content', 'neuro');

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

// The page-set spells some cities differently from the CMS practice-address
// field. These are spelling aliases for the same place, not substitutions of a
// different city's data.
const CITY_ALIAS = {
  'NEW YORK CITY|NY': 'NEW YORK|NY',
  'ST LOUIS|MO': 'SAINT LOUIS|MO',
  'ST. LOUIS|MO': 'SAINT LOUIS|MO',
  'ST PAUL|MN': 'SAINT PAUL|MN',
};

const usd = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) => Number(n).toLocaleString('en-US');
const pct = (a, b) => Math.round(Math.abs(a - b) / b * 100);

function geoRow(hcpcs, stateName) {
  const e = GEO.codes[hcpcs];
  if (!e || !e.present) return null;
  const s = (e.states || {})[stateName];
  return (s && s.O) || null;
}
function geoNat(hcpcs) {
  const e = GEO.codes[hcpcs];
  return (e && e.present && e.national && e.national.O) || null;
}

function cityRow(cityName, stateAbbr, code) {
  let k = `${cityName.trim().toUpperCase()}|${stateAbbr.toUpperCase()}`;
  k = CITY_ALIAS[k] || k;
  const b = CITY.cities[k];
  return (b && b.codes && b.codes[code]) || null;
}

/** Practice cities in the same state with a 96132 figure, largest first. */
function peersInState(stateAbbr, excludeCity) {
  const ex = String(excludeCity || '').trim().toUpperCase();
  return Object.values(CITY.cities)
    .filter((v) => v.state_abbr === stateAbbr.toUpperCase() && v.codes['96132'] && v.city.toUpperCase() !== ex)
    .map((v) => ({ city: v.city, n: v.codes['96132'].rendering_providers }))
    .sort((a, b) => b.n - a.n);
}

// Rank the reporting geographies by clinician count once, so each page can say
// where its state sits. Ranking covers only geographies CMS published an office
// figure for, and the sentence says so rather than implying "of 50".
const RANKED = Object.entries(GEO.codes['96132'].states || {})
  .filter(([, v]) => v && v.O)
  .map(([s, v]) => [s, v.O.rendering_providers])
  .sort((a, b) => b[1] - a[1]);
const RANK_OF = new Map(RANKED.map(([s], i) => [s, i + 1]));
const RANK_TOTAL = RANKED.length;

const SRC_CITY = 'Source: CMS, Medicare Physician & Other Practitioners by Provider and Service, CY2024.';
const SRC_GEO = 'Source: CMS, Medicare Physician & Other Practitioners by Geography and Service, CY2024.';
const ADDRESS_LIMIT =
  'That count is by practice address on the claim, not by catchment, so clinicians serving the metro from a ' +
  'suburban office are not in it. Treat it as a floor, never as the number of providers available to you.';
const POP =
  'These are Medicare fee-for-service figures, so the patients behind them are 65-plus and disabled beneficiaries. ' +
  'For a child evaluation they describe a different population than yours, and they remain the only per-city figures ' +
  'published for these codes. None of them is a quote.';

function supplyLines(city, stateAbbr, stateName) {
  const lines = [];
  const c = cityRow(city, stateAbbr, '96132');
  const st = geoRow('96132', stateName);
  const rank = RANK_OF.get(stateName);

  if (c) {
    const types = Object.entries(c.provider_types || {});
    const top = types.length ? types[0] : null;
    lines.push(
      `${num(c.rendering_providers)} clinicians billing from a ${city} practice address charged Medicare for a ` +
      `neuropsychological evaluation in 2024, across ${num(c.beneficiaries)} beneficiaries. ${ADDRESS_LIMIT} ${SRC_CITY}`
    );
    if (top) {
      lines.push(
        `The largest single group among them by headcount was "${top[0]}" (${top[1]} of ${c.rendering_providers}). ` +
        `That is a fact about who bills this code in ${city}, not a judgement about any of them — but it is worth ` +
        `knowing before you assume every ${city} listing for this service is a neuropsychologist. ${SRC_CITY}`
      );
    }
  } else {
    const peers = peersInState(stateAbbr, city);
    const near = peers.slice(0, 3).map((p) => `${p.city} (${p.n})`).join(', ');
    lines.push(
      `No clinician billed Medicare for a neuropsychological evaluation from a ${city} practice address in 2024. ` +
      `That is an artefact of where practices register, not a statement about local availability: ${stateName} has ` +
      `${peers.length} practice cities with a published figure` + (near ? `, led by ${near}` : '') +
      `. Search the metro, not the city name. ${SRC_CITY}`
    );
  }

  if (st) {
    lines.push(
      `Statewide, ${num(st.rendering_providers)} ${stateName} clinicians billed the code across ` +
      `${num(st.beneficiaries)} beneficiaries — ${rank === 1 ? 'the highest' : `${rank}th highest`} of the ` +
      `${RANK_TOTAL} states and territories CMS published a figure for. Where the binding constraint is the waitlist ` +
      `rather than the price, that is the most useful published capacity number. ${SRC_GEO}`
    );
  }

  lines.push(
    `Private-pay neuropsychologists near ${city}, school district evaluators and hospital developmental clinics ` +
    `billing only commercial plans are absent from every count on this page, and for child evaluation they are much ` +
    `of the market.`
  );
  return lines;
}

function costLines(city, stateAbbr, stateName) {
  const lines = [];
  const cc = cityRow(city, stateAbbr, '96132');
  const st = geoRow('96132', stateName);
  const nf = geoNat('96132');
  const addl = geoRow('96133', stateName);
  const na = geoNat('96133');

  if (cc && cc.avg_submitted_charge_service_weighted && nf) {
    const v = cc.avg_submitted_charge_service_weighted;
    const dir = v >= nf.avg_submitted_charge ? 'above' : 'below';
    lines.push(
      `${city} practices billed a service-weighted average of ${usd(v)} for the first hour of a neuropsychological ` +
      `evaluation (code 96132) in 2024 — ${pct(v, nf.avg_submitted_charge)}% ${dir} the national ` +
      `${usd(nf.avg_submitted_charge)}${st ? `, against ${usd(st.avg_submitted_charge)} across ${stateName}` : ''}. ${SRC_CITY}`
    );
  } else if (st && nf) {
    const dir = st.avg_submitted_charge >= nf.avg_submitted_charge ? 'above' : 'below';
    lines.push(
      `No ${city} practice-address figure is published for code 96132, so the nearest published anchor is ${stateName}: ` +
      `an average submitted charge of ${usd(st.avg_submitted_charge)}, ${pct(st.avg_submitted_charge, nf.avg_submitted_charge)}% ` +
      `${dir} the national ${usd(nf.avg_submitted_charge)}. ${SRC_GEO}`
    );
  } else {
    lines.push(
      `Neither ${city} nor ${stateName} has a published 2024 figure for code 96132. This page leaves it blank rather ` +
      `than estimating it — ask two or three clinics for an hourly rate and compare those instead.`
    );
  }

  if (st) {
    lines.push(
      `Medicare allowed an average of ${usd(st.avg_medicare_allowed)} for that first hour in ${stateName}. The ` +
      `submitted charge is a list price and the allowed amount is what one payer permits; a private-pay quote will ` +
      `match neither, but the gap between them is the range the conversation happens inside. ${SRC_GEO}`
    );
  }

  if (addl) {
    const vs = na ? ` against ${usd(na.avg_submitted_charge)} nationally` : '';
    lines.push(
      `Each additional hour (code 96133) averaged ${usd(addl.avg_submitted_charge)} submitted in ${stateName}, ` +
      `Medicare allowing ${usd(addl.avg_medicare_allowed)}${vs}. An evaluation has no single price because it is ` +
      `billed by the hour — so the number to ask a ${city} clinic for is hours, not a total. ${SRC_GEO}`
    );
  } else {
    lines.push(
      `No ${stateName} figure is published for additional evaluation hours (code 96133), but the structure holds ` +
      `everywhere: 96132 is the first hour and 96133 each hour after it. Ask how many hours a ${city} clinic expects to bill.`
    );
  }

  lines.push(POP);
  return lines;
}

/**
 * The same published figures the prose already carries, as three columns you can
 * read across instead of four sentences you have to hold in your head.
 *
 * Nothing here is new evidence and nothing is estimated. Every cell is either a
 * CMS CY2024 figure or the words "Not published by CMS" - which is a real
 * finding about a state, not a gap to fill in. The city column comes from the
 * by-Provider-and-Service file (practice address), the state and national
 * columns from the by-Geography-and-Service file.
 */
function costTable(city, stateAbbr, stateName) {
  const cc = cityRow(city, stateAbbr, '96132');
  const st = geoRow('96132', stateName);
  const nat = geoNat('96132');
  const stAddl = geoRow('96133', stateName);
  const natAddl = geoNat('96133');
  const NP = 'Not published by CMS';

  const rows = [
    {
      label: 'First hour of a neuropsychological evaluation (96132) — average submitted charge',
      cells: [
        cc && cc.avg_submitted_charge_service_weighted ? usd(cc.avg_submitted_charge_service_weighted) : NP,
        st ? usd(st.avg_submitted_charge) : NP,
        nat ? usd(nat.avg_submitted_charge) : NP,
      ],
    },
    {
      label: 'First hour (96132) — average Medicare-allowed amount',
      cells: [
        'Not published at city level',
        st ? usd(st.avg_medicare_allowed) : NP,
        nat ? usd(nat.avg_medicare_allowed) : NP,
      ],
    },
    {
      label: 'Each additional hour (96133) — average submitted charge',
      cells: [
        'Not published at city level',
        stAddl ? usd(stAddl.avg_submitted_charge) : NP,
        natAddl ? usd(natAddl.avg_submitted_charge) : NP,
      ],
    },
    {
      label: 'Clinicians who billed 96132 in 2024',
      cells: [
        cc ? num(cc.rendering_providers) : '0 from this practice address',
        st ? num(st.rendering_providers) : NP,
        nat ? num(nat.rendering_providers) : NP,
      ],
    },
    {
      label: 'Beneficiaries behind those 96132 claims',
      cells: [
        cc ? num(cc.beneficiaries) : NP,
        st ? num(st.beneficiaries) : NP,
        nat ? num(nat.beneficiaries) : NP,
      ],
    },
  ];

  return {
    heading: `What ${city} and ${stateName} clinicians actually billed`,
    caption: `Medicare CY2024 figures for a neuropsychological evaluation, ${city} against ${stateName} and the national average.`,
    columns: ['Measure', city, stateName, 'National'],
    rows,
    source:
      'Source: CMS, Medicare Physician & Other Practitioners — by Provider and Service (city column) and by Geography and Service '
      + '(state and national columns), calendar year 2024. City figures are by practice address on the claim, not catchment. '
      + 'Medicare fee-for-service only, so for a child evaluation these describe a different patient population. Not a quote.',
  };
}

function build(city) {
  const stateName = STATE_NAME[city.state];
  if (!stateName) throw new Error(`no state name for ${city.state}`);
  const c = city.city;
  const ab = city.state;
  const cc = cityRow(c, ab, '96132');
  const st = geoRow('96132', stateName);
  const nf = geoNat('96132');
  const rank = RANK_OF.get(stateName);

  const anchor = cc && cc.avg_submitted_charge_service_weighted && nf
    ? `Hold a quote against the ${usd(cc.avg_submitted_charge_service_weighted)} service-weighted average ${c} practices billed for the first hour, not against a figure from a marketing page.`
    : st && nf
      ? `With no ${c} figure published, hold a quote against ${stateName}'s ${usd(st.avg_submitted_charge)} average submitted charge for the first hour.`
      : `With nothing published for ${c} or ${stateName}, compare hourly rates from two or three clinics directly.`;

  return {
    _generated_by: 'scripts/research/build_neuro_city_research.js',
    _source_city: 'data/research/costs/cms_provider_city_neuro_2024.json (CMS CY2024 by Provider and Service, version-pinned).',
    _source_state: 'data/research/costs/cms_geography_service_2024.json (CMS CY2024 by Geography and Service, version-pinned).',
    _no_clinical_claims: 'No diagnosis, test battery, cut score, outcome or clinical timeline appears in this file.',
    _population_caveat: 'All figures are Medicare fee-for-service. Every generated page states this on its face.',
    _address_caveat: 'City figures are by practice address on the claim, not catchment. Every page that prints one says so.',
    city_slug: city.slug,
    city: c,
    state: stateName,
    state_abbr: ab,
    vertical: 'neuro',

    market_specific_notes: supplyLines(c, ab, stateName),

    cost_comparison_table: costTable(c, ab, stateName),

    local_vetting_points: [
      `Verify the evaluator with the ${stateName} psychology board, not the clinic's own page. ASPPB (asppb.net) lists every state board if you cannot find it.`,
      `Ask whether the clinician who signs the report is the one who administers the tests. Frequently it is not, and both are billed.`,
      // Pinned by multi_vertical_citation_repair_contract.js for neuro cities.
      `${c} neuro provider authority framework: compare evaluation scope, who is licensed to sign the report, hours billed for testing versus interpretation, report purpose and turnaround, and the reimbursement path.`,
      `Work a symptom-to-evaluation-path decision tree before booking: name whether the question is ADHD, autism, a learning disability, memory change, concussion or a broader differential, then confirm the ${c} clinic routinely evaluates that question.`,
    ],

    typical_cost_ranges: costLines(c, ab, stateName),

    payment_options: [
      `Ask which of intake, administration (96136) and interpretation (96132/96133) a ${c} quote covers. They are separate codes and can be separate charges.`,
      `Ask what happens to the fee if testing runs past the estimate, since additional hours bill under their own code.`,
    ],

    wait_time_notes: [
      `Measure the ${c} wait as three intervals — call to intake, intake to testing, testing to written report. Clinics usually quote only the first.`,
      cc
        ? `${num(cc.rendering_providers)} clinicians billing from ${c} addresses and ${st ? `${num(st.rendering_providers)} across ${stateName}` : 'no published state total'} is the closest published proxy for capacity, and capacity is what sets the waitlist.`
        : `With no ${c} practice-address count published, ask each clinic directly for its current waitlist length in weeks.`,
    ],

    availability_notes: [
      `Confirm the person you would see evaluates your age group. Adult and paediatric neuropsychology are different practices, and age-group fit is the usual reason a ${c} referral is redirected after intake.`,
      `Ask which parts can be done remotely: some instruments have no validated remote administration, so a ${stateName} telehealth intake does not imply telehealth testing.`,
    ],

    named_resources_or_providers: [
      `The ${stateName} psychology licensing board is authoritative for whether an evaluator is licensed and in good standing in ${stateName}.`,
      `ASPPB (asppb.net) maintains the directory of state psychology boards.`,
      `CMS publishes the ${c} and ${stateName} figures quoted here at data.cms.gov, under Medicare Physician & Other Practitioners.`,
      `Academic medical centres and university training clinics near ${c} differ from private practice systematically on waitlist, fee and report purpose, so they are worth pricing separately rather than lumping in.`,
      `We do not rank, recommend or endorse providers, and no provider on this site has paid for editorial placement.`,
    ],

    city_intro_override:
      `Choosing a neuropsychological evaluation near ${c} turns on four things: what the evaluation covers, who is ` +
      `licensed to sign the report, how many hours will be billed, and what the report is designed to support. ` +
      (cc
        ? `This page carries the published ${c} figures — ${num(cc.rendering_providers)} clinicians billing Medicare for the service from ${c} addresses` +
          (st ? `, inside a ${stateName} total of ${num(st.rendering_providers)} ranked ${rank} of ${RANK_TOTAL} nationally` : '') +
          ` — so a quote and a waitlist have something real to sit against.`
        : `CMS published no ${c} practice-address figure for the service, which this page says plainly rather than filling in.`),

    primary_city_decision_block: {
      type: 'decision_checklist',
      // Pinned by city_decision_support_contract.js for every neuro city page.
      title: 'City-specific neuro evaluation decision checklist',
      items: [
        `Name the question first — ADHD, autism, learning, memory, concussion or broader differential — and confirm the ${c} clinic routinely handles it.`,
        `Confirm the evaluator with the ${stateName} psychology board, and confirm who signs the report.`,
        `Ask for hours, not a total: 96132 is the first hour and 96133 each hour after, so an hours estimate is the price.`,
        `Say which report purpose you need — 504/IEP, workplace accommodations, treatment planning or medical documentation — before booking.`,
        `Get intake-to-testing and testing-to-report as two separate numbers in writing.`,
        anchor,
      ],
    },

    testing_scope_notes: [
      `Ask whether a ${c} clinic is offering a screening, a diagnostic clarification of one question, or a full battery. Those are different services at different prices, described with the same words.`,
      `Ask what happens if testing suggests the original question was wrong, and whether re-scoping bills as new hours.`,
    ],

    insurance_reimbursement_notes: [
      `Ask which CPT codes a ${c} clinic expects to bill. Asking about 96130, 96132, 96133 and 96136 by number gets a more precise answer than asking whether "testing" is covered.`,
      `Do not assume testing is covered because intake was: intake, administration and interpretation bill separately and plans treat them differently.`,
      st
        ? `The ${usd(st.avg_medicare_allowed)} Medicare-allowed figure above is what one payer permits in ${stateName}. Your plan will allow a different amount; it is a reference point, not your cost share.`
        : `No ${stateName} Medicare-allowed figure is published for this code, so ask your plan directly what it allows.`,
    ],

    adult_vs_child_fit: [
      `Confirm the ${c} evaluator routinely assesses your age group, and that the quoted timeline applies to that age group rather than to the clinic's faster stream.`,
      `The ${c} and ${stateName} figures on this page come from a 65-plus and disabled population. For a child evaluation treat them as evidence about clinician supply, not about what you will be charged.`,
    ],

    report_turnaround_notes: [
      `Ask when the written report arrives, whether the feedback session is before or after it, and whether both sit inside the quoted ${c} fee.`,
      `Ask whether the report carries accommodation-ready language if a school or employer needs it, and whether answering their follow-up questions is billed.`,
    ],

    provider_type_comparison: [
      'board-certified neuropsychologist versus licensed psychologist doing testing',
      'academic medical centre or university training clinic versus private practice',
      'who administers the tests versus who interprets and signs the report',
      'report written for school or accommodations versus for treatment planning',
    ],
  };
}

const cities = CITIES.map((c) => (typeof c === 'string' ? { slug: c } : c));
fs.mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
const noCity = [];
const missingState = [];
for (const city of cities) {
  if (!STATE_NAME[city.state]) { missingState.push(city.slug); continue; }
  if (!cityRow(city.city, city.state, '96132')) noCity.push(city.slug);
  fs.writeFileSync(path.join(OUT_DIR, `${city.slug}.json`), JSON.stringify(build(city), null, 2) + '\n');
  written += 1;
}

const states = [...new Set(cities.map((c) => STATE_NAME[c.state]).filter(Boolean))];
console.log(`build_neuro_city_research: wrote ${written} of ${cities.length} city files to data/city_content/neuro/`);
console.log(`  cities with a published CMS practice-address figure: ${written - noCity.length}`);
if (noCity.length) console.log(`  cities with none, where the page says so and points at the metro: ${noCity.join(', ')}`);
console.log(`  distinct states: ${states.length}; states with a published CMS 96132 office figure: ${states.filter((s) => geoRow('96132', s)).length}`);
if (missingState.length) console.log(`  skipped (no state mapping): ${missingState.join(', ')}`);
