#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data', 'reference');
const INCOMING = path.join(DATA_DIR, 'incoming_candidates.json');
const REGISTRY = path.join(DATA_DIR, 'reference_registry.json');
const MAX_NEW_GUIDES_PER_RUN = Math.max(1, Number(process.env.MAX_NEW_GUIDES_PER_RUN || 25));

const VERTICALS = {
  dentistry: {
    folder: 'data/page_sets/examples/dentistry_global_pages',
    filePrefix: 'guides_',
    publicVertical: 'dentistry'
  },
  neuro: {
    folder: 'data/page_sets/examples/neuro_global_pages',
    filePrefix: 'guides_',
    publicVertical: 'neuro'
  },
  'uscis-medical': {
    folder: 'data/page_sets/examples/uscis_medical_global_pages',
    filePrefix: 'guides_',
    publicVertical: 'uscis-medical'
  },
  trt: {
    folder: 'data/page_sets/examples/trt_global_pages',
    filePrefix: 'guides_trt_',
    publicVertical: 'trt'
  },
  'personal-injury': {
    folder: 'data/page_sets/examples/pi_global_pages',
    filePrefix: '',
    publicVertical: 'personal-injury'
  },
  pi: {
    folder: 'data/page_sets/examples/pi_global_pages',
    filePrefix: '',
    publicVertical: 'personal-injury'
  }
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 90);
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeVertical(v) {
  const key = String(v || '').trim();
  if (key === 'pi') return 'personal-injury';
  return key;
}

function listExistingRoutes(folderAbs) {
  const map = new Map();
  if (!fs.existsSync(folderAbs)) return map;
  for (const name of fs.readdirSync(folderAbs)) {
    if (!name.endsWith('.json')) continue;
    const file = path.join(folderAbs, name);
    const json = readJsonSafe(file, null);
    if (!json || typeof json !== 'object') continue;
    const route = String(json.route || '').trim();
    if (route) map.set(route, file);
  }
  return map;
}

function buildGuideSlug(candidate) {
  const clusterValue = Array.isArray(candidate.cluster) && candidate.cluster.length ? candidate.cluster[0] : '';
  return slugify(clusterValue || candidate.query || candidate.id || 'candidate-guide');
}

function buildFileName(verticalCfg, slug) {
  return `${verticalCfg.filePrefix}${slug}.json`;
}

function buildDescription(candidate) {
  const q = String(candidate.query || '').trim();
  const base = q || 'This guide';
  const sentence = `${base} — independent educational guide explaining what to compare, what to ask, common red flags, and what usually matters before moving forward.`;
  return sentence.length <= 180 ? sentence : sentence.slice(0, 177).trim() + '...';
}

function sectionList(items) {
  return items.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
}

function buildHtml(candidate, publicVertical) {
  const query = String(candidate.query || '').trim();
  const title = titleCase(query || candidate.id || 'Guide');
  const clusters = Array.isArray(candidate.cluster) ? candidate.cluster.filter(Boolean) : [];
  const evidenceQueries = Array.isArray(candidate.evidence?.evidence_queries)
    ? candidate.evidence.evidence_queries.filter(Boolean).slice(0, 6)
    : [];

  const compareItems = [
    'Whether the page gives a direct answer in the first screen without hedging.',
    'What decision checklist, comparison table, or red-flag structure helps the reader move faster.',
    'Whether the page explains who this is for, who should slow down, and what alternative path may fit better.',
    'Whether cost, process, safety, follow-up, and expected next steps are made visible early enough to help real decisions.',
  ];

  const questionItems = [
    `What is the clearest short answer to "${query}"?`,
    'What criteria would actually change the decision for a real person evaluating this option?',
    'What does a trustworthy provider, clinic, or guide explain clearly instead of hiding behind vague language?',
    'What would make someone pause, compare alternatives, or ask better follow-up questions before moving forward?',
  ];

  const evidenceList = evidenceQueries.length ? evidenceQueries : clusters;

  return [
    `<h2>${escapeHtml(title)}</h2>`,
    '<p>Educational only. No endorsements, rankings, or guarantees. Use this page to compare options, clarify the real decision, and avoid making a rushed choice based on hype or vague marketing language.</p>',
    '<h2 id="quick-answer">Quick answer</h2>',
    `<p><strong>${escapeHtml(title)}</strong> should be answered directly, in plain language, before the reader has to dig through filler. The right first move is to make the decision criteria visible early: what matters most, what changes the recommendation, what should raise concern, and what a reader should compare before taking the next step.</p>`,
    `<p>This guide is designed to make <strong>${escapeHtml(query || title)}</strong> easier to evaluate by turning the topic into a practical decision page instead of a thin generic explainer. It should help a reader understand fit, tradeoffs, red flags, and what questions are worth asking before contacting anyone.</p>`,
    '<h2 id="who-this-helps">Who this guide helps most</h2>',
    `<p>This page is most useful when someone is trying to decide whether <strong>${escapeHtml(query || title)}</strong> is the right path, the wrong path, or just one option inside a broader ${escapeHtml(publicVertical)} decision. The goal is not to push a conversion blindly. The goal is to make the decision clearer.</p>`,
    '<h2 id="what-to-compare">What to compare before moving forward</h2>',
    `<ul>${sectionList(compareItems)}</ul>`,
    '<h2 id="decision-checklist">Decision checklist</h2>',
    '<p>Use this checklist before treating any provider page, guide, or clinic page like a final answer:</p>',
    '<ol>' +
      '<li>Does the page answer the real question immediately?</li>' +
      '<li>Does it explain what criteria separate a good fit from a weak fit?</li>' +
      '<li>Does it surface risks, limitations, or uncertainty honestly?</li>' +
      '<li>Does it explain what to compare next instead of pushing a decision too early?</li>' +
      '</ol>',
    '<h2 id="questions-worth-asking">Questions worth asking</h2>',
    `<ul>${sectionList(questionItems)}</ul>`,
    '<h2 id="red-flags">Red flags</h2>',
    '<p>Red flags usually show up as vague promises, no clear comparison criteria, weak explanation of tradeoffs, or pages that sound certain where a more careful page would explain nuance. If the page makes the answer sound too easy, the trust layer is probably too thin.</p>',
    '<h2 id="signal-evidence">Signal evidence</h2>',
    evidenceList.length
      ? `<p>This draft was generated from candidate evidence already observed in the velocity system. The underlying signal cluster for this page includes:</p><ul>${sectionList(evidenceList.map(String))}</ul>`
      : '<p>This draft was generated from a velocity candidate package and should be reviewed before publish.</p>',
    '<h2 id="next-step">What to do next</h2>',
    '<p>Use this draft as a starting point, not a final answer. Review the opening clarity, strengthen the checklist or comparison structure if needed, make sure the route belongs in the correct guide family, and only keep the page if it earns a real role inside the canonical guide system.</p>'
  ].join('\n');
}

