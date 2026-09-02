import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = name => readFile(new URL(name, import.meta.url), 'utf8');

test('tracking requires a private credential and resists order-reference enumeration', async () => {
  const [endpoint, token] = await Promise.all([
    source('../supabase/functions/track-order/index.ts'),
    source('../supabase/functions/_shared/guestOrderToken.ts'),
  ]);
  assert.match(endpoint, /\(!usesPhone && !usesToken\)/);
  assert.match(endpoint, /constantTimeTokenMatch\(trackingToken, expectedToken\)/);
  assert.match(endpoint, /phone === storedPhone/);
  assert.match(endpoint, /referenceRateKey\(orderNumber\)/);
  assert.match(endpoint, /maximum_hits: 40/);
  assert.match(endpoint, /if \(!authorized\) return notFound/);
  assert.match(endpoint, /ORDER_NOT_FOUND/);
  assert.doesNotMatch(endpoint, /return json\(\{ success: true, order: safeOrder, trackingToken: expectedToken/);
  assert.match(endpoint, /\.\.\.\(usesPhone \? \{ trackingToken: expectedToken \} : \{\}\)/);
  assert.match(token, /HMAC/);
  assert.match(token, /timingSafeEqual|constantTimeTokenMatch/);
});

test('private order tables and RPCs are not callable by anonymous clients', async () => {
  const [checkoutMigration, trackingMigration, repairMigration] = await Promise.all([
    source('../supabase/migrations/202608130002_checkout_integrity.sql'),
    source('../supabase/migrations/202608150002_production_order_tracking.sql'),
    source('../supabase/migrations/202608200001_repair_customer_account_schema.sql'),
  ]);
  assert.match(checkoutMigration, /revoke all on function public\.create_commerce_order.*from public, anon, authenticated/s);
  assert.match(trackingMigration, /revoke all on function public\.track_commerce_order\(text, text\) from public, anon, authenticated/);
  assert.match(repairMigration, /create policy "Users read own orders"[\s\S]*user_id = auth\.uid\(\)/);
  assert.doesNotMatch(repairMigration, /create policy "Users read own orders"[\s\S]{0,180}to anon/);
});

test('checkout retry and refresh paths preserve order integrity', async () => {
  const [client, context, transaction] = await Promise.all([
    source('../src/services/orderService.ts'),
    source('../src/commerce/ShoppingContext.tsx'),
    source('../supabase/migrations/202608130002_checkout_integrity.sql'),
  ]);
  assert.match(client, /pending&&pending\.owner===owner&&pending\.fingerprint===currentFingerprint\)return pending\.key/);
  assert.doesNotMatch(client, /Date\.now\(\)-pending\.createdAt<24/);
  assert.match(client, /pendingOrderRequests\.get\(requestFingerprint\)/);
  assert.match(client, /maxAttempts:1/);
  assert.match(context, /reconcileBag\(lines,products\)/);
  assert.match(context, /item\.enabled&&\(item\.stock===null\|\|item\.stock>0\)/);
  assert.match(transaction, /pg_advisory_xact_lock/);
  assert.match(transaction, /for update of pv/);
  assert.match(transaction, /PRICE_CHANGED/);
  assert.match(transaction, /OUT_OF_STOCK/);
  assert.match(transaction, /IDEMPOTENCY_PAYLOAD_MISMATCH/);
});

test('untrusted tracking responses cannot enter My Orders unchecked', async () => {
  const [service, page] = await Promise.all([
    source('../src/services/orderTrackingService.ts'),
    source('../App.tsx'),
  ]);
  assert.match(service, /normalizeTrackedOrderResponse\(response: unknown\)/);
  assert.match(service, /TRACKING_STATUSES\.has\(status\)/);
  assert.match(service, /INVALID_TRACKING_RESPONSE/);
  assert.match(service, /items\.length <= 100/);
  assert.match(page, /savedLoadSequence/);
  assert.match(page, /AppState\.currentState!==['"]active['"]/);
  assert.match(page, /inFlight/);
  assert.doesNotMatch(page, /\[openOrderNumber,savedOrders\]/);
});

test('tracking credentials stay out of logs and URLs', async () => {
  const [client, endpoint] = await Promise.all([
    source('../src/services/orderTrackingService.ts'),
    source('../supabase/functions/track-order/index.ts'),
  ]);
  assert.match(client, /method:'POST'/);
  assert.doesNotMatch(client, /trackingToken=.*\?/);
  const logLine = endpoint.split('\n').find(line => line.includes("event: 'track_order_failed'")) || '';
  assert.ok(logLine);
  assert.doesNotMatch(logLine, /trackingToken/);
  assert.match(logLine, /credential:/);
});
