# Admin product search — 4 November 2026

Published the website search fix to https://ipordise.com/admin.html through
GitHub Pages, latest commit f6a00fcb697e39f2e3289d4b61ba9a659e6e06a2.
GitHub reported the deployment built, and live reads verified the updated HTML,
admin script and search helper.

Search now covers both website and admin-added products by name, brand and ID.
It ignores accents, punctuation, case and word order. A Clear search button
restores results. Refreshing or saving preserves the search. Admin-added cards
are hidden rather than rebuilt when filtering, preserving entered field values.
Quoted names are escaped in search attributes. Repeated section reloads replace
their old action listeners so editing targets the current product data once.

Both admin catalog readers now follow pagination rather than exposing only the
first 50 (website) or 100 (app) products. Archived/inactive products remain in
the protected admin results and can be located for editing. Customer publication
rules are unchanged.

Validation: TypeScript and syntax checks passed; all 16 focused admin tests
passed. Regression coverage includes retrieving 201 products over three pages,
including an inactive older product, source filtering, normalized matching,
and clearing a search without losing editable values. Browser QA exercised the
actual website rendering and handlers with mocked backend fixtures at 390 and
1280 pixels: correct product edit action, matching/non-matching results, clear
search and no horizontal page overflow. No production products were modified.

App-admin updates on the existing production channel:

- 1.0.2: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/9dc810e0-c4e9-4582-b01e-cf5ca57d8e4d
- 1.0.1: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/98907daa-7de0-4683-b932-1c627a307c0f

Android, iOS and web exports succeeded. Removed the temporary compatibility
configuration after publishing; the normal app version remains 1.0.2.

## Instant-search follow-up

Added a dedicated result list directly beneath the search field. Typing filters
the complete protected catalog immediately without rebuilding the large product
cards. Each match shows its name, brand, ID and an Edit button. The listener is
registered before catalog loading, and results populate when that request
completes. Legacy price-file failures no longer prevent catalog search.

The search reads all catalog sources in one paginated load, reuses those rows
for the admin-added section, and refreshes its index after product edits. Input,
search, change and Enter are supported. Identical results stay mounted on input
blur so that clicking Edit does not lose its click to a result-list replacement.
Updated the admin script cache version to 42.

All 17 focused admin tests passed. Signed-in browser tests against the real
production catalog, with the candidate website code intercepted locally, passed
at 1280px and 390px: typing Sauvage returned two matches, clicking Edit opened
the actual DIOR SAUVAGE Eau de Parfum editor, a nonexistent query showed an empty
state, and clearing restored the catalog. No product save was performed.
