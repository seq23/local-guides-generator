#!/usr/bin/env node
const { profileConfig, upsertGuides, normalizeAllGuides, writeOverrides, runSyncGuides, auditVertical, summarize } = require('./lib');
const profile = profileConfig('dentistry');
const guides = [
  {
    "route": "/guides/dental-crowns/",
    "title": "Dental Crowns",
    "description": "Dental crowns cover and protect damaged teeth when the goal is to preserve structure, restore function, and reduce the risk of fracture or repeated failure.",
    "main_html": "<h2>Dental Crowns</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>A dental crown is usually worth considering when a tooth is too damaged for a small filling but still strong enough to keep. The decision is less about buying a \"premium\" upgrade and more about whether the remaining tooth structure can predictably hold up under biting forces over time.</p>\n<h3>What this guide is for</h3>\n<p>This guide explains when crowns are commonly recommended, when they may be premature, what commonly drives cost, and what to clarify before a tooth is permanently reshaped.</p>\n<h3>When crowns are commonly recommended</h3>\n<ul>\n<li>Large cracks, fractures, or repeated filling failures</li>\n<li>Teeth that have had root canal treatment and need structural protection</li>\n<li>Teeth with major wear that changes bite function</li>\n<li>Situations where preserving a natural tooth is still realistic</li>\n</ul>\n<h3>When a crown may not be the right first move</h3>\n<p>A crown may be premature when decay extends too far below the gumline, when the tooth is splitting, when gum and bone support are weak, or when a more conservative restoration could still work. The real question is not whether a crown can be made; it is whether the tooth is a good long-term foundation.</p>\n<h3>What usually affects cost</h3>\n<ul>\n<li>Whether build-up, core reinforcement, or a temporary crown is needed</li>\n<li>Whether the tooth already had a root canal</li>\n<li>Material choice and lab complexity</li>\n<li>Whether gum treatment or bite adjustment is needed first</li>\n</ul>\n<h3>Questions worth asking before you commit</h3>\n<ul>\n<li>How much healthy tooth is actually left?</li>\n<li>What happens if we do nothing for three to six months?</li>\n<li>What is the alternative if the crown fails?</li>\n<li>What part of the quoted cost is lab work versus office work?</li>\n</ul>\n<h3>Decision checkpoint</h3>\n<p>Crowns are strongest when they are used to preserve a still-restorable tooth, not to delay an extraction that is already becoming unavoidable. If the explanation focuses only on aesthetics and not on remaining tooth structure, ask more questions before moving forward.</p>\n"
  },
  {
    "route": "/guides/root-canal-treatment/",
    "title": "Root Canal Treatment",
    "description": "Root canal treatment is usually about keeping a painful or infected tooth that would otherwise continue to deteriorate or need extraction.",
    "main_html": "<h2>Root Canal Treatment</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>A root canal is not a cosmetic procedure and it is not the same decision as a filling. It is generally considered when infection or irreversible inflammation reaches the nerve of the tooth and the realistic choices narrow to saving the tooth or removing it.</p>\n<h3>What people are usually deciding</h3>\n<p>Most people are comparing three paths: root canal plus restoration, extraction and replacement, or delayed treatment. The least painful decision on day one is not always the least expensive or least disruptive decision six months later.</p>\n<h3>Signs the conversation is usually about a root canal</h3>\n<ul>\n<li>Lingering pain with hot or cold</li>\n<li>Spontaneous tooth pain or pressure</li>\n<li>Swelling, infection, or a draining area on the gums</li>\n<li>A very deep cavity or fracture near the pulp</li>\n</ul>\n<h3>What a root canal does and does not do</h3>\n<p>It removes infected or inflamed tissue inside the tooth, disinfects the canal space, and seals it. It does not make the tooth invincible. After treatment, many teeth still need a crown or another full-coverage restoration because the tooth is often more brittle than it was before.</p>\n<h3>Questions that prevent regret</h3>\n<ul>\n<li>Is the tooth actually restorable after the root canal?</li>\n<li>Will I probably need a crown right after treatment?</li>\n<li>What are the odds that extraction is still the better long-term move?</li>\n<li>What happens if I wait?</li>\n</ul>\n<h3>Cost and timeline reality</h3>\n<p>The true cost is usually the root canal plus the final restoration, not the procedure alone. Delay can also change the cost if infection spreads or the tooth fractures further.</p>\n<h3>Bottom line</h3>\n<p>A root canal tends to make sense when there is still a realistic tooth worth saving and the final restoration plan is clear. If the discussion skips over the long-term restoration plan, the explanation is incomplete.</p>\n"
  },
  {
    "route": "/guides/dental-bridge-vs-implant/",
    "title": "Dental Bridge vs Implant",
    "description": "Bridges and implants solve tooth replacement differently, and the better choice depends on neighboring teeth, bone support, timeline, and tolerance for surgery.",
    "main_html": "<h2>Dental Bridge vs Implant</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>A bridge is usually faster and avoids surgery, while an implant is usually more independent and durable when conditions are right. The right answer depends on whether neighboring teeth are healthy, how much permanence you want, and whether you are willing to accept healing time.</p>\n<h3>How the two options differ</h3>\n<ul>\n<li><strong>Bridge:</strong> uses adjacent teeth as anchors and can replace a missing tooth without waiting for bone integration.</li>\n<li><strong>Implant:</strong> places support into the jawbone and does not rely on neighboring teeth in the same way.</li>\n</ul>\n<h3>When a bridge may make more sense</h3>\n<ul>\n<li>Neighboring teeth already need crowns</li>\n<li>Surgery is not a good fit</li>\n<li>Speed matters more than maximum independence</li>\n<li>Bone support is limited and grafting would be a major factor</li>\n</ul>\n<h3>When an implant may make more sense</h3>\n<ul>\n<li>Neighboring teeth are healthy and should be preserved</li>\n<li>Long-term durability and bite stability matter most</li>\n<li>Jawbone and healing capacity are adequate</li>\n<li>You are comfortable with surgery and a longer timeline</li>\n</ul>\n<h3>Cost questions that matter</h3>\n<p>People often compare sticker prices without comparing the total treatment path. The better comparison includes preparation, temporaries, possible grafting, and what maintenance or replacement risk looks like later.</p>\n<h3>Questions worth asking</h3>\n<ul>\n<li>Would a bridge require altering healthy teeth?</li>\n<li>What failures are most common with each option in my case?</li>\n<li>What is the realistic total timeline from start to finish?</li>\n<li>How would each option affect future treatment choices?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Neither option is universally better. The best choice is the one that fits your anatomy, your tolerance for surgery and waiting, and the long-term value of preserving nearby teeth.</p>\n"
  },
  {
    "route": "/guides/dental-red-flags/",
    "title": "Dental Treatment Red Flags",
    "description": "Dental treatment red flags usually involve weak diagnosis, pressure-heavy sales framing, unclear alternatives, or a plan that is rushed before the case is fully explained.",
    "main_html": "<h2>Dental Treatment Red Flags</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>The biggest red flag is not high price by itself. It is lack of explanation. If diagnosis, alternatives, timing, and tradeoffs are unclear, you do not have enough information to make a safe decision.</p>\n<h3>Red flags before treatment starts</h3>\n<ul>\n<li>No clear diagnosis tied to exam findings or imaging</li>\n<li>Pressure to commit the same day without time to review options</li>\n<li>Little distinction between urgent treatment and elective upgrades</li>\n<li>No explanation of what happens if you wait</li>\n<li>No written plan with phases and estimated ranges</li>\n</ul>\n<h3>Red flags during treatment planning</h3>\n<ul>\n<li>Everything is framed as an emergency</li>\n<li>Cheaper or more conservative alternatives are dismissed without explanation</li>\n<li>Expected maintenance, follow-up, or replacement cycles are ignored</li>\n<li>The plan changes materially after financing is discussed</li>\n</ul>\n<h3>Red flags around sedation, surgery, or larger cases</h3>\n<p>More invasive cases deserve more—not less—clarity. Ask who is doing each part of the case, what happens if a stage changes, and how aftercare complications are handled after hours.</p>\n<h3>What a solid explanation usually includes</h3>\n<ul>\n<li>Diagnosis in plain language</li>\n<li>What is urgent versus what is elective</li>\n<li>Alternatives and tradeoffs</li>\n<li>Likely timeline and recovery expectations</li>\n<li>What the quoted number covers and what it does not</li>\n</ul>\n<h3>Decision checkpoint</h3>\n<p>If the office can explain the treatment path clearly, welcomes reasonable questions, and distinguishes necessary treatment from optional upgrades, the process usually feels calmer. If confusion increases after the consultation, slow down before you sign anything.</p>\n"
  },
  {
    "route": "/guides/dental-second-opinion/",
    "title": "When to Get a Dental Second Opinion",
    "description": "A second opinion is most useful when a case is expensive, irreversible, surgical, or hard to understand—not because you are being difficult.",
    "main_html": "<h2>When to Get a Dental Second Opinion</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>A second opinion is reasonable when treatment is expensive, irreversible, multi-stage, or explained in a way that leaves you confused. The goal is not to shop for the answer you want; it is to test whether the diagnosis and options are being described consistently.</p>\n<h3>When second opinions are especially useful</h3>\n<ul>\n<li>Full-arch implant or major cosmetic cases</li>\n<li>Large treatment plans with multiple crowns or extractions</li>\n<li>Situations where root canal, extraction, and implant are all being discussed</li>\n<li>Cases where urgency is emphasized but the reason is vague</li>\n</ul>\n<h3>What to bring</h3>\n<ul>\n<li>Your current treatment plan and estimate</li>\n<li>Recent x-rays or scans if available</li>\n<li>A short summary of symptoms and past treatment</li>\n<li>Your top concerns: cost, speed, durability, appearance, or avoiding surgery</li>\n</ul>\n<h3>What to compare</h3>\n<p>Compare diagnosis, urgency, alternatives, sequencing, and likely maintenance—not just the top-line number. Different prices can still reflect similar treatment logic, and similar prices can hide very different scopes of work.</p>\n<h3>Questions to ask in the second opinion</h3>\n<ul>\n<li>What part of the original plan seems necessary right now?</li>\n<li>What could safely wait?</li>\n<li>What is the most conservative workable option?</li>\n<li>What tradeoff would matter most in my case?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Good second opinions reduce confusion and sharpen your decision. If two evaluations disagree sharply, ask what assumptions are different—not just which office is cheaper.</p>\n"
  },
  {
    "route": "/guides/gum-disease-treatment/",
    "title": "Gum Disease Treatment Basics",
    "description": "Gum disease treatment is usually about stopping active inflammation and bone loss before cosmetic or restorative work is expected to last.",
    "main_html": "<h2>Gum Disease Treatment Basics</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>When gums and bone support are unstable, almost every other dental decision becomes less predictable. Gum treatment is often not the exciting part of care, but it is frequently the foundation that determines whether other work can succeed long term.</p>\n<h3>What people are usually dealing with</h3>\n<p>Bleeding gums, deep cleanings, pocket measurements, bone loss, bad breath, loose teeth, and confusion about whether this is a hygiene issue or a structural problem. The answer is usually both: home care matters, but active periodontal disease can also require professional treatment and monitoring.</p>\n<h3>What treatment may include</h3>\n<ul>\n<li>Deep cleaning or scaling and root planing</li>\n<li>More frequent hygiene maintenance</li>\n<li>Monitoring pocket depths and bleeding</li>\n<li>Periodontal referral for advanced or surgical cases</li>\n</ul>\n<h3>Why it changes other treatment decisions</h3>\n<p>If gums are inflamed or bone support is unstable, cosmetic work, crowns, bridges, or implants may need to wait. Long-term success is harder to judge when the foundation is still changing.</p>\n<h3>Questions worth asking</h3>\n<ul>\n<li>Is this gingivitis or periodontitis?</li>\n<li>What would improvement look like in measurable terms?</li>\n<li>How often should I be rechecked?</li>\n<li>Does other planned treatment depend on getting this stable first?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>Gum treatment is often the quiet prerequisite for durable dental work. If a treatment plan ignores active gum disease while recommending major restorative work, ask why.</p>\n"
  },
  {
    "route": "/guides/emergency-dentist-vs-waiting/",
    "title": "Emergency Dentist vs Waiting",
    "description": "Dental problems that look similar on day one can have very different urgency depending on swelling, trauma, infection, and whether the tooth can still be protected.",
    "main_html": "<h2>Emergency Dentist vs Waiting</h2>\n<p>Educational only. Not medical advice. No endorsements or rankings.</p>\n<h3>If you only read one thing</h3>\n<p>Not every painful dental issue requires immediate same-day treatment, but swelling, infection, trauma, uncontrolled bleeding, or rapidly worsening symptoms change the risk. The decision is usually about what can safely wait without making the tooth—or the person—less safe.</p>\n<h3>Problems that often justify urgent evaluation</h3>\n<ul>\n<li>Facial swelling or signs of spreading infection</li>\n<li>Trauma, broken teeth, or a tooth that was knocked loose</li>\n<li>Severe pain that is escalating or interrupting sleep</li>\n<li>Bleeding that does not settle</li>\n<li>Sudden bite changes after injury</li>\n</ul>\n<h3>Problems that may be urgent but not necessarily emergency-level</h3>\n<p>A lost filling, a chipped tooth without significant pain, or mild cold sensitivity may still need care soon, but the right timing depends on symptoms, function, and whether the tooth is likely to fracture further.</p>\n<h3>Questions to ask when calling an office</h3>\n<ul>\n<li>What symptoms would make this a same-day issue?</li>\n<li>What should I do before I come in?</li>\n<li>What is the likely goal of the first visit: diagnosis, pain control, or definitive treatment?</li>\n<li>What costs are typically due at the urgent visit?</li>\n</ul>\n<h3>Bottom line</h3>\n<p>The safest approach is to judge urgency by swelling, infection, trauma, and risk of further damage—not by pain alone. A good emergency intake process should help you understand that difference clearly.</p>\n"
  }
];
const overrides = {
  "overrides": {
    "home:/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Core discovery paths","query":"dentist near me","href":"/","label":"Home"},
        {"groupId":"compare","groupLabel":"Core discovery paths","query":"how to choose a dentist","href":"/guides/how-to-choose/","label":"How to choose"},
        {"groupId":"costs","groupLabel":"Core discovery paths","query":"dental crown cost and longevity","href":"/guides/dental-crowns/","label":"Dental crowns"},
        {"groupId":"faq","groupLabel":"Core discovery paths","query":"dental treatment red flags","href":"/guides/dental-red-flags/","label":"Dental red flags"},
        {"groupId":"next","groupLabel":"Core discovery paths","query":"find a dentist","href":"/request-assistance/","label":"Request assistance"}
      ]
    },
    "faq:/faq/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"costs","groupLabel":"FAQ and decision paths","query":"dental crown cost and timeline","href":"/guides/dental-crowns/","label":"Dental crowns"},
        {"groupId":"compare","groupLabel":"FAQ and decision paths","query":"root canal vs extraction questions","href":"/guides/root-canal-treatment/","label":"Root canal guide"},
        {"groupId":"questions","groupLabel":"FAQ and decision paths","query":"questions to ask before major dental work","href":"/guides/questions-to-ask/","label":"Questions to ask"},
        {"groupId":"faq","groupLabel":"FAQ and decision paths","query":"dental treatment red flags","href":"/guides/dental-red-flags/","label":"Dental red flags"},
        {"groupId":"next","groupLabel":"FAQ and decision paths","query":"when to get a dental second opinion","href":"/guides/dental-second-opinion/","label":"Second opinion guide"}
      ]
    },
    "guides-hub:/guides/": {
      "replaceDefault": true,
      "items": [
        {"groupId":"costs","groupLabel":"Costs and value","query":"dental crown cost and longevity","href":"/guides/dental-crowns/","label":"Dental crowns"},
        {"groupId":"costs","groupLabel":"Costs and value","query":"root canal cost vs extraction cost","href":"/guides/root-canal-treatment/","label":"Root canal guide"},
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"implant vs bridge for one missing tooth","href":"/guides/dental-bridge-vs-implant/","label":"Bridge vs implant"},
        {"groupId":"questions","groupLabel":"Questions and planning","query":"questions to ask before major dental work","href":"/guides/questions-to-ask/","label":"Questions to ask"},
        {"groupId":"faq","groupLabel":"Questions and planning","query":"dental treatment red flags","href":"/guides/dental-red-flags/","label":"Dental red flags"},
        {"groupId":"next","groupLabel":"Questions and planning","query":"when to get a dental second opinion","href":"/guides/dental-second-opinion/","label":"Second opinion guide"}
      ]
    },
    "city:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"best dentists in {market}","href":"{route}","label":"City hub"},
        {"groupId":"compare","groupLabel":"Compare and shortlist","query":"how to choose a dentist in {market}","href":"/guides/how-to-choose/","label":"How to choose"},
        {"groupId":"costs","groupLabel":"Costs, timing, next steps","query":"dental crown cost in {market}","href":"/guides/dental-crowns/","label":"Dental crowns"},
        {"groupId":"costs","groupLabel":"Costs, timing, next steps","query":"root canal vs extraction cost in {market}","href":"/guides/root-canal-treatment/","label":"Root canal guide"},
        {"groupId":"faq","groupLabel":"FAQ and red flags","query":"dental treatment red flags in {market}","href":"/guides/dental-red-flags/","label":"Dental red flags"},
        {"groupId":"questions","groupLabel":"FAQ and red flags","query":"questions to ask a dentist in {market}","href":"/guides/questions-to-ask/","label":"Questions to ask"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"when to get a dental second opinion in {market}","href":"/guides/dental-second-opinion/","label":"Second opinion guide"},
        {"groupId":"next","groupLabel":"Costs, timing, next steps","query":"find a dentist in {market}","href":"/request-assistance/","label":"Request assistance"}
      ]
    },
    "guide-detail:*": {
      "replaceDefault": true,
      "items": [
        {"groupId":"primary","groupLabel":"Primary route","query":"{topic}","href":"{route}","label":"This guide"},
        {"groupId":"primary","groupLabel":"Primary route","query":"what to know about {topic}","href":"{route}","label":"This guide"},
        {"groupId":"compare","groupLabel":"Related decision paths","query":"questions to ask before major dental work","href":"/guides/questions-to-ask/","label":"Questions to ask"},
        {"groupId":"compare","groupLabel":"Related decision paths","query":"dental treatment red flags","href":"/guides/dental-red-flags/","label":"Dental red flags"},
        {"groupId":"costs","groupLabel":"Related decision paths","query":"how dental treatment costs are usually structured","href":"/guides/cost-financing/","label":"Cost financing"},
        {"groupId":"next","groupLabel":"Related decision paths","query":"when to get a dental second opinion","href":"/guides/dental-second-opinion/","label":"Second opinion guide"}
      ]
    }
  }
};
upsertGuides(profile.relDir, guides, profile);
const normalizedCount = normalizeAllGuides(profile.relDir, profile);
writeOverrides('data/community/query_compiler/dentistry.json', overrides);
runSyncGuides();
auditVertical(profile);
summarize('dentistry', guides, normalizedCount);
