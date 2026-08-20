import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('public tracking API is rate-limited, generic on mismatch, and delegates to a safe database projection', async () => {
  const edge = await read('../supabase/functions/track-order/index.ts');
  assert.match(edge, /consumeRateLimit\(admin, request, 'track-order', 12, 900\)/);
  assert.match(edge, /code: 'ORDER_NOT_FOUND'/);
  assert.match(edge, /admin\.rpc\('track_commerce_order'/);
  assert.match(edge, /Retry-After/);
  assert.match(edge, /maskMoroccanPhone/);
  assert.doesNotMatch(edge, /\.from\('orders'\)/);
});

test('database migration enforces canonical identity, safe response fields, atomic history, and shipping state', async () => {
  const sql = await read('../supabase/migrations/202608150002_production_order_tracking.sql');
  assert.match(sql, /create or replace function public\.normalize_moroccan_phone/);
  assert.match(sql, /create trigger orders_canonical_customer_phone/);
  assert.match(sql, /create or replace function public\.track_commerce_order/);
  assert.match(sql, /revoke all on function public\.track_commerce_order\(text, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.track_commerce_order\(text, text\) to service_role/);
  assert.match(sql, /'ready_for_dispatch'.*'out_for_delivery'/s);
  assert.match(sql, /'return_requested'.*'delivery_failed'/s);
  assert.match(sql, /insert into public\.order_status_history/);
  assert.match(sql, /create or replace function public\.update_order_shipping/);
  const publicProjection = sql.slice(sql.indexOf("return jsonb_strip_nulls(jsonb_build_object("));
  assert.doesNotMatch(publicProjection, /'customer'|'address'|'phone'|'notes'|'risk'/);
});

test('checkout, tracking client, and admin use the production contracts', async () => {
  const [checkout, client, adminEdge, adminClient] = await Promise.all([
    read('../supabase/functions/create-order/index.ts'),
    read('../src/services/orderTrackingService.ts'),
    read('../supabase/functions/admin-orders/index.ts'),
    read('../src/services/adminService.ts'),
  ]);
  assert.match(checkout, /normalizeMoroccanPhone\(customer\.phone\)/);
  assert.match(client, /timeoutMs:12_000/);
  assert.match(client, /return response\.order/);
  assert.match(adminEdge, /admin\.rpc\('update_order_shipping'/);
  assert.match(adminEdge, /action: 'order\.shipping\.update'/);
  assert.match(adminClient, /updateAdminOrderShipping/);
});
