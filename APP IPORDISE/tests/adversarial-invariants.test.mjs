import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('checkout canonicalizes lock order and rejects unknown source enums', async () => {
  const [edge, sql] = await Promise.all([
    read('supabase/functions/create-order/index.ts'),
    read('supabase/migrations/202608130002_checkout_integrity.sql'),
  ]);
  assert.match(edge, /\.sort\(\(left, right\) => left\.variantId\.localeCompare\(right\.variantId\)\)/);
  assert.match(edge, /rpc\('create_commerce_order_safe'/);
  assert.match(sql, /jsonb_array_elements\(p_requested_items\)[\s\S]*order by value->>'variantId'/i);
  const upgrade = await read('supabase/migrations/202608130004_adversarial_invariants.sql');
  assert.match(upgrade, /create_commerce_order_safe/);
  assert.match(upgrade, /jsonb_agg\(item order by item->>'variantId'\)/i);
  assert.match(edge, /payload\.source !== 'website' && payload\.source !== 'mobile_app'/);
  assert.match(edge, /notification_status \|\| 'pending'\) !== 'sent'/);
});

test('customer workflow state cannot be forged or duplicated', async () => {
  const sql = await read('supabase/migrations/202608130004_adversarial_invariants.sql');
  assert.match(sql, /data_export_requests_create[\s\S]*status = 'requested'/i);
  assert.match(sql, /account_deletion_requests_create[\s\S]*status = 'requested'/i);
  assert.match(sql, /data_export_one_active_request[\s\S]*where status in \('requested', 'processing'\)/i);
  assert.match(sql, /account_deletion_one_active_request[\s\S]*where status in \('requested', 'reviewing'\)/i);
  assert.match(sql, /ADDRESS_LIMIT_REACHED/);
  assert.match(sql, /WISHLIST_LIMIT_REACHED/);
});

test('support and review abuse counters serialize on locked rows', async () => {
  const [sql, support, reviews] = await Promise.all([
    read('supabase/migrations/202608130004_adversarial_invariants.sql'),
    read('supabase/functions/support-inbox/index.ts'),
    read('supabase/functions/product-reviews/index.ts'),
  ]);
  assert.match(sql, /support_conversations where id = p_conversation_id for update/i);
  assert.match(sql, /SUPPORT_MESSAGE_RATE_LIMITED/);
  assert.match(sql, /product_review_verifications[\s\S]*for update/i);
  assert.match(sql, /set attempts = least\(8, attempts \+ 1\)/i);
  assert.match(support, /SUPPORT_MESSAGE_RATE_LIMITED/);
  assert.match(reviews, /rpc\('verify_product_review_code'/);
  assert.doesNotMatch(reviews, /attempts: Math\.min/);
});

test('admin operational data is canonical, bounded and observable', async () => {
  const [sql, orders, catalog, support, dashboard] = await Promise.all([
    read('supabase/migrations/202608130004_adversarial_invariants.sql'),
    read('supabase/functions/admin-orders/index.ts'),
    read('supabase/functions/admin-catalog-sync/index.ts'),
    read('supabase/functions/support-inbox/index.ts'),
    read('website-ipordise/assets/admin/admin.js'),
  ]);
  assert.match(sql, /add column if not exists admin_email text/i);
  assert.match(sql, /admin_order_revenue_summary/);
  assert.match(sql, /revoke insert, update, delete on public\.orders from authenticated/i);
  assert.match(orders, /view'\) === 'revenue'/);
  assert.match(orders, /admin_audit_write_failed/);
  assert.match(catalog, /admin_audit_write_failed/);
  assert.match(support, /admin_audit_write_failed/);
  assert.match(dashboard, /refreshCanonicalOrderNotifications/);
  assert.match(dashboard, /fetchSupabaseRevenueSummary/);
  assert.doesNotMatch(dashboard, /collection\(db, 'orders'\)/);
  assert.doesNotMatch(dashboard, /onSnapshot\(pendingQ/);
});

test('review totals use a database aggregate instead of a truncated page', async () => {
  const [sql, edge] = await Promise.all([
    read('supabase/migrations/202608130004_adversarial_invariants.sql'),
    read('supabase/functions/product-reviews/index.ts'),
  ]);
  assert.match(sql, /product_review_summary/);
  assert.match(sql, /count\(\*\) filter \(where rating = 5\)/i);
  assert.match(edge, /rpc\('product_review_summary'/);
  assert.doesNotMatch(edge, /const count = reviews\.length/);
});
