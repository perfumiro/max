# Google Play Android permissions audit

Audited 1 September 2026 from `app.json`, Expo config introspection, and the installed native dependency manifests. The signed AAB must still be checked in Play Console's App Bundle Explorer because Gradle performs the final manifest merge during the remote EAS build.

## Expected production permissions

| Permission | Source | Why it exists | User experience / decision |
|---|---|---|---|
| `android.permission.INTERNET` | Expo/React Native application manifest | Loads the Supabase catalogue and customer APIs, images, EAS updates, and push services over HTTPS. | Required; retain. |
| `android.permission.VIBRATE` | Expo notifications/haptics | Notification and in-app haptic feedback. | Non-sensitive; retain while those features are enabled. |
| `android.permission.RECORD_AUDIO` | `expo-speech-recognition` config | Optional fragrance voice search. The app requests access only when the customer starts voice search. | Sensitive runtime permission; retain only while voice search is shipped. Denial must leave text search usable. |
| `android.permission.POST_NOTIFICATIONS` | `expo-notifications` | Shows new-product, offer, and order-update notifications on Android 13+. | Optional runtime permission; requested through the in-app notification opt-in. Denial does not block shopping. |
| `android.permission.RECEIVE_BOOT_COMPLETED` | `expo-notifications` | Allows the notification module to restore notification handling after reboot or app replacement. | Normal permission; retain for existing push functionality. |

## Explicitly removed

The app configuration removes `CAMERA`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `USE_BIOMETRIC`, and `USE_FINGERPRINT`. Profile images use the Android system photo picker; the app does not take photos. No location, contacts, SMS, phone, call-log, or background-location package is present.

## Queries, components, and non-permission declarations

The manifest queries HTTPS handlers and installed speech-recognition services. `expo-notifications` declares a non-exported Firebase messaging service and boot receiver. These are not additional user permissions. The application disables Android backup and enables edge-to-edge and predictive Back.

## Release verification

After the AAB completes, inspect **Play Console → App Bundle Explorer → Downloads → AndroidManifest.xml** and compare every merged `uses-permission` entry with this table. Any additional sensitive permission is a release blocker until explained or removed.
