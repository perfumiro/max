import assert from 'node:assert/strict';

const url = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || '');
assert.equal(url.origin, 'https://gdgrskgegrcgmzswefmn.supabase.co', 'Expo must use the same production database as the website');
assert.ok(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'), 'A public Supabase client key is required');
assert.notEqual(process.env.EXPO_PUBLIC_FIREBASE_ORDER_API_ENABLED, 'true', 'Checkout must use the deployed canonical Supabase API');
const dashboard = new URL(process.env.EXPO_PUBLIC_ADMIN_DASHBOARD_URL || '');
assert.equal(dashboard.protocol, 'https:');
assert.equal(dashboard.hostname, 'ipordise.com');
const response = await fetch(`${url.origin}/rest/v1/products?active=eq.true&select=id,price_coming_soon,preorder_enabled&limit=1`, {
  headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(20_000),
});
assert.equal(response.status, 200, 'The release environment must read the current catalog schema');
assert.ok((await response.json()).length, 'The release environment must see published products');
console.log(JSON.stringify({ ok: true, environment: 'production', sharedAppAndSiteApi: url.origin, publishedCatalogAccessible: true }));
