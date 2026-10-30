'use strict';
// One publication's identity, read from data/entity/<pack>/entity.json, and its
// named reviewers, read from data/entity/<pack>/reviewers.json.
//
// Why this file exists (authority audit, 30 Oct 2026). Every page emitted
// `sameAs` = the umbrella company's hub page for the publication. That is the
// parent company, not an external profile of this site: search engines and LLM
// knowledge graphs had nothing outside the family of sites to reconcile the
// brand against. The umbrella now goes where it is true - parentOrganization -
// and `sameAs` carries only external profiles listed in entity.json, which ships
// empty until a real profile exists and resolves (the weekly
// scripts/entity_backlink_watch.mjs promotes pending profiles once they do).
//
// The renderer (scripts/build_city_sites.js), the validator
// (scripts/validation/entity_graph_contract.js) and the watch all read these
// files through this module, so there is one list, not three.
const fs = require('fs');
const path = require('path');
const { PACK_SITE_CONFIG, PARENT_COMPANY, UMBRELLA_HOST } = require('./pack_site_config');

const ENTITY_ROOT = path.join(__dirname, '..', '..', 'data', 'entity');
const PARENT_ID = `${UMBRELLA_HOST}/#organization`;

function publicationKeys() {
  return Object.keys(PACK_SITE_CONFIG).filter((k) => PACK_SITE_CONFIG[k].umbrellaPath);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function entityPath(key, root = ENTITY_ROOT) { return path.join(root, key, 'entity.json'); }
function reviewersPath(key, root = ENTITY_ROOT) { return path.join(root, key, 'reviewers.json'); }

function loadEntity(key, root = ENTITY_ROOT) {
  const p = entityPath(key, root);
  return fs.existsSync(p) ? readJson(p) : null;
}

function loadReviewers(key, root = ENTITY_ROOT) {
  const p = reviewersPath(key, root);
  if (!fs.existsSync(p)) return [];
  const doc = readJson(p);
  return Array.isArray(doc.reviewers) ? doc.reviewers : [];
}

// A reviewer is publishable only with written consent on file.
function consentedReviewers(key, root = ENTITY_ROOT) {
  return loadReviewers(key, root).filter((r) => r && r.name && r.credential && r.consent && r.consent.written === true && r.consent.date && r.consent.record);
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; }
}

// The Organization node every page of a publication carries.
function organizationNode(key) {
  const e = loadEntity(key);
  if (!e) return null;
  const node = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': e['@id'],
    name: e.name,
    url: e.url,
    logo: { '@type': 'ImageObject', url: e.logo, width: 512, height: 512 },
    description: e.description,
    parentOrganization: {
      '@type': 'Organization',
      '@id': e.parentOrganization['@id'],
      name: e.parentOrganization.name,
      url: e.parentOrganization.url,
    },
  };
  if (Array.isArray(e.sameAs) && e.sameAs.length) node.sameAs = e.sameAs.slice();
  return node;
}

function personNode(r) {
  return {
    '@type': 'Person',
    name: r.name,
    ...(r.credential ? { jobTitle: r.credential } : {}),
    ...(r.url ? { url: r.url } : {}),
  };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// The visible byline. With no consented reviewer it is the honest editorial-desk
// line pointing at how the publication verifies what it prints; it never names
// a person who has not agreed in writing.
// Stripped from the lastmod content hash by the same regex.
const { BYLINE_RE } = require('./lastmod_ledger');

function bylineHtml(key) {
  const e = loadEntity(key);
  if (!e) return '';
  const reviewers = consentedReviewers(key);
  if (reviewers.length) {
    const names = reviewers.map((r) => `${escapeHtml(r.name)}, ${escapeHtml(r.credential)}`).join('; ');
    return `\n    <p class="page-byline" data-page-byline="reviewed">Reviewed by ${names} · <a href="/editorial-policy/">How we verify</a></p>`;
  }
  return `\n    <p class="page-byline" data-page-byline="editorial-desk">By the ${escapeHtml(e.name)} editorial desk · <a href="/editorial-policy/">How we verify</a></p>`;
}

module.exports = {
  ENTITY_ROOT,
  PARENT_ID,
  PARENT_COMPANY,
  UMBRELLA_HOST,
  BYLINE_RE,
  publicationKeys,
  entityPath,
  reviewersPath,
  loadEntity,
  loadReviewers,
  consentedReviewers,
  organizationNode,
  personNode,
  bylineHtml,
  hostOf,
};
