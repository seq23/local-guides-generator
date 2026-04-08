# SOP — Sponsor Callback Routing and CTA System

Last updated: 2026-04-08

This SOP governs the three public user paths:

1. **Get Matched With a Provider** — direct callback capture
2. **Next Steps** — dedicated public decision hub page only
3. **Use Lookup Tools / Compare Options** — self-serve research path

All three paths feed the same sponsor-aware routing system. The full three-option hub and the full callback form must live only on dedicated `/next-steps/` pages.

---

## Owner decisions before launch

- Approve sponsor scope: city, state, or global
- Approve which paths the sponsor owns
- Approve CTA wording
- Approve routing destination
- Approve reporting fields

---

## VA steps when a sponsor goes live

1. Update `data/sponsor_intake/sponsors/<slug>/sponsor.json`
2. Update `data/sponsor_intake/campaigns/<campaign>.json`
3. Run sponsor apply
4. Build the repo
5. Run validation
6. Spot-check one city page, one Next Steps page, the request-assistance page, and one guide page
7. Confirm all three public paths render correctly
8. Confirm sponsor routing is attached correctly
9. Deploy only after all checks pass

---

## What each button does

### Get Matched With a Provider
- Direct callback path
- Highest-intent lead capture
- Routes through owned form with sponsor-aware tracking

### Next Steps
- Dedicated public decision hub page only
- Must show three actions: direct match, compare options, use lookup tools
- Must include the full callback form directly on the `/next-steps/` page
- Must not be rendered inline on city pages, guide pages, hub pages, or other non-`/next-steps/` surfaces
- Must remain public-facing and not expose sponsor-ops language

### Use Lookup Tools / Compare Options
- Self-serve path
- Can point to guides, FAQ, methodology, or official verification surfaces
- Still routes through the same tracking system when user converts later

---

## Validation checklist

- [ ] Direct conversion CTA shows **Get Matched With a Provider**
- [ ] Next Steps page shows all three required actions and the full callback form
- [ ] No inline page outside `/next-steps/` renders the full Next Steps hub
- [ ] Self-serve path lands on a real surface
- [ ] Sponsor-enabled pages still preserve utility and educational structure
- [ ] Tracking payload captures intent type and button source

---

## Escalate immediately if

- a button points to an empty or fake page
- sponsor language appears in the public decision hub in a way that breaks neutrality
- CTA copy reverts to old “Request Assistance” wording without approval
- validation fails


## Homepage Entity Checklist
- Exact brand string in H1, title, meta description, footer, and About block.
- Homepage intro must repeat the exact brand string at least twice naturally.
- Add branded internal links between homepage, guides, and next-steps.
- Dedicated /next-steps/ pages keep the full form; city pages keep only the middle View Your Next Steps CTA.


## Fanout / short-answer hierarchy note
- Related search paths stay in the system for fanout/query-routing and owned-route reinforcement, but they must render as a tertiary/collapsed surface below the main decision path.
- Priority answer surfaces as a visible block are retired; use the canonical Short answer layer instead.
- Recently refreshed is tertiary metadata only.
- USCIS now follows the same vertical-upgrade architecture family as PI, Dentistry, Neuro, and TRT via scripts/vertical_upgrades/uscis.js.


## 2026-04 UX + hierarchy update

- Homepage order is now hero -> primary CTA -> short answer -> about -> provider preview -> mid CTA -> FAQ entry -> state grid -> tertiary support.
- Homepages route through state hubs first. Do not add direct homepage-to-city links.
- State hubs must show covered cities and a request-city mailto to info@spry.vc.
- Provider previews and provider cards must be structured, non-ranked, and non-sponsored unless explicitly disclosed.
