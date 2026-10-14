# IPORDISE 1.0.2 — 14 October 2026

The Boutique now refreshes the canonical catalog every 30 seconds while active and immediately on foreground entry. Refresh requests do not overlap, background polling stops, and failures preserve the latest visible products. Home already refreshes on the same interval.

The bundled fallback was refreshed from 85 to 137 active products and 339 enabled variants. The actual mobile reader was checked against production: Althaïr Exclusif Parfums de Marly, Boss In Motion, and Burberry Her Burberry are present with published prices. Product publications continue to use the shared Supabase catalog; future product additions do not require a store release.

The website's new-arrival cards now read canonical product records rather than requiring a Firestore mirror. This matters because Firestore returned HTTP 429 during the production audit. Firestore remains a fallback when the canonical catalog cannot be loaded. The main website script cache version is 27.

## Existing installed 1.0.1 applications

Production update for Android and iOS: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/ef338e56-76ed-415f-813c-e418514bef31

This update targets runtime 1.0.1. Close and reopen the app, then use the update restart button when shown. New native builds use version/runtime 1.0.2 with remote, auto-incremented store build numbers.

## Validation

- TypeScript passed; 286 app tests passed before the additional website test was added.
- Lint completed with zero errors and six existing warnings.
- Seventeen focused catalog/Boutique/website tests passed, including polling, foreground refresh, no overlapping requests, cleanup, optional service failure, new publications, and unpublishing.
- Release configuration and generated iOS configuration passed.
- Web, Android, and iOS bundles exported successfully.
- Production catalog and authenticated read-only admin checks passed; public app and website catalog records agree.
- A disposable admin publication reached the canonical service but Firestore mirroring returned HTTP 429; test records were cleaned up. End-to-end mirror verification did not pass.

Store submission/review and physical-device validation must be recorded separately from successful Expo builds or OTA publication.
