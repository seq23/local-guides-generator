'use strict';
/**
 * The canonical homepage, one template for all six sites (owner-approved layout,
 * 14 Oct 2026). Section order, top to bottom:
 *
 *   hero (the reader's question as the H1) -> the questions people ask first
 *   (six existing FAQ answers) -> at a glance -> by state (or, for the Memphis
 *   site, by city or hospital) -> examples of providers -> guides in order ->
 *   get a callback (inline short form posting to /api/request-assistance; the
 *   Memphis site keeps its 7-question intake) -> about + how we work.
 *
 * Every value on the page comes from data the repository already holds: the
 * pack's FAQ (data/page_sets/examples/<pack>_v1.json faq.global), its global
 * pages (guide titles and routes, the home.json definition / about / start-with
 * cards), the provider example data the old preview used, the state list, and
 * the strengthened-page list for "Most read". A row whose value does not exist
 * in that data says "See the <guide>" and links to it; nothing is invented.
 *
 * The per-site copy below (eyebrow, H1, subline, nav labels, the "verify, then
 * ask" line) is template copy from the approved mock-ups, not data. Every route
 * it names is checked against the pack's real global pages at build time and
 * the build throws on a route that does not exist, so a renamed guide fails the
 * build instead of shipping a dead link.
 *
 * Guarded by scripts/validation/homepage_shape_contract.js (hard_fail tier).
 */

const { SERVICE_QUESTION, serviceSelectHtml } = require('./neuro_services');

const NEUTRALITY = 'We do not rank providers. Providers may pay a listing or referral fee; that never changes the guides.';

