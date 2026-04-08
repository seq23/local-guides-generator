#!/usr/bin/env node
const { profileConfig, upsertGuides, normalizeAllGuides, writeOverrides, runSyncGuides, auditVertical, summarize } = require('./lib');
const profile = profileConfig('trt');
const guides = [
  {
    "route": "/guides/who-is-a-good-candidate-for-trt/",
    "title": "Who Is a Good Candidate for TRT?",
    "description": "Good TRT candidacy depends on symptoms, repeat lab context, risk factors, fertility goals, and whether simpler drivers of fatigue or low libido have been ruled out first.",
    "main_html": "<h2>Who Is a Good Candidate for TRT?</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Good TRT candidacy is about fit, not hype. Symptoms, repeat labs, sleep, weight, alcohol use, fertility goals, and medical risk all matter before a clinician can judge whether TRT is even the right lane.</p>\n<h3>What usually gets reviewed first</h3>\n<ul>\n<li>Symptoms over time, not just a single bad week</li>\n<li>Repeat morning lab work rather than one isolated number</li>\n<li>Sleep quality, body weight, stress, alcohol, and medications</li>\n<li>Fertility goals and whether preserving sperm production matters</li>\n</ul>\n<h3>When caution is usually warranted</h3>\n<ul>\n<li>Untreated sleep apnea or heavy alcohol use</li>\n<li>Plans for pregnancy in the near term</li>\n<li>Unclear baseline labs or symptoms that point elsewhere</li>\n<li>Programs that want to start treatment before the workup is complete</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The best TRT conversations start with whether TRT is appropriate at all. If a clinic jumps straight to product choice without doing that workup, the process is too shallow.</p>\n"
  },
  {
    "route": "/guides/trt-red-flags/",
    "title": "TRT Clinic Red Flags",
    "description": "TRT red flags usually show up as weak workup, weak monitoring, vague fertility counseling, or a sales process that treats a hormone protocol like a subscription product.",
    "main_html": "<h2>TRT Clinic Red Flags</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The clearest TRT red flag is treatment without a clean workup and monitoring plan. A serious protocol explains what is being tracked, how often, and what could cause dose changes or treatment pauses.</p>\n<h3>Common red flags</h3>\n<ul>\n<li>Starting without baseline labs or repeat confirmation</li>\n<li>No discussion of fertility, sleep apnea, blood pressure, or hematocrit</li>\n<li>One-size-fits-all dosing language</li>\n<li>Programs that emphasize upsells more than monitoring</li>\n<li>Vague answers about what happens in the first 90 days</li>\n</ul>\n<h3>Questions worth asking</h3>\n<ul>\n<li>What labs are required before starting?</li>\n<li>How often are follow-up labs repeated?</li>\n<li>How do you handle elevated hematocrit, acne, or mood changes?</li>\n<li>What do you do if fertility is a priority?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Strong TRT programs feel structured and clinically specific. If the process sounds like enrollment first and judgment later, slow down.</p>\n"
  },
  {
    "route": "/guides/trt-first-90-days/",
    "title": "What the First 90 Days on TRT Usually Look Like",
    "description": "The first 90 days on TRT should be about symptom tracking, follow-up labs, dose discipline, and watching for side effects—not chasing dramatic week-one changes.",
    "main_html": "<h2>What the First 90 Days on TRT Usually Look Like</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The first 90 days on TRT are usually about calibration, not hype. Good protocols emphasize consistent dosing, repeat labs, blood pressure and symptom awareness, and realistic expectations about what changes early versus later.</p>\n<h3>Common early decision points</h3>\n<ul>\n<li>Whether baseline symptoms actually track with lab changes</li>\n<li>Whether sleep, stress, alcohol, or weight are still driving the picture</li>\n<li>Whether side effects show up before benefits stabilize</li>\n</ul>\n<h3>What to document</h3>\n<ul>\n<li>Energy, libido, mood, sleep, and training recovery</li>\n<li>Blood pressure trends if you are monitoring them</li>\n<li>Timing of doses relative to labs and symptoms</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The first 90 days should produce better information, not just stronger expectations. Programs that promise instant certainty are overselling the process.</p>\n"
  },
  {
    "route": "/guides/trt-telehealth-vs-local-clinic/",
    "title": "TRT Telehealth vs Local Clinic",
    "description": "Telehealth and local TRT care each have tradeoffs around labs, access, in-person support, and how quickly concerns can be evaluated when something feels off.",
    "main_html": "<h2>TRT Telehealth vs Local Clinic</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Telehealth can be efficient, but local care can be easier when you need in-person exams, urgent evaluation, or integrated follow-up. The real comparison is not convenience alone; it is how monitoring, communication, and escalation are handled.</p>\n<h3>When telehealth may work well</h3>\n<ul>\n<li>You already know how to manage labs and follow-up logistics</li>\n<li>Your protocol is stable and communication is responsive</li>\n<li>Local access is poor</li>\n</ul>\n<h3>When local care may matter more</h3>\n<ul>\n<li>You need closer in-person oversight</li>\n<li>You have multiple risk factors or a more complex history</li>\n<li>You prefer one place for visits, labs, and escalation</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The best route is the one that gives you clean monitoring and a realistic escalation path, not just the easiest signup flow.</p>\n"
  },
  {
    "route": "/guides/iv-hydration-red-flags/",
    "title": "IV Hydration Red Flags",
    "description": "IV hydration red flags usually involve weak screening, vague ingredient explanations, aggressive promises, or using IV services to oversell solutions to fatigue or illness.",
    "main_html": "<h2>IV Hydration Red Flags</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>IV hydration should not be sold as a cure-all. The strongest red flags are weak screening, exaggerated promises, and very little explanation of who should avoid treatment or ask for medical review first.</p>\n<h3>Common red flags</h3>\n<ul>\n<li>No meaningful intake questions about medical history or medications</li>\n<li>Promises about immunity, detox, or dramatic recovery without context</li>\n<li>Very little explanation of what is in the bag and why</li>\n<li>No clear route for escalation if symptoms suggest something more serious</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Good IV programs explain limits and screen for fit. If everything is framed as harmless and universally beneficial, the risk conversation is missing.</p>\n"
  },
  {
    "route": "/guides/medical-weight-loss-pricing/",
    "title": "Medical Weight Loss Pricing and Program Structure",
    "description": "Medical weight loss pricing depends on what is actually included: evaluation, medication management, follow-up frequency, labs, body-composition review, and coaching depth.",
    "main_html": "<h2>Medical Weight Loss Pricing and Program Structure</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The smartest pricing question is not \"what is the monthly fee?\" It is \"what exactly is included in the monthly fee, what is billed separately, and how does the plan change if medication or labs change?\"</p>\n<h3>What commonly affects cost</h3>\n<ul>\n<li>Initial evaluation and follow-up cadence</li>\n<li>Whether medication is included, reimbursed, or separate</li>\n<li>Whether labs and body-composition review are bundled</li>\n<li>Access to clinician messaging or coaching between visits</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Pricing is more useful when it is tied to structure. If the office can quote a monthly number but not describe the decision process behind the program, the explanation is too thin.</p>\n"
  }
];
const overrides = {
  "overrides": {
    "home:/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Core discovery paths","query":"trt clinics near me","href":"/","label":"Home"},
        {"groupId":"questions","groupLabel":"Core discovery paths","query":"am i a good candidate for trt","href":"/guides/who-is-a-good-candidate-for-trt/","label":"TRT candidacy"},
        {"groupId":"costs","groupLabel":"Core discovery paths","query":"trt pricing and lab work","href":"/guides/trt-pricing-and-labs/","label":"TRT pricing"},
        {"groupId":"faq","groupLabel":"Core discovery paths","query":"trt clinic red flags","href":"/guides/trt-red-flags/","label":"TRT red flags"},
        {"groupId":"next","groupLabel":"Core discovery paths","query":"telehealth vs local trt clinic","href":"/guides/trt-telehealth-vs-local-clinic/","label":"Telehealth vs local"}
      ]
    },
    "faq:/faq/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"questions","groupLabel":"Eligibility and fit","query":"am i a good candidate for trt","href":"/guides/who-is-a-good-candidate-for-trt/","label":"TRT candidacy"},
        {"groupId":"costs","groupLabel":"Eligibility and fit","query":"trt pricing and lab work","href":"/guides/trt-pricing-and-labs/","label":"TRT pricing"},
        {"groupId":"faq","groupLabel":"Eligibility and fit","query":"trt clinic red flags","href":"/guides/trt-red-flags/","label":"TRT red flags"},
        {"groupId":"faq","groupLabel":"Eligibility and fit","query":"trt side effects and monitoring","href":"/guides/trt-side-effects-and-safety/","label":"Side effects and safety"},
        {"groupId":"compare","groupLabel":"Eligibility and fit","query":"telehealth vs local trt clinic","href":"/guides/trt-telehealth-vs-local-clinic/","label":"Telehealth vs local"},
        {"groupId":"next","groupLabel":"Eligibility and fit","query":"medical weight loss monthly cost and labs","href":"/guides/medical-weight-loss-pricing/","label":"Weight loss pricing"}
      ]
    },
    "guides-hub:/guides/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"questions","groupLabel":"Eligibility and fit","query":"am i a good candidate for trt","href":"/guides/who-is-a-good-candidate-for-trt/","label":"TRT candidacy"},
        {"groupId":"costs","groupLabel":"Costs and monitoring","query":"trt pricing and lab work","href":"/guides/trt-pricing-and-labs/","label":"TRT pricing"},
        {"groupId":"faq","groupLabel":"Red flags and safety","query":"trt clinic red flags","href":"/guides/trt-red-flags/","label":"TRT red flags"},
        {"groupId":"faq","groupLabel":"Red flags and safety","query":"trt side effects and monitoring","href":"/guides/trt-side-effects-and-safety/","label":"Side effects and safety"},
        {"groupId":"compare","groupLabel":"Red flags and safety","query":"telehealth vs local trt clinic","href":"/guides/trt-telehealth-vs-local-clinic/","label":"Telehealth vs local"},
        {"groupId":"costs","groupLabel":"Costs and monitoring","query":"medical weight loss monthly cost and labs","href":"/guides/medical-weight-loss-pricing/","label":"Weight loss pricing"},
        {"groupId":"faq","groupLabel":"Red flags and safety","query":"peptide clinic red flags","href":"/guides/peptide-clinic-red-flags/","label":"Peptide red flags"}
      ]
    },
    "city:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"trt clinics in {market}","href":"{route}","label":"City hub"},
        {"groupId":"questions","groupLabel":"Costs, timing, next steps","query":"trt candidacy in {market}","href":"/guides/who-is-a-good-candidate-for-trt/","label":"TRT candidacy"},
        {"groupId":"costs","groupLabel":"Costs, timing, next steps","query":"trt pricing and labs in {market}","href":"/guides/trt-pricing-and-labs/","label":"TRT pricing"},
        {"groupId":"faq","groupLabel":"FAQ and red flags","query":"trt clinic red flags in {market}","href":"/guides/trt-red-flags/","label":"TRT red flags"},
        {"groupId":"faq","groupLabel":"FAQ and red flags","query":"trt side effects and monitoring in {market}","href":"/guides/trt-side-effects-and-safety/","label":"Side effects and safety"},
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"telehealth vs local trt clinic in {market}","href":"/guides/trt-telehealth-vs-local-clinic/","label":"Telehealth vs local"},
        {"groupId":"costs","groupLabel":"Costs, timing, next steps","query":"weight loss program cost in {market}","href":"/guides/medical-weight-loss-pricing/","label":"Weight loss pricing"},
        {"groupId":"faq","groupLabel":"FAQ and red flags","query":"peptide clinic red flags in {market}","href":"/guides/peptide-clinic-red-flags/","label":"Peptide red flags"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"find a trt clinic in {market}","href":"/request-assistance/","label":"Get matched with a provider"}
      ]
    },
    "guide-detail:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Primary route","query":"{topic}","href":"{route}","label":"This guide"},
        {"groupId":"primary","groupLabel":"Primary route","query":"what to know about {topic}","href":"{route}","label":"This guide"},
        {"groupId":"questions","groupLabel":"Related decision paths","query":"am i a good candidate for trt","href":"/guides/who-is-a-good-candidate-for-trt/","label":"TRT candidacy"},
        {"groupId":"costs","groupLabel":"Related decision paths","query":"trt pricing and lab work","href":"/guides/trt-pricing-and-labs/","label":"TRT pricing"},
        {"groupId":"faq","groupLabel":"Related decision paths","query":"trt clinic red flags","href":"/guides/trt-red-flags/","label":"TRT red flags"},
        {"groupId":"faq","groupLabel":"Related decision paths","query":"trt side effects and monitoring","href":"/guides/trt-side-effects-and-safety/","label":"Side effects and safety"},
        {"groupId":"compare","groupLabel":"Related decision paths","query":"telehealth vs local trt clinic","href":"/guides/trt-telehealth-vs-local-clinic/","label":"Telehealth vs local"}
      ]
    }
  }
};
upsertGuides(profile.relDir, guides, profile);
const normalizedCount = normalizeAllGuides(profile.relDir, profile);
writeOverrides('data/community/query_compiler/trt.json', overrides);
runSyncGuides();
auditVertical(profile);
summarize('trt', guides, normalizedCount);
