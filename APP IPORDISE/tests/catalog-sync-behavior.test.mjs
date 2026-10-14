import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/sharedCatalog.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const product = { id: 'new-perfume', name: 'New perfume', brand: 'IPORDISE', image: 'https://ipordise.com/new.jpg', sizes: { '100ml': 450 }, active: true, stock_left: null, review_count: 12 };
function setup({ variants = [], settings = [], rows = [product] } = {}) {
  const calls = [];
  const context = vm.createContext({ exports: {}, URLSearchParams, AbortController, setTimeout, clearTimeout,
    appConfig: { storeOrigin: 'https://ipordise.com', supabaseUrl: 'https://catalog.test', supabasePublishableKey: 'public', requestRetries: 0, requestTimeoutMs: 100, catalogCacheTtlMs: 30000 },
    catalogSnapshot: { products: [{ ...product, id: 'old-bundled' }], variants: [] }, logger: { warn() {} },
    normalizeProductImageUrl: value => value, productImageSource: uri => ({ uri }),
    mergeProductGallery: (_id, image, gallery) => [image, ...(gallery || [])].filter(Boolean), normalizeProductNotes: () => undefined, isPromotionWindowActive: () => true,
    fetch: async url => { calls.push(url); const data = url.includes('/product_variants?') ? variants : url.includes('/store_settings?') ? settings : rows;
      return data instanceof Error ? { ok: false, status: 400, headers: { get() {} } } : { ok: true, json: async () => data }; },
  });
  vm.runInContext(js, context);
  return { api: context.exports, context, calls };
}

test('new admin publication keeps canonical prices when variants and settings are unavailable', async () => {
  const { api, calls } = setup({ variants: new Error('missing table'), settings: new Error('missing settings') });
  const products = await api.loadSharedProducts();
  assert.equal(products.length, 1);
  assert.equal(products[0].id, product.id);
  assert.equal(products[0].sizes['100ml'], 450);
  assert.equal(products[0].price, '450 MAD');
  assert.equal(products[0].stockLeft, undefined);
  assert.equal(products[0].reviewCount, 12);
  assert.ok(calls.find(url => url.includes('/products?select=*&active=eq.true')));
});

test('published variants remain authoritative for prices, discounts and stock', async () => {
  const { api } = setup({ variants: [{ id: 'variant-1', product_id: product.id, size_key: '100ml', price_minor: 42000, compare_at_price_minor: 45000, stock_quantity: 3, enabled: true }] });
  const [loaded] = await api.loadSharedProducts();
  assert.equal(loaded.sizes['100ml'], 420);
  assert.equal(loaded.oldPrice, '450 MAD');
  assert.equal(loaded.variants[0].id, 'variant-1');
  assert.equal(loaded.variants[0].stock, 3);
});

test('refresh adds new publications, updates prices and preserves latest data offline', async () => {
  const { api, context } = setup();
  await api.loadSharedProducts();
  context.fetch = async () => ({ ok: true, json: async () => [{ ...product, sizes: { '100ml': 600 } }, { ...product, id: 'second-perfume' }] });
  const refreshed = await api.loadSharedProducts(true);
  assert.equal(refreshed.length, 2);
  assert.equal(refreshed[0].sizes['100ml'], 600);
  context.fetch = async () => { throw new Error('offline'); };
  const offline = await api.loadSharedProducts(true);
  assert.equal(offline[0].sizes['100ml'], 600);
  assert.equal(offline[1].id, 'second-perfume');
});

test('unpublishing all products clears the catalog instead of resurrecting bundled products', async () => {
  const { api, context } = setup();
  await api.loadSharedProducts();
  context.fetch = async () => ({ ok: true, json: async () => [] });
  assert.equal((await api.loadSharedProducts(true)).length, 0);
});