const SITES = {
  uscis_medical: {
    accent: '#0A5C66', accentHover: '#073F46',
    providerNoun: 'civil surgeon', providerPlural: 'civil surgeons', findLabel: 'Find a civil surgeon',
    advice: 'medical or legal',
    nav: [['Costs', '/guides/uscis-medical-exam-cost/'], ['What to bring', '/guides/document-checklist/'], ['Timeline', '/guides/costs-and-timeframes/']],
    eyebrow: 'Immigration medical exam · Form I-693',
    h1: 'The USCIS medical exam: what it costs, what to bring, and how long it takes.',
    sub: 'Plain answers to the questions people ask before they book a civil surgeon, with the official source behind each one.',
    sources: 'U.S. Citizenship and Immigration Services, Federation of State Medical Boards',
    tiles: ['How much does an I-693 exam usually cost?', 'What documents are needed for the exam?', 'How long does the exam process take?', 'Who is allowed to perform an I-693 exam?', 'Are vaccinations included in the exam cost?', 'Do clinics provide sealed envelopes?'],
    glance: [
      ['Exam fee', 'How much does an I-693 exam usually cost?', '/guides/uscis-medical-exam-cost/'],
      ['Vaccines', 'Are vaccinations included in the exam cost?', '/guides/uscis-vaccination-requirements/'],
      ['How long it takes', 'How long does the exam process take?', '/guides/costs-and-timeframes/'],
      ['Who can sign', 'Who is allowed to perform an I-693 exam?', '/guides/i-693-medical-exam-requirements/'],
      ['How long it stays valid', null, '/guides/i-693-form-instructions/']
    ],
    verify: 'Verify the designation on the USCIS locator, then ask: fee scope, lab handling, and how the sealed form is returned.'
  },
  dentistry: {
    accent: '#1D4ED8', accentHover: '#1E40AF',
    providerNoun: 'dentist', providerPlural: 'dental providers', findLabel: 'Find a dentist',
    advice: 'medical or dental',
    nav: [['Costs', '/guides/cost-financing/'], ['Insurance', '/guides/dental-insurance-coverage-explained/'], ['Treatments', '/guides/dental-procedure-cost-comparison/']],
    eyebrow: 'Dentistry decisions · implants, veneers, sedation, full-arch',
    h1: 'Dental work, explained before you book: what it costs, what insurance covers, and what to ask any dentist.',
    sub: 'Plain answers to the questions people ask before an exam, an implant, veneers or sedation, with the source behind each one.',
    sources: 'American Dental Association, Centers for Medicare & Medicaid Services',
    tiles: ['How much does a dental exam and cleaning usually cost?', 'Does dental insurance cover routine visits?', 'What is the difference between a general dentist and a specialist?', 'Are treatment plans provided in writing?', 'Can I get a second opinion on dental work?', 'What should I ask before starting dental treatment?'],
    glance: [
      ['Exam and cleaning', 'How much does a dental exam and cleaning usually cost?', '/guides/cost-financing/'],
      ['Insurance', 'Does dental insurance cover routine visits?', '/guides/dental-insurance-coverage-explained/'],
      ['Single implant', null, '/guides/dental-implant-and-oral-surgery-cost/'],
      ['Veneers', null, '/guides/veneers/'],
      ['Treatment plans', 'Are treatment plans provided in writing?', '/guides/questions-to-ask/']
    ],
    verify: 'Verify the license with the state dental board, then ask: an itemized written plan, who does the work, and what follow-up costs.'
  },
  trt: {
    accent: '#A16207', accentHover: '#854D0E',
    providerNoun: 'clinic', providerPlural: 'clinics', findLabel: 'Find a clinic',
    advice: 'medical',
    nav: [['Costs', '/guides/hormone-therapy-cost-what-is-published/'], ['Labs', '/guides/trt-pricing-and-labs/'], ['Treatments', '/guides/testosterone-replacement-therapy-overview/']],
    // Women seeking menopause / perimenopause HRT are named alongside TRT
    // (owner, 16 Oct 2026). Copy only; the approved section order is unchanged.
    eyebrow: 'TRT · menopause HRT · peptides · IV therapy · hair restoration',
    h1: 'Hormone therapy for men and women, explained: TRT, menopause and perimenopause HRT, what each one costs, and the labs a clinic should run first.',
    sub: 'Plain answers to the questions people ask before signing up with a TRT, menopause HRT, IV, peptide or hair clinic, with the source behind each one.',
    providersLead: 'Examples, not rankings. Every state and city page lists clinics near you, with the same checklist, whether you are looking into TRT or menopause and perimenopause HRT.',
    callbackHeading: 'Get a callback from a TRT or menopause HRT clinic in your area.',
    callbackNote: ['Looking for menopause or perimenopause HRT? Choose “Menopause / women\'s HRT clinic” above. Before you book, read', '/guides/hormone-replacement-therapy-near-me/'],
    sources: 'U.S. Food and Drug Administration, Federation of State Medical Boards, Centers for Medicare & Medicaid Services',
    tiles: ['What tests are required before starting TRT?', 'How much does TRT usually cost per month?', 'Can TRT be done via telehealth?', 'Are peptide injections FDA-approved?', 'Are there risks or side effects with TRT?', 'Is TRT covered by insurance?'],
    glance: [
      ['TRT, monthly', 'How much does TRT usually cost per month?', '/guides/trt-pricing-and-labs/'],
      ['Insurance', 'Is TRT covered by insurance?', '/guides/does-insurance-cover-testosterone-therapy/'],
      ['Labs before starting', 'What tests are required before starting TRT?', '/guides/trt-pricing-and-labs/'],
      ['Peptide programs', 'How much do peptide programs usually cost?', '/guides/peptide-program-costs/'],
      ['Monitoring', 'Is long-term monitoring required?', '/guides/trt-side-effects-and-safety/']
    ],
    verify: 'Verify the prescriber’s license with the state medical board, then ask: baseline labs, the all-in monthly price, and the monitoring schedule.'
  },
  neuro: {
    accent: '#6D28D9', accentHover: '#5B21B6',
    // Evaluation AND therapy (owner, 16 Oct 2026): many providers do both, and
    // therapy practices are the recurring-client side. Evaluation stays first
    // everywhere (the only search clicks are on testing pages).
    providerNoun: 'provider', providerPlural: 'evaluation and therapy providers', findLabel: 'Find an evaluator',
    advice: 'medical, psychological or legal',
    nav: [['Costs', '/guides/neuropsychological-evaluation-cost/'], ['Wait times', '/guides/hospital-vs-private-neuropsych-testing/'], ['School vs private', '/guides/school-district-vs-private-vs-ssa-evaluation/']],
    eyebrow: 'ADHD · autism · evaluations and testing · therapy · children and adults',
    h1: 'ADHD and autism: getting evaluated, and finding therapy — with or without a diagnosis.',
    sub: 'Plain answers for parents and adults on school, private and clinical evaluations — what they cost and how long the wait is — and on finding ADHD or autism therapy, with the source behind each one.',
    // Two equal primary buttons, both to the state and city finder.
    heroCtas: [['Find an evaluator', '#states'], ['Find ADHD or autism therapy', '#states']],
    sources: 'Centers for Medicare & Medicaid Services, U.S. Department of Education (IDEA), state psychology licensing boards',
    tiles: ['What is a neuropsychological evaluation?', 'Who conducts the evaluation?', 'How much does a neuropsychological evaluation usually cost?', 'Does insurance cover evaluations?', 'Is a referral required?', 'What happens after an ADHD or autism evaluation?', 'Do I need a diagnosis to start ADHD therapy?', 'Does insurance cover ADHD therapy?', 'Therapy, coaching or medication: which comes first for ADHD?'],
    tileCount: 9,
    // A tile whose full answer is a guide links to that guide, not the FAQ.
    tileLinks: {
      'Do I need a diagnosis to start ADHD therapy?': '/guides/questions-to-ask-an-adhd-therapist/',
      'Does insurance cover ADHD therapy?': '/guides/adhd-therapy-after-an-evaluation/',
      'Therapy, coaching or medication: which comes first for ADHD?': '/guides/adhd-therapy-vs-medication-vs-coaching/'
    },
    callbackHeading: 'Get a callback from a provider in your area.',
    serviceChoice: true,
    glance: [
      ['Full evaluation', 'How much does a neuropsychological evaluation usually cost?', '/guides/neuropsychological-evaluation-cost/'],
      ['Testing time', 'How long does testing take?', '/guides/neuropsych-testing-overview/'],
      ['Report', 'When will I receive the final report?', '/guides/what-a-neuro-report-includes/'],
      ['Insurance', 'Does insurance cover evaluations?', '/guides/neuro-insurance-and-out-of-network/'],
      ['Who evaluates', 'Who conducts the evaluation?', '/guides/how-to-choose-a-neuro-evaluation-provider/']
    ],
    verify: 'Verify the license with the state psychology board, then ask: the testing scope, the wait, and what the written report includes.'
  },
  pi: {
    accent: '#B45309', accentHover: '#92400E',
    providerNoun: 'attorney', providerPlural: 'law firms', findLabel: 'Find an attorney',
    advice: 'legal',
    nav: [['Costs', '/guides/personal-injury-fees-explained/'], ['First 48 hours', '/guides/what-to-do-after-an-accident/'], ['Deadlines', '/guides/when-to-call-a-personal-injury-lawyer/']],
    eyebrow: 'Personal injury claims · car, work, slip and fall, medical',
    h1: 'After an injury: what to do first, how long you have to file, what a lawyer costs, and how a claim actually moves.',
    sub: 'Plain answers for the first week after an accident, by state, with the statute or source behind each one.',
    sources: 'State bar and attorney discipline agencies, Administrative Office of the U.S. Courts, Internal Revenue Service',
    tiles: ['What documents should I collect after an accident?', 'Should I speak to a personal injury lawyer before insurance contacts me?', 'How much does a personal injury lawyer typically cost?', 'What does a personal injury consultation usually include?', 'How long do personal injury cases usually take?', 'What questions should I ask before hiring a lawyer?'],
    glance: [
      ['Lawyer fee', 'How much does a personal injury lawyer typically cost?', '/guides/personal-injury-fees-explained/'],
      ['Filing deadline', null, '/guides/when-to-call-a-personal-injury-lawyer/'],
      ['Typical timeline', 'How long do personal injury cases usually take?', '/guides/settlement-costs-before-and-after-filing-suit/'],
      ['Keep', 'What documents should I collect after an accident?', '/guides/evidence-checklist-after-an-accident/'],
      ['Guarantees', 'Are guarantees or promises of results allowed?', '/guides/personal-injury-lawyer-red-flags/']
    ],
    verify: 'Verify the license and discipline record with the state bar, then ask: the contingency percentage, who pays case costs, and who handles your file.',
    // There is no single best personal injury lawyer; the honest version of that
    // query is the comparison this section sets up.
    providersLead: 'Examples, not rankings. There is no single best personal injury lawyer for every case; each state page lists firms with the same checklist so you can compare fees, experience and communication.'
  },
  senior_living: {
    accent: '#047857', accentHover: '#065F46',
    providerNoun: 'community', providerPlural: 'communities', findLabel: 'Find a community',
    advice: 'medical or legal',
    nav: [['Costs', '/guides/assisted-living-cost-memphis/'], ['Who pays', '/guides/how-families-pay-for-assisted-living/'], ['Memory care', '/guides/memory-care-when-is-it-time/']],
    eyebrow: 'Assisted living · memory care · Memphis, Germantown, Collierville, Bartlett, Cordova, DeSoto County',
    h1: 'Assisted living and memory care near Memphis: what they cost, who pays, and how to choose fast after a hospital discharge.',
    sub: 'Plain answers for families, with every licensed community in the area, its licence number and phone. Free for families.',
    sources: 'Tennessee Health Facilities Commission, Mississippi State Department of Health, Division of TennCare',
    questionsHeading: 'The questions families ask first',
    guidesHeading: 'Guides, in the order most families need them',
    tiles: ['What is the difference between assisted living, memory care and a care home?', 'How do I choose a senior care home in Memphis?', 'How much does assisted living cost in Tennessee?', 'When is it time for memory care?', 'Why did the quote go up after the assessment?', 'Does TennCare pay for assisted living?'],
    glance: [
      ['Assisted living cost', 'How much does assisted living cost in Tennessee?', '/guides/assisted-living-cost-memphis/'],
      ['What the monthly rate includes', 'What does the monthly rate include?', '/guides/assisted-living-cost-memphis/'],
      ['Medicare', 'Does Medicare pay for assisted living?', '/guides/how-families-pay-for-assisted-living/'],
      ['TennCare CHOICES', 'Does TennCare pay for assisted living?', '/guides/when-the-money-runs-out-tenncare-choices/'],
      ['Licensing', 'What does Tennessee license assisted living as?', '/guides/levels-of-care-tennessee/']
    ]
  }
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function trimWords(text, max) {
  const words = String(text || '').trim().split(/\s+/);
  if (words.length <= max + 5) return words.join(' ');
  return words.slice(0, max).join(' ').replace(/[,;:.]+$/, '') + '…';
}

function siteFor(verticalKey) {
  return SITES[String(verticalKey || '').toLowerCase()] || null;
}

/** The six (or cfg.tileCount) FAQ items the homepage shows (and its FAQPage carries), from the pack's own FAQ. */
function selectHomeFaq(verticalKey, faqItems) {
  const cfg = siteFor(verticalKey);
  const items = Array.isArray(faqItems) ? faqItems : [];
  const byQ = new Map(items.map((x) => [String(x.q).trim(), x]));
  const count = (cfg && cfg.tileCount) || 6;
  const out = [];
  for (const q of (cfg && cfg.tiles) || []) {
    const hit = byQ.get(q);
    if (hit && !out.includes(hit)) out.push(hit);
  }
  // Fill from the pack's own order, skipping questions about the site itself.
  for (const x of items) {
    if (out.length >= count) break;
    if (out.includes(x) || /this site/i.test(x.q)) continue;
    out.push(x);
  }
  return out.slice(0, count);
}

function parseStartCards(homeMainHtml) {
  const html = String(homeMainHtml || '');
  const sec = html.match(/<section[^>]*>\s*<h2>(?:Start[^<]*)<\/h2>[\s\S]*?<\/section>/i);
  if (!sec) return [];
  const cards = [];
  const re = /<div class="card"><h3><a href="([^"]+)">([\s\S]*?)<\/a><\/h3><p>([\s\S]*?)<\/p><\/div>/g;
  let m;
  while ((m = re.exec(sec[0]))) cards.push({ href: m[1], title: stripTags(m[2]), text: stripTags(m[3]) });
  return cards;
}

