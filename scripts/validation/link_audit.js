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
// 6. No internal <a href> (relative, or absolute on this site's host) carries
//    a query string unless its path is in config/internal_query_allowlist.json.
//    Tracked internal links made every attribution combination its own
//    crawlable URL (Ahrefs: 1,306 uscisexam URLs/week vs 228 in the sitemap).
//    Attribution belongs in data-attr-qs (restored by /assets/attr-carry.js).
// 7. Every sitemap page must be REACHABLE from the home page by following
//    query-free <a href> links (a crawler's view). An inbound link from a page
//    that is itself unreachable is an orphan island, and Ahrefs reports every
//    page in it as an orphan just the same.
// 8. No internal <a href> or rel=canonical may point at a URL that answers
//    3XX: a directory page without its trailing slash, /index.html or a .html
//    spelling (Pages answers 308), the http:// or www. spelling of the host, or
//    a source path in dist/_redirects. Ahrefs (14 Oct 2026) reported "3XX
//    redirect" on uscisexam (2) and theaccidentguides (1). Link the final URL.
// 9. Every indexable sitemap page has clean <a href> links from at least TWO
//    different indexable pages, and no internal <a href> points at a page that
//    is not indexable (meta robots noindex, or canonical to another URL).
//    Ahrefs (14 Oct 2026): "only one dofollow incoming internal link" on 126
//    uscisexam and 128 theaccidentguides pages.
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
const QUERY_ALLOW_PATH = path.join('config', 'internal_query_allowlist.json');
const A_TAG_RE = /<a\b[^>]*>/gi;

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

// Source paths that dist/_redirects answers with a 3XX (a 200 rewrite is not a redirect).
function loadRedirectSources(distRoot) {
  const p = path.join(distRoot, '_redirects');
  const out = new Set();
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (!parts[0] || parts[0].startsWith('#') || parts.length < 2) continue;
    const status = Number(parts[2] || 301);
    if (status >= 300 && status < 400) out.add(parts[0].replace(/\/+$/, '') || '/');
  }
  return out;
}

