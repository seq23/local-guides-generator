#!/usr/bin/env node
/**
 * Post-deploy live check: what the edge actually serves.
 *
 * Why this exists. The build can pass every validator and the edge can still
 * serve the wrong thing - a Worker that 301'd robots.txt did exactly that, and
 * `dist/` looked perfect throughout. Nothing in this repository ever looked at
 * the live sites after a deploy, so Search Readiness item h4 ("post-deploy live
 * check: crawl files, icons, og image, schema types, redirects of measured
 * URLs, IndexNow key") failed on all six canonical hosts at once.
 *
 * What it checks, per host in distribution.config.json (one source of truth for
 * the host list, so a seventh site is covered the day it is added):
 *   - robots.txt            200, names a sitemap, does not disallow everything
 *   - sitemap.xml           200, parses, lists at least one sub-sitemap or URL
 *   - every sub-sitemap     200, parses, carries at least one <loc>
 *                           (an empty sitemap is what Search Console counts as
 *                           an error, and it is how two hosts got there)
 *   - llms.txt              200
 *   - icon-512.png, og.png  200 and an image content-type (the Organization
 *                           logo and the social card are claims about files)
 *   - IndexNow key file     200 and its body is the key name
 *   - homepage JSON-LD      parses, and carries Organization and WebSite
 *   - the canonical host    answers 200 without redirecting away from itself
 *
 * What it deliberately does not do. It never writes, never deploys and never
 * calls a model (the repo's zero-paid policy: see CLAUDE.md). A 401/403/429
 * from a third party is not consulted at all, because nothing here is a third
 * party - every URL is one of ours.
 *
 * Exit code 1 on any failure, with every failure printed, so a red run names
 * the host and the file rather than "live check failed".
 *
 * Usage: node scripts/ops/live_check.mjs [--host <host>] [--timeout-ms 15000]
 */
import fs from 'node:fs';

const UA = 'local-guides-live-check/1.0 (+https://theindustryguides.com)';
const args = process.argv.slice(2);
const onlyHost = (() => { const i = args.indexOf('--host'); return i >= 0 ? args[i + 1] : ''; })();
const TIMEOUT = (() => { const i = args.indexOf('--timeout-ms'); return i >= 0 ? Number(args[i + 1]) : 20000; })();

const cfg = JSON.parse(fs.readFileSync('distribution.config.json', 'utf8'));
const hosts = (cfg.indexnow?.hosts || []).filter((h) => !onlyHost || h === onlyHost);
if (!hosts.length) {
  console.error('live_check: no hosts to check (distribution.config.json indexnow.hosts).');
  process.exit(1);
}

const failures = [];
const notes = [];
let checks = 0;

const fail = (host, what, why) => failures.push(`${host}: ${what} — ${why}`);

/** One GET with a timeout and two retries: a flake is not a defect. */
async function get(url, { method = 'GET' } = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { method, redirect: 'follow', signal: ac.signal, headers: { 'user-agent': UA } });
      const body = method === 'GET' ? await res.text() : '';
      return { status: res.status, url: res.url, type: res.headers.get('content-type') || '', body };
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  return { status: 0, url, type: '', body: '', error: last ? String(last.message || last) : 'unreachable' };
}

