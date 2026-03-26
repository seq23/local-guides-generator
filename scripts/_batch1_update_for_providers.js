const fs = require('fs');
const path = require('path');

const baseMailto = 'info@spryvc.com';

function urlEncode(s){ return encodeURIComponent(s); }
function makeMailto(tier){
  const subject = 'Advertising Inquiry';
  const body = [
    `Tier of interest: ${tier}`,
    'Full Name:',
    'Email:',
    'Organization:',
    'Website:',
    'Estimated Monthly Budget:',
    'Markets of interest:',
    'Categories of interest:',
    'Notes:',
    ''
  ].join('\n');
  return `mailto:${baseMailto}?subject=${urlEncode(subject)}&body=${urlEncode(body)}`;
}

function readJson(fp){ return JSON.parse(fs.readFileSync(fp,'utf8')); }
function writeJson(fp,obj){ fs.writeFileSync(fp, JSON.stringify(obj,null,2)); }

function removeCitywideAuthorityCard(html){
  return html.replace(/\s*<div class=\"price-card\">\s*<h3>Citywide Authority<\/h3>[\s\S]*?<\/div>\s*/g,'\n\n');
}

function renameBuyoutTier(html){
  return html
    .replace(/<h3>Total City Buyout<\/h3>/g,'<h3>Total City / State Buyout</h3>')
    .replace(/Complete sponsorship control of a single city\./g,'Complete sponsorship control of a single city (and associated state landing pages when applicable).');
}

function addSubmitInquiryButtons(html){
  // Add a Submit Inquiry button to each price-card, using tier name as prefill
  return html.replace(/<div class=\"price-card\">[\s\S]*?<\/div>/g, (card) => {
    if (card.includes('>Submit Inquiry<')) return card;
    const m = card.match(/<h3>([\s\S]*?)<\/h3>/);
    const tier = (m ? m[1].trim() : 'Sponsorship');
    const href = makeMailto(tier);
    const btn = `\n      <p><a class=\"button\" href=\"${href}\">Submit Inquiry</a></p>\n`;
    return card.replace(/\n\s*<\/div>\s*$/,'') + btn + '\n    </div>';
  });
}

