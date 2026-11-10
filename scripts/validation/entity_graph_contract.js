/* eslint-disable no-console */
//
// validate_entity_graph: each publication's identity is one list, it is true,
// and the rendered pages say exactly that.
//
// Why it exists (authority audit, 30 Oct 2026). All six sites emitted
// `sameAs` = the umbrella company's hub page - the parent, not an external
// profile - so nothing outside the family of sites identified them, no check
// noticed, and no YMYL page said who stands behind it. The fix moved identity
// into data/entity/<pack>/entity.json and reviewers into reviewers.json
// (scripts/lib/entity_graph.js). This contract holds them:
//
// Static (always):
//   - one entity.json per publication in PACK_SITE_CONFIG; zero publications fails
//   - @id / name / url / logo agree with the pack config; a one-line description
//   - sameAs: https, unique, never this site's host, the umbrella's host or a
//     sibling publication's host (those are parent/siblings, not profiles), and
//     never also listed in profiles_pending
//   - parentOrganization is The Industry Guides' @id
//   - no page set carries its own schema.sameAs (one list, not two)
//   - every reviewer has name, credential, url and written consent on file
// Rendered (when dist/ is present; the hard-fail tier runs per pack):
//   - every page's Organization node for this site equals entity.json
//     (@id, name, logo, description, parentOrganization, sameAs)
//   - no Person anywhere in JSON-LD that is not a consented reviewer
//   - every content page (Article pages included) carries the byline; while
//     reviewers.json is empty it is the editorial-desk line linking
//     /editorial-policy/
//   - zero Organization nodes or zero bylined pages examined fails
const fs = require('fs');
const path = require('path');

const LD_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function fail(msg) { throw new Error(`ENTITY GRAPH FAIL: ${msg}`); }

function walkHtml(root) {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name === 'index.html') out.push(p);
    }
  })(root);
  return out.sort();
}

function nodesOf(v, out = []) {
  if (Array.isArray(v)) { v.forEach((n) => nodesOf(n, out)); return out; }
  if (!v || typeof v !== 'object') return out;
  if (v['@type']) out.push(v);
  for (const [k, x] of Object.entries(v)) if (k !== '@context' && x && typeof x === 'object') nodesOf(x, out);
  return out;
}

