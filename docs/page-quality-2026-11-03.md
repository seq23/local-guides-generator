# Local Guides page-quality diagnosis — 2026-11-03
Live sitemap audit: fetched every listed URL (1,052 pages), no fetch failures.
Shared text = mean pairwise Dice overlap of five-word shingles in main content, 10 evenly spaced guide samples/site (45 pairs/site).
Site | live sitemap URLs | shared text | live pages under 300 words | built kept URLs | new 301s
uscisexam.com | 186 | 24.9% | 4 protected | 185 | 1
theaccidentguides.com | 263 | 34.3% | 4 protected | 264 | 1
neuroevalguides.com | 203 | 30.4% | 4 protected | 196 | 7
hormonesivhair.com | 206 | 33.0% | 4 protected | 204 | 2
memphisseniorcarehomes.com | 194 | 16.6% | 3 protected | 194 | 0
The 10 sampled guides/site had no live pages below 300 words; template padding concealed thin source content.
Protected thin URLs: contact/editorial-policy on every site; privacy/disclaimer on the first four; Memphis binder hub. All retained.
PI current source includes two pages absent from the live sitemap; this change adds no new guides, so built count is live + 2 - 1.
Near-duplicate clusters: USCIS I-693 requirements/document checklist; PI client case costs/contingency fees; neuro testing/neuropsychological testing overview; hair botox/hair botox for hair loss.
Thin source clusters after boilerplate removal: ADHD therapist selection/questions, adult ADHD/general ADHD assessment, progress/ADHD follow-up, adult autism/screening-assessment, autism therapy settings/provider questions/follow-up, PRP/hair-loss treatment options.
All 11 retired source bodies were retained as sections in related survivors; source files and taxonomy entries removed; incoming redirects flattened.
Memphis guides answer distinct care, licensing, funding and agreement decisions and retain sourced local supply. No evidence supports further consolidation.
Search evidence: data/search_intelligence/<host>/ contains GSC exports, coverage, measured target queries and consolidation ledgers (2026-10-01 through 2026-10-28).
No GSC export row is absence of observed impressions in that snapshot, not proof of no future demand.
Existing candidate ledgers are stale for several recently expanded guides; no automatic folding by their old word counts or generic hub suggestions.
Root cause: canonical guides included editorial instructions and shared paragraphs; renderer repeated best/key answers in summary, opening and custom-core blocks.
Repair: canonical copy cleanup, one source-derived opening, topic definitions in existing registry, visible source-derived FAQs, real company publisher byline, preserved sources and content dates.
Reviewed retained inventory: data/page_quality/kept_guides.json; fixed count floor replaced by exact route membership plus zero-items guard.
All redirects are generated from pack legacyRedirects; prewrite checks reject retired sources/chains, and compiled navigation resolves to final targets.
Referenced page-shape.md was absent; the explicit page shape in the owner request was used.
Branch started clean at 5170e4b; no WIP commit was present to squash.
Validation dependency: pinned search-loop to v1.2.6 (569a5be); the moving v1 reference removed the pace API this adapter uses. Both runtime and test workflows use the same immutable revision.
Legacy upgrade writers now retain authored bodies and skip retired seeds instead of synthesizing the old shared profiles.
Validation: all six packs passed build/core and 71 hard-fail checks each; clean-commit runtime build and validate:all passed; 243 tests passed, zero skips; freshness ledger unchanged on rebuild.
