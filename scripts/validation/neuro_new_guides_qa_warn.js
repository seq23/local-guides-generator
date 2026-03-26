#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const GUIDES_DIR = path.join(REPO_ROOT, 'data', 'page_sets', 'examples', 'neuro_global_pages');
const TARGETS = [
  'guides_adhd-therapy-after-an-evaluation.json',
  'guides_questions-to-ask-an-adhd-therapist.json',
  'guides_adhd-therapy-vs-medication-vs-coaching.json',
  'guides_how-to-find-an-adhd-therapist-who-fits.json',
  'guides_can-one-provider-handle-adhd-evaluation-and-therapy.json',
  'guides_what-progress-looks-like-in-adhd-therapy.json',
  'guides_autism-therapy-after-an-evaluation.json',
  'guides_questions-to-ask-an-autism-therapy-provider.json',
  'guides_how-to-choose-between-home-based-center-based-and-school-based-autism-therapy.json',
  'guides_autism-therapy-red-flags-and-green-flags.json'
];

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

let warnings = [];
for (const file of TARGETS) {
  const fp = path.join(GUIDES_DIR, file);
  if (!fs.existsSync(fp)) {
    warnings.push(`${file}: missing guide file`);
    continue;
  }
  let j;
  try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (e) { warnings.push(`${file}: invalid json`); continue; }
  const html = String(j.main_html || '');
  const text = htmlToText(html);
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean);
  const avgSentence = sentences.length ? (words.length / sentences.length) : 999;
  const h3s = (html.match(/<h3>/g) || []).length;
  if (words.length < 600) warnings.push(`${file}: thin guide (${words.length} words)`);
  if (h3s < 6) warnings.push(`${file}: weak section depth (${h3s} h3 sections)`);
  if (avgSentence > 20) warnings.push(`${file}: reading level may be too high (avg sentence ${avgSentence.toFixed(1)} words)`);
  if (!/what to ask|questions to ask|how to choose|what to compare|next steps|red flags|green flags/i.test(text)) warnings.push(`${file}: low decision-utility signal`);
  if (!/provider|clinic|therapist/i.test(text)) warnings.push(`${file}: weak provider-seeking alignment`);
  if (!/Educational only\.|not medical advice/i.test(html)) warnings.push(`${file}: missing compliance reminder`);
}
if (warnings.length) {
  for (const w of warnings) console.warn(`GUIDE QA WARNING: ${w}`);
  process.exit(1);
}
console.log('GUIDE QA PASS (neuro new guides)');
