// Exercise the real staff API without creating products or notifying customers.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.IPORDISE_ADMIN_EMAIL;
const password = process.env.IPORDISE_ADMIN_PASSWORD;
if (!url || !key || !email || !password) throw new Error('Production API/admin configuration is missing');
const request = async (endpoint, options = {}) => {
  const response = await fetch(endpoint, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = new URL(endpoint).hostname.endsWith('.supabase.co') ? String(error.message || error.code || '').slice(0, 200) : '';
    throw new Error(`API check failed: HTTP ${response.status} at ${new URL(endpoint).pathname}${detail ? ` (${detail})` : ''}`);
  }
  return response.json();
};
const login = await request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
});
const headers = { apikey: key, Authorization: `Bearer ${login.idToken}`, Origin: 'https://ipordise.com', 'Content-Type': 'application/json' };
let draftPriceOptionVerified = false;
let appWebsiteMirrorVerified = false;
if (process.argv.includes('--verify-app-mirror')) {
  const service = await readFile(new URL('../src/services/adminService.ts', import.meta.url), 'utf8');
  const source = service.slice(service.indexOf('const decodeValue ='), service.indexOf('type AdminPage<T>'));
  const compiled = ts.transpileModule(source + '\nglobalThis.sync = syncCatalogProduct;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const root = 'https://firestore.googleapis.com/v1/projects/ipordise-aef54/databases/(default)/documents';
  const context = vm.createContext({ fetch, URLSearchParams,
    firebaseConfig: () => ({ root, key: 'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4' }), edgeFunctionConfig: () => ({ url: `${url}/functions/v1/admin-catalog-sync`, key }),
    parseResponse: async response => { if (!response.ok) throw new Error(`App publication failed: HTTP ${response.status}`); return response.json(); },
  });
  vm.runInContext(compiled, context);
  const id = `ipordise-mirror-check-${Date.now()}`;
  let created = false;
  try {
    // The real app helper performs both writes. A private draft avoids alerts.
    created = true;
    await context.sync({ accessToken: login.idToken }, id, { name: 'IPORDISE private mirror check', brand: 'IPORDISE', image: 'https://ipordise.com/assets/ipordise-app-icon-v3.png', images: ['https://ipordise.com/assets/ipordise-app-icon-v3.png'], sizes: { '100ml': 450 }, stockLeft: 0, active: false, publicationStatus: 'draft', priceComingSoon: false, preorderEnabled: false, createOnly: true });
    const [canonical, website] = await Promise.all([
      request(`${url}/rest/v1/products?id=eq.${id}&select=id,name,active,sizes`, { headers: { apikey: process.env.SUPABASE_SECRET_KEY } }),
      request(`${root}/products/${id}`, { headers: { Authorization: `Bearer ${login.idToken}` } }),
    ]);
    assert.equal(canonical[0]?.name, website.fields.name.stringValue);
    assert.equal(canonical[0]?.active, website.fields.active.booleanValue);
    assert.equal(canonical[0]?.sizes['100ml'], Number(website.fields.sizes.mapValue.fields['100ml'].integerValue));
    assert.equal(website.fields.slug.stringValue, id);
    assert.ok(website.fields.addedAt.stringValue);
    appWebsiteMirrorVerified = true;
  } finally {
    if (created) {
      const response = await fetch(`${root}/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${login.idToken}` }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok && response.status !== 404) throw new Error(`Mirror test cleanup failed: HTTP ${response.status}`);
      await request(`${url}/functions/v1/admin-catalog-sync`, { method: 'POST', headers, body: JSON.stringify({ section: 'products', id, value: null }) });
    }
  }
}
if (process.argv.includes('--verify-draft')) {
  const id = `ipordise-release-check-${Date.now()}`;
  let created = false;
  try {
    await request(`${url}/functions/v1/admin-catalog-sync`, {
      method: 'POST', headers, body: JSON.stringify({ section: 'products', id, value: { name: 'IPORDISE private release check', brand: 'IPORDISE', image: 'https://ipordise.com/assets/ipordise-app-icon-v3.png', images: ['https://ipordise.com/assets/ipordise-app-icon-v3.png'], sizes: { '100ml': 450 }, stockLeft: 0, active: false, publicationStatus: 'draft', priceComingSoon: true, preorderEnabled: false, createOnly: true } }),
    });
    created = true;
    const rows = await request(`${url}/rest/v1/products?id=eq.${id}&select=id,active,price_coming_soon,preorder_enabled`, { headers: { apikey: process.env.SUPABASE_SECRET_KEY } });
    assert.equal(rows[0]?.active, false);
    assert.equal(rows[0]?.price_coming_soon, true, 'Admin selected price-coming-soon must persist');
    draftPriceOptionVerified = true;
  } finally {
    if (created) await request(`${url}/functions/v1/admin-catalog-sync`, { method: 'POST', headers, body: JSON.stringify({ section: 'products', id, value: null }) });
  }
}
const page = await request(`${url}/functions/v1/admin-catalog-sync?page=1&pageSize=100`, { headers });
assert.ok(Array.isArray(page.products) && page.products.length, 'Staff catalog must contain products');
const active = page.products.filter(product => product.active === true);
const product = active.find(product => product.publication_status === 'active') || active[0];
assert.ok(product, 'No published product available for the sync check');
if (process.argv.includes('--verify-write')) {
  // Repeat existing settings. This tests the actual save path without changing
  // prices, stock, visibility, or triggering new-product notifications.
  const result = await request(`${url}/functions/v1/admin-catalog-sync`, {
    method: 'POST', headers, body: JSON.stringify({ section: 'products', id: product.id, value: { preorderEnabled: product.preorder_enabled === true, priceComingSoon: product.price_coming_soon === true } }),
  });
  assert.equal(result.ok, true);
}
const [appRows, siteRows, variants] = await Promise.all([
  request(`${url}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}&active=eq.true&select=id,name,price_coming_soon,preorder_enabled`, { headers: { apikey: key } }),
  request(`${url}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}&active=eq.true&select=id,name,price_coming_soon,preorder_enabled`, { headers: { apikey: key, Origin: 'https://ipordise.com' } }),
  request(`${url}/rest/v1/product_variants?product_id=eq.${encodeURIComponent(product.id)}&enabled=eq.true&select=id,price_minor,stock_quantity`, { headers: { apikey: key } }),
]);
assert.deepEqual(appRows, siteRows);
assert.equal(appRows[0]?.id, product.id);
assert.equal(appRows[0].price_coming_soon, product.price_coming_soon === true);
assert.equal(appRows[0].preorder_enabled, product.preorder_enabled === true);
const surfaces = [];
for (const path of ['/', '/app', '/admin']) {
  const response = await fetch(`https://ipordise.com${path}`, { signal: AbortSignal.timeout(30_000), headers: { 'Cache-Control': 'no-cache' } });
  const html = await response.text();
  surfaces.push({ path, status: response.status, server: response.headers.get('server'), vercel: Boolean(response.headers.get('x-vercel-id')), expoBundle: /AppEntry-[a-f0-9]+\.js/.test(html) });
  assert.ok(response.ok, `Website ${path} must load`);
}
console.log(JSON.stringify({ ok: true, staffApi: true, canonicalAdminProducts: page.pagination?.total ?? page.products.length, unchangedSaveVerified: process.argv.includes('--verify-write'), draftPriceOptionVerified, appWebsiteMirrorVerified, productId: product.id, enabledSizes: variants.length, appAndSiteCatalogAgree: true, surfaces }, null, 2));
