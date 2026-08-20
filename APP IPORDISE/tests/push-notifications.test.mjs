import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('native configuration uses Expo notifications without hardcoded project identifiers', async () => {
  const [app, service] = await Promise.all([read('../app.json'), read('../src/notifications/pushNotificationService.ts')]);
  assert.match(app, /expo-notifications/);
  assert.match(app, /\.\/assets\/notification-icon\.png/);
  assert.match(service, /Constants\.easConfig\?\.projectId/);
  assert.match(service, /getExpoPushTokenAsync\(\{ projectId: easProjectId \}\)/);
  assert.doesNotMatch(service, /projectId\s*=\s*['"][0-9a-f-]{20,}/i);
  assert.match(service, /setNotificationChannelAsync\('new-products'/);
  assert.match(service, /setNotificationChannelAsync\('order-updates'/);
});

test('permission UX persists prompt decisions and handles denied settings', async () => {
  const [provider, account] = await Promise.all([read('../src/notifications/PushNotificationProvider.tsx'), read('../src/account/AccountScreen.tsx')]);
  assert.match(provider, /hasSeenPushPrompt/);
  assert.match(provider, /markPushPromptSeen/);
  assert.match(provider, /setPromptEligible/);
  assert.match(provider, /AppState\.currentState === 'active'/);
  assert.match(provider, /newProductsEnabled: true/);
  assert.match(provider, /readLocalPushPreferences/);
  assert.match(provider, /Notifications\.addNotificationResponseReceivedListener/);
  assert.match(provider, /Notifications\.addPushTokenListener/);
  assert.match(account, /push\.openSettings\(\)/);
  assert.match(account, /new_products/);
  assert.match(account, /order_updates/);
  assert.match(account, /offers_marketing/);
});

test('device registration binds authenticated identity server-side and unlinks private updates on logout', async () => {
  const [endpoint, auth] = await Promise.all([read('../supabase/functions/push-devices/index.ts'), read('../src/account/CustomerAuthContext.tsx')]);
  assert.match(endpoint, /admin\.auth\.getUser\(bearer\)/);
  assert.doesNotMatch(endpoint, /payload\.userId/);
  assert.match(endpoint, /user_id: null, order_updates_enabled: false/);
  assert.match(endpoint, /current\?\.user_id && current\.user_id !== userId/);
  assert.doesNotMatch(endpoint, /current\.expo_push_token !== expoPushToken/);
  assert.doesNotMatch(endpoint, /delete\(\).*push_devices/s);
  assert.match(auth, /unlinkPushDevice\(session\?\.access_token\)/);
});

test('new-product campaigns are backend-only, batched, localized and idempotent', async () => {
  const [migration, sender, admin] = await Promise.all([read('../supabase/migrations/202608200004_push_notifications.sql'), read('../supabase/functions/_shared/pushNotifications.ts'), read('../supabase/functions/admin-catalog-sync/index.ts')]);
  assert.match(migration, /unique\(type, product_id\)/i);
  assert.match(migration, /revoke all on public\.push_devices from anon, authenticated/i);
  assert.match(sender, /BATCH_SIZE = 100/);
  assert.match(sender, /DeviceNotRegistered/);
  assert.match(sender, /Nouveau chez IPORDISE/);
  assert.match(sender, /جديد لدى IPORDISE/);
  assert.match(sender, /productId: product\.id/);
  assert.match(admin, /verifyFirebaseStaff/);
  assert.match(admin, /!wasPublished/);
  assert.match(admin, /sendNewProductNotification/);
  assert.match(admin, /new_product_push_failed/);
  assert.match(admin, /EdgeRuntime/);
  assert.match(admin, /waitUntil\(pushTask\)/);
});
