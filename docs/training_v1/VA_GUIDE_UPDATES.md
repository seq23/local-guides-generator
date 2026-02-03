# VA Guide Updates — How to add/edit guide content safely

Last updated: 2026-02-02

This is the **operational** checklist for updating guides without breaking the site.

---

## 1) Where guides live

Guides are JSON files inside a vertical’s global pages folder:

- `data/<vertical>_global_pages/`

A file is a guide if its JSON contains a route like:

- `/guides/<slug>/`

Examples of vertical folders:

- `data/pi_global_pages/`
- `data/neuro_global_pages/`
- `data/trt_global_pages/`
- `data/dentistry_global_pages/`
- `data/uscis_medical_global_pages/`

---

## 2) Allowed edits (safe)

You may edit:

- `title`
- `description`
- the guide body fields (sections/blocks) **as defined by the current guide schema**
- factual content, headings, bullet lists, etc.

You must keep:

- `route` stable (do not change unless you are told to)
- the file in the same folder

---

## 3) Forbidden edits (do not do)

- Do not rename routes
- Do not move guide files into other folders
- Do not edit build scripts or templates
- Do not change sponsorship/buyout logic

---

## 4) After you edit a guide

Run the guide sync script (this updates the hub + normalized filenames):

- `node scripts/sync_guides.js`

Then run build + validation:

- `npm run build:all`

If a validation fails, stop and report the exact failure output.

---

## 5) “Looks wrong” troubleshooting

If a guide:

- appears on the hub but the page styling looks wrong  
  → that is a **template/CSS problem**, not a guide content problem.

If a guide:

- does not appear on the hub  
  → confirm folder + route format, then re-run `sync_guides`.

---

## 6) Quick QA checklist for a single guide update

- [ ] Route still starts with `/guides/`
- [ ] Title reads cleanly on-page
- [ ] Description is 1–2 sentences and not spammy
- [ ] No obvious typos
- [ ] Page builds without errors
