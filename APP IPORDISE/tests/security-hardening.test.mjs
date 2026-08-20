import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/202608050001_security_hardening.sql', import.meta.url);
const functionUrl = new URL('../supabase/functions/admin-catalog-sync/index.ts', import.meta.url);
const supportMigrationUrl = new URL('../supabase/migrations/202608060001_support_inbox.sql', import.meta.url);
const supportFunctionUrl = new URL('../supabase/functions/support-inbox/index.ts', import.meta.url);
const orderMigrationUrl = new URL('../supabase/migrations/202608060002_order_checkout.sql', import.meta.url);
const orderFunctionUrl = new URL('../functions/index.js', import.meta.url);
const trackingFunctionUrl = orderFunctionUrl;
const adminOrdersFunctionUrl = orderFunctionUrl;
const smartOrderMigrationUrl = new URL('../supabase/migrations/202608110002_smart_order_security.sql', import.meta.url);

test('security migration uses database-backed roles and user-owned records', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /create table if not exists public\.admin_users/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /orders_idempotency_idx/i);
  assert.match(sql, /admin_audit_logs/i);
  assert.match(sql, /grant execute on function public\.is_ipordise_admin\(\) to anon, authenticated/i);
});

test('admin sync validates roles, payload size, ids, and hides internal errors', async () => {
  const [source,security] = await Promise.all([readFile(functionUrl, 'utf8'),readFile(new URL('../supabase/functions/_shared/security.ts',import.meta.url),'utf8')]);
  assert.doesNotMatch(source, /const ADMIN_EMAIL/);
  assert.match(source, /MAX_BODY_BYTES/);
  assert.match(source, /readJsonObject\(request, MAX_BODY_BYTES\)/);
  assert.match(source, /verifyFirebaseStaff/);
  assert.match(source, /consumeRateLimit/);
  assert.match(security, /ADMIN_EMAILS/);
  assert.match(security, /rejectUntrustedOrigin/);
  assert.match(source, /crypto\.randomUUID/);
  assert.match(source, /error: detail \? `Catalog sync failed: \$\{detail\}` : 'Catalog sync failed', requestId/);
});

test('support inbox keeps customer threads token-protected and staff-authorized', async () => {
  const [sql, source] = await Promise.all([
    readFile(supportMigrationUrl, 'utf8'),
    readFile(supportFunctionUrl, 'utf8'),
  ]);
  assert.match(sql, /client_token_hash text not null unique/i);
  assert.match(sql, /has_ipordise_role\(array\['admin','support'\]\)/i);
  assert.match(sql, /alter table public\.support_messages enable row level security/i);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/i);
  assert.match(source, /verifyFirebaseStaff/i);
  assert.match(source, /support:admin:\$\{staff\.uid\}/i);
  assert.match(source, /Message limit reached/i);
  assert.match(source, /select\('id,status,subject'\)/i);
  assert.doesNotMatch(source, /select\('[^']*client_token_hash[^']*'\)/i);
});

test('checkout creates idempotent orders from server-authoritative catalog prices', async () => {
  const [sql, source, rules] = await Promise.all([
    readFile(orderMigrationUrl, 'utf8'),
    readFile(orderFunctionUrl, 'utf8'),
    readFile(new URL('../website-ipordise/firestore.rules', import.meta.url), 'utf8'),
  ]);
  assert.match(sql, /revoke insert on public\.orders from anon, authenticated/i);
  assert.match(source, /idempotencyKey/i);
  assert.match(source, /collection\('products'\)/i);
  assert.match(source, /product\.sizes/i);
  assert.match(source, /delivery_fee/i);
  assert.match(source, /createHash\('sha256'\).*update\(key\)/i);
  assert.match(source, /runTransaction/i);
  assert.match(source, /consumeRateLimit\(request, 'create-order', 10, 900\)/i);
  assert.match(rules, /match \/orders\/\{orderId\}[\s\S]*allow create: if false/);
  assert.doesNotMatch(source, /item\.unitPrice|item\.price/i);
});

test('admin order API reads and updates the same protected orders used by customer accounts', async () => {
  const source = await readFile(adminOrdersFunctionUrl, 'utf8');
  assert.match(source, /getAuth\(\)\.verifyIdToken\(token, true\)/i);
  assert.match(source, /ADMIN_EMAIL/i);
  assert.match(source, /collection\('orders'\)/i);
  assert.match(source, /STATUS_TRANSITIONS\[currentStatus\]/i);
  assert.match(source, /This order status transition is not allowed/i);
  assert.doesNotMatch(source, /service[_-]role/i);
});

test('smart order review signals are server-derived, private, and indexed for operations', async () => {
  const [checkout, migration, account, rules] = await Promise.all([
    readFile(orderFunctionUrl, 'utf8'),
    readFile(smartOrderMigrationUrl, 'utf8'),
    readFile(new URL('../src/services/customerAccountService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../website-ipordise/firestore.rules', import.meta.url), 'utf8'),
  ]);
  assert.match(checkout, /high_order_value/);
  assert.match(checkout, /bulk_quantity/);
  assert.match(checkout, /risk_score: riskScore/);
  assert.match(checkout, /notification_status: 'pending'/);
  assert.match(migration, /risk_score integer not null default 0/i);
  assert.match(migration, /orders_risk_created_idx/i);
  assert.doesNotMatch(account, /risk_score|risk_flags|notification_status/);
  assert.match(rules, /match \/orders\/\{orderId\}[\s\S]*allow create: if false/);
});

