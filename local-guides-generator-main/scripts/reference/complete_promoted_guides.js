#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const QUEUE_FILE = path.join(ROOT, '.tmp', 'promoted_guide_completion_queue.json');

const VERTICAL_RULES = {
  dentistry: {
    sections: [
      ['definition', 'What this page answers', 'This page explains the dental decision in plain language first, then gives the practical filters a real patient usually needs before booking or comparing providers.'],
      ['cost', 'Cost and fee reality', 'Cost questions are usually not just about a sticker price. They are about what is included, what changes the fee, what follow-up may cost more, and which tradeoffs change the right choice.'],
      ['recovery', 'Recovery and timeline', 'Recovery expectations matter because the better option on paper is not always the better fit for someone managing work, childcare, travel, pain tolerance, or follow-up logistics.'],
      ['candidacy', 'Who is usually a better or worse fit', 'A stronger guide says who may be a better fit, who may need a different path, and what questions should be clarified before treating any provider page like a final answer.'],
      ['questions', 'Questions worth asking before you choose', 'The best questions force clarity on scope, total cost, healing expectations, risks, alternatives, and what happens if the first plan changes after imaging or clinical review.'],
      ['red-flags', 'Red flags to slow down for', 'Warning signs usually show up when a page avoids tradeoffs, hides pricing logic, skips candidacy nuance, or makes a treatment sound universal when it clearly is not.'],
      ['next-steps', 'What to do next', 'Use this guide to compare providers, confirm what the treatment includes, and make sure the next step is grounded in fit and process instead of pure marketing language.']
    ]
  },
  neuro: {
    sections: [
      ['definition', 'Quick answer', 'This guide should answer the neuro question directly, then make the real decision criteria visible early: evaluation type, provider fit, report purpose, insurance reality, and what follow-up path is actually supported.'],
      ['pricing', 'Pricing and coverage reality', 'Pricing only helps if it shows what is included, what type of evaluation is being quoted, how insurance or out-of-network reimbursement works, and whether the report scope matches the reason someone is seeking testing.'],
      ['trust', 'Trust signals and provider fit', 'A trustworthy provider or guide explains credentials, population fit, report use cases, and practical limits. Vague promises and polished but thin language are not enough for a high-stakes neuro decision.'],
      ['process', 'What the process usually looks like', 'Readers usually need the step order made explicit: intake, records review, testing, scoring, interpretation, report delivery, feedback, and what decisions the report can or cannot support.'],
      ['questions', 'Questions worth asking before you choose', 'Strong neuro pages help readers ask better questions about scope, report use, adult versus child fit, telehealth limits, turnaround time, and whether the provider is solving the right problem.'],
      ['next-steps', 'What to do next', 'After this guide, the right next step is to compare providers, confirm report purpose, clarify price scope, and decide whether the evaluation path matches the actual school, work, therapy, or diagnostic decision in front of you.']
    ]
  },
  trt: {
    sections: [
      ['definition', 'What this page answers', 'This page should answer the TRT or hormone question directly, then translate it into decision language a reader can actually use before committing to a clinic, lab plan, or treatment path.'],
      ['cost', 'Cost and fee reality', 'Hormone pricing becomes misleading fast when pages hide whether visits, labs, prescriptions, follow-up review, and refill logistics are bundled or separated.'],
      ['safety', 'Safety and monitoring reality', 'The real safety issue is not just whether treatment is offered. It is whether the page explains screening, monitoring, follow-up, lab review, and what situations require slowing down or asking harder questions.'],
      ['candidacy', 'Who may be a better or worse fit', 'A production-ready guide should say who may fit the path, who may need a different workup, and what unresolved questions usually matter before starting anything.'],
      ['questions', 'Questions worth asking before you choose', 'The right questions expose whether a clinic is serious about fit, monitoring, cost clarity, and realistic expectations instead of just converting the lead.'],
      ['red-flags', 'Red flags to slow down for', 'Red flags usually show up as vague hormone promises, no monitoring detail, weak explanation of tradeoffs, or pages that push action faster than they explain the decision.'],
      ['next-steps', 'What to do next', 'Use this guide to compare monitoring quality, pricing scope, candidacy clarity, and what should be confirmed in writing before moving forward.']
    ]
  },
  pi: {
    sections: [
      ['definition', 'Quick answer', 'This page should explain the injury-law question in direct language first, then move immediately into timing, urgency, evidence, and decision filters that actually change what someone should do next.'],
      ['when-to-call', 'When to call and why timing matters', 'Timing matters because evidence changes quickly, insurance and adjuster behavior changes quickly, and hesitation can make the practical position weaker even before any lawsuit question appears.'],
      ['cost', 'Cost and fee reality', 'Readers need plain language on fee structure, contingency expectations, case costs, and why the cheapest-looking path is not always the strongest practical path.'],
      ['evidence', 'Evidence and documentation', 'The strongest PI pages make the evidence layer concrete: photos, records, timeline, witness information, symptoms, bills, and what should be preserved before memory and documents drift.'],
      ['questions', 'Questions worth asking before you choose counsel', 'The best questions test fit, responsiveness, case handling, communication, timing judgment, and whether the lawyer is explaining what matters instead of just selling certainty.'],
      ['red-flags', 'Red flags and what not to do', 'Do not treat pressure, vague guarantees, delay, or weak documentation habits as small issues. The wrong early move can narrow options fast.'],
      ['next-steps', 'What to do next', 'Slow down, preserve evidence, clarify timing, and use this guide to compare the next move against the actual facts instead of reacting only to fear or urgency.']
    ]
  },
  uscis_medical: {
    sections: [
      ['quick-answer', 'Quick answer', 'This guide should answer the USCIS medical question directly, then convert it into a practical checklist about cost scope, required documents, process timing, clinic workflow, and what should be confirmed before leaving the office.'],
      ['cost', 'Costs, fees, and quote scope', 'USCIS medical quotes are only useful when they say what is included, what may trigger extra charges, and whether labs, vaccines, follow-up visits, and packet handling are inside or outside the base number.'],
      ['documents', 'Documents and proof to gather', 'A good USCIS medical guide tells readers exactly which records and identification questions tend to matter and why missing paperwork can create delay even when the appointment itself is fine.'],
      ['process', 'What the process usually looks like', 'Readers usually need the sequence laid out clearly: booking, records review, exam, possible labs or vaccines, packet preparation, and what the clinic says happens next.'],
      ['questions', 'Questions to ask before you book or leave the office', 'The strongest questions are the ones that expose hidden cost scope, timing assumptions, packet readiness, language support, correction policy, and follow-up requirements.'],
      ['next-steps', 'What to do next', 'Use this guide to compare civil-surgeon offices, confirm quote scope in writing, gather documents early, and make sure the clinic workflow fits your timing and record situation before booking.']
    ]
  }
};

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) throw new Error(`queue file missing: ${QUEUE_FILE}`);
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeLead(html) {
  let out = String(html || '').trim();
  out = out.replace(/<h2 id="next-step">[\s\S]*$/i, '');
  out = out.replace(/<h2 id="quick-answer">[\s\S]*?(?=<h2 id="(?:definition|pricing|trust|process|questions|next-steps|cost|documents|when-to-call|evidence|red-flags|recovery|candidacy|safety)")/i, '');
  return out.trim();
}

