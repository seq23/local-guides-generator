'use strict';
/**
 * One guide site, one first answer (owner, 25 Oct 2026).
 *
 * The first neuroevalguides.com lead (25 Oct 2026) reached the shared Airtable
 * table as "Personal Injury Attorney": the site's /request-assistance/ page
 * served the shared form unchanged, whose provider-type select opened on a
 * disabled "Select one" with "Personal Injury Attorney" as the first real
 * option, and whose hidden vertical_key stayed blank because nothing on the
 * page set it. The visitor had answered the neuro-only "evaluation" question,
 * then the first option of the provider list.
 *
 * Owner ruling: every guide site keeps the other services listed, but its OWN
 * service comes first and is pre-selected, with no blank default, on the
 * homepage callback form and the /request-assistance/ page alike; and every
 * lead carries the site's vertical_key and the page the visitor came from.
 *
 * This module is the one definition of each site's own provider types for the
 * build. functions/api/request-assistance.js keeps its own copy of the host ->
 * vertical map (it runs on Cloudflare and cannot import this file);
 * tests/request_form/own_vertical.test.mjs fails if the two differ.
 */

const neuroServices = require('./neuro_services');
const trtAffiliates = require('./trt_affiliates');

// Each site's own provider types, in the order its forms list them first.
const OWN_PROVIDER_TYPES = {
  pi: ['Personal Injury Attorney'],
  dentistry: ['Dentist (Cosmetic, Implant, or General Care)'],
  neuro: [neuroServices.NEURO_PROVIDER_TYPE],
  trt: [trtAffiliates.TRT_PROVIDER_TYPE, trtAffiliates.WOMENS_HRT_PROVIDER_TYPE],
  uscis_medical: ['USCIS Medical Exam Provider']
};

function ownProviderTypes(verticalKey) {
  return OWN_PROVIDER_TYPES[String(verticalKey || '').toLowerCase()] || null;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeText(s) {
  return String(s || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

const SELECT_RE = /(<select\b[^>]*\bid="provider_type"[^>]*>)([\s\S]*?)(<\/select>)/i;

/** The provider_type options of a form: [{ text, selected, disabled, value }]. */
function providerOptions(html) {
  const m = String(html || '').match(SELECT_RE) || String(html || '').match(/(<select\b[^>]*\bname="provider_type"[^>]*>)([\s\S]*?)(<\/select>)/i);
  if (!m) return null;
  return Array.from(m[2].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/gi)).map((o) => ({
    text: decodeText(o[2]).trim(),
    selected: /\bselected\b/i.test(o[1]),
    disabled: /\bdisabled\b/i.test(o[1]),
    value: (o[1].match(/\bvalue="([^"]*)"/i) || [])[1]
  }));
}

/**
 * Puts the site's own provider types first, pre-selects the first of them, drops
 * the blank "Select one" default, keeps every other service listed below, and
 * stamps the site's vertical_key into the hidden field. Throws when the page
 * lost an anchor, so a silently unchanged form can never ship.
 */
function applyOwnVerticalFirst(html, verticalKey) {
  const own = ownProviderTypes(verticalKey);
  let out = String(html || '');
  if (!own || !out) return out;
  const m = out.match(SELECT_RE);
  if (!m) throw new Error('site_lead_form: request-assistance page has no provider_type select');
  const opts = providerOptions(out).filter((o) => !o.disabled && o.text);
  for (const t of own) {
    if (!opts.some((o) => o.text === t)) throw new Error('site_lead_form: provider_type select has no "' + t + '" option for ' + verticalKey);
  }
  const others = opts.map((o) => o.text).filter((t) => !own.includes(t));
  const ordered = own.concat(others);
  const indent = '\n                    ';
  const body = ordered.map((t, i) => indent + '<option' + (i === 0 ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '\n                  ';
  out = out.replace(SELECT_RE, (_, open, __, close) => open + body + close);
  const vkRe = /(<input\b[^>]*\bname="vertical_key"[^>]*\bvalue=")([^"]*)(")/i;
  if (!vkRe.test(out)) throw new Error('site_lead_form: request-assistance page has no hidden vertical_key field');
  out = out.replace(vkRe, (_, a, __, c) => a + esc(String(verticalKey).toLowerCase()) + c);
  return out;
}

module.exports = { OWN_PROVIDER_TYPES, ownProviderTypes, providerOptions, applyOwnVerticalFirst };
