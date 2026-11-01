'use strict';

/**
 * THE ACCIDENT GUIDES' OFFER TO LAW FIRMS: the one place it is written for the site.
 *
 * Personal-injury firms are offered a fixed fee and NO exclusivity (risk brain R-LEAD-04: no "one firm
 * per state/area"; FL 4-7.22(d)(12), SC 01-03, TX 573, RI 2019-03). The shared /for-providers/ page
 * sells one featured slot per metro and exclusive area rights to every other vertical; on the PI site
 * those would read as one firm per state, so this rewrites that page for the PI vertical at build
 * time: the statewide per-firm price, and no buyout or exclusive-rights sections. The same wording is
 * in boss-os outreach (src/worker/boss/outreach/catalog.ts, The Accident Guides).
 *
 * Throws when the shared page no longer has a section it rewrites, so a changed source page fails the
 * build instead of shipping the exclusive offer to law firms.
 */

const PI_PRICE = '$499/month per firm';
const PI_PRICE_LINE = '$499/month per firm, statewide listing. Not exclusive: other firms may list too.';
// 120-160 characters: the meta description limit every page is held to.
const PI_DESCRIPTION = 'Featured listings for injury law firms: ' + PI_PRICE + ', statewide. Not exclusive: other firms may list too. First two months free.';

const INQUIRY_BODY = 'Full%20name%3A%0AWork%20email%3A%0APhone%3A%0AFirm%20name%3A%0AFirm%20type%3A%0A' +
  'Interested%20in%3A%20Statewide%20featured%20listing%20%28%24499%2Fmonth%20per%20firm%2C%20not%20exclusive%2C%20first%202%20months%20free%29%0A' +
  'Primary%20markets%3A%0AEstimated%20monthly%20budget%3A%0AHow%20did%20you%20find%20us%3A%0A';

const COMMERCIAL_SECTION =
  '<section class="section for-providers-commercial" data-offer="featured-listing">\n' +
  '  <h2>Featured listing</h2>\n' +
  '  <div class="tiers">\n' +
  '    <div class="tier">\n' +
  '      <h3>Featured listing, statewide</h3>\n' +
  '      <p class="price-anchor">' + PI_PRICE + ', statewide</p>\n' +
  '      <p><strong>First two months free.</strong> You pay nothing until month three, and you can stop before then and owe nothing.</p>\n' +
  '      <ul>\n' +
  '        <li>Your firm shown as a featured firm on your state\'s page, with your name, phone number and website</li>\n' +
  '        <li>Not exclusive: other firms may list in the same state, and no firm can buy out a state or an area</li>\n' +
  '        <li>A fixed monthly fee. It never depends on cases, outcomes or fees you earn</li>\n' +
  '        <li>Each month we send you the clicks on your phone and website buttons</li>\n' +
  '        <li>Month to month after the free period. No contract.</li>\n' +
  '      </ul>\n' +
  '      <div class="actions"><a class="btn primary" href="mailto:%%CONTACT_EMAIL%%?subject=Sponsorship%20Inquiry%20%E2%80%94%20Featured%20Listing&body=' + INQUIRY_BODY + '">Start the free two months</a></div>\n' +
  '    </div>\n' +
  '  </div>\n' +
  '  <h3>What we do not promise</h3>\n' +
  '  <p>We do not guarantee a number of calls or cases. That is why the first two months are free: you see what actually arrives before you pay anything.</p>\n' +
  '  <p class="muted">The guides stay neutral. A featured listing is labelled as sponsored, and it never changes the order of any directory or the content of any guide.</p>\n' +
  '</section>';

const INQUIRY_TEXT = '<p class="muted">Tell us which state you want. We set up your listing and start your two free months. Listings are not exclusive: other firms may list in the same state.</p>';

function section(html, startMarker) {
  const start = html.indexOf(startMarker);
  if (start < 0) return null;
  const end = html.indexOf('</section>', start);
  if (end < 0) return null;
  return html.slice(start, end + '</section>'.length);
}

function replaceSection(html, startMarker, replacement) {
  const s = section(html, startMarker);
  if (!s) throw new Error('pi_offer: for-providers page has no section starting ' + JSON.stringify(startMarker));
  return html.split(s).join(replacement);
}

function applyToForProvidersHtml(html) {
  let out = String(html || '');
  if (!out) return out;
  const hero = /(<section class="hero for-providers-hero">[\s\S]*?<p class="muted">)[\s\S]*?(<\/p>)/;
  if (!hero.test(out)) throw new Error('pi_offer: for-providers page has no hero line to rewrite');
  out = out.replace(hero, '$1Get a featured listing on the state page people use when they look for an injury lawyer. ' + PI_PRICE_LINE + ' The first two months are free.$2');
  out = replaceSection(out, '<section class="section for-providers-commercial"', COMMERCIAL_SECTION);
  out = replaceSection(out, '<section class="section for-providers-exclusive"', '');
  out = replaceSection(out, '<section class="section">\n  <h2>How sponsor ownership works</h2>', '');
  out = replaceSection(out, '<section class="section for-providers-mechanics"', '');
  const inquiry = section(out, '<section class="section for-providers-inquiry"');
  if (!inquiry) throw new Error('pi_offer: for-providers page has no inquiry section');
  const inquiryText = /<p class="muted">[\s\S]*?<\/p>/;
  if (!inquiryText.test(inquiry)) throw new Error('pi_offer: for-providers inquiry section has no lead line to rewrite');
  out = out.split(inquiry).join(inquiry.replace(inquiryText, INQUIRY_TEXT));
  // What a law firm reads must offer no exclusivity anywhere in the visible page.
  const visible = out.replace(/<script[\s\S]*?<\/script>/g, '');
  if (/exclusive(?! listing)|buyout|one featured slot/i.test(visible.replace(/not(?: |%20)exclusive/gi, ''))) {
    throw new Error('pi_offer: the PI for-providers page still offers exclusivity after the rewrite');
  }
  return out;
}

/** The shared /for-providers/ page object, rewritten for the PI site (text and meta descriptions too). */
function applyToForProvidersPage(gp) {
  return {
    ...gp,
    description: PI_DESCRIPTION,
    meta_description: PI_DESCRIPTION,
    main_html: applyToForProvidersHtml(gp.main_html),
  };
}

module.exports = { PI_PRICE, PI_PRICE_LINE, PI_DESCRIPTION, applyToForProvidersHtml, applyToForProvidersPage };
