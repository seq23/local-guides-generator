const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CITY_DIR = path.join(ROOT, 'data', 'city_content', 'pi');
const LISTINGS_DIR = path.join(ROOT, 'data', 'listings');
const STATE_DEFAULTS_PATH = path.join(ROOT, 'data', 'pi_state_attorney_selection_defaults.json');
const CITY_OVERRIDES_PATH = path.join(ROOT, 'data', 'pi_city_attorney_selection_overrides.json');

function titleCase(s) {
  return String(s || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }

function stateDefaults(ab) {
  const all = readJson(STATE_DEFAULTS_PATH).states || {};
  return all[String(ab || '').toUpperCase()] || null;
}

function cityOverride(slug) {
  const all = readJson(CITY_OVERRIDES_PATH).cities || {};
  return all[String(slug || '')] || null;
}

function buildContent(city, state, stateAbbr, slug) {
  const stateData = stateDefaults(stateAbbr) || {};
  const override = cityOverride(slug) || {};
  const stateName = stateData.state || state || stateAbbr;
  const frameworkTitle = override.framework_title || `How to evaluate a personal injury lawyer in ${city}, ${stateName}`;
  const directoryUse = override.directory_use_note || `Use the ${city} directory as a neutral starting list, not as a ranking or endorsement. Compare each firm against the same case-fit, fee, trial-readiness, review, and verification questions.`;
  const localContext = override.local_context_note || `For ${city}, keep the comparison practical: case type fit, written contingency terms, who handles the file, trial-readiness posture, and review patterns that describe communication rather than popularity.`;
  return {
    city_intro_override: `${city} personal injury comparisons work better when the page acts like a decision guide first and a directory second. Start by comparing case fit, fee clarity, trial readiness, reviews, and official ${stateName} verification before you decide which firms deserve a call.`,
    attorney_selection_framework: {
      version: 'PI_ATTORNEY_SELECTION_FRAMEWORK_V1',
      title: frameworkTitle,
      case_type_specialization: `In ${city}, start by matching the lawyer to the injury and liability pattern: car accident, truck accident, slip and fall, pedestrian or bicycle injury, catastrophic injury, wrongful death, or an uninsured/underinsured motorist issue. Do not treat broad advertising as proof of case-type fit.`,
      contingency_terms: stateData.contingency_fee_review_note || `For ${stateName} personal injury consultations, ask for the contingency percentage, case expenses, lien handling, and what happens if there is no recovery before signing.`,
      trial_readiness: `Ask whether the firm files suit when negotiation stalls, who handles litigation, whether trial counsel is involved, and whether a case like yours might be referred out. Trial readiness matters when fault, injury severity, or insurer valuation is disputed in ${city}.`,
      reviews_and_reputation: `Use reviews as process signals, not rankings. Look for patterns around communication, case updates, fee transparency, staff handoff, and whether people understood next steps. Then verify attorney status through the official ${stateName} resource when available.`,
      attorney_verification: stateData.attorney_verification_note || `Use official ${stateName} attorney verification or disciplinary resources before relying on any directory listing.`,
      deadline_caveat: stateData.deadline_caveat || `Deadlines and notice rules can vary in ${stateName}; verify timing directly before waiting on records, insurer calls, or settlement discussions.`,
      directory_use_note: directoryUse,
      local_context_note: localContext,
      educational_boundary: stateData.legal_advice_caveat || 'Educational only. Not legal advice. No attorney-client relationship, endorsement, ranking, or guarantee is created.',
      source_status: stateData.source_status || 'generalized_needs_review',
      confidence: stateData.confidence || 'generalized',
      sources: stateData.sources || []
    },
    primary_city_decision_block: {
      type: 'decision_checklist',
      title: frameworkTitle,
      items: [
        `Case type specialization: compare whether each firm can explain experience with claims like yours in ${city}, not just personal injury generally.`,
        `Contingency terms: ask for the percentage, litigation-stage changes, case expenses, medical-lien handling, and no-recovery terms in writing.`,
        `Trial readiness: ask who prepares the file if negotiations stall and whether the firm can explain filing, discovery, and trial posture without rushing you to sign.`,
        `Reviews and reputation: read reviews for communication, fee clarity, and case-update patterns, then verify attorney status through official ${stateName} resources.`,
        `Directory use: treat listed firms as a neutral starting point, not a ranking, recommendation, or endorsement.`
      ]
    },
    local_vetting_points: [
      `Use the attorney-selection framework for ${city} before comparing firm names: case fit, fee terms, trial readiness, reviews, and verification.`,
      directoryUse
    ],
    typical_cost_ranges: [stateData.contingency_fee_review_note || `Ask how contingency fees, case expenses, lien handling, and settlement deductions are explained before signing in ${stateName}.`],
    payment_options: [
      'Ask whether the fee is contingency-based, whether litigation expenses are advanced, and whether costs come out before or after the fee calculation.',
      'Ask how medical bills, liens, reimbursements, and no-recovery outcomes affect the final net recovery.'
    ],
    wait_time_notes: [
      'Speed matters most at the beginning because evidence, treatment records, scene photos, and insurance notices can get harder to organize later.',
      'A same-day callback is less important than getting clear preservation steps and a real screening conversation.'
    ],
    availability_notes: [
      'Availability should be judged by whether the team can review the facts quickly and tell you what to gather next, not just by how fast intake answers the phone.',
      'Ask whether weekends, after-hours intake, bilingual staff, or remote consultation options are available if timing is urgent.'
    ],
    named_resources_or_providers: [
      `${city} directory entries are neutral examples only. Use them with the attorney-selection framework; do not treat them as rankings or endorsements.`,
      stateData.attorney_verification_note || `Check official ${stateName} attorney verification resources before relying on marketing language.`
    ],
    market_specific_notes: [localContext],
    case_screening_notes: [
      `Ask what facts, treatment records, photos, witnesses, or insurance details make a ${city} consultation productive instead of generic.`,
      'A strong screening call should explain what is missing, what should be preserved now, and what could weaken the claim if ignored.',
      'Do not treat marketing confidence as proof of case fit; compare how clearly each firm explains liability, damages, and next steps.'
    ],
    fee_structure_notes: [
      stateData.contingency_fee_review_note || `Use the fee guide before you compare firms in ${city}; the goal is not just to hear a percentage but to understand the whole money-flow structure.`,
      'Ask whether case costs are advanced, when they are deducted, how liens or reimbursements are handled, and what the net-recovery conversation sounds like before you sign.',
      'If two firms quote a similar contingency percentage, the more useful comparison is usually how clearly they explain expenses, deductions, and settlement math.'
    ],
    trial_readiness_notes: [
      `Ask who will own the file day to day, when a claim is escalated toward filing, and what trial preparation actually looks like if the insurer refuses to negotiate fairly in ${city}.`,
      'Trial posture matters because insurers price risk differently when they believe a firm can prove damages, preserve evidence, and move a case through litigation.',
      'A useful comparison question is whether the firm can explain negotiation strategy, filing thresholds, and communication expectations without rushing you to sign.'
    ],
    local_statute_notes: [
      stateData.deadline_caveat || `Ask what timing rules, notice issues, and filing deadlines matter in ${stateName}${stateAbbr ? ` (${stateAbbr})` : ''} before you wait on records or insurer calls.`,
      'Use official bar, court, and state resources to verify status and deadlines; the page should guide the comparison, but legal timing still needs to be confirmed directly.'
    ]
  };
}

function main() {
  if (!fs.existsSync(CITY_DIR)) fs.mkdirSync(CITY_DIR, { recursive: true });
  const listingFiles = fs.readdirSync(LISTINGS_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!listingFiles.length) throw new Error(`No PI listing files found in ${LISTINGS_DIR}`);

  for (const file of listingFiles) {
    const listing = readJson(path.join(LISTINGS_DIR, file));
    if (listing.vertical && listing.vertical !== 'pi') continue;
    const slug = listing.city_slug || file.replace(/\.json$/, '');
    const stateAbbr = String(listing.state || slug.split('-').slice(-1)[0] || '').toUpperCase();
    const stateData = stateDefaults(stateAbbr) || {};
    const city = listing.city || titleCase(slug.split('-').slice(0, -1).join(' '));
    const state = stateData.state || listing.state || stateAbbr;
    const full = path.join(CITY_DIR, `${slug}.json`);
    const data = fs.existsSync(full) ? readJson(full) : { city_slug: slug, city, state, state_abbr: stateAbbr, vertical: 'pi' };
    data.city_slug = slug;
    data.city = data.city || city;
    data.state = state;
    data.state_abbr = stateAbbr;
    data.vertical = 'pi';
    Object.assign(data, buildContent(data.city, state, stateAbbr, slug));
    writeJson(full, data);
    console.log(`Updated ${slug}.json`);
  }
}

main();
