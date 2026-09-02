import test from 'node:test';
import assert from 'node:assert/strict';
import { saveGlobalOrder } from '../auth/canonical-order.js';

test('checkout resolves a legacy brand-prefixed cart name to its canonical product', async () => {
  const calls = [];
  globalThis.localStorage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/products?')) {
      return Response.json([{ id: 'product-1', name: 'Torino 21', brand: 'Xerjoff' }]);
    }
    if (String(url).includes('/product_variants?')) {
      return Response.json([{ id: 'variant-100', product_id: 'product-1', size_key: '100ml', size_label: '100 ML' }]);
    }
    return Response.json({ orderNumber: 'IPO-1001' });
  };

  const orderNumber = await saveGlobalOrder({
    customer: { firstName: 'Test', lastName: 'Customer', phone: '+212600000000', address: 'Test', city: 'Test' },
    items: [{ id: 'legacy-xerjoff-torino-21', name: 'Xerjoff Torino 21', size: '100 ML', qty: 1, price: 2600 }],
  });

  assert.equal(orderNumber, 'IPO-1001');
  const orderRequest = calls.at(-1);
  assert.deepEqual(JSON.parse(orderRequest.options.body).items, [
    { variantId: 'variant-100', quantity: 1, expectedUnitPriceMinor: 260000 },
  ]);
});
