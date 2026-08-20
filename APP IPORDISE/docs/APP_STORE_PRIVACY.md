# App Store Connect privacy inventory

This is an implementation-based worksheet, not legal advice. The account owner must reconcile it with the production database, public Privacy Policy, retention rules, and every provider before submission.

## Data collected and linked to the user

| Apple data type | Actual use | Purpose |
|---|---|---|
| Name | Account profile, recipient, checkout, support | App functionality; customer support |
| Email address | Authentication, checkout confirmation, support, optional newsletter | App functionality; customer support; developer marketing only when separately consented |
| Phone number | Saved address, checkout, delivery | App functionality |
| Physical address | Saved delivery addresses and order fulfilment | App functionality |
| User ID | Supabase authentication and ownership of account records | App functionality; account management |
| Purchase history | Physical-goods orders, items, totals, and fulfilment status | App functionality; customer support |
| Other user content | Optional order notes, product reviews, profile photo, and support messages | App functionality; customer support |
| Product interaction | Server-synchronized favourites, bag contents, and selected preferences | App functionality; personalization |

## Not collected by the current app implementation

- Payment or credit-card information: checkout is cash on delivery.
- Precise or coarse location; contacts; microphone; camera; Bluetooth; health; fitness; or sensitive information.
- Device ID, advertising data, third-party advertising, or cross-app tracking.
- Crash data, performance data, or general usage analytics: no analytics/crash SDK is configured.
- Push token: push notifications are not implemented.
- Search history: search text is used for the active catalogue filter and is not submitted as analytics or stored as account history.

## Tracking and ATT

No dependency is configured for advertising, attribution, data brokerage, or linking IPORDISE data with third-party app/site data for targeted advertising. Do not mark data as “used for tracking,” and do not add the App Tracking Transparency prompt unless the implementation or provider behavior changes.

## Account deletion and retention

In-app deletion requires confirmation and password reauthentication. The production endpoint removes the authentication user and associated profile-owned records, support/newsletter associations, review identity records, and profile avatar. Commerce orders that must remain for legitimate business, fraud, accounting, or legal obligations are unlinked and customer fields are replaced with non-personal placeholders. The public policy must state actual retention periods and legal basis.

## SDK/privacy-manifest review

The app uses Expo/React Native and Supabase client libraries, with Expo SecureStore and ImagePicker. There are no advertising or analytics SDKs in the current dependency graph. Expo SDK packages supply their applicable native privacy manifests; the final signed archive must still be checked for Apple privacy-manifest and required-reason API warnings. Re-run this inventory whenever dependencies or backend providers change.
