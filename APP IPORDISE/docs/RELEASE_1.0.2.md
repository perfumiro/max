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

## Deployment and queued store artifacts

- Website deployed successfully from GitHub commit `42047c4`; public `script.js` and `/app` entry were checked for the new code/bundle.
- The user confirmed Boss In Motion appears on their installed Play Store 1.0.1 app after the production update.
- Android 1.0.2, version code 16: https://expo.dev/accounts/ipordises-team/projects/ipordise/builds/502adb9c-88bc-4801-af0e-c2de227c27eb
- Scheduled Google Play internal draft submission: https://expo.dev/accounts/ipordises-team/projects/ipordise/submissions/e2f635ee-8581-4d1c-b0cf-b07c27ac354a
- iOS 1.0.2, build 12: https://expo.dev/accounts/ipordises-team/projects/ipordise/builds/eef8ad99-9f0e-40d1-8b99-e9bd9c6d3743
- Scheduled App Store Connect upload: https://expo.dev/accounts/ipordises-team/projects/ipordise/submissions/a44dc446-44b4-4443-8d99-cb1cb2fb562b

Both submissions were accepted by EAS with existing stored credentials. At scheduling, Android was queued and iOS was building. Completion, store processing, and public store release have not yet been verified.
