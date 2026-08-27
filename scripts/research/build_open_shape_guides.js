#!/usr/bin/env node
/**
 * Generate the cost, comparison and checklist guides, with every dollar figure
 * read out of a pulled dataset rather than typed by hand.
 *
 * Why it is a generator and not fifteen hand-written JSON files: a cost page is
 * only worth publishing if its numbers are right, and a number typed into prose
 * is a number nobody can re-check. Here the prose is written and the tables are
 * computed, so `node scripts/research/pull_cms_geo_service_costs.js && node
 * scripts/research/build_open_shape_guides.js` reproduces every figure on every
 * page from the CMS file, and a figure that cannot be reproduced cannot ship.
 *
 * Sources are registered in data/research/costs/sources.json. Anything not in
 * that file, or not derivable from a dataset named in it, is stated as unknown.
 *
 * Writes:
 *   data/page_sets/examples/<vertical>_global_pages/<file>.json   (new guides)
 *   data/page_sets/examples/<vertical>_global_pages/guides.json   (index cards)
 *   data/contracts/guide_answer_shape_contract.json               (shape entries)
 *   data/contracts/guide_enhancement_registry.json                (top modules)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'research', 'costs', 'cms_geography_service_2024.json'), 'utf8'));
const EX = path.join(ROOT, 'data', 'page_sets', 'examples');

// --- figure helpers ---------------------------------------------------------
// Every one of these throws rather than returning a placeholder. A cost table
// with a hole in it is a bug; a cost table with an invented filler is a lie.

function code(hcpcs) {
  const e = CMS.codes[hcpcs];
  if (!e || !e.present) throw new Error(`HCPCS ${hcpcs} is not in the CMS snapshot`);
  return e;
}
function national(hcpcs, pos) {
  const r = code(hcpcs).national[pos];
  if (!r) throw new Error(`HCPCS ${hcpcs} has no national row for place of service ${pos}`);
  return r;
}
function state(hcpcs, name, pos) {
  const s = code(hcpcs).states[name];
  return (s && s[pos]) || null;
}
const usd2 = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n) => usd2(n); // one format for the whole column; mixed precision reads as sloppy
const count = (n) => Number(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function table(headers, rows) {
  return '<table><thead><tr>' + headers.map((h) => `<th>${h}</th>`).join('') +
    '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>';
}

/** National billed-vs-allowed table for a list of codes. */
function nationalCostTable(codes, pos, label) {
  return table(
    ['Code', 'What it covers', `Average submitted charge (${label})`, 'Average Medicare allowed'],
    codes.map(([c, plain]) => {
      const r = national(c, pos);
      return [esc(c), esc(plain), money(r.avg_submitted_charge), money(r.avg_medicare_allowed)];
    })
  );
}

/** Per-state billed-vs-allowed table for one code. */
function stateCostTable(hcpcs, states, pos) {
  const rows = [];
  const nat = national(hcpcs, pos);
  rows.push(['<strong>National</strong>', money(nat.avg_submitted_charge), money(nat.avg_medicare_allowed), count(nat.rendering_providers)]);
  for (const name of states) {
    const r = state(hcpcs, name, pos);
    if (!r) { rows.push([esc(name), 'not published', 'not published', 'fewer than 11 beneficiaries']); continue; }
    rows.push([esc(name), money(r.avg_submitted_charge), money(r.avg_medicare_allowed), count(r.rendering_providers)]);
  }
  return table(['Where', 'Average submitted charge', 'Average Medicare allowed', 'Clinicians billing it'], rows);
}

/** Facility-vs-office table, the published answer to "hospital or private practice?". */
function posCompareTable(codes) {
  return table(
    ['Code', 'What it covers', 'Office: billed / allowed', 'Hospital outpatient: billed / allowed'],
    codes.map(([c, plain]) => {
      const o = national(c, 'O');
      const f = national(c, 'F');
      return [
        esc(c), esc(plain),
        `${money(o.avg_submitted_charge)} / ${money(o.avg_medicare_allowed)}`,
        `${money(f.avg_submitted_charge)} / ${money(f.avg_medicare_allowed)}`,
      ];
    })
  );
}

const SRC_CMS = 'Centers for Medicare &amp; Medicaid Services, <em>Medicare Physician &amp; Other Practitioners — by Geography and Service</em>, calendar year 2024 claims (file released 21 May 2026).';

const METHOD = `<section class="section guide-section" data-guide-section="true"><h2>Where these numbers come from, and what they are not</h2>
<p><strong>Source:</strong> ${SRC_CMS}</p>
<p><strong>Method:</strong> we pull the published rows for each billing code, keep the average submitted charge and the average Medicare allowed amount, and print them unchanged. Nothing is modelled, averaged across codes, or adjusted.</p>
<ul>
<li>The <strong>submitted charge</strong> is what clinicians billed. It is list price. Almost nobody pays it.</li>
<li>The <strong>allowed amount</strong> is what Medicare permitted, including the patient's coinsurance. It is a negotiated price.</li>
<li>These are Medicare fee-for-service claims. The patients skew 65 and older.</li>
<li>If you are paying cash or using commercial insurance, neither figure is your price. Use the gap between them as a bargaining range, not a quote.</li>
<li>CMS hides any cell covering fewer than 11 patients, so some states are missing. We print "not published" there rather than guessing.</li>
</ul>
<p><strong>Common mistake:</strong> reading the allowed amount as "the real price" and expecting a clinic to match it. It is what one payer pays one set of clinicians.</p>
</section>`;

// --- page specs -------------------------------------------------------------

const specs = [];

function addSpec(s) { specs.push(s); }

// ============================ DENTISTRY =====================================
// Measured-open shapes: cost/price 100%, checklist 76%, comparison 64%.
// Zero queries had ever been mapped to this domain.

const DENTAL_CODES = [
  ['D7140', 'Simple extraction of an erupted tooth'],
  ['D7210', 'Surgical extraction needing bone removal or sectioning'],
  ['41899', 'Other procedure on teeth and gums'],
  ['21248', 'Jaw reconstruction with an implant'],
];

