import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const adminEmail = process.env.IPORDISE_ADMIN_EMAIL;
const adminPassword = process.env.IPORDISE_ADMIN_PASSWORD;
const firebaseApiKey = 'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4';
const origin = 'https://ipordise.com';
if (!supabaseUrl || !publicKey || !secretKey || !adminEmail || !adminPassword) throw new Error('Production audit credentials are incomplete');

const parse = async (response, label, expected = 200) => {
  response = await response;
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (response.status !== expected) throw new Error(`${label}: expected HTTP ${expected}, received ${response.status}${body?.error ? ` (${body.error})` : ''}`);
  return body;
};
const serviceHeaders = { apikey: secretKey, ...(secretKey.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${secretKey}` }), Accept: 'application/json' };
const publicHeaders = { apikey: publicKey, Origin: origin, Accept: 'application/json' };
const functionUrl = name => `${supabaseUrl}/functions/v1/${name}`;
const serviceJson = path => parse(fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: serviceHeaders }), path);
const adminCall = (token, name, options = {}) => fetch(functionUrl(name), {
  ...options,
  headers: { ...publicHeaders, Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
});
const setProductPreorder = (token, id, enabled) => parse(adminCall(token, 'admin-catalog-sync', {
  method: 'POST', body: JSON.stringify({ section: 'products', id, value: { preorderEnabled: enabled } }),
}), `set preorder ${id}=${enabled}`);
const setGlobalPreorder = (token, enabled) => parse(adminCall(token, 'admin-preorders', {
  method: 'PATCH', body: JSON.stringify({ action: 'update_settings', enabled }),
}), `set global preorder=${enabled}`);
const createPreorder = async (payload, expected = 201) => parse(fetch(functionUrl('create-preorder'), {
  method: 'POST', headers: { ...publicHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
}), 'create preorder', expected);

const startedAt = new Date().toISOString();
const createdIds = [];
let token = '';
let outProduct = null;
let originalProductEnabled = false;
let originalGlobalEnabled = true;

try {
  const login = await parse(fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true }),
  }), 'Firebase administrator login');
  token = login.idToken;

  const [products, variants, settings] = await Promise.all([
    serviceJson('products?active=eq.true&publication_status=eq.active&select=id,name,preorder_enabled,stock_left'),
    serviceJson('product_variants?enabled=eq.true&select=id,product_id,size_label,stock_quantity'),
    serviceJson('store_settings?id=eq.main&select=value'),
  ]);
  originalGlobalEnabled = settings[0]?.value?.preorders?.enabled !== false;
  const byProduct = new Map();
  for (const variant of variants) byProduct.set(variant.product_id, [...(byProduct.get(variant.product_id) || []), variant]);
  outProduct = products.find(product => {
    const rows = byProduct.get(product.id) || [];
    return rows.length
      ? rows.every(variant => variant.stock_quantity !== null && Number(variant.stock_quantity) === 0)
      : Number(product.stock_left) === 0;
  });
  assert.ok(outProduct, 'Production catalogue has no fully out-of-stock product to audit');
  originalProductEnabled = outProduct.preorder_enabled === true;
  const outVariant = byProduct.get(outProduct.id)?.[0];

  await setGlobalPreorder(token, true);
  await setProductPreorder(token, outProduct.id, true);
  const visibleProduct = await serviceJson(`products?id=eq.${encodeURIComponent(outProduct.id)}&select=id,preorder_enabled`);
  assert.equal(visibleProduct[0]?.preorder_enabled, true, 'Product-level setting was not published to the customer catalogue');

  const base = { productId: outProduct.id, variantId: outVariant?.id, selectedVariant: outVariant?.size_label, customerName: 'IPORDISE Production Audit', email: 'audit@example.com', city: 'Casablanca', quantity: 1, customerMessage: 'Automated preorder pipeline audit' };
  const web = await createPreorder({ ...base, phone: '0611111191', source: 'website', idempotencyKey: `web_${randomUUID()}` });
  createdIds.push(web.request.id);
  const mobile = await createPreorder({ ...base, phone: '0611111192', source: 'mobile_app', idempotencyKey: `mobile_${randomUUID()}` });
  createdIds.push(mobile.request.id);
  const duplicate = await createPreorder({ ...base, phone: '0611111191', source: 'website', idempotencyKey: `retry_${randomUUID()}` }, 200);
  assert.equal(duplicate.request.id, web.request.id, 'Duplicate request created a second persisted row');

  const workspace = await parse(adminCall(token, 'admin-preorders?page=1&pageSize=100'), 'admin preorder list');
  const webRow = workspace.preorders.find(row => row.id === web.request.id);
  const mobileRow = workspace.preorders.find(row => row.id === mobile.request.id);
  assert.equal(webRow?.source, 'website');
  assert.equal(mobileRow?.source, 'mobile_app');
  assert.equal(webRow?.product_snapshot_name, outProduct.name);
  assert.equal(webRow?.customer_name, base.customerName);

  const updated = await parse(adminCall(token, 'admin-preorders', {
    method: 'PATCH', body: JSON.stringify({ id: web.request.id, status: 'contacted', adminNotes: 'Production audit private note' }),
  }), 'update preorder');
  assert.equal(updated.preorder.status, 'contacted');
  assert.equal(updated.preorder.admin_notes, 'Production audit private note');
  const refreshed = await parse(adminCall(token, 'admin-preorders?page=1&pageSize=100'), 'refresh preorder list');
  assert.equal(refreshed.preorders.find(row => row.id === web.request.id)?.admin_notes, 'Production audit private note');

  await setProductPreorder(token, outProduct.id, false);
  const disabled = await createPreorder({ ...base, phone: '0611111193', source: 'website', idempotencyKey: `disabled_${randomUUID()}` }, 409);
  assert.equal(disabled.code, 'PREORDER_NOT_ALLOWED');
  await setProductPreorder(token, outProduct.id, true);
  await setGlobalPreorder(token, false);
  const globallyDisabled = await createPreorder({ ...base, phone: '0611111194', source: 'website', idempotencyKey: `global_${randomUUID()}` }, 409);
  assert.equal(globallyDisabled.code, 'PREORDERS_DISABLED');
  await setGlobalPreorder(token, true);

  const inStockProduct = products.find(product => (byProduct.get(product.id) || []).some(variant => variant.stock_quantity == null || Number(variant.stock_quantity) > 0));
  assert.ok(inStockProduct, 'Production catalogue has no in-stock product to audit');
  const inStockOriginal = inStockProduct.preorder_enabled === true;
  await setProductPreorder(token, inStockProduct.id, true);
  try {
    const availableVariant = byProduct.get(inStockProduct.id).find(variant => variant.stock_quantity == null || Number(variant.stock_quantity) > 0);
    const available = await createPreorder({ ...base, productId: inStockProduct.id, variantId: availableVariant.id, selectedVariant: availableVariant.size_label, phone: '0611111195', idempotencyKey: `available_${randomUUID()}` }, 409);
    assert.equal(available.code, 'PRODUCT_AVAILABLE');
  } finally { await setProductPreorder(token, inStockProduct.id, inStockOriginal); }

  const invalid = await createPreorder({ ...base, phone: 'invalid', email: 'invalid', idempotencyKey: `invalid_${randomUUID()}` }, 400);
  assert.equal(invalid.code, 'INVALID_PREORDER');
  const missing = await createPreorder({ ...base, productId: 'deleted-product-audit', variantId: undefined, phone: '0611111196', idempotencyKey: `missing_${randomUUID()}` }, 409);
  assert.equal(missing.code, 'PREORDER_NOT_ALLOWED');

  const unauthorized = await fetch(`${functionUrl('admin-preorders')}?page=1&pageSize=1`, { headers: publicHeaders });
  assert.equal(unauthorized.status, 401);
  console.log(JSON.stringify({ ok: true, productId: outProduct.id, websiteRequest: web.request.id, mobileRequest: mobile.request.id, duplicateRequest: duplicate.request.id, statusPersisted: true, privateNotesPersisted: true, unauthorizedStatus: unauthorized.status, startedAt }, null, 2));
} finally {
  if (createdIds.length) {
    const list = createdIds.map(id => `"${id}"`).join(',');
    const cleanup = await fetch(`${supabaseUrl}/rest/v1/preorder_requests?id=in.(${encodeURIComponent(list)})`, { method: 'DELETE', headers: serviceHeaders });
    if (!cleanup.ok) throw new Error(`Audit preorder cleanup returned HTTP ${cleanup.status}`);
    const remaining = await serviceJson(`preorder_requests?id=in.(${encodeURIComponent(list)})&select=id`);
    assert.equal(remaining.length, 0, 'Production audit rows were not removed');
  }
  if (token && outProduct) {
    await setProductPreorder(token, outProduct.id, originalProductEnabled);
    await setGlobalPreorder(token, originalGlobalEnabled);
    const [restoredProduct] = await serviceJson(`products?id=eq.${encodeURIComponent(outProduct.id)}&select=preorder_enabled`);
    const [restoredSettings] = await serviceJson('store_settings?id=eq.main&select=value');
    assert.equal(restoredProduct?.preorder_enabled === true, originalProductEnabled, 'Product preorder setting was not restored');
    assert.equal(restoredSettings?.value?.preorders?.enabled !== false, originalGlobalEnabled, 'Global preorder setting was not restored');
  }
}