function firstMatch(html, re) {
  const m = String(html || '').match(re);
  return m ? m : null;
}

/** The pieces of the existing home.json the new template keeps. */
function extractHomeParts(homeMainHtml) {
  const html = String(homeMainHtml || '');
  const def = firstMatch(html, /<p class="site-definition" data-site-definition="true">[\s\S]*?<\/p>/i);
  const about = firstMatch(html, /<section[^>]*data-home-about-block="true"[^>]*>[\s\S]*?<\/h2>\s*([\s\S]*?)<\/section>/i);
  const intake = firstMatch(html, /<section class="section senior-intake-zone"[\s\S]*?<\/section>/i);
  const cityGrid = firstMatch(html, /<section class="section" data-home-city-grid="true">[\s\S]*?<\/section>/i);
  const neverPay = firstMatch(html, /<p>(Families never pay us[\s\S]*?)<\/p>/i);
  const cityLinks = [];
  if (cityGrid) {
    const re = /<a href="([^"]+)">([^<]+)<\/a>/g;
    let m;
    while ((m = re.exec(cityGrid[0]))) cityLinks.push({ href: m[1], label: m[2] });
  }
  return {
    definitionHtml: def ? def[0] : '',
    aboutHtml: about ? about[1].trim() : '',
    intakeHtml: intake ? intake[0] : '',
    cityLinks,
    neverPayText: neverPay ? stripTags(neverPay[1]) : '',
    startCards: parseStartCards(html)
  };
}

