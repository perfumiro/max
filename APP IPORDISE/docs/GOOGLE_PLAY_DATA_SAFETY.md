# Google Play Data Safety working sheet

This mapping is based on the mobile source and Supabase/Firebase backend code in this repository. The account owner must reconcile it with production provider contracts, retention practice, server logs, and Play Console's current definitions before declaring it final.

All production client endpoints are HTTPS. Authentication tokens are stored in Expo SecureStore on native devices. The app has no advertising SDK, mobile analytics SDK, crash-reporting SDK, push-token collection, contacts access, microphone access, camera access, or GPS/location permission.

| Play data type | Collected | Required / optional | Purpose | Shared outside IPORDISE |
|---|---|---|---|---|
| Name | Yes | Required for orders; optional profile/support use | Account, fulfilment, support | Delivery and email/service providers only as needed |
| Email address | Yes | Required for accounts; optional guest order where allowed | Authentication, confirmation, support, account recovery | Email delivery and backend providers |
| Phone number | Yes | Required for delivery and private order tracking | Fulfilment, customer contact, fraud/rate controls | Delivery providers as needed |
| Physical address | Yes | Required to deliver an order | Fulfilment and saved addresses | Delivery providers as needed |
| User ID | Yes | Required for signed-in accounts | Authentication and customer-owned records | Backend/auth provider |
| Purchase history | Yes | Required after an order is placed | Order fulfilment, history, support, fraud prevention, accounting | Delivery/email providers as needed |
| Payment information | No card/bank data collected by the app | Cash on delivery is the implemented method | Payment method label is stored with the order | Confirm operational COD handling with courier |
| Photos | Optional | User chooses a profile photo | Account customization | Stored with the backend storage provider; not public by app design |
| App interactions | Yes for signed-in cart, wishlist, preferences, and reviews | Optional | App functionality and personalization | Backend provider; no ad/analytics sharing in current mobile code |
| Support messages | Optional | Only when customer starts a conversation | Customer support | Backend provider and authorized IPORDISE staff |
| Precise/approximate device location | No | Not requested | Shipping city/address is manually entered, not device location | N/A |
| Device or advertising ID | No explicit collection in app code | N/A | N/A | N/A |
| Crash/diagnostic data | No third-party crash SDK in app | N/A | Local redacted logging only | Verify platform/backend infrastructure logs separately |
| Push token | No | Notifications are preferences only; no push SDK is installed | N/A | N/A |

## Play Console answers to confirm

- Data is encrypted in transit: Yes for repository-controlled traffic.
- Users can permanently delete their account in app (`Account → Privacy & Security`) after password verification, and can request deletion externally at `/pages/account-deletion` after deployment.
- Data sharing: service-provider transfers may qualify for Play's service-provider exception. Confirm contracts before selecting “not shared.”
- Data retention: account/profile data is intended for deletion after a verified request; limited order records may require retention for legal, accounting, security, or fraud-prevention reasons. Set and publish exact retention periods with legal/business owners.
- Independent security review: do not claim one unless completed by a qualified external party.
