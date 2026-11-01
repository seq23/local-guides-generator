# Free family binders

`data/binders/binders.json` is the canonical worksheet content. The renderer
`scripts/lib/senior_binders.js` uses it for `/resources/binders/`, `/resources/binders/parent/` and
`/resources/binders/move-in/`, and for both committed PDFs in `assets/binders/`.
After changing worksheets, run `npm run binders:generate`. No browser, network,
paid service or package installation is needed. Every worksheet must fit US Letter;
the generator validates all pages before writing either PDF. The senior build
checks the committed PDF bytes against the source before clearing output.

The senior-living search-loop action and header point to `/resources/binders/`. The ten
paperwork topics in `search-loop.config.json` inherit that same action. Current
senior guides render their existing intake token as the binder action; the
request-assistance page retains its working matching form. Lead health checks use
`lead.page_url` independently of the download action.

## Read downloads after 4–6 weeks

Use the existing protected report:
`GET https://memphisseniorcarehomes.com/api/senior-funnel?days=42` with header
`x-senior-tick-token` using the existing runtime secret. Read `binder_downloads`:
each row gives `binder_id`, `source_page` and `downloads`. Sum `downloads` by binder
or across rows. The default is seven days; use `days=28` or `days=42` for the test.
The same counts are available read-only in the Cloudflare D1 console:

```sql
SELECT json_extract(detail, '$.binder_id') AS binder_id,
       json_extract(detail, '$.source_page') AS source_page,
       COUNT(*) AS downloads
FROM seat_events
WHERE event = 'binder_download'
  AND at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-42 days')
GROUP BY binder_id, source_page;
```

The PDF buttons call `/api/senior-binder-download?binder=parent` (or `move-in`).
The Function serves the existing static PDF and records `binder_download` in the
existing `SENIOR_DB.seat_events` audit store, with only binder ID and a public
source pathname. There is no schema change, lead, email, cookie, IP or health
answer in the event. Incoming query strings and fragments are discarded from
source-page attribution. Browser links carry the originating path through the
landing page; without JavaScript the landing page is the source.

A GET counts a PDF response served, not proof of a completed save or a unique
person. HEAD and speculative prefetches do not count; repeated GETs do. Direct
static-asset requests are not counted. API responses use `private, no-store` so
edge caching cannot hide download requests. If event storage fails, the PDF still
works with `X-Binder-Counted: 0` and a named error in Pages Function logs. Normal
responses have `X-Binder-Counted: 1`. No Clarity tag is added to binder pages.

The landing page is indexed and sitemapped. The two blank printable worksheet
views use the existing per-pack noindex policy: they are downloads/print views,
not extra search articles. This keeps the experiment inside the publishing
capacity gate; `npm run cadence:gate` is part of the release check.

## Offline HTML print check

The merge gate installs the pinned free renderer in
`tests/senior/print-requirements.txt` and runs
`python tests/senior/print_layout_test.py` after building all packs. It checks
rendered page count against canonical worksheets, one worksheet per page, and
that screen controls do not appear on paper. It does not pin copy or colors.
For local use, install those requirements in a Python 3.12 virtual environment;
WeasyPrint also needs Pango (the workflow installs the Linux packages).
