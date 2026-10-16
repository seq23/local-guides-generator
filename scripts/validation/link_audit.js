/* eslint-disable no-console */
//
// Rendered link integrity for the pack currently standing in dist/.
//
// What it guards
// --------------
// 1. Every internal href/src emitted into a rendered page must resolve to a
//    file this same build produced. A link assembled from a route pattern the
//    build does not also write is a 4XX on the live site.
// 2. Every rendered <a href="mailto:..."> must sit inside a
//    <!--email_off--> ... <!--/email_off--> fence. Without the fence Cloudflare
//    Email Address Obfuscation rewrites the anchor at the edge into
//    /cdn-cgi/l/email-protection#<hex>, which answers 404 -- one broken link on
//    every page that carries the shared footer.
// 3. No bare email address in page TEXT outside a fence either: Cloudflare
//    obfuscates text addresses too (dentistryguides, thedentistryguides and
//    uscisexam carried /cdn-cgi/l/email-protection links on 16 Oct 2026 that
//    came from "by email to x@y.org" in listing copy), and no rendered href may
//    point at /cdn-cgi/l/email-protection at all.
// 4. No outbound href may match config/dead_outbound_urls.json, the checked-in
//    list of external URLs confirmed dead and replaced at source. A dead link
//    re-entering through a data refresh fails the pack build.
// 5. Every page advertised in the sitemap must have at least one internal
//    inbound link from another rendered page. Ahrefs (14 Oct 2026) found 50
//    theaccidentguides /states/XX/next-steps/ pages and 36 uscisexam
//    /{city}/next-steps/ pages reachable only through the sitemap: canonical,
//    indexable, and linked from nowhere except by ?src=... tracked CTAs, which
//    a crawler treats as other URLs. Only a query-free href counts as inbound.
//
// Why it exists
// -------------
// This file used to define run(ctx) and export it, and nothing called it. The
// tier runner executes validators as `node <file>`, so `node
// scripts/validation/link_audit.js` loaded the module, defined a function,
// exported it and exited 0 having examined nothing. It was also filed in the
// developer tier, which never fails a build. The only link validator in the
// repo was inert twice over, and b3c79e3 shipped 167 dead conversion CTAs
// across four domains underneath it.
//
// It now runs when executed, is filed in the hard_fail tier (which
// build_all_packs.js runs once per pack, against that pack's dist), and
// hard-fails when it examines zero links so it can never pass on an empty loop.

const fs = require('fs');
const path = require('path');

const MAILTO_ANCHOR_RE = /<a\b[^>]*\bhref=["']mailto:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
const FENCE_SPLIT_RE = /(<!--email_off-->[\s\S]*?<!--\/email_off-->)/i;
const LINK_RE = /(?:href|src)=["']([^"']+)["']/g;
const HREF_RE = /\bhref=["']([^"']+)["']/gi;
const CF_EMAIL_PATH_RE = /\/cdn-cgi\/l\/email-protection/i;
const TEXT_EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const RAW_BLOCK_OR_TAG_RE = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]*>)/i;
const DEAD_LIST_PATH = path.join('config', 'dead_outbound_urls.json');

function normUrl(u) {
  return decodeHref(u).split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
}

function loadDeadList(repoRoot) {
  const p = path.join(repoRoot, DEAD_LIST_PATH);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  const entries = (doc && doc.entries) || [];
  if (!entries.length) throw new Error(`LINK AUDIT FAIL: ${DEAD_LIST_PATH} has zero entries; the dead-link guard would examine nothing.`);
  return entries.map((e) => {
    if (!['host', 'url'].includes(e.match) || !/^https?:\/\//.test(String(e.url || ''))) {
      throw new Error(`LINK AUDIT FAIL: malformed entry in ${DEAD_LIST_PATH}: ${JSON.stringify(e)}`);
    }
    return { match: e.match, url: e.url, host: new URL(e.url).hostname.toLowerCase(), norm: normUrl(e.url) };
  });
}

function deadMatch(dead, href) {
  if (!/^https?:\/\//i.test(href)) return null;
  let host;
  try { host = new URL(decodeHref(href)).hostname.toLowerCase(); } catch (_) { return null; }
  const n = normUrl(href);
  return dead.find((d) => (d.match === 'host' ? d.host === host : d.norm === n)) || null;
}

// dist-relative page key for an internal href or sitemap path: "a/b/" form.
function pageKey(distRoot, pageFile, href) {
  const cleaned = decodeHref(href).split('#')[0].split('?')[0];
  if (!cleaned) return null;
  let rel = cleaned.startsWith('/')
    ? cleaned.replace(/^\/+/, '')
    : path.relative(distRoot, path.resolve(path.dirname(pageFile), cleaned)).split(path.sep).join('/');
  if (rel.startsWith('..')) return null;
  rel = rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '/');
  if (rel && !rel.endsWith('/') && !/\.[a-z0-9]{2,12}$/i.test(rel)) rel += '/';
  return rel;
}

