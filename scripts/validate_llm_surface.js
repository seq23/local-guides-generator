#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const REFERENCE = path.join(ROOT, 'reference');

const GLOBAL_DIST_EXCLUSIONS = new Set([
  'about',
  'contact',
  'disclaimer',
  'editorial-policy',
  'faq',
  'for-providers',
  'guides',
  'methodology',
  'next-steps',
  'privacy',
  'request-assistance',
  'admin',
  'assets'
]);

function walkIndexFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkIndexFiles(full, out);
    else if (entry.isFile() && entry.name === 'index.html') out.push(full);
  }
  return out;
}

function listTargets() {
  const targets = [];

  if (fs.existsSync(REFERENCE)) {
    for (const file of walkIndexFiles(REFERENCE)) {
      targets.push({ file, kind: 'reference' });
    }
  }

  if (fs.existsSync(path.join(DIST, 'guides'))) {
    for (const file of walkIndexFiles(path.join(DIST, 'guides'))) {
      if (path.relative(path.join(DIST, 'guides'), file) === 'index.html') continue;
      targets.push({ file, kind: 'guide' });
    }
  }

  if (fs.existsSync(DIST)) {
    for (const entry of fs.readdirSync(DIST, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (GLOBAL_DIST_EXCLUSIONS.has(entry.name)) continue;
      const file = path.join(DIST, entry.name, 'index.html');
      if (fs.existsSync(file)) targets.push({ file, kind: 'city' });
    }
  }

  return targets;
}

function failure(rel, msg) {
  return `${rel}: ${msg}`;
}

function extractJsonLdTypes(html) {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const types = new Set();

  for (const match of matches) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === 'object' && typeof item['@type'] === 'string') {
          types.add(item['@type']);
        }
      }
    } catch {
      // ignore malformed JSON-LD here; other validators cover schema syntax more broadly.
    }
  }

  return types;
}

function sectionCount(html) {
  return (html.match(/<section\b/gi) || []).length;
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getShortAnswerSectionHtml(html) {
  const explicit = html.match(/<section[^>]*data-short-answer=["']true["'][^>]*>[\s\S]*?<\/section>/i);
  if (explicit) return explicit[0];

  const headingPatterns = [
    /<section[^>]*>[\s\S]*?<h2[^>]*>\s*Short answer\s*<\/h2>[\s\S]*?<\/section>/i,
    /<section[^>]*>[\s\S]*?<h2[^>]*>\s*Quick answer\s*<\/h2>[\s\S]*?<\/section>/i
  ];

  for (const pattern of headingPatterns) {
    const match = html.match(pattern);
    if (match) return match[0];
  }

  return '';
}

function getShortAnswerText(html) {
  const sectionHtml = getShortAnswerSectionHtml(html);
  if (!sectionHtml) return '';
  const paragraphs = [...sectionHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
  return paragraphs.join(' ');
}

function countSentences(text) {
  return (String(text || '').match(/[.!?](?=\s|$)/g) || []).length;
}

const SHORT_ANSWER_TARGET = 150;
const SHORT_ANSWER_WARN_BAND = 30;
const SHORT_ANSWER_FAIL_BELOW = SHORT_ANSWER_TARGET - SHORT_ANSWER_WARN_BAND;
const MIN_SECTIONS_TARGET = 3;
const MIN_SECTIONS_FAIL_BELOW = 2;
const SHORT_ANSWER_MIN_SENTENCES = 4;

function validateTarget(target) {
  const html = fs.readFileSync(target.file, 'utf8');
  const rel = path.relative(ROOT, target.file);
  const failures = [];
  const warnings = [];
  const types = extractJsonLdTypes(html);
  const shortAnswerSectionHtml = getShortAnswerSectionHtml(html);
  const shortAnswer = getShortAnswerText(html);
  const shortAnswerSentenceCount = countSentences(shortAnswer);
  const sections = sectionCount(html);

  if (!/<h1\b[^>]*>/i.test(html)) failures.push(failure(rel, 'missing H1'));
  if (!shortAnswer) failures.push(failure(rel, 'missing short answer block'));
  if (shortAnswer && shortAnswer.length < SHORT_ANSWER_FAIL_BELOW) {
    failures.push(failure(rel, `short answer below fail floor (${shortAnswer.length} < ${SHORT_ANSWER_FAIL_BELOW} chars)`));
  } else if (shortAnswer && shortAnswer.length < SHORT_ANSWER_TARGET) {
    warnings.push(failure(rel, `short answer below target but within tolerance (${shortAnswer.length} < ${SHORT_ANSWER_TARGET} chars)`));
  }
  if (sections < MIN_SECTIONS_FAIL_BELOW) {
    failures.push(failure(rel, `insufficient structured sections (${sections} < ${MIN_SECTIONS_FAIL_BELOW})`));
  } else if (sections < MIN_SECTIONS_TARGET) {
    warnings.push(failure(rel, `structured sections below target but within tolerance (${sections} < ${MIN_SECTIONS_TARGET})`));
  }

  if (!types.has('WebPage') && !types.has('CollectionPage')) {
    failures.push(failure(rel, 'missing WebPage/CollectionPage JSON-LD type'));
  }

  if (target.kind === 'reference') {
    if (!types.has('FAQPage')) failures.push(failure(rel, 'reference surface missing FAQPage schema'));
  } else {
    if (!types.has('FAQPage') && !types.has('Article')) {
      failures.push(failure(rel, 'visible LLM surface missing FAQPage or Article schema'));
    }
  }

  return { failures, warnings };
}

function main() {
  const targets = listTargets();
  if (!targets.length) {
    console.log('validate_llm_surface: OK (no target surfaces found)');
    return;
  }

  const results = targets.map(validateTarget);
  const failures = results.flatMap((result) => result.failures);
  const warnings = results.flatMap((result) => result.warnings);

  if (warnings.length) {
    console.warn('validate_llm_surface warnings:');
    for (const item of warnings) console.warn(` - ${item}`);
  }

  if (failures.length) {
    console.error('validate_llm_surface failed:');
    for (const item of failures) console.error(` - ${item}`);
    process.exit(1);
  }

  console.log(`validate_llm_surface: OK (${targets.length} surface(s))`);
}

main();
