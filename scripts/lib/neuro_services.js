'use strict';
/**
 * neuroevalguides.com serves two kinds of reader: people seeking an ADHD or
 * autism EVALUATION and people seeking ADHD or autism THERAPY, and many
 * providers do both (owner decision, 16 Oct 2026). This module is the one
 * definition of that split for the build:
 *
 *   - the service tag a neuro provider card shows, from the two booleans every
 *     neuro provider record carries (offers_evaluation, offers_therapy);
 *   - the neuro provider-type label the request forms use;
 *   - the Evaluation / Therapy / Both choice the callback and request forms ask
 *     first, carried into the lead as `service_needed`.
 *
 * functions/api/request-assistance.js runs on Cloudflare and keeps its own copy
 * of the label and the choice values; tests/neuro/neuro_services.test.mjs fails
 * if the two ever differ.
 */

const NEURO_PROVIDER_TYPE = 'ADHD / autism evaluation or therapy provider';
// The label every request page carried before 16 Oct 2026. The other sites'
// shared request page still lists it, so the endpoint keeps accepting it.
const LEGACY_NEURO_PROVIDER_TYPE = 'Neuro Evaluation Provider';

const SERVICE_CHOICES = [
  ['evaluation', 'Evaluation'],
  ['therapy', 'Therapy'],
  ['both', 'Both']
];

const TAG_EVALUATION = 'Evaluation';
const TAG_THERAPY = 'Therapy';
const TAG_BOTH = 'Evaluation and therapy';

/** The service tag for a neuro provider record, or '' when it offers neither. */
function serviceTag(provider) {
  const ev = !!(provider && provider.offers_evaluation === true);
  const th = !!(provider && provider.offers_therapy === true);
  if (ev && th) return TAG_BOTH;
  if (ev) return TAG_EVALUATION;
  if (th) return TAG_THERAPY;
  return '';
}

/** Why a neuro provider record is not well formed, or '' when it is. */
function recordProblem(provider) {
  if (!provider || typeof provider !== 'object') return 'not an object';
  if (typeof provider.offers_evaluation !== 'boolean') return 'offers_evaluation is not a boolean';
  if (typeof provider.offers_therapy !== 'boolean') return 'offers_therapy is not a boolean';
  if (!provider.offers_evaluation && !provider.offers_therapy) return 'offers neither evaluation nor therapy';
  return '';
}

/*
 * Therapy practices (owner, 16 Oct 2026: therapy practices are the listing
 * buyers). The evaluation datasets (<city>__adhd_eval.json,
 * <city>__autism_eval.json) hold exactly three evaluators each; a metro may
 * also carry <city>__therapy.json, one to three practices that offer ADHD or
 * autism THERAPY, each with the public page that shows it serves that metro.
 * The city page renders them in their own "Therapy practices" block
 * (id="therapy-practices"), which the hero links to.
 */
const THERAPY_SUBKEY = 'therapy';
const THERAPY_SECTION_ID = 'therapy-practices';
const THERAPY_FOCUS = ['adhd', 'autism', 'adhd_and_autism'];
const THERAPY_MAX = 3;
// Metros with a therapy dataset on 16 Oct 2026. Coverage may grow, never
// silently shrink: coverage_runtime_support_contract fails below this.
const THERAPY_MIN_METROS = 52;
// PR #75's 83 therapy records were all autism/ABA: someone seeking ADHD therapy
// found none. On 16 Oct 2026 verified ADHD therapy practices (therapy-only, own
// page naming the metro) were added to 27 metros. A metro counts when one
// record's therapy_focus is adhd or adhd_and_autism; the floor never drops.
const THERAPY_ADHD_FOCUS = ['adhd', 'adhd_and_autism'];
const THERAPY_ADHD_MIN_METROS = 25;

/** True when a therapy list serves ADHD therapy seekers. */
function listServesAdhd(list) {
  return Array.isArray(list) && list.some((r) => r && r.offers_therapy === true && THERAPY_ADHD_FOCUS.includes(r.therapy_focus));
}
// A therapy record carries provenance, never a judgement of the practice.
const THERAPY_BANNED_KEYS = ['rating', 'ratings', 'rank', 'ranking', 'score', 'stars', 'reviews', 'review_count', 'best'];

function evidenceUrlProblem(u) {
  if (typeof u !== 'string' || !u.trim()) return 'has no evidence_url';
  let parsed;
  try { parsed = new URL(u); } catch (_) { return 'evidence_url is not a URL: ' + u; }
  if (parsed.protocol !== 'https:') return 'evidence_url is not https: ' + u;
  if (!/\.[a-z]{2,}$/i.test(parsed.hostname)) return 'evidence_url has no public host: ' + u;
  return '';
}