function sitemapPaths(distRoot) {
  const idx = path.join(distRoot, 'sitemap.xml');
  if (!fs.existsSync(idx)) return null;
  const seen = new Set();
  const out = new Set();
  (function read(file) {
    if (seen.has(file) || !fs.existsSync(file)) return;
    seen.add(file);
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      let u;
      try { u = new URL(m[1]); } catch (_) { continue; }
      if (/\.xml$/i.test(u.pathname)) read(path.join(distRoot, u.pathname.replace(/^\/+/, '')));
      else out.add(u.pathname);
    }
  })(idx);
  return [...out];
}

function unfencedTextEmails(segment) {
  const found = [];
  segment.split(RAW_BLOCK_OR_TAG_RE).forEach((part, i) => {
    if (i % 2 === 0) for (const m of part.matchAll(TEXT_EMAIL_RE)) found.push(m[0]);
  });
  return found;
}

// Schemes and fragments that never resolve to a file in dist.
const NON_PATH_RE = /^(?:https?:|mailto:|tel:|sms:|data:|javascript:|#|\/\/)/i;

function decodeHref(raw) {
  // Rendered hrefs are HTML-escaped (&amp; between query params). Only the
  // path matters here, but decode first so nothing odd survives into it.
  return String(raw)
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&');
}

function collectHtmlFiles(root) {
  const out = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html')) out.push(p);
    }
  })(root);
  return out.sort();
}

