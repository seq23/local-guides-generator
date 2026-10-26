'use strict';
/**
 * Affiliate programs on hormonesivhair.com (Hormone Optimization Guides, pack
 * "trt") — owner decision, 16 Oct 2026. Two approved programs, both active:
 *
 *   ulta         Ulta Lab Tests, in-house program. Our microsite is
 *                https://www.ultalabtests.com/theindustryguides and every deep
 *                link sits under /partners/theindustryguides/. Program rule:
 *                never hide, mask or redirect-cloak an Ulta URL, so these are
 *                linked directly (no /go/ wrapper, no shortener, no JS rewrite).
 *   prescribedrx PrescribedRX online TRT, AffiliateWP. Our referral param is
 *                ?ref=sequoialtaylor23 on any prescribedrx.com page.
 *
 * The menopause affiliate (Winona/MaxBounty) was dropped: there is no
 * menopause affiliate link. Women seeking menopause / perimenopause HRT are
 * welcomed by the homepage copy and the callback option below instead.
 *
 * Compliance (hard requirements, guarded by
 * scripts/validation/trt_affiliate_links_contract.js):
 *   - every affiliate link sits in a block labelled "Advertising · affiliate
 *     link" (separate from editorial, like the site's other ad labels) with the
 *     FTC disclosure directly after the links;
 *   - rel="sponsored noopener", target="_blank";
 *   - no ranking language, no efficacy claims — neutral description only.
 *
 * Deep links verified 16 Oct 2026 in a real browser: each returned 200 on the
 * partner microsite without a redirect.
 *
 * Click logging: each affiliate link posts one event to the site's existing $0
 * click log, /api/track-connection-click (Airtable clicks table), with
 * provider_type "affiliate:<program>" and button_source "affiliate_<program>",
 * so clicks are counted per program.
 */

const DISCLOSURE = 'We earn a commission if you buy through this link; it never changes our guides.';
const LABEL = 'Advertising · affiliate link';
const REL = 'sponsored noopener';

const ULTA_MICROSITE = 'https://www.ultalabtests.com/theindustryguides';
const ULTA_PARTNER_PREFIX = 'https://www.ultalabtests.com/partners/theindustryguides/';
const PRESCRIBEDRX_REF = 'sequoialtaylor23';

const ULTA_LINKS = {
  testosterone: { href: ULTA_PARTNER_PREFIX + 'test/testosterone-free-bioavailable-and-total-test', label: 'Testosterone test (free, bioavailable and total)' },
  mens_panel: { href: ULTA_PARTNER_PREFIX + 'test/men-s-hormone-panel', label: 'Men’s hormone panel' },
  menopause: { href: ULTA_PARTNER_PREFIX + 'testing/categories/hormone/menopause', label: 'Menopause and women’s hormone tests' }
};

const PRESCRIBEDRX_LINK = {
  href: 'https://prescribedrx.com/testosterone/?ref=' + PRESCRIBEDRX_REF,
  label: 'Start online with PrescribedRX'
};

// Women's HRT on the callback / request forms (owner, 16 Oct 2026). Mirrored in
// functions/api/request-assistance.js (Cloudflare cannot import this file);
// tests/trt/trt_affiliates.test.mjs fails if the two differ.
const WOMENS_HRT_PROVIDER_TYPE = "Menopause / women's HRT clinic";
const TRT_PROVIDER_TYPE = 'Hormone / Wellness Clinic';

// The existing guide that covers HRT generally (no new guide pages: measure
// before building). Linked from the homepage's women's HRT line.
const HRT_GUIDE = '/guides/hormone-replacement-therapy-near-me/';