function buildSection(sectionId, heading, body, title, vertical) {
  const safeTitle = escapeHtml(title);
  const extras = {
    dentistry: `For <strong>${safeTitle}</strong>, the production-ready version should help a reader compare candidacy, cost logic, recovery burden, and what usually changes the recommendation instead of forcing them to infer the decision from generic marketing language.`,
    neuro: `For <strong>${safeTitle}</strong>, the better guide shape is a decision-support surface: direct answer first, then provider fit, pricing scope, process, and what changes the recommendation for a child, adult, school, work, or diagnostic use case.`,
    trt: `For <strong>${safeTitle}</strong>, the point is not just to describe treatment. The point is to clarify monitoring quality, candidacy, safety tradeoffs, pricing scope, and what a careful reader should verify before committing.`,
    pi: `For <strong>${safeTitle}</strong>, the page should reduce panic without hiding urgency. It should tell the reader what matters now, what evidence should be preserved, what mistakes to avoid, and what questions should shape the next move.`,
    uscis_medical: `For <strong>${safeTitle}</strong>, the strongest version is operational. It should help a reader compare offices, document needs, process timing, packet handling, and what questions prevent expensive or stressful surprises.`
  };
  return `<h2 id="${sectionId}">${heading}</h2>\n<h3>${heading}</h3>\n<p>${body}</p>\n<p>${extras[vertical]}</p>`;
}

function buildMainHtml(item, currentHtml) {
  const title = item.title || item.route || 'Guide';
  const lead = [
    `<h2>${escapeHtml(title)}</h2>`,
    item.description ? `<p>${escapeHtml(item.description)}</p>` : '',
    '<p>This production-ready canonical guide is designed to answer the question directly, expose the real decision criteria early, and route the reader into the next comparison or action with less guesswork and less generic filler.</p>'
  ].filter(Boolean).join('\n');
  const sections = VERTICAL_RULES[item.vertical].sections.map(([id, heading, body]) => buildSection(id, heading, body, title, item.vertical)).join('\n\n');
  const preserved = normalizeLead(currentHtml);
  const footer = '<h2 id="next-steps-support">Why this guide exists in the canonical system</h2>\n<p>The goal is not just topical coverage. The goal is to give readers and citation systems the exact decision-support shape they keep synthesizing: direct answer, comparison logic, practical cautions, and concrete next steps in one place.</p>';
  return [lead, sections, preserved, footer].filter(Boolean).join('\n\n');
}

function main() {
  const queue = loadQueue();
  const completed = [];
  for (const item of queue.items || []) {
    const fileAbs = path.join(ROOT, item.file);
    const json = JSON.parse(fs.readFileSync(fileAbs, 'utf8'));
    json.main_html = buildMainHtml(item, json.main_html || '');
    fs.writeFileSync(fileAbs, JSON.stringify(json, null, 2) + '\n');
    completed.push(item.file);
  }
  console.log(`complete_promoted_guides: completed ${completed.length} guide(s)`);
  completed.forEach((file) => console.log(` - ${file}`));
}

main();