function checkStatic(ctx) {
  const { PACK_SITE_CONFIG } = require(path.join(ctx.repoRoot, 'scripts', 'lib', 'pack_site_config.js'));
  const eg = require(path.join(ctx.repoRoot, 'scripts', 'lib', 'entity_graph.js'));
  const entityRoot = ctx.entityRoot || eg.ENTITY_ROOT;
  const keys = Object.keys(PACK_SITE_CONFIG).filter((k) => PACK_SITE_CONFIG[k].umbrellaPath);
  if (!keys.length) fail('zero publications in PACK_SITE_CONFIG. Nothing was checked.');
  const problems = [];
  const familyHosts = new Set([eg.hostOf(eg.UMBRELLA_HOST), ...keys.map((k) => eg.hostOf(PACK_SITE_CONFIG[k].siteUrl))]);
  let reviewersSeen = 0;
  for (const key of keys) {
    const cfg = PACK_SITE_CONFIG[key];
    const base = cfg.siteUrl.replace(/\/+$/, '');
    const e = eg.loadEntity(key, entityRoot);
    if (!e) { problems.push(`${key}: data/entity/${key}/entity.json missing`); continue; }
    if (e['@id'] !== `${base}/#organization`) problems.push(`${key}: @id ${e['@id']} is not ${base}/#organization`);
    if (e.name !== cfg.brandName) problems.push(`${key}: name "${e.name}" is not the pack brandName "${cfg.brandName}"`);
    if (e.url !== `${base}/`) problems.push(`${key}: url ${e.url} is not ${base}/`);
    if (e.logo !== `${base}/icon-512.png`) problems.push(`${key}: logo ${e.logo} is not ${base}/icon-512.png`);
    if (typeof e.description !== 'string' || e.description.trim().length < 40 || /\n/.test(e.description)) problems.push(`${key}: description must be one line of at least 40 characters`);
    if (!Array.isArray(e.sameAs)) problems.push(`${key}: sameAs must be an array (empty until a real external profile exists)`);
    if (!Array.isArray(e.profiles_pending)) problems.push(`${key}: profiles_pending must be an array`);
    const same = Array.isArray(e.sameAs) ? e.sameAs : [];
    const pending = (Array.isArray(e.profiles_pending) ? e.profiles_pending : []).map((p) => (p && p.url) || p);
    if (new Set(same).size !== same.length) problems.push(`${key}: sameAs has duplicates`);
    for (const u of same) {
      if (!/^https:\/\//.test(String(u))) problems.push(`${key}: sameAs ${u} is not an https URL`);
      const h = eg.hostOf(u);
      if (familyHosts.has(h)) problems.push(`${key}: sameAs ${u} is on ${h}, this site or its own family (self-reference); the umbrella belongs in parentOrganization`);
      if (pending.includes(u)) problems.push(`${key}: ${u} is in both sameAs and profiles_pending`);
    }
    for (const u of pending) if (!/^https:\/\//.test(String(u))) problems.push(`${key}: profiles_pending ${u} is not an https URL`);
    const parent = e.parentOrganization || {};
    if (parent['@id'] !== eg.PARENT_ID) problems.push(`${key}: parentOrganization @id ${parent['@id']} is not ${eg.PARENT_ID}`);
    if (parent.name !== eg.PARENT_COMPANY) problems.push(`${key}: parentOrganization name "${parent.name}" is not "${eg.PARENT_COMPANY}"`);
    for (const slug of cfg.pageSetSlugs || []) {
      const ps = path.join(ctx.repoRoot, 'data', 'page_sets', 'examples', slug);
      if (!fs.existsSync(ps)) continue;
      const doc = JSON.parse(fs.readFileSync(ps, 'utf8'));
      if (doc && doc.schema && Object.prototype.hasOwnProperty.call(doc.schema, 'sameAs')) problems.push(`${key}: page set ${slug} declares schema.sameAs; sameAs lives only in data/entity/${key}/entity.json`);
    }
    const rp = eg.reviewersPath(key, entityRoot);
    if (!fs.existsSync(rp)) { problems.push(`${key}: data/entity/${key}/reviewers.json missing (it ships with an empty list)`); continue; }
    const rdoc = JSON.parse(fs.readFileSync(rp, 'utf8'));
    if (!Array.isArray(rdoc.reviewers)) problems.push(`${key}: reviewers.json must hold a "reviewers" array`);
    for (const r of rdoc.reviewers || []) {
      reviewersSeen += 1;
      const who = (r && r.name) || '(unnamed)';
      if (!r || !r.name || !r.credential || !r.url) problems.push(`${key}: reviewer ${who} needs name, credential and url`);
      const c = (r && r.consent) || {};
      if (c.written !== true || !/^\d{4}-\d{2}-\d{2}$/.test(String(c.date || '')) || !c.record) problems.push(`${key}: reviewer ${who} has no written consent on file (consent.written true, consent.date, consent.record)`);
    }
  }
  if (problems.length) fail(`${problems.length} problem(s) in data/entity:\n  ${problems.join('\n  ')}`);
  return { publications: keys.length, reviewers: reviewersSeen };
}

function activePack(ctx) {
  const { getPackKeyFromPageSet, PACK_SITE_CONFIG } = require(path.join(ctx.repoRoot, 'scripts', 'lib', 'pack_site_config.js'));
  const fromEnv = getPackKeyFromPageSet(process.env.PAGE_SET_FILE || '');
  if (fromEnv) return fromEnv;
  // validate:all after build_all_packs runs without PAGE_SET_FILE: read the host
  // from the built homepage's canonical.
  const home = path.join(ctx.distRoot, 'index.html');
  if (!fs.existsSync(home)) return '';
  const m = fs.readFileSync(home, 'utf8').match(/<link rel="canonical" href="(https:\/\/[^/"]+)/);
  if (!m) return '';
  return Object.keys(PACK_SITE_CONFIG).find((k) => PACK_SITE_CONFIG[k].siteUrl === m[1]) || '';
}