// Site chrome (header + footer). Since 14 Oct 2026 the homepage's header and
// footer are the chrome of EVERY page on the six canonical sites (owner: "all
// page shapes the same"). build_city_sites.js applies them once, to the shared
// base template and footer, so no page type renders its own.
// The primary button always targets the homepage callback band: "#match" on the
// homepage itself, "/#match" everywhere else (same target).
const HOME_CTA_HREF = '#match';
const SITE_CTA_HREF = '/#match';

function navItems(cfg, ctaHref) {
  return cfg.nav.map(([label, href]) => ({ label, href }))
    .concat([{ label: 'Guides', href: '/guides/' }, { label: 'FAQ', href: '/faq/' }, { label: cfg.findLabel, href: ctaHref, cta: true }]);
}

function navHtml(cfg, ctaHref) {
  return navItems(cfg, ctaHref).map((x) => '<a' + (x.cta ? ' class="hp-nav-cta"' : '') + ' href="' + esc(x.href) + '">' + esc(x.label) + '</a>').join('');
}

/** Header for every page: wordmark + parent line, consumer nav, primary button.
 *  opts.home marks the homepage instance (data-home-header, in-page #match). */
function renderHeaderHtml(verticalKey, brandName, opts) {
  const cfg = siteFor(verticalKey);
  const home = !opts || opts.home !== false;
  return '<header class="site-header hp-header"' + (home ? ' data-home-header="true"' : '') + ' data-site-chrome="header" style="--hp-accent:' + cfg.accent + ';--hp-accent-hover:' + cfg.accentHover + '">' +
    '<div class="hp-wrap hp-header-inner">' +
    '<a class="hp-brand" href="/" aria-label="' + esc(brandName) + ' home"><span class="hp-wordmark">' + esc(brandName) + '</span><span class="hp-parent">Part of The Industry Guides</span></a>' +
    '<nav class="top-nav hp-nav" aria-label="Primary">' + navHtml(cfg, home ? HOME_CTA_HREF : SITE_CTA_HREF) + '</nav>' +
    '</div></header>';
}

