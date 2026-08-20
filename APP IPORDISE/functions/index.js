const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

initializeApp();
const db = getFirestore();
const REGION = 'europe-west3';
const ADMIN_EMAIL = 'admin@ipordise.com';
const ORDER_NOTIFICATION_EMAIL = 'perfumiro@gmail.com';
const MAX_CHECKOUT_BODY_BYTES = 64 * 1024;
const MAX_TRACKING_BODY_BYTES = 8 * 1024;
const MAX_ADMIN_BODY_BYTES = 16 * 1024;
const ALLOWED_ORIGINS = new Set([
  'https://ipordise.com',
  'https://www.ipordise.com',
  'https://admin.ipordise.com',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
]);
const ORDER_FIELDS = ['id', 'order_number', 'customer', 'items', 'subtotal', 'delivery_fee', 'total', 'currency', 'payment_method', 'notes', 'status', 'risk_score', 'risk_level', 'risk_flags', 'notification_status', 'created_at'];
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

function setCors(request, response, methods) {
  const origin = request.get('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) response.set('Access-Control-Allow-Origin', origin);
  response.set('Access-Control-Allow-Headers', 'authorization, content-type');
  response.set('Access-Control-Allow-Methods', methods);
  response.set('Access-Control-Max-Age', '3600');
  response.set('Cache-Control', 'no-store');
  response.set('Vary', 'Origin');
  response.set('X-Content-Type-Options', 'nosniff');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function json(response, status, body) {
  return response.status(status).json(body);
}

function requestBodyTooLarge(request, maximumBytes) {
  const declared = Number(request.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maximumBytes) return true;
  try { return Buffer.byteLength(JSON.stringify(request.body ?? {}), 'utf8') > maximumBytes; } catch { return true; }
}

function normalizeSize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function normalizePhone(value) {
  return String(value || '').replace(/[\s()-]/g, '').slice(0, 20);
}

function preferredSize(sizes) {
  const entries = Object.entries(sizes);
  return entries.find(([size]) => normalizeSize(size) === '100ml') || entries.sort(([a], [b]) => (parseFloat(b) || 0) - (parseFloat(a) || 0))[0];
}

function timestampIso(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function publicOrder(id, value) {
  return {
    id,
    orderNumber: value.order_number,
    subtotal: Number(value.subtotal || 0),
    deliveryFee: Number(value.delivery_fee || 0),
    total: Number(value.total || 0),
    currency: value.currency || 'MAD',
    status: value.status || 'pending',
    createdAt: timestampIso(value.created_at),
  };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function formatMad(value) {
  return `${new Intl.NumberFormat('fr-MA').format(Number(value || 0))} MAD`;
}

async function sendOrderNotification(orderId, order) {
  if (order.notification_status === 'sent') return 'sent';
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (!apiKey || !from) {
    console.warn(JSON.stringify({ event: 'order_email_skipped', orderId, reason: 'email_configuration_missing' }));
    return 'skipped';
  }
  const customer = order.customer || {};
  const itemRows = (order.items || []).map(item => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.brand)} ${escapeHtml(item.name)}<br><span style="color:#777">${escapeHtml(item.size)} × ${Number(item.quantity || 1)}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700">${escapeHtml(formatMad(item.lineTotal))}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3f1;font-family:Arial,sans-serif;color:#211719"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e5ddda;border-radius:20px;padding:28px"><div style="font-family:Georgia,serif;font-size:28px;font-weight:700">IPORDISE</div><div style="height:2px;width:72px;background:#d7193f;margin:8px 0 24px"></div><p style="font-size:12px;letter-spacing:1.4px;color:#d7193f;font-weight:700">NEW ORDER ${escapeHtml(order.order_number)}</p><h1 style="font-family:Georgia,serif;font-size:25px">A new order is ready to review.</h1><div style="background:#f9f8f7;border-radius:14px;padding:16px;margin-top:18px"><strong>${escapeHtml(customer.name)}</strong><br>${escapeHtml(customer.phone)}${customer.email ? `<br>${escapeHtml(customer.email)}` : ''}<br>${escapeHtml(customer.address)}, ${escapeHtml(customer.city)}${order.notes ? `<p><strong>Note:</strong> ${escapeHtml(order.notes)}</p>` : ''}</div><table style="width:100%;border-collapse:collapse;margin-top:18px">${itemRows}</table><div style="background:#f5f1ef;border-radius:14px;padding:16px;margin-top:20px"><strong>Order total: ${escapeHtml(formatMad(order.total))}</strong></div><p style="margin-top:22px"><a href="https://ipordise.com/admin" style="display:inline-block;background:#211719;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:700">Open administration panel</a></p></div></div></body></html>`;
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `ipordise-order-${orderId}` },
      body: JSON.stringify({ from, to: [ORDER_NOTIFICATION_EMAIL], subject: `New IPORDISE order ${order.order_number} · ${formatMad(order.total)}`, html, ...(customer.email ? { reply_to: customer.email } : {}) }),
    });
    if (!result.ok) throw new Error(`Resend returned ${result.status}`);
    console.info(JSON.stringify({ event: 'order_email_sent', orderId, recipient: ORDER_NOTIFICATION_EMAIL }));
    return 'sent';
  } catch (error) {
    console.error(JSON.stringify({ event: 'order_email_failed', orderId, message: error instanceof Error ? error.message : String(error) }));
    return 'failed';
  }
}