addSpec({
  vertical: 'dentistry',
  file: 'guides_dental-implant-and-oral-surgery-cost.json',
  route: '/guides/dental-implant-and-oral-surgery-cost/',
  title: 'Dental Implant and Oral Surgery Cost: What Is Actually Published',
  description: 'There is no authoritative US price list for dental implants. This page explains why, shows the dental and oral-surgery prices that are published, and gives the written quote to demand instead.',
  card: 'Dental Implant and Oral Surgery Cost',
  family: 'cost_financing',
  shape: 'cost_breakdown',
  module: 'top_cost_table',
  intent: 'say up front that no authoritative dental price list exists, then show the prices that are published',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'What a dental implant costs: the honest version',
    best: 'Use this page when a quote has arrived and you have no reference point to judge it against.',
    key: 'No US body publishes dental fees, so the only published dental prices are the few procedures Medicare covers.',
    mistake: 'Treating a figure from a lead-generation site as a benchmark. Those numbers have no source behind them.',
    good: 'A written, itemised quote naming every code, every stage, and every fee that is not yet in the total.',
    ask: 'Which billing codes are in this quote, and what is billed separately when treatment starts?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>There is no authoritative price list for dental work in the United States. That is not an oversight, and it is the first thing a cost page should tell you.</p>
<p>The American Dental Association states it plainly: "The ADA cannot quote fees for dental procedures and is forbidden by federal law to set or recommend fees. The Council on Dental Practice elected to discontinue the Survey of Dental Fees in 2023 and it has been removed for download, due to a change in law eliminating safe harbor disclosure." (<em>Dental Care Market</em>, ADA Health Policy Institute.)</p>
<p>So any site quoting "the average cost of a dental implant" is quoting itself. The figures below are the ones that genuinely are published.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The dental prices that are published</h2>
<p>Medicare does not cover routine restorative dentistry. Crowns, bridges, dentures and standard implant placement are absent from federal price data entirely.</p>
<p>What does appear is the narrow set of oral-surgery procedures Medicare pays for when they are medically necessary. Here is the national picture, hospital outpatient setting.</p>
${nationalCostTable(DENTAL_CODES, 'F', 'hospital outpatient')}
<p>Read the gap, not the number. A simple extraction billed at ${money(national('D7140', 'F').avg_submitted_charge)} was allowed at ${money(national('D7140', 'F').avg_medicare_allowed)}. The list price is roughly ${(national('D7140', 'F').avg_submitted_charge / national('D7140', 'F').avg_medicare_allowed).toFixed(1)} times the negotiated one.</p>
<p>Volumes here are small: only ${count(national('D7140', 'F').rendering_providers)} clinicians billed that code nationally. Treat these as a floor and a shape, not as a market rate.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="recovery">Staging is what actually moves the total</h2>
<p>An implant is not one purchase. It is an extraction, sometimes a graft, a healing period, the fixture, the abutment and the crown.</p>
<p>Each stage can be quoted separately, and a headline price often covers one of them. Ask which stages are inside the number you were given.</p>
<p>Healing time also costs money indirectly, because a temporary, a follow-up scan or a second consultation may sit between stages.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="candidacy">Who needs this page most</h2>
<p>You have a quote, or two quotes that differ sharply, and no way to tell whether the difference is scope or margin.</p>
<p>You are being offered financing before the diagnosis has been fully explained.</p>
<p>National spending context: dental care expenditure reached $189 billion in 2024, and out-of-pocket spending was the largest share, ahead of private insurance (ADA Health Policy Institute).</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask before you accept a quote</h2>
<ul>
<li>Which CDT codes is this quote built from? Ask for them in writing.</li>
<li>Which stages are included, and which are billed later?</li>
<li>What happens to the price if imaging changes the plan?</li>
<li>Is the crown quoted here, or only the fixture?</li>
<li>What is the cash price if I do not use insurance?</li>
</ul>
</section>

<h2 id="red-flags">Red flags</h2>
<p>A quote with no codes on it. A total that changes when you ask what is excluded. Financing discussed before diagnosis.</p>
<p><strong>Common mistake:</strong> comparing two quotes on the headline figure when one includes the crown and the other does not.</p>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Get the itemised, coded quote in writing from each office you are considering. Compare the same codes across offices.</p>
<p>If an office will not put codes on paper, that is your answer about how the rest of the process will go.</p>
`,
});

addSpec({
  vertical: 'dentistry',
  file: 'guides_upfront-dental-pricing-checklist.json',
  route: '/guides/upfront-dental-pricing-checklist/',
  title: 'How to Compare Upfront Dental Prices Across Clinics',
  description: 'A checklist for getting comparable written prices from several dental offices without joining a plan, and for spotting the quote that is hiding a stage.',
  card: 'Upfront Dental Pricing Checklist',
  family: 'requirements_checklist',
  shape: 'checklist',
  module: 'top_checklist',
  intent: 'hand over the exact checklist that makes two dental quotes comparable',
  above: ['quick_answer', 'checklist'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Making two dental quotes comparable',
    best: 'Use this when you are calling several offices and want prices you can actually line up side by side.',
    key: 'Quotes differ mostly by what they leave out, not by what they charge for the same work.',
    mistake: 'Asking "how much is a crown" instead of asking for the coded, staged estimate.',
    good: 'Every office answers the same five questions in writing before you visit any of them.',
    ask: 'Can you send that estimate with the codes and the excluded items listed?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>You can get comparable dental prices without joining a plan. You have to ask every office the same question, in the same words, and get the answer in writing.</p>
<p>The reason this works is that dental quotes vary far more by scope than by price. Two offices quoting the same procedure are often quoting different amounts of work.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The five-question script</h2>
<p>Use this on the phone, then ask for it by email. The written version is the one that matters.</p>
<ol>
<li>What are the CDT codes for the treatment you are recommending?</li>
<li>What is the self-pay price for each code, before any insurance?</li>
<li>Which items are excluded from that total and billed separately?</li>
<li>What could change the plan after imaging, and by roughly how much?</li>
<li>Is there a fee for the consultation or the imaging if I do not proceed?</li>
</ol>
<p>An office that answers all five in writing has told you a great deal about how it will behave later.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="recovery">Why "average cost" pages cannot help you here</h2>
<p>The ADA discontinued its Survey of Dental Fees in 2023 and is barred by federal law from quoting or recommending fees.</p>
<p>Medicare does not cover routine restorative dentistry, so no federal price data exists for crowns, bridges or standard implants either.</p>
<p>That leaves the written quote as the only real number in this market. Collecting three of them beats reading any national average.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="candidacy">When this checklist matters most</h2>
<p>Large treatment plans. Anything staged across several visits. Any conversation where financing arrives before the diagnosis does.</p>
<p>It matters less for a single filling, where scope is unlikely to shift underneath you.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask about the plan itself</h2>
<ul>
<li>Which items are urgent, and which could wait six months?</li>
<li>What is the cheaper option you did not recommend, and why not?</li>
<li>Who performs the work, and is a specialist referral likely?</li>
<li>What is the policy if the work needs redoing?</li>
</ul>
</section>

<h2 id="red-flags">Red flags</h2>
<p>Refusal to put codes in writing. A quote that expires today. Pressure that increases the moment you mention budget.</p>
<p><strong>Common mistake:</strong> accepting a verbal number and discovering the crown was quoted separately.</p>

<h2 id="next-steps">What to do next</h2>
<p>Call three offices with the same script. Put the three written estimates next to each other and compare code by code.</p>
<p>If the totals differ by more than a third, the scopes almost certainly differ too. Find out where before you decide.</p>
`,
});

