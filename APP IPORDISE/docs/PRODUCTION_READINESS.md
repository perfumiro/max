# IPORDISE production readiness

## Verified on 20 August 2026

- The live Supabase products and authenticated `admin-orders` endpoints returned HTTP 200.
- The local administration UI authenticated successfully and rendered the existing order even while an unrelated catalogue request was quota-limited.
- The live `create-order` function was redeployed with EmailJS-to-Resend provider fallback and sanitized provider errors.
- The current Resend API key authenticates, but the configured sender domain is not registered or verified. The existing order remains marked `notification_status=failed`; production email is not cleared until EmailJS is repaired or a business-controlled Resend domain is verified and a new/replayed order proves delivery.
- The production account-deletion function is deployed and an end-to-end throwaway-account test returned HTTP 200. It deletes the authenticated account and related personal records and anonymizes retained commerce orders.
- The customer order-history query now matches the columns deployed in production, avoiding a PostgREST schema-cache failure from local-but-unapplied order-tracking migrations.
- EAS authentication succeeds, but the app is not linked to an EAS project. The signed build is blocked until the owner chooses `lecomax` or `lecomaxs-team` for the persistent project.
- `180/180` automated tests, TypeScript, release-config validation, and the production web export pass. Expo Doctor passes 16/18 checks; its two Git-ignore findings conflict with `git check-ignore`, which confirms `.expo` and `.env.local` are ignored in this untracked nested app directory.

## What is implemented

- One Expo 54 codebase for iOS, Android, tablet, and web.
- Responsive storefront, catalog search and filters, product detail, offers, menu, help, account, favourites, a quantity-aware bag, checkout, and a professional order-confirmation page.
- Central runtime configuration, bounded HTTP requests, safe client logging, a root error boundary, catalog retries, request deduplication, and a persisted web fallback cache.
- Real Supabase passwordless email requests and newsletter subscriptions. The UI only reports success after the backend accepts the request.
- Database-backed admin roles, customer-owned profiles and orders, row-level security, order idempotency, validation constraints, and admin audit logs.
- A protected catalog synchronization function with Firebase identity verification, role authorization, CORS restrictions, body and identifier validation, safe errors, and audit events.
- A private customer-care conversation service with staff-only inbox policies, customer access tokens, reply polling, rate limits, statuses, priorities, and audited staff responses.
- A protected order-creation function that reloads products and prices from the server, validates availability, applies delivery fees, enforces idempotency, and sends new orders to the admin-visible `orders` table.
- Live catalog pricing from the admin data source with app refreshes and server-side price confirmation during checkout.
- Automated unit, release-config, and security regression tests plus a GitHub Actions quality workflow.

## Architecture boundaries

- `App.tsx` contains presentation and screen composition.
- `src/commerce/` owns deterministic bag state and the shared shopping provider.
- `src/services/` owns customer-facing HTTP operations and normalized service errors.
- `src/sharedCatalog.ts` owns catalog mapping, remote fallbacks, and caching.
- `src/config.ts` is the only client runtime configuration boundary.
- `src/observability/` owns structured, redacted logging.
- `supabase/migrations/` is the source of truth for data access and database authorization.
- `supabase/functions/` contains privileged catalog synchronization, customer-care, and order-creation APIs.

## Required before a public release

1. Confirm the production Supabase project is owned by IPORDISE, migrations are current, and every customer/admin Edge Function used by the app is deployed from this repository.
2. Apply every migration in timestamp order, deploy the protected functions, and verify every configured staff identity. Firebase-backed staff access now requires an allowlisted, enabled, email-verified account.
3. Configure Supabase Auth site URL and allowed redirect URLs for the production web origin and the `ipordise://` mobile scheme. Confirm email templates and SMTP delivery.
4. Add public mobile configuration to the EAS production environment. Keep Supabase secret/service-role keys, EmailJS private keys, Resend keys, database passwords, administrator credentials, and signing credentials server-side.
5. Confirm ownership of `com.ipordise.app`, link the Expo/EAS project, configure Apple/Google signing, deploy the privacy/support/account-deletion pages, and complete the store declarations and assets.
6. Confirm the production payment model. Cash on delivery is fully represented now; card payment, push notifications, crash reporting, and analytics still need chosen providers before enabling them.
7. Add signed-build end-to-end tests against a staging backend for sign-in, catalog sync, newsletter signup, order creation, transactional email, and authorization denial cases. Account deletion has a successful production throwaway-account verification but must also be tested from the TestFlight UI.

## Validation

Run the deterministic local checks:

```sh
npm run validate:offline
npx expo export --platform web --output-dir dist-validation
```

With a reachable configured backend, also run:

```sh
npm run check:api
npx expo-doctor
```

The deployment gate should remain closed until every item in the release checklist above is confirmed in staging.
