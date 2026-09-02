import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/202608130001_unified_commerce.sql', import.meta.url);
const checkoutPath = new URL('../supabase/functions/create-order/index.ts', import.meta.url);
const adminOrdersPath = new URL('../supabase/functions/admin-orders/index.ts', import.meta.url);
const catalogPath = new URL('../src/sharedCatalog.ts', import.meta.url);
const orderServicePath = new URL('../src/services/orderService.ts', import.meta.url);
const adminCatalogPath = new URL('../supabase/functions/admin-catalog-sync/index.ts', import.meta.url);
const productionAdminPath = new URL('../website-ipordise/assets/admin/admin.js', import.meta.url);
const integrityMigrationPath = new URL('../supabase/migrations/202608130002_checkout_integrity.sql', import.meta.url);
const secondPassMigrationPath = new URL('../supabase/migrations/202608130003_second_pass_hardening.sql', import.meta.url);
const adminCustomersPath = new URL('../supabase/functions/admin-customers/index.ts', import.meta.url);

test('checkout uses a locked variant transaction and server-owned totals', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /for update of pv/i);
  assert.match(sql, /price_minor \* v_quantity/i);
  assert.match(sql, /stock_quantity = stock_quantity - v_quantity/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /idempotency_key = p_idempotency_key/i);
  assert.match(sql, /v_existing\.user_id is distinct from p_user_id/i);
  assert.match(sql, /stock_quantity integer check \(stock_quantity is null or stock_quantity >= 0\)/i);
});

test('order snapshots, cancellation restoration and status history are persisted', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const field of ['productId', 'variantId', 'productName', 'size', 'format', 'unitPriceMinor', 'lineTotalMinor']) {
    assert.match(sql, new RegExp(`'${field}'`));
  }
  assert.match(sql, /inventory_released/i);
  assert.match(sql, /order_status_history/i);
  assert.match(sql, /stock_quantity = stock_quantity \+ greatest/i);
  assert.match(sql, /INVALID_STATUS_TRANSITION/i);
});

test('edge checkout accepts IDs, maps commerce conflicts and records a bounded client source', async () => {
  const source = await readFile(checkoutPath, 'utf8');
  assert.match(source, /variantId/);
  assert.match(source, /expectedUnitPriceMinor/);
  assert.match(source, /PRICE_CHANGED/);
  assert.match(source, /OUT_OF_STOCK/);
  assert.match(source, /payload\.source !== 'website' && payload\.source !== 'mobile_app'/);
  assert.match(source, /const source = payload\.source/);
  assert.doesNotMatch(source, /payload\.price/);
});

test('admin order transitions use the transactional status function', async () => {
  const source = await readFile(adminOrdersPath, 'utf8');
  assert.match(source, /transition_commerce_order/);
  assert.match(source, /pageSize/);
  assert.match(source, /order_status_history/);
});

test('staff can permanently remove an order through the protected audited endpoint', async () => {
  const source = await readFile(adminOrdersPath, 'utf8');
  assert.match(source, /'GET, PATCH, DELETE, OPTIONS'/);
  assert.match(source, /verifyFirebaseStaff/);
  assert.match(source, /request\.method === 'DELETE'/);
  assert.match(source, /admin\.from\('orders'\)\.delete\(\)\.eq\('id', id\)/);
  assert.match(source, /action: 'order\.delete'/);
  assert.match(source, /ORDER_HAS_VERIFIED_REVIEW/);
});

test('mobile catalog reads canonical Supabase products and starts from a canonical build snapshot', async () => {
  const source = await readFile(catalogPath, 'utf8');
  assert.match(source, /loadSupabaseProducts/);
  assert.match(source, /products\?select=/);
  assert.match(source, /sizes,original_prices,stock_left/);
  assert.match(source, /return await loadSupabaseProducts\(\)/);
  assert.match(source, /catalogSnapshot/);
  assert.match(source, /loadBundledProducts/);
  assert.match(source, /commerce_catalog_unavailable_using_bundled_snapshot/);
  assert.match(source, /if \(bundledProducts\.length\) return bundledProducts/);
  assert.doesNotMatch(source, /using_migration_fallback|catalog_offline_cache_used/);
});