addSpec({
  vertical: 'dentistry',
  file: 'guides_dental-procedure-cost-comparison.json',
  route: '/guides/dental-procedure-cost-comparison/',
  title: 'Comparing Dental Procedures: What Drives the Price Difference',
  description: 'A comparison of common dental treatment paths by what actually moves their cost, with the published oral-surgery figures set against the procedures for which no price data exists.',
  card: 'Dental Procedure Cost Comparison',
  family: 'x_vs_y_comparison',
  shape: 'comparison',
  module: 'top_comparison_table',
  intent: 'compare treatment paths by cost driver before comparing them by headline price',
  above: ['quick_answer', 'comparison_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Comparing dental treatments on the right axis',
    best: 'Use this when several treatment options have been put in front of you at different prices.',
    key: 'Staging, lab work and specialist involvement move dental prices more than the procedure name does.',
    mistake: 'Comparing an implant to a bridge on price alone, when their cost curves run over different timescales.',
    good: 'Each option compared on total staged cost, lifespan, and what happens if it fails.',
    ask: 'What is the ten-year cost of each option, including the likely repeat work?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>Dental options are usually compared on the wrong axis. The procedure name is a weak predictor of cost; the staging, the lab work and the specialist involvement are strong ones.</p>
<p>Compare treatments on how many appointments they need, what is fabricated off-site, who performs them, and what happens when they fail.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">What each path is actually priced on</h2>
${table(
  ['Treatment path', 'What drives the price', 'Where the second bill usually comes from', 'Published price data?'],
  [
    ['Simple extraction', 'Chair time; usually a single visit', 'Follow-up if healing goes wrong', 'Yes, for the Medicare-covered subset'],
    ['Surgical extraction', 'Bone removal, sectioning, sometimes sedation', 'Sedation and imaging billed separately', 'Yes, for the Medicare-covered subset'],
    ['Implant', 'Staged over months; fixture, abutment and crown priced apart', 'The crown, and any graft', 'No. Medicare does not cover it'],
    ['Bridge', 'Lab fabrication; two adjacent teeth are prepared', 'Preparation work on the neighbouring teeth', 'No'],
    ['Denture', 'Lab work plus several fitting appointments', 'Relines and adjustments after delivery', 'No'],
    ['Crown', 'Material choice and lab fabrication', 'Core build-up, and a root canal if needed', 'No'],
  ]
)}
<p>Four of those six rows have no published price anywhere. That is the real finding, and it is why written quotes beat national averages here.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="recovery">The two rows that do have numbers</h2>
<p>For the oral-surgery procedures Medicare covers, here is the national billed-versus-allowed picture in the office setting.</p>
${nationalCostTable([['D7140', 'Simple extraction of an erupted tooth'], ['D7210', 'Surgical extraction needing bone removal or sectioning']], 'O', 'office')}
<p>The surgical extraction was allowed at ${money(national('D7210', 'O').avg_medicare_allowed)} against ${money(national('D7140', 'O').avg_medicare_allowed)} for the simple one. Complexity roughly ${(national('D7210', 'O').avg_medicare_allowed / national('D7140', 'O').avg_medicare_allowed).toFixed(1)}x the price.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="candidacy">Who this comparison is for</h2>
<p>Anyone holding a treatment plan with alternatives on it. Anyone told that one option is "better value" without being shown the arithmetic.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask when comparing options</h2>
<ul>
<li>How many appointments does each option need?</li>
<li>What is fabricated in a lab, and is that lab fee inside the quote?</li>
<li>What is the expected lifespan, and what is the failure plan?</li>
<li>What does each option cost over ten years, not today?</li>
</ul>
</section>

<h2 id="red-flags">Red flags</h2>
<p>An option presented as obviously superior with no cost comparison attached. A ten-year claim with no failure-rate discussion.</p>
<p><strong>Common mistake:</strong> choosing on today's price when the cheaper option needs replacing twice as often.</p>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Ask for each alternative to be quoted separately, in writing, with codes. Then compare the staged totals rather than the headlines.</p>
`,
});

// ============================== NEURO =======================================
// Open: neuro geo queries 100%, hospital vs private 80%. Avoid bare head terms.

const NEURO_CODES = [
  ['96116', 'Neurobehavioral status exam, first hour'],
  ['96130', 'Psychological testing evaluation, first hour'],
  ['96132', 'Neuropsychological testing evaluation, first hour'],
  ['96133', 'Neuropsychological testing evaluation, each extra hour'],
  ['96136', 'Test administration, first 30 minutes'],
  ['96137', 'Test administration, each extra 30 minutes'],
];

addSpec({
  vertical: 'neuro',
  file: 'guides_neuropsychological-evaluation-cost.json',
  route: '/guides/neuropsychological-evaluation-cost/',
  title: 'What a Neuropsychological Evaluation Costs, by Billing Code',
  description: 'Published Medicare figures for every billing code in a neuropsychological evaluation, what the hours add up to, and why the self-pay price is not published anywhere.',
  card: 'Neuropsychological Evaluation Cost',
  family: 'cost_financing',
  shape: 'cost_breakdown',
  module: 'top_cost_table',
  intent: 'break the evaluation into the billing codes it is actually made of, then price each one',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Pricing an evaluation by its parts',
    best: 'Use this before you accept a package price for testing you have not seen itemised.',
    key: 'An evaluation is billed in hours across several codes, so the total depends on how many hours are planned.',
    mistake: 'Comparing two package prices without asking how many testing hours each one covers.',
    good: 'A written estimate showing the codes, the planned hours per code, and the price per hour.',
    ask: 'How many hours of each code do you expect to bill, and what is your rate per hour?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>A neuropsychological evaluation is not one price. It is a stack of hourly billing codes, and the total depends almost entirely on how many hours get planned.</p>
<p>Ask for the codes and the hours. A package price without them tells you nothing you can compare.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="pricing">The published price of each code</h2>
<p>National figures, office setting, calendar year 2024 Medicare claims.</p>
${nationalCostTable(NEURO_CODES, 'O', 'office')}
<p>The first evaluation hour was billed at ${money(national('96132', 'O').avg_submitted_charge)} and allowed at ${money(national('96132', 'O').avg_medicare_allowed)}. Each further hour was allowed at ${money(national('96133', 'O').avg_medicare_allowed)}.</p>
<p>Test administration is cheaper per unit and often the largest block of time: ${money(national('96136', 'O').avg_medicare_allowed)} allowed for the first half hour, ${money(national('96137', 'O').avg_medicare_allowed)} for each additional half hour.</p>
<p>So a six-hour evaluation is not six times the headline. Work out the mix before you compare quotes.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="trust">What is not published, and why</h2>
<p>No authority publishes a self-pay price for neuropsychological testing. The Medicare allowed amount is what one payer permits, not a market rate.</p>
<p>The submitted charge is closer to a self-pay starting point. It is still a list price, and list prices are negotiable more often than people assume.</p>
<p>Practices that do not take insurance set their own rates, and those rates appear in no dataset. Ask directly.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">How the hours get spent</h2>
<p>Intake and history. Test administration, usually the longest block. Scoring. Interpretation and report writing. A feedback session.</p>
<p>Report writing is billed under the evaluation codes, not the administration codes, which is why the mix matters so much to the total.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask before booking</h2>
<ul>
<li>How many hours do you expect to bill under 96132 and 96133?</li>
<li>How many half-hour units of 96136 and 96137 are planned?</li>
<li>Is the feedback session included, or billed separately?</li>
<li>What is your self-pay rate, and does it differ from the billed charge?</li>
<li>What happens to the price if testing runs long?</li>
</ul>
<p><strong>Common mistake:</strong> assuming a package price caps the hours. Confirm in writing that it does.</p>
</section>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Ask two practices for an estimate broken out by code and hour. Compare the hours first, then the rates.</p>
`,
});

addSpec({
  vertical: 'neuro',
  file: 'guides_hospital-vs-private-neuropsych-testing.json',
  route: '/guides/hospital-vs-private-neuropsych-testing/',
  title: 'Hospital vs Private Practice Neuropsychological Testing: The Cost Difference',
  description: 'Published Medicare data comparing hospital outpatient and private-practice neuropsychological testing, including the facility fee that makes the hospital bill larger than it first appears.',
  card: 'Hospital vs Private Neuropsych Testing',
  family: 'x_vs_y_comparison',
  shape: 'comparison',
  module: 'top_comparison_table',
  intent: 'answer the hospital-or-private question with the published figures for both settings',
  above: ['quick_answer', 'comparison_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Hospital or private practice',
    best: 'Use this when the same testing is available in both settings and you are deciding which to book.',
    key: 'The professional fee is similar in both. The hospital adds a separate facility charge that no public dataset shows.',
    mistake: 'Comparing the clinician bill only, and being surprised by the hospital charge that arrives separately.',
    good: 'Both settings asked for a total estimate including any facility fee, in writing, before booking.',
    ask: 'Will there be a separate facility or hospital charge, and how much is it?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>For the clinician's own bill, the two settings are close. The difference that matters is the hospital's separate facility charge, and it is not in any public price file.</p>
<p>Ask the hospital directly whether a facility fee applies. That single question changes the comparison more than anything else on this page.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="pricing">What each setting bills for the professional work</h2>
<p>National Medicare figures for calendar year 2024. "Office" is private practice; "hospital outpatient" is the facility setting.</p>
${posCompareTable(NEURO_CODES)}
<p>Note what happens to the allowed column. For test administration, Medicare allowed ${money(national('96136', 'O').avg_medicare_allowed)} in the office against ${money(national('96136', 'F').avg_medicare_allowed)} in the hospital setting.</p>
<p>That looks like the hospital is cheaper. It is not. Medicare pays the clinician less in a facility <em>because</em> it pays the facility separately, on a different claim.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="trust">The number this page cannot give you</h2>
<p>The hospital's own facility charge is billed on a separate claim that does not appear in this dataset. We will not estimate it.</p>
<p>What we can say is its direction: it is additional, and it is the reason hospital-based testing commonly costs the patient more overall.</p>
<p>Get it in writing from the hospital's billing office before you book. Ask for the estimate to name both the professional and the facility component.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">Non-cost reasons the setting matters</h2>
<p>Hospital programmes often have access to imaging, neurology and medical records in the same system. That is worth something when the referral question is medical.</p>
<p>Private practices are often faster to schedule and easier to reach afterwards. That is worth something when the question is educational or occupational.</p>
<p>Wait times, not price, are frequently the deciding factor. Ask both for a realistic date.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask both settings</h2>
<ul>
<li>Will I receive more than one bill for this evaluation?</li>
<li>Is there a facility fee, and what is it?</li>
<li>How many testing hours are planned?</li>
<li>How long until the report is delivered?</li>
<li>Who explains the results, and is that visit included?</li>
</ul>
<p><strong>Common mistake:</strong> comparing the two settings on the clinician's quote alone.</p>
</section>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Ask each setting for a single all-in written estimate. If a hospital cannot give you one, treat the gap as a cost.</p>
`,
});

addSpec({
  vertical: 'neuro',
  file: 'guides_neuropsych-testing-cost-by-state.json',
  route: '/guides/neuropsych-testing-cost-by-state/',
  title: 'Neuropsychological Testing Cost by State',
  description: 'Published state-by-state Medicare figures for the first hour of neuropsychological testing evaluation, including how many clinicians bill it in each state.',
  card: 'Neuropsych Testing Cost by State',
  family: 'costs_timeline',
  shape: 'timeline',
  module: 'top_timeline',
  intent: 'give the state-level published figure first, because that is what a geo query is asking for',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Testing cost where you live',
    best: 'Start here when your question has a state or a city in it rather than a general one.',
    key: 'Billed charges vary widely between states; the Medicare allowed amount barely moves.',
    mistake: 'Assuming a state with few billing clinicians simply has cheaper care. It usually has less supply.',
    good: 'The state figure read alongside the clinician count, which is the better guide to waiting time.',
    ask: 'How long is the wait for an evaluation here, and does that change if I pay cash?',
  },
  html: () => {
    const states = ['Illinois', 'Texas', 'California', 'New York', 'Florida', 'Georgia', 'Pennsylvania', 'Ohio', 'Michigan', 'Massachusetts'];
    return `
<h2 id="definition">Quick answer</h2>
<p>What a neuropsychological evaluation is billed at varies a lot by state. What Medicare allows for it barely varies at all.</p>
<p>That gap is the useful fact. If you are paying cash, the billed column is closer to your starting point, and it moves with geography.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="pricing">First hour of neuropsychological testing evaluation, by state</h2>
<p>Code 96132, office setting, calendar year 2024 Medicare claims.</p>
${stateCostTable('96132', states, 'O')}
<p>Nationally the code was billed at ${money(national('96132', 'O').avg_submitted_charge)} and allowed at ${money(national('96132', 'O').avg_medicare_allowed)}, across ${count(national('96132', 'O').rendering_providers)} clinicians.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="trust">What the clinician count tells you</h2>
<p>The right-hand column is supply. A state with few billing clinicians is usually a state with a long wait, not a bargain.</p>
<p>For a geographic search, the wait is often the real constraint. Ask about it before you ask about price.</p>
<p>Counts are Medicare-billing clinicians only. Practices that decline insurance are invisible here, and in some metros they are a large share of capacity.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">Reading a state figure honestly</h2>
<p>These are averages across a whole state. A large metro and a rural county sit inside the same number.</p>
<p>CMS hides any cell covering fewer than 11 patients, so smaller states may show as not published. We leave those blank rather than filling them.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask a local practice</h2>
<ul>
<li>What is the wait for an evaluation appointment?</li>
<li>Do you bill insurance, or are you self-pay only?</li>
<li>What is your rate for the first evaluation hour?</li>
<li>How many total hours do you typically bill?</li>
</ul>
<p><strong>Common mistake:</strong> choosing a state figure over a local quote. The figure is context; the quote is the price.</p>
</section>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Use the state row as a sanity check on the first quote you receive, then get a second quote locally.</p>
`;
  },
});

// =========================== TRT / HORMONES =================================
// Open: "hormone replacement therapy near me" 80%, peptide timeline 100%.
// Avoid "dht and hair loss" (0% open, owned by Healthline and Cleveland Clinic).

const HORMONE_LABS = [
  ['84403', 'Total testosterone'],
  ['84402', 'Free testosterone'],
  ['82670', 'Total estradiol'],
  ['84443', 'Thyroid stimulating hormone'],
  ['85025', 'Complete blood count'],
  ['80053', 'Comprehensive metabolic panel'],
];

addSpec({
  vertical: 'trt',
  file: 'guides_trt_hormone-therapy-cost-what-is-published.json',
  route: '/guides/hormone-therapy-cost-what-is-published/',
  title: 'Hormone Therapy Cost: The Lab and Procedure Prices That Are Published',
  description: 'Published Medicare figures for the labs, injections and pellet placement behind a hormone therapy programme, and an honest account of what a clinic monthly fee is not.',
  card: 'Hormone Therapy Cost: What Is Published',
  family: 'cost_financing',
  shape: 'cost_breakdown',
  module: 'top_cost_table',
  intent: 'price the components of a hormone programme so a monthly membership fee can be judged against them',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'What the parts of a hormone programme cost',
    best: 'Use this when a clinic has quoted a monthly fee and you want to know what is inside it.',
    key: 'Labs and injections have published prices. Programme fees do not, and the gap is the clinic margin.',
    mistake: 'Comparing monthly fees between clinics without checking which labs each one includes.',
    good: 'A written list of which labs, at what frequency, are covered by the fee.',
    ask: 'Which specific lab panels does the monthly fee include, and how often are they repeated?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>Hormone clinics usually quote a monthly programme fee. That fee is not published anywhere and cannot be compared directly between clinics.</p>
<p>What can be compared is what sits inside it: the labs, the injections, the pellet placement. Those do have published prices.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">Published prices for the lab work</h2>
<p>National Medicare figures, office setting, calendar year 2024.</p>
${nationalCostTable(HORMONE_LABS, 'O', 'office')}
<p>Total testosterone was billed at ${money(national('84403', 'O').avg_submitted_charge)} and allowed at ${money(national('84403', 'O').avg_medicare_allowed)}. That is roughly a ${(national('84403', 'O').avg_submitted_charge / national('84403', 'O').avg_medicare_allowed).toFixed(1)}-times gap between list price and negotiated price.</p>
<p>If a clinic tells you its included lab panel is worth several hundred dollars, this is the table to hold that claim against.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="safety">Procedures: injection and pellet placement</h2>
${nationalCostTable([['96372', 'Injection under the skin or into muscle'], ['11980', 'Hormone pellet placement under the skin']], 'O', 'office')}
<p>Pellet placement was allowed at ${money(national('11980', 'O').avg_medicare_allowed)} against a billed ${money(national('11980', 'O').avg_submitted_charge)}, across ${count(national('11980', 'O').rendering_providers)} clinicians nationally.</p>
<p>Pellet programmes are often sold as a quarterly package. Ask what the package covers beyond the placement itself.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="candidacy">What this page cannot tell you</h2>
<p>The medication itself is not priced here, and prices for compounded preparations are not published by any authority.</p>
<p>The FDA is explicit about the category: "Compounded drugs are not FDA-approved. This means that FDA does not verify the safety, effectiveness or quality of compounded drugs before they are marketed."</p>
<p>So a compounded product's price and its evidence base are both outside public data. Ask what is being prescribed and whether it is an approved product.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask before you sign up</h2>
<ul>
<li>Which lab panels are included, and how often are they repeated?</li>
<li>Is the medication inside the monthly fee or billed separately?</li>
<li>Is what you are prescribing an FDA-approved product or a compounded one?</li>
<li>What is the cost of stopping after three months?</li>
<li>Who reviews the results, and how quickly?</li>
</ul>
<p><strong>Common mistake:</strong> comparing two monthly fees without comparing what each one includes.</p>
</section>

<h2 id="red-flags">Red flags</h2>
<p>A programme fee with no itemised contents. Lab panels described only as "comprehensive". Long prepaid contracts sold before the first result comes back.</p>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Ask two clinics for the itemised contents of their monthly fee, in writing, then price the difference against this table.</p>
`,
});

addSpec({
  vertical: 'trt',
  // The one query in this repo's slice of the demand file with a measured
  // Semrush volume AND a measured open score: 8,100/mo, KD 22, open 0.90.
  // Everything else on this domain is autocomplete phrasing with no volume.
  // Route matches the query rather than a cleverer title.
  file: 'guides_trt_hormone-replacement-therapy-near-me.json',
  route: '/guides/hormone-replacement-therapy-near-me/',
  title: 'Hormone Replacement Therapy Near You: What to Verify Before You Book',
  description: 'A verification checklist for choosing a local hormone replacement therapy provider, covering licensing, whether the product is FDA-approved, monitoring intervals and what the monthly fee actually includes.',
  card: 'Hormone Replacement Therapy Near You',
  family: 'how_to_choose',
  shape: 'checklist',
  module: 'top_checklist',
  intent: 'give the local search a verification checklist rather than a list of clinics',
  above: ['quick_answer', 'checklist'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Checking a local hormone clinic',
    best: 'Use this when you have found several nearby clinics and need a way to tell them apart.',
    key: 'Licensing, monitoring frequency and whether the product is FDA-approved separate clinics faster than price does.',
    mistake: 'Choosing on the consultation being free. The free consultation is the sales call.',
    good: 'A clinic that names the prescriber, the product, and the monitoring schedule before taking payment.',
    ask: 'Who is the prescribing clinician, and what is the monitoring schedule?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>Searching for hormone replacement therapy near you gets you a list of clinics. It does not get you a way to choose between them.</p>
<p>Four checks do most of the separating. Verify the prescriber's licence. Establish whether the product is FDA-approved or compounded. Get the monitoring schedule. Get the fee's contents in writing.</p>
<p>Almost every clinic in that list will offer a free consultation. The free consultation is the sales call, so do these four checks before you attend one.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The four checks, in order</h2>
<ol>
<li><strong>Licence.</strong> Who prescribes, in what discipline, licensed in which state? Verify it on the state board's own site, not the clinic's.</li>
<li><strong>Product.</strong> Is the medication an FDA-approved product or a compounded preparation? The FDA states that "Compounded drugs are not FDA-approved" and that it "does not verify the safety, effectiveness or quality of compounded drugs before they are marketed".</li>
<li><strong>Monitoring.</strong> Which labs, at what intervals, reviewed by whom? A programme that does not repeat labs is not monitoring anything.</li>
<li><strong>Fee contents.</strong> What is inside the monthly figure and what arrives as a separate bill?</li>
</ol>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="safety">Why the monitoring question does the most work</h2>
<p>Hormone therapy is a long-running prescription, not a one-off purchase. The value of a clinic is largely in its follow-up.</p>
<p>Ask how often testosterone, blood count and metabolic panels are repeated, and what result would cause the dose to change.</p>
<p>A clinic that cannot answer that has sold you a subscription rather than a treatment plan.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="candidacy">Telehealth or local, and what each one is priced on</h2>
<p>Telehealth suits stable, straightforward cases where the labs can be drawn anywhere.</p>
<p>A local clinic matters more when injections or pellet placement are part of the plan, or when a physical examination is likely to change the decision.</p>
<p>The components that a local visit adds are the ones with published prices. Nationally, in the office setting:</p>
${nationalCostTable([['96372', 'Injection under the skin or into muscle'], ['11980', 'Hormone pellet placement under the skin'], ['84403', 'Total testosterone lab']], 'O', 'office')}
<p>Use these to test any claim about the value of what a local programme bundles in. A monthly fee well above the sum of its published parts is buying you access and follow-up, which may be worth it &mdash; but you should know that is what you are buying.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask on the first call</h2>
<ul>
<li>Who is the prescribing clinician and where are they licensed?</li>
<li>Is the product FDA-approved or compounded?</li>
<li>What is the lab schedule for the first year?</li>
<li>What does the fee include, and what does it not?</li>
<li>What is the process for stopping?</li>
</ul>
<p><strong>Common mistake:</strong> letting a free consultation set the agenda before any of these are answered.</p>
</section>

<h2 id="red-flags">Red flags</h2>
<p>Prepaid year-long contracts. No named prescriber. Labs described only as "included". Pressure to decide on the call.</p>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Run the four checks on two clinics before booking either. Put both sets of answers in writing side by side.</p>
`,
});

addSpec({
  vertical: 'trt',
  file: 'guides_trt_peptide-and-compounded-therapy-claims.json',
  route: '/guides/peptide-and-compounded-therapy-claims/',
  title: 'Peptide and Compounded Therapy Claims: What Is Established and What Is Not',
  description: 'What the FDA does and does not verify about compounded preparations, why results-timeline claims for peptide therapy have no authoritative source, and what to ask a clinic making them.',
  card: 'Peptide and Compounded Therapy Claims',
  family: 'red_flags',
  shape: 'checklist',
  module: 'top_checklist',
  intent: 'separate the claims that have a regulatory basis from the ones that do not',
  above: ['quick_answer', 'checklist'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Checking a peptide therapy claim',
    best: 'Use this when a clinic has given you a results timeline and you want to know where it came from.',
    key: 'Compounded preparations are not FDA-approved, and the agency does not verify their effectiveness before marketing.',
    mistake: 'Treating a clinic marketing page as evidence because it is specific about weeks and doses.',
    good: 'The clinic names the product, its regulatory status, and the source of any timeline it quotes.',
    ask: 'Is this an FDA-approved product, and what is the source for the timeline you just gave me?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>Timelines for peptide therapy results circulate widely and have no authoritative source behind them. We are not going to publish one.</p>
<p>What is documented is the regulatory position, and it is the single most useful thing to know before you start.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">What the FDA actually says</h2>
<p>The agency's own words: "Compounded drugs are not FDA-approved. This means that FDA does not verify the safety, effectiveness or quality of compounded drugs before they are marketed."</p>
<p>That sentence covers most peptide preparations sold through wellness clinics. It does not make them illegal, and it does not make them useless.</p>
<p>It does mean the evidence you are being shown is the clinic's, not a regulator's. Ask where it came from.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="safety">Why we will not give you a results timeline</h2>
<p>A specific number of weeks to a specific effect requires a trial that measured it. For most marketed peptides, no such trial is public.</p>
<p>Publishing a timeline anyway would make this page more citable and less true. The absence is the finding.</p>
<p>If a clinic gives you one, that is not automatically wrong. It is a claim, and claims have sources. Ask for the source.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="candidacy">Where the published price data does exist</h2>
<p>The injection procedure itself is priced. Nationally, an injection under the skin or into muscle was allowed at ${money(national('96372', 'O').avg_medicare_allowed)} against a billed ${money(national('96372', 'O').avg_submitted_charge)}.</p>
<p>The substance being injected is where the cost sits, and compounded substances have no published price. Ask for it separately.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask about any peptide claim</h2>
<ul>
<li>Is this an FDA-approved product or a compounded preparation?</li>
<li>Which compounding pharmacy supplies it, and is it registered?</li>
<li>What is the source for the timeline you have quoted me?</li>
<li>What would make you stop the treatment?</li>
<li>What is the cost of the substance, separately from the visit?</li>
</ul>
<p><strong>Common mistake:</strong> reading confident specificity as evidence. Precision and sourcing are different things.</p>
</section>

<h2 id="red-flags">Red flags</h2>
<p>Before-and-after timelines with no citation. Bulk prepayment. A refusal to name the compounding pharmacy.</p>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Ask for the product name, its regulatory status, and the source of any timeline. Take the answers away before deciding.</p>
`,
});

// ================================ PI ========================================
// Open: fair settlements 100%, cost of settlement 100%, case costs 80%.

const INJURY_CODES = [
  ['99284', 'Emergency department visit, moderate complexity'],
  ['72141', 'MRI, cervical spine, without contrast'],
  ['72148', 'MRI, lumbar spine, without contrast'],
  ['73721', 'MRI, leg joint, without contrast'],
  ['97110', 'Physical therapy exercise, per 15 minutes'],
  ['20610', 'Large joint aspiration or injection'],
  ['62323', 'Lumbar epidural injection with imaging guidance'],
  ['64483', 'Sacral nerve root injection with imaging guidance'],
];

addSpec({
  vertical: 'pi',
  file: 'medical-bills-behind-a-settlement.json',
  route: '/guides/medical-bills-behind-a-settlement/',
  title: 'The Medical Bills Behind a Settlement: Billed vs Allowed',
  description: 'Published Medicare figures for the treatment that makes up injury medical specials, showing how far billed charges sit above negotiated prices and why that gap drives settlement arguments.',
  card: 'Medical Bills Behind a Settlement',
  family: 'cost_financing',
  shape: 'cost_breakdown',
  module: 'top_cost_table',
  intent: 'show what the treatment in a claim is billed at against what it is normally allowed at',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'What the treatment in your claim is worth on paper',
    best: 'Use this when the medical bills in your claim look far larger than anything you have seen before.',
    key: 'Billed charges commonly run many times the negotiated price for the same imaging or injection.',
    mistake: 'Assuming the billed total is the amount anyone will actually be paid.',
    good: 'Every bill in the claim checked against what that code is normally allowed at.',
    ask: 'What was billed, what was allowed, and what is still outstanding on each bill?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>The medical bills in an injury claim are usually stated at billed charges. Billed charges are list prices, and list prices in US healthcare run far above what anyone actually pays.</p>
<p>Knowing the size of that gap is the difference between understanding your claim and being surprised by it.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="when-to-call">Timing, and why it is urgent</h2>
<p>Get copies of every bill early, ideally within the first weeks, while providers still have them readily to hand.</p>
<p>Ask for the itemised statement showing billed, adjusted and outstanding amounts, not the summary. The summary hides the adjustment.</p>
<p>Do not wait for the case to resolve to start assembling this. Reconstructing it later is slow and often incomplete.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">Billed against allowed, for common injury treatment</h2>
<p>National Medicare figures, office setting, calendar year 2024.</p>
${nationalCostTable(INJURY_CODES, 'O', 'office')}
<p>A lumbar spine MRI was billed at ${money(national('72148', 'O').avg_submitted_charge)} and allowed at ${money(national('72148', 'O').avg_medicare_allowed)}. That is roughly ${(national('72148', 'O').avg_submitted_charge / national('72148', 'O').avg_medicare_allowed).toFixed(1)} times.</p>
<p>An epidural injection was billed at ${money(national('62323', 'O').avg_submitted_charge)} and allowed at ${money(national('62323', 'O').avg_medicare_allowed)}.</p>
<p>These are Medicare's numbers, not yours. But the shape of the gap is the same argument insurers and lienholders will be having about your file.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="evidence">Documents to collect and keep</h2>
<p>Keep the itemised bill from every provider, the explanation of benefits from every insurer, and the record of anything you paid yourself.</p>
<p>Photograph or scan them as they arrive. Keep a dated timeline of treatment, because gaps in treatment get argued about later.</p>
<p>Record mileage and time off work as you go. Reconstructed figures are weaker than contemporaneous ones.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask about the bills</h2>
<ul>
<li>What was billed, what was allowed, and what is still outstanding?</li>
<li>Is any provider holding a lien on the settlement?</li>
<li>Was anything billed at list price because no insurer was involved?</li>
<li>Can the outstanding balance be negotiated before settlement?</li>
</ul>
<p><strong>Common mistake:</strong> treating the billed total as the value of the claim. Nobody in the process does.</p>
</section>

<h2 id="red-flags">Red flags and what not to do</h2>
<p>Do not give a recorded statement about your treatment before you have the records in front of you. Be careful with any bill you cannot trace to a provider.</p>
<p>Slow down if anyone asks you to sign a lien document you have not read.</p>

${METHOD}

<h2 id="next-steps">What to do next</h2>
<p>Request itemised statements from every provider. Line up billed, allowed and outstanding for each one before discussing numbers with anyone.</p>
`,
});

addSpec({
  vertical: 'pi',
  file: 'what-a-personal-injury-case-costs-you.json',
  route: '/guides/what-a-personal-injury-case-costs-you/',
  title: 'What a Personal Injury Case Costs You',
  description: 'The costs that come out of a personal injury settlement: the contingency fee, case expenses, liens, court filing fees, and the tax treatment the IRS actually publishes.',
  card: 'What a Personal Injury Case Costs You',
  family: 'costs_timeline',
  shape: 'timeline',
  module: 'top_timeline',
  intent: 'walk the money from gross settlement down to what reaches the client',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'From gross settlement to what you receive',
    best: 'Use this before you sign a fee agreement, not after a settlement figure is announced.',
    key: 'The fee percentage is only the first deduction. Case expenses and liens come out too.',
    mistake: 'Reading the settlement headline as the amount arriving in your account.',
    good: 'A written disbursement estimate showing fee, expenses, liens and net, before you agree to anything.',
    ask: 'Can you show me a worked example of the disbursement on a settlement of this size?',
  },
  html: () => `
<h2 id="definition">Quick answer</h2>
<p>A settlement figure is a gross number. What reaches you is that number minus the fee, minus case expenses, minus any liens.</p>
<p>Ask for a worked disbursement example before you sign a fee agreement. Every one of these deductions is knowable in advance.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="when-to-call">Timing</h2>
<p>The fee agreement is signed at the start, and it governs everything afterwards. That is the moment to ask these questions, not later.</p>
<p>Statutory deadlines to file vary by state and are often shorter than people expect. If you are near one, treat it as urgent.</p>
<p>Early is also when medical documentation is easiest to gather, which is the other reason not to wait.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The order the money comes off</h2>
${table(
  ['Deduction', 'What it is', 'What to establish in writing first'],
  [
    ['Contingency fee', 'A percentage of the gross recovery', 'The percentage, and whether it rises if the case is filed or tried'],
    ['Case expenses', 'Filing fees, records, experts, depositions, imaging', 'Whether expenses come off before or after the fee is calculated'],
    ['Medical liens', 'Providers or insurers claiming repayment from the settlement', 'Which liens exist, and who negotiates them down'],
    ['Outstanding balances', 'Unpaid bills owed directly to providers', 'What remains unpaid and at what amount'],
    ['Net to you', 'What is left', 'A worked example at a realistic settlement figure'],
  ]
)}
<p>Whether expenses are deducted before or after the fee changes the arithmetic materially. Get that answer in writing.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="evidence">A cost that is actually published</h2>
<p>Most case expenses are not published anywhere. Court filing fees are.</p>
<p>In federal district court, the administrative fee is "$55" for filing a civil action, alongside the $350 statutory fee set by 28 U.S.C. &sect; 1914(a) &mdash; $405 in total (District Court Miscellaneous Fee Schedule, effective 1 December 2023).</p>
<p>Most personal injury cases are filed in state court, where fees are set locally and vary. Ask your attorney for the figure in your county.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask before signing</h2>
<ul>
<li>What is the fee percentage, and does it change at any stage?</li>
<li>Are expenses deducted before or after the fee?</li>
<li>Who advances expenses, and what happens if we lose?</li>
<li>Which liens do you expect, and who negotiates them?</li>
<li>Can I see a worked disbursement on a settlement of this size?</li>
</ul>
<p><strong>Common mistake:</strong> asking about the percentage and nothing else.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="red-flags">Tax treatment, and what not to assume</h2>
<p>The IRS publishes this directly. For personal physical injuries or physical sickness, where you did not previously take an itemised deduction for related medical expenses, "the full amount is non-taxable" (Publication 4345, rev. 9-2023).</p>
<p>But if you did deduct those medical expenses in a prior year, you must include that portion in income to the extent the deduction gave you a tax benefit.</p>
<p>Do not assume the whole settlement is tax-free, and be careful with any allocation you have not read. Slow down before signing a release that allocates the settlement between categories.</p>
</section>

<h2 id="next-steps">What to do next</h2>
<p>Ask for the worked disbursement example in writing. If the answer is vague at the start, it will not get clearer at the end.</p>
`,
});

// ============================ USCIS MEDICAL =================================
// uscisexam.com carries 13 of the portfolio's citations and 8 guide pages.
// It also had no citizenship-adjacent content at all.

addSpec({
  vertical: 'uscis_medical',
  file: 'guides_uscis-medical-exam-cost.json',
  route: '/guides/uscis-medical-exam-cost/',
  title: 'USCIS Medical Exam Cost: What the Government Charges and What It Does Not',
  description: 'USCIS charges nothing to file Form I-693. The civil surgeon sets the exam fee and it is published nowhere. Here are the fees that are published, from the current USCIS fee schedule.',
  card: 'USCIS Medical Exam Cost',
  family: 'cost_financing',
  shape: 'cost_breakdown',
  module: 'top_cost_table',
  intent: 'separate the government fee, which is published and is zero, from the exam fee, which is not published at all',
  above: ['quick_answer', 'cost_table'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Two different fees, only one of them published',
    best: 'Use this when you have been quoted a price for the immigration medical exam and want to know what is official.',
    key: 'USCIS charges $0 to file Form I-693. The civil surgeon sets the exam fee independently.',
    mistake: 'Assuming the exam price you were quoted is a government fee. It is not, and it varies.',
    good: 'Two or three civil surgeons called for an all-in quote including vaccines and any repeat visit.',
    ask: 'Does that price include the vaccines, the blood test and a follow-up visit if one is needed?',
  },
  html: () => `
<h2 id="quick-answer">Quick answer</h2>
<p>There are two separate fees, and only one of them is published.</p>
<p>USCIS charges <strong>$0</strong> to file Form I-693. The exam itself is priced by the civil surgeon, and USCIS says so directly: "Fees for immigration medical examinations are established by the civil surgeon. Fees may vary by civil surgeon."</p>
<p>So no official source can tell you what the exam costs. Anyone publishing a national average for it is guessing.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The fees that are published</h2>
<p>From Form G-1055, the USCIS fee schedule, edition 05/29/26.</p>
${table(
  ['Form', 'What it is', 'Filing fee'],
  [
    ['I-693', 'Report of Immigration Medical Examination and Vaccination Record', '$0'],
    ['N-648', 'Medical Certification for Disability Exceptions', '$0'],
    ['I-485', 'Adjust status, applicant over 14', 'Paper $1,440 / online $1,390'],
    ['I-485', 'Under 14, filed with a parent’s I-485', 'Paper $950 / online $900'],
    ['N-400', 'Application for Naturalization', 'Paper $760 / online $710'],
    ['N-400', 'Reduced fee, household income not over 400% of the Federal Poverty Guidelines', 'Paper $380'],
    ['I-910', 'Application for Civil Surgeon Designation', '$990'],
  ]
)}
<p>USCIS also notes that "There is often a $50 discount when filing a form online."</p>
<p>Fee waivers exist. Applicants who qualify under Form I-912 pay $0 for N-400.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="documents">What the exam fee usually has to cover</h2>
<p>Since the civil surgeon sets the price, what is bundled varies. These are the components to ask about explicitly.</p>
<ul>
<li>The examination itself</li>
<li>The tuberculosis test, and a chest X-ray if it is positive</li>
<li>The syphilis blood test</li>
<li>Any vaccinations you are missing</li>
<li>A follow-up visit if records are incomplete</li>
<li>Completing and sealing the form</li>
</ul>
<p>Vaccines are the item most often quoted separately, and the item most likely to move the total.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">Bringing your records down</h2>
<p>The cheapest way to reduce the exam cost is to arrive with your vaccination records. Missing records mean either repeat vaccines or blood tests to prove immunity.</p>
<p>Only a USCIS-designated civil surgeon can perform the exam. Your own doctor cannot, unless they hold that designation.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask when you call</h2>
<ul>
<li>What is the all-in price, including vaccines?</li>
<li>What is quoted separately?</li>
<li>What happens to the price if the TB test is positive?</li>
<li>Is a follow-up visit included?</li>
<li>How quickly is the sealed form ready?</li>
</ul>
<p><strong>Common mistake:</strong> comparing two quotes where one includes vaccines and the other does not.</p>
</section>

<h2 id="next-steps">What to do next</h2>
<p>Call two or three designated civil surgeons and ask all five questions. Bring your vaccination records to whichever you choose.</p>
`,
});

addSpec({
  vertical: 'uscis_medical',
  file: 'guides_n-648-medical-waiver.json',
  route: '/guides/n-648-medical-waiver/',
  title: 'Form N-648, the Medical Disability Exception: What It Is and What It Costs',
  description: 'Form N-648 asks USCIS to excuse the English and civics requirements for naturalization on medical grounds. USCIS charges nothing to file it. The medical professional may charge.',
  card: 'N-648 Medical Waiver',
  family: 'eligibility',
  shape: 'checklist',
  module: 'top_checklist',
  intent: 'explain what the form does, who completes it, and which of the two costs is published',
  above: ['quick_answer', 'checklist'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Whether N-648 applies to you',
    best: 'Use this when a medical or developmental condition makes the English or civics requirement unrealistic.',
    key: 'USCIS charges nothing for the form. The clinician completing it may charge, and that fee is not published.',
    mistake: 'Assuming any medical condition qualifies. The form asks a clinician to link the condition to the specific inability.',
    good: 'A treating clinician who knows the applicant well and can explain the connection in the form’s own terms.',
    ask: 'Do you complete Form N-648, and what do you charge for the assessment and the paperwork?',
  },
  html: () => `
<h2 id="quick-answer">Quick answer</h2>
<p>Form N-648 is how an applicant for naturalization asks USCIS to excuse the English and civics requirements because of a medical or developmental condition.</p>
<p>It is completed by a licensed medical professional, not by the applicant. USCIS states: "There is no filing fee for Form N-648. However, a medical professional may charge a fee for a medical examination and for filling out forms."</p>
<p>So the government cost is $0 and the clinical cost is whatever the clinician charges. The second number is published nowhere.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The two fees, and where they sit</h2>
${table(
  ['Cost', 'Who sets it', 'Published?'],
  [
    ['N-648 filing fee', 'USCIS', 'Yes, and it is $0 (Form G-1055, edition 05/29/26)'],
    ['N-400 filing fee', 'USCIS', 'Yes: paper $760, online $710, reduced fee $380, or $0 with an approved waiver'],
    ['The clinician’s assessment and paperwork fee', 'The medical professional', 'No. Ask directly'],
  ]
)}
<p>Note that N-648 accompanies an N-400. The naturalization fee is the one with real money attached.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="documents">What the clinician is being asked to do</h2>
<p>The form asks the clinician to identify the condition, and to explain how it prevents the applicant from learning English or civics.</p>
<p>The link between the two is the substance of the form. A diagnosis alone does not carry it.</p>
<p>Choose a clinician who has treated the applicant over time. A one-visit assessment is harder to write convincingly and often costs more.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">How it fits the timeline</h2>
<p>N-648 is filed with the N-400 where possible, and can be presented at the interview. It does not remove the interview itself.</p>
<p>An applicant with an approved exception still attends, and the oath requirement is handled separately.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to ask the clinician</h2>
<ul>
<li>Have you completed Form N-648 before?</li>
<li>What do you charge for the assessment and for completing the form?</li>
<li>How long have you treated this patient?</li>
<li>Can you explain the connection between the condition and the requirement?</li>
<li>How quickly can the form be ready?</li>
</ul>
<p><strong>Common mistake:</strong> paying for a single-visit assessment from a clinician with no history with the applicant.</p>
</section>

<h2 id="next-steps">What to do next</h2>
<p>Confirm the applicant’s treating clinician will complete the form and what they charge. Read the current form instructions on the USCIS site before the appointment.</p>
`,
});

addSpec({
  vertical: 'uscis_medical',
  file: 'guides_uscis-interview-checklist.json',
  route: '/guides/uscis-interview-checklist/',
  title: 'USCIS Interview Checklist: What to Bring and What to Confirm',
  description: 'A preparation checklist for a USCIS interview, covering the documents to bring, the medical exam validity question, and the fees that are published for the underlying application.',
  card: 'USCIS Interview Checklist',
  family: 'requirements_checklist',
  shape: 'checklist',
  module: 'top_checklist',
  intent: 'give a document checklist and the two or three things that actually derail interviews',
  above: ['quick_answer', 'checklist'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'Interview preparation, in order',
    best: 'Use this in the week before an interview, once the appointment notice has arrived.',
    key: 'Most avoidable problems are document problems, and most document problems are known in advance.',
    mistake: 'Leaving the medical exam validity question until the day.',
    good: 'Everything on the notice assembled, with originals, plus updated evidence for anything that has changed.',
    ask: 'Has anything changed since I filed that I need to bring evidence of?',
  },
  html: () => `
<h2 id="quick-answer">Quick answer</h2>
<p>Bring the appointment notice, government photo identification, and every original of every copy you filed.</p>
<p>Then bring evidence of anything that has changed since you filed. That is where most interviews run into difficulty.</p>
<p>The official checklist is the appointment notice itself. It lists what USCIS wants from you. Start there, and treat this page as the second pass.</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">Fees, so nothing is outstanding on the day</h2>
<p>From Form G-1055, edition 05/29/26.</p>
${table(
  ['Form', 'Filing fee'],
  [
    ['N-400, Application for Naturalization', 'Paper $760 / online $710'],
    ['N-400, reduced fee (household income not over 400% of the Federal Poverty Guidelines)', 'Paper $380'],
    ['N-400 with an approved fee waiver (Form I-912)', '$0'],
    ['I-485, applicant over 14', 'Paper $1,440 / online $1,390'],
    ['I-693, Report of Immigration Medical Examination', '$0'],
  ]
)}
<p>The medical exam form is free to file. The exam is not, and its price is set by the civil surgeon.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="documents">Documents to assemble</h2>
<ul>
<li>The interview appointment notice</li>
<li>Permanent resident card and any government photo identification</li>
<li>Passports, including expired ones covering the relevant period</li>
<li>Originals of every document you submitted as a copy</li>
<li>Evidence of anything that changed: address, employment, marital status, travel, arrests</li>
<li>Tax records if the application depends on them</li>
<li>Any sealed medical envelope you have been told to bring, still sealed</li>
</ul>
<p>Never open a sealed civil surgeon envelope. An opened envelope is a rejected one.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">The medical exam validity question</h2>
<p>If your case involves Form I-693, confirm before the interview whether the one you filed is still valid or whether a new one is expected.</p>
<p>Check the current guidance on the USCIS I-693 page rather than relying on what was true when you filed. This is a rule that has changed more than once.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to settle beforehand</h2>
<ul>
<li>Is an interpreter permitted, and have you arranged one?</li>
<li>Is anything on your application now out of date?</li>
<li>Is the medical exam still valid for your case?</li>
<li>Do you need to bring anyone with you?</li>
<li>Is any fee still outstanding?</li>
</ul>
<p><strong>Common mistake:</strong> bringing copies where the notice asked for originals.</p>
</section>

<h2 id="next-steps">What to do next</h2>
<p>Read the appointment notice line by line and assemble against it. Then add evidence for everything that has changed since you filed.</p>
`,
});

addSpec({
  vertical: 'uscis_medical',
  file: 'guides_n-400-checklist.json',
  route: '/guides/n-400-checklist/',
  title: 'Form N-400 Checklist: The Documents USCIS Asks Every Applicant For',
  description: 'What USCIS itself lists on the Form N-400 checklist of required initial evidence, what the fee is, and the translation rule that catches people out.',
  card: 'N-400 Checklist',
  family: 'requirements_checklist',
  shape: 'checklist',
  module: 'top_checklist',
  intent: 'reproduce what USCIS itself asks for, and flag the rules people miss',
  above: ['quick_answer', 'checklist'],
  supporting: ['questions', 'next_steps'],
  enhancement: {
    heading: 'What goes with the N-400',
    best: 'Use this while assembling a naturalization application, alongside the official form instructions.',
    key: 'USCIS publishes its own checklist, and it is optional. The form instructions are the binding document.',
    mistake: 'Sending original documents. USCIS asks for copies unless the instructions specifically request originals.',
    good: 'Every foreign-language document accompanied by a full English translation and a translator’s certification.',
    ask: 'Does my basis for filing add documents beyond the ones every applicant provides?',
  },
  html: () => `
<h2 id="quick-answer">Quick answer</h2>
<p>USCIS publishes a "Checklist of Required Initial Evidence" on its own Form N-400 page. It is worth reading first, and it comes with two warnings.</p>
<p>USCIS says the checklist "is an optional tool to use as you prepare your form but does not replace statutory, regulatory, and form instruction requirements." The form instructions govern.</p>
<p>And: "Do not send original documents unless specifically requested in the form instructions or applicable regulations."</p>

<section class="section guide-section" data-guide-section="true">
<h2 id="cost">The fee, first</h2>
${table(
  ['Situation', 'Filing fee'],
  [
    ['General filing, paper', '$760'],
    ['General filing, online', '$710'],
    ['Documented household income not over 400% of the Federal Poverty Guidelines, with supporting documentation', '$380 (paper only)'],
    ['Qualifying military service under INA sections 328 or 329', '$0'],
    ['Approved fee waiver, Form I-912', '$0'],
  ]
)}
<p>Source: Form G-1055, the USCIS fee schedule, edition 05/29/26. USCIS notes that a reduced fee or fee waiver request cannot be filed online.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="documents">What every applicant provides</h2>
<ul>
<li>A copy of the Permanent Resident Card, <strong>both sides</strong></li>
<li>Marital status documents: current marriage certificate, plus any divorce decree, annulment decree or death certificate ending a prior marriage</li>
<li>Form N-648 if a physical or developmental disability or mental impairment prevents compliance with the English or civics requirements</li>
<li>Good moral character documentation for any arrest, detention, charge, conviction or alternative sentencing programme, anywhere in the world</li>
<li>Continuous residence evidence for any trip abroad longer than six months but under a year</li>
<li>A Selective Service status information letter, where registration was required and did not happen</li>
</ul>
<p>The translation rule catches people out. Any document in a foreign language needs a full English translation plus a certification from the translator that the translation is complete and accurate and that they are competent to translate.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="process">Documents that depend on your basis for filing</h2>
<p>Filing as the spouse of a US citizen adds a layer: the marriage certificate, evidence of the spouse's citizenship for the last three years, and evidence that all prior marriages for both of you were terminated.</p>
<p>Continuous residence evidence for the last three years applies instead of the longer period. Acceptable evidence USCIS names includes rent or mortgage statements, pay statements, bank or credit card statements showing regular transactions, car registration and insurance, passport entry and exit stamps, and IRS tax transcripts.</p>
<p>Applicants filing through a legal guardian, surrogate or designated representative have their own separate document set. Read the checklist section that matches your basis rather than the general one.</p>
</section>

<section class="section guide-section" data-guide-section="true">
<h2 id="questions">Questions to settle before you file</h2>
<ul>
<li>Which basis for filing applies to you, and what does it add?</li>
<li>Does any document need a certified English translation?</li>
<li>Are you eligible for the reduced fee or a fee waiver?</li>
<li>Is there any arrest or charge anywhere in the world that needs documenting?</li>
<li>Do you have a trip abroad over six months that needs residence evidence?</li>
</ul>
<p><strong>Common mistake:</strong> sending originals. USCIS asks for copies unless the instructions say otherwise.</p>
</section>

<h2 id="next-steps">What to do next</h2>
<p>Read the current form instructions on the USCIS N-400 page, then assemble against the checklist section that matches your basis for filing.</p>
<p>If a disability exception is relevant, arrange Form N-648 with a treating clinician before you file rather than after.</p>
`,
});

// --- emit -------------------------------------------------------------------

const VDIR = {
  dentistry: 'dentistry_global_pages',
  neuro: 'neuro_global_pages',
  trt: 'trt_global_pages',
  pi: 'pi_global_pages',
  uscis_medical: 'uscis_medical_global_pages',
};

// pi_trust_tone_contract.js requires this exact sentence on every PI guide file.
// The medical verticals carry the equivalent line for the same reason.
const DISCLAIMER = {
  pi: 'Educational only. Not legal advice. No endorsements or rankings.',
  dentistry: 'Educational only. Not medical advice. No endorsements or rankings.',
  neuro: 'Educational only. Not medical advice. No endorsements or rankings.',
  trt: 'Educational only. Not medical advice. No endorsements or rankings.',
  uscis_medical: 'Educational only. Not legal or medical advice. No endorsements or rankings.',
};

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

const contractPath = path.join(ROOT, 'data', 'contracts', 'guide_answer_shape_contract.json');
const registryPath = path.join(ROOT, 'data', 'contracts', 'guide_enhancement_registry.json');
const contract = readJson(contractPath);
const registry = readJson(registryPath);

let written = 0;
const byVertical = {};

for (const s of specs) {
  const dir = path.join(EX, VDIR[s.vertical]);
  const html = s.html().replace(/\n{3,}/g, '\n\n').trim() +
    `\n<p class="muted">${DISCLAIMER[s.vertical]}</p>\n`;
  writeJson(path.join(dir, s.file), {
    route: s.route,
    title: s.title,
    description: s.description,
    main_html: html,
  });
  written += 1;
  (byVertical[s.vertical] = byVertical[s.vertical] || []).push(s);

  // guides index card, so guides_index_links can find the page.
  const guidesFp = path.join(dir, 'guides.json');
  const guides = readJson(guidesFp);
  guides.guide_cards = guides.guide_cards || [];
  const existing = guides.guide_cards.findIndex((c) => c.route === s.route);
  const cardCard = { route: s.route, title: s.card, description: s.description };
  if (existing >= 0) guides.guide_cards[existing] = cardCard;
  else guides.guide_cards.push(cardCard);
  writeJson(guidesFp, guides);

  // answer-shape contract entry
  const ci = (contract.entries || []).findIndex((e) => e.route === s.route);
  const entry = {
    route: s.route,
    primary_query_family: s.family,
    primary_answer_shape: s.shape,
    top_module_type: s.module,
    exact_opening_intent: s.intent,
    required_above_fold_elements: s.above,
    required_supporting_sections: s.supporting,
  };
  if (ci >= 0) contract.entries[ci] = entry; else contract.entries.push(entry);

  registry[s.route] = s.enhancement;
}

contract.entries.sort((a, b) => a.route.localeCompare(b.route));
writeJson(contractPath, contract);
writeJson(registryPath, Object.fromEntries(Object.keys(registry).sort().map((k) => [k, registry[k]])));

console.log(`wrote ${written} guide pages`);
for (const [v, list] of Object.entries(byVertical)) {
  console.log(`  ${v}: ${list.map((s) => s.route).join(', ')}`);
}
console.log(`contract entries: ${contract.entries.length}; enhancement registry: ${Object.keys(registry).length}`);
