import { createClient } from 'npm:@supabase/supabase-js@2';
import { maskMoroccanPhone, normalizeMoroccanPhone, normalizeOrderNumber } from '../_shared/orderIdentity.ts';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const MAX_BODY_BYTES = 8 * 1024;
const METHODS = 'POST, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));

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
  const phone = normalizeMoroccanPhone(payload.phone);
  if (!hasOnlyKeys(payload, ['orderNumber', 'phone']) || !orderNumber || !phone) {
    return json({ success: false, error: 'Please verify the order number and Moroccan phone number.', code: 'INVALID_INPUT', requestId }, 400, origin);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ success: false, error: 'Order tracking is temporarily unavailable.', code: 'SERVER_ERROR', requestId }, 500, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  try {
    if (!await consumeRateLimit(admin, request, 'track-order', 12, 900)) {
      const response = json({ success: false, error: 'Too many tracking attempts. Please wait and try again.', code: 'RATE_LIMITED', requestId }, 429, origin);
      response.headers.set('Retry-After', '60');
      return response;
    }
    const { data, error } = await admin.rpc('track_commerce_order', {
      p_order_number: orderNumber,
      p_phone: phone,
    });
    if (error) throw error;
    if (!data) {
      return json({ success: false, error: "We couldn't find an order matching those details.", code: 'ORDER_NOT_FOUND', requestId }, 404, origin);
    }
    return json({ success: true, order: data, requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'track_order_failed',
      orderNumber,
      phone: maskMoroccanPhone(phone),
      error: error instanceof Error ? error.message : String(error),
    }));
    return json({ success: false, error: 'Order tracking is temporarily unavailable.', code: 'SERVER_ERROR', requestId }, 500, origin);
  }
});
