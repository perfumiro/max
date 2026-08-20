import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('guest checkout survives authentication without losing the intended page', async () => {
  const [app, navigation, auth] = await Promise.all([
    read('App.tsx'),
    read('src/navigation/customerCommerceNavigation.ts'),
    read('src/account/CustomerAuthContext.tsx'),
  ]);

  assert.match(app, /previewCommercePage==='checkout'/);
  assert.match(app, /rememberProtectedCommercePath\(next\)/);
  assert.match(app, /clearProtectedCommercePath\(\)/);
  assert.match(app, /onCheckout=\{\(\)=>navigateCommerce\('checkout'\)\}/);
  assert.doesNotMatch(app, /!session&&\(commercePage==='checkout'\|\|commercePage==='wishlist'\)/);
  assert.match(navigation, /page: destination/);
  assert.match(navigation, /history\?\.replaceState/);
  assert.match(auth, /current !== destination\) window\.location\.replace\(destination\)/);
});

test('guest customers can submit checkout while the server keeps authoritative order writes', async () => {
  const [client, checkout, edge, migration] = await Promise.all([
    read('src/services/orderService.ts'),
    read('src/commerce/CommercePages.tsx'),
    read('supabase/functions/create-order/index.ts'),
    read('supabase/migrations/202608150001_guest_checkout.sql'),
  ]);
  assert.doesNotMatch(client, /Please sign in or create an account before checkout/);
  assert.match(client, /headers:\{apikey:supabaseKey,'Content-Type':'application\/json',\.\.\.\(token\?\{Authorization:`Bearer \$\{token\}`\}:\{\}\)\}/);
  assert.match(client, /error\.status!==401/);
  assert.match(client, /order=await submitCompatibleOrder\(''\)/);
  assert.match(client, /normalizeCompletedOrder/);
  assert.match(client, /INVALID_ORDER_CONFIRMATION/);
  assert.match(checkout, /onComplete\(order\);\s*clearBag\(\)/);
  assert.match(checkout, /session\?\.access_token\s*\|\|\s*["']/);
  assert.match(edge, /authenticatedUser \? 25 : 8/);
  assert.match(edge, /p_user_id: authenticatedUser\?\.id \|\| null/);
  assert.match(edge, /sendOrderNotifications/);
  assert.match(migration, /Guest orders intentionally use a null user_id/);
});

test('successful guest orders open the confirmation and guest tracking experiences safely', async () => {
  const [app, checkout, service] = await Promise.all([
    read('App.tsx'),
    read('src/commerce/CommercePages.tsx'),
    read('src/services/orderService.ts'),
  ]);
  assert.match(app, /setHelpDestination\('track'\);activeRef\.current='Help';setActive\('Help'\)/);
  assert.match(app, /<ThankYouPage/);
  assert.match(service, /raw\.orderNumber\?\?raw\.order_number/);
  assert.match(service, /Number\.isFinite\(total\)/);
});
