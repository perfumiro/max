import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizePushPermission, safeNotificationProductId, shouldDeliverNewProduct, shouldScheduleNewProduct, shouldShowNotificationInvitation } from '../src/notifications/notificationLogic.ts';
import { processPendingExpoReceipts, sendNewProductNotification, sendPromotionNotification } from '../supabase/functions/_shared/pushNotifications.ts';

test('Android and iOS permission states normalize without repeated invitations', () => {
  for (const platform of ['android', 'ios']) {
    assert.equal(normalizePushPermission({ available: true, granted: false, status: 'undetermined' }), 'notDetermined', platform);
    assert.equal(normalizePushPermission({ available: true, granted: true, status: 'granted' }), 'granted', platform);
    assert.equal(normalizePushPermission({ available: true, granted: false, status: 'denied' }), 'denied', platform);
  }
  assert.equal(normalizePushPermission({ available: true, granted: false, status: 'granted', provisional: true }), 'provisional');
  assert.equal(shouldShowNotificationInvitation('notDetermined', false), true);
  assert.equal(shouldShowNotificationInvitation('notDetermined', true), false);
  assert.equal(shouldShowNotificationInvitation('denied', false), false);
  assert.equal(shouldShowNotificationInvitation('granted', false), false);
});

test('new-product consent and publication transitions remain independent and precise', () => {
  assert.equal(shouldDeliverNewProduct({ enabled: true, newProductsEnabled: true }), true);
  assert.equal(shouldDeliverNewProduct({ enabled: true, newProductsEnabled: false }), false);
  assert.equal(shouldDeliverNewProduct({ enabled: false, newProductsEnabled: true }), false);
  assert.equal(shouldScheduleNewProduct(false, true), true);
  assert.equal(shouldScheduleNewProduct(true, true), false);
  assert.equal(shouldScheduleNewProduct(false, false), false);
  assert.equal(shouldScheduleNewProduct(true, false), false);
});

test('notification payload product IDs are safe and reject malformed routes', () => {
  assert.equal(safeNotificationProductId({ productId: 'dior-sauvage_elixir:100ml' }), 'dior-sauvage_elixir:100ml');
  for (const productId of [undefined, '', '../admin', 'https://evil.test', 'id?token=secret', 'a'.repeat(161)]) assert.equal(safeNotificationProductId({ productId }), null);
});

const campaignAdmin = ({ devices = [], duplicate = false, pendingTickets = [] } = {}) => {
  const updates = [];
  const ticketRows = [];
  const disabled = [];
  return {
    updates, ticketRows, disabled,
    from(table) {
      if (table === 'push_campaigns') return {
        insert: () => ({ select: () => ({ single: async () => duplicate ? { data: null, error: { code: '23505' } } : { data: { id: 'campaign-1' }, error: null } }) }),
        update: value => ({ eq: async () => { updates.push(value); return { error: null }; } }),
      };
      if (table === 'push_tickets') return {
        select: () => ({ is: () => ({ lte: () => ({ limit: async () => ({ data: pendingTickets, error: null }) }) }) }),
        update: value => ({ eq: async () => { updates.push({ ticket: value }); return { error: null }; } }),
        upsert: async rows => { ticketRows.push(...rows); return { error: null }; },
      };
      if (table === 'push_devices') return {
        select: () => ({ eq: () => ({ eq: () => ({ range: async (from, to) => ({ data: devices.slice(from, to + 1), error: null }) }) }) }),
        update: value => ({ eq: async (_field, id) => { disabled.push({ id, value }); return { error: null }; } }),
      };
      throw new Error(`Unexpected table ${table}`);
    },
  };
};

test('Expo sender batches 205 devices, emits safe data and disables provider-invalid tokens', async () => {
  const devices = Array.from({ length: 205 }, (_, index) => ({ id: `device-${index}`, expo_push_token: `ExpoPushToken[token_${index}]`, language: index % 3 === 0 ? 'ar' : index % 2 ? 'en' : 'fr', platform: index % 2 ? 'ios' : 'android' }));
  const admin = campaignAdmin({ devices });
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const messages = JSON.parse(init.body);
    calls.push({ url, messages });
    return new Response(JSON.stringify({ data: messages.map((_, index) => calls.length === 1 && index === 0 ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: `ticket-${calls.length}-${index}` }) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await sendNewProductNotification(admin, { id: 'dior-sauvage-elixir', name: 'Dior Sauvage Elixir' });
    assert.deepEqual(calls.map(call => call.messages.length), [100, 100, 5]);
    assert.equal(result.attempted, 205);
    assert.equal(result.accepted, 204);
    assert.equal(result.failed, 1);
    assert.equal(result.status, 'partial');
    assert.equal(admin.disabled[0].id, 'device-0');
    const payload = calls[0].messages[1];
    assert.deepEqual(Object.keys(payload.data).sort(), ['productId', 'route', 'type']);
    assert.equal(payload.data.type, 'new_product');
    assert.equal(payload.data.productId, 'dior-sauvage-elixir');
    assert.equal(payload.data.route, 'ipordise://product/dior-sauvage-elixir');
    assert.equal(JSON.stringify(payload).includes('userId'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('duplicate campaign reservation sends nothing', async () => {
  const admin = campaignAdmin({ duplicate: true, devices: [{ id: 'device', expo_push_token: 'ExpoPushToken[token]', language: 'en', platform: 'ios' }] });
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response('{}'); };
  try {
    assert.deepEqual(await sendNewProductNotification(admin, { id: 'new-product', name: 'New Product' }), { status: 'duplicate', attempted: 0, accepted: 0, failed: 0 });
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('promotion campaigns send offer-preferring devices a product deep link', async () => {
  const admin = campaignAdmin({ devices: [{ id: 'offer-device', expo_push_token: 'ExpoPushToken[offer_token]', language: 'en', platform: 'android' }] });
  const originalFetch = globalThis.fetch;
  let payload;
  globalThis.fetch = async (_url, init) => {
    const messages = JSON.parse(init.body);
    payload = messages[0];
    return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'promotion-ticket' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await sendPromotionNotification(admin, { id: 'promotion-product', name: 'Promotion Product', startsAt: '2026-08-27T10:00:00.000Z' });
    assert.equal(result.status, 'sent');
    assert.equal(payload.data.type, 'promotion');
    assert.equal(payload.data.productId, 'promotion-product');
    assert.equal(payload.channelId, 'offers');
  } finally { globalThis.fetch = originalFetch; }
});

test('receipt processing permanently disables DeviceNotRegistered installations', async () => {
  const admin = campaignAdmin({ pendingTickets: [{ id: 'ticket-dead', device_id: 'device-dead' }] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { 'ticket-dead': { status: 'error', details: { error: 'DeviceNotRegistered' } } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    await processPendingExpoReceipts(admin);
    assert.equal(admin.disabled[0].id, 'device-dead');
    assert.ok(admin.disabled[0].value.disabled_at);
  } finally { globalThis.fetch = originalFetch; }
});

test('cold-start handling waits for auth and invalid products render a recoverable Shop fallback', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /if\(!authReady\|\|!pendingProductId\)return/);
  assert.match(app, /openNavigationIntent\(`ipordise:\/\/product\//);
  assert.match(app, /This product is no longer available\./);
  assert.match(app, /Explore products/);
  assert.match(app, /if\(unavailableProductId\).*setActive\('Shop'\)/);
});
