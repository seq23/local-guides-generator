#!/usr/bin/env node
// entity_backlink_watch: the weekly check that each publication's external
// identity (data/entity/<pack>/entity.json) is still true, and the self-heal
// that keeps it true. Run by .github/workflows/entity_backlink_watch.yml
// (Mondays + workflow_dispatch). $0: plain HTTP fetches, no paid API.
//
// For every sameAs URL:
//   resolves (2xx after redirects, browser UA)?
//     no, twice  -> DEAD: removed from sameAs (self-heal, through a PR)
//   JS-rendered platform (Instagram, Gumroad, Google Maps, TikTok, LinkedIn)?
//     -> UNVERIFIABLE: a named state, never counted as a pass
//   page contains the site's host?
//     yes -> LINKED_BACK
//     no  -> NAMED STOP NO_LINK_BACK: the exact profile field the owner edits
// For every profiles_pending entry:
//   resolves AND links back -> PROMOTED into sameAs (self-heal)
//   otherwise stays pending (named state PENDING / PENDING_UNVERIFIABLE)
// A publication with an empty sameAs is the named stop NO_EXTERNAL_PROFILE.
// Zero publications is a failure: the watch never exits 0 having checked nothing.
//
// Usage: node scripts/entity_backlink_watch.mjs [--apply] [--report <path>]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eg = require(path.join(ROOT, 'scripts', 'lib', 'entity_graph.js'));
const { PACK_SITE_CONFIG } = require(path.join(ROOT, 'scripts', 'lib', 'pack_site_config.js'));

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// Profiles whose content is rendered client-side or walled to bots: a fetch
// cannot see a link-back, so the state is recorded, never passed.
const UNVERIFIABLE_HOSTS = [/(^|\.)instagram\.com$/, /(^|\.)gumroad\.com$/, /(^|\.)tiktok\.com$/, /(^|\.)linkedin\.com$/, /^maps\.google\./, /^g\.page$/, /^maps\.app\.goo\.gl$/];

// Where the owner edits the link-back on each platform.
const LINK_FIELD = [
  [/(^|\.)facebook\.com$/, 'Facebook Page > Edit Page info > Website'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'Pinterest profile > Edit profile > Website (and claim the site)'],
  [/(^|\.)youtube\.com$/, 'YouTube Studio > Customization > Basic info > Links'],
  [/(^|\.)github\.com$/, 'GitHub profile/org > Edit > Website'],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, 'X profile > Edit profile > Website'],
  [/(^|\.)crunchbase\.com$/, 'Crunchbase organization > Edit > Website'],
  [/(^|\.)wikidata\.org$/, 'Wikidata item > official website (P856)'],
];

export function isUnverifiable(url) {
  const h = eg.hostOf(url);
  if (/google\.[a-z.]+$/.test(h) && /\/maps/.test(url)) return true;
  return UNVERIFIABLE_HOSTS.some((re) => re.test(h));
}

export function linkField(url) {
  const h = eg.hostOf(url);
  const hit = LINK_FIELD.find(([re]) => re.test(h));
  return hit ? hit[1] : 'the profile\'s website / links field';
}

async function defaultFetch(url) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
  const body = res.ok ? await res.text() : '';
  return { status: res.status, body };
}

async function probe(url, fetcher) {
  let last = { status: 0, body: '', error: '' };
  for (let i = 0; i < 2; i += 1) {
    try {
      const r = await fetcher(url);
      last = { status: r.status, body: r.body || '', error: '' };
      if (r.status >= 200 && r.status < 300) return last;
    } catch (e) {
      last = { status: 0, body: '', error: String(e && e.message || e) };
    }
  }
  return last;
}