function checkRendered(ctx) {
  const eg = require(path.join(ctx.repoRoot, 'scripts', 'lib', 'entity_graph.js'));
  const key = activePack(ctx);
  if (!key) return { skipped: 'dist is not a publication pack' };
  const entityRoot = ctx.entityRoot || eg.ENTITY_ROOT;
  const e = eg.loadEntity(key, entityRoot);
  const consented = new Set(eg.consentedReviewers(key, entityRoot).map((r) => r.name));
  const wantSame = JSON.stringify(e.sameAs || []);
  const files = walkHtml(ctx.distRoot);
  const problems = [];
  let orgNodes = 0;
  let bylined = 0;
  for (const f of files) {
    const rel = path.relative(ctx.distRoot, f);
    const html = fs.readFileSync(f, 'utf8');
    let hasArticle = false;
    for (const m of html.matchAll(LD_RE)) {
      let parsed;
      try { parsed = JSON.parse(m[1]); } catch (_) { continue; }
      for (const n of nodesOf(parsed)) {
        const types = [].concat(n['@type']);
        if (types.includes('Article')) hasArticle = true;
        if (types.includes('Person') && !consented.has(n.name)) problems.push(`${rel}: JSON-LD claims Person "${n.name}", who is not a consented reviewer in data/entity/${key}/reviewers.json`);
        if (types.includes('Organization') && n.url === e.url && n['@context']) {
          orgNodes += 1;
          if (n['@id'] !== e['@id']) problems.push(`${rel}: Organization @id ${n['@id']} != ${e['@id']}`);
          if (n.name !== e.name) problems.push(`${rel}: Organization name "${n.name}" != "${e.name}"`);
          if (!n.logo || n.logo.url !== e.logo) problems.push(`${rel}: Organization logo does not match entity.json`);
          if (n.description !== e.description) problems.push(`${rel}: Organization description does not match entity.json`);
          if (!n.parentOrganization || n.parentOrganization['@id'] !== e.parentOrganization['@id']) problems.push(`${rel}: Organization parentOrganization is not ${e.parentOrganization['@id']}`);
          if (JSON.stringify(n.sameAs || []) !== wantSame) problems.push(`${rel}: Organization sameAs ${JSON.stringify(n.sameAs || [])} != entity.json ${wantSame}`);
        }
      }
    }
    const isContent = /<main id="main-content"/.test(html) && !/data-home-trust-line="true"/.test(html);
    const by = html.match(/<p class="page-byline" data-page-byline="([^"]+)">([\s\S]*?)<\/p>/);
    if (by) bylined += 1;
    if ((isContent || hasArticle) && !by) problems.push(`${rel}: content page has no editorial byline`);
    if (by) {
      if (!/href="\/editorial-policy\/"/.test(by[2])) problems.push(`${rel}: byline does not link /editorial-policy/`);
      if (consented.size === 0 && by[1] !== 'editorial-desk') problems.push(`${rel}: byline "${by[1]}" names a reviewer but reviewers.json has no consented reviewer`);
      if (consented.size > 0 && by[1] !== 'reviewed') problems.push(`${rel}: reviewers.json has consented reviewers but the byline is "${by[1]}"`);
    }
  }
  if (orgNodes === 0) fail(`examined ${files.length} page(s) of ${key} and found zero Organization nodes for ${e.url}. Nothing was checked.`);
  if (bylined === 0) fail(`examined ${files.length} page(s) of ${key} and found zero bylined pages. Nothing was checked.`);
  if (problems.length) {
    const byMsg = new Map();
    for (const p of problems) {
      const msg = p.replace(/^[^:]+: /, '');
      if (!byMsg.has(msg)) byMsg.set(msg, []);
      byMsg.get(msg).push(p.split(': ')[0]);
    }
    const lines = [...byMsg.entries()].slice(0, 20).map(([msg, pages]) => `  ${msg}  <- ${pages.length} page(s), e.g. ${pages[0]}`);
    fail(`${problems.length} rendered problem(s) on ${key}:\n${lines.join('\n')}\nFix data/entity/${key}/ or the generator, never dist/.`);
  }
  return { pack: key, pages: files.length, orgNodes, bylined };
}

function run(ctx = {}) {
  const repoRoot = ctx.repoRoot || path.resolve(__dirname, '..', '..');
  const c = { ...ctx, repoRoot, distRoot: ctx.distRoot || path.join(repoRoot, 'dist') };
  const s = checkStatic(c);
  const r = fs.existsSync(c.distRoot) ? checkRendered(c) : { skipped: 'no dist/' };
  console.log(`✅ ENTITY GRAPH PASS: ${s.publications} publication(s), ${s.reviewers} reviewer(s) on file; rendered: ${r.skipped ? r.skipped : `${r.pack} ${r.pages} page(s), ${r.orgNodes} Organization node(s) match entity.json, ${r.bylined} bylined page(s)`}.`);
  return { static: s, rendered: r };
}

module.exports = { run, checkStatic, checkRendered };

if (require.main === module) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
