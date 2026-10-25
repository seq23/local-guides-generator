# local-guides-generator — read this first

This repository is the **source** for six canonical guide sites. It renders them; it does not
host hand-written pages. The full working agreement is in [AGENTS.md](AGENTS.md) — read it before
changing anything. This file is the short version of the rules that are easiest to break.

## Nothing paid

**Nothing paid.** No model call, probe, API or scheduled job in this repository may cost money.
Every model call goes through the free router (`scripts/lib/free_llm_router.mjs`) against the
`$0` models in `config/llm_routing.json`, with `max_cost_usd` at `0`; citation probes are
dispatch-only behind a `confirm_paid` input that defaults to false.

The reasoning, what used to be paid, and the receipts are in
[docs/cost/zero-paid-llm.md](docs/cost/zero-paid-llm.md). The policy is not advice: it is
enforced by `npm run validate:zero-paid-llm`, which reads both that document **and this file**
and fails if either stops stating the rule. It replays hostile fixtures on every run, so the
negative proof never goes stale.

## The sites this repo owns

The six canonical hosts are listed in [REPO_IDENTITY.md](REPO_IDENTITY.md) and configured in
`scripts/lib/pack_site_config.js`. `local-guides-citation-velocity` is a **different**
repository with an adjacent name; see REPO_IDENTITY.md before assuming the two overlap.

## Never edit `dist/`

`dist/` is generated. Fix the generator, the template (`templates/base.html`), the page set
(`data/page_sets/`) or the content data — never the rendered output, which the next build
overwrites. `REPO_IDENTITY.md` makes this a forbidden action, not a preference.

## Freshness dates come from content, never the build clock

`data/cadence/lastmod_ledger.json` records the hash and the real change date of every URL, and
`scripts/lastmod_apply.js` advances a date only when a page's content hash changed.

**If a build changes that ledger, commit the ledger in the same change.** Every deploy rebuilds
from the committed ledger and throws the working tree away, so an uncommitted ledger makes each
deploy restamp the same pages with the deploy date — which is what put a build date on ~95% of
every sitemap's URLs. Regenerate it for all six sites with `npm run lastmod:refresh`, commit it, and build again:
`npm run validate:lastmod-ledger-currency` fails the build if the
committed ledger no longer matches what the build produced.

## Validators are the contract

Add a fix, add a validator, register it in `data/contracts/validator_tiering_policy.json`, and
prove it negatively (break it, watch it fail, restore it). `npm run validate:all` is what CI
runs; `.github/workflows/validate.yml` is the merge gate and stays under five minutes.
