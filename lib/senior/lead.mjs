/**
 * Lead input validation and the words used to describe a lead.
 * Mirrors functions/api/request-assistance.js: honeypot `website`, consent required,
 * at least one contact, attribution columns under the same names.
 */
import M from '../../assets/senior-match.js';
import { BRAND, clip, isEmail, normalizePhone, normalizeZip, parseList } from './util.mjs';

const WHO_LABEL = { myself: 'Myself', parent: 'A parent', spouse: 'A spouse', professional: 'A patient or client (discharge planner)' };
const TAG_LABEL = { pets: 'pets', faith: 'faith community', social: 'very social', quiet: 'quiet', dining: 'dining', smoking: 'smoking' };

function yes(v) {
  return v === true || v === 1 || v === '1' || v === 'yes' || v === 'true' || v === 'on';
}

function subset(v, allowed) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return [...new Set(arr.map((x) => String(x).trim()).filter((x) => allowed.includes(x)))];
}

/** Attribution exactly as request-assistance.js reads and slices it. */
export function attribution(body) {
  return {
    src: clip(body.src, 120),
    intent_type: clip(body.intent_type || body.intent, 64),
    button_source: clip(body.button_source || body.button, 64),
    vertical_key: clip(body.vertical_key || body.vertical || 'senior-living', 32),
    page_kind: clip(body.page_kind, 32),
    page_slug: clip(body.page_slug, 160),
    market_slug: clip(body.market_slug || body.market, 120)
  };
}

/**
 * Parse a posted lead. Returns { bot: true } for the honeypot, { error } for a refusal,
 * or { lead } (a row ready for the leads table, minus id/created_at/status).
 */
export function parseLead(body) {
  if (String(body.website || '').trim()) return { bot: true };
  const kind = body.kind === 'professional' ? 'professional' : 'family';
  const lead = { kind, ...attribution(body) };
  if (kind === 'professional') {
    const tier = Number(body.care_tier);
    if (![1, 2, 3].includes(tier)) return { error: 'care_tier' };
    lead.who_for = 'professional';
    lead.care_tier = tier;
    lead.adl_tasks = [];
    lead.memory_care = yes(body.memory_care) ? 1 : 0;
    lead.dementia = '';
    lead.wanders = '';
    const payer = subset([body.payer], Object.keys(M.PAYERS));
    lead.payers = payer;
    lead.budget_band = Object.prototype.hasOwnProperty.call(M.BUDGET_BANDS, body.budget_band) ? body.budget_band : '';
    const d = String(body.discharge_date || '').trim();
    lead.discharge_date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
    lead.timeline = Object.prototype.hasOwnProperty.call(M.TIMELINES, body.timeline) ? body.timeline : (lead.discharge_date ? 'this_week' : '');
    lead.zip = normalizeZip(body.zip);
    lead.radius = 'anywhere';
    lead.tags = [];
    lead.name = '';
    lead.phone = '';
    lead.senior_first_name = '';
    const email = clip(body.email || body.work_email, 254);
    if (!isEmail(email)) return { error: 'email' };
    lead.email = email;
  } else {
    if (!['myself', 'parent', 'spouse'].includes(body.who_for)) return { error: 'who_for' };
    lead.who_for = body.who_for;
    lead.zip = normalizeZip(body.zip);
    lead.radius = M.RADII.includes(String(body.radius)) ? String(body.radius) : 'anywhere';
    lead.adl_tasks = subset(body.adl_tasks, M.ADL_TASKS);
    lead.care_tier = M.tierFromAdl(lead.adl_tasks);
    lead.dementia = M.DEMENTIA.includes(body.dementia) ? body.dementia : '';
    lead.wanders = lead.dementia === 'yes' && ['yes', 'no'].includes(body.wanders) ? body.wanders : '';
    lead.memory_care = lead.dementia === 'yes' && lead.wanders === 'yes' ? 1 : 0;
    lead.budget_band = Object.prototype.hasOwnProperty.call(M.BUDGET_BANDS, body.budget_band) ? body.budget_band : '';
    lead.payers = subset(body.payers, Object.keys(M.PAYERS));
    lead.timeline = Object.prototype.hasOwnProperty.call(M.TIMELINES, body.timeline) ? body.timeline : '';
    lead.discharge_date = '';
    lead.tags = subset(body.tags, M.TAGS);
    lead.name = clip(body.name, 120);
    lead.phone = normalizePhone(body.phone);
    lead.senior_first_name = clip(body.senior_first_name, 60);
    const email = clip(body.email, 254);
    if (email && !isEmail(email)) return { error: 'email' };
    lead.email = email;
  }
  lead.consent_contact = yes(body.consent_contact) || yes(body.consent) ? 1 : 0;
  lead.consent_health = yes(body.consent_health) ? 1 : 0;
  lead.shown_ids = subset(body.shown_ids, (Array.isArray(body.shown_ids) ? body.shown_ids : []).map(String)).slice(0, 200).map((s) => s.slice(0, 120));
  lead.unsellable_reason = M.offRampReason(lead);
  const hasContact = Boolean(lead.email || lead.phone);
  if (lead.unsellable_reason) {
    // An off-ramp lead may arrive with no contact at all (the family saw the resources
    // screen); it is still stored and still emailed. Contact, when given, needs consent.
    if (hasContact && !lead.consent_contact) return { error: 'consent' };
    return { lead };
  }
  if (!hasContact) return { error: 'contact_required' };
  if (kind === 'family' && !lead.name) return { error: 'name' };
  if (!lead.consent_contact) return { error: 'consent' };
  if (!lead.consent_health) return { error: 'consent_health' };
  return { lead };
}