const locs = (xml) => [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

async function checkHost(host) {
  const base = `https://${host}`;

  // The canonical host must answer for itself, not hand the reader somewhere else.
  checks += 1;
  const home = await get(`${base}/`);
  if (home.status !== 200) fail(host, '/', `answered ${home.status || home.error}`);
  else {
    try {
      const landed = new URL(home.url).hostname.replace(/^www\./, '');
      if (landed !== host.replace(/^www\./, '')) fail(host, '/', `redirected to ${landed}`);
    } catch { /* unparseable final URL is covered by the status check */ }
  }

  // robots.txt
  checks += 1;
  const robots = await get(`${base}/robots.txt`);
  if (robots.status !== 200) fail(host, 'robots.txt', `answered ${robots.status || robots.error}`);
  else {
    if (!/sitemap:/i.test(robots.body)) fail(host, 'robots.txt', 'names no Sitemap:');
    if (/^\s*user-agent:\s*\*\s*$\s*^\s*disallow:\s*\/\s*$/im.test(robots.body)) {
      fail(host, 'robots.txt', 'disallows the whole site for every crawler');
    }
  }

  // sitemap index and every sub-sitemap it names
  checks += 1;
  const index = await get(`${base}/sitemap.xml`);
  if (index.status !== 200) fail(host, 'sitemap.xml', `answered ${index.status || index.error}`);
  else {
    const children = locs(index.body);
    if (!children.length) fail(host, 'sitemap.xml', 'lists no sub-sitemaps and no URLs');
    const subs = children.filter((u) => /\.xml(\?|$)/i.test(u));
    for (const sub of subs) {
      checks += 1;
      const r = await get(sub);
      const name = sub.replace(base, '');
      if (r.status !== 200) { fail(host, name, `answered ${r.status || r.error}`); continue; }
      const urls = locs(r.body);
      // An empty sub-sitemap is a submission Search Console reports as an error.
      if (!urls.length) fail(host, name, 'is listed in the index but carries 0 URLs');
      const foreign = urls.filter((u) => { try { return new URL(u).hostname.replace(/^www\./, '') !== host; } catch { return true; } });
      if (foreign.length) fail(host, name, `${foreign.length} URL(s) are not on ${host}, e.g. ${foreign[0]}`);
    }
  }

  // llms.txt, the logo and the social card
  for (const [file, wantImage] of [['/llms.txt', false], ['/icon-512.png', true], ['/og.png', true]]) {
    checks += 1;
    const r = await get(`${base}${file}`);
    if (r.status !== 200) { fail(host, file, `answered ${r.status || r.error}`); continue; }
    if (wantImage && !/^image\//i.test(r.type)) fail(host, file, `content-type is ${r.type || 'unset'}, not an image`);
  }

  // IndexNow key: the file has to exist and contain the key it is named for.
  checks += 1;
  const keyName = (cfg.indexnow?.key_file || '').replace(/^\//, '') || `${(cfg.indexnow?.key || '')}.txt`;
  if (!keyName || keyName === '.txt') {
    notes.push(`${host}: IndexNow key file not named in distribution.config.json; skipped`);
  } else {
    const r = await get(`${base}/${keyName}`);
    if (r.status !== 200) fail(host, `/${keyName}`, `IndexNow key file answered ${r.status || r.error}`);
    else if (r.body.trim() !== keyName.replace(/\.txt$/, '')) {
      fail(host, `/${keyName}`, 'IndexNow key file does not contain its own key');
    }
  }

  // The homepage's structured data, which is what the entity checks read.
  checks += 1;
  if (home.status === 200) {
    const blocks = [...home.body.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
    if (!blocks.length) fail(host, '/', 'homepage carries no JSON-LD');
    const types = new Set();
    for (const b of blocks) {
      let parsed;
      try { parsed = JSON.parse(b); } catch { fail(host, '/', 'a homepage JSON-LD block does not parse'); continue; }
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
          const t = n['@type'];
          (Array.isArray(t) ? t : [t]).filter(Boolean).forEach((x) => types.add(String(x)));
          Object.values(n).forEach(walk);
        }
      };
      walk(parsed);
    }
    if (blocks.length) {
      for (const want of ['Organization', 'WebSite']) {
        if (!types.has(want)) fail(host, '/', `homepage JSON-LD has no ${want} (saw: ${[...types].join(', ') || 'nothing'})`);
      }
    }
  }
}

for (const host of hosts) {
  // Sequential on purpose: six hosts is small, and a burst of parallel requests
  // against our own edge is the kind of thing that produces a flake and then a
  // false red.
  // eslint-disable-next-line no-await-in-loop
  await checkHost(host);
}

notes.forEach((n) => console.log(`  !! ${n}`));
if (failures.length) {
  console.error(`❌ LIVE CHECK FAIL — ${failures.length} problem(s) across ${hosts.length} host(s), ${checks} checks run:`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`✅ LIVE CHECK PASS — ${hosts.length} host(s), ${checks} checks: crawl files, icons, og image, IndexNow key, sitemaps non-empty and on-host, homepage Organization + WebSite.`);
