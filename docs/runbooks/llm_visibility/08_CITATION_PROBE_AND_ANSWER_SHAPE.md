# 08 — Citation probe and answer shape

## Why this exists

Every statement this repo could make about AI visibility was inference from
proxies. Nothing had ever asked an answer engine a question and recorded whether
it cited us. `scripts/llm_citation_probe.mjs` is that measurement.

Alongside it, `scripts/validation/answer_shape_contract.js` enforces the shape an
answer engine can actually lift from a page. Before it, every answer block on
every page opened with the heading `Short answer`, which matches no query, and
the span underneath it was 33 words on a city page and 71 on the home page —
below the floor where a quote stands on its own, and above the ceiling where an
extractor truncates it mid-clause.

## The answer shape contract

Four properties, checked on every rendered page that carries an answer surface:

1. the heading directly above the span ends in `?` — it is the searcher's
   question, not a label;
2. the span is 40–60 words;
3. it begins inside the first 100 words of `<main>`;
4. it does not open with a pronoun pointing outside itself.

It also asserts that every page with an answer surface carries a
`recommendation_summary` block, since the same pass seats both.

Pages with no answer surface — the legal, contact and operator pages — are
counted and exempted. They have no searcher question, and inventing one for them
would be filler.

```bash
npm run validate:answer-shape        # against dist/
```

It runs in the `hard_fail` tier, so `npm run validate:all` and `npm run qa:final`
both cover it.

The spans themselves are emitted by `renderCitationSummaryZoneHtml` and
`renderDedicatedNextStepsHubHtml` in `scripts/build_city_sites.js`, composed by
`composeAnswerSpan` from sentences the page already carries. For guide pages
those sentences are the curated per-guide entries in
`data/contracts/guide_enhancement_registry.json`, which is why eight guides carry
eight different answers rather than one sentence with the title swapped in.

## The recommendation_summary block

`scripts/retrofit_recommendation_summary.js` seats a short statement of what the
page recommends, high on the page, built entirely from that page's own content.

Two rules are load-bearing:

- `BLOCK_RE` is anchored to the block's own closing `div`. A greedy version of
  this pattern in a sibling repo deleted real page content and stripped 30
  disclosed affiliate links. Do not loosen that anchor.
- Nothing is generated. A page whose recommendation cannot be located is
  reported and skipped, never given a placeholder.

It runs after `build_city_sites.js` and **before** `install_clarity.js` in both
`scripts/build_all_packs.js` and the `build` npm script. That ordering is not
cosmetic: `lastmod_apply.js` hashes the rendered page to decide whether its
content changed, so every step that mutates a page must run before the hash, and
both pipelines must hash at the same point. Running `build_all_packs.js` and then
`npm run build` must report `0 advanced` — if it reports otherwise, a mutating
step has moved.

```bash
npm run retrofit:recommendation-summary   # dry run, reports coverage and skips
```

## The citation probe

```bash
npm run probe:queries      # recompile the query set from data/community/query_compiler/
npm run probe:citations    # grounded run; needs OPENROUTER_API_KEY
```

- `data/signals/citation_probe_config.json` lists the five production hosts this
  generator publishes to. `local-guides-generator.pages.dev` is deliberately
  absent: it is the starter pack's training sandbox, and counting a citation of
  it would inflate the number.
- `data/signals/citation_probe_queries.json` is compiled from
  `data/community/query_compiler/`, so the probe measures the same queries the
  pages were written against rather than a list invented for the probe.
- Results accumulate in `data/signals/llm_citation_observations.json`, one run
  per entry with a timestamp, so a trend can be read rather than a single run
  being treated as a verdict.
- Without a key the probe exits 0 and records that it was skipped. A measurement
  tool that fails the build when it cannot measure gets removed.

### Not yet wired into CI, and why

`OPENROUTER_API_KEY` **does not exist on this repository**. `gh secret list`
returns only `GSC_SERVICE_ACCOUNT_JSON`, `GSC_SITE_URL`, `INDEXNOW_HOSTS` and
`INDEXNOW_KEY`. The secret was set on 2026-08-26 across six sibling repos —
`sprylabs-hpc-site`, `approvalprep`, `p-n-p`, `WPP-llm`,
`authority-backlink-network`, `local-guides-citation-velocity` and
`horse-legal-guide-velocity` — and this repo was missed.

A scheduled step added now would run every day and record `skipped (no_api_key)`
every day, which is worse than no step: it looks like a measurement and is not
one. So the probe is committed and runnable, and the workflow step is not.

To enable it:

```bash
gh secret set OPENROUTER_API_KEY -R seq23/local-guides-generator
```

Then add to `.github/workflows/rotating_refresh.yml`, after the existing step:

```yaml
      - name: LLM citation probe
        continue-on-error: true
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          CITATION_PROBE_MODE: grounded
        run: node scripts/llm_citation_probe.mjs --limit 30
```

`continue-on-error: true` is required: an upstream provider outage must not turn
the daily refresh red.

## Freshness dates

`scripts/reseed_lastmod_from_git.js` reseeds `data/cadence/lastmod_ledger.json`
from real git history — `lastmod` from the newest commit that touched the files a
page is rendered from, `first_seen` from the oldest commit that added one. It
refuses to run against a shallow clone, because `git log` there returns the graft
boundary for every path and would stamp one wrong date across the whole library.

It never invents a date: a URL whose sources cannot be resolved keeps its
existing entry and is listed in the report.

```bash
npm run reseed:lastmod            # dry run
npm run reseed:lastmod -- --apply
```
