# Common Build and Validation Failures

## `dist/` is missing
Build the site before running dist-dependent validation.

## `PAGE_SET_FILE` is wrong
Use a page set that exists under `data/page_sets/` or the supported examples.

## Site URL contract failure
The active pack must resolve to a real canonical domain. Placeholder domains should fail.

## Airtable production guardrail failure
Production request-assistance flow requires the Airtable environment variables to be configured.

## Guide depth or routing failure
Run guide sync, inspect the vertical guide sources, and rebuild.


## Page-set path contract
Always pass `PAGE_SET_FILE` as a canonical repo-relative path under `data/page_sets/`. Do not use bare `examples/...`, `page_sets/...`, or guessed shortcuts.