function insertSlotDiagramAccordion(html){
  if (html.includes('data-slot-diagram="true"')) return html;
  const diagram = `
<section class="section" data-slot-diagram="true">
  <h2>What slots look like (visual)</h2>
  <p class="muted">These diagrams show how sponsorship placements appear on city hubs, category pages, and guides. Advertising is always labeled and separated from editorial content.</p>

  <details class="accordion">
    <summary><strong>Editorial Guide Presence</strong> — shared visibility inside guides</summary>
    <div class="card">
      <p><strong>Where you appear:</strong> guide and FAQ pages (shared, non-exclusive).</p>
      <ul>
        <li>Guide advertising stacks (when available)</li>
        <li>FAQ advertising stack (when available)</li>
      </ul>
    </div>
  </details>

  <details class="accordion">
    <summary><strong>Category Ownership</strong> — exclusive category placement in a city</summary>
    <div class="card">
      <p><strong>Where you appear:</strong> category pages for one service line in one city.</p>
      <ul>
        <li>Category page: top, mid, bottom</li>
        <li>One sponsor per category (city-specific)</li>
      </ul>
    </div>
  </details>

  <details class="accordion">
    <summary><strong>Total City / State Buyout</strong> — full city (and state, when applicable)</summary>
    <div class="card">
      <p><strong>Where you appear:</strong> all sponsored placements for a city, plus associated state landing pages when applicable.</p>
      <ul>
        <li>City hub: top, mid, bottom</li>
        <li>All category pages in the city: top, mid, bottom</li>
        <li>City hero placement (when applicable)</li>
      </ul>
    </div>
  </details>

  <details class="accordion">
    <summary><strong>Entire Website Buyout</strong> — platform-wide exclusivity</summary>
    <div class="card">
      <p><strong>Where you appear:</strong> every placement site-wide, including future cities.</p>
      <ul>
        <li>Home hero</li>
        <li>All cities (current and future)</li>
        <li>All categories and guides</li>
      </ul>
    </div>
  </details>
</section>
`.trim();

  const insertPoint = '<div class="hr"></div>\n\n<section class="section">\n  <h2>Advertising inquiry</h2>';
  if (!html.includes(insertPoint)) {
    // Fallback: append before inquiry if structure differs
    return html.replace(/\n\s*<section class=\"section\">\n\s*<h2>Advertising inquiry<\/h2>/, '\n\n' + diagram + '\n\n<section class="section">\n  <h2>Advertising inquiry</h2>');
  }
  return html.replace(insertPoint, diagram + '\n\n' + insertPoint);
}

function ensureForProvidersAdTokens(html){
  let out = html;
  if (!out.includes('%%AD:for_providers_top%%')) {
    out = out.replace('</section>\n\n<section class="section">', '</section>\n\n%%AD:for_providers_top%%\n\n<section class="section">');
  }
  if (!out.includes('%%AD:for_providers_bottom%%')) {
    out = out.replace('\n\n<section class="section">\n  <h2>Advertising inquiry</h2>', '\n\n%%AD:for_providers_bottom%%\n\n<section class="section">\n  <h2>Advertising inquiry</h2>');
  }
  return out;
}

function buildCanonicalForProvidersHtml(globalHtml){
  let out = globalHtml;
  out = removeCitywideAuthorityCard(out);
  out = renameBuyoutTier(out);
  out = addSubmitInquiryButtons(out);
  out = insertSlotDiagramAccordion(out);
  return out;
}

// Update canonical global page
const globalFp = path.join('data','global_pages','for-providers.json');
const globalObj = readJson(globalFp);
const canonical = buildCanonicalForProvidersHtml(globalObj.main_html);
globalObj.main_html = canonical;
writeJson(globalFp, globalObj);

// Update pack-specific for-providers pages to include canonical pricing + tokens
const packFiles = [
  path.join('data','page_sets','examples','dentistry_global_pages','for-providers.json'),
  path.join('data','page_sets','examples','neuro_global_pages','for-providers.json'),
  path.join('data','page_sets','examples','pi_global_pages','for-providers.json'),
  path.join('data','page_sets','examples','trt_global_pages','for-providers.json'),
  path.join('data','page_sets','examples','uscis_medical_global_pages','for-providers.json')
];

for (const fp of packFiles) {
  const obj = readJson(fp);
  const m = (obj.main_html || '').match(/^(<section class=\"callout\">[\s\S]*?<\/section>)\s*/);
  const callout = m ? (m[1].trim() + '\n\n') : '';
  obj.main_html = callout + ensureForProvidersAdTokens(canonical);
  if (!obj.title) obj.title = globalObj.title;
  if (!obj.description) obj.description = globalObj.description;
  writeJson(fp, obj);
}

// Validator hard gate
const valFp = path.join('scripts','validate_tbs.js');
let val = fs.readFileSync(valFp,'utf8');

if (!val.includes('function assertForProvidersPricingContract()')) {
  const insertAfter = 'function assertGuidePageContracts()';
  const pos = val.indexOf(insertAfter);
  if (pos === -1) throw new Error('Could not find anchor for insertion');
  // insert before guide contract function to keep SEV-1 gates together
  const insertPos = pos;

  const func = `
// --- FOR-PROVIDERS PRICING CONTRACT (SEV-1) ---
function assertForProvidersPricingContract() {
  const fp = path.join(distDir, 'for-providers', 'index.html');
  if (!fs.existsSync(fp)) return;
  const html = readText(fp);

  if (html.includes('Citywide Authority')) {
    fail('FOR-PROVIDERS CONTRACT FAIL: banned tier "Citywide Authority" still present');
  }
  if (!html.includes('Total City / State Buyout')) {
    fail('FOR-PROVIDERS CONTRACT FAIL: missing tier name "Total City / State Buyout"');
  }

  const submitCount = (html.match(/>Submit Inquiry<\/a>/g) || []).length;
  if (submitCount < 4) {
    fail('FOR-PROVIDERS CONTRACT FAIL: expected >=4 "Submit Inquiry" buttons, found ' + submitCount);
  }

  const mailtoCount = (html.match(/href=\"mailto:info@spryvc\.com\?/g) || []).length;
  if (mailtoCount < submitCount) {
    fail('FOR-PROVIDERS CONTRACT FAIL: Submit Inquiry buttons must use mailto:info@spryvc.com');
  }

  if (!html.includes('data-slot-diagram="true"')) {
    fail('FOR-PROVIDERS CONTRACT FAIL: missing slot diagram accordion section (data-slot-diagram="true")');
  }

  ok('For-providers pricing contract: PASS (tiers + inquiry buttons + slot diagram)');
}
`;
  val = val.slice(0, insertPos) + func + "\n" + val.slice(insertPos);
}

// Ensure it is invoked inside main()
if (!val.includes('assertForProvidersPricingContract();')) {
  val = val.replace('assertGuidePageContracts();', 'assertGuidePageContracts();\n  assertForProvidersPricingContract();');
}

fs.writeFileSync(valFp, val);

console.log('Batch 1 updates applied: for-providers tiers + CTAs + slot diagram + validator gate');
