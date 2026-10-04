# IPORDISE 1.0.1 — 4 October 2026

Android/iOS identifiers: `com.ipordise.app`. Expo runtime: `1.0.1`.

## Published on Expo

- Production update, Android and iOS: https://expo.dev/accounts/ipordises-team/projects/ipordise/updates/fc716f36-14c4-4aa6-a634-e84af284cff8
- Completed Google Play AAB build, Android version code 15: https://expo.dev/accounts/ipordises-team/projects/ipordise/builds/12a8b94b-9436-4ed7-9451-45ec6a57ffe3
- Local signed upload file: `release-artifacts/1.0.1/ipordise-1.0.1-android-build-15.aab`.
- The update targets the new 1.0.1 runtime. Existing 1.0.0 installations require the new native build.

## Verified

- All 277 app tests and 13 focused website checks pass; TypeScript passes; lint has no errors.
- Expo Doctor: 18/18 checks pass.
- Web and both native JavaScript/Hermes bundles export successfully.
- Expo production variables connect to the same Supabase project as the website.
- Live catalog: 85 active products, 249 enabled variants, 80 products with stock.
- Actual app-admin code saved a private draft to Supabase and the legacy website's Firestore catalog with matching product ID, name, price, and visibility. Both test records were removed.
- The missing `price_coming_soon` column was repaired in production with default `false`, and migration `202610040001` was recorded. The release's bundled catalog is refreshed from the live API.
- Available selected sizes add to the bag; unavailable selected sizes offer preorder only when the product permits it. Missing prices no longer implicitly enable preorder.
- The legacy website now retains valid decant sizes under 50 ml, so a newly published decant-only fragrance can appear instead of being discarded.

## Still requires account access

- iOS IPA build: Expo has no configured Apple distribution signing credentials. Complete `npx eas-cli credentials --platform ios` in `APP IPORDISE`, then run `npx eas-cli build --platform ios --profile production`.
- Website deployment: GitHub Pages serves `perfumiro/max`, `main`, `/`. The repository owner account now has write access. This release includes the rebuilt website bundle for publication through the main branch.
- Edge Function deployment: the saved Supabase account receives HTTP 403 for production project `gdgrskgegrcgmzswefmn`. The old deployed admin function ignores `priceComingSoon`, confirmed with a private draft test. Restore project access, then deploy the prepared functions:

```powershell
supabase functions deploy admin-catalog-sync create-preorder --project-ref gdgrskgegrcgmzswefmn --use-api --no-verify-jwt
node --env-file-if-exists=.env.local --env-file-if-exists=.env scripts/check-admin-publication.mjs --verify-draft --verify-app-mirror --verify-write
npm.cmd run check:api
```

The functions enforce staff/customer authorization in their handlers; the gateway JWT setting matches the existing Firebase staff and guest-preorder integration.

The AAB is a store upload artifact. App Store/Play review declarations, screenshots, and final device QA remain separate from a successful build; see the existing listing and screenshot documents in this directory. No store submission was performed.
