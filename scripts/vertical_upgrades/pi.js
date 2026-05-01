#!/usr/bin/env node
const { profileConfig, upsertGuides, normalizeAllGuides, writeOverrides, runSyncGuides, auditVertical, summarize } = require('./lib');
const profile = profileConfig('pi');
const guides = [
  {
    "route": "/guides/what-to-do-after-an-accident/",
    "title": "What to Do After an Accident",
    "description": "The first post-accident priorities are safety, medical evaluation, documentation, and avoiding preventable mistakes before the facts are clear.",
    "main_html": "<h2>What to Do After an Accident</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>After an accident, the first goal is not to build a legal case. It is to protect safety, seek medical evaluation when needed, document what happened, and avoid locking yourself into statements before the facts and injuries are clear.</p>\n<h3>Immediate priorities</h3>\n<ul>\n<li>Get to safety and call emergency services when appropriate</li>\n<li>Seek medical care or evaluation if injury is possible</li>\n<li>Take photographs, identify witnesses, and preserve basic facts</li>\n<li>Keep paperwork, incident numbers, and early treatment records organized</li>\n</ul>\n<h3>Common mistakes</h3>\n<ul>\n<li>Minimizing symptoms too early</li>\n<li>Assuming no visible damage means no meaningful injury</li>\n<li>Giving detailed statements before understanding what happened</li>\n<li>Failing to document medical follow-up and time off work</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The first 24 to 72 hours often shape the clarity of everything that follows. Calm documentation and medical follow-up usually matter more than early certainty about fault or value.</p>\n"
  },
  {
    "route": "/guides/personal-injury-fees-explained/",
    "title": "Personal Injury Fees Explained",
    "description": "Contingency fee arrangements can reduce upfront cost, but they still require clear written terms about percentages, expenses, lien handling, and who pays which costs if the case does not resolve as hoped.",
    "main_html": "<h2>Personal Injury Fees Explained</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>\"No fee unless you win\" is not the same thing as \"no cost and no risk.\" The right question is how fees, expenses, liens, and case costs are handled in writing from start to finish.</p>\n<h3>What people should clarify</h3>\n<ul>\n<li>What percentage applies and when it changes</li>\n<li>Which case expenses are advanced and how they are repaid</li>\n<li>Whether costs come out before or after fees are calculated</li>\n<li>How medical liens or reimbursement obligations are addressed</li>\n<li>Who handles the file day to day</li>\n</ul>\n<h3>Why this matters</h3>\n<p>Many misunderstandings happen because people remember the marketing phrase but not the written structure. Fee clarity reduces surprises and helps compare representation offers more honestly.</p>\n<h3>Bottom line</h3>\n<p>The best fee conversation is specific, written, and calm. If a firm resists plain-language questions about fee mechanics, slow down.</p>\n"
  },
  {
    "route": "/guides/questions-to-ask-a-personal-injury-lawyer/",
    "title": "Questions to Ask a Personal Injury Lawyer",
    "description": "The best pre-signing questions clarify case handling, communication, fees, timing, evidence strategy, and what the first 30 to 90 days usually look like.",
    "main_html": "<h2>Questions to Ask a Personal Injury Lawyer</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Before signing with any firm, you should understand who will actually handle the case, how communication works, what documents matter now, and how fees and costs are explained in writing.</p>\n<h3>Core questions</h3>\n<ul>\n<li>Who will handle the case day to day after intake?</li>\n<li>What are the first steps in the next 30 days?</li>\n<li>What documents or evidence should I preserve right now?</li>\n<li>How are fees and expenses structured in writing?</li>\n<li>How often should I expect updates?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>A good intake conversation should make the process more understandable, not more dependent on vague trust. Clear answers are part of the decision, not an extra.</p>\n"
  },
  {
    "route": "/guides/recorded-statements-and-insurance-calls/",
    "title": "Recorded Statements and Insurance Calls After an Accident",
    "description": "Insurance calls can feel routine, but what is said early can shape later claim disputes if symptoms, timelines, or fault assumptions are incomplete.",
    "main_html": "<h2>Recorded Statements and Insurance Calls After an Accident</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Insurance communication after an accident is not automatically hostile, but it is still consequential. People should understand what information is being requested, why it matters, and whether they are prepared to answer accurately.</p>\n<h3>Common pressure points</h3>\n<ul>\n<li>Questions about symptoms before treatment is complete</li>\n<li>Requests to summarize fault before all facts are known</li>\n<li>Assumptions that a quick statement helps close the file efficiently</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The safest approach is to be factual, organized, and careful about answering beyond what you actually know. Early certainty can create later problems.</p>\n"
  },
  {
    "route": "/guides/evidence-checklist-after-an-accident/",
    "title": "Evidence Checklist After an Accident",
    "description": "Useful accident evidence usually includes photographs, witness details, incident reports, medical follow-up, wage-loss documentation, and a clean timeline of what happened next.",
    "main_html": "<h2>Evidence Checklist After an Accident</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The strongest evidence after an accident is usually ordinary documentation gathered early and preserved well: photos, names, dates, treatment records, and a timeline that is easy to follow later.</p>\n<h3>What commonly matters</h3>\n<ul>\n<li>Scene photographs and vehicle or property damage</li>\n<li>Witness names and contact details</li>\n<li>Police, incident, or workplace reports</li>\n<li>Urgent care, ER, or physician records</li>\n<li>Missed work documentation and pay records if applicable</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Evidence is less about drama and more about consistency. The best checklist is the one you can actually maintain without guessing.</p>\n"
  },
  {
    "route": "/guides/when-to-call-a-personal-injury-lawyer/",
    "title": "When to Call a Personal Injury Lawyer",
    "description": "People often consider calling a lawyer when injuries are meaningful, facts are disputed, insurance pressure increases, or they are no longer comfortable handling the communications alone.",
    "main_html": "<h2>When to Call a Personal Injury Lawyer</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>People usually think about calling a lawyer when the case becomes more than simple paperwork: injuries are real, work is affected, fault is disputed, or the insurance process starts moving faster than the facts do.</p>\n<h3>Situations that commonly trigger the question</h3>\n<ul>\n<li>Emergency treatment, ongoing care, or unclear recovery</li>\n<li>Pressure to settle or give detailed statements early</li>\n<li>Commercial defendants, multiple parties, or disputed fault</li>\n<li>Serious injury, death, or long-term work disruption</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The right time to call is often earlier than the right time to sign. Asking informed questions early can clarify options without forcing a commitment.</p>\n"
  },
  {
    "route": "/guides/personal-injury-lawyer-red-flags/",
    "title": "Personal Injury Lawyer Red Flags",
    "description": "Personal injury lawyer red flags usually involve weak explanation, aggressive urgency, unclear fee mechanics, inflated promises, or very little clarity about who will actually run the case.",
    "main_html": "<h2>Personal Injury Lawyer Red Flags</h2>\n<p>Educational only. Not legal advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The most important red flag is not strong advertising by itself. It is weak explanation. If fees, case handling, timing, and evidence priorities are still vague after intake, the decision surface is too blurry.</p>\n<h3>Common red flags</h3>\n<ul>\n<li>Promises about value or speed that no one can responsibly guarantee</li>\n<li>Pressure to sign immediately without reviewing terms</li>\n<li>Little clarity about case manager versus attorney involvement</li>\n<li>Very vague answers about fees, costs, or liens</li>\n<li>Focus on marketing rankings rather than practical process</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Good firms make the process more legible. If the process gets murkier as the sales pressure rises, slow down.</p>\n"
  }
];
const overrides = {
  "overrides": {
    "home:/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Core discovery paths","query":"personal injury lawyers near me","href":"/","label":"Home"},
        {"groupId":"next","groupLabel":"Core discovery paths","query":"what to do after an accident","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"next","groupLabel":"Core discovery paths","query":"evidence checklist after an accident","href":"/guides/evidence-checklist-after-an-accident/","label":"Evidence checklist"},
        {"groupId":"questions","groupLabel":"Core discovery paths","query":"when to call a personal injury lawyer","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"},
        {"groupId":"faq","groupLabel":"Core discovery paths","query":"personal injury lawyer red flags","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"questions","groupLabel":"Core discovery paths","query":"personal injury fees explained","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"}
      ]
    },
    "faq:/faq/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"next","groupLabel":"What to do now","query":"what to do after an accident","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"next","groupLabel":"What to do now","query":"evidence checklist after an accident","href":"/guides/evidence-checklist-after-an-accident/","label":"Evidence checklist"},
        {"groupId":"questions","groupLabel":"Fees and questions","query":"questions to ask a personal injury lawyer","href":"/guides/questions-to-ask-a-personal-injury-lawyer/","label":"Questions to ask"},
        {"groupId":"questions","groupLabel":"Fees and questions","query":"personal injury fees explained","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"},
        {"groupId":"faq","groupLabel":"Fees and questions","query":"personal injury lawyer red flags","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"compare","groupLabel":"Fees and questions","query":"when to call a personal injury lawyer","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"}
      ]
    },
    "guides-hub:/guides/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"next","groupLabel":"What to do now","query":"what to do after an accident","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"next","groupLabel":"What to do now","query":"evidence checklist after an accident","href":"/guides/evidence-checklist-after-an-accident/","label":"Evidence checklist"},
        {"groupId":"questions","groupLabel":"Fees and questions","query":"questions to ask a personal injury lawyer","href":"/guides/questions-to-ask-a-personal-injury-lawyer/","label":"Questions to ask"},
        {"groupId":"questions","groupLabel":"Fees and questions","query":"personal injury fees explained","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"},
        {"groupId":"faq","groupLabel":"Fees and questions","query":"personal injury lawyer red flags","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"compare","groupLabel":"Fees and questions","query":"when to call a personal injury lawyer","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"}
      ]
    },
    "city:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"personal injury lawyers in {market}","href":"{route}","label":"City hub"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"what to do after a car accident in {market}","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"evidence checklist after an accident in {market}","href":"/guides/evidence-checklist-after-an-accident/","label":"Evidence checklist"},
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"when to call a personal injury lawyer in {market}","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"},
        {"groupId":"faq","groupLabel":"FAQ and red flags","query":"personal injury lawyer red flags in {market}","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"questions","groupLabel":"Costs, timing, next steps","query":"questions to ask a personal injury lawyer in {market}","href":"/guides/questions-to-ask-a-personal-injury-lawyer/","label":"Questions to ask"},
        {"groupId":"questions","groupLabel":"Costs, timing, next steps","query":"personal injury fees explained in {state}","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"find a personal injury lawyer in {market}","href":"/request-assistance/","label":"Get matched with a provider"}
      ]
    },
    "state:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"compare","groupLabel":"State-level lookup paths","query":"personal injury lawyers in {state}","href":"{route}","label":"State hub"},
        {"groupId":"next","groupLabel":"State-level lookup paths","query":"what to do after an accident in {state}","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"questions","groupLabel":"State-level lookup paths","query":"personal injury fees explained in {state}","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"},
        {"groupId":"compare","groupLabel":"State-level lookup paths","query":"when to call a personal injury lawyer in {state}","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"},
        {"groupId":"faq","groupLabel":"State-level lookup paths","query":"personal injury lawyer red flags in {state}","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"next","groupLabel":"State-level lookup paths","query":"find a personal injury lawyer in {state}","href":"/request-assistance/","label":"Get matched with a provider"}
      ]
    },
    "guide-detail:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Primary route","query":"{topic}","href":"{route}","label":"This guide"},
        {"groupId":"primary","groupLabel":"Primary route","query":"what to know about {topic}","href":"{route}","label":"This guide"},
        {"groupId":"next","groupLabel":"Related decision paths","query":"what to do after an accident","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"next","groupLabel":"Related decision paths","query":"evidence checklist after an accident","href":"/guides/evidence-checklist-after-an-accident/","label":"Evidence checklist"},
        {"groupId":"questions","groupLabel":"Related decision paths","query":"personal injury fees explained","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"},
        {"groupId":"faq","groupLabel":"Related decision paths","query":"personal injury lawyer red flags","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"compare","groupLabel":"Related decision paths","query":"when to call a personal injury lawyer","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"}
      ]
    },
    "global-detail:/personal-injury/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"compare","groupLabel":"State-level lookup paths","query":"personal injury lawyers by state","href":"/personal-injury/","label":"State hub"},
        {"groupId":"next","groupLabel":"State-level lookup paths","query":"what to do after an accident","href":"/guides/what-to-do-after-an-accident/","label":"After an accident"},
        {"groupId":"questions","groupLabel":"State-level lookup paths","query":"personal injury fees explained","href":"/guides/personal-injury-fees-explained/","label":"Fee guide"},
        {"groupId":"faq","groupLabel":"State-level lookup paths","query":"personal injury lawyer red flags","href":"/guides/personal-injury-lawyer-red-flags/","label":"Lawyer red flags"},
        {"groupId":"compare","groupLabel":"State-level lookup paths","query":"when to call a personal injury lawyer","href":"/guides/when-to-call-a-personal-injury-lawyer/","label":"When to call"}
      ]
    }
  }
};
upsertGuides(profile.relDir, guides, profile);
const normalizedCount = normalizeAllGuides(profile.relDir, profile);
writeOverrides('data/community/query_compiler/pi.json', overrides);
runSyncGuides();
auditVertical(profile);
summarize('pi', guides, normalizedCount);
