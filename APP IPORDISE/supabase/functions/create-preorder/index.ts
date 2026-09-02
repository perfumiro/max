import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { apiHeaders, apiJson, bearerToken, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const METHODS = 'POST, OPTIONS';
const phonePattern = /^(?:\+?212|0)[5-7]\d{8}$/;
const productPattern = /^[a-z0-9][a-z0-9_-]{1,127}$/i;
const idempotencyPattern = /^[A-Za-z0-9_-]{16,100}$/;
const clean = (value: unknown, maximum: number) => typeof value === 'string' ? value.trim().slice(0, maximum) : '';
const normalizePhone = (value: unknown) => clean(value, 30).replace(/[\s()-]/g, '').replace(/^00212/, '+212');

Deno.serve(async request => {
  const requestId = crypto.randomUUID();
  const origin = requestOrigin(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (request.method !== 'POST') return apiJson({ error: 'Method not allowed', requestId }, 405, origin, METHODS);
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS); if (originError) return originError;
  const mediaError = rejectNonJson(request, origin, requestId, METHODS); if (mediaError) return mediaError;
  const parsed = await readJsonObject(request, 16_384);
  if (parsed.error) return apiJson({ error: 'Invalid request', requestId }, parsed.error === 'too_large' ? 413 : 400, origin, METHODS);
  const payload = parsed.value!;
  const productId = clean(payload.productId, 128);
  const variantId = clean(payload.variantId, 256) || null;
  const customerName = clean(payload.customerName, 120);
  const phone = normalizePhone(payload.phone);
  const email = clean(payload.email, 254).toLowerCase() || null;
  const city = clean(payload.city, 100) || null;
  const quantity = Number(payload.quantity ?? 1);
  const customerMessage = clean(payload.customerMessage, 1000) || null;
  const source = payload.source === 'mobile_app' ? 'mobile_app' : 'website';
  const idempotencyKey = clean(payload.idempotencyKey, 100);
  if (!productPattern.test(productId) || customerName.length < 2 || !phonePattern.test(phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !idempotencyPattern.test(idempotencyKey)) {
    return apiJson({ error: 'Please check your name, phone number, email and quantity.', code: 'INVALID_PREORDER', requestId }, 400, origin, METHODS);
  }
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    if (!await consumeRateLimit(admin, request, 'create-preorder', 8, 900)) return apiJson({ error: 'Too many requests. Please wait and try again.', requestId }, 429, origin, METHODS);
    const { data: settings } = await admin.from('store_settings').select('value').eq('id', 'main').maybeSingle();
    if (settings?.value?.preorders?.enabled === false) return apiJson({ error: 'Preorder requests are currently unavailable.', code: 'PREORDERS_DISABLED', requestId }, 409, origin, METHODS);
    const { data: product, error: productError } = await admin.from('products').select('id,name,image,active,publication_status,preorder_enabled,stock_left').eq('id', productId).maybeSingle();
    if (productError) throw productError;
    if (!product || !product.active || product.publication_status !== 'active' || product.preorder_enabled !== true) return apiJson({ error: 'This product is not accepting requests.', code: 'PREORDER_NOT_ALLOWED', requestId }, 409, origin, METHODS);
    let variant: any = null;
    if (variantId) {
      const result = await admin.from('product_variants').select('id,product_id,size_label,price_minor,stock_quantity,enabled').eq('id', variantId).eq('product_id', productId).maybeSingle();
      if (result.error) throw result.error;
      variant = result.data;
      if (!variant || !variant.enabled) return apiJson({ error: 'The selected option is invalid.', code: 'INVALID_VARIANT', requestId }, 400, origin, METHODS);
      if (variant.stock_quantity === null || Number(variant.stock_quantity) > 0) return apiJson({ error: 'This option is currently available to order.', code: 'PRODUCT_AVAILABLE', requestId }, 409, origin, METHODS);
    } else {
      const { data: variants, error } = await admin.from('product_variants').select('stock_quantity,enabled').eq('product_id', productId).eq('enabled', true);
      if (error) throw error;
      const enabledVariants = variants || [];
      const productAvailable = enabledVariants.length
        ? enabledVariants.some(item => item.stock_quantity === null || Number(item.stock_quantity) > 0)
        : product.stock_left === null || Number(product.stock_left) > 0;
      if (productAvailable) return apiJson({ error: 'This product is currently available to order.', code: 'PRODUCT_AVAILABLE', requestId }, 409, origin, METHODS);
    }
    let userId: string | null = null;
    const token = bearerToken(request.headers.get('Authorization'));
    if (token) { const { data } = await admin.auth.getUser(token); userId = data.user?.id || null; }
    const row = { product_id: product.id, variant_id: variant?.id || null, user_id: userId, customer_name: customerName, phone, email, city, quantity, customer_message: customerMessage, selected_variant: variant?.size_label || clean(payload.selectedVariant, 120) || null, product_snapshot_name: product.name, product_snapshot_image: product.image || null, product_snapshot_price: variant ? Number(variant.price_minor) / 100 : null, source, status: 'new', idempotency_key: idempotencyKey };
    const { data, error } = await admin.from('preorder_requests').upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true }).select('id,status,created_at').maybeSingle();
    if (error?.code === '23505') {
      let duplicateQuery = admin.from('preorder_requests').select('id,status,created_at').eq('product_id', productId).eq('phone', phone).in('status', ['new','contacted','waiting_for_stock','customer_confirmed']);
      duplicateQuery = variant?.id ? duplicateQuery.eq('variant_id', variant.id) : duplicateQuery.is('variant_id', null);
      const existing = await duplicateQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return apiJson({ request: existing.data, duplicate: true, requestId }, 200, origin, METHODS);
    }
    if (error) throw error;
    if (!data) { const existing = await admin.from('preorder_requests').select('id,status,created_at').eq('idempotency_key', idempotencyKey).single(); if (existing.error) throw existing.error; return apiJson({ request: existing.data, duplicate: true, requestId }, 200, origin, METHODS); }
    return apiJson({ request: data, duplicate: false, requestId }, 201, origin, METHODS);
  } catch (error) {
    console.error(JSON.stringify({ event: 'create_preorder_failed', requestId, error: error instanceof Error ? error.message : String(error) }));
    return apiJson({ error: 'Your request could not be sent. Please try again.', requestId }, 500, origin, METHODS);
  }
});