// Pure decision over one publication; returns its findings and the entity to write.
export async function watchEntity(key, entity, siteHost, fetcher = defaultFetch, today = new Date().toISOString().slice(0, 10)) {
  const findings = [];
  const keep = [];
  const log = [];
  for (const url of entity.sameAs || []) {
    const r = await probe(url, fetcher);
    if (!(r.status >= 200 && r.status < 300)) {
      findings.push({ key, url, state: 'DEAD', detail: r.error || `HTTP ${r.status}` });
      log.push({ date: today, action: 'removed_from_sameAs', url, reason: r.error || `HTTP ${r.status}` });
      continue;
    }
    keep.push(url);
    if (isUnverifiable(url)) findings.push({ key, url, state: 'UNVERIFIABLE', detail: 'JS-rendered or bot-walled profile; link-back cannot be read by a fetch' });
    else if (r.body.toLowerCase().includes(siteHost)) findings.push({ key, url, state: 'LINKED_BACK' });
    else findings.push({ key, url, state: 'NO_LINK_BACK', stop: true, detail: `owner login: add https://${siteHost}/ in ${linkField(url)}` });
  }
  const stillPending = [];
  for (const p of entity.profiles_pending || []) {
    const url = (p && p.url) || p;
    if (isUnverifiable(url)) { findings.push({ key, url, state: 'PENDING_UNVERIFIABLE', detail: 'cannot be confirmed by a fetch; promote by hand once it exists and links back' }); stillPending.push(p); continue; }
    const r = await probe(url, fetcher);
    if (r.status >= 200 && r.status < 300 && r.body.toLowerCase().includes(siteHost)) {
      keep.push(url);
      findings.push({ key, url, state: 'PROMOTED' });
      log.push({ date: today, action: 'promoted_to_sameAs', url, reason: `resolves (HTTP ${r.status}) and links back to ${siteHost}` });
    } else {
      stillPending.push(p);
      findings.push({ key, url, state: 'PENDING', detail: r.status ? `HTTP ${r.status}${r.status < 300 ? ', no link-back yet' : ''}` : (r.error || 'unreachable') });
    }
  }
  if (!keep.length) findings.push({ key, url: '', state: 'NO_EXTERNAL_PROFILE', stop: true, detail: `owner login: create a real profile for ${entity.name} and add it to data/entity/${key}/entity.json profiles_pending` });
  const changed = log.length > 0;
  const next = changed ? { ...entity, sameAs: keep, profiles_pending: stillPending, watch_log: [...(entity.watch_log || []), ...log] } : entity;
  return { findings, changed, entity: next };
}

export async function runWatch({ apply = false, fetcher = defaultFetch, entityRoot = eg.ENTITY_ROOT, keys } = {}) {
  const pubs = keys || eg.publicationKeys();
  if (!pubs.length) throw new Error('ENTITY WATCH FAIL: zero publications to watch. Nothing was checked.');
  const all = [];
  const changedKeys = [];
  for (const key of pubs) {
    const entity = eg.loadEntity(key, entityRoot);
    if (!entity) throw new Error(`ENTITY WATCH FAIL: data/entity/${key}/entity.json missing`);
    const host = eg.hostOf(PACK_SITE_CONFIG[key] ? PACK_SITE_CONFIG[key].siteUrl : entity.url);
    const r = await watchEntity(key, entity, host, fetcher);
    all.push(...r.findings);
    if (r.changed) {
      changedKeys.push(key);
      if (apply) fs.writeFileSync(eg.entityPath(key, entityRoot), JSON.stringify(r.entity, null, 2) + '\n');
    }
  }
  return { publications: pubs.length, findings: all, changed: changedKeys };
}

function summarize(res) {
  const lines = [`Entity backlink watch: ${res.publications} publication(s), ${res.findings.length} finding(s).`];
  for (const f of res.findings) lines.push(`- ${f.stop ? 'NAMED STOP ' : ''}${f.state} [${f.key}] ${f.url || ''}${f.detail ? ` - ${f.detail}` : ''}`);
  if (res.changed.length) lines.push(`Self-heal: entity.json changed for ${res.changed.join(', ')}.`);
  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes('--apply');
  const ri = process.argv.indexOf('--report');
  try {
    const res = await runWatch({ apply });
    const text = summarize(res);
    console.log(text);
    if (ri > 0) fs.writeFileSync(process.argv[ri + 1], JSON.stringify(res, null, 2) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text.replace(/^- /gm, '* ') + '\n');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