// Links that lived in the old header move to the footer so no page loses a
// link. The personal-injury hub was an extra header link on that site only.
const FOOTER_EXTRA = { pi: [['Personal Injury', '/personal-injury/']] };

/** Footer for every page. The shared disclosures stay; the old header's links move here. */
function renderFooterHtml(verticalKey, sharedFooterHtml) {
  const cfg = siteFor(verticalKey);
  const links = [['Methodology', '/methodology/'], ['Advertising & Provider Info', '/for-providers/'], ['Contact', '/contact/']]
    .concat(FOOTER_EXTRA[verticalKey] || []);
  const extra = '<nav class="footer-nav hp-footer-nav" aria-label="Site">' +
    links.map(([label, href]) => '<a href="' + esc(href) + '">' + esc(label) + '</a>').join('') +
    '</nav>' +
    '<p class="hp-footer-line" data-home-footer-line="true">Educational content, not ' + esc(cfg.advice) + ' advice.</p>';
  const out = String(sharedFooterHtml || '').replace(/(<\/div>\s*<\/footer>)/i, extra + '$1');
  if (out === String(sharedFooterHtml || '')) throw new Error('homepage_v2: shared footer has no closing </div></footer> to extend');
  return out.replace(/<footer\b/i, '<footer data-site-chrome="footer"');
}

function routeChecker(knownRoutes, verticalKey) {
  return (href) => {
    if (!/^\/guides\/.+/.test(href)) return href;
    if (!knownRoutes.has(href)) throw new Error('homepage_v2: ' + verticalKey + ' links to ' + href + ', which is not a page in this pack');
    return href;
  };
}

