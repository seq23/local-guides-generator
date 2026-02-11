# Guides Rendering — Source of Truth + Runtime Flow

Last updated: 2026-02-02

This doc explains **exactly** how guide pages get discovered, normalized, indexed, and rendered.

---

## 1) Where guide content lives (authoritative)

Guides are **drop-in JSON files** stored inside a vertical’s global pages folder:

- `data/<vertical>_global_pages/`

A file is treated as a guide when **both** are true:

1. It is a `.json` file in that folder
2. Its `route` matches the pattern:

- `/guides/<slug>/`

This behavior is implemented by:

- `scripts/sync_guides.js`

---

## 2) The “drop-in” script you asked about (safe to use)

The script that auto-discovers and normalizes guides is:

- `scripts/sync_guides.js`

What it does (high-level):

- Scans each `data/<vertical>_global_pages/` folder
- Finds JSON files whose `route` starts with `/guides/`
- Normalizes filenames to repo conventions (only when safe; never overwrites)
- Updates the vertical guides hub JSON:
  - `data/global_pages/guides.json` (or the vertical’s guides hub, if configured)
  - Ensures `guide_cards[]` includes each guide’s `route`, `title`, and `description`
- Regenerates a canonical markdown document used for indexing / QA

What it **does not** do (important):

- It **never edits guide routes**
- It **only renames files when it can do so safely**
- It does not “style” anything — it’s content plumbing only

If your guides “look wrong” on-site, the culprit is almost always **rendering templates + CSS**, not this script.

---

## 3) The guide index surface (hub)

The Guides hub page renders “cards” sourced from the hub JSON `guide_cards[]`.

The hub cards are generated/kept in sync by:

- `scripts/sync_guides.js`

So the operational rule is:

> Add or edit a guide JSON in the correct folder → run `sync_guides` → rebuild → the hub updates automatically.

---

## 4) How guide pages render (runtime)

During build, the generator loads the guide JSON and renders it into HTML.

Key runtime entrypoints you’ll see involved in this flow:

- `scripts/build_city_sites.js`
- `templates/base.html` (global frame)

The “guide page” output is built from:

- The guide JSON fields (title, sections/blocks, etc.)
- Any “rich blocks” that Guide Overhaul A introduced (the normalized schema)
- The guide styling system (CSS classes used by templates)

---

## 5) Debug checklist (when a guide page looks wrong)

1. **Confirm the JSON lives in the correct folder**
   - `data/<vertical>_global_pages/`
2. **Confirm the route is correct**
   - Must be `/guides/<slug>/`
3. **Run sync**
   - `node scripts/sync_guides.js`
4. **Confirm the guide appears on the hub**
   - `guide_cards[]` includes it
5. If the guide appears but looks visually wrong:
   - It’s a rendering/CSS issue (templates), not a discovery issue

---

## 6) VA-safe operating procedure

For a VA doing guide updates:

- Only touch `data/<vertical>_global_pages/*.json`
- Do **not** touch routes unless instructed
- Titles + descriptions must be human-readable (used on hub cards)
- After changes:
  - run `sync_guides`
  - run build/validation

See the VA training doc:

- `docs/training_v1/VA_GUIDE_UPDATES.md`
