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
  applyToRequestAssistanceHtml
};