// Why an internal href would answer 3XX on Cloudflare Pages, or null.
function redirectReason(distRoot, siteHost, redirectSources, raw) {
  let pathPart;
  if (/^https?:\/\//i.test(raw)) {
    let u;
    try { u = new URL(raw); } catch (_) { return null; }
    const h = u.hostname.toLowerCase();
    if (h.replace(/^www\./, '') !== siteHost.replace(/^www\./, '')) return null; // not this site
    if (h !== siteHost) return `host ${h} redirects to ${siteHost}`;
    if (u.protocol !== 'https:') return 'http:// redirects to https://';
    pathPart = u.pathname;
  } else if (/^\/(?!\/)/.test(raw)) {
    pathPart = raw.split('#')[0].split('?')[0];
  } else {
    return null;
  }
  if (!pathPart || pathPart === '/') return null;
  if (redirectSources.has(pathPart.replace(/\/+$/, ''))) return 'listed in _redirects';
  const rel = pathPart.replace(/^\/+/, '');
  if (/(^|\/)index\.html$/i.test(rel)) return 'index.html is served at its directory (308)';
  if (/\.html$/i.test(rel) && fs.existsSync(path.join(distRoot, rel))) return '.html is served without the extension (308)';
  if (!rel.endsWith('/') && !/\.[a-z0-9]{2,12}$/i.test(rel) && fs.existsSync(path.join(distRoot, rel, 'index.html'))) {
    return 'missing trailing slash (308)';
  }
  return null;
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
  const queryAllow = (() => {
    const p = path.join(repoRoot, QUERY_ALLOW_PATH);
    if (!fs.existsSync(p)) throw new Error(`LINK AUDIT FAIL: ${QUERY_ALLOW_PATH} missing.`);
    return (JSON.parse(fs.readFileSync(p, 'utf8')).prefixes || []).map(String);
  })();
  const smForHost = sitemapPaths(distRoot);
  let siteHost = '';
  try {
    const idx = path.join(distRoot, 'sitemap.xml');
    const m = fs.existsSync(idx) && fs.readFileSync(idx, 'utf8').match(/<loc>\s*(https?:\/\/[^<\s]+)/);
    siteHost = m ? new URL(m[1]).hostname.toLowerCase() : '';
  } catch (_) { siteHost = ''; }
  void smForHost;
  const queryHrefs = new Map(); // path -> [page, ...]
  const carryTargets = new Map(); // dist key of a data-attr-qs destination -> example source
  const pagesWithCarry = new Set();
  let internalAnchorsExamined = 0;
  const graph = new Map(); // page key -> Set of page keys it links to with a clean <a href>
  const redirecting = new Map(); // href -> [page, ...]
  const redirectSources = loadRedirectSources(distRoot);
  const notIndexable = new Map(); // page key -> reason
  const noteRedirect = (href, relPage, why) => {
    const k = `${href}  (${why})`;
    if (!redirecting.has(k)) redirecting.set(k, []);
    redirecting.get(k).push(relPage);
  };

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

    const selfK = pageKey(distRoot, file, '/' + relPage.split(path.sep).join('/'));
    if (html.includes('data-attr-carry="true"')) pagesWithCarry.add(selfK);
    if (!graph.has(selfK)) graph.set(selfK, new Set());
    const robots = (html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i) || [''])[0];
    if (/noindex/i.test(robots)) notIndexable.set(selfK, 'noindex');
    const canon = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
    const canonHref = canon && (canon[0].match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (canonHref && siteHost) {
      const why = redirectReason(distRoot, siteHost, redirectSources, decodeHref(canonHref));
      if (why) noteRedirect(`canonical ${canonHref}`, relPage, why);
      const ck = pageKey(distRoot, file, (() => { try { const u = new URL(decodeHref(canonHref)); return u.pathname; } catch (_) { return decodeHref(canonHref); } })());
      if (ck !== null && ck !== selfK && !notIndexable.has(selfK)) notIndexable.set(selfK, `canonical points to /${ck}`);
    }
    // Crawl graph: only <a href> outside <script>, the links a crawler follows.
    const crawlable = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    for (const tagMatch of crawlable.matchAll(A_TAG_RE)) {
      const hm = tagMatch[0].match(/\bhref=["']([^"']+)["']/i);
      if (!hm) continue;
      const raw = decodeHref(hm[1]);
      let local = null;
      if (/^\/(?!\/)/.test(raw)) local = raw;
      else if (siteHost && /^https?:\/\//i.test(raw)) {
        try {
          const u = new URL(raw);
          if (u.hostname.toLowerCase().replace(/^www\./, '') === siteHost.replace(/^www\./, '')) local = u.pathname + u.search;
        } catch (_) { local = null; }
      }
      if (siteHost && (local !== null || /^https?:\/\//i.test(raw))) {
        const why = redirectReason(distRoot, siteHost, redirectSources, raw);
        if (why) noteRedirect(hm[1], relPage, why);
      }
      if (local === null || /\?./.test(local.split('#')[0])) continue;
      const tk = pageKey(distRoot, file, local);
      if (tk !== null && tk !== selfK) graph.get(selfK).add(tk);
    }
    for (const tagMatch of html.matchAll(A_TAG_RE)) {
      const hm = tagMatch[0].match(/\bhref=["']([^"']+)["']/i);
      if (!hm) continue;
      if (/\bdata-attr-qs=/i.test(tagMatch[0]) && /^\/(?!\/)/.test(hm[1])) {
        const tk = pageKey(distRoot, file, hm[1]);
        if (tk !== null && !carryTargets.has(tk)) carryTargets.set(tk, relPage);
      }
      const raw = decodeHref(hm[1]);
      let pathPart = null;
      let query = '';
      if (/^\/(?!\/)/.test(raw)) {
        const noHash = raw.split('#')[0];
        pathPart = noHash.split('?')[0];
        query = noHash.includes('?') ? noHash.slice(noHash.indexOf('?') + 1) : '';
      } else if (siteHost && /^https?:\/\//i.test(raw)) {
        try {
          const u = new URL(raw);
          if (u.hostname.toLowerCase().replace(/^www\./, '') === siteHost.replace(/^www\./, '')) { pathPart = u.pathname; query = u.search.replace(/^\?/, ''); }
        } catch (_) { pathPart = null; }
      }
      if (pathPart === null) continue;
      internalAnchorsExamined += 1;
      if (query && !queryAllow.some((pre) => pathPart.startsWith(pre))) {
        if (!queryHrefs.has(pathPart)) queryHrefs.set(pathPart, []);
        queryHrefs.get(pathPart).push(`${relPage} -> ${hm[1]}`);
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
    const islands = [];
    const reachable = new Set(['']);
    const queue = [''];
    while (queue.length) {
      for (const t of graph.get(queue.shift()) || []) {
        if (!reachable.has(t)) { reachable.add(t); queue.push(t); }
      }
    }
    for (const p of smPaths) {
      const k = pageKey(distRoot, path.join(distRoot, 'index.html'), p);
      if (k === null || k === '') continue; // the home page is the crawl root
      sitemapPagesExamined += 1;
      if (!inbound.get(k)) orphans.push(p);
      else if (!reachable.has(k)) islands.push(p);
    }
    const isPage = new Set(graph.keys());
    // Routes noindexed on purpose by scripts/apply_robots_policy.js (operator
    // panels; senior-living privacy/disclaimer) are still linked where the law or
    // the operator needs them, so a link to them is not a defect.
    // The pack is the one standing in dist/ (data/site.json), not only PAGE_SET_FILE.
    const policyNoindex = (() => {
      const robots = require(path.join(__dirname, '..', 'apply_robots_policy.js'));
      let ps = path.basename(String(process.env.PAGE_SET_FILE || ''));
      try { ps = path.basename(JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'site.json'), 'utf8')).pageSetFile || '') || ps; } catch (_) { /* fixture repo */ }
      return new Set([...robots.NOINDEX_ROUTES, ...(robots.NOINDEX_ROUTES_BY_PACK[ps] || [])]);
    })();
    const sources = new Map();
    const toNonIndexable = new Map();
    for (const [from, targets] of graph) {
      for (const t of targets) {
        if (notIndexable.has(t) && !policyNoindex.has(t.replace(/\/$/, ''))) {
          const k = `/${t}  (${notIndexable.get(t)})`;
          if (!toNonIndexable.has(k)) toNonIndexable.set(k, []);
          toNonIndexable.get(k).push(`/${from}`);
        }
        if (notIndexable.has(from) || !isPage.has(t)) continue;
        if (!sources.has(t)) sources.set(t, new Set());
        sources.get(t).add(from);
      }
    }
    const thin = [];
    for (const p of smPaths) {
      const k = pageKey(distRoot, path.join(distRoot, 'index.html'), p);
      if (k === null || k === '' || notIndexable.has(k) || !inbound.get(k)) continue;
      const n = (sources.get(k) || new Set()).size;
      if (n < 2) thin.push(`${p}  (${n} linking page${n === 1 ? '' : 's'}${n ? ': /' + [...sources.get(k)][0] : ''})`);
    }
    if (thin.length) {
      problems.push(
        `Thinly linked pages: ${thin.length} indexable sitemap URL(s) with clean links from fewer than two different indexable pages. ` +
        'Add a second contextual link from a related page (scripts/build_city_sites.js linkOrphanChildPages).\n' +
        thin.slice(0, 40).map((o) => `  ${o}`).join('\n') + (thin.length > 40 ? `\n  ...and ${thin.length - 40} more` : '')
      );
    }
    if (toNonIndexable.size) {
      const ranked = [...toNonIndexable.entries()].sort((a, b) => b[1].length - a[1].length);
      problems.push(
        `Internal links to non-indexable pages: ${ranked.length} target(s). Link the canonical indexable URL or drop the link.\n` +
        ranked.slice(0, 30).map(([t, v]) => `  ${t}  <- ${v.length} page(s), e.g. ${v[0]}`).join('\n')
      );
    }
    if (islands.length) {
      problems.push(
        `Unreachable pages: ${islands.length} sitemap URL(s) linked only from pages a crawler cannot reach from the home page ` +
        'by following clean <a href> links (an orphan island). Link each from a reachable parent in the generator.\n' +
        islands.slice(0, 40).map((o) => `  ${o}`).join('\n') +
        (islands.length > 40 ? `\n  ...and ${islands.length - 40} more` : '')
      );
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

  if (queryHrefs.size) {
    const ranked = [...queryHrefs.entries()].sort((a, b) => b[1].length - a[1].length);
    problems.push(
      `Internal links with a query string: ${ranked.reduce((n, [, v]) => n + v.length, 0)} link(s) to ${ranked.length} path(s). ` +
      'Each query is a separate crawlable URL. Put attribution in data-attr-qs (scripts/build_city_sites.js moveInternalQueryToData), ' +
      `or allow-list the path in ${QUERY_ALLOW_PATH} with the reason.\n` +
      ranked.slice(0, 30).map(([p, v]) => `  ${p}  <- ${v.length} link(s), e.g. ${v[0]}`).join('\n')
    );
  }
  const carryMissing = [...carryTargets.entries()].filter(([k]) => {
    const f = k === '' ? path.join(distRoot, 'index.html') : (/\.[a-z0-9]{2,12}$/i.test(k) ? path.join(distRoot, k) : path.join(distRoot, k, 'index.html'));
    return fs.existsSync(f) && !pagesWithCarry.has(k);
  });
  if (carryMissing.length) {
    problems.push(
      `Pages reached by data-attr-qs links that do not load /assets/attr-carry.js (their attribution would be lost): ${carryMissing.length}\n` +
      carryMissing.slice(0, 20).map(([k, src]) => `  /${k}  <- e.g. ${src}`).join('\n')
    );
  }
  if (redirecting.size) {
    const ranked = [...redirecting.entries()].sort((a, b) => b[1].length - a[1].length);
    problems.push(
      `Internal links to a URL that answers 3XX: ${ranked.length} distinct href(s). Link the final 200 URL; keep the redirect for outside links.\n` +
      ranked.slice(0, 30).map(([h, v]) => `  ${h}  <- ${v.length} link(s), e.g. ${v[0]}`).join('\n')
    );
  }
  if (internalAnchorsExamined === 0) problems.push('Examined zero internal <a href> links: the internal-query check checked nothing.');

  if (outboundExamined === 0) {
    problems.push('Examined zero outbound http(s) links: the dead-URL guard checked nothing.');
  }

  if (problems.length) {
    throw new Error(`LINK AUDIT FAIL\n\n${problems.join('\n\n')}`);
  }

  console.log(
    `✅ LINK AUDIT PASS: ${files.length} page(s), ${internalLinksExamined} internal link(s) resolved, ` +
    `${mailtoAnchorsExamined} mailto anchor(s) fenced, ${outboundExamined} outbound link(s) checked against ${dead.length} dead URL(s), ` +
    `${sitemapPagesExamined} sitemap page(s) each linked from another page, ${internalAnchorsExamined} internal <a href> query-free.`
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
