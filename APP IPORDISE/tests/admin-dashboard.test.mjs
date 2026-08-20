import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dashboardUrl = new URL('../src/admin/AdminDashboard.tsx', import.meta.url);
const serviceUrl = new URL('../src/services/adminService.ts', import.meta.url);
const appUrl = new URL('../App.tsx', import.meta.url);
const runtimeSettingsUrl = new URL('../src/services/runtimeSettings.ts', import.meta.url);
const orderServiceUrl = new URL('../src/services/orderService.ts', import.meta.url);
const trackingServiceUrl = new URL('../src/services/orderTrackingService.ts', import.meta.url);
const supportServiceUrl = new URL('../src/services/supportService.ts', import.meta.url);
const firestoreRulesUrl = new URL('../website-ipordise/firestore.rules', import.meta.url);

test('admin dashboard exposes responsive operational controls', async () => {
  const source = await readFile(dashboardUrl, 'utf8');
  assert.match(source, /const desktop\s*=\s*layout\.width\s*>=\s*1024/);
  assert.match(source, /ProductEditor/);
  assert.match(source, /\["Manage App", "settings-outline"\]/);
  assert.match(source, /orderActionsMobile/);
  assert.match(source, /updateAdminOrderStatus/);
  assert.match(source, /updateAdminConversation/);
  assert.match(source, /Prices are rechecked during checkout/);
  assert.match(source, /Role protected/);
  assert.match(source, /REFRESH STATUS/);
  assert.match(source, /systemConnectionRow/);
  assert.match(source, /contentScrollRef\.current\?\.scrollTo/);
  assert.match(source, /OPEN APP/);
  assert.match(source, /Homepage & offers/);
  assert.match(source, /Shop discovery/);
  assert.match(source, /Customer experience/);
  assert.match(source, /API & system health/);
  assert.match(source, /onOpenTab\(label\)/);
  assert.match(source, /Firebase-secured publishing/);
});