test('order tracking requires both a valid order number and matching phone', async () => {
  const source = await readFile(trackingFunctionUrl, 'utf8');
  assert.match(source, /orderNumber/);
  assert.match(source, /customer\?\.phone/);
  assert.match(source, /No matching order was found/i);
  assert.match(source, /consumeRateLimit\(request, 'track-order'/i);
  assert.doesNotMatch(source, /service_role[^_]/i);
});

test('Firebase order operations reserve stock and preserve immutable audit history', async () => {
  const [source, rules] = await Promise.all([
    readFile(orderFunctionUrl, 'utf8'),
    readFile(new URL('../website-ipordise/firestore.rules', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /MAX_CHECKOUT_BODY_BYTES/);
  assert.match(source, /requestedQuantityByProduct/);
  assert.match(source, /transaction\.update\(snapshot\.ref/);
  assert.match(source, /status === 'cancelled'/);
  assert.match(source, /order_audit_logs/);
  assert.match(source, /data_classification: 'customer_private'/);
  assert.match(source, /verifyIdToken\(token, true\)/);
  assert.match(rules, /match \/order_audit_logs\/\{auditId\}[\s\S]*allow write: if false/);
  assert.match(rules, /match \/_apiRateLimits\/\{document=\*\*\}[\s\S]*allow read, write: if false/);
});

test('Firebase checkout records and safely retries the private admin email notification', async () => {
  const source = await readFile(orderFunctionUrl, 'utf8');
  assert.match(source, /ORDER_NOTIFICATION_EMAIL = 'perfumiro@gmail\.com'/);
  assert.match(source, /secrets: \['RESEND_API_KEY', 'RESEND_FROM_EMAIL'\]/);
  assert.match(source, /Idempotency-Key.*ipordise-order-/s);
  assert.match(source, /notification_status: notificationStatus/);
  assert.match(source, /notification_updated_at: Timestamp\.now\(\)/);
  assert.match(source, /if \(order\.notification_status === 'sent'\) return 'sent'/);
  assert.doesNotMatch(source, /console\.(?:info|log).*customer/i);
});

test('checkout retries reuse a private idempotency key until Firebase confirms the order', async () => {
  const source = await readFile(new URL('../src/services/orderService.ts', import.meta.url), 'utf8');
  assert.match(source, /IDEMPOTENCY_STORAGE_KEY/);
  assert.match(source, /pending\.fingerprint===currentFingerprint/);
  assert.match(source, /24\*60\*60\*1000/);
  assert.match(source, /await clearPendingAttempt\(\)/);
  assert.match(source, /timeoutMs:45_000,\s*maxAttempts:1/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^,]+,\s*JSON\.stringify\(orderPayload\)/);
});

test('checkout, tracking and admin orders use the canonical Supabase backend', async () => {
  const [checkout, tracking, admin] = await Promise.all([
    readFile(new URL('../src/services/orderService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/orderTrackingService.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/adminService.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(checkout, /supabaseUrl}\/functions\/v1\/create-order/);
  assert.doesNotMatch(checkout, /firebaseFunctionsUrl}\/createOrder/);
  assert.match(checkout, /Authorization:`Bearer \$\{token\}`/);
  assert.match(checkout, /createOrder\(customer: CheckoutCustomer, bag: BagLine\[\], accessToken: string/);
  assert.match(tracking, /supabaseUrl}\/functions\/v1\/track-order/);
  assert.match(admin, /edgeFunctionConfig\(["']admin-orders["']\)/);
  assert.doesNotMatch(admin, /firebaseFunctionsUrl}\/adminOrders/);
});

test('shared API hardening rejects hostile origins and unsafe retry defaults', async () => {
  const [security, client] = await Promise.all([
    readFile(new URL('../supabase/functions/_shared/security.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/apiClient.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(security, /originAllowed/);
  assert.match(security, /Content-Security-Policy/);
  assert.match(security, /Strict-Transport-Security/);
  assert.match(security, /'Cross-Origin-Resource-Policy': 'cross-origin'/);
  assert.doesNotMatch(security, /'Cross-Origin-Resource-Policy': 'same-site'/);
  assert.match(security, /rejectNonJson/);
  assert.match(security, /bearerToken/);
  assert.match(security, /cf-connecting-ip/);
  assert.match(client, /retrySafe=\['GET','HEAD','OPTIONS'\]\.includes\(method\)\|\|headers\.has\('Idempotency-Key'\)/);
  assert.match(client, /credentials:'omit'/);
  assert.match(client, /redirect:'error'/);
});

test('legacy administration fails closed and cannot send client-authored order confirmations', async () => {
  const [server, rules, checkout] = await Promise.all([
    readFile(new URL('../website-ipordise/backend/src/server.js', import.meta.url), 'utf8'),
    readFile(new URL('../website-ipordise/firestore.rules', import.meta.url), 'utf8'),
    readFile(new URL('../website-ipordise/pages/checkout.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(server, /JWT_SECRET = process\.env\.JWT_SECRET \|\|/);
  assert.match(server, /jwtConfigured/);
  assert.match(server, /consumeLoginAttempt/);
  assert.match(server, /endpoint has been retired/i);
  assert.match(rules, /request\.auth\.uid == resource\.data\.uid/);
  assert.match(checkout, /window\.location\.replace\('\/app'\)/);
});