async function consumeRateLimit(request, name, maximumHits, windowSeconds) {
  const forwarded = request.get('x-forwarded-for')?.split(',')[0]?.trim();
  const source = forwarded || request.ip || 'unknown';
  const key = crypto.createHash('sha256').update(`${source}:${name}`).digest('hex');
  const reference = db.collection('_apiRateLimits').doc(`${name}-${key}`);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    const now = Date.now();
    const value = snapshot.data() || {};
    const startedAt = value.startedAt?.toMillis?.() || 0;
    const expired = !startedAt || now - startedAt >= windowSeconds * 1000;
    const count = expired ? 1 : Number(value.count || 0) + 1;
    transaction.set(reference, { count, startedAt: expired ? Timestamp.fromMillis(now) : value.startedAt, expiresAt: Timestamp.fromMillis(now + windowSeconds * 1000) });
    return count <= maximumHits;
  });
}

async function requireAdmin(request) {
  const token = String(request.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    return String(decoded.email || '').toLowerCase() === ADMIN_EMAIL ? decoded : null;
  } catch {
    return null;
  }
}

exports.createOrder = onRequest({ region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 20, secrets: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'] }, async (request, response) => {
  const requestId = crypto.randomUUID();
  if (!setCors(request, response, 'POST, OPTIONS')) return json(response, 403, { error: 'Origin not allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed' });
  return json(response, 410, { error: 'This checkout has been retired. Use canonical Supabase checkout.', code: 'ENDPOINT_RETIRED', requestId });
  /* c8 ignore start -- retained temporarily for historical migration reference */
  if (!String(request.get('content-type') || '').toLowerCase().includes('application/json')) return json(response, 415, { error: 'JSON content type required', requestId });
  if (requestBodyTooLarge(request, MAX_CHECKOUT_BODY_BYTES)) return json(response, 413, { error: 'Order request is too large', requestId });
  if (!(await consumeRateLimit(request, 'create-order', 10, 900))) return json(response, 429, { error: 'Too many checkout attempts. Please wait and try again.', requestId });

  try {
    const payload = request.body && typeof request.body === 'object' ? request.body : {};
    const key = String(payload.idempotencyKey || '');
    if (!/^[a-z0-9-]{20,100}$/i.test(key)) return json(response, 400, { error: 'Invalid checkout session', requestId });
    const orderId = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
    const orderRef = db.collection('orders').doc(orderId);
    const existing = await orderRef.get();
    if (existing.exists) {
      const existingOrder = existing.data();
      const notificationStatus = await sendOrderNotification(existing.id, existingOrder);
      if (notificationStatus !== existingOrder.notification_status) await orderRef.update({ notification_status: notificationStatus, notification_updated_at: Timestamp.now() });
      return json(response, 200, { ...publicOrder(existing.id, existingOrder), requestId });
    }

    const customerInput = payload.customer || {};
    const customer = {
      name: String(customerInput.name || '').trim().slice(0, 120),
      phone: normalizePhone(customerInput.phone),
      email: String(customerInput.email || '').trim().toLowerCase().slice(0, 254) || null,
      city: String(customerInput.city || '').trim().slice(0, 100),
      address: String(customerInput.address || '').trim().slice(0, 300),
    };
    if (customer.name.length < 2 || !/^(?:\+?212|0)[5-7]\d{8}$/.test(customer.phone) || customer.city.length < 2 || customer.address.length < 5 || (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))) {
      return json(response, 400, { error: 'Please verify your delivery details', requestId });
    }
    const requested = Array.isArray(payload.items) ? payload.items.slice(0, 50) : [];
    if (!requested.length) return json(response, 400, { error: 'Your shopping bag is empty', requestId });
    const productIds = requested.map(item => String(item.productId || ''));
    if (productIds.some(id => !/^[a-z0-9][a-z0-9_-]{1,127}$/i.test(id))) return json(response, 400, { error: 'One or more products are invalid', requestId });
    const uniqueProductIds = [...new Set(productIds)];

    const result = await db.runTransaction(async transaction => {
      const currentOrder = await transaction.get(orderRef);
      if (currentOrder.exists) return currentOrder.data();
      const productSnapshots = await Promise.all(uniqueProductIds.map(id => transaction.get(db.collection('products').doc(id))));
      const productsById = new Map(productSnapshots.map(snapshot => [snapshot.id, snapshot]));
      const requestedQuantityByProduct = requested.reduce((totals, item) => {
        const id = String(item.productId || '');
        totals.set(id, (totals.get(id) || 0) + Math.floor(Number(item.quantity)));
        return totals;
      }, new Map());
      const items = [];
      let subtotal = 0;
      for (let index = 0; index < requested.length; index += 1) {
        const selectedRequest = requested[index];
        const snapshot = productsById.get(String(selectedRequest.productId));
        const product = snapshot.data();
        const quantity = Math.floor(Number(selectedRequest.quantity));
        const stockLeft = product?.stockLeft ?? product?.stock_left ?? null;
        const requestedProductQuantity = requestedQuantityByProduct.get(snapshot.id) || 0;
        if (!snapshot.exists || !product || product.active === false || quantity < 1 || quantity > 20 || requestedProductQuantity > 20 || (stockLeft !== null && Number(stockLeft) < requestedProductQuantity)) throw Object.assign(new Error('A selected product is no longer available'), { status: 409 });
        const sizes = Object.fromEntries(Object.entries(product.sizes || {}).map(([size, price]) => [normalizeSize(size), Number(price)]).filter(([, price]) => Number(price) > 0));
        const requestedSize = normalizeSize(selectedRequest.size);
        const selected = requestedSize ? [requestedSize, sizes[requestedSize]] : preferredSize(sizes);
        if (!selected || !Number(selected[1])) throw Object.assign(new Error(`${product.name || 'This fragrance'} is unavailable in the selected size`), { status: 409 });
        const unitPrice = Number(selected[1]);
        subtotal += unitPrice * quantity;
        items.push({ productId: snapshot.id, name: product.name || snapshot.id, brand: product.brand || 'IPORDISE', image: typeof product.image === 'string' ? product.image : '', size: selected[0], quantity, unitPrice, lineTotal: unitPrice * quantity });
      }
      const settingsSnapshot = await transaction.get(db.collection('admin_config').doc('settings'));
      const settings = settingsSnapshot.data() || {};
      const deliveryFee = Number(settings.deliveryFee ?? settings.delivery_fee ?? 35);
      const now = Timestamp.now();
      const orderNumber = `IP-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const total = subtotal + deliveryFee;
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const riskFlags = [];
      let riskScore = 0;
      if (total >= 5000) { riskScore += 30; riskFlags.push('high_order_value'); }
      if (totalQuantity >= 8) { riskScore += 20; riskFlags.push('bulk_quantity'); }
      const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 25 ? 'review' : 'low';
      const value = { schema_version: 1, data_classification: 'customer_private', source: 'ipordise_checkout', order_number: orderNumber, customer, items, subtotal, delivery_fee: deliveryFee, total, currency: 'MAD', status: 'pending', payment_method: 'cash_on_delivery', notes: String(payload.notes || '').trim().slice(0, 1000) || null, idempotency_key: key, risk_score: riskScore, risk_level: riskLevel, risk_flags: riskFlags, notification_status: 'pending', created_at: now, updated_at: now };
      for (const snapshot of productSnapshots) {
        const product = snapshot.data();
        const stockField = Object.prototype.hasOwnProperty.call(product, 'stockLeft') ? 'stockLeft' : Object.prototype.hasOwnProperty.call(product, 'stock_left') ? 'stock_left' : null;
        if (stockField && product[stockField] !== null) transaction.update(snapshot.ref, { [stockField]: Number(product[stockField]) - Number(requestedQuantityByProduct.get(snapshot.id) || 0), updatedAt: now });
      }
      transaction.create(orderRef, value);
      transaction.create(db.collection('order_audit_logs').doc(), { order_id: orderRef.id, order_number: orderNumber, action: 'order.created', actor_type: 'customer', from_status: null, to_status: 'pending', request_id: requestId, created_at: now });
      return value;
    });
    const notificationStatus = await sendOrderNotification(orderRef.id, result);
    await orderRef.update({ notification_status: notificationStatus, notification_updated_at: Timestamp.now() });
    console.info(JSON.stringify({ event: 'order_created', requestId, orderId: orderRef.id, orderNumber: result.order_number, total: result.total }));
    return json(response, 201, { ...publicOrder(orderRef.id, result), requestId });
  } catch (error) {
    console.error(JSON.stringify({ event: 'create_order_failed', requestId, message: error instanceof Error ? error.message : String(error) }));
    return json(response, Number(error?.status || 500), { error: Number(error?.status) < 500 ? error.message : 'Checkout could not complete your order', requestId });
  }
  /* c8 ignore stop */
});

exports.trackOrder = onRequest({ region: REGION, timeoutSeconds: 15, memory: '256MiB', maxInstances: 20 }, async (request, response) => {
  const requestId = crypto.randomUUID();
  if (!setCors(request, response, 'POST, OPTIONS')) return json(response, 403, { error: 'Origin not allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (request.method !== 'POST') return json(response, 405, { error: 'Method not allowed' });
  return json(response, 410, { error: 'This tracking API has been retired. Use canonical Supabase tracking.', code: 'ENDPOINT_RETIRED', requestId });
  /* c8 ignore start -- retained temporarily for historical migration reference */
  if (requestBodyTooLarge(request, MAX_TRACKING_BODY_BYTES)) return json(response, 413, { error: 'Tracking request is too large', requestId });
  if (!(await consumeRateLimit(request, 'track-order', 20, 900))) return json(response, 429, { error: 'Too many tracking attempts. Please wait and try again.', requestId });
  const orderNumber = String(request.body?.orderNumber || '').trim().toUpperCase();
  const phone = normalizePhone(request.body?.phone);
  if (!/^IPD?-[A-Z0-9-]{8,32}$/.test(orderNumber) || !/^(?:\+?212|0)[5-7]\d{8}$/.test(phone)) return json(response, 400, { error: 'Please verify your order number and phone number', requestId });
  const matches = await db.collection('orders').where('order_number', '==', orderNumber).limit(1).get();
  if (matches.empty || normalizePhone(matches.docs[0].data().customer?.phone) !== phone) return json(response, 404, { error: 'No matching order was found', requestId });
  const order = matches.docs[0].data();
  return json(response, 200, { orderNumber: order.order_number, status: order.status, total: Number(order.total || 0), currency: order.currency || 'MAD', createdAt: timestampIso(order.created_at), itemCount: Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.quantity || 1), 0) : 0, requestId });
  /* c8 ignore stop */
});

exports.adminOrders = onRequest({ region: REGION, timeoutSeconds: 20, memory: '256MiB', maxInstances: 10 }, async (request, response) => {
  const requestId = crypto.randomUUID();
  if (!setCors(request, response, 'GET, PATCH, OPTIONS')) return json(response, 403, { error: 'Origin not allowed' });
  if (request.method === 'OPTIONS') return response.status(204).send('');
  if (requestBodyTooLarge(request, MAX_ADMIN_BODY_BYTES)) return json(response, 413, { error: 'Administration request is too large', requestId });
  if (!(await requireAdmin(request))) return json(response, 403, { error: 'Administrator access required' });
  return json(response, 410, { error: 'This order administration API has been retired. Use canonical Supabase administration.', code: 'ENDPOINT_RETIRED', requestId });
  /* c8 ignore start -- retained temporarily for historical migration reference */
  if (request.method === 'GET') {
    const snapshot = await db.collection('orders').limit(300).get();
    const orders = snapshot.docs.map(document => {
      const value = document.data();
      return Object.fromEntries(ORDER_FIELDS.map(field => [field, field === 'id' ? document.id : field === 'created_at' ? timestampIso(value.created_at) : value[field]]));
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return json(response, 200, { orders, requestId });
  }
  if (request.method === 'PATCH') {
    const id = String(request.body?.id || '');
    const status = String(request.body?.status || '');
    if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) return json(response, 400, { error: 'Invalid order update' });
    const reference = db.collection('orders').doc(id);
    const updated = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw Object.assign(new Error('Order not found'), { status: 404 });
      const current = snapshot.data();
      const currentStatus = String(current.status || 'pending');
      if (currentStatus !== status && !STATUS_TRANSITIONS[currentStatus]?.includes(status)) throw Object.assign(new Error('This order status transition is not allowed'), { status: 409 });
      if (currentStatus === status) return { ...current, status };
      const productIds = status === 'cancelled' ? [...new Set((current.items || []).map(item => String(item.productId || '')).filter(Boolean))] : [];
      const productSnapshots = await Promise.all(productIds.map(productId => transaction.get(db.collection('products').doc(productId))));
      if (status === 'cancelled') {
        const quantities = (current.items || []).reduce((totals, item) => totals.set(String(item.productId || ''), (totals.get(String(item.productId || '')) || 0) + Number(item.quantity || 0)), new Map());
        for (const productSnapshot of productSnapshots) {
          if (!productSnapshot.exists) continue;
          const product = productSnapshot.data();
          const stockField = Object.prototype.hasOwnProperty.call(product, 'stockLeft') ? 'stockLeft' : Object.prototype.hasOwnProperty.call(product, 'stock_left') ? 'stock_left' : null;
          if (stockField && product[stockField] !== null) transaction.update(productSnapshot.ref, { [stockField]: Number(product[stockField]) + Number(quantities.get(productSnapshot.id) || 0), updatedAt: Timestamp.now() });
        }
      }
      const now = Timestamp.now();
      transaction.update(reference, { status, updated_at: now });
      transaction.create(db.collection('order_audit_logs').doc(), { order_id: id, order_number: current.order_number || null, action: 'order.status.updated', actor_type: 'admin', actor_email: ADMIN_EMAIL, from_status: currentStatus, to_status: status, request_id: requestId, created_at: now });
      return { ...current, status, updated_at: now };
    });
    return json(response, 200, { order: { id, ...updated, created_at: timestampIso(updated.created_at) }, requestId });
  }
  return json(response, 405, { error: 'Method not allowed' });
  /* c8 ignore stop */
});