function render(ctx) {
  const vk = String(ctx.verticalKey || '').toLowerCase();
  const cfg = siteFor(vk);
  if (!cfg) return null;
  const isSenior = vk === 'senior_living';
  const brand = ctx.brandName;
  const known = new Set((ctx.guides || []).map((g) => g.route));
  const check = routeChecker(known, vk);
  cfg.nav.forEach(([, href]) => check(href));
  const titleOf = (href) => ((ctx.guides || []).find((g) => g.route === href) || {}).title || href;
  const parts = extractHomeParts(ctx.homeMainHtml);
  if (!parts.definitionHtml) throw new Error('homepage_v2: ' + vk + ' home.json has no site-definition paragraph');
  const faqAll = Array.isArray(ctx.faqItems) ? ctx.faqItems : [];
  const faq = selectHomeFaq(vk, faqAll);
  const faqByQ = new Map(faqAll.map((x) => [String(x.q).trim(), x]));

  const out = [];

  // 1. Hero
  out.push(
    '<section class="hero" data-home-hero="true">' +
      '<div class="hp-wrap">' +
        '<p class="kicker hp-eyebrow">' + esc(cfg.eyebrow) + '</p>' +
        '<h1>' + esc(cfg.h1) + '</h1>' +
        '<p class="hp-sub" data-hero-subline="true">' + esc(cfg.sub) + '</p>' +
        '<p class="hp-actions" data-primary-conversion-cta="true">' +
        (cfg.heroCtas
          ? cfg.heroCtas.map(([label, href]) => '<a class="hp-btn hp-btn--primary" href="' + esc(href) + '" data-home-hero-cta="true">' + esc(label) + '</a>').join('')
          : '<a class="hp-btn hp-btn--primary" href="#match" data-home-hero-cta="true">' + esc(cfg.findLabel) + ' near me</a>') +
        '<a class="hp-btn hp-btn--ghost" href="/guides/">Browse all guides</a></p>' +
        '<p class="hp-trust" data-home-trust-line="true">Reviewed by The Industry Guides Editorial Team · Updated <time data-page-modified="true" datetime="' + esc(ctx.buildIso) + '">' + esc(ctx.buildIso) + '</time> · Sources: ' + esc(cfg.sources) + '</p>' +
      '</div>' +
    '</section>'
  );
  out.push('%%AD:global_home_hero%%');

  // 2. The questions people ask first
  out.push(
    '<section class="section hp-section answer-block" id="questions" data-home-questions="true">' +
      '<div class="hp-wrap">' +
        '<div class="hp-head"><h2>' + esc(cfg.questionsHeading || 'The questions people ask first') + '</h2>' +
        '<a href="/faq/">All ' + faqAll.length + ' questions</a></div>' +
        '<p class="hp-muted hp-lead">Short answers first. What applies to you depends on your situation, but each one links to the full answer.</p>' +
        '<div class="hp-grid hp-grid--3">' +
        faq.map((x) => {
          const guide = cfg.tileLinks && cfg.tileLinks[String(x.q).trim()];
          const link = guide ? '<a href="' + esc(check(guide)) + '">Full answer: ' + esc(titleOf(guide)) + '</a>' : '<a href="/faq/">Full answer in the FAQ</a>';
          return '<article class="hp-card" data-home-question="true"><h3>' + esc(x.q) + '</h3><p>' + esc(trimWords(x.a, 40)) + '</p>' + link + '</article>';
        }).join('') +
        '</div>' +
      '</div>' +
    '</section>'
  );

  // 3. At a glance
  out.push(
    '<section class="section hp-section" id="glance" data-home-glance="true">' +
      '<div class="hp-wrap">' +
        '<h2>At a glance</h2>' +
        '<dl class="hp-glance">' +
        cfg.glance.map(([label, q, href]) => {
          check(href);
          const hit = q ? faqByQ.get(q) : null;
          const value = hit
            ? esc(trimWords(hit.a, 40)) + ' <span class="hp-muted">See:</span> <a href="' + esc(href) + '">' + esc(titleOf(href)) + '</a>'
            : 'See the <a href="' + esc(href) + '">' + esc(titleOf(href)) + '</a> guide.';
          return '<div class="hp-glance-row"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
        }).join('') +
        '</dl>' +
      '</div>' +
    '</section>'
  );

  // 4. By state (Memphis: by city or hospital)
  if (isSenior) {
    out.push(
      '<section class="section hp-section" id="states" data-home-city-grid="true">' +
        '<div class="hp-wrap">' +
          '<h2>Browse by city or hospital</h2>' +
          '<p class="hp-muted">Each page lists the licensed communities nearest to it, with phone numbers, licence numbers and memory care.</p>' +
          '<p class="hp-chips">' + parts.cityLinks.map((c) => '<a class="hp-chip" href="' + esc(c.href) + '">' + esc(c.label) + '</a>').join('') + '</p>' +
        '</div>' +
      '</section>'
    );
  } else {
    const states = ctx.states || [];
    const top = ctx.topStates || [];
    out.push(
      '<section class="section hp-section" id="states" data-home-state-grid-shell="true">' +
        '<div class="hp-wrap">' +
          '<h2>' + esc(cfg.providerPlural.charAt(0).toUpperCase() + cfg.providerPlural.slice(1)) + ' and rules by state</h2>' +
          '<form class="hp-state-form" action="/" method="get" data-home-state-select="true" onsubmit="var v=this.querySelector(\'select\').value;if(v){window.location.href=v;}return false;">' +
            '<label for="hp-state">Choose your state</label>' +
            '<select id="hp-state" name="state"><option value="">Select a state</option>' +
            states.map((s) => '<option value="/states/' + esc(s.abbr) + '/">' + esc(s.name) + '</option>').join('') +
            '</select><button type="submit" class="hp-btn hp-btn--primary">Go</button>' +
          '</form>' +
          '<p class="hp-chips"><span class="hp-muted">Most visited:</span>' + top.map((s) => '<a class="hp-chip" href="/states/' + esc(s.abbr) + '/">' + esc(s.name) + '</a>').join('') + '</p>' +
          '<details class="hp-all-states"><summary>All ' + states.length + ' states</summary>' +
            '<ul class="hp-chips hp-state-list" data-home-state-grid="true">' + states.map((st) => '<li><a class="hp-chip" href="/states/' + esc(st.abbr) + '/">' + esc(st.name) + '</a></li>').join('') + '</ul>' +
          '</details>' +
        '</div>' +
      '</section>'
    );
  }

  // 5. Examples of providers
  if (isSenior) {
    out.push(String(ctx.seniorPreviewHtml || '').replace('<section class="section" data-home-provider-preview="true">', '<section class="section hp-section hp-providers" id="providers" data-home-provider-preview="true"><div class="hp-wrap">').replace(/<\/section>\s*$/, '</div></section>'));
  } else {
    const cards = ctx.providerCards || [];
    out.push(
      '<section class="section hp-section hp-providers provider-directory-section provider-directory-section--preview" id="providers" data-provider-directory="true" data-home-provider-preview="true">' +
        '<div class="hp-wrap">' +
          '<h2>Examples of ' + esc(cfg.providerPlural) + '</h2>' +
          '<p class="hp-muted">' + esc(cfg.providersLead || 'Examples, not rankings. Every state and city page lists ' + cfg.providerPlural + ' near you, with the same checklist.') + '</p>' +
          '<div class="hp-grid hp-grid--2 provider-directory-grid">' +
          cards.map((c) => '<article class="hp-card provider-card" data-provider-card="true">' +
            '<h3 class="provider-card__name">' + esc(c.name) + '</h3>' +
            (c.serviceTag ? '<p class="provider-card__service" data-provider-service-tag="' + esc(c.serviceTag) + '">' + esc(c.serviceTag) + '</p>' : '') +
            '<p class="provider-card__meta" data-provider-card-meta="true">' + esc([c.category, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' — ')) + '</p>' +
            '<p class="hp-verify provider-card__attributes" data-provider-card-attributes="true" data-provider-verify-line="true">' + esc(cfg.verify) + '</p>' +
            '<a href="#match" data-provider-callback="true">Request a callback</a>' +
          '</article>').join('') +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }
  out.push('%%AD:global_home_mid%%');

  // 6. Guides, in order
  const ranked = ctx.rankedLinks || [];
  out.push(
    '<section class="section hp-section" id="guides" data-home-guides="true">' +
      '<div class="hp-wrap">' +
        '<h2>' + esc(cfg.guidesHeading || 'Guides, in the order most people need them') + '</h2>' +
        '<ol class="hp-grid hp-grid--3 hp-steps">' +
        parts.startCards.map((c, i) => '<li class="hp-card"><span class="hp-step">Step ' + (i + 1) + '</span><h3><a href="' + esc(check(c.href)) + '">' + esc(c.title) + '</a></h3><p>' + esc(c.text) + '</p></li>').join('') +
        '</ol>' +
        (ranked.length ? '<p class="hp-most-read" data-search-ranked-links="true"><span class="hp-muted">Most read:</span> ' + ranked.map((r) => '<a href="' + esc(r.route) + '">' + esc(r.title) + '</a>').join(' · ') + '</p>' : '') +
      '</div>' +
    '</section>'
  );

  // 7. Get a callback
  if (isSenior) {
    out.push(
      '<section class="section hp-band" id="match" data-home-callback="true" data-connection-bubble="true">' +
        '<div class="hp-wrap">' +
          '<h2>Tell us what your parent needs. We will connect you with licensed communities that fit.</h2>' +
          (parts.neverPayText ? '<p class="hp-band-note" data-home-neutrality="true">' + esc(parts.neverPayText) + '</p>' : '') +
          '<p class="hp-actions"><a class="hp-btn hp-btn--light" href="#senior-intake" data-home-callback-cta="true">Start the questions</a></p>' +
          '<div class="hp-band-panel">' + parts.intakeHtml.replace(/<h2[^>]*>[\s\S]*?<\/h2>\s*/i, '') + '</div>' +
        '</div>' +
      '</section>'
    );
  } else {
    const pt = ctx.providerTypeLabel;
    const options = (ctx.providerTypeOptions || []).map((o) => '<option' + (o === pt ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
    const hidden = {
      src: '/', intent_type: 'direct_match', button_source: 'home_callback_band', vertical_key: ctx.verticalParam,
      page_kind: 'global', page_slug: 'home', market_slug: '', sponsor_slug: '', sponsor_scope: '', campaign_slug: ''
    };
    out.push(
      '<section class="section hp-band" id="match" data-home-callback="true" data-connection-bubble="true">' +
        '<div class="hp-wrap">' +
          '<h2>' + esc(cfg.callbackHeading || ('Get a callback from ' + (/^[aeiou]/i.test(cfg.providerNoun) ? 'an ' : 'a ') + cfg.providerNoun + ' in your area.')) + '</h2>' +
          '<p class="hp-band-note">One short request. We pass it to a provider near you. We never ask for case details here.</p>' +
          (cfg.callbackNote ? '<p class="hp-band-note" data-home-womens-hrt="true">' + esc(cfg.callbackNote[0]) + ' <a href="' + esc(check(cfg.callbackNote[1])) + '">' + esc(titleOf(cfg.callbackNote[1])) + '</a>.</p>' : '') +
          '<form id="home-callback-form" class="hp-form" method="post" action="/api/request-assistance" data-home-callback-form="true">' +
            (cfg.serviceChoice ? '<label data-neuro-service-field="true"><span>' + esc(SERVICE_QUESTION) + '</span>' + serviceSelectHtml() + '</label>' : '') +
            '<label><span>' + (cfg.serviceChoice ? 'Provider type' : 'What do you need?') + '</span><select name="provider_type" required>' + options + '</select></label>' +
            '<label><span>Email</span><input name="email" type="email" autocomplete="email" required placeholder="you@yourmail.com" /></label>' +
            '<label><span>ZIP (optional)</span><input name="zip" inputmode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" placeholder="ZIP" /></label>' +
            Object.entries(hidden).map(([k, v]) => '<input type="hidden" name="' + k + '" value="' + esc(v) + '" />').join('') +
            '<input type="text" name="website" value="" style="display:none" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
            '<label class="hp-consent"><input name="consent" type="checkbox" required /><span>I consent to be contacted by a provider regarding this request. I understand this site is educational only and does not provide professional advice.</span></label>' +
            '<button type="submit" class="hp-btn hp-btn--light">Request a callback</button>' +
            '<span class="hp-status" role="status" aria-live="polite"></span>' +
          '</form>' +
          '<p class="hp-band-note" data-home-neutrality="true">' + esc(NEUTRALITY) + ' Prefer the full form? <a href="/request-assistance/?' + 'pt=' + encodeURIComponent(pt) + '&amp;src=%2F&amp;intent=direct_match&amp;button=home_callback_band&amp;vertical=' + encodeURIComponent(ctx.verticalParam) + '&amp;page_kind=global&amp;page_slug=home">Use the request page</a>.</p>' +
        '</div>' +
      '</section>' +
      '<script>(function(){var f=document.querySelector(\'[data-home-callback-form="true"]\');if(!f||!window.fetch)return;var s=f.querySelector(".hp-status"),b=f.querySelector("button");f.addEventListener("submit",function(e){e.preventDefault();if(s)s.textContent="";if(b)b.disabled=true;var p={};new FormData(f).forEach(function(v,k){p[k]=String(v||"")});fetch("/api/request-assistance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(p)}).then(function(r){if(!r.ok)throw new Error("x");if(s)s.textContent="Submitted. If a provider is active for this category, they may contact you. If you do not hear back, email hello@theindustryguides.com.";f.reset()}).catch(function(){if(s)s.textContent="Could not submit right now. Please try again later or email hello@theindustryguides.com."}).then(function(){if(b)b.disabled=false})})})();</script>'
    );
  }

  // 8. About + How we work
  out.push(
    '<section class="section hp-section" id="about" data-home-about-block="true">' +
      '<div class="hp-wrap hp-about">' +
        '<div><h2>About ' + esc(brand) + '</h2>' +
          parts.definitionHtml +
          (parts.aboutHtml ? parts.aboutHtml : '') +
          '<p>' + esc(isSenior && parts.neverPayText ? parts.neverPayText : NEUTRALITY) + '</p>' +
        '</div>' +
        '<div><h3>How we work</h3><p class="hp-links"><a href="/methodology/">Methodology</a> · <a href="/methodology/#verification">Sources</a> · <a href="/editorial-policy/#corrections">Corrections</a> · <a href="/for-providers/">' + (isSenior ? 'For communities' : 'For providers') + '</a></p></div>' +
      '</div>' +
    '</section>'
  );
  out.push('%%AD:global_home_bottom%%');

  return '<div class="hp" data-home-v2="true" style="--hp-accent:' + cfg.accent + ';--hp-accent-hover:' + cfg.accentHover + '">' + out.join('\n') + '</div>';
}

module.exports = { SITES, NEUTRALITY, siteFor, selectHomeFaq, extractHomeParts, render, renderHeaderHtml, renderFooterHtml, navItems, HOME_CTA_HREF, SITE_CTA_HREF, trimWords };
