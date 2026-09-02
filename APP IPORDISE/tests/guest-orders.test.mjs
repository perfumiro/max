import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('checkout saves a secure guest credential before clearing its retry identity', async () => {
  const [service, checkout] = await Promise.all([
    read('src/services/orderService.ts'),
    read('src/commerce/CommercePages.tsx'),
  ]);
  const saveAt = service.indexOf('await saveGuestOrder(order)');
  const clearAttemptAt = service.indexOf('await clearPendingAttempt()', saveAt);
  assert.ok(saveAt > 0 && clearAttemptAt > saveAt);
  assert.match(service, /trackingToken/);
  assert.match(checkout, /onComplete\(order\);\s*checkoutSessionDraft = null;\s*clearBag\(\)/);
});

test('guest order credentials use SecureStore and stay free of delivery PII', async () => {
  const storage = await read('src/services/guestOrdersService.ts');
  assert.match(storage, /expo-secure-store/);
  assert.match(storage, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.match(storage, /orderReference/);
  assert.match(storage, /trackingToken/);
  assert.doesNotMatch(storage, /customerName|phoneMasked|deliveryAddress/);
});

test('guest My Orders refreshes from the backend and phone recovery is saved automatically', async () => {
  const app = await read('App.tsx');
  assert.match(app, /syncGuestOrders\(\)/);
  assert.match(app, /AppState\.addEventListener/);
  assert.match(app, /RefreshControl/);
  assert.match(app, /saveGuestOrder\(\{orderReference:recovered\.orderNumber/);
  assert.match(app, /trackSavedGuestOrder/);
});

test('guest tokens are server-generated HMAC values and compared in constant time', async () => {
  const [createOrder, trackOrder, token] = await Promise.all([
    read('supabase/functions/create-order/index.ts'),
    read('supabase/functions/track-order/index.ts'),
    read('supabase/functions/_shared/guestOrderToken.ts'),
  ]);
  assert.match(createOrder, /guestOrderToken\(serviceKey, order\.id, order\.order_number\)/);
  assert.match(trackOrder, /constantTimeTokenMatch/);
  assert.match(token, /HMAC/);
  assert.match(token, /SHA-256/);
  assert.doesNotMatch(createOrder, /trackingToken[^\n]*payload/);
});
