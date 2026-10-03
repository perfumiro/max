import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/sharedCatalog.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source + '\nexport { productFromSupabase, fetchCatalogRows };', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = vm.createContext({ exports: {}, require: name => {
  if (name === './productImageSource') return { normalizeProductImageUrl: value => value, productImageSource: uri => ({uri}) };
  if (name === './config') return { appConfig: { storeOrigin: 'https://store.test', requestRetries: 0, requestTimeoutMs: 20000 } };
  if (name.includes('catalogSnapshot')) return {};
  if (name.includes('logger')) return { logger: { warn() {} } };
  if (name.includes('productGallery')) return { mergeProductGallery: (_id, image) => [image] };
  if (name.includes('productNotes')) return { normalizeProductNotes: () => undefined };
  if (name.includes('promotionLogic')) return { isPromotionWindowActive: () => true };
  throw Error(name);
}, setTimeout, clearTimeout, AbortController });
vm.runInContext(compiled, context);
for (const flag of [undefined, false, true]) {
  test('Expo preserves admin product and explicit price option: ' + flag, () => {
    const product = context.exports.productFromSupabase({ id: 'admin-new', name: 'New perfume', image: 'https://store.test/image.jpg', active: true, stock_left: 0, price_coming_soon: flag }, [{ id: 'admin-new:100ml', product_id: 'admin-new', size_key: '100ml', price_minor: 45000, enabled: true, stock_quantity: 0 }]);
    assert.equal(product.id, 'admin-new');
    assert.equal(product.price, flag === true ? 'Price coming soon' : '450 MAD');
    assert.equal(product.priceComingSoon, flag === true);
    assert.equal(product.stockLeft, 0);
    assert.equal(product.sizes['100ml'], 450);
  });
}
test('catalog pages include products past the first response', async () => {
  const calls = [];
  context.fetch = async url => { calls.push(url); return { ok: true, json: async () => url.includes('offset=0') ? Array.from({length:500}, (_,id) => ({id})) : [{id:'new-admin-product'}] }; };
  const rows = await context.exports.fetchCatalogRows('https://store.test/products?active=eq.true', 'Catalog');
  assert.equal(rows.length, 501);
  assert.equal(rows[500].id, 'new-admin-product');
  assert.equal(calls.length, 2);
});
