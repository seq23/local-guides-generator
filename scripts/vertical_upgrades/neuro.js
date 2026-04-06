#!/usr/bin/env node
const { profileConfig, upsertGuides, normalizeAllGuides, writeOverrides, runSyncGuides, auditVertical, summarize } = require('./lib');
const profile = profileConfig('neuro');
const guides = [
  {
    "route": "/guides/neuro-evaluation-pricing/",
    "title": "Neuro Evaluation Pricing",
    "description": "Neuro evaluation pricing usually reflects time, testing depth, reporting, and whether the evaluation is narrowly targeted or broad enough to answer several questions at once.",
    "main_html": "<h2>Neuro Evaluation Pricing</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Neuro evaluation pricing is rarely just a number for \"testing.\" The real cost usually reflects intake time, interview depth, test administration, scoring, interpretation, and the usefulness of the written report afterward.</p>\n<h3>What usually affects price</h3>\n<ul>\n<li>Whether the evaluation is ADHD-focused, autism-focused, or broader neuropsychological testing</li>\n<li>How much history review and collateral input is included</li>\n<li>Whether the report is short and practical or detailed and multipurpose</li>\n<li>Whether feedback sessions, school/work coordination, or forms are included</li>\n</ul>\n<h3>Why cheaper is not always simpler</h3>\n<p>A low quote may still be fine, but it can mean a narrower scope, less interpretation, or fewer follow-up conversations. The key question is what decision the evaluation is supposed to support and whether the scope actually matches that goal.</p>\n<h3>Questions worth asking</h3>\n<ul>\n<li>What does the quoted fee include from intake to final report?</li>\n<li>Will the report be useful for school, work, or care planning—or only for one purpose?</li>\n<li>What extra charges commonly come up later?</li>\n<li>How long is the wait between testing and the final report?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Good pricing conversations connect the fee to scope, report depth, and next-step usefulness. If a provider can explain cost but not what the evaluation is designed to answer, the pricing discussion is incomplete.</p>\n"
  },
  {
    "route": "/guides/neuro-provider-red-flags/",
    "title": "Neuro Evaluation Provider Red Flags",
    "description": "Neuro provider red flags usually involve vague scope, unrealistic promises, weak report clarity, or pressure to move into services before the evaluation itself is clearly defined.",
    "main_html": "<h2>Neuro Evaluation Provider Red Flags</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The biggest neuro evaluation red flag is confusion about scope. If you cannot tell what question is being evaluated, what the report will do, and what happens afterward, you do not yet have a clean decision surface.</p>\n<h3>Common red flags</h3>\n<ul>\n<li>Promises that the evaluation will automatically unlock services or accommodations</li>\n<li>Very little discussion of report use, limitations, or timeline</li>\n<li>No clear explanation of who does interviews, testing, scoring, and feedback</li>\n<li>Pressure to commit to therapy or packages before the evaluation question is clear</li>\n<li>Vague descriptions like \"full testing\" with no explanation of what is actually included</li>\n</ul>\n<h3>What stronger providers usually explain</h3>\n<p>Why the evaluation is being done, what information will be gathered, how long the process takes, what the report typically contains, and what the likely next steps are depending on the findings.</p>\n<h3>Questions worth asking</h3>\n<ul>\n<li>What practical decisions is this evaluation meant to support?</li>\n<li>What are the limits of the report?</li>\n<li>Will I get a feedback session in plain language?</li>\n<li>What happens if the results are inconclusive?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The best neuro evaluation experiences feel specific, not theatrical. Clarity about scope, timeline, and report use matters more than grand marketing language.</p>\n"
  },
  {
    "route": "/guides/neuro-insurance-and-out-of-network/",
    "title": "Neuro Evaluations: Insurance and Out-of-Network Questions",
    "description": "Insurance coverage for neuro evaluations can vary sharply by purpose, diagnosis pathway, and whether testing is considered medical, behavioral, educational, or out of network.",
    "main_html": "<h2>Neuro Evaluations: Insurance and Out-of-Network Questions</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Coverage questions are usually not just about whether a provider \"takes insurance.\" They are about what kind of evaluation is being requested, what diagnosis or concern is documented, and whether the evaluation purpose fits the payer’s rules.</p>\n<h3>Where confusion usually happens</h3>\n<ul>\n<li>People assume one authorization covers evaluation, report writing, and feedback</li>\n<li>School-related questions and medical-necessity questions get blended together</li>\n<li>Out-of-network reimbursement is described vaguely</li>\n</ul>\n<h3>Questions worth asking before you book</h3>\n<ul>\n<li>What CPT or billing categories are commonly used for this type of evaluation?</li>\n<li>Does the office verify benefits or only provide receipts?</li>\n<li>What parts of the process are most commonly not covered?</li>\n<li>Will the report or feedback session create separate charges?</li>\n</ul>\n<h3>Why this matters</h3>\n<p>Families often compare providers without comparing billing structure, reimbursement paperwork, and timeline. A lower starting quote may not be lower after uncovered steps are added back in.</p>\n<h3>Bottom line</h3>\n<p>The cleanest insurance conversation is specific: what is being evaluated, what parts are covered, what forms you receive, and what cost ranges remain your responsibility.</p>\n"
  },
  {
    "route": "/guides/questions-to-ask-before-neuro-testing/",
    "title": "Questions to Ask Before Neuro Testing",
    "description": "The best pre-testing questions clarify purpose, scope, report usefulness, timeline, and what happens if the evaluation does not deliver a simple answer.",
    "main_html": "<h2>Questions to Ask Before Neuro Testing</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Before neuro testing starts, the most important thing to clarify is not the brand of test. It is the decision you are trying to make and whether the provider’s process is built to answer it.</p>\n<h3>Core questions</h3>\n<ul>\n<li>What exact question is this evaluation trying to answer?</li>\n<li>What information will you gather besides tests?</li>\n<li>How useful is the final report for school, work, treatment planning, or accommodations?</li>\n<li>How long is the process from intake to final feedback?</li>\n<li>What happens if the findings are mixed or inconclusive?</li>\n</ul>\n<h3>Practical questions</h3>\n<ul>\n<li>How many visits are typical?</li>\n<li>How long is testing day?</li>\n<li>Can breaks or split sessions be arranged?</li>\n<li>What records should I gather ahead of time?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Good pre-testing questions make the evaluation feel more grounded and less mysterious. If the office cannot explain purpose, timeline, and report use in plain language, slow down.</p>\n"
  },
  {
    "route": "/guides/what-a-neuro-report-includes/",
    "title": "What a Neuro Evaluation Report Usually Includes",
    "description": "A useful neuro report usually explains the referral question, the information reviewed, the patterns observed, key conclusions, and what those conclusions do and do not mean.",
    "main_html": "<h2>What a Neuro Evaluation Report Usually Includes</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>A strong neuro report does more than list scores. It explains what question was evaluated, what patterns emerged, and how those patterns should be interpreted in practical context.</p>\n<h3>Common report sections</h3>\n<ul>\n<li>Reason for referral or presenting question</li>\n<li>Background history and records reviewed</li>\n<li>Methods, interviews, and testing used</li>\n<li>Findings and interpretation</li>\n<li>Summary impressions and practical recommendations</li>\n</ul>\n<h3>What makes a report more useful</h3>\n<p>Clarity, context, and plain-language explanation. People are often less concerned with raw scores than with what the results mean for school, work, treatment planning, communication, or next-step decisions.</p>\n<h3>Questions worth asking</h3>\n<ul>\n<li>How long and detailed is the report typically?</li>\n<li>Will there be a feedback session to explain it?</li>\n<li>Can the report be tailored to the use case we discussed?</li>\n<li>What recommendations are commonly included?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The report is one of the main deliverables you are paying for. If its usefulness is vague, the overall evaluation value is harder to judge.</p>\n"
  },
  {
    "route": "/guides/telehealth-vs-in-person-neuro/",
    "title": "Telehealth vs In-Person Neuro Evaluations",
    "description": "Telehealth and in-person neuro evaluations are not interchangeable in every case; the better format depends on the referral question, the person being assessed, and what tasks must be observed directly.",
    "main_html": "<h2>Telehealth vs In-Person Neuro Evaluations</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Telehealth can improve access and convenience, but the better format depends on what is being assessed and how much direct observation or structured testing is needed. Convenience alone should not choose the format.</p>\n<h3>When telehealth may work well</h3>\n<ul>\n<li>Intake and history gathering</li>\n<li>Some follow-up and feedback sessions</li>\n<li>Cases where the core question can be answered without heavy performance-based testing</li>\n</ul>\n<h3>When in-person may matter more</h3>\n<ul>\n<li>More complex testing batteries</li>\n<li>Situations where behavior, fatigue, or pacing needs direct observation</li>\n<li>Younger children or people who struggle with remote engagement</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The stronger question is not \"which is better?\" but \"which format gives the cleanest information for this specific decision?\"</p>\n"
  }
];
const overrides = {
  "overrides": {
    "home:/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Core discovery paths","query":"neuro evaluation providers near me","href":"/","label":"Home"},
        {"groupId":"costs","groupLabel":"Core discovery paths","query":"neuro evaluation cost and report timeline","href":"/guides/neuro-evaluation-pricing/","label":"Pricing guide"},
        {"groupId":"faq","groupLabel":"Core discovery paths","query":"neuro evaluation provider red flags","href":"/guides/neuro-provider-red-flags/","label":"Provider red flags"},
        {"groupId":"questions","groupLabel":"Core discovery paths","query":"questions to ask before neuro testing","href":"/guides/questions-to-ask-before-neuro-testing/","label":"Pre-testing questions"},
        {"groupId":"next","groupLabel":"Core discovery paths","query":"what to expect after a neuro evaluation","href":"/guides/what-to-expect-after-a-neuro-evaluation/","label":"After evaluation"}
      ]
    },
    "faq:/faq/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"costs","groupLabel":"FAQ and next steps","query":"neuro evaluation cost and report timeline","href":"/guides/neuro-evaluation-pricing/","label":"Pricing guide"},
        {"groupId":"faq","groupLabel":"FAQ and next steps","query":"neuro evaluation provider red flags","href":"/guides/neuro-provider-red-flags/","label":"Provider red flags"},
        {"groupId":"questions","groupLabel":"FAQ and next steps","query":"questions to ask before neuro testing","href":"/guides/questions-to-ask-before-neuro-testing/","label":"Pre-testing questions"},
        {"groupId":"compare","groupLabel":"FAQ and next steps","query":"telehealth vs in person neuro evaluation","href":"/guides/telehealth-vs-in-person-neuro/","label":"Telehealth vs in-person"},
        {"groupId":"next","groupLabel":"FAQ and next steps","query":"what to expect after a neuro evaluation","href":"/guides/what-to-expect-after-a-neuro-evaluation/","label":"After evaluation"}
      ]
    },
    "guides-hub:/guides/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"costs","groupLabel":"Pricing and coverage","query":"neuro evaluation cost and report timeline","href":"/guides/neuro-evaluation-pricing/","label":"Pricing guide"},
        {"groupId":"costs","groupLabel":"Pricing and coverage","query":"neuro evaluation insurance and out of network questions","href":"/guides/neuro-insurance-and-out-of-network/","label":"Insurance guide"},
        {"groupId":"faq","groupLabel":"Trust and fit","query":"neuro evaluation provider red flags","href":"/guides/neuro-provider-red-flags/","label":"Provider red flags"},
        {"groupId":"questions","groupLabel":"Trust and fit","query":"questions to ask before neuro testing","href":"/guides/questions-to-ask-before-neuro-testing/","label":"Pre-testing questions"},
        {"groupId":"compare","groupLabel":"Trust and fit","query":"telehealth vs in person neuro evaluation","href":"/guides/telehealth-vs-in-person-neuro/","label":"Telehealth vs in-person"},
        {"groupId":"next","groupLabel":"Trust and fit","query":"what to expect after a neuro evaluation","href":"/guides/what-to-expect-after-a-neuro-evaluation/","label":"After evaluation"}
      ]
    },
    "city:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"neuro evaluation providers in {market}","href":"{route}","label":"City hub"},
        {"groupId":"costs","groupLabel":"Costs, timing, next steps","query":"neuro evaluation cost in {market}","href":"/guides/neuro-evaluation-pricing/","label":"Pricing guide"},
        {"groupId":"costs","groupLabel":"Costs, timing, next steps","query":"insurance and out of network neuro evaluation questions in {market}","href":"/guides/neuro-insurance-and-out-of-network/","label":"Insurance guide"},
        {"groupId":"faq","groupLabel":"FAQ and red flags","query":"neuro testing red flags in {market}","href":"/guides/neuro-provider-red-flags/","label":"Provider red flags"},
        {"groupId":"questions","groupLabel":"FAQ and red flags","query":"questions to ask before neuro testing in {market}","href":"/guides/questions-to-ask-before-neuro-testing/","label":"Pre-testing questions"},
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"telehealth vs in person neuro evaluation in {market}","href":"/guides/telehealth-vs-in-person-neuro/","label":"Telehealth vs in-person"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"what to expect after a neuro evaluation in {market}","href":"/guides/what-to-expect-after-a-neuro-evaluation/","label":"After evaluation"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"find a neuro evaluation provider in {market}","href":"/request-assistance/","label":"Request assistance"}
      ]
    },
    "guide-detail:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Primary route","query":"{topic}","href":"{route}","label":"This guide"},
        {"groupId":"primary","groupLabel":"Primary route","query":"what to know about {topic}","href":"{route}","label":"This guide"},
        {"groupId":"costs","groupLabel":"Related decision paths","query":"neuro evaluation cost and report timeline","href":"/guides/neuro-evaluation-pricing/","label":"Pricing guide"},
        {"groupId":"faq","groupLabel":"Related decision paths","query":"neuro evaluation provider red flags","href":"/guides/neuro-provider-red-flags/","label":"Provider red flags"},
        {"groupId":"questions","groupLabel":"Related decision paths","query":"questions to ask before neuro testing","href":"/guides/questions-to-ask-before-neuro-testing/","label":"Pre-testing questions"},
        {"groupId":"next","groupLabel":"Related decision paths","query":"what to expect after a neuro evaluation","href":"/guides/what-to-expect-after-a-neuro-evaluation/","label":"After evaluation"}
      ]
    }
  }
};
upsertGuides(profile.relDir, guides, profile);
const normalizedCount = normalizeAllGuides(profile.relDir, profile);
writeOverrides('data/community/query_compiler/neuro.json', overrides);
runSyncGuides();
auditVertical(profile);
summarize('neuro', guides, normalizedCount);