test('dashboard settings and customer app share one Firebase runtime document', async () => {
  const [service,runtime,home,offers,help,shop]=await Promise.all([
    readFile(serviceUrl,'utf8'),
    readFile(runtimeSettingsUrl,'utf8'),
    readFile(new URL('../src/home/homeConfig.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/offers/offerConfig.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/help/helpConfig.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/shop/shopConfig.ts',import.meta.url),'utf8'),
  ]);
  assert.match(runtime,/RUNTIME_SETTINGS_DOCUMENT\s*=\s*["']products\/_app_config["']/);
  assert.match(service,/patchDocument\(session, RUNTIME_SETTINGS_DOCUMENT, publicValue\)/);
  assert.match(service,/const publicValue\s*=\s*\{[\s\S]*homepage: value\.homepage/);
  for(const source of [home,offers,help,shop])assert.match(source,/loadRuntimeSettings/);
});

test('checkout and admin use canonical server-authoritative orders while tracking never reads private Firestore orders', async () => {
  const [checkout,tracking,rules,admin]=await Promise.all([readFile(orderServiceUrl,'utf8'),readFile(trackingServiceUrl,'utf8'),readFile(firestoreRulesUrl,'utf8'),readFile(serviceUrl,'utf8')]);
  assert.match(checkout,/supabaseUrl}\/functions\/v1\/create-order/);
  assert.doesNotMatch(checkout,/firebaseFunctionsUrl}\/createOrder/);
  assert.doesNotMatch(checkout,/publicFirestoreUrl|encodeFirestoreFields|DASHBOARD_SYNC_FAILED/);
  assert.match(admin,/edgeFunctionConfig\(["']admin-orders["']\)/);
  assert.doesNotMatch(admin,/firebaseFunctionsUrl}\/adminOrders/);
  assert.match(admin,/loadAdminOrders\(session\)/);
  assert.doesNotMatch(admin,/gdgrskgegrcgmzswefmn|CATALOG_SYNC_KEY/);
  assert.match(tracking,/supabaseUrl}\/functions\/v1\/track-order/);
  assert.doesNotMatch(tracking,/firebaseFunctionsUrl}\/trackOrder/);
  assert.doesNotMatch(tracking,/publicFirestoreUrl|orders\/\$\{encodeURIComponent/);
  assert.match(rules,/match \/orders\/\{orderId\}[\s\S]*allow read: if isAdmin\(\)/);
});

test('admin service authenticates the existing Firebase administrator and uses bearer-scoped Firestore requests', async () => {
  const source = await readFile(serviceUrl, 'utf8');
  assert.match(source, /accounts:signInWithPassword/);
  assert.match(source, /accounts:lookup/);
  assert.match(source, /ADMIN_EMAIL\s*=\s*["']admin@ipordise\.com["']/);
  assert.match(source, /Authorization:\s*`Bearer \$\{session\.accessToken\}`/);
  assert.match(source, /listCollection\(session,\s*["']products["']/);
  assert.match(source, /loadAdminOrders\(session\)/);
  assert.match(source, /listCollection\(session,\s*["']contactMessages["']/);
  assert.match(source, /loadAdminPage\(session,\s*["']admin-customers["'],\s*["']customers["'],\s*50\)/);
  assert.match(source, /loadAdminCatalog\(session\)\.catch\(\(\) => emptyPage\)/);
  assert.match(source, /loadAdminOrders\(session\),/);
  assert.doesNotMatch(source, /SUPABASE_SECRET_KEY|service[_-]role/i);
});

test('legacy transactional website routes retire into the unified web and mobile app', async () => {
  const [home,product,cart,admin,sitemap]=await Promise.all([
    readFile(new URL('../website-ipordise/index.html',import.meta.url),'utf8'),
    readFile(new URL('../website-ipordise/pages/product.html',import.meta.url),'utf8'),
    readFile(new URL('../website-ipordise/pages/cart.html',import.meta.url),'utf8'),
    readFile(new URL('../website-ipordise/admin.html',import.meta.url),'utf8'),
    readFile(new URL('../website-ipordise/sitemap.xml',import.meta.url),'utf8'),
  ]);
  assert.match(home,/location\.replace\('\/app'/);
  assert.match(product,/location\.replace\('\/app\?'/);
  assert.match(cart,/location\.replace\('\/app\?page=bag'/);
  assert.match(admin,/location\.replace\('\/app\?admin=1'/);
  assert.match(sitemap,/https:\/\/ipordise\.com\/app/);
  assert.doesNotMatch(sitemap,/pages\/product\.html|pages\/cart\.html|pages\/checkout\.html/);
});

test('admin login only persists sessions when keep me signed in is selected', async () => {
  const [dashboard, service] = await Promise.all([
    readFile(dashboardUrl, 'utf8'),
    readFile(serviceUrl, 'utf8'),
  ]);
  assert.match(dashboard, /Keep me signed in/);
  assert.match(dashboard, /signInAdmin\(email, password, remembered\)/);
  assert.match(service, /session\?\.remembered\s*\?\s*localStorage\s*:\s*sessionStorage/);
  assert.match(service, /localStorage\.getItem\(SESSION_KEY\)[\s\S]*sessionStorage\.getItem\(SESSION_KEY\)/);
});

test('admin route renders the canonical protected administration panel', async () => {
  const source = await readFile(appUrl, 'utf8');
  const webEntry = await readFile(new URL('../src/admin/AdminEntry.web.tsx', import.meta.url), 'utf8');
  assert.match(source, /path==='\/admin'/);
  assert.match(source, /path\.startsWith\('\/admin\/'\)/);
  assert.match(source, /path==='\/app'/);
  assert.match(source, /path\.startsWith\('\/app\/'\)/);
  assert.match(source, /get\('admin'\)==='1'/);
  assert.match(source, /import \{ AdminEntry \}/);
  assert.match(source, /previewAdmin\?<AdminEntry\/>/);
  assert.match(webEntry, /import \{ AdminDashboard \}/);
  assert.match(webEntry, /<AdminDashboard \/>/);
});

test('customer support and dashboard replies share the token-protected canonical inbox', async () => {
  const [dashboard,admin,support,rules]=await Promise.all([
    readFile(dashboardUrl,'utf8'),readFile(serviceUrl,'utf8'),readFile(supportServiceUrl,'utf8'),readFile(firestoreRulesUrl,'utf8'),
  ]);
  assert.match(support,/functions\/v1\/support-inbox/);
  assert.match(support,/action: 'create'/);
  assert.match(support,/action: 'customer_thread'/);
  assert.match(support,/action: 'customer_reply'/);
  assert.doesNotMatch(support,/publicFirestoreUrl|supportThreads/);
  assert.match(admin,/sendAdminSupportReply/);
  assert.match(admin,/action:\s*["']admin_reply["']/);
  assert.match(admin,/action:\s*["']admin_list["']/);
  assert.match(dashboard,/Send to app/);
  assert.match(dashboard,/Open email reply/);
  assert.match(rules,/match \/supportThreads\/\{threadId\}/);
  assert.match(rules,/allow read, write, delete: if isAdmin\(\)/);
});