export function bandLabel(b) {
  return (M.BUDGET_BANDS[b] && M.BUDGET_BANDS[b].label) || 'Not given';
}

export function areaLabel(lead) {
  const z = String(lead.zip || '');
  return z ? `Memphis area, ZIP ${z.slice(0, 3)}xx` : 'Memphis area';
}

/** The ONLY fields a teaser may carry. No name, phone, email or senior's name. */
export function teaserFields(lead) {
  return {
    care_tier: Number(lead.care_tier),
    memory_care: Number(lead.memory_care) ? 'yes' : 'no',
    budget_band: bandLabel(lead.budget_band),
    area: areaLabel(lead),
    timeline: M.TIMELINES[lead.timeline] || (lead.discharge_date ? `Discharge ${lead.discharge_date}` : 'Not given'),
    who_for: WHO_LABEL[lead.who_for] || 'Not given'
  };
}

export function teaserText(lead, links) {
  const t = teaserFields(lead);
  return [
    `A family in the ${t.area} is looking for a senior living community, and your community fits what they described.`,
    '',
    `Care level: tier ${t.care_tier} of 3 (${t.care_tier === 1 ? 'help with 0-1 daily tasks' : 'help with 2-4 daily tasks'})`,
    `Memory care needed: ${t.memory_care}`,
    `Monthly budget: ${t.budget_band}`,
    `Area: ${t.area}`,
    `Timeline: ${t.timeline}`,
    `Looking for: ${t.who_for}`,
    '',
    'The family\'s contact details go to the first five communities that accept. Choose one:',
    '',
    `Pay $800 now: ${links.flat}`,
    `Accept, pay one month's rent on move-in: ${links.rent}`,
    '',
    'If your community does not pay referral fees, reply "no referral fees" and we will stop sending these.',
    `- ${BRAND}`
  ].join('\n');
}

export function fullLeadText(lead) {
  const tasks = parseList(lead.adl_tasks);
  const payers = parseList(lead.payers).map((p) => M.PAYERS[p] || p);
  const tags = parseList(lead.tags).map((t) => TAG_LABEL[t] || t);
  const lines = [
    `Lead ${lead.id} (received ${lead.created_at})`,
    `Who it is for: ${WHO_LABEL[lead.who_for] || lead.who_for}`
  ];
  if (lead.kind === 'professional') {
    lines.push(`Discharge planner work email: ${lead.email}`);
    if (lead.discharge_date) lines.push(`Discharge date: ${lead.discharge_date}`);
  } else {
    lines.push(`Name: ${lead.name || '(not given)'}`);
    lines.push(`Phone: ${lead.phone || '(not given)'}`);
    lines.push(`Email: ${lead.email || '(not given)'}`);
    lines.push(`Senior's first name: ${lead.senior_first_name || '(not given)'}`);
  }
  lines.push(`Care level: tier ${lead.care_tier} of 3${tasks.length ? ` (help with: ${tasks.join(', ')})` : ''}`);
  lines.push(`Memory care needed: ${Number(lead.memory_care) ? 'yes' : 'no'}${lead.dementia ? ` (dementia diagnosis: ${lead.dementia.replace('_', ' ')}${lead.wanders ? `; wanders or tries to leave: ${lead.wanders}` : ''})` : ''}`);
  lines.push(`Monthly budget: ${bandLabel(lead.budget_band)}`);
  lines.push(`Paying with: ${payers.length ? payers.join(', ') : 'Not given'}`);
  lines.push(`Timeline: ${M.TIMELINES[lead.timeline] || 'Not given'}`);
  lines.push(`Area: ${lead.zip ? `ZIP ${lead.zip}` : 'Memphis area'}${lead.radius && lead.radius !== 'anywhere' ? `, within ${lead.radius} miles` : ''}`);
  if (tags.length) lines.push(`Preferences: ${tags.join(', ')}`);
  return lines.join('\n');
}

export function attributionText(lead) {
  return ['src', 'intent_type', 'button_source', 'vertical_key', 'page_kind', 'page_slug', 'market_slug', 'source_domain']
    .filter((k) => lead[k]).map((k) => `${k}: ${lead[k]}`).join('\n');
}
