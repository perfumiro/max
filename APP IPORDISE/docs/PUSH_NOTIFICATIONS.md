# IPORDISE production push notifications

## Architecture

- Native client: `expo-notifications`, `expo-device`, and `expo-constants`.
- Provider: Expo Push Service, using production `ExpoPushToken` values generated with the linked EAS project ID.
- Registration: `push-devices` Supabase Edge Function. Authenticated identity is derived from the verified access token; the client never submits a user ID.
- Delivery: the Firebase-staff-protected `admin-catalog-sync` function creates one `NEW_PRODUCT` campaign on the first draft/inactive to active transition and sends in batches of 100.
- Navigation: payloads carry only `type`, `productId`, and a safe app route. Taps are deferred until auth restoration/navigation is ready and then open the exact product.

## One-time production setup

1. The app is linked to the existing `@ipordises-team/ipordise` EAS project. Preserve project ID `84df51a3-014e-4c04-8f83-7b159866d3f5`; do not create a duplicate project.
2. Apply `supabase/migrations/202608200004_push_notifications.sql` by itself after reconciling the remote migration history. A normal `supabase db push` is currently unsafe because the remote history does not mark older migrations as applied.
3. Deploy `push-devices` and the updated `admin-catalog-sync` Edge Functions.
4. Configure Android FCM V1 credentials for `com.ipordise.app` in EAS credentials.
5. Configure Apple Push Notification credentials for `com.ipordise.app` in the chosen Apple Developer/EAS account.
6. Create new signed preview/production builds. Expo Go is not a production push test environment for this SDK.

## Required physical-device acceptance tests

- Android: fresh install, allow/deny/settings flows, foreground/background/locked/terminated delivery, token refresh, tap-to-product, account switch/logout.
- iPhone: the same flows plus provisional authorization and badge clearing.
- Admin: create draft (no push), edit draft (no push), first publish (one push), edit price/stock/image (no push), repeated publish (no duplicate), disabled New arrivals preference (no push).
- Provider receipts: allow at least 15 minutes, then publish another product or invoke the receipt processor in a controlled admin task; permanently invalid tokens must become disabled.

## Operational behavior

- Product publication never rolls back because push delivery fails.
- Campaign status and accepted/failed counts are stored in `push_campaigns`.
- Expo tickets are stored in `push_tickets`; receipt processing disables `DeviceNotRegistered` installations.
- General new-arrival consent can remain on a guest installation after logout. Private order updates are always unlinked when the authenticated session signs out.
