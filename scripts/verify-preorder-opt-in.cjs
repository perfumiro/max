// Run against scripts/serve-local.cjs; override PLAYWRIGHT_MODULE if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Ziko/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = JSON.parse(fs.readFileSync('catalog.json', 'utf8')).products[0];
const makeProduct = (stock, preorder, priceSoon = false) => ({
    ...base, active: true, stock_left: stock, preorder_enabled: preorder, price_coming_soon: priceSoon,
    product_variants: Object.keys(base.sizes).map(size => ({ id: `${base.id}:${size}`, size_key: size, size_label: size.toUpperCase(), stock_quantity: stock, enabled: true })),
});
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    let product = makeProduct(5, false), failed = false, globalEnabled = true, errors = [], unpriced = false;
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.hostname === '127.0.0.1' && url.pathname === '/catalog.json' && unpriced) return route.fulfill({ json: { products: [{ ...base, sizes: Object.fromEntries(Object.keys(base.sizes).map(size => [size, 0])) }] } });
            if (url.hostname === '127.0.0.1') return route.continue();
            if (url.pathname.includes('/rest/v1/products')) return route.fulfill({ status: failed ? 503 : 200, json: product ? [product] : [] });
            if (url.pathname.includes('/rest/v1/store_settings')) return route.fulfill({ json: [{ value: { preorders: { enabled: globalEnabled } } }] });
            return route.abort();
        });
        const query = new URLSearchParams({ id: base.id, name: base.name, brand: base.brand, image: base.image });
        const load = async () => {
            await page.goto(`http://127.0.0.1:8000/pages/product.html?${query}`);
            await page.waitForFunction(() => document.querySelector('#arrivalPanel button')?.textContent.length > 0);
            const consent = page.locator('[data-consent-action="refused"]');
            if (await consent.isVisible()) await consent.evaluate(button => button.click());
        };
        for (const stock of [5, 0]) for (const preorder of [false, true]) for (const priceSoon of [false, true]) {
            product = makeProduct(stock, preorder, priceSoon);
            await load();
            const eligible = stock === 0 && preorder;
            assert.equal(await page.locator('#arrivalPanel').isVisible(), eligible, `stock=${stock}, preorder=${preorder}, priceSoon=${priceSoon}`);
            assert.equal(await page.locator('#arrivalPanel button').isVisible(), eligible);
            assert.equal(await page.locator('.price-soon-summary').isVisible(), priceSoon);
            assert.equal(await page.locator('#addToCartBtn').isVisible(), stock > 0);
            if (stock > 0 && !preorder && !priceSoon) await page.screenshot({ path: 'preorder-opt-in-fixed.png', fullPage: true });
        }
        unpriced = true;
        for (const preorder of [false, true]) {
            product = makeProduct(0, preorder);
            await load();
            assert.equal(await page.locator('#arrivalPanel').isVisible(), preorder, `unpriced, preorder=${preorder}`);
            assert.equal(await page.locator('.price-soon-summary').isVisible(), false);
            assert.equal(await page.locator('#addToCartBtn').isVisible(), false);
        }
        unpriced = false; product = makeProduct(5, true);
        product.product_variants.find(v => v.size_key === '50ml').stock_quantity = 0;
        await load();
        await page.locator('#sizeSelector [data-size-key="50ml"]').click();
        assert.equal(await page.locator('#arrivalPanel').isVisible(), true);
        assert.equal(await page.locator('#addToCartBtn').isVisible(), false);
        await page.locator('#sizeSelector [data-size-key="100ml"]').click();
        assert.equal(await page.locator('#arrivalPanel').isVisible(), false);
        assert.equal(await page.locator('#addToCartBtn').isVisible(), true);
        product = makeProduct(0, true); globalEnabled = false;
        await load();
        assert.equal(await page.locator('#arrivalPanel').isVisible(), false);
        globalEnabled = true; product = makeProduct(5, false); failed = true;
        await load();
        assert.equal(await page.locator('#arrivalPanel').isVisible(), false);
        assert.equal(await page.locator('#addToCartBtn').isVisible(), true);
        failed = false; product = null;
        await load();
        assert.equal(await page.locator('#arrivalPanel').isVisible(), false);
        assert.equal(await page.locator('#addToCartBtn').isVisible(), false);
        assert.deepEqual(errors, []);
        console.log('PASS: 8 stock/flag combinations, 2 unpriced cases, mixed-stock switching, global disable, API failure and missing product; no page errors.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