/** Why a therapy-dataset record is not well formed, or '' when it is. */
function therapyRecordProblem(rec) {
  const base = recordProblem(rec);
  if (base) return base;
  if (!String(rec.name || '').trim()) return 'has no name';
  if (rec.offers_therapy !== true) return 'is in a therapy dataset but offers_therapy is not true';
  if (!THERAPY_FOCUS.includes(rec.therapy_focus)) return 'therapy_focus must be one of ' + THERAPY_FOCUS.join(', ');
  const ev = evidenceUrlProblem(rec.evidence_url);
  if (ev) return ev;
  if (typeof rec.evidence_note !== 'string' || rec.evidence_note.trim().length < 20) return 'has no evidence_note saying what the evidence page shows';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(rec.evidence_checked || ''))) return 'evidence_checked is not a YYYY-MM-DD date';
  for (const k of THERAPY_BANNED_KEYS) if (Object.prototype.hasOwnProperty.call(rec, k)) return 'carries a "' + k + '" field (no ratings or rankings)';
  return '';
}

/** Why a <city>__therapy.json list is not well formed, or '' when it is. */
function therapyListProblem(list) {
  if (!Array.isArray(list)) return 'is not an array';
  if (list.length < 1 || list.length > THERAPY_MAX) return 'must hold 1 to ' + THERAPY_MAX + ' practices, has ' + list.length;
  const names = [];
  for (let i = 0; i < list.length; i++) {
    const p = therapyRecordProblem(list[i]);
    if (p) return 'record ' + (i + 1) + ' (' + String((list[i] && list[i].name) || '?') + ') ' + p;
    names.push(String(list[i].name).trim());
  }
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return 'has duplicate practice names';
  const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (!sorted.every((x, i) => x === names[i])) return 'is not alphabetized by name';
  return '';
}

function therapyFocusLabel(focus) {
  if (focus === 'adhd') return 'ADHD';
  if (focus === 'adhd_and_autism') return 'ADHD and autism';
  return 'autism';
}

function therapySectionCopy(market) {
  return {
    heading: 'Therapy practices in ' + market,
    lead: 'Practices offering ADHD or autism therapy for people who already have a diagnosis or are working toward one. Each card says whether the practice offers evaluation, therapy, or both. Confirm age range, insurance, wait times, and therapy goals directly with the practice. This list is non-exhaustive and is not a recommendation, ranking, or endorsement.'
  };
}

/**
 * Adds the "looking for therapy?" link to the city page hero, so the
 * "Find ADHD or autism therapy" path lands on the therapy block, not on the
 * evaluator lists above it. Throws when the page has no hero to carry it.
 */
function addTherapyJumpToHero(html, market) {
  const out = String(html || '');
  const re = /(<section class="hero"[\s\S]*?)(<\/section>)/;
  if (!re.test(out)) throw new Error('neuro_services: city page has no hero section for the therapy link');
  const link = '<p class="hero-therapy-jump" data-neuro-therapy-jump="true"><a href="#' + THERAPY_SECTION_ID + '">Looking for ADHD or autism therapy? See therapy practices in ' + esc(market) + '</a></p>';
  return out.replace(re, (m0, body, close) => body + link + close);
}

/**
 * Problems with a built neuro city page that has a therapy dataset: the hero
 * link, the therapy block, and every practice's card with its service tag
 * inside that block. At least one card tagged "Therapy" when a record is
 * therapy-only.
 */
