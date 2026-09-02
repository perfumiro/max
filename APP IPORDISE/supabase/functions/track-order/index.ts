import { createClient } from 'npm:@supabase/supabase-js@2';
import { constantTimeTokenMatch, guestOrderToken } from '../_shared/guestOrderToken.ts';
import { maskMoroccanPhone, normalizeMoroccanPhone, normalizeOrderNumber } from '../_shared/orderIdentity.ts';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const MAX_BODY_BYTES = 8 * 1024;
const METHODS = 'POST, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const notFound = (requestId: string, origin: string | null) => json({ success: false, error: "We couldn't find an order matching those details.", code: 'ORDER_NOT_FOUND', requestId }, 404, origin);
const safeNumber = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const TRACKING_STATUSES = new Set(['pending','confirmed','processing','ready_for_dispatch','shipped','out_for_delivery','delivered','cancelled','return_requested','returned','delivery_failed']);
const referenceRateKey = async (orderNumber: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`track-order-reference:${orderNumber}`));
  return `api:track-order-reference:${Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')}`;
};

Deno.serve(async request => {
  const origin = requestOrigin(request);
  const requestId = crypto.randomUUID();
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS);
  if (originError) return originError;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED', requestId }, 405, origin);
  const mediaError = rejectNonJson(request, origin, requestId, METHODS);
  if (mediaError) return mediaError;
  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if (parsed.error === 'too_large') return json({ success: false, error: 'Request is too large', code: 'INVALID_INPUT', requestId }, 413, origin);
  if (parsed.error) return json({ success: false, error: 'Please verify the order details.', code: 'INVALID_INPUT', requestId }, 400, origin);

  const payload = parsed.value!;
  const orderNumber = normalizeOrderNumber(payload.orderNumber);
  const phone = typeof payload.phone === 'string' ? normalizeMoroccanPhone(payload.phone) : null;
  const trackingToken = typeof payload.trackingToken === 'string' ? payload.trackingToken.trim() : '';
  const usesPhone = Boolean(phone) && !trackingToken;
  const usesToken = !payload.phone && /^[A-Za-z0-9_-]{43}$/.test(trackingToken);
  if (!hasOnlyKeys(payload, ['orderNumber', 'phone', 'trackingToken']) || !orderNumber || (!usesPhone && !usesToken)) {
    return json({ success: false, error: 'Please verify the order tracking details.', code: 'INVALID_INPUT', requestId }, 400, origin);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ success: false, error: 'Order tracking is temporarily unavailable.', code: 'SERVER_ERROR', requestId }, 500, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  try {
    const withinLimit = usesPhone
      ? await consumeRateLimit(admin, request, 'track-order', 12, 900)
      : await consumeRateLimit(admin, request, 'track-order:saved', 90, 900);
    const withinReferenceLimit = !usesPhone || Boolean((await admin.rpc('consume_api_rate_limit', {
      rate_key: await referenceRateKey(orderNumber),
      maximum_hits: 40,
      window_seconds: 900,
    })).data);
    if (!withinLimit || !withinReferenceLimit) {
      const response = json({ success: false, error: 'Too many tracking attempts. Please wait and try again.', code: 'RATE_LIMITED', requestId }, 429, origin);
      response.headers.set('Retry-After', '60');
      return response;
    }

    const { data: order, error: orderError } = await admin.from('orders').select('id,order_number,created_at,status,customer,items,subtotal,delivery_fee,discount,total,currency,payment_method,estimated_delivery,tracking_number,courier_name').eq('order_number', orderNumber).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return notFound(requestId, origin);

    const expectedToken = await guestOrderToken(key, order.id, order.order_number);
    const storedPhone = normalizeMoroccanPhone(order.customer?.phone);
    const authorized = usesToken
      ? constantTimeTokenMatch(trackingToken, expectedToken)
      : Boolean(phone && storedPhone && phone === storedPhone);
    if (!authorized) return notFound(requestId, origin);
    if (!TRACKING_STATUSES.has(String(order.status))) throw new Error('Order has an unsupported status');

    const { data: history, error: historyError } = await admin.from('order_status_history').select('to_status,created_at').eq('order_id', order.id).order('created_at', { ascending: true });
    if (historyError) throw historyError;
    const items = (Array.isArray(order.items) ? order.items : []).map((item: Record<string, unknown>) => ({
      brand: String(item.brand || '') || undefined,
      name: String(item.name || item.productName || 'Fragrance'),
      image: String(item.image || '') || undefined,
      size: String(item.size || item.format || '') || undefined,
      quantity: Math.max(1, safeNumber(item.quantity, 1)),
      unitPrice: safeNumber(item.unitPrice ?? item.price),
      lineTotal: safeNumber(item.lineTotal),
    }));
    const customer = order.customer && typeof order.customer === 'object' ? order.customer : {};
    const safeOrder = {
      orderNumber: order.order_number,
      createdAt: order.created_at,
      status: order.status,
      statusLabel: String(order.status || '').replace(/_/g, ' '),
      customerName: String(customer.name || '') || undefined,
      city: String(customer.city || '') || undefined,
      deliveryAddress: [customer.address, customer.city].filter(Boolean).join(', ') || undefined,
      phoneMasked: storedPhone ? maskMoroccanPhone(storedPhone) : undefined,
      subtotal: safeNumber(order.subtotal),
      deliveryFee: safeNumber(order.delivery_fee),
      discount: safeNumber(order.discount),
      total: safeNumber(order.total),
      currency: String(order.currency || 'MAD'),
      paymentMethod: order.payment_method,
      estimatedDelivery: order.estimated_delivery,
      trackingNumber: order.tracking_number,
      courierName: order.courier_name,
      itemCount: items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
      items,
      statusHistory: (history || []).filter(entry => TRACKING_STATUSES.has(String(entry.to_status))).map(entry => ({ status: entry.to_status, createdAt: entry.created_at })),
    };
    // Only phone recovery needs to return a credential. Saved-token requests
    // are authorized by the existing bearer token and must not echo it back.
    return json({ success: true, order: safeOrder, ...(usesPhone ? { trackingToken: expectedToken } : {}), requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'track_order_failed', orderNumber, phone: phone ? maskMoroccanPhone(phone) : undefined, credential: usesPhone ? 'phone_recovery' : 'saved_token', error: error instanceof Error ? error.message : String(error) }));
    return json({ success: false, error: 'Order tracking is temporarily unavailable.', code: 'SERVER_ERROR', requestId }, 500, origin);
  }
});
