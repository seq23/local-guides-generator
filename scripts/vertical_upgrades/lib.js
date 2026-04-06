#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readJson(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function writeJson(fp, data) {
  ensureDir(path.dirname(fp));
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
function repoRoot() { return path.join(__dirname, '..', '..'); }
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function slugFromRoute(route) {
  return String(route || '').replace(/^\/guides\//, '').replace(/\/$/, '');
}
function guideFilename(relDir, slug) {
  if (relDir.includes('trt_global_pages')) return `guides_trt_${slug}.json`;
  if (relDir.includes('pi_global_pages')) return `${slug}.json`;
  return `guides_${slug}.json`;
}
function topicFromSlug(slug) {
  const s = String(slug || '').toLowerCase();
  if (/(cost|pricing|fees|finance|insurance)/.test(s)) return 'cost';
  if (/(red-flags|green-flags|choose|questions)/.test(s)) return 'trust';
  if (/(recovery|what-to-expect|next|after|process|overview|includes|screening|assessment)/.test(s)) return 'process';
  if (/(side-effects|safety|risk)/.test(s)) return 'safety';
  if (/(candidate|candidacy|who-is-a-good-candidate|fit)/.test(s)) return 'candidacy';
  if (/(vs|versus|compare|comparison|replace|telehealth)/.test(s)) return 'compare';
  if (/(evidence|recorded-statements|what-to-do|when-to-call)/.test(s)) return 'next';
  return 'general';
}
function wordCount(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}
function sectionHtml(id, title, paragraphs, bullets) {
  let html = `<h2 id="${escapeHtml(id)}">${escapeHtml(title)}</h2>\n<h3>${escapeHtml(title)}</h3>\n`;
  for (const paragraph of paragraphs || []) html += `<p>${paragraph}</p>\n`;
  if (Array.isArray(bullets) && bullets.length) {
    html += '<ul>\n';
    for (const bullet of bullets) html += `<li>${bullet}</li>\n`;
    html += '</ul>\n';
  }
  return html;
}
function profileConfig(vertical) {
  const configs = {
    dentistry: {
      relDir: 'data/page_sets/examples/dentistry_global_pages',
      minGuides: 18,
      requiredRoutes: ['/guides/dental-crowns/', '/guides/root-canal-treatment/', '/guides/dental-red-flags/', '/guides/questions-to-ask/'],
      requiredIds: ['definition', 'cost', 'recovery', 'questions', 'red-flags'],
      disclaimer: 'Educational only. Not medical advice. No endorsements or rankings.',
      sections({ title, description, topic }) {
        const safeTitle = escapeHtml(title);
        const desc = escapeHtml(description || `${title} decisions usually depend on symptoms, timing, total cost, and whether the dentist is explaining the tradeoffs clearly.`);
        return [
          sectionHtml('definition', 'Quick answer', [
            `${safeTitle} should function like a clear decision page, not a brochure. The useful question is what problem is being solved, what alternatives exist, and what happens if treatment is delayed.`,
            `${desc}`
          ]),
          sectionHtml('cost', 'Cost, financing, and what changes the quote', [
            `People usually regret dental quotes when they only compare the headline price. The better comparison includes imaging, temporaries, specialist involvement, follow-up, and whether financing is changing the decision more than the diagnosis is.`,
            `A solid office should explain which parts of the plan are urgent, which are elective, and what cost range changes if the case becomes more complex.`
          ], [
            'Ask what is included in the quoted number versus what may be billed separately.',
            'Clarify whether specialist referral, sedation, or lab work changes the price materially.',
            'Get the timeline in writing so a low number is not hiding staged costs.'
          ]),
          sectionHtml('recovery', topic === 'process' ? 'What the process usually looks like' : 'Recovery and timeline', [
            `Dentistry decisions improve when the office explains timing in plain language: what happens first, what symptoms are normal, when the case should be rechecked, and what would count as a reason to call.`,
            `If recovery, bite changes, or follow-up visits are barely mentioned, the explanation is not complete enough yet.`
          ]),
          sectionHtml('candidacy', 'Who this is usually for', [
            `The right dental path depends on the actual condition of the tooth, gums, bite, bone support, and whether a general dentist or specialist is the better fit.`,
            `Good candidacy language should separate cosmetic wants from structural needs so the plan feels clinically grounded instead of sales-led.`
          ]),
          sectionHtml('questions', 'Questions worth asking before you commit', [
            `The best questions lower regret. They force clarity around diagnosis, alternatives, and timing instead of letting the visit drift into generic reassurance.`
          ], [
            'What is the diagnosis in plain language?',
            'What are the conservative alternatives, and what happens if I wait?',
            'Should this be handled by a general dentist, oral surgeon, endodontist, or periodontist?',
            'What does the office consider a red flag after treatment?'
          ]),
          sectionHtml('red-flags', 'Red flags and trust checks', [
            `Dental trust is not about the nicest office. It is about whether the diagnosis is specific, the plan is phased logically, and the office can explain tradeoffs without pressure.`,
            `If the office jumps from imaging to financing without slowing down to explain urgency, alternatives, and long-term maintenance, ask more questions before saying yes.`
          ]),
          sectionHtml('next-steps', 'What to do next', [
            `Use this page as a checklist for the next consultation. Bring your imaging, ask the questions above, and compare whether the explanation feels more specific and calmer after the visit.`,
            `City pages and provider pages should route readers here when they need cost context, red-flag filtering, or a specialist-versus-generalist decision.`
          ])
        ].join('');
      }
    },
    neuro: {
      relDir: 'data/page_sets/examples/neuro_global_pages',
      minGuides: 26,
      requiredRoutes: ['/guides/neuro-evaluation-pricing/', '/guides/neuro-provider-red-flags/', '/guides/questions-to-ask-before-neuro-testing/', '/guides/what-to-expect-after-a-neuro-evaluation/'],
      requiredIds: ['definition', 'pricing', 'trust', 'process', 'questions', 'next-steps'],
      disclaimer: 'Educational only. Not medical advice. No endorsements or rankings.',
      sections({ title, description, topic }) {
        const safeTitle = escapeHtml(title);
        const desc = escapeHtml(description || `${title} decisions usually depend on fit, testing depth, reporting quality, and whether the provider explains next steps clearly.`);
        return [
          sectionHtml('definition', 'Quick answer', [
            `${safeTitle} should answer the practical decision question first: what this service is for, who usually needs it, and what decision it helps a family or adult make next.`,
            `${desc}`
          ]),
          sectionHtml('pricing', 'Visible pricing and coverage questions', [
            `Neuro pages need visible pricing context even when exact numbers vary. Families and adults need to know what is bundled, what testing depth changes the quote, and whether insurance or out-of-network reimbursement changes the total path.`,
            `If the page avoids cost language entirely, it usually fails the real question people are trying to solve. Readers use pricing clues to decide whether they should keep researching, call, or look for a different level of provider.`
          ], [
            'Ask whether intake, testing, scoring, report writing, and feedback are all included.',
            'Clarify what school/work accommodation letters or follow-up visits cost separately.',
            'Check whether therapy, coaching, or medication management are separate services.'
          ]),
          sectionHtml('trust', 'Trust signals and provider fit', [
            `Neuro trust is mostly about clarity. People need to know who is doing the evaluation, how broad the testing is, how the report will be used, and whether the provider can explain limitations without overselling certainty.`,
            `A strong page should slow people down before they buy the wrong scope of testing or assume one evaluation answers every question. That trust layer is what makes a guide useful for ADHD, autism, school, work, and adult diagnostic decisions instead of sounding generic.`
          ]),
          sectionHtml('process', topic === 'process' ? 'What the process usually looks like' : 'What to expect', [
            `Neuro pages should explain the sequence: intake, testing, report turnaround, feedback session, and what decisions can realistically be made after results come back.`,
            `That process detail is what makes city pages and guides feel decision-supportive instead of thin. It also gives city pages something specific to route people into when they are deciding between broad testing, focused testing, and therapy follow-up.`
          ]),
          sectionHtml('questions', 'Questions to ask before you choose a provider', [
            `The goal is not just to find a provider with availability. The goal is to find a provider whose testing scope, communication style, and report quality match the real reason you are seeking care. That is especially important when the page is about therapy fit, report usability, or choosing between provider types.`
          ], [
            'What questions will this evaluation answer, and what questions will it not answer?',
            'How long is the report, how long does it take, and who explains it afterward?',
            'Will the results actually help with school, work, therapy, medication, or accommodations?',
            'What makes this page relevant for my age group and situation?'
          ]),
          sectionHtml('city-support', 'How this helps city-page decisions', [
            `Neuro city pages work best when they can route readers into specific decision pages like this one instead of sending everyone to a broad hub. That means each guide needs language a family or adult can actually use while comparing providers, timelines, report quality, and next-step usefulness.`,
            `This extra decision-support layer is also what makes the pack more useful for AEO, GEO, and search. It gives the system a stronger answer block for questions about pricing, trust, process, therapy fit, and what to ask before booking.`
          ]),
          sectionHtml('next-steps', 'Next steps after this guide', [
            `This guide should route naturally into city pages, provider-comparison pages, and follow-up decision pages such as therapy, accommodations, or treatment planning.`,
            `The practical next step is to shortlist providers, compare scope and report usefulness, and make sure pricing and follow-up expectations are visible before booking. Pages that do this well are much stronger for AEO, GEO, and search because they answer the actual decision path instead of stopping at definitions.`
          ])
        ].join('');
      }
    },
    trt: {
      relDir: 'data/page_sets/examples/trt_global_pages',
      minGuides: 40,
      requiredRoutes: ['/guides/who-is-a-good-candidate-for-trt/', '/guides/trt-pricing-and-labs/', '/guides/trt-red-flags/', '/guides/trt-side-effects-and-safety/', '/guides/trt-telehealth-vs-local-clinic/'],
      requiredIds: ['definition', 'cost', 'safety', 'candidacy', 'questions', 'red-flags', 'next-steps'],
      disclaimer: 'Educational only. Not medical advice. No endorsements or rankings.',
      sections({ title, description, topic }) {
        const safeTitle = escapeHtml(title);
        const desc = escapeHtml(description || `${title} usually depends on treatment fit, labs, monitoring discipline, and whether the provider explains safety and tradeoffs clearly.`);
        return [
          sectionHtml('definition', 'Quick answer', [
            `${safeTitle} should behave like a treatment decision page, not a hype page. People need a direct explanation of who this is for, what it may help with, and what follow-up responsibility comes with it.`,
            `${desc}`
          ]),
          sectionHtml('cost', 'Cost, labs, and program structure', [
            `TRT and hormone pages need visible cost logic. The important question is what the monthly fee actually includes: intake, labs, medication, follow-up, dose changes, and clinician access when something feels off.`,
            `Pages that skip cost and program structure leave too much room for generic fanout and weak conversion decisions.`
          ], [
            'Ask whether labs are included and how often they are repeated.',
            'Clarify whether medication, supplies, and follow-up messaging are bundled or separate.',
            'Make sure the page distinguishes evaluation cost from ongoing care cost.'
          ]),
          sectionHtml('safety', 'Safety, side effects, and monitoring', [
            `Hormone, peptide, IV, and hair-loss pages need visible safety language. People should know what monitoring matters, what side effects or limitations should be discussed, and when a different type of clinician may be more appropriate.`,
            `If the page makes everything sound easy and universally safe, the trust layer is too thin.`
          ]),
          sectionHtml('candidacy', 'Who this is usually for', [
            `Treatment fit should be explicit. Good pages tell readers whether the issue sounds hormonal, aesthetic, weight-related, recovery-related, or outside the scope of this service.`,
            `That is how the repo reduces generic leakage and routes people toward the right owned decision page.`
          ]),
          sectionHtml('questions', topic === 'compare' ? 'Comparison questions worth asking' : 'Questions worth asking before you buy', [
            `The most useful questions reveal whether the provider is selling a package or managing a real clinical process.`
          ], [
            'What labs, vitals, and follow-up checkpoints are required?',
            'What symptoms, risks, or goals make this a bad fit or a different-fit problem?',
            'How does this compare with the closest alternative page in this vertical?',
            'What would make the provider pause, adjust, or stop treatment?'
          ]),
          sectionHtml('red-flags', 'Red flags and trust checks', [
            `Red flags usually show up as oversimplified promises, weak lab discussion, weak fertility or side-effect language, or no clear escalation path when symptoms change.`,
            `A strong page should make the reader more skeptical of easy promises, not less.`
          ]),
          sectionHtml('next-steps', 'What to do next', [
            `Use this guide to compare options inside the same treatment family and against adjacent families such as peptides, IV therapy, weight loss, or hair restoration.`,
            `The next step should be clear: compare city pages, review labs/program structure, and move into a provider-shortlist page or request-assistance path only after the trust checks make sense.`
          ])
        ].join('');
      }
    },
    pi: {
      relDir: 'data/page_sets/examples/pi_global_pages',
      minGuides: 28,
      requiredRoutes: ['/guides/what-to-do-after-an-accident/', '/guides/evidence-checklist-after-an-accident/', '/guides/personal-injury-fees-explained/', '/guides/personal-injury-lawyer-red-flags/', '/guides/when-to-call-a-personal-injury-lawyer/'],
      requiredIds: ['definition', 'when-to-call', 'cost', 'questions', 'red-flags', 'next-steps'],
      disclaimer: 'Educational only. Not legal advice. No endorsements or rankings.',
      sections({ title, description, topic }) {
        const safeTitle = escapeHtml(title);
        const desc = escapeHtml(description || `${title} should help a person understand timing, evidence, and what practical mistake to avoid next.`);
        return [
          sectionHtml('definition', 'Quick answer', [
            `${safeTitle} should function as calm decision support. The page should help a reader understand what matters, what does not, and what to do next without hype or ambulance-chasing tone.`,
            `${desc}`
          ]),
          sectionHtml('when-to-call', 'When to call a lawyer and when to handle health first', [
            `PI pages should be explicit that medical safety comes first when emergency care or urgent evaluation is needed. Legal help becomes useful when evidence, liability, insurer contact, documentation, or case-type complexity starts to matter.`,
            `That timing guidance is what separates a serious decision page from a generic legal article.`
          ]),
          sectionHtml('cost', 'Fees, costs, and what people misunderstand', [
            `Cost language in PI should reduce confusion, not sell. Readers need plain explanations of contingency fees, expenses, consult expectations, and what questions to ask before signing anything.`,
            `If a page only pushes urgency and never explains fee structure or tradeoffs, trust drops fast.`
          ]),
          sectionHtml('evidence', 'Evidence, timing, and documentation', [
            `Documentation matters because evidence gets weaker as memories fade, vehicles are repaired, scene conditions change, and insurer narratives harden. The page should tell a reader what to preserve and why.`
          ], [
            'Preserve photos, witness information, records, bills, and timelines.',
            'Track symptoms and treatment changes in a dated, factual way.',
            'Avoid casual statements that guess fault or minimize injury before the facts are clear.'
          ]),
          sectionHtml('questions', 'Questions worth asking', [
            `PI decision pages are strongest when they help the reader ask better questions about case type, evidence, timing, communication, and how the lawyer would actually manage the claim.`
          ], [
            'What evidence matters most in this case type?',
            'What should I do first if medical care is still ongoing?',
            'What does the fee arrangement cover and what is billed separately?',
            'What would make a good lawyer say this is not the right case for them?'
          ]),
          sectionHtml('red-flags', 'Red flags and trust checks', [
            `PI trust depends on tone and specificity. The page should help a reader avoid high-pressure intake framing, vague fee explanations, unrealistic value promises, or instructions that put marketing ahead of medical care and documentation.`,
            `If the content sounds more excited about signing than about helping the reader make a careful decision, the tone is wrong.`
          ]),
          sectionHtml('next-steps', 'What to do next', [
            `The next step should be concrete: get needed medical care, preserve evidence, compare lawyers by case fit and communication quality, and use city pages to shortlist local options by case type.`,
            `A strong PI guide should make the reader feel more organized and less pressured.`
          ])
        ].join('');
      }
    }
  };
  return configs[vertical];
}
function buildGuideHtml(guide, profile) {
  const slug = slugFromRoute(guide.route);
  const topic = topicFromSlug(slug);
  return `<h2>${escapeHtml(guide.title)}</h2>\n<p>${profile.disclaimer}</p>\n${profile.sections({ title: guide.title, description: guide.description, slug, topic })}`;
}
function upsertGuides(relDir, guides, profile) {
  const root = repoRoot();
  const dir = path.join(root, relDir);
  ensureDir(dir);
  guides.forEach((guide) => {
    const slug = slugFromRoute(guide.route);
    const enriched = {
      ...guide,
      main_html: buildGuideHtml(guide, profile)
    };
    writeJson(path.join(dir, guideFilename(relDir, slug)), enriched);
  });
}
function normalizeAllGuides(relDir, profile) {
  const root = repoRoot();
  const dir = path.join(root, relDir);
  ensureDir(dir);
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'guides.json' && name !== 'home.json');
  let count = 0;
  for (const name of files) {
    const fp = path.join(dir, name);
    const data = readJson(fp);
    if (!data || typeof data !== 'object') continue;
    if (!String(data.route || '').startsWith('/guides/')) continue;
    data.main_html = buildGuideHtml(data, profile);
    writeJson(fp, data);
    count += 1;
  }
  return count;
}
function writeOverrides(relFile, payload) {
  const root = repoRoot();
  writeJson(path.join(root, relFile), payload);
}
function runSyncGuides() {
  const root = repoRoot();
  const res = spawnSync('node', ['scripts/sync_guides.js'], { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}
function auditVertical(profile) {
  const root = repoRoot();
  const dir = path.join(root, profile.relDir);
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json') && name !== 'guides.json' && name !== 'home.json');
  const issues = [];
  let guideCount = 0;
  const routes = new Set();
  for (const name of files) {
    const data = readJson(path.join(dir, name));
    if (!String(data.route || '').startsWith('/guides/')) continue;
    guideCount += 1;
    routes.add(data.route);
    const html = String(data.main_html || '');
    if (wordCount(html) < 320) issues.push(`${name}: thin guide body (${wordCount(html)} words)`);
    for (const id of profile.requiredIds) {
      if (!html.includes(`id="${id}"`)) issues.push(`${name}: missing section id ${id}`);
    }
  }
  if (guideCount < profile.minGuides) issues.push(`guide count ${guideCount} is below minimum ${profile.minGuides}`);
  for (const route of profile.requiredRoutes) {
    if (!routes.has(route)) issues.push(`required route missing ${route}`);
  }
  if (issues.length) {
    console.error(`VERTICAL AUDIT FAIL (${path.basename(profile.relDir)})`);
    issues.forEach((issue) => console.error(` - ${issue}`));
    process.exit(1);
  }
  console.log(`VERTICAL AUDIT PASS (${path.basename(profile.relDir)}) — guides=${guideCount}`);
}
function summarize(name, guides, normalizedCount) {
  console.log(`UPDATED ${name}: seeded=${guides.length} normalized=${normalizedCount}`);
}
module.exports = { profileConfig, upsertGuides, normalizeAllGuides, writeOverrides, runSyncGuides, auditVertical, summarize };
