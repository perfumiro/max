import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../script.js', import.meta.url), 'utf8');
const start = source.indexOf('const initProductDetailPage = async () => {');
const end = source.indexOf('        const setText =', start);
assert.ok(start >= 0 && end > start);
const initialization = source.slice(start, end)
    + '\nreturn { productName, productSizePriceOptions, disabled: _fsDisabled }; }; initProductDetailPage();';

for (const scenario of ['priced', 'coming soon', 'catalog unavailable', 'disabled']) {
    test(`admin product stays on its detail page: ${scenario}`, async () => {
        const redirects = [];
        const prices = scenario === 'priced' ? { '50ml': 250 } : {};
        const overrides = scenario === 'catalog unavailable' ? {} : {
            'test-1': { prices, disabled: scenario === 'disabled' },
        };
        const elements = new Map();
        const getElement = id => {
            if (!elements.has(id)) elements.set(id, { style: {} });
            return elements.get(id);
        };
        const result = await vm.runInNewContext(initialization, {
            URLSearchParams,
            window: { location: {
                search: '?id=test-1&name=Test%201&image=https%3A%2F%2Fres.cloudinary.com%2Fdp5eszu4p%2Ftest.jpg',
                pathname: '/pages/product.html',
                replace: url => redirects.push(url),
            } },
            document: { getElementById: getElement },
            productNameEl: { textContent: '' },
            productDetailOverrides: {},
            _firestoreProductImagesCache: {},
            _firestoreProductOverridesCache: overrides,
            _runtimeProductSizes: {},
            toProductDataId: value => value,
            canonicalProductName: value => value,
            normalizeImagePathForCurrentPage: value => value,
            getResolvedProductImageGallery: value => [value],
            loadPricesJson: async () => ({ 'test-1': prices }),
            loadSizesJson: async () => ({}),
            formatCatalogPrice: () => '',
            normalizeSizeLabelToKey: value => value,
            getAvailableSizePriceOptions: () => Object.entries(prices).map(([sizeKey, price]) => ({ sizeKey, price })),
        });
        assert.deepEqual(redirects, []);
        assert.equal(result.productName, 'Test 1');
        assert.match(getElement('productMainImage').src, /cloudinary/);
        assert.equal(result.productSizePriceOptions.length, scenario === 'priced' ? 1 : 0);
        if (scenario === 'disabled') {
            assert.equal(getElement('addToCartBtn').disabled, true);
            assert.equal(getElement('buyNowBtn').disabled, true);
        }
    });
}