test('client and server survive duplicate and ambiguous checkout submissions', async () => {
  const [client,edge]=await Promise.all([readFile(orderServicePath,'utf8'),readFile(checkoutPath,'utf8')]);
  assert.match(client,/pendingOrderRequests/);
  assert.match(client,/checkoutOwnerKey/);
  assert.match(client,/await clearPendingAttempt\(\)/);
  assert.match(client,/legacyProductValidation/);
  assert.match(client,/submitOrder\(token,legacyRequestBody\)/);
  assert.match(client,/items:bag\.map\(line=>\(\{productId:line\.product\.id,size:line\.size\|\|null,quantity:line\.quantity\}\)\)/);
  assert.match(edge,/if \(!checkoutResult\.replayed\)/);
  assert.match(edge,/order_risk_lookup_failed/);
});

test('published product reads and admin catalogue queries are bounded', async () => {
  const [sql,admin]=await Promise.all([readFile(migrationPath,'utf8'),readFile(adminCatalogPath,'utf8')]);
  assert.match(sql,/Public reads published products/);
  assert.match(sql,/active and publication_status = 'active'/);
  assert.match(admin,/positiveInteger\(search\.get\('pageSize'\), 50, 100\)/);
  assert.match(admin,/pagination: \{ page, pageSize, total/);
  assert.match(admin,/publicationStatus/);
  assert.match(admin,/active: false, publication_status: 'draft'/);
  assert.match(admin,/publishError/);
  assert.match(admin,/enabled: published && Number\(price\) > 0/);
  assert.match(admin,/defaultToNull: false/);
});

test('hostile checkout replays and duplicate variants are rejected at both boundaries', async () => {
  const [edge, sql] = await Promise.all([readFile(checkoutPath, 'utf8'), readFile(integrityMigrationPath, 'utf8')]);
  assert.match(edge, /hasOnlyKeys\(payload/);
  assert.match(edge, /DUPLICATE_ITEM/);
  assert.match(edge, /Number\.isSafeInteger\(item\.expectedUnitPriceMinor\)/);
  assert.match(edge, /p_request_hash: requestHash/);
  assert.match(sql, /v_existing\.request_hash <> p_request_hash/i);
  assert.match(sql, /IDEMPOTENCY_PAYLOAD_MISMATCH/i);
  assert.match(sql, /group by item->>'variantId' having count\(\*\) > 1/i);
  assert.match(sql, /where id = v_variant\.id and stock_quantity >= v_quantity/i);
});

test('support creation is atomic and external order email calls are time bounded', async () => {
  const [edge, support, sql] = await Promise.all([
    readFile(checkoutPath, 'utf8'),
    readFile(new URL('../supabase/functions/support-inbox/index.ts', import.meta.url), 'utf8'),
    readFile(integrityMigrationPath, 'utf8'),
  ]);
  assert.match(edge, /fetchWithTimeout/);
  assert.match(support, /rpc\('create_support_conversation'/);
  assert.match(sql, /insert into public\.support_conversations[\s\S]*insert into public\.support_messages/i);
});

test('the production static Admin uses canonical products and orders', async () => {
  const source=await readFile(productionAdminPath,'utf8');
  assert.match(source,/fetchSupabaseAdminOrders/);
  assert.match(source,/updateSupabaseOrderStatus/);
  assert.match(source,/result\.orders\.map\(supabaseRowToAdminOrder\)/);
  assert.match(source,/const newSlug = originalSlug/);
  assert.match(source,/createOnly: true/);
  assert.match(source,/pageSize: '100'/);
  assert.match(source,/ordersApiPagination/);
  assert.match(source,/params\.set\('status', status\)/);
  assert.match(source,/params\.set\('q', q\)/);
});

test('legacy checkout keys are bound and support replies are atomic', async () => {
  const [sql, support] = await Promise.all([
    readFile(secondPassMigrationPath, 'utf8'),
    readFile(new URL('../supabase/functions/support-inbox/index.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(sql, /set request_hash = encode\(digest\(idempotency_key \|\| ':legacy-order'/i);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(lower\(p_email\)/i);
  assert.match(sql, /create or replace function public\.append_support_message/i);
  assert.match(sql, /for update[\s\S]*insert into public\.support_messages[\s\S]*update public\.support_conversations/i);
  assert.match(support, /rpc\('append_support_message'/);
  assert.doesNotMatch(support, /from\('support_messages'\)\.insert/);
});

test('rate-limit storage and persisted customer state are bounded', async () => {
  const sql = await readFile(secondPassMigrationPath, 'utf8');
  assert.match(sql, /least\(limits\.hits \+ 1, maximum_hits \+ 1\)/i);
  assert.match(sql, /delete from public\.api_rate_limits where window_started_at < now\(\) - interval '8 days'/i);
  assert.match(sql, /jsonb_array_length\(value\) > 100/i);
  assert.match(sql, /quantity'\)::integer not between 1 and 20/i);
  assert.match(sql, /customer_wishlist_product_fk[\s\S]*on delete cascade/i);
  assert.match(sql, /customer_addresses_user_default_created_idx/i);
  assert.match(sql, /phone ~ '\^\[\+0-9\(\) \.\-\]\+\$'/i);
});

test('customer administration is staff-only, paginated, and canonical', async () => {
  const [edge, sql, admin] = await Promise.all([
    readFile(adminCustomersPath, 'utf8'),
    readFile(secondPassMigrationPath, 'utf8'),
    readFile(productionAdminPath, 'utf8'),
  ]);
  assert.match(edge, /verifyFirebaseStaff/);
  assert.match(edge, /positiveInteger\(search\.get\('pageSize'\), 50, 100\)/);
  assert.match(edge, /rpc\('list_admin_customers'/);
  assert.match(sql, /revoke all on function public\.list_admin_customers[\s\S]*anon, authenticated/i);
  assert.match(admin, /fetchSupabaseAdminCustomers/);
  assert.match(admin, /SUPABASE_CUSTOMERS_URL/);
  assert.doesNotMatch(admin, /getDocs\(collection\(db, 'users'\)\)/);
  assert.match(admin, /customersPrevBtn/);
  assert.match(admin, /customersNextBtn/);
});

test('staff verification fails closed and requires verified email', async () => {
  const security = await readFile(new URL('../supabase/functions/_shared/security.ts', import.meta.url), 'utf8');
  assert.match(security, /if \(!apiKey \|\| allowedEmails\.size === 0\) return null/);
  assert.match(security, /user\?\.emailVerified !== true/);
  assert.doesNotMatch(security, /admin@ipordise\.com/);
});

test('checkout replays retry observable idempotent notifications', async () => {
  const edge = await readFile(checkoutPath, 'utf8');
  assert.match(edge, /notification_status \|\| 'pending'\) !== 'sent'/);
  assert.match(edge, /'Idempotency-Key': message\.key/);
  assert.match(edge, /checkoutResult\.replayed\s*\? \{ notification_status: notificationStatus \}/);
  assert.match(edge, /emailJsConfigured && message\.templateId/);
  assert.match(edge, /EMAILJS_ADMIN_TEMPLATE_ID/);
  assert.match(edge, /EMAILJS_CUSTOMER_TEMPLATE_ID/);
});

test('database bootstrap endpoint is a non-mutating tombstone', async () => {
  const source = await readFile(new URL('../supabase/functions/bootstrap-order-system/index.ts', import.meta.url), 'utf8');
  assert.match(source, /status: 410/);
  assert.match(source, /ENDPOINT_RETIRED/);
  assert.doesNotMatch(source, /SUPABASE_DB_URL|MIGRATION_TOKEN|transaction\.unsafe|create table/i);
});
