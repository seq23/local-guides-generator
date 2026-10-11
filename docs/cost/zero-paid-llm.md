# Zero paid LLM (owner policy, 11 Oct 2026)

> "nothing should be paid … cut the probes and make them free."

## What was paid before

| Call site | Run by | How often | Model | What it did | Cost (estimated from list prices) |
|---|---|---|---|---|---|
| `scripts/llm_citation_probe.mjs` step "Observe whether answer engines cite us" | `.github/workflows/rotating_refresh.yml` (cron `30 13 * * *`, plus every dispatch) | daily since 2026-08-30, 43 runs | `ibm-granite/granite-4.0-h-micro:online` (OpenRouter, grounded web search) | asked 25 priority queries and recorded whether the grounded answer cited one of our five domains | web search about $0.02/request × 25 ≈ **$0.50/day (~$15/month)**, plus token pennies |

The run history proves real spend: 1,058 of 1,075 grounded observations came back answered with cited domains (`data/signals/llm_citation_observations.json`).

No other paid call exists: the only other provider string in this repo is the Gemini path inside the same probe (never selected for a successful run) and model names inside data files.

## What it is now

- **Probe: off the schedule.** `rotating_refresh.yml` no longer runs it. It is dispatch-only in `.github/workflows/citation_probe.yml`, behind `confirm_paid` (boolean, default false; anything else is a NAMED STOP and nothing starts).
- **Even a confirmed run is free.** The probe reaches models only through `scripts/lib/free_llm_router.mjs`, in knowledge mode, on the $0 models in `config/llm_routing.json`. Grounded mode (web plugin / `:online`, billed per request) is refused by the router.
- **Router rules:** `max_cost_usd: 0`; only listed $0 models; no paid fallback; a reported non-zero `usage.cost` fails the run; no answer = named stop; a disabled or invalid key = named stop "OpenRouter key disabled or invalid; free routing needs an enabled key with a $0 limit".
- **Daily receipt:** `rotating_refresh.yml` runs `node scripts/lib/free_llm_router.mjs --ping` (one $0 call) and prints `LLM ROUTER RECEIPT`.
- **Guard:** `scripts/validation/zero_paid_llm_contract.js` (hard_fail tier, registered in `data/contracts/site_hygiene_registry.json`) checks scheduled workflows, the routing config and the probe workflow, and replays eight hostile fixtures every run.
- **Refresh the free list:** `node scripts/lib/free_llm_router.mjs --refresh` (keyless). A snapshot older than 30 days is a warning.
