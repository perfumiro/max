const { chromium } = require('C:/Users/Ziko/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('assets/admin/admin.js', 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const runtime = `
const qs = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const toast = message => { window.lastToast = message; };
const auth = { currentUser: { getIdToken: async () => 'test-only-token' } };
const SUPABASE_FUNCTIONS_URL = 'https://gdgrskgegrcgmzswefmn.supabase.co/functions/v1';
const SUPABASE_PUBLISHABLE_KEY = 'test-key';
const SUPABASE_SYNC_URL = SUPABASE_FUNCTIONS_URL + '/admin-catalog-sync';
const MOBILE_CATALOG_DOC_ID = '__mobile_catalog__';
const db = {}; const doc = (...args) => args;
const setDoc = async () => {}; const deleteDoc = async () => {}; const serverTimestamp = () => 0;
const getDoc = async () => ({ exists: () => false });
${section('const supabaseAdminRequest =', 'const fetchSupabaseAdminProducts =')}
${section('let preorderRequests =', 'const applyOrderFilters =')}
window.loadPreordersForTest = loadPreordersView;
`;
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const product = { id: 'test-perfume', name: 'Test perfume', brand: 'IPORDISE', stock_left: 4, preorder_enabled: false };
    const request = { id: '00000000-0000-4000-8000-000000000001', customer_name: 'Test Customer', product_snapshot_name: 'Test perfume', phone: '0612345678', quantity: 1, status: 'new' };
    let saved, updated;
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/assets/admin/admin.js')) return route.fulfill({ body: '', contentType: 'text/javascript' });
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.pathname.endsWith('/admin-catalog-sync')) {
        if (route.request().method() === 'POST') {
          saved = route.request().postDataJSON();
          Object.assign(product, { stock_left: saved.value.stockLeft, preorder_enabled: saved.value.preorderEnabled, preorder_estimated_availability: saved.value.preorderEstimatedAvailability, preorder_message: saved.value.preorderMessage });
          return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: { products: [product], pagination: { total: 1 } } });
      }
      if (url.pathname.endsWith('/admin-preorders')) {
        if (route.request().method() === 'PATCH') { updated = route.request().postDataJSON(); request.status = updated.status; return route.fulfill({ json: { preorder: request } }); }
        return route.fulfill({ json: { preorders: [request], pagination: { total: 1 } } });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8000/admin.html');
    await page.evaluate(() => {
      document.querySelector('#authScreen').classList.add('hidden');
      document.querySelector('#dashboardScreen').classList.remove('hidden');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelector('#view-preorders').classList.add('active');
    });
    await page.addScriptTag({ content: runtime });
    await page.evaluate(() => window.loadPreordersForTest());
    await page.locator('#preordersMobile .mobile-work-card').waitFor({ state: 'visible' });
    await page.locator('#view-preorders summary').click();
    await page.locator('#preorderProductSelect').selectOption('test-perfume');
    await page.locator('#preorderProductStock').fill('0');
    await page.locator('#preorderProductComing').check();
    await page.locator('#preorderProductEta').fill('October 2026');
    await page.locator('#preorderProductEnabled').check();
    await page.locator('#preorderProductMessage').fill('Reserve yours today.');
    await page.locator('#preorderProductSettings [type=submit]').click();
    await page.waitForFunction(() => window.lastToast === 'Availability and preorder settings saved');
    assert.deepEqual(saved, { section: 'products', id: 'test-perfume', value: { stockLeft: 0, preorderEnabled: true, priceComingSoon: true, preorderEstimatedAvailability: 'October 2026', preorderMessage: 'Reserve yours today.' } });
    await page.locator('.preorder-request-status').selectOption('contacted');
    await page.waitForFunction(() => window.lastToast === 'Preorder status saved');
    assert.equal(updated.status, 'contacted');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#preordersMobile').isVisible(), true);
    console.log('PASS: all-product settings save to canonical API; preorder inbox and status updates work on desktop and mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
