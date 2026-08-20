# IPORDISE

Expo 54 application for the IPORDISE fragrance storefront. It targets iOS, Android, tablets, and web from one React Native codebase.

## Local development

1. Copy `.env.example` to `.env` and set the public Supabase URL and publishable key.
2. Install dependencies with `npm ci`.
3. Run `npm run start`, `npm run android`, `npm run ios`, or `npm run web`.

Never place `SUPABASE_SECRET_KEY` or a service-role key in application code or any `EXPO_PUBLIC_*` variable.

## Validation

Run `npm run validate:offline` during development. Run `npm run validate` before release; it also checks the live catalog API and Expo project health, which require network access.

## Architecture

- `App.tsx`: screen composition and storefront presentation.
- `src/commerce/`: shared, quantity-aware bag and favourites state plus pure state helpers.
- `src/services/`: bounded customer API requests, passwordless authentication, and newsletter subscription.
- `src/config.ts`: validated public runtime configuration.
- `src/observability/`: redacted structured logging and root error reporting.
- `src/sharedCatalog.ts`: typed catalog mapping, request timeout, retry/fallback logic, and five-minute request deduplication/cache.
- `src/useResponsiveLayout.ts`: phone, tablet, and large-screen breakpoints.
- `src/designSystem.ts`: shared colors, spacing, sizing, typography, and shadows.
- `supabase/`: database migration and protected admin catalog synchronization function.

## Release

`eas.json` defines development, internal-preview APK, and store-production profiles. Production Android builds are AABs; store build numbers are owned and auto-incremented by EAS remote versioning. Before the first submission, confirm ownership of `com.ipordise.app`, link the EAS project, configure signing, publish the legal/account-deletion pages, and run signed production builds for both platforms.

See [the production-readiness checklist](docs/PRODUCTION_READINESS.md), [Google Play checklist](docs/GOOGLE_PLAY_RELEASE_CHECKLIST.md), and [App Store checklist](docs/APP_STORE_RELEASE_CHECKLIST.md).
