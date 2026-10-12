/* eslint-disable no-console */
// Footer contract: every rendered footer in dist/ (every page plus 404.html)
// carries the year, a copyright mark, the site's own brand, "A property of
// <PARENT_COMPANY>" and the one CONTACT_EMAIL (no other address), and never
// names Spry Labs or spryvc.com (owner instruction, 12 Oct 2026: every canonical is a
// property of one company, The Industry Guides). Zero footers checked is a failure.
//
// The same FORBIDDEN names are then checked across EVERY file in this pack's
// dist/ (pages, feeds, sitemaps, llms.txt, JSON, scripts), not just footers: no
// built file may show Spry Labs or spryvc.com. Zero files scanned is a failure.
const fs = require('fs');
const path = require('path');
const { PARENT_COMPANY, CONTACT_EMAIL } = require('../lib/pack_site_config');

// 12 Oct 2026: West Peek domains too. Every guides property belongs to The Industry
// Guides alone; a lead email once went From hello@joinwestpeek.com To info@spryvc.com.
const FORBIDDEN = [/spry\s*labs/i, /spryvc\.com/i, /joinwestpeek\.com/i, /westpeek\.ventures/i];

function fail(msg){
  const err = new Error(msg);
  err._validation = 'FOOTER_CONTRACT';
  throw err;
}

function readSite(repoRoot, ctx){
  if (ctx && ctx.site) return ctx.site;
  const p = path.join(repoRoot, 'data', 'site.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function run(ctx){
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const dist = (ctx && ctx.distDir) || path.join(repoRoot,'dist');
  if (!fs.existsSync(dist)) fail('dist/ missing. Run build first.');

  const site = readSite(repoRoot, ctx);
  const brand = String(site.brandName || '').trim();
  if (!brand) fail('site.brandName missing; cannot check the footer brand.');
  const contact = CONTACT_EMAIL;
  const company = escapeHtml(PARENT_COMPANY);

  const htmlFiles = [];
  (function walk(dir){
    for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const p = path.join(dir,ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && (ent.name==='index.html' || ent.name==='404.html')) htmlFiles.push(p);
    }
  })(dist);

  let checked = 0;
  const offenders=[];
  for (const fp of htmlFiles){
    const html = fs.readFileSync(fp,'utf8');
    const footers = html.match(/<footer\b[\s\S]*?<\/footer>/gi) || [];
    if (!footers.length) continue; // pages without a site footer are not governed here
    checked++;
    const footerText = footers.join('\n');
    const problems = [];
    if (!/\b20\d{2}\b/.test(footerText)) problems.push('no year');
    if (!/(©|&copy;|\bcopyright\b)/i.test(footerText)) problems.push('no copyright mark');
    if (!footerText.includes(escapeHtml(brand))) problems.push(`no brand "${brand}"`);
    if (!footerText.includes(`A property of ${company}`)) problems.push(`no "A property of ${PARENT_COMPANY}"`);
    if (!footerText.includes(`mailto:${contact}`)) problems.push(`no contact ${contact}`);
    const otherAddresses = [...new Set(footerText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])]
      .filter((a) => a.toLowerCase() !== contact.toLowerCase());
    if (otherAddresses.length) problems.push('other contact address ' + otherAddresses.join(', '));
    for (const re of FORBIDDEN) if (re.test(footerText)) problems.push(`forbidden ${re}`);
    if (problems.length) offenders.push(fp.replace(repoRoot+path.sep,'') + ': ' + problems.join('; '));
  }

  if (!checked) fail('Footer contract checked zero pages: no <footer> found in any dist page.');

  const allFiles = [];
  (function walkAll(dir){
    for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const p = path.join(dir,ent.name);
      if (ent.isDirectory()) walkAll(p);
      else if (ent.isFile()) allFiles.push(p);
    }
  })(dist);
  if (!allFiles.length) fail('Footer contract scanned zero files in dist/ for forbidden names.');
  const leaks = [];
  for (const fp of allFiles){
    const text = fs.readFileSync(fp,'latin1');
    const hits = FORBIDDEN.filter((re) => re.test(text)).map(String);
    if (hits.length) leaks.push(fp.replace(repoRoot+path.sep,'') + ': ' + hits.join(', '));
  }
  if (leaks.length) {
    fail(`Forbidden names in ${leaks.length}/${allFiles.length} dist files:\n` + leaks.slice(0,50).join('\n'));
  }

  // The Pages Functions ship with every guides site (lead form, click tracking).
  // Their source is held to the same rule: no Spry Labs / West Peek name or domain,
  // so a sender or recipient can never be hardcoded back in.
  const fnDir = (ctx && ctx.functionsDir) || path.join(repoRoot,'functions');
  const fnFiles = [];
  (function walkFn(dir){
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
      const p = path.join(dir,ent.name);
      if (ent.isDirectory()) walkFn(p);
      else if (ent.isFile() && /\.(m?js|ts)$/.test(ent.name)) fnFiles.push(p);
    }
  })(fnDir);
  if (!fnFiles.length) fail('Footer contract scanned zero Pages Function files in functions/ for forbidden names.');
  const fnLeaks = [];
  for (const fp of fnFiles){
    const text = fs.readFileSync(fp,'utf8');
    const hits = FORBIDDEN.filter((re) => re.test(text)).map(String);
    if (hits.length) fnLeaks.push(fp.replace(repoRoot+path.sep,'') + ': ' + hits.join(', '));
  }
  // The lead notification's sender is pinned in the handler, not read from
  // config (12 Oct 2026: The Industry Guides <hello@theindustryguides.com>). A
  // handler that reads EMAIL_FROM again, or names any other sender, fails here.
  const leadFn = fnFiles.find((fp) => path.basename(fp) === 'request-assistance.js');
  if (!leadFn) fail('functions/api/request-assistance.js not found; cannot check the lead sender.');
  const leadSrc = fs.readFileSync(leadFn, 'utf8');
  if (!leadSrc.includes("const LEAD_FROM = 'The Industry Guides <hello@theindustryguides.com>';")) {
    fail('request-assistance.js must pin LEAD_FROM to The Industry Guides <hello@theindustryguides.com>.');
  }
  if (/env\.EMAIL_FROM/.test(leadSrc)) fail('request-assistance.js reads env.EMAIL_FROM; the sender must stay pinned in code.');
  if (fnLeaks.length) {
    fail(`Forbidden names in ${fnLeaks.length}/${fnFiles.length} Pages Function files:\n` + fnLeaks.join('\n'));
  }
  if (offenders.length) {
    fail(`Footer contract failed for ${offenders.length}/${checked} pages:\n` + offenders.slice(0,50).join('\n'));
  }

  console.log(`FOOTER CONTRACT PASS (${checked} pages, "${brand}" · A property of ${PARENT_COMPANY} · ${contact}; ${allFiles.length} dist files + ${fnFiles.length} function files free of Spry Labs / spryvc.com / joinwestpeek.com / westpeek.ventures; lead sender pinned to hello@theindustryguides.com)`);
}

module.exports = { run };

if (require.main === module) {
  try { run({}); } catch (e) { console.error(e.message); process.exit(1); }
}
