import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('app catalog uses the exact canonical variants accepted by checkout', async () => {
  const [catalog, app, snapshot] = await Promise.all([
    read('../src/sharedCatalog.ts'),
    read('../App.tsx'),
    read('../src/generated/catalogSnapshot.json').then(JSON.parse),
  ]);
  assert.match(catalog, /product_variants\?select=/);
  assert.match(catalog, /productFromSupabase\(row, variantRows\)/);
  assert.match(catalog, /id: String\(row\.id \|\| ''\)/);
  assert.match(catalog, /price = Number\(row\.price_minor\) \/ 100/);
  assert.match(catalog, /loadBundledProducts/);
  assert.match(app, /useState<Product\[\]>\(\(\) => loadBundledProducts\(\)\)/);
  assert.ok(snapshot.products.length > 0);
  assert.ok(snapshot.variants.length > 0);
});

test('app and website orders use the same Supabase order and admin pipeline', async () => {
  const [client, checkout, admin] = await Promise.all([
    read('../src/services/orderService.ts'),
    read('../supabase/functions/create-order/index.ts'),
    read('../supabase/functions/admin-orders/index.ts'),
  ]);
  assert.match(client, /functions\/v1\/create-order/);
  assert.match(client, /source:Platform\.OS==='web'\?'website':'mobile_app'/);
  assert.match(checkout, /admin\.rpc\('create_commerce_order_safe'/);
  assert.match(admin, /admin\.from\('orders'\)/);
});

test('successful orders notify the boutique and customer with provider fallback', async () => {
  const checkout = await read('../supabase/functions/create-order/index.ts');
  assert.match(checkout, /DEFAULT_BOUTIQUE_EMAIL/);
  assert.match(checkout, /to: boutiqueEmail/);
  assert.match(checkout, /to: customer\.email/);
  assert.match(checkout, /if \(emailJsConfigured && message\.templateId\)/);
  assert.match(checkout, /if \(resendConfigured\)/);
  assert.match(checkout, /notification_status: notificationStatus/);
});

test('web deployment publishes the newly generated Expo output', async () => {
  const [vercel, packageJson] = await Promise.all([read('../vercel.json'), read('../package.json')]);
  assert.equal(JSON.parse(vercel).outputDirectory, 'out');
  assert.match(JSON.parse(packageJson).scripts['build:web'], /--output-dir out/);
});

test('release API health check validates canonical products and variants', async () => {
  const healthCheck = await read('../scripts/check-catalog-api.mjs');
  assert.match(healthCheck, /mode: 'supabase-canonical-commerce'/);
  assert.match(healthCheck, /product_variants\?enabled=eq\.true/);
  assert.match(healthCheck, /invalid or orphaned variants/);
  assert.doesNotMatch(healthCheck, /firebase-shared-runtime/);
});