// Which guides carry which block. "labs" = Check your levels first (Ulta);
// "online" = Prefer to start online? (PrescribedRX), beside find a local clinic.
const GUIDE_BLOCKS = {
  'guides/who-is-a-good-candidate-for-trt': { labs: ['testosterone', 'mens_panel'], online: true },
  'guides/trt-pricing-and-labs': { labs: ['testosterone', 'mens_panel', 'menopause'], online: true },
  'guides/hormone-therapy-cost-what-is-published': { labs: ['testosterone', 'mens_panel', 'menopause'], online: true },
  'guides/does-insurance-cover-testosterone-therapy': { labs: ['testosterone', 'mens_panel'], online: true },
  'guides/trt-first-90-days': { labs: ['testosterone', 'mens_panel'], online: false },
  // trt-sleep-fatigue-checklist and testosterone-replacement-therapy-overview were
  // folded into who-is-a-good-candidate-for-trt on 26 Oct 2026; it carries both blocks.
  'guides/trt-telehealth-vs-local-clinic': { labs: null, online: true },
  'guides/trt-injections-vs-gels': { labs: null, online: true },
  'guides/hormone-replacement-therapy-near-me': { labs: ['testosterone', 'mens_panel', 'menopause'], online: true }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linkHtml(program, link) {
  return '<a href="' + esc(link.href) + '" rel="' + REL + '" target="_blank" data-affiliate-link="' + program + '">' + esc(link.label) + '</a>';
}

function disclosureHtml() {
  return '<p class="affiliate-disclosure" data-affiliate-disclosure="true"><small>' + esc(DISCLOSURE) + '</small></p>';
}

function labelHtml() {
  return '<p class="affiliate-label" data-affiliate-label="true">' + esc(LABEL) + '</p>';
}

const BLOCK_STYLE = 'border:1px dashed #A16207;border-radius:10px;padding:12px 14px;margin:16px 0;background:rgba(161,98,7,.05)';

/** "Check your levels first" — Ulta Lab Tests. keys: subset of ULTA_LINKS. */
function labsBlockHtml(keys) {
  const list = (keys && keys.length ? keys : Object.keys(ULTA_LINKS)).map((k) => {
    if (!ULTA_LINKS[k]) throw new Error('trt_affiliates: unknown Ulta link "' + k + '"');
    return '<li>' + linkHtml('ulta', ULTA_LINKS[k]) + '</li>';
  }).join('');
  return '<aside class="affiliate-block affiliate-block--labs" data-affiliate-block="ulta" style="' + BLOCK_STYLE + '">' +
    labelHtml() +
    '<p><strong>Check your levels first.</strong> Ulta Lab Tests lets you order a blood test online and have it drawn at a local lab, without a clinic visit. You can bring the results to any clinic you compare.</p>' +
    '<ul>' + list + '</ul>' +
    disclosureHtml() +
    '</aside>';
}

/** "Prefer to start online?" — PrescribedRX, beside find a local clinic. */
function onlineBlockHtml(localHref) {
  return '<aside class="affiliate-block affiliate-block--online" data-affiliate-block="prescribedrx" style="' + BLOCK_STYLE + '">' +
    labelHtml() +
    '<p><strong>Prefer to start online?</strong> PrescribedRX is an online clinic that offers testosterone therapy after a health assessment and lab work. Testosterone availability varies by state, so check that it serves yours. Or <a href="' + esc(localHref || '/#match') + '">find a local clinic</a>.</p>' +
    '<p>' + linkHtml('prescribedrx', PRESCRIBEDRX_LINK) + '</p>' +
    disclosureHtml() +
    '</aside>';
}

/** One script per page: logs each affiliate click per program to the existing click log. */
function clickLogScriptHtml(pageKind, pageSlug) {
  return '<script data-affiliate-click-log="true">(function(){document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[data-affiliate-link]"):null;if(!a||!window.fetch)return;var p=a.getAttribute("data-affiliate-link");try{fetch("/api/track-connection-click",{method:"POST",keepalive:true,headers:{"content-type":"application/json"},body:JSON.stringify({provider_type:"affiliate:"+p,button_source:"affiliate_"+p,intent_type:"affiliate_outbound",page_kind:' + JSON.stringify(pageKind) + ',page_slug:' + JSON.stringify(pageSlug) + ',vertical_key:"trt",source_domain:location.hostname})}).catch(function(){})}catch(_){}},true)})();</script>';
}

function insertOnce(html, re, insert, what) {
  if (!re.test(html)) throw new Error('trt_affiliates: anchor for ' + what + ' not found; the block would silently vanish');
  return html.replace(re, (m) => m + insert);
}

function addClickLog(html, pageKind, slug) {
  if (!/<\/body>/i.test(html)) throw new Error('trt_affiliates: page has no </body> for the click log');
  return html.replace(/<\/body>/i, clickLogScriptHtml(pageKind, slug) + '</body>');
}

/**
 * Applies the affiliate blocks to one rendered page of the trt pack. Every
 * other pack is returned untouched (byte-identical). Throws when a targeted
 * page loses its anchor, so a template change fails the build instead of
 * quietly dropping a disclosed block.
 *   kind: 'global' | 'city'; route: '' for the homepage / city hub, 'guides/x' for a guide.
 */
function applyToPageHtml(html, opts) {
  const vk = String((opts && opts.verticalKey) || '').toLowerCase();
  if (vk !== 'trt') return html;
  const kind = String(opts.kind || '');
  const route = String(opts.route || '').replace(/^\/+|\/+$/g, '');
  let out = String(html || '');

  if (kind === 'global' && route === '') {
    // Homepage (approved layout, 14 Oct 2026): copy inside existing sections only.
    // Labs promise -> after the "At a glance" list; online option -> inside the
    // callback band, beside the find-a-clinic form.
    out = insertOnce(out, /<section[^>]*data-home-glance="true"[^>]*>[\s\S]*?<\/dl>/i, labsBlockHtml(['testosterone', 'mens_panel', 'menopause']), 'homepage labs');
    out = insertOnce(out, /<p class="hp-band-note" data-home-neutrality="true">[\s\S]*?<\/p>/i, onlineBlockHtml('#match'), 'homepage online');
    return addClickLog(out, 'global', 'home');
  }

  if (kind === 'global' && GUIDE_BLOCKS[route]) {
    const cfg = GUIDE_BLOCKS[route];
    let insert = '';
    if (cfg.labs) insert += labsBlockHtml(cfg.labs);
    if (cfg.online) insert += onlineBlockHtml('/#match');
    out = insertOnce(out, /<section[^>]*data-guide-opening="true"[^>]*>[\s\S]*?<\/section>/i, '\n' + insert + '\n', route);
    return addClickLog(out, 'guide', route);
  }

  if (kind === 'city' && route === '') {
    const re = /(<section[^>]*data-city-intelligence-section="lab_work_notes"[^>]*>[\s\S]*?)(<\/section>)/i;
    if (!re.test(out)) return out; // city pages without lab notes carry no slot
    out = out.replace(re, (m, a, b) => a + labsBlockHtml(['testosterone', 'mens_panel', 'menopause']) + b);
    return addClickLog(out, 'city', String(opts.citySlug || ''));
  }

  return out;
}

/** Request page / homepage callback: add the women's HRT option after the TRT clinic option. */
function applyToRequestAssistanceHtml(html) {
  const s = String(html || '');
  if (!s) return s;
  const opt = '<option>' + TRT_PROVIDER_TYPE + '</option>';
  if (!s.includes(opt)) throw new Error('trt_affiliates: request-assistance page has no "' + TRT_PROVIDER_TYPE + '" option to follow');
  if (s.includes(WOMENS_HRT_PROVIDER_TYPE)) return s;
  return s.split(opt).join(opt + '\n                    <option>' + esc(WOMENS_HRT_PROVIDER_TYPE) + '</option>');
}

module.exports = {
  DISCLOSURE, LABEL, REL, ULTA_MICROSITE, ULTA_PARTNER_PREFIX, PRESCRIBEDRX_REF, ULTA_LINKS, PRESCRIBEDRX_LINK,
  WOMENS_HRT_PROVIDER_TYPE, TRT_PROVIDER_TYPE, HRT_GUIDE, GUIDE_BLOCKS,
  labsBlockHtml, onlineBlockHtml, applyToPageHtml, applyToRequestAssistanceHtml
};