function main() {
  ensureDir(DATA_DIR);

  const incoming = readJsonSafe(INCOMING, []);
  const registry = readJsonSafe(REGISTRY, { processed_ids: [], pages: [], promoted_ids: [] });
  if (!Array.isArray(registry.processed_ids)) registry.processed_ids = [];
  if (!Array.isArray(registry.pages)) registry.pages = [];
  if (!Array.isArray(registry.promoted_ids)) registry.promoted_ids = [];

  let created = 0;
  const results = [];

  for (const candidate of incoming) {
    if (created >= MAX_NEW_GUIDES_PER_RUN) break;
    if (!candidate || typeof candidate !== 'object') continue;
    const vertical = normalizeVertical(candidate.vertical);
    const cfg = VERTICALS[vertical];
    if (!cfg) {
      results.push({ id: candidate.id || null, status: 'skipped', reason: `unsupported_vertical:${vertical}` });
      continue;
    }

    const folderAbs = path.join(ROOT, cfg.folder);
    if (!fs.existsSync(folderAbs)) {
      results.push({ id: candidate.id || null, status: 'skipped', reason: `missing_folder:${cfg.folder}` });
      continue;
    }

    const slugBase = buildGuideSlug(candidate);
    if (!slugBase) {
      results.push({ id: candidate.id || null, status: 'skipped', reason: 'empty_slug' });
      continue;
    }

    const existingRoutes = listExistingRoutes(folderAbs);
    let slug = slugBase;
    let route = `/guides/${slug}/`;
    let fileName = buildFileName(cfg, slug);
    let fileAbs = path.join(folderAbs, fileName);
    let counter = 2;

    while (existingRoutes.has(route) || fs.existsSync(fileAbs)) {
      const existingFile = existingRoutes.get(route);
      if (existingFile && path.resolve(existingFile) === path.resolve(fileAbs)) {
        break;
      }
      slug = `${slugBase}-${counter++}`;
      route = `/guides/${slug}/`;
      fileName = buildFileName(cfg, slug);
      fileAbs = path.join(folderAbs, fileName);
    }

    if (fs.existsSync(fileAbs)) {
      results.push({ id: candidate.id || null, status: 'skipped', reason: `already_exists:${path.relative(ROOT, fileAbs)}` });
      continue;
    }

    const title = titleCase(candidate.query || slug);
    const guideJson = {
      route,
      title,
      description: buildDescription(candidate),
      main_html: buildHtml(candidate, cfg.publicVertical)
    };

    writeJson(fileAbs, guideJson);

    const relFile = path.relative(ROOT, fileAbs).replace(/\\/g, '/');
    registry.pages.push({
      id: candidate.id,
      vertical: vertical,
      source: candidate.source || 'local-guides-citation-velocity',
      query: candidate.query || title,
      cluster: Array.isArray(candidate.cluster) ? candidate.cluster : [],
      file: relFile,
      route,
      promoted: false,
      draft_generated_at: new Date().toISOString(),
      surface_type: 'draft_guide_source'
    });
    registry.processed_ids.push(candidate.id);
    created += 1;
    results.push({ id: candidate.id, status: 'created', file: relFile, route });
  }

  registry.processed_ids = Array.from(new Set(registry.processed_ids.filter(Boolean)));
  registry.updated_at = new Date().toISOString();
  writeJson(REGISTRY, registry);

  console.log(`generate_from_candidates: created ${created} draft guide source file(s)`);
  for (const row of results) {
    console.log(` - ${row.status}: ${row.id || 'unknown'}${row.file ? ` -> ${row.file}` : ''}${row.reason ? ` (${row.reason})` : ''}`);
  }
}

main();
