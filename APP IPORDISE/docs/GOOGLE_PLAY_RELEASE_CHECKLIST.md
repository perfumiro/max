# Google Play production release checklist

## Completed in the repository

- [x] Expo managed/CNG workflow retained; no duplicate native project created.
- [x] Display name `IPORDISE`, scheme `ipordise`, and package `com.ipordise.app` are configured.
- [x] App version is `1.0.0`; initial Android versionCode is `1`; EAS remote versioning and production auto-increment are configured.
- [x] Expo SDK 54 targets Android API 36.
- [x] Production EAS profile produces a store-distribution Android App Bundle.
- [x] Legacy broad Android storage permissions and development overlay permission are blocked.
- [x] Camera and microphone permissions are removed; photo access is requested only when choosing an optional profile image.
- [x] Edge-to-edge, safe-area layout, and predictive Android Back are configured.
- [x] Production API origins are HTTPS; iOS arbitrary HTTP loads are disabled.
- [x] Native bundles no longer import the web-only staff dashboard.
- [x] Session persistence, refresh, logout cleanup, server-authoritative totals, and order idempotency exist.
- [x] In-app account deletion requires email confirmation and password reauthentication.
- [x] Store listing draft, screenshot plan, Data Safety working sheet, and external deletion page are present.

## Account owner / backend actions

- [ ] Confirm `com.ipordise.app` is owned by IPORDISE in Play Console before the first upload. Do not change it afterward.
- [x] Reuse and verify the existing `@ipordises-team/ipordise` EAS project; `extra.eas.projectId` matches the linked project.
- [ ] Configure Android signing in EAS Credentials and securely back up the upload key. Never commit keystores or passwords.
- [x] Configure EAS development, preview, and production environment values: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_ADMIN_DASHBOARD_URL`, `EXPO_PUBLIC_FIREBASE_FUNCTIONS_URL`, and `EXPO_PUBLIC_FIREBASE_ORDER_API_ENABLED`. Server keys remain outside the mobile environments.
- [ ] Verify the Firebase staff email is marked verified. Protected staff functions reject unverified or disabled accounts.
- [ ] Deploy the updated website, then verify Privacy Policy, Support, Terms, and Account Deletion URLs over HTTPS.
- [ ] Implement and document the operational deletion job that fulfils rows in `account_deletion_requests`, removes associated profile/address/cart/wishlist/avatar data, and retains only legally required order records. Test one complete deletion end-to-end.
- [ ] Set exact data retention periods and provider/subprocessor details in the public Privacy Policy.
- [ ] Test production transactional email delivery and suppression/bounce handling with real business-controlled sender configuration.

## Play Console actions

- [ ] Complete developer identity, legal name/address, public support contact, phone, and payment profile requirements.
- [ ] Create the app using `com.ipordise.app` and upload the signed `.aab` to Internal testing first.
- [ ] Complete Data Safety using `GOOGLE_PLAY_DATA_SAFETY.md` and provider contracts.
- [ ] Enter the deployed account-deletion URL in the designated Play Console field.
- [ ] Declare: no ads in current mobile app; Shopping category; physical goods/cash-on-delivery commerce; no digital in-app purchases.
- [ ] Complete target audience/content rating accurately. The storefront is a general shopping app and is not designed specifically for children; the account owner must choose the actual intended age groups.
- [ ] Provide reviewer access instructions. Browsing and guest checkout do not require login; provide a dedicated verified reviewer account if Play requires account-only feature access.
- [ ] Upload localized listing copy and final phone/tablet screenshots.
- [ ] Supply a final 1024 × 500 JPEG or 24-bit PNG feature graphic without alpha.
- [ ] Complete app-content declarations, including account deletion and any applicable financial/commerce questions.
- [ ] Run pre-launch report, address crashes/accessibility/security findings, then promote through closed/open testing as appropriate.

## Final device QA before production

- [ ] Cold start and resume on a small Android phone, standard phone, large phone, and tablet.
- [ ] Registration, email verification, login, token refresh, logout, expired session, and account switch.
- [ ] Home, Shop, search, Product, favourites, Bag, checkout, confirmation, tracking, Account, addresses, orders, and Help.
- [ ] Duplicate submit prevention, server price/stock changes, offline/timeout/error states, and email confirmations.
- [ ] Android hardware Back, predictive Back gesture, nested modals, checkout, order details, and root exit.
- [ ] Status bar, navigation gesture area, keyboard, bottom navigation, and edge-to-edge on Android 15/16.
- [ ] English, French, Arabic RTL, larger text, TalkBack labels, and touch targets.
- [ ] Profile photo permission denial, limited photo access, selection, upload, removal, and account deletion.

## Release commands

```powershell
npm.cmd ci
npm.cmd run validate:offline
npm.cmd run lint
npx.cmd expo-doctor
npx.cmd eas-cli@latest build --platform android --profile production
npx.cmd eas-cli@latest submit --platform android --profile production
```

Submission is blocked until the signed AAB succeeds, the website changes are deployed, deletion fulfilment is operationally tested, and final device QA/Play declarations are complete.