function resolvesInDist(distRoot, pageFile, href) {
  const cleaned = decodeHref(href).split('#')[0].split('?')[0];
  if (!cleaned) return true; // pure fragment or query on the current page
  let rel;
  if (cleaned.startsWith('/')) {
    rel = cleaned.replace(/^\/+/, '');
  } else {
    rel = path.relative(distRoot, path.resolve(path.dirname(pageFile), cleaned));
    if (rel.startsWith('..')) return false; // escapes dist entirely
  }
  if (!rel) return true; // resolved to site root
  // Extensions up to 12 chars: .webmanifest is a real file, and a 2-5 char cap
  // misread it as a page route and reported a link to an existing file as broken.
  const looksLikeFile = /\.[a-z0-9]{2,12}$/i.test(rel);
  if (looksLikeFile) return fs.existsSync(path.join(distRoot, rel));
  return (
    fs.existsSync(path.join(distRoot, rel, 'index.html')) ||
    fs.existsSync(path.join(distRoot, `${rel}.html`))
  );
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const distRoot = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distRoot)) {
    throw new Error('LINK AUDIT FAIL: dist/ missing. Build a pack first.');
  }

  const files = collectHtmlFiles(distRoot);
  if (files.length === 0) {
    throw new Error('LINK AUDIT FAIL: dist/ contains no rendered HTML pages. Nothing was examined.');
  }

  let internalLinksExamined = 0;
  let mailtoAnchorsExamined = 0;
  const brokenByTarget = new Map(); // target -> [page, ...]
  const unfencedMailto = [];
  const unfencedText = [];
  const cfEmailHrefs = [];
  const deadHits = new Map(); // dead url -> [page, ...]
  const dead = loadDeadList(repoRoot);
  let outboundExamined = 0;
  const inbound = new Map(); // pageKey -> count of links from OTHER pages

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const relPage = path.relative(distRoot, file);

    for (const match of html.matchAll(LINK_RE)) {
      const href = match[1];
      if (!href || NON_PATH_RE.test(href)) continue;
      internalLinksExamined += 1;
      const k = pageKey(distRoot, file, href);
      const selfKey = pageKey(distRoot, file, '/' + relPage.split(path.sep).join('/'));
      // A link carrying a query string (?src=...&intent=... attribution) is a
      // different URL to a crawler; the canonical page it canonicalizes to still
      // has no inbound link. That is exactly how the 86 Ahrefs orphans arose:
      // every link to them was a tracked CTA. Only a clean href counts.
      const hasQuery = /\?./.test(decodeHref(href).split('#')[0]);
      if (k !== null && k !== selfKey && !hasQuery) inbound.set(k, (inbound.get(k) || 0) + 1);
      if (!resolvesInDist(distRoot, file, href)) {
        const target = decodeHref(href).split('#')[0].split('?')[0];
        if (!brokenByTarget.has(target)) brokenByTarget.set(target, []);
        brokenByTarget.get(target).push(relPage);
      }
    }

    // Mailto fencing: split on existing fences, then look for anchors that
    // survive outside one.
    const segments = html.split(FENCE_SPLIT_RE);
    for (let i = 0; i < segments.length; i += 1) {
      const inFence = i % 2 === 1;
      const hits = segments[i].match(MAILTO_ANCHOR_RE) || [];
      mailtoAnchorsExamined += hits.length;
      if (!inFence && hits.length) unfencedMailto.push(`${relPage} (${hits.length})`);
      if (!inFence) {
        const bare = unfencedTextEmails(segments[i]);
        if (bare.length) unfencedText.push(`${relPage} (${[...new Set(bare)].join(', ')})`);
      }
    }

    for (const match of html.matchAll(HREF_RE)) {
      const href = match[1];
      if (CF_EMAIL_PATH_RE.test(href)) cfEmailHrefs.push(`${relPage} -> ${href}`);
      if (/^https?:\/\//i.test(href)) outboundExamined += 1;
      const d = deadMatch(dead, href);
      if (d) {
        if (!deadHits.has(d.url)) deadHits.set(d.url, []);
        deadHits.get(d.url).push(`${relPage} -> ${href}`);
      }
    }
  }

  if (internalLinksExamined === 0) {
    throw new Error(
      `LINK AUDIT FAIL: examined ${files.length} rendered page(s) and found zero internal links. ` +
      'A rendered corpus with no internal links is a build defect, not a pass.'
    );
  }

  const problems = [];

  if (brokenByTarget.size) {
    const ranked = [...brokenByTarget.entries()].sort((a, b) => b[1].length - a[1].length);
    const instances = ranked.reduce((sum, [, pages]) => sum + pages.length, 0);
    const sourcePages = new Set(ranked.flatMap(([, pages]) => pages)).size;
    const lines = ranked.slice(0, 40).map(([target, pages]) => `  ${target}  <- ${pages.length} link(s), e.g. ${pages[0]}`);
    if (ranked.length > 40) lines.push(`  ...and ${ranked.length - 40} more distinct broken target(s)`);
    problems.push(
      `Broken internal links: ${ranked.length} distinct target(s) the build does not produce, ` +
      `${instances} link instance(s), on ${sourcePages} page(s).\n${lines.join('\n')}\n` +
      'Fix the generator that emits the href, not the rendered page.'
    );
  }

  if (unfencedMailto.length) {
    problems.push(
      `Unfenced mailto anchors on ${unfencedMailto.length} page(s). Cloudflare Email Address ` +
      'Obfuscation rewrites these into /cdn-cgi/l/email-protection, which answers 404.\n' +
      unfencedMailto.slice(0, 20).map((l) => `  ${l}`).join('\n') +
      (unfencedMailto.length > 20 ? `\n  ...and ${unfencedMailto.length - 20} more` : '')
    );
  }

  if (unfencedText.length) {
    problems.push(
      `Bare email addresses outside an <!--email_off--> fence on ${unfencedText.length} page(s). Cloudflare ` +
      'rewrites text addresses into /cdn-cgi/l/email-protection links too (404 without JS).\n' +
      unfencedText.slice(0, 20).map((l) => `  ${l}`).join('\n') +
      (unfencedText.length > 20 ? `\n  ...and ${unfencedText.length - 20} more` : '')
    );
  }

  if (cfEmailHrefs.length) {
    problems.push(
      `Rendered hrefs to /cdn-cgi/l/email-protection on ${cfEmailHrefs.length} link(s) (404 without JS):\n` +
      cfEmailHrefs.slice(0, 20).map((l) => `  ${l}`).join('\n')
    );
  }

  if (deadHits.size) {
    const lines = [...deadHits.entries()].map(([u, pages]) => `  ${u}  <- ${pages.length} link(s), e.g. ${pages[0]}`);
    problems.push(
      `Outbound links to URLs listed dead in ${DEAD_LIST_PATH}:\n${lines.join('\n')}\n` +
      'Replace the URL in the source data (see replaced_by in the list), never in the rendered page.'
    );
  }

  const smPaths = sitemapPaths(distRoot);
  let sitemapPagesExamined = 0;
  if (smPaths) {
    if (!smPaths.length) problems.push('sitemap.xml lists zero page URLs: the orphan check examined nothing.');
    const orphans = [];
    for (const p of smPaths) {
      const k = pageKey(distRoot, path.join(distRoot, 'index.html'), p);
      if (k === null || k === '') continue; // the home page is the crawl root
      sitemapPagesExamined += 1;
      if (!inbound.get(k)) orphans.push(p);
    }
    if (orphans.length) {
      problems.push(
        `Orphan pages: ${orphans.length} sitemap URL(s) with no internal inbound link from any other page. ` +
        'Link each from its parent page in the generator template.\n' +
        orphans.slice(0, 40).map((o) => `  ${o}`).join('\n') +
        (orphans.length > 40 ? `\n  ...and ${orphans.length - 40} more` : '')
      );
    }
  }

  if (outboundExamined === 0) {
    problems.push('Examined zero outbound http(s) links: the dead-URL guard checked nothing.');
  }

  if (problems.length) {
    throw new Error(`LINK AUDIT FAIL\n\n${problems.join('\n\n')}`);
  }

  console.log(
    `✅ LINK AUDIT PASS: ${files.length} page(s), ${internalLinksExamined} internal link(s) resolved, ` +
    `${mailtoAnchorsExamined} mailto anchor(s) fenced, ${outboundExamined} outbound link(s) checked against ${dead.length} dead URL(s), ` +
    `${sitemapPagesExamined} sitemap page(s) each linked from another page.`
  );
  return { files: files.length, internalLinksExamined, mailtoAnchorsExamined, outboundExamined, sitemapPagesExamined };
}

module.exports = { run };

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
