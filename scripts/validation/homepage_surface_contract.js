/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('HOMEPAGE SURFACE CONTRACT FAIL\n' + msg);
  process.exit(1);
}

function isPiPack() {
  try {
    const site = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'site.json'), 'utf8'));
    return /pi_v1\.json$/i.test(String(site.pageSetFile || ''));
  } catch (_) {
    return false;
  }
}

function run() {
  const file = path.join(process.cwd(), 'dist', 'index.html');
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, 'utf8');
  const bad = [];
  const heroIdx = html.indexOf('<section class="hero"');
  const shortIdx = html.indexOf('data-short-answer="true"');
  const primaryIdx = html.indexOf('data-primary-conversion-cta="true"');
  const providerIdx = html.indexOf('data-home-provider-preview="true"');
  const faqIdx = html.indexOf('data-home-faq-entry="true"');
  const stateIdx = html.indexOf('data-home-state-grid="true"');
  if (heroIdx === -1) bad.push('missing homepage hero');
  if (primaryIdx === -1) bad.push('missing homepage primary CTA');
  if (shortIdx === -1) bad.push('missing homepage short answer');
  if (providerIdx === -1) bad.push('missing homepage provider preview');
  if (faqIdx === -1) bad.push('missing homepage FAQ entry');
  if (stateIdx === -1) bad.push('missing homepage state grid');
  if (heroIdx !== -1 && primaryIdx !== -1 && primaryIdx < heroIdx) bad.push('primary CTA appears before hero');
  if (heroIdx !== -1 && shortIdx !== -1 && shortIdx < heroIdx) bad.push('short answer appears before hero');
  if (/data-branded-links="true"/i.test(html)) bad.push('legacy branded link strip still present');
  if (isPiPack()) {
    const requiredLinks = [
      '/guides/questions-to-ask-a-personal-injury-lawyer/',
      '/guides/personal-injury-lawyer-red-flags/',
      '/guides/personal-injury-fees-explained/',
      '/guides/recorded-statements-and-insurance-calls/',
      '/guides/evidence-checklist-after-an-accident/'
    ];
    requiredLinks.forEach((href) => {
      if (!html.includes('href="' + href + '"')) bad.push('missing PI homepage routing link: ' + href);
    });
    ['city-by-city', 'state or city page', 'narrow into city'].forEach((needle) => {
      if (html.includes(needle)) bad.push('PI homepage still contains stale city-page language: ' + needle);
    });
    if (!/best personal injury lawyer/i.test(html)) bad.push('PI homepage missing best-lawyer query capture');
  }
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ homepage surface contract pass');
}

module.exports = { run };
