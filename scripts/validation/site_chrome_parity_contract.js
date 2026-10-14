#!/usr/bin/env node
/**
 * Site chrome parity (hard_fail). Owner, 14 Oct 2026: "all page shapes the same".
 * PR #69 put the approved header and footer on the homepage only; every inner
 * page kept the old chrome. This proves, for the built site in dist/, that EVERY
 * rendered HTML page carries the same header (wordmark, parent line, nav items
 * and their targets) and the same footer as dist/index.html.
 *
 * The homepage's primary button points in-page ("#match"); on every other page
 * it must reach the same band ("/#match"), so "#x" is compared as "/#x".
 * Zero pages, or a homepage without the chrome, is a failure (Rule 0).
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const text = (s) => norm(String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '));

function headerOf(html) {
  const m = String(html).match(/<header\b[^>]*data-site-chrome="header"[^>]*>[\s\S]*?<\/header>/i);
  return m ? m[0] : null;
}
function footerOf(html) {
  const m = String(html).match(/<footer\b[^>]*data-site-chrome="footer"[^>]*>[\s\S]*?<\/footer>/i);
  return m ? m[0] : null;
}
function links(fragment) {
  return Array.from(String(fragment).matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi))
    .map((m) => `${text(m[2])} -> ${m[1].startsWith('#') ? '/' + m[1] : m[1]}`);
}
/** The comparable signature of a page's chrome, or a reason it has none. */
function chromeSignature(html) {
  const h = headerOf(html);
  const f = footerOf(html);
  if (!h) return { error: 'no site header (header[data-site-chrome="header"])' };
  if (!f) return { error: 'no site footer (footer[data-site-chrome="footer"])' };
  const wordmark = text((h.match(/<span class="hp-wordmark">([\s\S]*?)<\/span>/i) || [])[1]);
  const parent = text((h.match(/<span class="hp-parent">([\s\S]*?)<\/span>/i) || [])[1]);
  const nav = links((h.match(/<nav\b[\s\S]*?<\/nav>/i) || [''])[0]);
  const lines = Array.from(f.matchAll(/<(p|div)\b[^>]*>([\s\S]*?)<\/\1>/gi)).map((m) => text(m[2])).filter(Boolean);
  return { wordmark, parent, nav, footerLinks: links(f), footerLines: lines };
}

function compare(home, page) {
  const problems = [];
  for (const k of ['wordmark', 'parent']) if (home[k] !== page[k]) problems.push(`header ${k} "${page[k]}" != homepage "${home[k]}"`);
  for (const k of ['nav', 'footerLinks', 'footerLines']) {
    const a = JSON.stringify(home[k]); const b = JSON.stringify(page[k]);
    if (a !== b) problems.push(`${k} differ from the homepage:\n    page: ${b.slice(0, 400)}\n    home: ${a.slice(0, 400)}`);
  }
  return problems;
}

function htmlFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') out.push(...htmlFiles(p)); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Returns { pages, problems } for a built site directory. */
function checkSite(dist) {
  const index = path.join(dist, 'index.html');
  if (!fs.existsSync(index)) return { pages: 0, problems: [`${index} missing`] };
  const home = chromeSignature(fs.readFileSync(index, 'utf8'));
  if (home.error) return { pages: 0, problems: [`homepage: ${home.error}`] };
  if (home.nav.length < 3) return { pages: 0, problems: [`homepage nav has ${home.nav.length} item(s)`] };
  const problems = [];
  let pages = 0;
  for (const file of htmlFiles(dist)) {
    const html = fs.readFileSync(file, 'utf8');
    // Redirect stubs and fragments are not rendered pages.
    if (!/<body\b/i.test(html) || /http-equiv="refresh"/i.test(html)) continue;
    pages += 1;
    const sig = chromeSignature(html);
    const rel = path.relative(dist, file);
    if (sig.error) { problems.push(`${rel}: ${sig.error}`); continue; }
    for (const p of compare(home, sig)) problems.push(`${rel}: ${p}`);
  }
  if (pages < 2) problems.push(`only ${pages} rendered page(s) found under ${dist}; expected the whole site`);
  return { pages, problems };
}

function main() {
  const args = process.argv.slice(2);
  const dist = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : path.join(ROOT, 'dist');
  if (!args.includes('--no-selftest')) {
    const r = cp.spawnSync(process.execPath, ['--test', path.join(ROOT, 'tests', 'site_chrome', 'site_chrome_parity.test.mjs')], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`SITE CHROME PARITY FAIL: fixture self-test failed\n${(r.stdout || '').slice(-1500)}${(r.stderr || '').slice(-800)}`);
      process.exit(1);
    }
  }
  const { pages, problems } = checkSite(dist);
  if (problems.length) {
    console.error(`SITE CHROME PARITY FAIL (${problems.length} problem(s) across ${pages} page(s)):\n- ${problems.slice(0, 25).join('\n- ')}${problems.length > 25 ? `\n- ... ${problems.length - 25} more` : ''}`);
    process.exit(1);
  }
  console.log(`SITE CHROME PARITY CONTRACT PASS (${pages} pages carry the homepage header and footer)`);
}

module.exports = { chromeSignature, compare, checkSite };
if (require.main === module) main();