function cityTherapyProblems(html, records) {
  const doc = String(html || '');
  const problems = [];
  if (!new RegExp('data-neuro-therapy-jump="true"><a href="#' + THERAPY_SECTION_ID + '"').test(doc)) problems.push('hero has no link to #' + THERAPY_SECTION_ID);
  const sec = (doc.match(new RegExp('<section[^>]*id="' + THERAPY_SECTION_ID + '"[^>]*>[\\s\\S]*?</section>')) || [])[0];
  if (!sec) return problems.concat(['no therapy practices block (id="' + THERAPY_SECTION_ID + '")']);
  if (!/data-neuro-therapy-practices="true"/.test(sec)) problems.push('therapy block has no data-neuro-therapy-practices marker');
  const cards = (sec.match(/<article[^>]*data-provider-card="true"[^>]*>[\s\S]*?<\/article>/gi) || []).map((c) => ({
    name: ((c.match(/provider-card__name">([^<]*)<\/h3>/) || [])[1] || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
    tag: (c.match(/data-provider-service-tag="([^"]*)"/) || [])[1] || ''
  }));
  for (const r of records || []) {
    const want = serviceTag(r);
    if (!cards.some((c) => c.name === r.name && c.tag === want)) problems.push('therapy block has no card for ' + r.name + ' tagged "' + want + '"');
  }
  if ((records || []).some((r) => serviceTag(r) === TAG_THERAPY) && !cards.some((c) => c.tag === TAG_THERAPY)) problems.push('therapy block shows no card tagged "' + TAG_THERAPY + '"');
  return problems;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function serviceTagHtml(tag) {
  if (!tag) return '';
  return '<p class="provider-card__service" data-provider-service-tag="' + esc(tag) + '">' + esc(tag) + '</p>';
}

/** The Evaluation / Therapy / Both select, first field of every neuro lead form. */
function serviceSelectHtml(opts) {
  const id = (opts && opts.id) ? ' id="' + esc(opts.id) + '"' : '';
  return '<select' + id + ' name="service_needed" required data-neuro-service-choice="true">' +
    '<option value="" selected disabled>Choose one</option>' +
    SERVICE_CHOICES.map(([v, label]) => '<option value="' + v + '">' + label + '</option>').join('') +
    '</select>';
}

const SERVICE_QUESTION = 'Are you looking for an evaluation, therapy, or both?';

/**
 * The shared request-assistance page, as the neuro site serves it: the neuro
 * option carries the evaluation-or-therapy label, and the form asks the
 * service choice first. Throws when the page no longer has the anchors this
 * relies on, so a reworded shared page fails the build instead of shipping a
 * neuro form without the choice.
 */
function applyToRequestAssistanceHtml(html) {
  let out = String(html || '');
  if (!out) return out;
  const legacyOption = '<option>' + LEGACY_NEURO_PROVIDER_TYPE + '</option>';
  if (!out.includes(legacyOption)) throw new Error('neuro_services: request-assistance page has no "' + LEGACY_NEURO_PROVIDER_TYPE + '" option to relabel');
  out = out.split(legacyOption).join('<option>' + NEURO_PROVIDER_TYPE + '</option>');
  const anchor = /(<div class="ra-field">\s*<label>\s*<span class="ra-field-title">Provider type)/;
  if (!anchor.test(out)) throw new Error('neuro_services: request-assistance page has no provider-type field to put the service choice before');
  const field = '<div class="ra-field" data-neuro-service-field="true">\n                <label>\n                  <span class="ra-field-title">' + esc(SERVICE_QUESTION) + ' <span aria-hidden="true">*</span></span>\n                  ' + serviceSelectHtml({ id: 'service_needed' }) + '\n                </label>\n              </div>\n\n              ';
  out = out.replace(anchor, field + '$1');
  return out;
}

/**
 * /for-providers/ on the neuro site: evaluation practices, therapy practices,
 * and practices that do both all belong, and each listing shows the service tag
 * its card will carry. Same offer as every site ($249/month per metro, first
 * two months free). Throws when the shared page loses its anchors.
 */
function applyToForProvidersHtml(html) {
  let out = String(html || '');
  if (!out) return out;
  const anchor = '<section class="section notice" data-sales-page-contract="true">';
  if (!out.includes(anchor)) throw new Error('neuro_services: for-providers page has no sales-page-contract section to put the evaluation-and-therapy section before');
  const tags = [TAG_EVALUATION, TAG_THERAPY, TAG_BOTH];
  const section = '<section class="section" data-neuro-for-providers-services="true">' +
    '<h2>Evaluation practices and therapy practices both belong here</h2>' +
    '<p>People come to this site for two things: an ADHD or autism evaluation, and ADHD or autism therapy, with or without a diagnosis. ' +
    'Evaluation practices, therapy practices, and practices that do both can all take a featured listing, at the same price: $249 a month per metro, with the first two months free.</p>' +
    '<p>Every provider card says which service it offers, so a family looking for therapy finds therapy and a family looking for testing finds testing. Your listing carries one of these tags:</p>' +
    '<ul class="provider-service-tags" data-neuro-service-tags="true">' + tags.map((t) => '<li>' + serviceTagHtml(t) + '</li>').join('') + '</ul>' +
    '<p class="muted">Callback requests ask the family first whether they want an evaluation, therapy, or both, and that answer travels with the request we forward to you.</p>' +
    '</section>\n';
  out = out.replace(anchor, section + anchor);
  const firmType = 'Firm%20type%3A%0A';
  if (!out.includes(firmType)) throw new Error('neuro_services: for-providers inquiry email has no "Firm type" line to add the services line after');
  out = out.split(firmType).join(firmType + 'Services%20%28evaluation%2C%20therapy%2C%20or%20both%29%3A%0A');
  return out;
}

module.exports = {
  applyToForProvidersHtml,
  NEURO_PROVIDER_TYPE,
  LEGACY_NEURO_PROVIDER_TYPE,
  SERVICE_CHOICES,
  SERVICE_QUESTION,
  TAG_EVALUATION,
  TAG_THERAPY,
  TAG_BOTH,
  serviceTag,
  recordProblem,
  serviceTagHtml,
  serviceSelectHtml,
  applyToRequestAssistanceHtml,
  THERAPY_SUBKEY,
  THERAPY_SECTION_ID,
  THERAPY_FOCUS,
  THERAPY_MAX,
  THERAPY_MIN_METROS,
  THERAPY_ADHD_FOCUS,
  THERAPY_ADHD_MIN_METROS,
  listServesAdhd,
  therapyRecordProblem,
  therapyListProblem,
  therapyFocusLabel,
  therapySectionCopy,
  addTherapyJumpToHero,
  cityTherapyProblems
};
