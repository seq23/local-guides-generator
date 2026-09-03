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
  const looksLikeFile = /\.[a-z0-9]{2,5}$/i.test(rel);
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

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const relPage = path.relative(distRoot, file);

    for (const match of html.matchAll(LINK_RE)) {
      const href = match[1];
      if (!href || NON_PATH_RE.test(href)) continue;
      internalLinksExamined += 1;
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

  if (problems.length) {
    throw new Error(`LINK AUDIT FAIL\n\n${problems.join('\n\n')}`);
  }

  console.log(
    `✅ LINK AUDIT PASS: ${files.length} page(s), ${internalLinksExamined} internal link(s) resolved, ` +
    `${mailtoAnchorsExamined} mailto anchor(s) fenced.`
  );
  return { files: files.length, internalLinksExamined, mailtoAnchorsExamined };
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
