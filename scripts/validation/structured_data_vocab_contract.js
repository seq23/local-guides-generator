/* eslint-disable no-console */
//
// Every JSON-LD node on every rendered page uses schema.org types that exist
// and only properties schema.org defines for that type (or an ancestor type).
//
// Why it exists: the shared WebSite node carried correctionsPolicy,
// ethicsPolicy and ownershipFundingInfo, which schema.org defines on
// Organization only. Ahrefs (14 Oct 2026) reported "Structured data has
// schema.org validation error" on 436 uscisexam pages and 783
// theaccidentguides pages, every page built from the shared template. The
// existing schema checks asserted that types were PRESENT, never that the
// properties on them were valid.
//
// Vocabulary: data/contracts/schema_org_vocab.json, checked in so the build is
// offline (regenerate with scripts/validation/schema_org_vocab_build.js).
// Hard-fails on zero nodes examined.
const fs = require('fs');
const path = require('path');

const LD_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function collectHtml(root) {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(p);
    }
  })(root);
  return out.sort();
}

function loadVocab(repoRoot) {
  const p = path.join(repoRoot, 'data', 'contracts', 'schema_org_vocab.json');
  const v = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!v.types || Object.keys(v.types).length < 500 || !v.properties || Object.keys(v.properties).length < 1000) {
    throw new Error('STRUCTURED DATA VOCAB FAIL: data/contracts/schema_org_vocab.json is missing or truncated.');
  }
  const ancestors = new Map();
  const up = (t, seen = new Set()) => {
    if (ancestors.has(t)) return ancestors.get(t);
    const out = new Set([t]);
    for (const p of v.types[t] || []) if (!seen.has(p)) { seen.add(p); for (const a of up(p, seen)) out.add(a); }
    ancestors.set(t, out);
    return out;
  };
  return { types: v.types, properties: v.properties, ancestors: up };
}

const shortType = (t) => String(t).replace(/^https?:\/\/schema\.org\//, '').replace(/^schema:/, '');

function checkNode(node, vocab, where, problems, counter) {
  if (Array.isArray(node)) { node.forEach((n) => checkNode(n, vocab, where, problems, counter)); return; }
  if (!node || typeof node !== 'object') return;
  if (node['@graph']) checkNode(node['@graph'], vocab, where, problems, counter);
  const rawTypes = [].concat(node['@type'] || []).map(shortType);
  if (rawTypes.length) {
    counter.nodes += 1;
    const known = rawTypes.filter((t) => Object.prototype.hasOwnProperty.call(vocab.types, t));
    for (const t of rawTypes) if (!known.includes(t)) problems.push(`${where}: unknown schema.org type "${t}"`);
    if (known.length === rawTypes.length) {
      const lineage = new Set(known.flatMap((t) => [...vocab.ancestors(t)]));
      for (const key of Object.keys(node)) {
        if (key.startsWith('@')) continue;
        const domains = vocab.properties[key];
        if (!domains) problems.push(`${where}: ${rawTypes.join('+')}.${key} is not a schema.org property`);
        else if (domains.length && !domains.some((d) => lineage.has(d))) {
          problems.push(`${where}: ${key} is not a property of ${rawTypes.join('+')} (schema.org domain: ${domains.join(', ')})`);
        }
      }
    }
  }
  for (const [k, v] of Object.entries(node)) if (k !== '@context' && v && typeof v === 'object') checkNode(v, vocab, where, problems, counter);
}

function run(ctx) {
  const repoRoot = (ctx && ctx.repoRoot) || path.resolve(__dirname, '..', '..');
  const distRoot = path.join(repoRoot, 'dist');
  if (!fs.existsSync(distRoot)) throw new Error('STRUCTURED DATA VOCAB FAIL: dist/ missing. Build a pack first.');
  const vocab = loadVocab(repoRoot);
  const files = collectHtml(distRoot);
  const counter = { nodes: 0, blocks: 0 };
  const problems = [];
  for (const f of files) {
    const rel = path.relative(distRoot, f);
    for (const m of fs.readFileSync(f, 'utf8').matchAll(LD_RE)) {
      counter.blocks += 1;
      let parsed;
      try { parsed = JSON.parse(m[1]); } catch (e) { problems.push(`${rel}: JSON-LD does not parse (${e.message})`); continue; }
      checkNode(parsed, vocab, rel, problems, counter);
    }
  }
  if (counter.nodes === 0) {
    throw new Error(`STRUCTURED DATA VOCAB FAIL: examined ${files.length} page(s) and found zero typed JSON-LD nodes. Nothing was checked.`);
  }
  if (problems.length) {
    const byMsg = new Map();
    for (const p of problems) {
      const msg = p.replace(/^[^:]+: /, '');
      if (!byMsg.has(msg)) byMsg.set(msg, []);
      byMsg.get(msg).push(p.split(': ')[0]);
    }
    const lines = [...byMsg.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 30)
      .map(([msg, pages]) => `  ${msg}  <- ${pages.length} page(s), e.g. ${pages[0]}`);
    throw new Error(`STRUCTURED DATA VOCAB FAIL: ${problems.length} schema.org error(s), ${byMsg.size} distinct.\n${lines.join('\n')}\nFix the generator that emits the JSON-LD.`);
  }
  console.log(`✅ STRUCTURED DATA VOCAB PASS: ${files.length} page(s), ${counter.blocks} JSON-LD block(s), ${counter.nodes} typed node(s), every type and property valid schema.org.`);
  return { files: files.length, blocks: counter.blocks, nodes: counter.nodes };
}

module.exports = { run };

if (require.main === module) {
  try { run(); } catch (e) { console.error(e.message); process.exit(1); }
}
