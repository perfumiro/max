# IPORDISE Apple App Store release checklist

Release identity: `IPORDISE`; bundle ID `com.ipordise.app`; marketing version `1.0.0`; local initial build `1`; Expo SDK 54. EAS uses remote app versions and automatically increments production builds.

## Completed in code

- [x] Existing production bundle identifier preserved; no new iOS app was created.
- [x] EAS `production` profile uses App Store distribution, the production environment, and automatic build-number increments.
- [x] iPhone and iPad are supported with safe-area handling, keyboard avoidance, bounded tablet content, and an app-level left-edge back gesture for the custom navigator.
- [x] Branded square 1254×1254 PNG icon has no alpha channel; launch screen uses the brand asset with `contain` on black.
- [x] HTTPS transport is required and standard OS TLS is declared as exempt encryption; no private credentials are bundled.
- [x] Optional profile-photo access has a specific purpose string. Camera and microphone access are disabled.
- [x] No advertising, attribution, analytics, location, contacts, Bluetooth, push, or tracking SDK is configured; ATT is not requested.
- [x] Email/password is the only account sign-in method, so Apple guideline 4.8 does not require Sign in with Apple.
- [x] Checkout is for physical perfume delivered cash on delivery; Apple In-App Purchase is not applicable.
- [x] In-app account deletion requires confirmation and password reauthentication, then immediately deletes the authenticated backend account and associated personal data while anonymizing retained order records.
- [x] Production-compatible customer order history query and account-deletion Edge Function.
- [x] Privacy inventory, review notes, listing proposal, and screenshot plan are documented.

## Requires Apple Developer account

- [ ] Confirm the account/team that owns the registered App ID `com.ipordise.app`.
- [ ] Link this repository to the correct EAS owner (`lecomax` or `lecomaxs-team`).
- [ ] Let EAS securely create or reuse the iOS distribution certificate and provisioning profile.
- [ ] Confirm Apple agreements and membership are active.

## Requires signing credentials

- [ ] Run the production build interactively once and complete Apple authentication when EAS requests it.
- [ ] Keep certificates, profiles, Apple passwords, and App Store Connect API keys in Apple/EAS credential storage—not in this repository.

## Requires App Store Connect

- [ ] Create or select the existing app record with bundle ID `com.ipordise.app`.
- [ ] Enter the approved name, subtitle, description, keywords, Shopping category, age rating, copyright, territories, and pricing.
- [ ] Add support and privacy-policy URLs and complete export-compliance answers.
- [ ] Upload the signed build, select it for the version, and complete compliance questions.
- [ ] Do not submit for review until the account owner explicitly authorizes submission.

## Requires legal/business information

- [ ] Verify the business name, seller/contact details, copyright holder, Moroccan return terms, and customer-support contact.
- [ ] Verify these public HTTPS pages in a normal browser: privacy policy, terms, support, and account deletion.
- [ ] Make the public privacy policy match `APP_STORE_PRIVACY.md`, including retention and service-provider details.

## Requires screenshots

- [ ] Capture real production-like screens without debug overlays or personal customer data.
- [ ] Provide 6.9-inch iPhone screenshots and required 13-inch iPad screenshots because `supportsTablet` is enabled.
- [ ] Capture each submitted localization consistently. Follow `app-store-screenshots.md`.

## Requires privacy answers

- [ ] Enter the factual data categories and purposes from `APP_STORE_PRIVACY.md`.
- [ ] Declare no cross-app tracking and do not add ATT unless the implementation changes.
- [ ] Re-audit every SDK in the final signed archive and review Xcode/App Store Connect privacy-manifest warnings before submission.

## Requires review notes

- [ ] Copy the relevant content from `APPLE_REVIEW_NOTES.md`.
- [ ] Create a dedicated reviewer account only if Apple needs authenticated order-history testing; replace the placeholder securely in App Store Connect, never in Git.
- [ ] Tell Review that checkout creates a physical-goods cash-on-delivery order and may contact a real fulfilment team.

## Requires TestFlight validation

- [ ] Install the signed archive on current physical iPhone and iPad devices.
- [ ] Validate launch, registration, login, session restoration, shop, product, favourites, bag, checkout, addresses, orders, support, logout, deletion, offline/error states, keyboards, and back navigation.
- [ ] Validate English, French, and Arabic RTL on small and large devices.
- [ ] Confirm production order creation appears in staff orders and confirmation email delivery succeeds.
- [ ] Resolve every TestFlight crash, App Store Connect warning, and privacy-manifest warning before review.

## Actual commands

```powershell
npx.cmd eas-cli@latest build --platform ios --profile production
npx.cmd eas-cli@latest submit --platform ios --profile production
```

The submit command is documented only; do not run it without explicit authorization.
