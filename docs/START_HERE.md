# START HERE

## Step 1 — Required before using an LLM

Upload these two documents into the LLM session first:
1. `GLOBAL_REPOSITORY_OPERATIONS_MANUAL_v6.4_MASTER_EDITION.md`
2. `LISTINGS_MASTER_INDEX.md`

Tell the LLM to use them as governing documents for repo work.

## Step 2 — Understand the system

Read:
- `REPO_ARCHITECTURE_PRIMER.md`

Do not proceed until you understand:
- one repo powers many sites
- each Cloudflare Pages project selects its pack at build time
- source files and `dist/` are not the same thing
- the starter pack is training-only

## Step 3 — Choose your mode

### Training mode
Use the starter training pack first.

Use this mode when you are learning:
- page structure
- sponsor flows
- city-add workflows
- click-audits
- how docs, runtime, and validators fit together

### Real repo mode
Use the real repo only after you can explain:
- which files are source of truth
- which pack you are working on
- which validator or build path proves the change worked

## Step 4 — Use the prompt library

Open:
- `LLM_PROMPTS.md`

Pick the prompt that matches your task.

## Step 5 — Choose the right operational doc

### If you are a Head VA
Read:
- `HEAD_VA_OPERATIONS_RUNBOOK.md`

### If you need a short execution checklist
Read:
- `VA_QUICK_SOP.md`

### If you are adding cities
Read:
- `CITY_ADDITION_RUNBOOK.md`

### If you are activating sponsors
Read:
- `SPONSOR_ACTIVATION_RUNBOOK.md`

## Core rules

- Modify existing systems. Do not invent parallel systems.
- Validate before claiming anything is done.
- Package from the true repo root.
- Re-open the artifact before delivery.
- If you are unsure, stop and escalate.

## Important governing documents

- `GLOBAL_REPOSITORY_OPERATIONS_MANUAL_v6.4_MASTER_EDITION.md`
- `LISTINGS_MASTER_INDEX.md`
