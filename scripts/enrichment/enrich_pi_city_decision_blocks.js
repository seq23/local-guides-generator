const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CITY_DIR = path.join(ROOT, 'data', 'city_content', 'pi');

function titleCase(s) {
  return String(s || '').replace(/\b\w/g, (m) => m.toUpperCase());
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function buildContent(city, state, stateAbbr) {
  return {
    city_intro_override: `${city} personal injury comparisons work better when the page acts like a decision guide first and a directory second. Start by comparing case fit, fee clarity, and case-handling leverage before you decide which firms deserve a call.`,
    primary_city_decision_block: {
      type: 'decision_checklist',
      title: `${city} personal injury comparison checklist`,
      items: [
        `Case fit: compare whether each firm can explain how claims like yours are screened, what evidence matters first, and what the next 30 days usually look like in ${city}.`,
        `Fee clarity: ask every firm to explain the contingency percentage, case expenses, medical-lien handling, and what happens if there is no recovery before you sign anything.`,
        `Trust and leverage: compare who will actually handle the file, how communication works, and whether the firm is prepared to file suit or try the case if negotiation stalls.`
      ]
    },
    case_screening_notes: [
      `Ask what facts, treatment records, photos, witnesses, or insurance details make a ${city} consultation productive instead of generic.`,
      'A strong screening call should explain what is missing, what should be preserved now, and what could weaken the claim if ignored.',
      'Do not treat marketing confidence as proof of case fit; compare how clearly each firm explains liability, damages, and next steps.'
    ],
    fee_structure_notes: [
      `Use the fee guide before you compare firms in ${city}; the goal is not just to hear a percentage but to understand the whole money-flow structure.`,
      'Ask whether case costs are advanced, when they are deducted, how liens or reimbursements are handled, and what the net-recovery conversation sounds like before you sign.',
      'If two firms quote a similar contingency percentage, the more useful comparison is usually how clearly they explain expenses, deductions, and settlement math.'
    ],
    trial_readiness_notes: [
      `Ask who will own the file day to day, when a claim is escalated toward filing, and what trial preparation actually looks like if the insurer refuses to negotiate fairly in ${city}.`,
      'Trial posture matters because insurers price risk differently when they believe a firm can prove damages, preserve evidence, and move a case through litigation.',
      'A useful comparison question is whether the firm can explain negotiation strategy, filing thresholds, and communication expectations without rushing you to sign.'
    ],
    local_statute_notes: [
      `Ask what timing rules, notice issues, and filing deadlines matter in ${state}${stateAbbr ? ` (${stateAbbr})` : ''} before you wait on records or insurer calls.`,
      'Use official bar, court, and state resources to verify status and deadlines; the page should guide the comparison, but legal timing still needs to be confirmed directly.'
    ]
  };
}

function main() {
  const files = fs.readdirSync(CITY_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) throw new Error(`No PI city files found in ${CITY_DIR}`);

  for (const file of files) {
    const full = path.join(CITY_DIR, file);
    const data = readJson(full);
    const city = titleCase(data.city || file.replace(/-[a-z]{2}\.json$/i, '').replace(/-/g, ' '));
    const state = titleCase(data.state || data.state_abbr || '');
    const stateAbbr = String(data.state_abbr || '').toUpperCase();
    const enriched = buildContent(city, state, stateAbbr);
    Object.assign(data, enriched);
    writeJson(full, data);
    console.log(`Updated ${file}`);
  }
}

main();
