# Google Play Data Safety audit

Audited 1 September 2026 from the React Native client, Supabase functions/migrations, Firebase integration, and package dependencies. This is a technical inventory, not a legal declaration. The owner must confirm production retention, courier/email/support provider contracts, and Play Console's current definitions.

All repository-controlled production endpoints are HTTPS. Native authentication, guest-order tracking credentials, shopping state, language, notification preferences, and push tokens are stored using Expo SecureStore. The client contains public Supabase/Firebase configuration only; privileged database, signing, administrator, email-provider, and service-role secrets remain server-side.

| Data category | Collected or transmitted | Required / optional | Purpose and destination |
|---|---|---|---|
| Name | Yes | Required for an order; optional in profile/support | Account, fulfilment, support; Supabase and operational fulfilment providers. |
| Email address | Yes | Required for accounts; used when supplied for orders/support/newsletter | Authentication, verification, recovery, confirmations, support, newsletter; Supabase and configured email provider. |
| Phone number | Yes | Required for delivery and private order tracking | Fulfilment, customer contact, tracking verification, abuse controls; backend and courier when fulfilled. |
| Physical address and city | Yes | Required for delivery | Order fulfilment and optional saved addresses; backend and courier when fulfilled. |
| User/account ID | Yes for accounts | Required for signed-in features | Authentication and ownership of customer records in Supabase. |
| Purchase and order information | Yes after checkout | Required to fulfil and track orders | Items, quantities, server-calculated prices/totals, delivery method, status, and order history; Supabase and operational providers. |
| Payment information | No card or bank details in current client | Cash on delivery is implemented | The selected payment-method label is stored with the order. Owner must confirm courier COD processing. |
| Photos | Optional | Customer explicitly chooses a profile image | Uploaded to private customer-avatar storage in Supabase. The system photo picker is used; camera access is removed. |
| App activity/preferences | Yes | Optional except operational state | Cart, favourites, language, notification preferences, reviews, and support state for app functionality/personalization. No advertising SDK is installed. |
| Reviews and support messages | Optional | Customer-initiated | Product review verification and customer care; Supabase and authorized staff. |
| Push notification token and installation identifier | Optional | Only after notification opt-in on a physical device | Expo push delivery, preference routing, token invalidation, and optional association with the signed-in user; Supabase and Expo push service. |
| Microphone audio | Processed when voice search is invoked | Optional | Sent to the device/platform speech-recognition service to convert speech to search text. The app code does not persist recordings. Provider processing/retention requires owner confirmation. |
| Precise or approximate device location | No | N/A | Shipping address/city is manually entered; no location permission or location SDK is present. |
| Contacts, SMS, call logs | No | N/A | No permission or SDK found. |
| Advertising ID | No explicit collection found | N/A | No ads or mobile advertising SDK found. Confirm Expo/OS and provider contracts before the final declaration. |
| Analytics | No mobile analytics SDK found | N/A | The public website uses Google Analytics/Tawk, but those scripts are not imported by the native client. Confirm the deployed mobile bundle and provider traffic. |
| Crash diagnostics | No third-party crash-reporting SDK found | N/A | Client logger is redacted and production console output is disabled. Backend/hosting/platform logs require owner confirmation. |

## Sharing and security

Data is transmitted to service providers needed to operate the app: Supabase, Expo push (when enabled), configured email delivery, and delivery/courier operations. Whether each transfer qualifies for Play's “service provider” exception must be confirmed from the contracts. Do not claim that data is never shared merely because it is not sold.

Server functions reload catalogue prices, stock, discounts, and delivery values rather than trusting client totals. Row-level security and authenticated/guest tracking credentials restrict customer records. Order creation uses a persisted idempotency identity to protect retries and rapid repeated submission.

## Owner confirmations required before submission

- Exact retention/deletion periods for accounts, orders, support messages, reviews, notification tokens, logs, and backups.
- Legal entities and contracts for Supabase, Expo, email delivery, couriers, Firebase services, and any production monitoring.
- Whether platform speech recognition retains or uses audio/transcripts beyond providing the feature.
- Whether production infrastructure derives or retains IP addresses, device diagnostics, or fraud signals that Play classifies as collected data.
- That the deployed privacy policy accurately covers profile photos, push tokens, voice search, service providers, retention, account deletion, and Morocco-specific legal obligations.
- That account deletion has been exercised against the production environment and retained order data is limited to documented legal/business requirements.

## Privacy policy status

The client links to `https://ipordise.com/pages/privacy-policy` and an account-deletion page. Repository source for the policy exists, but its public availability and exact match to the points above were not established by local tests. Verify both URLs from a non-authenticated device before completing Play Console.
