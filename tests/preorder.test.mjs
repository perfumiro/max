import test from 'node:test';
import assert from 'node:assert/strict';
import { availability, createPreorder } from '../assets/preorder.js';

const product = { active: true, preorder_enabled: true, stock_left: 0, product_variants: [
    { id: 'small', size_key: '50ml', size_label: '50 ML', enabled: true, stock_quantity: 0 },
    { id: 'large', size_key: '100ml', size_label: '100 ML', enabled: true, stock_quantity: 3 },
] };
test('availability uses the selected variant, including mixed stock and unlimited stock', () => {
    assert.equal(availability(product, '50 ML').preorder, true);
    assert.equal(availability(product, '100ml').blocked, false);
    assert.equal(availability(product, '').blocked, false);
    assert.equal(availability(product, '20ml').preorder, false);
    assert.equal(availability(product, '20ml').blocked, true);
    assert.equal(availability({ ...product, preorder_enabled: false }, '50ml').preorder, false);
    assert.equal(availability({ ...product, active: false }, '50ml').preorder, false);
    assert.equal(availability({ ...product, product_variants: [{ ...product.product_variants[0], stock_quantity: null }] }, '50ml').blocked, false);
});
test('preorder submission preserves variant and retry key, and requires server confirmation', async () => {
    let sent;
    const payload = { productId: 'perfume', variantId: 'small', quantity: 2, idempotencyKey: 'stable-retry-key' };
    await createPreorder(payload, async (url, options) => {
        sent = JSON.parse(options.body);
        assert.ok(url.endsWith('/functions/v1/create-preorder'));
        return Response.json({ request: { id: 'confirmed' } });
    });
    assert.deepEqual(sent, { ...payload, source: 'website' });
    await assert.rejects(createPreorder(payload, async () => Response.json({ error: 'Preorders are disabled' }, { status: 409 })), /disabled/);
    await assert.rejects(createPreorder(payload, async () => Response.json({})), /Confirmation/);
});
