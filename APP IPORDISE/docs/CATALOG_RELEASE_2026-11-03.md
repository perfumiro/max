# Automatic mobile catalog update — 3 November 2026

The actual mobile catalog reader returned 171 active production products without
fallback warnings. The bundled offline catalog contained 160 products; refreshed
it to 171 products and 261 enabled variants. No production product records were
changed.

Removed the Boutique New arrivals result limit of fifteen products. Full category
results now include every matching publication. Added automatic Offers refresh
every thirty seconds and on foreground return, using the existing foreground
scheduler. Silent refresh preserves the current screen and retained products;
pending loads do not update an unmounted screen.

Validation: TypeScript passed, all 23 focused catalog/shop/offer tests passed,
including a new regression exercising 22 New arrivals results. Full suite with
two workers: 292 passed, three failed in unchanged static admin assertions
(operational notifications, canonical products/orders, customer administration).
Android, iOS and web production exports passed with two Metro workers after an
initial parallel export exhausted local memory. No native dependencies changed.

Published the same JavaScript fix on the existing production channel:

- Runtime 1.0.2: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/9bbe9cc7-e2c5-4fc5-ab3e-6643c2097b15
- Runtime 1.0.1: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/d558840f-4d5a-4786-85a3-d7ece1f37405

The production manifest endpoint returned HTTP 200 with the expected new update
ID for all four runtime/platform combinations. Removed the temporary 1.0.1
configuration after publication; app.json remains version 1.0.2. An earlier
identical 1.0.2 publication was superseded during compatibility publication.

Existing installations must apply the downloaded update: reopen online and tap
Restart now if prompted. Future active admin publications use the shared live
catalog without a store submission. Physical-device confirmation remains needed;
API and update-service verification cannot confirm an individual installation
has applied its update. Devices without internet retain available cached data.
