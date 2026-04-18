# REPO ARCHITECTURE PRIMER

## The short version

This system uses **one generator repo** and **multiple Cloudflare Pages projects**.

The repo contains:
- all canonical packs
- the starter training pack
- shared templates, scripts, validators, docs, and data

Each Cloudflare Pages project builds **its own site** from this same repo by using project-specific build configuration.

## The core mental model

Think of the repo like this:

**one engine -> many packs -> many sites**

The repo is the engine.
The packs define what to build.
Each Cloudflare Pages project selects one pack at build time.

## What chooses the site that gets built

Each Cloudflare Pages project selects its pack using build-time configuration such as:
- `PAGE_SET_FILE`
- `BRAND_NAME`
- `SITE_URL`

Those values tell the build which pack to render.

## Example setup

Examples of how this works in practice:

- `local-guides-generator.pages.dev` -> starter training pack
- `local-guides-generator-pi.pages.dev` -> PI pack
- `theaccidentguides.com` -> PI pack
- `local-guides-generator-dentistry.pages.dev` -> Dentistry pack
- `dentistryguides.com` -> Dentistry pack

The same pattern applies to the other verticals.

## What happens when you update the repo

When you update the baseline snapshot in terminal mode:
1. the repo source updates on GitHub
2. each Cloudflare Pages project detects the repo change
3. each project rebuilds using its own pack-selection config

That is why one repo update can trigger many site rebuilds while still keeping each site independent.

## Source vs `dist/`

This is the most important distinction:

- **Source layer** = all packs, data, templates, scripts, docs
- **`dist/` layer** = one active built output at a time in the local artifact

A packaged baseline ZIP can contain all pack source files while the included `dist/` reflects whichever pack was built last in that artifact.

For Cloudflare, the project build config is what matters. Cloudflare rebuilds from source for the selected pack.

## What the starter pack is

`starter_v1` is a training-only pack.

It exists so VAs and Head VAs can:
- practice safely
- learn the structure
- test fake cities and fake sponsors
- use LLM prompts and docs without touching production behavior

It is not a canonical revenue site.

## What the canonical packs are

The canonical vertical packs are the real site packs used for the vertical sites.

They share the same repo but remain independent because each Cloudflare Pages project selects its own pack at build time.

## Why we use one repo instead of many repos

This architecture keeps:
- shared logic in one place
- validators consistent
- docs centralized
- sponsorship and runtime systems aligned
- deployment simpler to reason about

## What a VA should remember

1. One repo powers many sites.
2. Each site is selected at build time.
3. Do not assume `dist/` means “all sites.”
4. Always check the pack-selection config when debugging.
5. Use the starter pack first for training.

## Related docs

Start with these next:
- `START_HERE.md`
- `LLM_PROMPTS.md`
- `HEAD_VA_OPERATIONS_RUNBOOK.md`
- `VA_QUICK_SOP.md`
- `GLOBAL_REPOSITORY_OPERATIONS_MANUAL_v6.4_MASTER_EDITION.md`
- `LISTINGS_MASTER_INDEX.md`
