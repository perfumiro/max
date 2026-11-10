# Catalog synchronization — 10 November 2026

Production diagnosis confirmed 172 published products through the actual mobile
catalog reader, without fallback warnings. The protected admin API returned 204
total products, including archived entries. The production creation/deletion path
worked with a temporary unpublished product; its variant was created, the product
remained invisible to customers, and deletion was verified afterward. No existing
product was edited or removed.

The app refreshed individual catalog screens but retained separate copies in the
shopping provider and product overlays. An admin removal could therefore leave
an old product in saved items, the bag, an open detail or navigation history.

Confirmed live catalog reads now notify shared subscribers. The shopping provider
refreshes while mounted, every 30 seconds while active and on foreground return,
even when a bag, wishlist or product overlay is open. It reconciles bag lines,
saved products and the last-added product. Home, Boutique, Offers, open product
details, size selection and product history receive current product records or
remove records absent from the live catalog. Draft/archived publication status is
also checked by the converter. Failed refreshes do not broadcast fallback data as
confirmed server state. The offline snapshot now contains 172 products and 271
enabled variants.

Validation:

- TypeScript passed; ESLint reported zero errors and five existing App warnings.
- Full suite before the three new bag regressions: 300 passed, three existing
  static website-admin assertions failed (operational notifications, canonical
  products/orders, customer administration). No website-admin source was changed.
- All 12 focused catalog, scheduler and bag-sync tests passed, including the three
  new bag regressions, additions, removals, an empty catalog, offline fallback and
  recovery. The earlier 51 focused catalog/admin/shop/commerce tests also passed.
- Android and iOS Hermes exports passed. No native dependencies changed.
- Production admin draft creation, variant creation and deletion passed through
  `scripts/verify-admin-catalog-roundtrip.mjs`. This deliberately does not publish
  a test product to customers or test delivery on a physical phone.

Published the same bundles on the production channel:

- Runtime 1.0.2: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/ff0fe6b2-de6d-4e96-8e1e-6a0c9c0f957b
- Runtime 1.0.1: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/141b3a58-e9d2-4a22-a2d1-b01e12f32d8f

The actual production manifest endpoint returned HTTP 200 with each expected
update ID for Android/iOS × runtimes 1.0.1/1.0.2. Removed the temporary compatibility
config after publishing; app.json remains 1.0.2 with its existing runtime policy.

Existing installations must download and apply the update once: reopen online and
tap Restart now when offered, or use Account → App updates. After applying it,
published additions and removals refresh automatically, normally within 30 seconds
while online, and on foreground return. Offline devices cannot receive server
changes. Runtime 1.0.0 still receives an older October update and requires an
upgrade to the newer store binary because native speech-recognition support
differs; the new bundle was not relabeled as compatible with that binary.

Physical-device confirmation of the originally reported symptom remains needed.
API verification and successful OTA delivery do not prove which update is running
on any individual installed app. The legacy website and backend were not deployed
or changed in this repair.

## GitHub and API checks

Prepared the release from the latest `perfumiro/max` main branch in an isolated
checkout, preserving the newer admin-search work. Included the pending-update
Restart button correction so the GitHub source also reflects the delivered app.
The catalog workflow lives at repository-root `.github/workflows/catalog-sync.yml`;
the older workflow nested inside the Expo directory is not discovered by GitHub.

The new workflow checks release configuration, TypeScript, and 41 focused catalog,
publication, shopping and admin-search regressions on pushes and pull requests.
It also checks the live production API on main pushes, manual runs, and every six
hours. It uses only the public app URL and client key. It never creates products,
places orders, changes the database, or stores staff credentials.

Expanded API verification to include `admin-catalog-sync` and `admin-orders`
preflight plus HTTP 401 for unauthenticated catalog, order and preorder admin
requests. Added request deadlines to website/bundle and validation probes. The
expanded live API check, actual mobile catalog reader, release config, TypeScript
and all 41 focused tests passed from the release checkout before pushing.

These checks detect regressions and outages; they do not guarantee uninterrupted
third-party hosting or confirm that an individual phone has applied an update.
