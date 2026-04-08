/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error('HOMEPAGE SURFACE CONTRACT FAIL\n' + msg);
  process.exit(1);
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
  const directCity = html.match(/href="\/(?!states\/|guides\/|faq\/|methodology\/|next-steps\/|request-assistance\/|contact\/|disclaimer\/|editorial-policy\/|privacy\/|for-providers\/|personal-injury\/)([a-z0-9-]+)\/"/gi) || [];
  if (directCity.length > 0) bad.push('homepage still contains direct city links');
  if (bad.length) fail(bad.join('\n'));
  console.log('✅ homepage surface contract pass');
}

module.exports = { run };
