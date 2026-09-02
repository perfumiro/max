import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/202609010001_preorder_requests.sql');
const createApi = read('supabase/functions/create-preorder/index.ts');
const adminApi = read('supabase/functions/admin-preorders/index.ts');
const adminService = read('src/services/adminService.ts');
const preorderService = read('src/services/preorderService.ts');
const catalog = read('src/sharedCatalog.ts');
const app = read('App.tsx');
const dashboard = read('src/admin/AdminDashboard.tsx');
const config = read('supabase/config.toml');

test('preorders persist in one private canonical table without becoming orders', () => {
  assert.match(migration, /create table if not exists public\.preorder_requests/);
  assert.match(migration, /revoke all on public\.preorder_requests from anon, authenticated/);
  assert.match(migration, /grant all on public\.preorder_requests to service_role/);
  assert.doesNotMatch(createApi, /from\(['"]orders['"]\)|create_commerce_order|payment_method/);
  assert.match(createApi, /from\('preorder_requests'\)/);
  assert.match(adminApi, /from\('preorder_requests'\)/);
});

test('guest and Firebase-admin requests reach functions that enforce their own authorization', () => {
  assert.match(config, /\[functions\.create-preorder\]\s+verify_jwt = false/);
  assert.match(config, /\[functions\.admin-preorders\]\s+verify_jwt = false/);
  assert.match(adminApi, /verifyFirebaseStaff/);
  assert.match(adminApi, /if \(!staff\).*401/);
  assert.match(createApi, /verify product is not accepting|PREORDER_NOT_ALLOWED|preorder_enabled/);
});

test('server validates availability, global control, identity and duplicate submissions', () => {
  assert.match(createApi, /value\?\.preorders\?\.enabled === false/);
  assert.match(createApi, /PRODUCT_AVAILABLE/);
  assert.match(createApi, /product\.stock_left === null/);
  assert.match(createApi, /phonePattern/);
  assert.match(createApi, /idempotencyPattern/);
  assert.match(migration, /preorder_requests_open_customer_product_unique/);
  assert.match(createApi, /error\?\.code === '23505'/);
});

test('web and native clients use the same remote endpoint and durable retry identity', () => {
  assert.match(preorderService, /functions\/v1\/create-preorder/);
  assert.match(preorderService, /Platform\.OS === 'web' \? 'website' : 'mobile_app'/);
  assert.match(preorderService, /SecureStore\.getItemAsync/);
  assert.match(preorderService, /localStorage\.getItem/);
  assert.doesNotMatch(preorderService, /preorderRequests\s*=\s*\[/);
  assert.match(app, /createPreorder\(/);
});

test('catalogue and admin share product and global controls with persisted management', () => {
  assert.match(catalog, /preorder_enabled/);
  assert.match(catalog, /store_settings\?select=/);
  assert.match(app, /canPreorder=!availableSizes\.length&&product\.preorderEnabled===true/);
  assert.match(dashboard, /PREORDER SETTINGS/);
  assert.match(dashboard, /GLOBAL ON/);
  assert.match(dashboard, /setInterval\(\(\) => void reload\(\), 10_000\)/);
  assert.match(adminService, /functions?\/v1|edgeFunctionConfig\("admin-preorders"\)/);
  assert.match(adminApi, /admin_notes/);
  assert.match(dashboard, /tel:\$\{selected\.phone\}/);
  assert.match(dashboard, /https:\/\/wa\.me/);
});

test('private admin notes are never selected or returned by the customer endpoint', () => {
  assert.doesNotMatch(createApi, /admin_notes/);
  assert.doesNotMatch(catalog, /admin_notes|preorder_admin_note/);
  assert.match(migration, /admin_notes text/);
});
