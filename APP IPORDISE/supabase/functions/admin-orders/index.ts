import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin, verifyFirebaseStaff } from '../_shared/security.ts';

const MAX_BODY_BYTES = 16 * 1024;
const METHODS = 'GET, PATCH, DELETE, OPTIONS';
const ORDER_STATUSES = new Set(['pending', 'confirmed', 'processing', 'ready_for_dispatch', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'delivery_failed']);
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready_for_dispatch', 'shipped', 'cancelled'],
  ready_for_dispatch: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'delivered', 'delivery_failed'],
  out_for_delivery: ['delivered', 'delivery_failed'],
  delivery_failed: ['out_for_delivery', 'returned'],
  delivered: ['return_requested'],
  return_requested: ['returned'],
  returned: [],
  cancelled: [],
};
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const positiveInteger = (value: string | null, fallback: number, maximum: number) => {
  if (value === null) return fallback;
  return /^\d+$/.test(value) ? Math.max(1, Math.min(maximum, Number(value))) : null;
};
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));

Deno.serve(async request => {
  const origin = requestOrigin(request);
  const requestId = crypto.randomUUID();
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS);
  if (originError) return originError;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (!['GET', 'PATCH', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed', requestId }, 405, origin);
  if (request.method === 'PATCH' || request.method === 'DELETE') {
    const mediaError = rejectNonJson(request, origin, requestId, METHODS);
    if (mediaError) return mediaError;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Administration configuration missing', requestId }, 500, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const staff = await verifyFirebaseStaff(request.headers.get('Authorization'));
  if (!staff) return json({ error: 'Unauthorized', requestId }, 401, origin);

  try {
    if (!await consumeRateLimit(admin, request, `admin-orders:${staff.uid}`, 180, 900)) return json({ error: 'Too many administration requests', requestId }, 429, origin);
    if (request.method === 'GET') {
      const search = new URL(request.url).searchParams;
      if (search.get('view') === 'revenue') {
        const { data, error } = await admin.rpc('admin_order_revenue_summary');
        if (error) throw error;
        return json({ summary: data || {}, requestId }, 200, origin);
      }
      const page = positiveInteger(search.get('page'), 1, 10_000);
      const pageSize = positiveInteger(search.get('pageSize'), 50, 100);
      if (page === null || pageSize === null) return json({ error: 'Invalid pagination', code: 'INVALID_QUERY', requestId }, 400, origin);
      let query = admin.from('orders').select('id,user_id,order_number,customer,customer_snapshot,shipping_address,items,subtotal,delivery_fee,discount,total,currency,payment_method,notes,status,source,risk_score,risk_level,risk_flags,notification_status,courier_code,courier_name,tracking_number,tracking_url,estimated_delivery,shipped_at,delivered_at,created_at,order_status_history(from_status,to_status,changed_by,created_at)', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      const status = search.get('status');
      const source = search.get('source');
      if (status && ORDER_STATUSES.has(status)) query = query.eq('status', status);
      if (source && ['website', 'mobile_app', 'admin'].includes(source)) query = query.eq('source', source);
      const term = String(search.get('q') || '').trim().slice(0, 80).replace(/[%_,()]/g, '');
      if (term) query = query.or(`order_number.ilike.%${term}%,customer->>name.ilike.%${term}%,customer->>phone.ilike.%${term}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return json({ orders: data || [], pagination: { page, pageSize, total: count || 0 }, requestId }, 200, origin);
    }

    const parsed = await readJsonObject(request, MAX_BODY_BYTES);
    if (parsed.error === 'too_large') return json({ error: 'Request body too large', requestId }, 413, origin);
    if (parsed.error) return json({ error: 'Invalid JSON payload', requestId }, 400, origin);
    const payload = parsed.value!;
    const id = String(payload.id || '');
    if (request.method === 'DELETE') {
      if (!hasOnlyKeys(payload, ['id']) || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Invalid order removal', code: 'INVALID_ORDER_DELETE', requestId }, 400, origin);
      const { data: current, error: readError } = await admin.from('orders').select('id,order_number,status').eq('id', id).maybeSingle();
      if (readError) throw readError;
      if (!current) return json({ error: 'Order not found', requestId }, 404, origin);
      const { error: deleteError } = await admin.from('orders').delete().eq('id', id);
      if (deleteError) {
        if (deleteError.code === '23503') return json({ error: 'This order is linked to a verified review and cannot be removed.', code: 'ORDER_HAS_VERIFIED_REVIEW', requestId }, 409, origin);
        throw deleteError;
      }
      const { error: auditError } = await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'order.delete', entity_type: 'orders', entity_id: id, metadata: { orderNumber: current.order_number, previousStatus: current.status, requestId } });
      if (auditError) console.error(JSON.stringify({ requestId, event: 'admin_audit_write_failed', action: 'order.delete' }));
      return json({ deleted: { id, orderNumber: current.order_number }, requestId }, 200, origin);
    }
    const status = typeof payload.status === 'string' ? payload.status : null;
    const shippingKeys = ['courierCode', 'courierName', 'trackingNumber', 'trackingUrl', 'estimatedDelivery'];
    const hasShipping = shippingKeys.some(key => Object.prototype.hasOwnProperty.call(payload, key));
    if (!hasOnlyKeys(payload, ['id', 'status', ...shippingKeys]) || !/^[0-9a-f-]{36}$/i.test(id) || (status !== null && !ORDER_STATUSES.has(status)) || (status === null && !hasShipping) || (status !== null && hasShipping)) {
      return json({ error: 'Invalid order update', code: 'INVALID_ORDER_UPDATE', requestId }, 400, origin);
    }
    if (hasShipping) {
      const textField = (key: string, maximum: number) => {
        const value = payload[key];
        if (value == null) return null;
        if (typeof value !== 'string' || value.trim().length > maximum) throw new Error('INVALID_SHIPPING_DETAILS');
        return value.trim() || null;
      };
      let courierCode: string | null;
      let courierName: string | null;
      let trackingNumber: string | null;
      let trackingUrl: string | null;
      let estimatedDelivery: string | null = null;
      try {
        courierCode = textField('courierCode', 40);
        courierName = textField('courierName', 100);
        trackingNumber = textField('trackingNumber', 100);
        trackingUrl = textField('trackingUrl', 500);
        if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) throw new Error('INVALID_SHIPPING_DETAILS');
        if (payload.estimatedDelivery != null && payload.estimatedDelivery !== '') {
          if (typeof payload.estimatedDelivery !== 'string' || !Number.isFinite(Date.parse(payload.estimatedDelivery))) throw new Error('INVALID_SHIPPING_DETAILS');
          estimatedDelivery = new Date(payload.estimatedDelivery).toISOString();
        }
      } catch {
        return json({ error: 'Please verify the courier and delivery details', code: 'INVALID_SHIPPING_DETAILS', requestId }, 400, origin);
      }
      const { data, error } = await admin.rpc('update_order_shipping', {
        p_order_id: id,
        p_courier_code: courierCode,
        p_courier_name: courierName,
        p_tracking_number: trackingNumber,
        p_tracking_url: trackingUrl,
        p_estimated_delivery: estimatedDelivery,
        p_changed_by: staff.email,
      });
      if (error) {
        if (String(error.message || '').includes('ORDER_NOT_FOUND')) return json({ error: 'Order not found', requestId }, 404, origin);
        throw error;
      }
      const { error: auditError } = await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'order.shipping.update', entity_type: 'orders', entity_id: id, metadata: { hasCourier: Boolean(courierName), hasTracking: Boolean(trackingNumber), hasTrackingUrl: Boolean(trackingUrl), hasEstimate: Boolean(estimatedDelivery), requestId } });
      if (auditError) console.error(JSON.stringify({ requestId, event: 'admin_audit_write_failed', action: 'order.shipping.update' }));
      return json({ order: data, requestId }, 200, origin);
    }
    const { data: current, error: readError } = await admin.from('orders').select('status').eq('id', id).maybeSingle();
    if (readError) throw readError;
    if (!current) return json({ error: 'Order not found', requestId }, 404, origin);
    if (current.status !== status && !STATUS_TRANSITIONS[current.status]?.includes(status!)) return json({ error: 'This order status transition is not allowed', requestId }, 409, origin);
    if (current.status === status) return json({ order: current, requestId }, 200, origin);
    const { data, error } = await admin.rpc('transition_commerce_order', { p_order_id: id, p_expected_status: current.status, p_new_status: status!, p_changed_by: staff.email });
    if (error) {
      if (String(error.message || '').includes('ORDER_STATUS_CHANGED')) return json({ error: 'The order changed while it was being updated. Reload and try again.', code: 'ORDER_STATUS_CHANGED', requestId }, 409, origin);
      throw error;
    }
    const { error: auditError } = await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'order.status.update', entity_type: 'orders', entity_id: id, metadata: { status, requestId } });
    if (auditError) console.error(JSON.stringify({ requestId, event: 'admin_audit_write_failed', action: 'order.status.update' }));
    return json({ order: data, requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'admin_orders_failed', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Order administration request failed', requestId }, 500, origin);
  }
});
