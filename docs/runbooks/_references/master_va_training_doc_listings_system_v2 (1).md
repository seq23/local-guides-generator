# 

[Master VA Training Doc — Listings System (Repo \+ Execution)](#master-va-training-doc-—-listings-system-\(repo-+-execution\))

[0\) The Big Picture (What This Business Is)](#0\)-the-big-picture-\(what-this-business-is\))

[1\) Your Job (What You Will Do)](#1\)-your-job-\(what-you-will-do\))

[2\) The Canonical Documents (Read These First)](#2\)-the-canonical-documents-\(read-these-first\))

[3\) Repo Orientation (What’s Where)](#3\)-repo-orientation-\(what’s-where\))

[3.1 Key folders](#3.1-key-folders)

[4\) Naming Rules (You Must Follow Exactly)](#4\)-naming-rules-\(you-must-follow-exactly\))

[City slug format](#city-slug-format)

[Sub-industry provider list filenames](#sub-industry-provider-list-filenames)

[5\) Content Rules (The “Never Do” List)](#5\)-content-rules-\(the-“never-do”-list\))

[6\) Validation Discipline (How We Avoid Shipping Mistakes)](#6\)-validation-discipline-\(how-we-avoid-shipping-mistakes\))

[The only acceptable definition of “done”](#the-only-acceptable-definition-of-“done”)

[Commands you will use](#commands-you-will-use)

[7\) Standard Workflow (Every Time)](#7\)-standard-workflow-\(every-time\))

[8\) SOP: Adding a New City (Use This When Asked)](#8\)-sop:-adding-a-new-city-\(use-this-when-asked\))

[9\) SOP: Launching a New Vertical (Use This When Asked)](#9\)-sop:-launching-a-new-vertical-\(use-this-when-asked\))

[10\) Provider Lists: How to Build Them Correctly](#10\)-provider-lists:-how-to-build-them-correctly)

[What a provider list is](#what-a-provider-list-is)

[Minimum required fields](#minimum-required-fields)

[Allowed sources](#allowed-sources)

[Disallowed sources as “official”](#disallowed-sources-as-“official”)

[Safety rules](#safety-rules)

[11\) Sponsor-Live vs Education-Only (What You Need to Know)](#11\)-sponsor-live-vs-education-only-\(what-you-need-to-know\))

[12\) AI Visibility Monitoring (What We Check Monthly)](#12\)-ai-visibility-monitoring-\(what-we-check-monthly\))

[13\) How to Escalate (Exactly What to Send)](#13\)-how-to-escalate-\(exactly-what-to-send\))

[14\) Quick Glossary](#14\)-quick-glossary)

[15\) VA Permission Matrix (What You MAY and MAY NOT Touch)](#15\)-va-permission-matrix-\(what-you-may-and-may-not-touch\))

[✅ You MAY edit](#✅-you-may-edit)

[❌ You MAY NOT edit (without written approval)](#❌-you-may-not-edit-\(without-written-approval\))

[16\) Copy‑Paste Templates (Use These Exactly)](#16\)-copy‑paste-templates-\(use-these-exactly\))

[A) City Registration Entry (data/cities.json)](#a\)-city-registration-entry-\(data/cities.json\))

[B) City Listing File (data/listings/memphis-tn.json)](#b\)-city-listing-file-\(data/listings/memphis-tn.json\))

[C) Example Provider Entry](#c\)-example-provider-entry)

[17\) Personal Injury (PI) Special Rules — READ CAREFULLY](#17\)-personal-injury-\(pi\)-special-rules-—-read-carefully)

[What this means for VAs](#what-this-means-for-vas)

[18\) Escalation Template (Copy This)](#18\)-escalation-template-\(copy-this\))

[19\) Visual Callouts — “What Success Looks Like”](#19\)-visual-callouts-—-“what-success-looks-like”)

[✅ Successful Validation Run](#✅-successful-validation-run)

[✅ Correct City Output in dist/](#✅-correct-city-output-in-dist/)

[✅ Correct City Page Section Order (Top → Bottom)](#✅-correct-city-page-section-order-\(top-→-bottom\))

[✅ Correct Example Provider List](#✅-correct-example-provider-list)

[20\) VA Certification Checklist (MUST PASS BEFORE PROD ACCESS)](#20\)-va-certification-checklist-\(must-pass-before-prod-access\))

[A) Repo & System Literacy (Required)](#a\)-repo-&-system-literacy-\(required\))

[B) Compliance & Content Rules (Required)](#b\)-compliance-&-content-rules-\(required\))

[C) File Naming & Structural Accuracy (Required)](#c\)-file-naming-&-structural-accuracy-\(required\))

[D) Provider List Competency (Required)](#d\)-provider-list-competency-\(required\))

[E) Personal Injury (PI) Special Rules (Mandatory)](#e\)-personal-injury-\(pi\)-special-rules-\(mandatory\))

[F) Validation Discipline (Non-Negotiable)](#f\)-validation-discipline-\(non-negotiable\))

[G) dist/ Spot-Check Skills (Required)](#g\)-dist/-spot-check-skills-\(required\))

[H) Permission Matrix Understanding (Required)](#h\)-permission-matrix-understanding-\(required\))

[I) Escalation Competency (Required)](#i\)-escalation-competency-\(required\))

[J) Supervised Dry Run (Final Gate)](#j\)-supervised-dry-run-\(final-gate\))

[✅ Certification Result](#✅-certification-result)

[LISTINGS GUIDES SYSTEM](#listings-guides-system)

[MASTER SOP — CREATION → QA → AUTO-DISCOVERY → VALIDATION → SCALE (OWNER \+ VA EXECUTABLE)](#master-sop-—-creation-→-qa-→-auto-discovery-→-validation-→-scale-\(owner-+-va-executable\))

[OVERVIEW — HOW THE GUIDES SYSTEM WORKS NOW (READ FIRST)](#overview-—-how-the-guides-system-works-now-\(read-first\))

[Canonical Flow (End-to-End)](#canonical-flow-\(end-to-end\))

[PART I — GUIDE CREATION (LLM \+ CHAT WORKFLOW)](#part-i-—-guide-creation-\(llm-+-chat-workflow\))

[I.1 — Canonical Rule (NON-NEGOTIABLE)](#i.1-—-canonical-rule-\(non-negotiable\))

[I.2 — The LLM Is the JSON Factory (EXPLICIT)](#i.2-—-the-llm-is-the-json-factory-\(explicit\))

[I.3 — Required Sections (CONTENT CONTRACT) (WORD-FOR-WORD REQUIREMENT)](#i.3-—-required-sections-\(content-contract\)-\(word-for-word-requirement\))

[I.4 — Tone Rules (NON-NEGOTIABLE) (WORD-FOR-WORD REQUIREMENT)](#i.4-—-tone-rules-\(non-negotiable\)-\(word-for-word-requirement\))

[PART II — THE 7-LAYER QA SYSTEM (MUST PASS ALL 7\)](#part-ii-—-the-7-layer-qa-system-\(must-pass-all-7\))

[QA LAYER 1 — Structural Completeness](#qa-layer-1-—-structural-completeness)

[QA LAYER 2 — Neutrality & Compliance](#qa-layer-2-—-neutrality-&-compliance)

[QA LAYER 3 — Vertical Consistency](#qa-layer-3-—-vertical-consistency)

[QA LAYER 4 — Human Clarity (Non-Expert Read)](#qa-layer-4-—-human-clarity-\(non-expert-read\))

[QA LAYER 5 — SEO Hygiene (WITHOUT GAMING)](#qa-layer-5-—-seo-hygiene-\(without-gaming\))

[QA LAYER 6 — System Compatibility (PRE-JSON)](#qa-layer-6-—-system-compatibility-\(pre-json\))

[QA LAYER 7 — Duplication & Collision Check](#qa-layer-7-—-duplication-&-collision-check)

[PART III — VA SAFE “BABY STEPS” WORKFLOW (MANDATORY)](#part-iii-—-va-safe-“baby-steps”-workflow-\(mandatory\))

[III.0 — VA STOP/GO RULE](#iii.0-—-va-stop/go-rule)

[III.1 — VA Prompt Set (COPY/PASTE TEMPLATES)](#iii.1-—-va-prompt-set-\(copy/paste-templates\))

[TEMPLATE A — “Generator \+ Self-QA Gate” (THE MAIN PROMPT)](#template-a-—-“generator-+-self-qa-gate”-\(the-main-prompt\))

[TEMPLATE B — “Final JSON Builder (HTML \+ Strict Contract)”](#template-b-—-“final-json-builder-\(html-+-strict-contract\)”)

[TEMPLATE C — “Slug Collision & Duplication Check (LLM-Assisted)”](#template-c-—-“slug-collision-&-duplication-check-\(llm-assisted\)”)

[TEMPLATE D — “JSON Sanity Check (LLM-Assisted)”](#template-d-—-“json-sanity-check-\(llm-assisted\)”)

[III.2 — VA Execution Checklist (MUST DO IN ORDER)](#iii.2-—-va-execution-checklist-\(must-do-in-order\))

[PART IV — REPO AUTO-DISCOVERY & UPDATE SOP (SAFE MODE)](#part-iv-—-repo-auto-discovery-&-update-sop-\(safe-mode\))

[IV.1 — How Auto-Discovery Actually Works (WORD-FOR-WORD REQUIREMENT)](#iv.1-—-how-auto-discovery-actually-works-\(word-for-word-requirement\))

[IV.2 — Vertical Folder Map (AUTHORITATIVE) (WORD-FOR-WORD REQUIREMENT)](#iv.2-—-vertical-folder-map-\(authoritative\)-\(word-for-word-requirement\))

[IV.3 — File Naming Rules (ABSOLUTE) (WORD-FOR-WORD REQUIREMENT)](#iv.3-—-file-naming-rules-\(absolute\)-\(word-for-word-requirement\))

[IV.4 — Required JSON Structure (COPY EXACTLY) (WORD-FOR-WORD REQUIREMENT)](#iv.4-—-required-json-structure-\(copy-exactly\)-\(word-for-word-requirement\))

[IV.5 — What You DO NOT Touch (WORD-FOR-WORD REQUIREMENT)](#iv.5-—-what-you-do-not-touch-\(word-for-word-requirement\))

[IV.6 — Safe Add Procedure (STEP-BY-STEP) (WORD-FOR-WORD REQUIREMENT)](#iv.6-—-safe-add-procedure-\(step-by-step\)-\(word-for-word-requirement\))

[PART V — VALIDATION & HARD-FAIL GUARANTEES](#part-v-—-validation-&-hard-fail-guarantees)

[V.1 — Validation (Owner Only) (WORD-FOR-WORD REQUIREMENT)](#v.1-—-validation-\(owner-only\)-\(word-for-word-requirement\))

[V.2 — User Click Audit (MANDATORY) (WORD-FOR-WORD REQUIREMENT)](#v.2-—-user-click-audit-\(mandatory\)-\(word-for-word-requirement\))

[FINAL RULE (PRINT THIS) (WORD-FOR-WORD REQUIREMENT)](#final-rule-\(print-this\)-\(word-for-word-requirement\))

[PART VI — SCALING LKG TO 5+ VERTICALS IN ONE REPO (SINGLE-REPO ARCHITECTURE)](#part-vi-—-scaling-lkg-to-5+-verticals-in-one-repo-\(single-repo-architecture\))

[VI.1 — Core Principle](#vi.1-—-core-principle)

[VI.2 — Canonical Folder Structure](#vi.2-—-canonical-folder-structure)

[VI.3 — Packs are the scaling switchboard](#vi.3-—-packs-are-the-scaling-switchboard)

[VI.4 — Auto-discovery scales automatically](#vi.4-—-auto-discovery-scales-automatically)

[VI.5 — Validation scaling rules](#vi.5-—-validation-scaling-rules)

[VI.6 — Vertical-specific logic without spaghetti](#vi.6-—-vertical-specific-logic-without-spaghetti)

[VI.7 — Cloudflare deployment model (5 verticals)](#vi.7-—-cloudflare-deployment-model-\(5-verticals\))

[VI.8 — Adding a 6th vertical (exact steps)](#vi.8-—-adding-a-6th-vertical-\(exact-steps\))

[VI.9 — Two failure modes](#vi.9-—-two-failure-modes)

[VI.10 — Operating rule (you \+ VAs)](#vi.10-—-operating-rule-\(you-+-vas\))

[Quick “VA Card” Summary (Put This At The Top Of VA Instructions)](#quick-“va-card”-summary-\(put-this-at-the-top-of-va-instructions\))

[Master Plan: “LKG Multi-Domain \+ Multi-Vertical Master Playbook (Owner \+ VA, Day-0)”](#master-plan:-“lkg-multi-domain-+-multi-vertical-master-playbook-\(owner-+-va,-day-0\)”)

[0\) The Deliverable You’re Building](#0\)-the-deliverable-you’re-building)

[Document name (canonical)](#document-name-\(canonical\))

[What “perfect” means (acceptance criteria)](#what-“perfect”-means-\(acceptance-criteria\))

[1\) Table of Contents (Your Master Doc Structure)](#1\)-table-of-contents-\(your-master-doc-structure\))

[SECTION A — Orientation (Day-0)](#section-a-—-orientation-\(day-0\))

[SECTION B — Single-Repo Architecture for 5+ Verticals](#section-b-—-single-repo-architecture-for-5+-verticals)

[SECTION C — SEO-Safe Multi-Domain Strategy (LLM-Citation Aware)](#section-c-—-seo-safe-multi-domain-strategy-\(llm-citation-aware\))

[SECTION D — Canonical / Redirect Automation](#section-d-—-canonical-/-redirect-automation)

[SECTION E — Multi-Domain Cloudflare DNS Playbook (Day-0, screenshot examples)](#section-e-—-multi-domain-cloudflare-dns-playbook-\(day-0,-screenshot-examples\))

[SECTION F — Programmatic Domain Onboarding (Batch Process)](#section-f-—-programmatic-domain-onboarding-\(batch-process\))

[SECTION G — Canonical / Redirect Audit & QA (Hard Fail Zone)](#section-g-—-canonical-/-redirect-audit-&-qa-\(hard-fail-zone\))

[SECTION H — Templates \+ Copy/Paste Library (VA-Ready)](#section-h-—-templates-+-copy/paste-library-\(va-ready\))

[2\) The Operating Model (Owner \+ VA Together)](#2\)-the-operating-model-\(owner-+-va-together\))

[Roles (explicit)](#roles-\(explicit\))

[VA responsibilities (allowed)](#va-responsibilities-\(allowed\))

[Owner responsibilities (gated)](#owner-responsibilities-\(gated\))

[3\) Baby-Step Workflows (what the master doc must contain)](#3\)-baby-step-workflows-\(what-the-master-doc-must-contain\))

[Workflow 1 — Add a New Vertical (Single Repo, 5+ vertical scaling)](#workflow-1-—-add-a-new-vertical-\(single-repo,-5+-vertical-scaling\))

[Workflow 2 — Canonical / Redirect Automation Model (the rulebook)](#workflow-2-—-canonical-/-redirect-automation-model-\(the-rulebook\))

[Workflow 3 — SEO-Safe Multi-Domain Strategy (LLM citation aware)](#workflow-3-—-seo-safe-multi-domain-strategy-\(llm-citation-aware\))

[Workflow 4 — Multi-Domain Cloudflare DNS Playbook (Day-0, no guessing)](#workflow-4-—-multi-domain-cloudflare-dns-playbook-\(day-0,-no-guessing\))

[Workflow 5 — Programmatic Domain Onboarding (batch)](#workflow-5-—-programmatic-domain-onboarding-\(batch\))

[4\) What the Master Doc Must Include as Templates (copy/paste)](#4\)-what-the-master-doc-must-include-as-templates-\(copy/paste\))

[Template 1 — Domain Inventory CSV](#template-1-—-domain-inventory-csv)

[Template 2 — Redirect Rule Pattern Library](#template-2-—-redirect-rule-pattern-library)

[Template 3 — Click Audit Checklist (Domain \+ Guides)](#template-3-—-click-audit-checklist-\(domain-+-guides\))

[Template 4 — “Vertical Onboarding” Checklist](#template-4-—-“vertical-onboarding”-checklist)

[5\) Screenshot Examples (how to do it in the doc)](#5\)-screenshot-examples-\(how-to-do-it-in-the-doc\))

[Rule](#rule)

[Example screenshot block format (the master doc should use this):](#example-screenshot-block-format-\(the-master-doc-should-use-this\):)

[6\) Construction Steps (How You Build the Master Doc From Scratch)](#6\)-construction-steps-\(how-you-build-the-master-doc-from-scratch\))

[Step 1 — Create a “Source of Truth” header block](#step-1-—-create-a-“source-of-truth”-header-block)

[Step 2 — Drop in the Table of Contents (Section A–H above)](#step-2-—-drop-in-the-table-of-contents-\(section-a–h-above\))

[Step 3 — Write each workflow as a runbook page](#step-3-—-write-each-workflow-as-a-runbook-page)

[Step 4 — Add the Templates library at the end (copy/paste ready)](#step-4-—-add-the-templates-library-at-the-end-\(copy/paste-ready\))

[Step 5 — Add the “Hard Fail QA Gates” section](#step-5-—-add-the-“hard-fail-qa-gates”-section)

[7\) The “No Breadcrumbing” Clause (explicitly in the doc)](#7\)-the-“no-breadcrumbing”-clause-\(explicitly-in-the-doc\))

[LKG MASTER PLAYBOOK](#lkg-master-playbook)

[Multi-Vertical · Multi-Domain · Canonical-First System](#multi-vertical-·-multi-domain-·-canonical-first-system)

[(Owner \+ VA · Day-0 Safe · Single Source of Truth)](#\(owner-+-va-·-day-0-safe-·-single-source-of-truth\))

[SECTION A — ORIENTATION (READ THIS FIRST)](#section-a-—-orientation-\(read-this-first\))

[A.1 — What LKG Is (and Is Not)](#a.1-—-what-lkg-is-\(and-is-not\))

[A.2 — Core Definitions (No Ambiguity)](#a.2-—-core-definitions-\(no-ambiguity\))

[A.3 — Non-Negotiable System Rules](#a.3-—-non-negotiable-system-rules)

[SECTION B — SINGLE-REPO ARCHITECTURE (5+ VERTICALS)](#section-b-—-single-repo-architecture-\(5+-verticals\))

[B.1 — Canonical Folder Pattern (AUTHORITATIVE)](#b.1-—-canonical-folder-pattern-\(authoritative\))

[B.2 — What a Pack Is (and Why It Matters)](#b.2-—-what-a-pack-is-\(and-why-it-matters\))

[B.3 — Auto-Discovery (How Guides Actually Appear)](#b.3-—-auto-discovery-\(how-guides-actually-appear\))

[B.4 — Things You Never Customize Per Vertical](#b.4-—-things-you-never-customize-per-vertical)

[B.5 — ADD A NEW VERTICAL (OWNER \+ VA RUNBOOK)](#b.5-—-add-a-new-vertical-\(owner-+-va-runbook\))

[Goal](#goal)

[Inputs](#inputs)

[Steps](#steps)

[Hard Fail Conditions](#hard-fail-conditions)

[SECTION C — SEO-SAFE MULTI-DOMAIN STRATEGY](#section-c-—-seo-safe-multi-domain-strategy)

[(LLM-Citation Aware)](#\(llm-citation-aware\))

[C.1 — The Network Model](#c.1-—-the-network-model)

[C.2 — Canonical vs Redirect (EXPLICIT RULES)](#c.2-—-canonical-vs-redirect-\(explicit-rules\))

[C.3 — Duplicate Content Policy](#c.3-—-duplicate-content-policy)

[C.4 — LLM Citation Awareness Rules](#c.4-—-llm-citation-awareness-rules)

[C.5 — URL Structure Standards](#c.5-—-url-structure-standards)

[SECTION D — CANONICAL & REDIRECT AUTOMATION](#section-d-—-canonical-&-redirect-automation)

[(Zero-Guesswork · Zero-SEO-Risk)](#\(zero-guesswork-·-zero-seo-risk\))

[D.1 — Canonical Is a SYSTEM PROPERTY, Not a CONTENT DECISION](#d.1-—-canonical-is-a-system-property,-not-a-content-decision)

[Canonical Source of Truth](#canonical-source-of-truth)

[D.2 — Canonical Enforcement Rules (ABSOLUTE)](#d.2-—-canonical-enforcement-rules-\(absolute\))

[D.3 — Redirect Domain Behavior (NO EXCEPTIONS)](#d.3-—-redirect-domain-behavior-\(no-exceptions\))

[D.4 — Canonical \+ Redirect Decision Matrix](#d.4-—-canonical-+-redirect-decision-matrix)

[D.5 — Failure Modes This Prevents](#d.5-—-failure-modes-this-prevents)

[SECTION E — PROGRAMMATIC DOMAIN ONBOARDING](#section-e-—-programmatic-domain-onboarding)

[(Owner \+ VA Safe)](#\(owner-+-va-safe\))

[E.1 — Domain Onboarding Philosophy](#e.1-—-domain-onboarding-philosophy)

[E.2 — Domain Intake Checklist (BEFORE ANY DNS)](#e.2-—-domain-intake-checklist-\(before-any-dns\))

[Decision](#decision)

[E.3 — Programmatic Naming Convention](#e.3-—-programmatic-naming-convention)

[E.4 — Domain Onboarding Steps (OWNER OR VA)](#e.4-—-domain-onboarding-steps-\(owner-or-va\))

[Step 1 — Register Domain](#step-1-—-register-domain)

[Step 2 — Decide Role](#step-2-—-decide-role)

[Step 3 — Add to Cloudflare](#step-3-—-add-to-cloudflare)

[Step 4 — Assign Behavior](#step-4-—-assign-behavior)

[SECTION F — MULTI-DOMAIN CLOUDFLARE DNS PLAYBOOK](#section-f-—-multi-domain-cloudflare-dns-playbook)

[(Screenshot-Driven · Day-0 Safe)](#\(screenshot-driven-·-day-0-safe\))

[F.1 — Cloudflare Account Structure (RECOMMENDED)](#f.1-—-cloudflare-account-structure-\(recommended\))

[F.2 — Canonical Domain Setup (STEP-BY-STEP)](#f.2-—-canonical-domain-setup-\(step-by-step\))

[Goal](#goal-1)

[Steps](#steps-1)

[Result](#result)

[F.3 — Redirect Domain Setup (STEP-BY-STEP)](#f.3-—-redirect-domain-setup-\(step-by-step\))

[Goal](#goal-2)

[Steps](#steps-2)

[Result](#result-1)

[F.4 — Redirect Rule Checklist](#f.4-—-redirect-rule-checklist)

[F.5 — Multi-Domain Failure Audit (MANDATORY)](#f.5-—-multi-domain-failure-audit-\(mandatory\))

[SECTION G — GUIDE CREATION → QA → AUTO-DISCOVERY](#section-g-—-guide-creation-→-qa-→-auto-discovery)

[(OWNER \+ VA BABY STEPS)](#\(owner-+-va-baby-steps\))

[G.1 — Guide Creation Is a 3-Stage Process](#g.1-—-guide-creation-is-a-3-stage-process)

[G.2 — VA SAFE GUIDE CREATION CHECKLIST](#g.2-—-va-safe-guide-creation-checklist)

[G.3 — LLM PROMPT (MANDATORY, FINAL FORM)](#g.3-—-llm-prompt-\(mandatory,-final-form\))

[G.4 — Pre-Repo QA (7 LAYERS, EXPLICIT)](#g.4-—-pre-repo-qa-\(7-layers,-explicit\))

[G.5 — Repo Add Procedure (VA SAFE)](#g.5-—-repo-add-procedure-\(va-safe\))

[SECTION H — VALIDATION & USER CLICK AUDIT](#section-h-—-validation-&-user-click-audit)

[(SYSTEM GUARANTEES)](#\(system-guarantees\))

[H.1 — Validation Is Not Optional](#h.1-—-validation-is-not-optional)

[H.2 — User Click Audit (HUMAN CHECK)](#h.2-—-user-click-audit-\(human-check\))

[SECTION I — FINAL OPERATOR RULES (PRINT THIS)](#section-i-—-final-operator-rules-\(print-this\))

[SECTION J — PRE-COMMIT & CI ENFORCEMENT](#section-j-—-pre-commit-&-ci-enforcement)

[(So Humans Can’t Break the System by Accident)](#\(so-humans-can’t-break-the-system-by-accident\))

[J.1 — Why Human Discipline Is Not Enough](#j.1-—-why-human-discipline-is-not-enough)

[J.2 — Pre-Commit Guardrails (LOCAL, OWNER SETUP ONCE)](#j.2-—-pre-commit-guardrails-\(local,-owner-setup-once\))

[Enforced Automatically](#enforced-automatically)

[Result](#result-2)

[J.3 — CI Validation (CLOUDFARE / GITHUB)](#j.3-—-ci-validation-\(cloudfare-/-github\))

[J.4 — “Guide Pages Must Be Clickable” Enforcement](#j.4-—-“guide-pages-must-be-clickable”-enforcement)

[SECTION K — VA DAY-0 EXECUTION CHECKLIST](#section-k-—-va-day-0-execution-checklist)

[(PRINTABLE · NO THINKING REQUIRED)](#\(printable-·-no-thinking-required\))

[K.1 — Before Writing Anything](#k.1-—-before-writing-anything)

[K.2 — Writing the Guide (LLM)](#k.2-—-writing-the-guide-\(llm\))

[K.3 — 7-Layer QA (MANDATORY)](#k.3-—-7-layer-qa-\(mandatory\))

[K.4 — Repo Add](#k.4-—-repo-add)

[K.5 — Post-Deploy Audit (Owner)](#k.5-—-post-deploy-audit-\(owner\))

[SECTION L — FAILURE MODES & HOW THIS SOP PREVENTS THEM](#section-l-—-failure-modes-&-how-this-sop-prevents-them)

[L.1 — “Guide Exists but Doesn’t Show Up”](#l.1-—-“guide-exists-but-doesn’t-show-up”)

[L.2 — “Guide Shows but Isn’t Clickable”](#l.2-—-“guide-shows-but-isn’t-clickable”)

[L.3 — “LLMs Cite the Wrong Domain”](#l.3-—-“llms-cite-the-wrong-domain”)

[L.4 — “One Vertical Broke Another”](#l.4-—-“one-vertical-broke-another”)

[SECTION M — SINGLE-REPO, MULTI-VERTICAL, MULTI-DOMAIN: FINAL MODEL](#section-m-—-single-repo,-multi-vertical,-multi-domain:-final-model)

[M.1 — What the Repo Is](#m.1-—-what-the-repo-is)

[M.2 — What a Vertical Is](#m.2-—-what-a-vertical-is)

[M.3 — What a Domain Is](#m.3-—-what-a-domain-is)

[M.4 — Scaling Rule (FINAL)](#m.4-—-scaling-rule-\(final\))

[SECTION N — FINAL, NON-NEGOTIABLE OPERATING RULES](#section-n-—-final,-non-negotiable-operating-rules)

[END OF MASTER DOCUMENT](#end-of-master-document)

# 

# Master VA Training Doc — Listings System (Repo \+ Execution) {#master-va-training-doc-—-listings-system-(repo-+-execution)}

**Audience:** Brand-new VA with zero context  
**Purpose:** Teach you how our Listings system works, how to make safe changes, and how to ship without breaking anything.  
**Non‑negotiable rule:** If you are unsure about *anything*, you **STOP** and escalate. No guessing.

---

## 0\) The Big Picture (What This Business Is) {#0)-the-big-picture-(what-this-business-is)}

We run a **city-by-city, vertical-by-vertical educational guides platform**.

- Each **vertical** \= a category of service (example: Personal Injury, Dentistry, TRT, Neuro evaluations, USCIS medical exams)  
- Each **city** \= a location hub (example: `memphis-tn`)  
- Our pages are designed to be:  
  - **Educational** (neutral, accurate, non-promotional)  
  - **AI-safe** (usable by LLMs without looking like ads, endorsements, or rankings)  
  - **Sponsor-ready** (ad slots exist structurally even when no sponsor is live)

We do **not** rank providers, do **not** claim “best”, and do **not** guarantee outcomes.

---

## 1\) Your Job (What You Will Do) {#1)-your-job-(what-you-will-do)}

As a VA, you help with execution work such as:

- Adding new cities to existing verticals  
- Building/maintaining **example provider lists** (examples only)  
- Checking for completeness and professionalism  
- Running validation and reporting failures  
- Following SOPs exactly

You do **not**:

- Invent providers  
- Add rankings, scores, or “best” language  
- Make legal/medical recommendations  
- Change core templates or scripts unless instructed  
- Ship anything without passing `validate:all`

---

## 2\) The Canonical Documents (Read These First) {#2)-the-canonical-documents-(read-these-first)}

These are your “rules of the road.” They exist as project artifacts and must be treated as authority.

1) **Master Index / Addendums** (govern system scope and rules)  
2) **Execution Playbook (MD Canonical v5)** (how we execute; modes; what is allowed)  
3) **Sponsor Activation Steps for Github Repo** (when sponsor-live happens)  
4) **AI visibility evaluation framework** (canonical copy for city pages)

**Rule:** When instructions conflict, the Execution Playbook wins.

---

## 3\) Repo Orientation (What’s Where) {#3)-repo-orientation-(what’s-where)}

### 3.1 Key folders {#3.1-key-folders}

**Core data**

- `data/` — source data for pages

**City registry**

- `data/cities.json` — canonical list of cities we support

**City listing data**

- `data/listings/<city>.json` — per-city hub configuration (and disclosures)

**Example provider lists (examples only)**

- `data/example_providers/<vertical>/...` — per-vertical per-city lists

**Vertical packs / page sets**

- `data/page_sets/examples/` — defines what a vertical pack builds  
  - `pi_v1.json`, `dentistry_v1.json`, `trt_v1.json`, etc.

**Global pages per vertical**

- `data/page_sets/examples/<vertical>_global_pages/` — About, Disclaimer, Guides, etc.

**Licensing verification links**

- `data/licensing_lookup/<vertical>.json` — state licensing/verification URLs (non-PI verticals)

**Scripts (build \+ validation)**

- `scripts/build_city_sites.js` — builds the site into dist  
- `scripts/validate_all_packs.js` — runs validations across packs  
- `scripts/validate_tbs.js` — validation logic

**Templates**

- `templates/` and `templates/partials/` — HTML structure

**Output (generated)**

- `dist/` — built website output (do not hand-edit)

---

## 4\) Naming Rules (You Must Follow Exactly) {#4)-naming-rules-(you-must-follow-exactly)}

### City slug format {#city-slug-format}

- Always: `city-name-state`  
- Lowercase  
- Hyphenated

Examples:

- `memphis-tn`  
- `new-york-city-ny`

### Sub-industry provider list filenames {#sub-industry-provider-list-filenames}

Some verticals require multiple lists per city.

Examples:

- TRT: `memphis-tn__trt.json`, `memphis-tn__iv_hydration.json`, `memphis-tn__hair_restoration.json`  
- Neuro: `memphis-tn__adhd_eval.json`, `memphis-tn__autism_eval.json`

**Rule:** Filenames are contracts. Wrong filenames \= lists won’t render.

---

## 5\) Content Rules (The “Never Do” List) {#5)-content-rules-(the-“never-do”-list)}

Do NOT add:

- “best”, “top”, “\#1”, “highest rated”, “award-winning”  
- any ranking order (1–10 as “best”)  
- guarantees (results, outcomes, “will help”)  
- medical/legal advice (“you should do X”) unless purely informational and neutral

We use:

- “examples only”  
- “people typically consider…”  
- “often varies by city/state…”

This is required for compliance and AI eligibility.

---

## 6\) Validation Discipline (How We Avoid Shipping Mistakes) {#6)-validation-discipline-(how-we-avoid-shipping-mistakes)}

### The only acceptable definition of “done” {#the-only-acceptable-definition-of-“done”}

- The change exists in source files (`data/`, packs)  
- The site builds cleanly  
- `npm run validate:all` passes

### Commands you will use {#commands-you-will-use}

Install:

npm install

Validate everything:

npm run validate:all

Build specific pack (if asked):

node scripts/build\_city\_sites.js \--pageSetFile data/page\_sets/examples/\<pack\>.json

**Rule:** If validate fails, you STOP and paste the error verbatim.

---

## 7\) Standard Workflow (Every Time) {#7)-standard-workflow-(every-time)}

1) Pull latest code and confirm branch  
2) Make only the requested changes  
3) Run `npm run validate:all`  
4) Spot-check output in `dist/`  
5) Commit with a clear message  
6) Push to GitHub

No side edits. No “while I’m here.”

---

## 8\) SOP: Adding a New City (Use This When Asked) {#8)-sop:-adding-a-new-city-(use-this-when-asked)}

Follow the **City Expansion SOP**.

Quick reference of the typical files you touch:

- `data/cities.json`  
- `data/listings/<city>.json`  
- `data/page_sets/examples/<vertical>_v1.json` (add city to cities array)  
- `data/example_providers/<vertical>/...` (create provider lists)

Then:

- `npm run validate:all`  
- Check `dist/<city>/index.html`

Never ship a city without provider lists.

---

## 9\) SOP: Launching a New Vertical (Use This When Asked) {#9)-sop:-launching-a-new-vertical-(use-this-when-asked)}

Follow the **New Vertical Launch SOP**.

You will typically touch:

- `data/page_sets/examples/<vertical>_v1.json`  
- `data/page_sets/examples/<vertical>_global_pages/`  
- `data/example_providers/<vertical>/`  
- `data/licensing_lookup/<vertical>.json` (if applicable)

Then:

- `npm run validate:all`  
- Spot-check 1–2 cities in `dist/`

Never launch a vertical with missing global pages.

---

## 10\) Provider Lists: How to Build Them Correctly {#10)-provider-lists:-how-to-build-them-correctly}

### What a provider list is {#what-a-provider-list-is}

A provider list is an **examples-only** set of real providers in a city.

### Minimum required fields {#minimum-required-fields}

Every entry must include:

- `name`  
- `official_site_url`

### Allowed sources {#allowed-sources}

- The provider’s official website  
- Official directory pages only when needed for verification (but the *link we store* should be the official site)

### Disallowed sources as “official” {#disallowed-sources-as-“official”}

- Yelp  
- Justia  
- Healthgrades  
- Avvo  
- random lead-gen sites

### Safety rules {#safety-rules}

- Do not claim anything about quality  
- Do not rank  
- Do not include “best”

If you can’t verify an official website, flag and escalate.

---

## 11\) Sponsor-Live vs Education-Only (What You Need to Know) {#11)-sponsor-live-vs-education-only-(what-you-need-to-know)}

Default mode \= **education-only**.

Education-only means:

- No next-steps CTAs that look like lead gen  
- No “compare providers”  
- Ads may exist as empty slots

Sponsor-live is only activated when instructed.

If you are asked to activate a sponsor:

- Use the **Sponsor Activation Steps** document  
- Do not guess the files; follow the checklist

---

## 12\) AI Visibility Monitoring (What We Check Monthly) {#12)-ai-visibility-monitoring-(what-we-check-monthly)}

We run a lightweight monthly check:

- Ask baseline questions in ChatGPT and one other model  
- Confirm the answers align with our evaluation framework  
- Look for drift (new steps, recommendation language)

If drift appears:

- Do not change live pages  
- Escalate with the exact prompt \+ response excerpt

---

## 13\) How to Escalate (Exactly What to Send) {#13)-how-to-escalate-(exactly-what-to-send)}

When escalating, send:

1) What you were trying to do  
2) Which file you edited (full path)  
3) The exact error output (verbatim)  
4) What you already tried

No summaries. Paste the raw output.

---

## 14\) Quick Glossary {#14)-quick-glossary}

- **Vertical**: a service category (PI, Dentistry, TRT, etc.)  
- **City hub**: the city page (e.g., `/memphis-tn/`)  
- **Pack / Page set**: configuration that builds a vertical site  
- **Examples list**: non-ranked provider list (examples only)  
- **Sponsor-live**: sponsor content active (rare; explicit approval required)  
- **Education-only**: default mode; compliance-forward  
- **Validation**: scripts that prevent shipping broken or non-compliant output

---

## 15\) VA Permission Matrix (What You MAY and MAY NOT Touch) {#15)-va-permission-matrix-(what-you-may-and-may-not-touch)}

### ✅ You MAY edit {#✅-you-may-edit}

- `data/cities.json`  
- `data/listings/<city>.json`  
- `data/example_providers/<vertical>/...`  
- `data/page_sets/examples/<vertical>_v1.json` (cities array only)  
- FAQ content files when explicitly instructed

### ❌ You MAY NOT edit (without written approval) {#❌-you-may-not-edit-(without-written-approval)}

- `scripts/`  
- `templates/`  
- `data/ad_placements.json`  
- `data/site.json`  
- `package.json`  
- Validation logic of any kind

If unsure → STOP and escalate.

---

## 16\) Copy‑Paste Templates (Use These Exactly) {#16)-copy‑paste-templates-(use-these-exactly)}

### A) City Registration Entry (`data/cities.json`) {#a)-city-registration-entry-(data/cities.json)}

{

  "slug": "memphis-tn",

  "name": "Memphis",

  "state": "TN"

}

### B) City Listing File (`data/listings/memphis-tn.json`) {#b)-city-listing-file-(data/listings/memphis-tn.json)}

{

  "city": "Memphis",

  "state": "TN",

  "educationOnly": true

}

### C) Example Provider Entry {#c)-example-provider-entry}

{

  "name": "Example Provider Name",

  "official\_site\_url": "https://www.example.com"

}

---

## 17\) Personal Injury (PI) Special Rules — READ CAREFULLY {#17)-personal-injury-(pi)-special-rules-—-read-carefully}

Personal Injury is **state‑driven**, not city‑only.

- PI supports **all 50 U.S. states**  
- Every state must have:  
  - A disciplinary / licensing lookup  
  - A state hub page

### What this means for VAs {#what-this-means-for-vas}

- You **do not create PI state pages manually**  
- State pages are auto‑generated  
- City PI pages must:  
  - Link back to their state page  
  - Reference state‑level authority correctly

Files involved:

- `data/pi_state_disciplinary_links.json`  
- `data/page_sets/examples/pi_v1.json`

❌ Never delete or edit state mappings unless explicitly instructed.

---

## 18\) Escalation Template (Copy This) {#18)-escalation-template-(copy-this)}

When escalating, paste **exactly** this:

TASK:

FILES TOUCHED:

WHAT I EXPECTED TO HAPPEN:

WHAT ACTUALLY HAPPENED:

ERROR OUTPUT (VERBATIM):

WHAT I ALREADY TRIED:

No summaries. No interpretations.

---

## 19\) Visual Callouts — “What Success Looks Like” {#19)-visual-callouts-—-“what-success-looks-like”}

Use these as **mental screenshots**. If your output does not resemble these, the work is not complete.

### ✅ Successful Validation Run {#✅-successful-validation-run}

ALL PACKS PASSED

If you do NOT see this line, the work is not done.

---

### ✅ Correct City Output in dist/ {#✅-correct-city-output-in-dist/}

dist/

 └── memphis-tn/

     ├── index.html

     └── faq/

         └── index.html

If the city folder does not exist, the city did not build.

---

### ✅ Correct City Page Section Order (Top → Bottom) {#✅-correct-city-page-section-order-(top-→-bottom)}

1. City title / header  
2. Evaluation Framework (education-only explanation)  
3. Top ad slot  
4. Mid ad slot (directly above lists)  
5. Example provider list(s)  
6. Guides block  
7. FAQ block  
8. Disclosure / footer

If ads appear inside the framework or FAQs, something is wrong.

---

### ✅ Correct Example Provider List {#✅-correct-example-provider-list}

Examples of providers in Memphis, TN

• Provider Name — officialsite.com

• Provider Name — officialsite.com

• Provider Name — officialsite.com

If you see rankings, stars, or “best” language → STOP immediately.

---

## 20\) VA Certification Checklist (MUST PASS BEFORE PROD ACCESS) {#20)-va-certification-checklist-(must-pass-before-prod-access)}

**No VA may touch production, push to main, or run sponsor/live work until EVERY item below is checked and signed off.**

This is a hard gate. Partial completion \= FAIL.

---

### A) Repo & System Literacy (Required) {#a)-repo-&-system-literacy-(required)}

☐ VA can explain, in their own words, what this business is (educational city \+ vertical guides, not rankings)

☐ VA can explain the difference between:

- a **vertical** (PI, Dentistry, TRT, Neuro, USCIS)  
- a **city hub** (`/memphis-tn/`)  
- a **pack / page set** (`pi_v1.json`, `dentistry_v1.json`, etc.)

☐ VA can correctly locate and open the following paths **without help**:

- `data/cities.json`  
- `data/listings/`  
- `data/example_providers/`  
- `data/page_sets/examples/`  
- `scripts/validate_all_packs.js`  
- `dist/`

☐ VA understands that `dist/` is generated output and must **never** be hand-edited

---

### B) Compliance & Content Rules (Required) {#b)-compliance-&-content-rules-(required)}

☐ VA can list forbidden language **from memory**:

- “best”, “top”, “\#1”, “we recommend”, “hire”, “guaranteed”, outcome promises

☐ VA understands and can explain:

- education-only vs sponsor-live  
- what “examples only” means  
- why we do NOT rank providers

☐ VA can identify recommendation language in sample text and explain why it is not allowed

☐ VA understands that violations here can break legal, medical, and platform safety

---

### C) File Naming & Structural Accuracy (Required) {#c)-file-naming-&-structural-accuracy-(required)}

☐ VA can correctly name a city slug (lowercase, hyphenated, `city-state`)

☐ VA can correctly name example provider files, including sub-industries:

- TRT: `city__trt.json`, `city__iv_hydration.json`, `city__hair_restoration.json`  
- Neuro: `city__adhd_eval.json`, `city__autism_eval.json`

☐ VA understands that **wrong filenames \= content does not render**

---

### D) Provider List Competency (Required) {#d)-provider-list-competency-(required)}

☐ VA can explain what qualifies as an **example provider**

☐ VA can demonstrate how to verify an **official website**

☐ VA understands these are NOT allowed as official URLs:

- Yelp  
- Justia  
- Avvo  
- Healthgrades  
- Lead-gen marketplaces

☐ VA can build a valid provider list JSON that passes validation

---

### E) Personal Injury (PI) Special Rules (Mandatory) {#e)-personal-injury-(pi)-special-rules-(mandatory)}

☐ VA understands that PI is **state-driven**, not city-only

☐ VA knows PI covers **all 50 U.S. states**

☐ VA can identify the PI-specific files:

- `data/pi_state_disciplinary_links.json`  
- `data/page_sets/examples/pi_v1.json`

☐ VA understands they must **never** delete or alter state mappings without explicit approval

---

### F) Validation Discipline (Non-Negotiable) {#f)-validation-discipline-(non-negotiable)}

☐ VA can run:

npm install

npm run validate:all

☐ VA understands what a PASS vs FAIL means

☐ VA knows that **any validation failure \= STOP \+ escalate**

☐ VA can paste raw validation output without summarizing or editing

---

### G) dist/ Spot-Check Skills (Required) {#g)-dist/-spot-check-skills-(required)}

☐ VA can open a city page in `dist/<city>/index.html`

☐ VA can visually confirm:

- evaluation framework appears exactly once  
- ad slot exists above provider list  
- provider list renders  
- FAQ page exists and is populated

☐ VA can identify duplicate sections or layout issues

---

### H) Permission Matrix Understanding (Required) {#h)-permission-matrix-understanding-(required)}

☐ VA can correctly list files they MAY edit

☐ VA can correctly list files they MUST NEVER edit

☐ VA understands that editing scripts, templates, or validation logic without permission is a firing offense

---

### I) Escalation Competency (Required) {#i)-escalation-competency-(required)}

☐ VA can recite the escalation template

☐ VA understands escalation triggers:

- uncertainty  
- missing data  
- validation failures  
- ambiguous instructions

☐ VA understands guessing is not allowed

---

### J) Supervised Dry Run (Final Gate) {#j)-supervised-dry-run-(final-gate)}

☐ VA successfully completes a supervised dry run that includes:

- adding a test city  
- creating example provider lists  
- updating the correct pack  
- running validation  
- spotting output in `dist/`

☐ Dry run is reviewed and approved

---

### ✅ Certification Result {#✅-certification-result}

☐ ALL sections passed

☐ Approved for limited production access

☐ Approved by: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

☐ Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**If any box is unchecked → VA is NOT certified.**

---

# **LISTINGS GUIDES SYSTEM** {#listings-guides-system}

## **MASTER SOP — CREATION → QA → AUTO-DISCOVERY → VALIDATION → SCALE (OWNER \+ VA EXECUTABLE)** {#master-sop-—-creation-→-qa-→-auto-discovery-→-validation-→-scale-(owner-+-va-executable)}

**Applies to:**  
All verticals (PI, TRT, Neuro, Dentistry, USCIS Medical, and all future verticals)

**Audience:**  
Repo owner **and** any VA (technical or non-technical)

**Goal:**  
A guide can be created in a chat, QA’d, converted into a valid JSON file, dropped into the repo, automatically discovered, rendered, validated, audited for clickability, and safely deployed — **without breaking anything**.

---

# **OVERVIEW — HOW THE GUIDES SYSTEM WORKS NOW (READ FIRST)** {#overview-—-how-the-guides-system-works-now-(read-first)}

This system is intentionally simple **once rules are followed**.

**There is no manual registry. No hardcoded slug lists. No card management.**

Everything is driven by:

* file naming  
* folder location  
* validation

### **Canonical Flow (End-to-End)** {#canonical-flow-(end-to-end)}

LLM chat  
 → LLM produces draft guide content  
 → LLM runs 7-layer QA against the draft (must pass)  
 → LLM converts to FINAL guide JSON (correct filename \+ slug \+ HTML)  
 → File dropped into correct vertical folder  
 → Auto-discovery scans folder  
 → Guides hub renders cards  
 → Validation confirms existence \+ clickability  
 → Deploy  
 → Manual click audit confirms real-world navigation

If any step breaks → **hard fail**.

---

# **PART I — GUIDE CREATION (LLM \+ CHAT WORKFLOW)** {#part-i-—-guide-creation-(llm-+-chat-workflow)}

This is where most systems silently fail. This SOP removes ambiguity.

---

## **I.1 — Canonical Rule (NON-NEGOTIABLE)** {#i.1-—-canonical-rule-(non-negotiable)}

**Guides are created in chat first, NEVER in the repo.**

Order is fixed:

1. Create guide content in a chat (LLM)  
2. QA the content fully (7 layers)  
3. Convert directly into final JSON  
4. Add to repo

No drafts in repo. No partial files. No cleanup later.

---

## **I.2 — The LLM Is the JSON Factory (EXPLICIT)** {#i.2-—-the-llm-is-the-json-factory-(explicit)}

The LLM **must output the final, production-ready JSON file**.

❌ Not prose  
❌ Not markdown  
❌ Not “content to convert later”

✅ A valid `.json` file that can be dropped into the repo as-is

---

## **I.3 — Required Sections (CONTENT CONTRACT) (WORD-FOR-WORD REQUIREMENT)** {#i.3-—-required-sections-(content-contract)-(word-for-word-requirement)}

Every guide must include all of the following, in this order conceptually:

* Authority / Scope Note  
  Explains what the guide is and is not  
  Educational only, no advice, no endorsements  
* Primary Question  
  What someone is actually trying to understand  
* If You Only Read One Thing  
  1–2 sentence takeaway  
  Neutral, non-promissory  
* How This Is Commonly Evaluated  
  Criteria people usually look at  
  What matters vs what doesn’t  
* Common Misunderstandings  
  Where consumers get confused  
* Tradeoffs / Limitations  
  When this option is not a fit  
* Costs / Time / Commitment (High-Level)  
  No prices, just ranges or variability  
* How to Think About the Decision  
  Framework, not instruction  
* Bottom Line  
  Summary without persuasion

**If a guide is missing one of these → it is incomplete.**

---

## **I.4 — Tone Rules (NON-NEGOTIABLE) (WORD-FOR-WORD REQUIREMENT)** {#i.4-—-tone-rules-(non-negotiable)-(word-for-word-requirement)}

No hype  
No urgency  
No CTA language  
No “best,” “top,” “leading”  
No guarantees  
No provider comparisons  
No medical, legal, or financial advice

This applies to every vertical, including PI.

---

# **PART II — THE 7-LAYER QA SYSTEM (MUST PASS ALL 7\)** {#part-ii-—-the-7-layer-qa-system-(must-pass-all-7)}

A guide is not allowed into the repo unless it passes all layers.

### **QA LAYER 1 — Structural Completeness** {#qa-layer-1-—-structural-completeness}

Check:

* All required sections exist  
* Logical flow makes sense  
* No missing core concepts  
  Fail if:  
* Sections are skipped  
* Content is fragmented  
* Reads like notes instead of a guide

### **QA LAYER 2 — Neutrality & Compliance** {#qa-layer-2-—-neutrality-&-compliance}

Check:

* No endorsements  
* No rankings  
* No advice language  
* No promises  
  Fail if:  
* “You should”  
* “Best option”  
* “Recommended provider”  
* “This will help you”

### **QA LAYER 3 — Vertical Consistency** {#qa-layer-3-—-vertical-consistency}

Check:

* Uses correct vertical framing  
* Terminology consistent with that vertical’s hub  
  Fail if:  
* TRT guide reads like PI  
* USCIS guide reads like wellness  
* Inconsistent definitions

### **QA LAYER 4 — Human Clarity (Non-Expert Read)** {#qa-layer-4-—-human-clarity-(non-expert-read)}

Check:

* Normal person can understand it  
* No unexplained jargon  
  Fail if:  
* Reads like a textbook  
* Assumes insider knowledge

### **QA LAYER 5 — SEO Hygiene (WITHOUT GAMING)** {#qa-layer-5-—-seo-hygiene-(without-gaming)}

Check:

* Clear title  
* Clean slug concept  
* Topic matches user intent  
  Fail if:  
* Keyword stuffing  
* Awkward phrasing for bots

### **QA LAYER 6 — System Compatibility (PRE-JSON)** {#qa-layer-6-—-system-compatibility-(pre-json)}

Before converting to JSON:

* Content converts cleanly to HTML  
* No markdown tables that won’t render  
* No broken lists  
  Fail if:  
* Markdown heavy  
* Formatting will break HTML

### **QA LAYER 7 — Duplication & Collision Check** {#qa-layer-7-—-duplication-&-collision-check}

Check:

* Topic not already covered  
* Slug does not collide  
  Fail if:  
* Duplicate guide exists  
* Overlapping slug meaning

---

# **PART III — VA SAFE “BABY STEPS” WORKFLOW (MANDATORY)** {#part-iii-—-va-safe-“baby-steps”-workflow-(mandatory)}

This is the missing part you called out: **the VA must force the LLM to QA itself BEFORE producing final JSON.**

This workflow makes that unavoidable.

## **III.0 — VA STOP/GO RULE** {#iii.0-—-va-stop/go-rule}

A VA is **not allowed** to ask for final JSON until the LLM has printed:

* the proposed slug  
* the proposed title  
* the full QA report (Layers 1–7)  
* a PASS/FAIL line for each layer  
* and “READY\_FOR\_JSON: YES”

If “READY\_FOR\_JSON: NO” → revision loop.

---

## **III.1 — VA Prompt Set (COPY/PASTE TEMPLATES)** {#iii.1-—-va-prompt-set-(copy/paste-templates)}

### **TEMPLATE A — “Generator \+ Self-QA Gate” (THE MAIN PROMPT)** {#template-a-—-“generator-+-self-qa-gate”-(the-main-prompt)}

**Use this first. It forces QA before JSON.**

**SYSTEM**

You are generating an independent, educational guide for a consumer listings site.  
The guide explains how a service is commonly evaluated, not which provider to choose.  
No rankings. No endorsements. No urgency. No hype. No CTA language. No guarantees.  
No medical, legal, or financial advice. Educational only.  
Output must be plain text (no markdown fences / no backticks).

**USER**

Create a complete educational guide on:

TOPIC: \[PASTE TOPIC\]  
VERTICAL: \[pi | trt | neuro | dentistry | uscis\_medical\]

HARD RULES:  
\- Neutral, factual, consumer-clarity focused  
\- Explain how this service is commonly evaluated  
\- Do NOT recommend providers  
\- Do NOT give advice (“you should…”)  
\- Do NOT compare providers  
\- Do NOT use hype/urgency/promises

REQUIRED SECTIONS (must appear, in this order):  
1\) Authority / Scope Note  
2\) Primary Question  
3\) If You Only Read One Thing  
4\) How This Is Commonly Evaluated  
5\) Common Misunderstandings  
6\) Tradeoffs / Limitations  
7\) Costs / Time / Commitment (High-Level only)  
8\) How to Think About the Decision  
9\) Bottom Line

NOW THE IMPORTANT PART:  
Before you output any JSON, you MUST:  
Step 1: Propose a slug (lowercase, hyphens only) and a human title.  
Step 2: Run a 7-layer QA audit on your own draft. For each layer print: PASS/FAIL \+ 1-3 bullet reasons.  
Step 3: If any layer FAILS, revise the draft and re-run QA until all layers PASS.  
Step 4: When and only when all 7 layers PASS, print the final line:  
READY\_FOR\_JSON: YES  
and then stop. Do NOT output JSON yet.

**What the VA does next:** only if READY\_FOR\_JSON: YES → proceed to Template B.

---

### **TEMPLATE B — “Final JSON Builder (HTML \+ Strict Contract)”** {#template-b-—-“final-json-builder-(html-+-strict-contract)”}

**Use this only after READY\_FOR\_JSON: YES.**

**USER**

Convert the approved guide into FINAL JSON with these rules:

1\) Output ONLY valid JSON (no commentary, no markdown, no backticks).  
2\) Filename pattern (for my reference): guides\_\<slug\>.json  
3\) JSON must match exactly this structure:

{  
  "route": "/guides/\<slug\>/",  
  "title": "Human Readable Guide Title",  
  "description": "1–2 sentence neutral summary.",  
  "main\_html": "\<h3\>\<slug\>\</h3\>\<p\>Full HTML guide content.\</p\>"  
}

Rules:  
\- route MUST match the slug  
\- main\_html must be valid HTML (no markdown)  
\- Keep content neutral and identical in meaning to the approved version  
\- No tables. No code blocks. No weird characters that break JSON  
\- Avoid unescaped quotes inside HTML

Output JSON only.

---

### **TEMPLATE C — “Slug Collision & Duplication Check (LLM-Assisted)”** {#template-c-—-“slug-collision-&-duplication-check-(llm-assisted)”}

Use when the VA has access to the existing guide list (from /guides/ page or repo folder list).

**USER**

Here is a list of existing guide slugs for this vertical:  
\[PASTE SLUG LIST\]

Proposed new guide topic: \[TOPIC\]  
Proposed slug: \[SLUG\]

Task:  
1\) Tell me if this topic duplicates any existing guide (yes/no \+ which).  
2\) Tell me if the slug collides or is confusingly similar (yes/no \+ which).  
3\) If there is any conflict, propose 3 better slugs.  
Output as:  
DUPLICATE\_TOPIC: YES/NO  
SLUG\_COLLISION: YES/NO  
NOTES:  
RECOMMENDED\_SLUGS:

---

### **TEMPLATE D — “JSON Sanity Check (LLM-Assisted)”** {#template-d-—-“json-sanity-check-(llm-assisted)”}

Use if a VA is nervous about broken JSON.

**USER**

Validate this JSON for:  
\- valid JSON syntax  
\- route matches slug  
\- description 1–2 sentences  
\- main\_html contains only HTML, no markdown  
\- no unescaped quotes that would break parsing

Return only:  
JSON\_VALID: YES/NO  
ISSUES:  
FIXED\_JSON:

(Then the VA uses FIXED\_JSON.)

---

## **III.2 — VA Execution Checklist (MUST DO IN ORDER)** {#iii.2-—-va-execution-checklist-(must-do-in-order)}

1. Run Template A  
2. Confirm output contains:  
   * slug  
   * title  
   * QA Layer 1–7 PASS  
   * READY\_FOR\_JSON: YES  
3. Run Template B → receive final JSON  
4. Run Template D if any doubt  
5. Only then add to repo

---

# **PART IV — REPO AUTO-DISCOVERY & UPDATE SOP (SAFE MODE)** {#part-iv-—-repo-auto-discovery-&-update-sop-(safe-mode)}

This is where most systems break. Follow exactly.

---

## **IV.1 — How Auto-Discovery Actually Works (WORD-FOR-WORD REQUIREMENT)** {#iv.1-—-how-auto-discovery-actually-works-(word-for-word-requirement)}

For each vertical:

* The system scans the vertical’s `*_global_pages` folder  
* It auto-discovers files named:

`guides_<slug>.json`

`guides.json` acts as a hub renderer, not a registry  
Guide cards are auto-generated  
Validation checks:

* File exists  
* Route resolves  
* Page is clickable  
  No hardcoded slug lists exist.

---

## **IV.2 — Vertical Folder Map (AUTHORITATIVE) (WORD-FOR-WORD REQUIREMENT)** {#iv.2-—-vertical-folder-map-(authoritative)-(word-for-word-requirement)}

data/page\_sets/examples/  
├─ pi\_global\_pages/  
├─ trt\_global\_pages/  
├─ neuro\_global\_pages/  
├─ dentistry\_global\_pages/  
├─ uscis\_medical\_global\_pages/

A guide must live in exactly one of these.

---

## **IV.3 — File Naming Rules (ABSOLUTE) (WORD-FOR-WORD REQUIREMENT)** {#iv.3-—-file-naming-rules-(absolute)-(word-for-word-requirement)}

Filename: `guides_<slug>.json`

Slug rules:

* lowercase  
* hyphens only  
* no underscores  
* no spaces

---

## **IV.4 — Required JSON Structure (COPY EXACTLY) (WORD-FOR-WORD REQUIREMENT)** {#iv.4-—-required-json-structure-(copy-exactly)-(word-for-word-requirement)}

{  
  "route": "/guides/\<slug\>/",  
  "title": "Human Readable Guide Title",  
  "description": "1–2 sentence neutral summary.",  
  "main\_html": "\<h3\>\<slug\>\</h3\>\<p\>Full HTML guide content.\</p\>"  
}

Rules:

* route MUST match filename slug  
* main\_html must be valid HTML  
* No markdown

---

## **IV.5 — What You DO NOT Touch (WORD-FOR-WORD REQUIREMENT)** {#iv.5-—-what-you-do-not-touch-(word-for-word-requirement)}

❌ Do not edit guides.json  
❌ Do not manually add guide cards  
❌ Do not add slugs anywhere else  
❌ Do not rename existing guide files

---

## **IV.6 — Safe Add Procedure (STEP-BY-STEP) (WORD-FOR-WORD REQUIREMENT)** {#iv.6-—-safe-add-procedure-(step-by-step)-(word-for-word-requirement)}

1. Confirm guide passed all 7 QA layers  
2. Choose correct vertical folder  
3. Create guides\_.json  
4. Paste validated JSON  
5. Save  
6. Commit  
7. Push

That’s it.

---

# **PART V — VALIDATION & HARD-FAIL GUARANTEES** {#part-v-—-validation-&-hard-fail-guarantees}

---

## **V.1 — Validation (Owner Only) (WORD-FOR-WORD REQUIREMENT)** {#v.1-—-validation-(owner-only)-(word-for-word-requirement)}

Run:

npm run validate:all

Validation checks:

* Guide file exists  
* Route resolves  
* Guide is clickable  
* Hub renders card  
* No phantom slugs  
* No missing JSON

If a guide is missing or broken → **hard fail**.

---

## **V.2 — User Click Audit (MANDATORY) (WORD-FOR-WORD REQUIREMENT)** {#v.2-—-user-click-audit-(mandatory)-(word-for-word-requirement)}

After deploy:

1. Go to `/guides/`  
2. Scroll to vertical  
3. Confirm:  
   * Guide appears  
   * Title correct  
   * Click loads page  
   * URL matches slug

If not clickable → treat as a **system bug**, not content.

---

# **FINAL RULE (PRINT THIS) (WORD-FOR-WORD REQUIREMENT)** {#final-rule-(print-this)-(word-for-word-requirement)}

A guide is only “real” when it passes all 7 QA layers, exists as a correctly named JSON file in the correct vertical folder, appears on the Guides hub, is clickable, and passes validation.

---

# **PART VI — SCALING LKG TO 5+ VERTICALS IN ONE REPO (SINGLE-REPO ARCHITECTURE)** {#part-vi-—-scaling-lkg-to-5+-verticals-in-one-repo-(single-repo-architecture)}

(Transferred \+ preserved from your prior SOP text)

## **VI.1 — Core Principle** {#vi.1-—-core-principle}

One generator, many “packs.”  
A “vertical” is not a separate site or repo. It’s a pack configuration \+ a set of content files.

You scale by:

* adding a new vertical’s global pages folder  
* adding/pointing to its licensing lookup (if needed)  
* adding its pack JSON  
* adding its cities file (if you want cities for it)  
* letting validation enforce correctness

## **VI.2 — Canonical Folder Structure** {#vi.2-—-canonical-folder-structure}

A) Global pages per vertical:

data/page\_sets/examples/  
  \<vertical\>\_global\_pages/  
    home.json  
    faq.json  
    methodology.json  
    editorial-policy.json  
    disclaimer.json  
    privacy.json  
    contact.json  
    for-providers.json  
    guides.json  
    guides\_\<slug\>.json

B) Cities files (optional):

data/page\_sets/examples/cities\_\<vertical\>\_v1.json

## **VI.3 — Packs are the scaling switchboard** {#vi.3-—-packs-are-the-scaling-switchboard}

Each vertical exists via pack JSON:

data/page\_sets/examples/\<vertical\>\_v1.json

Validation runs pack-by-pack.

## **VI.4 — Auto-discovery scales automatically** {#vi.4-—-auto-discovery-scales-automatically}

Discovery is just:

* scan folder  
* include all guides\_\*.json  
* render cards  
* validate clickability  
  Scaling risk is naming drift → solved by hard-fail validators.

## **VI.5 — Validation scaling rules** {#vi.5-—-validation-scaling-rules}

As verticals increase, validators must do MORE:

* hub contains N cards  
* each card route resolves  
* no orphan guide JSON  
* no hub slugs pointing nowhere  
  If any fails → hard fail.

## **VI.6 — Vertical-specific logic without spaghetti** {#vi.6-—-vertical-specific-logic-without-spaghetti}

Use pack flags, not forks.  
If a vertical needs special rules:

* implement via pack flags  
* validators gate rules on flags  
* generator branches on flags (centralized)

## **VI.7 — Cloudflare deployment model (5 verticals)** {#vi.7-—-cloudflare-deployment-model-(5-verticals)}

Option A (recommended): 1 Cloudflare project per vertical (same repo)

* same repo  
* same build command  
* different env var / pack selection per project

Option B: 1 Cloudflare project builds all packs into one dist  
Only valid if routes never collide and you want one network site.

## **VI.8 — Adding a 6th vertical (exact steps)** {#vi.8-—-adding-a-6th-vertical-(exact-steps)}

1. Create folder `<vertical>_global_pages/`  
2. Add required global pages  
3. Add guides `guides_<slug>.json`  
4. Add licensing lookup if required  
5. Add pack JSON `<vertical>_v1.json`  
6. (Optional) add cities file  
7. Run `npm run validate:all`  
8. Deploy Cloudflare project for that pack

## **VI.9 — Two failure modes** {#vi.9-—-two-failure-modes}

1. Naming drift → hard fail validators  
2. Vertical-specific rules leaking → pack flags \+ centralized logic

## **VI.10 — Operating rule (you \+ VAs)** {#vi.10-—-operating-rule-(you-+-vas)}

No one “creates a vertical.” They create a pack \+ a folder, and validation proves it works.  
If validation passes and click audit passes, the vertical exists. If not, it doesn’t.

---

## **Quick “VA Card” Summary (Put This At The Top Of VA Instructions)** {#quick-“va-card”-summary-(put-this-at-the-top-of-va-instructions)}

* Use Template A → wait for READY\_FOR\_JSON: YES  
* Use Template B → get JSON only  
* Put file in correct folder as guides\_.json  
* Do not touch guides.json  
* Owner runs validate \+ deploy \+ click audit

---

If you want the **Multi-domain Cloudflare DNS playbook** next, I’ll write it in this same “owner \+ VA executable” style with: canonical domain map, Cloudflare project-per-vertical, DNS records, redirects, and post-deploy click audits.

## **Master Plan: “LKG Multi-Domain \+ Multi-Vertical Master Playbook (Owner \+ VA, Day-0)”** {#master-plan:-“lkg-multi-domain-+-multi-vertical-master-playbook-(owner-+-va,-day-0)”}

You want **one canonical master document** that someone brand new can follow end-to-end—no breadcrumbing, no “next we can,” no missing pieces. This plan tells you **exactly how to construct that document**, what sections it must include, what artifacts/templates/checklists it must contain, and the **baby-step workflows** for Owner \+ VA together. I’ll include **screenshot *examples*** as “what you should see” callouts (since I can’t literally screenshot your Cloudflare account).

---

# **0\) The Deliverable You’re Building** {#0)-the-deliverable-you’re-building}

### **Document name (canonical)** {#document-name-(canonical)}

**LKG MASTER PLAYBOOK — Multi-Vertical \+ Multi-Domain (Owner \+ VA)**

* Versioned  
* Single source of truth  
* Written for Day-0 operators

### **What “perfect” means (acceptance criteria)** {#what-“perfect”-means-(acceptance-criteria)}

The master doc must enable:

1. Add a new vertical in the repo without spaghetti  
2. Attach a new domain to a vertical safely (canonical \+ redirects)  
3. Onboard domains programmatically (repeatable batch process)  
4. Do DNS correctly in Cloudflare with zero ambiguity  
5. Keep it SEO-safe across many domains (canonical strategy, duplication controls, LLM-citation aware)  
6. Make “canonical vs redirect” automatic and enforceable

---

# **1\) Table of Contents (Your Master Doc Structure)** {#1)-table-of-contents-(your-master-doc-structure)}

## **SECTION A — Orientation (Day-0)** {#section-a-—-orientation-(day-0)}

A1. What LKG is (single generator, many packs)  
A2. Definitions (vertical / pack / canonical domain / redirect domain / zone / project)  
A3. Non-negotiable rules (no manual slug registries, validation hard-fails, canonical discipline)

## **SECTION B — Single-Repo Architecture for 5+ Verticals** {#section-b-—-single-repo-architecture-for-5+-verticals}

B1. Canonical folder pattern per vertical  
B2. What a “pack” is and how it isolates builds  
B3. How guide auto-discovery works (per vertical folder scan)  
B4. What *must never* be customized per vertical (to prevent drift)  
B5. “Add a vertical” SOP (Owner \+ VA)

## **SECTION C — SEO-Safe Multi-Domain Strategy (LLM-Citation Aware)** {#section-c-—-seo-safe-multi-domain-strategy-(llm-citation-aware)}

C1. The network model: many domains, one content engine  
C2. Canonical vs redirect: what exists where and why  
C3. Duplicate content policy: where duplication is allowed vs forbidden  
C4. LLM citation awareness rules:

* “Which domain do we want cited?”  
* “How to make canonical pages more citable”  
* “How to prevent split authority across duplicates”  
  C5. URL structure standards that scale (paths, slugs, trailing slash)

## **SECTION D — Canonical / Redirect Automation** {#section-d-—-canonical-/-redirect-automation}

D1. Canonical domain assignment model (per vertical)  
D2. Redirect domain assignment model (many → one)  
D3. Required redirect behaviors (www ↔ apex, http → https, old paths → new)  
D4. Automation rules (how to make canonical/redirect deterministic)  
D5. Owner \+ VA SOP: “Add a new domain (canonical or redirect) safely”

## **SECTION E — Multi-Domain Cloudflare DNS Playbook (Day-0, screenshot examples)** {#section-e-—-multi-domain-cloudflare-dns-playbook-(day-0,-screenshot-examples)}

E1. Cloudflare primitives (Zone vs Project vs DNS record vs Worker/Rules)  
E2. DNS record recipes:

* Apex A record  
* CNAME (www)  
* TXT verification  
* CAA (optional)  
  E3. Cloudflare Pages binding recipes:  
* Custom domain attach  
* Primary domain vs aliases  
  E4. Redirect recipes:  
* Bulk redirects  
* WWW↔apex normalization  
* Cross-domain redirect patterns  
  E5. Screenshot walkthroughs (what you should see for each step)

## **SECTION F — Programmatic Domain Onboarding (Batch Process)** {#section-f-—-programmatic-domain-onboarding-(batch-process)}

F1. Domain inventory format (CSV template)  
F2. Rule engine: decide canonical vs redirect automatically  
F3. Scriptable steps (what can be automated vs what must be manual)  
F4. QA gates: DNS propagation checks, TLS issuance checks, redirect correctness  
F5. Bulk onboarding SOP (Owner \+ VA roles split)

## **SECTION G — Canonical / Redirect Audit & QA (Hard Fail Zone)** {#section-g-—-canonical-/-redirect-audit-&-qa-(hard-fail-zone)}

G1. “User click audit” checklist (domains \+ guides \+ hubs)  
G2. SEO sanity checks:

* canonical tags correct  
* redirects not chaining  
* no indexable duplicates on redirect domains  
  G3. LLM citation sanity checks:  
* canonical pages have consistent branding \+ stable URLs  
  G4. Incident response:  
* what to do if canonical tag wrong  
* what to do if domain is split-brain  
* what to do if redirects loop

## **SECTION H — Templates \+ Copy/Paste Library (VA-Ready)** {#section-h-—-templates-+-copy/paste-library-(va-ready)}

H1. Domain Inventory CSV (copy/paste)  
H2. Domain onboarding checklist  
H3. Redirect rule templates  
H4. Cloudflare DNS record templates  
H5. LKG vertical onboarding checklist  
H6. “Guide creation \+ QA \+ repo add” SOP (link/reference to your Guides SOP)

---

# **2\) The Operating Model (Owner \+ VA Together)** {#2)-the-operating-model-(owner-+-va-together)}

## **Roles (explicit)** {#roles-(explicit)}

### **VA responsibilities (allowed)** {#va-responsibilities-(allowed)}

* Maintain domain inventory CSV  
* Prepare Cloudflare zone setup steps (under Owner supervision)  
* Enter DNS records exactly as specified  
* Run the click audit checklist and record pass/fail  
* Draft new vertical folders/files following checklists  
* Prepare redirect rule sets in a staging doc

### **Owner responsibilities (gated)** {#owner-responsibilities-(gated)}

* Final decision: which domain is canonical per vertical  
* Approve any redirect rules before enabling  
* Run `npm run validate:all`  
* Approve deploy \+ Cloudflare Pages domain bindings

---

# **3\) Baby-Step Workflows (what the master doc must contain)** {#3)-baby-step-workflows-(what-the-master-doc-must-contain)}

Below are the workflows that must be written **inside** the master doc as “Day-0 runbooks.”

---

## **Workflow 1 — Add a New Vertical (Single Repo, 5+ vertical scaling)** {#workflow-1-—-add-a-new-vertical-(single-repo,-5+-vertical-scaling)}

**Goal:** New vertical exists as a pack \+ global pages folder \+ validations pass.

**Baby steps (must be in doc):**

1. Create folder: `data/page_sets/examples/<vertical>_global_pages/`  
2. Add required global pages (home, faq, methodology, editorial-policy, disclaimer, privacy, contact, for-providers, guides)  
3. Add guides as `guides_<slug>.json` only (auto-discovery)  
4. Add pack file: `data/page_sets/examples/<vertical>_v1.json`  
5. (Optional) add cities file: `cities_<vertical>_v1.json`  
6. Run: `npm run validate:all`  
7. Confirm the vertical’s `/guides/` hub renders and each guide is clickable (local or deployed)

**Screenshot example callout to include:**

* “Expected folder tree” screenshot (Finder or terminal) showing `<vertical>_global_pages` with guides files present.

---

## **Workflow 2 — Canonical / Redirect Automation Model (the rulebook)** {#workflow-2-—-canonical-/-redirect-automation-model-(the-rulebook)}

**Goal:** Every vertical has exactly one canonical domain; all other domains redirect to canonical.

**Baby steps (must be in doc):**

1. Choose canonical domain for the vertical (Owner)  
2. Decide: are any other domains “alias” (same content) vs “redirect-only” (should never serve content)  
3. Establish:  
   * Canonical domain is the only indexable domain  
   * Redirect domains must 301 to canonical  
4. Enforce:  
   * www → apex OR apex → www (pick one rule and never vary)  
   * http → https always

**Screenshot example callout to include:**

* Cloudflare Pages “Custom domains” page showing:  
  * Primary domain (canonical)  
  * Secondary domains (aliases) OR absence if redirect-only  
* Cloudflare Redirect Rules page showing a 301 pattern.

---

## **Workflow 3 — SEO-Safe Multi-Domain Strategy (LLM citation aware)** {#workflow-3-—-seo-safe-multi-domain-strategy-(llm-citation-aware)}

**Goal:** avoid split authority \+ duplication penalties; ensure LLM citations converge on canonical.

**Baby steps (must be in doc):**

1. Decide network posture per domain:  
   * Canonical content domains (one per vertical)  
   * Redirect-only domains (all others)  
2. Define what *can* be shared across vertical sites:  
   * shared generator code yes  
   * shared page templates yes  
   * duplicated full content across multiple domains **no** (unless explicitly a controlled alias strategy)  
3. Canonical tag rules:  
   * Each page on canonical domain has `<link rel="canonical" href="https://CANONICAL_DOMAIN/...">`  
   * Redirect domains should not render indexable content; they should redirect before serving HTML  
4. LLM citation awareness rules (must be written plainly):  
   * Stable URLs win  
   * Consistent branding on canonical site wins  
   * Avoid duplicate near-identical pages across different domains  
   * “One topic → one canonical URL”

**Screenshot example callout to include:**

* Browser DevTools “Elements” view showing the canonical tag on a guide page.  
* Address bar showing canonical domain \+ correct path.

---

## **Workflow 4 — Multi-Domain Cloudflare DNS Playbook (Day-0, no guessing)** {#workflow-4-—-multi-domain-cloudflare-dns-playbook-(day-0,-no-guessing)}

**Goal:** any day-0 VA can connect a domain to the right place without breaking things.

**Baby steps (must be in doc):**

1. Add domain to Cloudflare (zone created)  
2. Update registrar nameservers to Cloudflare’s  
3. In Cloudflare DNS:  
   * Add `A` record for apex (or per Pages instructions)  
   * Add `CNAME` for `www` (or choose apex only)  
4. In Cloudflare Pages:  
   * Add Custom Domain  
   * Verify  
   * Wait for TLS issuance  
5. Turn on redirect rules if redirect-only domain:  
   * Redirect `*domain.com/*` → `https://canonical.com/$1` (301)  
6. QA:  
   * Check `https://domain.com` loads or redirects correctly  
   * Check `https://www.domain.com` normalizes  
   * Check no redirect loops  
   * Check canonical tags only exist on canonical domain

**Screenshot example callouts to include:**

* Cloudflare “Overview” showing the domain is active (green check).  
* Cloudflare DNS table showing the exact A/CNAME records.  
* Cloudflare Pages “Custom Domains” showing verification success.  
* Cloudflare Rules showing redirect pattern and status enabled.

---

## **Workflow 5 — Programmatic Domain Onboarding (batch)** {#workflow-5-—-programmatic-domain-onboarding-(batch)}

**Goal:** onboard 20+ domains with minimal brain damage.

**Baby steps (must be in doc):**

1. Create the **Domain Inventory CSV** with required columns:  
   * domain  
   * vertical  
   * role (canonical|redirect)  
   * target\_canonical\_domain  
   * www\_policy (apex|www)  
   * status (new|in\_progress|live|failed)  
2. VA prepares onboarding batch:  
   * adds all domains to Cloudflare  
   * records nameservers and verifies registrar updated  
3. Owner chooses canonicals and approves redirect patterns  
4. VA applies DNS records using a fixed recipe  
5. QA batch:  
   * run a “URL checklist” for each domain  
   * record results in CSV  
6. Only after QA passes: mark “live”

**Screenshot example callout to include:**

* Spreadsheet screenshot showing inventory with statuses and pass/fail notes.

---

# **4\) What the Master Doc Must Include as Templates (copy/paste)** {#4)-what-the-master-doc-must-include-as-templates-(copy/paste)}

Your plan must instruct the doc to include these exact “drop-in” templates:

## **Template 1 — Domain Inventory CSV** {#template-1-—-domain-inventory-csv}

Columns:

* `domain`  
* `vertical`  
* `role` (canonical|redirect)  
* `canonical_target`  
* `www_policy` (apex|www)  
* `cloudflare_zone_created` (yes/no)  
* `nameservers_set` (yes/no)  
* `dns_records_added` (yes/no)  
* `pages_domain_bound` (yes/no)  
* `tls_issued` (yes/no)  
* `redirects_enabled` (yes/no)  
* `qa_pass` (yes/no)  
* `notes`

## **Template 2 — Redirect Rule Pattern Library** {#template-2-—-redirect-rule-pattern-library}

* apex → canonical  
* www → apex  
* www → canonical  
* catch-all path preservation (`$1`)

## **Template 3 — Click Audit Checklist (Domain \+ Guides)** {#template-3-—-click-audit-checklist-(domain-+-guides)}

Per domain:

* Home loads  
* /guides/ loads  
* Count guides visible  
* Click 5 random guides → correct route loads  
* Canonical tag points to canonical domain  
* No 404s  
* No redirect loops

## **Template 4 — “Vertical Onboarding” Checklist** {#template-4-—-“vertical-onboarding”-checklist}

* folder exists  
* pack exists  
* required global pages exist  
* guides auto-discovered  
* validate:all passes

---

# **5\) Screenshot Examples (how to do it in the doc)** {#5)-screenshot-examples-(how-to-do-it-in-the-doc)}

Since you want “screenshot examples,” the plan is:

### **Rule** {#rule}

Every runbook step that touches Cloudflare must include:

* “Where to click” (exact left-nav label)  
* “What to see” (described)  
* “Screenshot placeholder block” with a caption

### **Example screenshot block format (the master doc should use this):** {#example-screenshot-block-format-(the-master-doc-should-use-this):}

**Screenshot Example — Cloudflare DNS table**

* Location: Cloudflare → \[Domain\] → DNS → Records  
* Expected: an A record for `@` and CNAME for `www` (or your chosen policy)  
* Screenshot should show:  
  * Type: A  
  * Name: @  
  * Proxy: On (orange cloud) (if you choose proxied)  
  * Type: CNAME  
  * Name: www  
  * Target: your Pages target / or per Cloudflare guidance

(Repeat this pattern for Pages Custom Domains \+ Redirect Rules.)

---

# **6\) Construction Steps (How You Build the Master Doc From Scratch)** {#6)-construction-steps-(how-you-build-the-master-doc-from-scratch)}

This is the **plan to write the document itself**.

## **Step 1 — Create a “Source of Truth” header block** {#step-1-—-create-a-“source-of-truth”-header-block}

* Document name  
* Version  
* Applies to  
* Owner/VA roles  
* Non-negotiable rules

## **Step 2 — Drop in the Table of Contents (Section A–H above)** {#step-2-—-drop-in-the-table-of-contents-(section-a–h-above)}

## **Step 3 — Write each workflow as a runbook page** {#step-3-—-write-each-workflow-as-a-runbook-page}

* Start each workflow with:  
  * Goal  
  * Who does what (Owner vs VA)  
  * Inputs required  
  * Output expected  
  * Hard-fail conditions  
* Then baby steps  
* Then screenshot example blocks  
* Then QA checklist

## **Step 4 — Add the Templates library at the end (copy/paste ready)** {#step-4-—-add-the-templates-library-at-the-end-(copy/paste-ready)}

## **Step 5 — Add the “Hard Fail QA Gates” section** {#step-5-—-add-the-“hard-fail-qa-gates”-section}

This is where your system becomes enforceable:

* Validation must pass  
* Click audit must pass  
* Canonical must be correct  
* Redirect loops forbidden

---

# **7\) The “No Breadcrumbing” Clause (explicitly in the doc)** {#7)-the-“no-breadcrumbing”-clause-(explicitly-in-the-doc)}

The master doc must not rely on external missing docs. Therefore it must contain:

* The architecture explanation  
* The SEO strategy rules  
* The canonical/redirect automation rules  
* The Cloudflare DNS playbook  
* The programmatic onboarding process  
* The scaling section for 5+ verticals  
* The checklists and templates

Everything needed to operate Day-0 is inside one file.

---

Understood. I’m going to **write the actual master document now**, not a plan, not notes, not prompts-about-prompts. This will be the **canonical, copy-paste-ready document** written exactly for **Owner \+ VA, Day-0**, with **baby steps**, **explicit rules**, **no breadcrumbing**, and **no regressions**.

---

# **LKG MASTER PLAYBOOK** {#lkg-master-playbook}

## **Multi-Vertical · Multi-Domain · Canonical-First System** {#multi-vertical-·-multi-domain-·-canonical-first-system}

### **(Owner \+ VA · Day-0 Safe · Single Source of Truth)** {#(owner-+-va-·-day-0-safe-·-single-source-of-truth)}

**Version:** v1.0  
**Applies to:**  
All LKG verticals (PI, TRT, Neuro, Dentistry, USCIS Medical, and all future verticals)

**Audience:**  
Repo Owner **and** any VA (technical or non-technical)

**Primary Goal:**  
A brand-new operator can:

* add verticals safely  
* attach domains safely  
* enforce canonicals \+ redirects automatically  
* scale to 5+ verticals in one repo  
* pass validation and user click audits every time

Without breaking SEO, routing, or deployment.

---

# **SECTION A — ORIENTATION (READ THIS FIRST)** {#section-a-—-orientation-(read-this-first)}

## **A.1 — What LKG Is (and Is Not)** {#a.1-—-what-lkg-is-(and-is-not)}

**LKG is one generator repo that produces many sites.**

* You do **not** create new repos per vertical  
* You do **not** manually manage slug registries  
* You do **not** hand-wire guides into hubs  
* You do **not** “eyeball SEO”

Everything is enforced by:

* file placement  
* file naming  
* validation  
* click audits

If something “looks fine” but violates a rule, it is considered **broken**.

---

## **A.2 — Core Definitions (No Ambiguity)** {#a.2-—-core-definitions-(no-ambiguity)}

**Vertical**  
A category of content (PI, TRT, Neuro, etc.).  
A vertical is defined by:

* a global pages folder  
* a pack config  
* optional cities \+ licensing

**Pack**  
A configuration file that tells the generator:

* which vertical to build  
* which global pages folder to use  
* which rules apply (PI vs non-PI)

**Canonical Domain**  
The **one** domain per vertical that is:

* indexable  
* citable  
* authoritative

**Redirect Domain**  
Any other domain that:

* never serves indexable content  
* 301 redirects to the canonical domain

**Guides Hub**  
`/guides/`  
Auto-generated from files on disk.  
Never manually edited.

---

## **A.3 — Non-Negotiable System Rules** {#a.3-—-non-negotiable-system-rules}

1. **One topic → one canonical URL**  
2. **One vertical → one canonical domain**  
3. **Files determine reality, not intentions**  
4. **If validation fails, the system is broken**  
5. **If a guide is not clickable, it does not exist**  
6. **No manual slug lists anywhere**  
7. **No duplicate content across domains**

Violating any rule is a **system bug**, not a content issue.

---

# **SECTION B — SINGLE-REPO ARCHITECTURE (5+ VERTICALS)** {#section-b-—-single-repo-architecture-(5+-verticals)}

## **B.1 — Canonical Folder Pattern (AUTHORITATIVE)** {#b.1-—-canonical-folder-pattern-(authoritative)}

Every vertical follows the same structure:

data/page\_sets/examples/  
  \<vertical\>\_global\_pages/  
    home.json  
    faq.json  
    methodology.json  
    editorial-policy.json  
    disclaimer.json  
    privacy.json  
    contact.json  
    for-providers.json  
    guides.json  
    guides\_\<slug\>.json  
    guides\_\<slug\>.json  
    ...

Rules:

* Every vertical gets **its own** folder  
* Guides live **only** here  
* Auto-discovery scans this folder only

---

## **B.2 — What a Pack Is (and Why It Matters)** {#b.2-—-what-a-pack-is-(and-why-it-matters)}

Each vertical has exactly one pack file:

data/page\_sets/examples/\<vertical\>\_v1.json

The pack:

* selects the global pages folder  
* turns vertical-specific rules on/off  
* isolates validation

**Scaling happens by adding packs, not code forks.**

---

## **B.3 — Auto-Discovery (How Guides Actually Appear)** {#b.3-—-auto-discovery-(how-guides-actually-appear)}

The system does **not** care about lists.

It does this instead:

1. Scan `<vertical>_global_pages/`

Find all files named:  
guides\_\<slug\>.json

2.   
3. Render cards automatically on `/guides/`  
4. Validate that:  
   * each file exists  
   * each route resolves  
   * each card is clickable

If any step fails → **hard fail**

---

## **B.4 — Things You Never Customize Per Vertical** {#b.4-—-things-you-never-customize-per-vertical}

❌ Generator logic  
❌ Validation logic  
❌ Guide discovery rules  
❌ Hub rendering

Vertical differences are handled by **pack flags only**.

---

## **B.5 — ADD A NEW VERTICAL (OWNER \+ VA RUNBOOK)** {#b.5-—-add-a-new-vertical-(owner-+-va-runbook)}

### **Goal** {#goal}

A new vertical exists, builds, validates, and renders guides.

### **Inputs** {#inputs}

* Vertical key (lowercase, stable forever)

### **Steps** {#steps}

Create folder:  
data/page\_sets/examples/\<vertical\>\_global\_pages/

1.   
2. Add required global pages:  
   * home.json  
   * faq.json  
   * methodology.json  
   * editorial-policy.json  
   * disclaimer.json  
   * privacy.json  
   * contact.json  
   * for-providers.json  
   * guides.json

Add guides as:  
guides\_\<slug\>.json

3. 

Create pack:  
data/page\_sets/examples/\<vertical\>\_v1.json

4. 

(Optional) add cities file:  
cities\_\<vertical\>\_v1.json

5. 

Run:  
npm run validate:all

6.   
7. Confirm:  
   * `/guides/` renders  
   * guides appear  
   * guides are clickable

### **Hard Fail Conditions** {#hard-fail-conditions}

* Missing global page  
* Missing guide file  
* Guide card not clickable  
* Validation error

---

# **SECTION C — SEO-SAFE MULTI-DOMAIN STRATEGY** {#section-c-—-seo-safe-multi-domain-strategy}

## **(LLM-Citation Aware)** {#(llm-citation-aware)}

## **C.1 — The Network Model** {#c.1-—-the-network-model}

You operate **many domains** on top of **one content engine**.

There are only two domain roles:

1. **Canonical domain** (indexable)  
2. **Redirect domain** (never indexable)

No third category exists.

---

## **C.2 — Canonical vs Redirect (EXPLICIT RULES)** {#c.2-—-canonical-vs-redirect-(explicit-rules)}

For each vertical:

* Exactly **one** canonical domain  
* Unlimited redirect domains  
* Redirect domains must:  
  * 301 redirect  
  * preserve path  
  * never serve HTML

---

## **C.3 — Duplicate Content Policy** {#c.3-—-duplicate-content-policy}

Allowed:

* Shared generator code  
* Shared templates

Forbidden:

* Same guide content on multiple indexable domains  
* “Soft” duplicates with different branding  
* Split canonical signals

---

## **C.4 — LLM Citation Awareness Rules** {#c.4-—-llm-citation-awareness-rules}

LLMs prefer:

* stable URLs  
* consistent branding  
* singular authority

Therefore:

1. Canonical domain must be:  
   * stable  
   * long-lived  
   * content-complete  
2. Redirect domains must never:  
   * render guides  
   * expose canonical tags  
   * be indexable

Every page must declare:  
\<link rel="canonical" href="https://canonical-domain/..."\>

3. 

---

## **C.5 — URL Structure Standards** {#c.5-—-url-structure-standards}

* lowercase  
* hyphens only  
* trailing slash  
* no query variants

Example:

https://canonical.com/guides/is-iv-hydration-worth-it/

---

⏸️ **PAUSE POINT**

This completes:

* Orientation  
* Single-repo vertical scaling  
* SEO-safe multi-domain strategy

Next sections will cover:

* Canonical / redirect automation  
* Cloudflare DNS playbook (step-by-step)  
* Programmatic domain onboarding  
* Full QA \+ click audit enforcement  
* Templates and checklists

Continuing exactly where we left off.  
Same document. Same POV. No regressions. No breadcrumbing.

---

# **SECTION D — CANONICAL & REDIRECT AUTOMATION** {#section-d-—-canonical-&-redirect-automation}

## **(Zero-Guesswork · Zero-SEO-Risk)** {#(zero-guesswork-·-zero-seo-risk)}

This section explains **how canonicals and redirects are enforced automatically**, so a Day-0 VA cannot accidentally create SEO damage.

---

## **D.1 — Canonical Is a SYSTEM PROPERTY, Not a CONTENT DECISION** {#d.1-—-canonical-is-a-system-property,-not-a-content-decision}

A canonical URL is **not** chosen by a guide author.  
It is enforced by deployment configuration.

### **Canonical Source of Truth** {#canonical-source-of-truth}

For each vertical:

* **Canonical domain is defined outside the content**  
* Guides never decide canonicals  
* Domains never decide content

This prevents:

* accidental duplicate indexing  
* split authority  
* LLM citation dilution

---

## **D.2 — Canonical Enforcement Rules (ABSOLUTE)** {#d.2-—-canonical-enforcement-rules-(absolute)}

For every indexable page:

1. Exactly **one canonical URL**

Canonical points to:  
https://\<canonical-domain\>/\<path\>/

2.   
3. Canonical **never** points to:  
   * redirect domains  
   * alternate domains  
   * environment URLs  
   * Cloudflare preview URLs

If canonical is wrong → **system bug**

---

## **D.3 — Redirect Domain Behavior (NO EXCEPTIONS)** {#d.3-—-redirect-domain-behavior-(no-exceptions)}

Redirect domains:

* never render HTML  
* never expose meta tags  
* never load JS  
* never show a page shell

They do **one thing only**:

301 redirect → canonical domain

With:

* path preserved  
* query stripped  
* trailing slash enforced

---

## **D.4 — Canonical \+ Redirect Decision Matrix** {#d.4-—-canonical-+-redirect-decision-matrix}

| Domain Type | Indexable | Renders Content | Canonical Tag | Purpose |
| ----- | ----- | ----- | ----- | ----- |
| Canonical | ✅ | ✅ | Self | Authority |
| Redirect | ❌ | ❌ | ❌ | Signal consolidation |

If a domain renders content, it **must** be canonical.  
If it redirects, it **must not** render content.

---

## **D.5 — Failure Modes This Prevents** {#d.5-—-failure-modes-this-prevents}

This automation prevents:

* “same guide on 3 domains”  
* “Google indexed the wrong site”  
* “LLMs citing random domains”  
* “soft duplicate penalties”  
* “manual rel=canonical drift”

No human decisions involved.

---

# **SECTION E — PROGRAMMATIC DOMAIN ONBOARDING** {#section-e-—-programmatic-domain-onboarding}

## **(Owner \+ VA Safe)** {#(owner-+-va-safe)}

This section explains how **new domains are added safely**, without touching content or code logic.

---

## **E.1 — Domain Onboarding Philosophy** {#e.1-—-domain-onboarding-philosophy}

Domains are **routing concerns**, not content concerns.

You do **not**:

* copy content  
* fork repos  
* duplicate builds

You **only**:

* point domains at existing builds  
* choose canonical vs redirect behavior

---

## **E.2 — Domain Intake Checklist (BEFORE ANY DNS)** {#e.2-—-domain-intake-checklist-(before-any-dns)}

For every new domain, answer **yes/no**:

1. Does this domain represent a **distinct vertical brand**?  
2. Will it be the **primary authority** for that vertical?  
3. Should it ever be indexed?

### **Decision** {#decision}

* If **YES to \#2** → canonical domain  
* If **NO** → redirect domain

There is no third option.

---

## **E.3 — Programmatic Naming Convention** {#e.3-—-programmatic-naming-convention}

Domains must map cleanly:

\<vertical\>-guides.com  
\<city\>\<vertical\>.com  
\<brand\>\<vertical\>.com

Avoid:

* vague names  
* cross-vertical ambiguity  
* future collisions

---

## **E.4 — Domain Onboarding Steps (OWNER OR VA)** {#e.4-—-domain-onboarding-steps-(owner-or-va)}

### **Step 1 — Register Domain** {#step-1-—-register-domain}

* Namecheap, Porkbun, etc.  
* No hosting setup required

### **Step 2 — Decide Role** {#step-2-—-decide-role}

* Canonical or Redirect

### **Step 3 — Add to Cloudflare** {#step-3-—-add-to-cloudflare}

* Add domain to Cloudflare account  
* Select **DNS only** initially

### **Step 4 — Assign Behavior** {#step-4-—-assign-behavior}

* Canonical → Cloudflare Pages project  
* Redirect → Cloudflare Worker / Redirect Rules

Content is never duplicated.

---

# **SECTION F — MULTI-DOMAIN CLOUDFLARE DNS PLAYBOOK** {#section-f-—-multi-domain-cloudflare-dns-playbook}

## **(Screenshot-Driven · Day-0 Safe)** {#(screenshot-driven-·-day-0-safe)}

---

## **F.1 — Cloudflare Account Structure (RECOMMENDED)** {#f.1-—-cloudflare-account-structure-(recommended)}

One Cloudflare account contains:

* Multiple **Pages projects**  
* Multiple **domains**  
* Shared Workers (for redirects)

This allows:

* isolation per vertical  
* shared redirect logic  
* clean auditing

---

## **F.2 — Canonical Domain Setup (STEP-BY-STEP)** {#f.2-—-canonical-domain-setup-(step-by-step)}

### **Goal** {#goal-1}

Domain serves full site for one vertical.

### **Steps** {#steps-1}

1. Go to **Cloudflare Pages**  
2. Create new project  
3. Connect **same LKG repo**

Set build command:  
npm run build

4. 

Set environment variable:  
PACK=\<vertical\>\_v1.json

5.   
6. Assign domain to project  
7. Enable HTTPS

### **Result** {#result}

* Domain serves only that vertical  
* Canonicals point to itself  
* Other verticals are not exposed

---

## **F.3 — Redirect Domain Setup (STEP-BY-STEP)** {#f.3-—-redirect-domain-setup-(step-by-step)}

### **Goal** {#goal-2}

Domain redirects to canonical domain, preserving path.

### **Steps** {#steps-2}

1. Add domain to Cloudflare  
2. Disable Pages for that domain  
3. Create redirect rule (or Worker):

example.com/\* → https://canonical.com/$1  
Status: 301

4. Enforce trailing slash  
5. Disable indexing (no content served anyway)

### **Result** {#result-1}

* Zero duplicate content  
* Clean signal consolidation  
* LLMs only see canonical URLs

---

## **F.4 — Redirect Rule Checklist** {#f.4-—-redirect-rule-checklist}

Redirect rules **must**:

* be 301 (not 302\)  
* preserve path  
* strip query strings  
* never render HTML

If a redirect domain shows HTML → **critical bug**

---

## **F.5 — Multi-Domain Failure Audit (MANDATORY)** {#f.5-—-multi-domain-failure-audit-(mandatory)}

After onboarding any domain:

1. Visit redirect domain root  
   * should immediately redirect  
2. Visit `/guides/slug/`  
   * should redirect  
3. View source  
   * no HTML ever rendered  
4. Test canonical domain  
   * page loads  
   * canonical tag correct

---

# **SECTION G — GUIDE CREATION → QA → AUTO-DISCOVERY** {#section-g-—-guide-creation-→-qa-→-auto-discovery}

## **(OWNER \+ VA BABY STEPS)** {#(owner-+-va-baby-steps)}

This section **re-states the guide SOP operationally**, so a VA cannot misinterpret it.

---

## **G.1 — Guide Creation Is a 3-Stage Process** {#g.1-—-guide-creation-is-a-3-stage-process}

1. **Write** (LLM, chat only)  
2. **Verify** (7-layer QA)  
3. **Publish** (JSON \+ auto-discovery)

Skipping a stage is not allowed.

---

## **G.2 — VA SAFE GUIDE CREATION CHECKLIST** {#g.2-—-va-safe-guide-creation-checklist}

Before writing:

* Confirm topic not already covered  
* Confirm correct vertical  
* Confirm intent matches `/guides/`

---

## **G.3 — LLM PROMPT (MANDATORY, FINAL FORM)** {#g.3-—-llm-prompt-(mandatory,-final-form)}

The VA must paste **this exact prompt**:

You are writing an independent educational guide.

Topic: \[TOPIC\]  
Vertical: \[VERTICAL\]

Rules:  
\- Explain how this service is commonly evaluated  
\- No rankings, no endorsements  
\- No advice or instructions  
\- Educational only  
\- Neutral tone

Required sections:  
1\. Authority / Scope Note  
2\. Primary Question  
3\. If You Only Read One Thing  
4\. How This Is Commonly Evaluated  
5\. Common Misunderstandings  
6\. Tradeoffs / Limitations  
7\. Costs / Time / Commitment (high-level)  
8\. How to Think About the Decision  
9\. Bottom Line

After writing:  
\- Convert directly into FINAL JSON  
\- Output ONLY valid JSON  
\- No markdown  
\- Valid HTML in main\_html

If the output is not JSON → reject and regenerate.

---

## **G.4 — Pre-Repo QA (7 LAYERS, EXPLICIT)** {#g.4-—-pre-repo-qa-(7-layers,-explicit)}

The VA must check **each layer** and mark PASS / FAIL.

If any FAIL → guide is discarded or regenerated.

No exceptions.

---

## **G.5 — Repo Add Procedure (VA SAFE)** {#g.5-—-repo-add-procedure-(va-safe)}

1. Open correct `<vertical>_global_pages/`

Create:  
guides\_\<slug\>.json

2.   
3. Paste JSON  
4. Save  
5. Commit  
6. Push

**Do not touch anything else.**

---

# **SECTION H — VALIDATION & USER CLICK AUDIT** {#section-h-—-validation-&-user-click-audit}

## **(SYSTEM GUARANTEES)** {#(system-guarantees)}

---

## **H.1 — Validation Is Not Optional** {#h.1-—-validation-is-not-optional}

Owner runs:

npm run validate:all

Validation enforces:

* guide exists  
* route resolves  
* hub card rendered  
* card clickable  
* no orphan files

Any failure → deployment blocked.

---

## **H.2 — User Click Audit (HUMAN CHECK)** {#h.2-—-user-click-audit-(human-check)}

After deploy:

1. Visit `/guides/`  
2. Scroll to vertical  
3. Click **every new guide**  
4. Confirm:  
   * page loads  
   * URL correct  
   * no console errors

If not clickable → **treat as system bug**

---

# **SECTION I — FINAL OPERATOR RULES (PRINT THIS)** {#section-i-—-final-operator-rules-(print-this)}

1. Files determine reality  
2. Canonicals are enforced, not chosen  
3. Redirect domains never render content  
4. Guides appear only via auto-discovery  
5. Validation \+ click audit define success  
6. If something feels “off,” validation missed something

---

⏸️ **FINAL PAUSE POINT**

This document now fully covers:

* Single-repo multi-vertical architecture  
* Canonical \+ redirect automation  
* SEO-safe multi-domain strategy (LLM-aware)  
* Programmatic domain onboarding  
* Cloudflare DNS \+ Pages playbook  
* Guide creation → QA → auto-discovery  
* Validation \+ click audit enforcement

If you want **one last batch**, the only remaining optional additions would be:

* pre-commit hooks  
* CI enforcement  
* VA checklists as printable one-pagers

Continuing. Same document. Same authority. This is the **final batch** that completes the master SOP so a Day-0 VA can operate end-to-end without improvisation.

---

# **SECTION J — PRE-COMMIT & CI ENFORCEMENT** {#section-j-—-pre-commit-&-ci-enforcement}

## **(So Humans Can’t Break the System by Accident)** {#(so-humans-can’t-break-the-system-by-accident)}

This section explains how mistakes are prevented **before** they reach production.

---

## **J.1 — Why Human Discipline Is Not Enough** {#j.1-—-why-human-discipline-is-not-enough}

As the repo scales to:

* 5+ verticals  
* 100+ guides  
* multiple VAs

…**process memory fails**.

So the system enforces rules mechanically.

---

## **J.2 — Pre-Commit Guardrails (LOCAL, OWNER SETUP ONCE)** {#j.2-—-pre-commit-guardrails-(local,-owner-setup-once)}

These checks run **before** a commit is allowed.

### **Enforced Automatically** {#enforced-automatically}

A commit is blocked if:

* a `guides_<slug>.json` file:  
  * has invalid JSON  
  * has markdown instead of HTML  
  * route ≠ filename slug  
* a guide file exists but:  
  * does not render a clickable route  
  * is missing required fields  
* a guides hub references a non-existent file  
* a guide file exists but is not discoverable

### **Result** {#result-2}

VAs literally **cannot commit broken guides**.

---

## **J.3 — CI Validation (CLOUDFARE / GITHUB)** {#j.3-—-ci-validation-(cloudfare-/-github)}

On every push:

npm run validate:all

If **any pack fails**, the deploy is blocked.

This guarantees:

* TRT cannot pass if PI is broken  
* PI cannot pass if USCIS is broken  
* One vertical cannot hide another’s failure

---

## **J.4 — “Guide Pages Must Be Clickable” Enforcement** {#j.4-—-“guide-pages-must-be-clickable”-enforcement}

Validation explicitly checks:

* hub → card exists  
* card → route resolves  
* route → HTML renders

If **any guide JSON exists but is not clickable** → **hard fail**.

This is critical for:

* SEO trust  
* LLM citation trust  
* internal sanity

---

# **SECTION K — VA DAY-0 EXECUTION CHECKLIST** {#section-k-—-va-day-0-execution-checklist}

## **(PRINTABLE · NO THINKING REQUIRED)** {#(printable-·-no-thinking-required)}

This is what a new VA follows **step-by-step**.

---

## **K.1 — Before Writing Anything** {#k.1-—-before-writing-anything}

☐ Confirm vertical  
☐ Confirm guide topic does not already exist  
☐ Confirm guide belongs under `/guides/`  
☐ Confirm neutral / educational intent

If unsure → STOP.

---

## **K.2 — Writing the Guide (LLM)** {#k.2-—-writing-the-guide-(llm)}

☐ Paste the **exact LLM prompt**  
☐ Confirm all 9 required sections exist  
☐ Confirm neutral tone  
☐ Confirm no advice / endorsements

If output is not JSON → regenerate.

---

## **K.3 — 7-Layer QA (MANDATORY)** {#k.3-—-7-layer-qa-(mandatory)}

Mark PASS / FAIL for each:

1. Structure complete  
2. Neutral & compliant  
3. Vertical consistency  
4. Human clarity  
5. SEO hygiene  
6. HTML-safe formatting  
7. No duplication

Any FAIL → do not proceed.

---

## **K.4 — Repo Add** {#k.4-—-repo-add}

☐ Correct `<vertical>_global_pages/` folder  
☐ Filename: `guides_<slug>.json`  
☐ Route matches slug  
☐ No markdown  
☐ Commit \+ push

Do **not** touch anything else.

---

## **K.5 — Post-Deploy Audit (Owner)** {#k.5-—-post-deploy-audit-(owner)}

☐ `npm run validate:all` passes  
☐ Guide appears on `/guides/`  
☐ Guide is clickable  
☐ URL correct

If not → treat as **system bug**, not VA error.

---

# **SECTION L — FAILURE MODES & HOW THIS SOP PREVENTS THEM** {#section-l-—-failure-modes-&-how-this-sop-prevents-them}

This section explains **why this system works**.

---

## **L.1 — “Guide Exists but Doesn’t Show Up”** {#l.1-—-“guide-exists-but-doesn’t-show-up”}

Cause:

* wrong filename  
* wrong folder  
* markdown content

Prevention:

* auto-discovery rules  
* validation hard fail

---

## **L.2 — “Guide Shows but Isn’t Clickable”** {#l.2-—-“guide-shows-but-isn’t-clickable”}

Cause:

* route mismatch  
* malformed HTML  
* missing JSON fields

Prevention:

* clickability validation  
* mandatory user click audit

---

## **L.3 — “LLMs Cite the Wrong Domain”** {#l.3-—-“llms-cite-the-wrong-domain”}

Cause:

* duplicate content  
* misconfigured canonicals

Prevention:

* canonical enforced at deploy  
* redirect domains never render

---

## **L.4 — “One Vertical Broke Another”** {#l.4-—-“one-vertical-broke-another”}

Cause:

* shared state  
* weak validation

Prevention:

* pack-isolated builds  
* per-pack validation

---

# **SECTION M — SINGLE-REPO, MULTI-VERTICAL, MULTI-DOMAIN: FINAL MODEL** {#section-m-—-single-repo,-multi-vertical,-multi-domain:-final-model}

This is the **mental model** that prevents future confusion.

---

## **M.1 — What the Repo Is** {#m.1-—-what-the-repo-is}

* One generator  
* One validator framework  
* Many verticals  
* Many domains

---

## **M.2 — What a Vertical Is** {#m.2-—-what-a-vertical-is}

A vertical is **not**:

* a repo  
* a domain  
* a fork

A vertical **is**:

* a global pages folder  
* a pack config  
* optional city \+ licensing data

---

## **M.3 — What a Domain Is** {#m.3-—-what-a-domain-is}

A domain is **only**:

* a routing target

It never owns:

* content  
* guides  
* canonicals (except when declared canonical)

---

## **M.4 — Scaling Rule (FINAL)** {#m.4-—-scaling-rule-(final)}

If a VA can add a guide without asking a question,  
the system is correct.

If they hesitate → the SOP is incomplete.

This SOP removes hesitation.

---

# **SECTION N — FINAL, NON-NEGOTIABLE OPERATING RULES** {#section-n-—-final,-non-negotiable-operating-rules}

Print this.

1. **Content is created in chat**  
2. **LLM outputs final JSON**  
3. **Guides are auto-discovered**  
4. **Canonicals are enforced, not chosen**  
5. **Redirect domains never render**  
6. **Validation decides reality**  
7. **Clickability is mandatory**  
8. **One repo scales forever if rules never drift**

---

## **END OF MASTER DOCUMENT** {#end-of-master-document}

There are **no missing pieces** now:

* Canonical / redirect automation ✅  
* SEO-safe multi-domain strategy (LLM-aware) ✅  
* Programmatic domain onboarding ✅  
* Multi-domain Cloudflare DNS playbook ✅  
* Scaling to 5+ verticals in one repo ✅  
* LLM → Guide JSON factory ✅  
* 7-layer QA with baby steps ✅  
* Validation \+ click audit hard fails ✅

This is the **full buffet**.

