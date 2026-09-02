import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin, verifyFirebaseStaff } from '../_shared/security.ts';

const METHODS = 'GET, PATCH, OPTIONS';
const statuses = new Set(['new','contacted','waiting_for_stock','customer_confirmed','converted_to_order','cancelled','completed']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async request => {
  const requestId = crypto.randomUUID(); const origin = requestOrigin(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (!['GET','PATCH'].includes(request.method)) return apiJson({ error: 'Method not allowed', requestId }, 405, origin, METHODS);
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS); if (originError) return originError;
  if (request.method === 'PATCH') { const error = rejectNonJson(request, origin, requestId, METHODS); if (error) return error; }
  const staff = await verifyFirebaseStaff(request.headers.get('Authorization'));
  if (!staff) return apiJson({ error: 'Unauthorized', requestId }, 401, origin, METHODS);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    if (!await consumeRateLimit(admin, request, `admin-preorders:${staff.uid}`, 180, 900)) return apiJson({ error: 'Too many administration requests', requestId }, 429, origin, METHODS);
    if (request.method === 'GET') {
      const url = new URL(request.url); const page = Math.max(1, Number(url.searchParams.get('page') || 1)); const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 50)));
      let query = admin.from('preorder_requests').select('*,products!preorder_requests_product_id_fkey(stock_left,preorder_enabled),product_variants!preorder_requests_variant_id_fkey(stock_quantity,sku)', { count: 'exact' }).order('created_at', { ascending: false }).range((page-1)*pageSize,page*pageSize-1);
      const status = url.searchParams.get('status'); if (status && statuses.has(status)) query = query.eq('status', status);
      const { data, error, count } = await query; if (error) throw error;
      const { data: settingsRow, error: settingsError } = await admin.from('store_settings').select('value').eq('id', 'main').single(); if (settingsError) throw settingsError;
      return apiJson({ preorders: data || [], settings: settingsRow.value?.preorders || { enabled: true }, pagination: { page, pageSize, total: count || 0 }, requestId }, 200, origin, METHODS);
    }
    const parsed = await readJsonObject(request, 8_192); if (parsed.error) return apiJson({ error: 'Invalid request', requestId }, 400, origin, METHODS);
    if (parsed.value!.action === 'update_settings') {
      if (typeof parsed.value!.enabled !== 'boolean') return apiJson({ error: 'Invalid preorder setting', requestId }, 400, origin, METHODS);
      const { data: settings, error } = await admin.rpc('set_preorder_global_enabled', { p_enabled: parsed.value!.enabled }); if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'preorder.settings.update', entity_type: 'store_settings', entity_id: 'main', metadata: { enabled: parsed.value!.enabled, requestId } });
      return apiJson({ settings, requestId }, 200, origin, METHODS);
    }
    const id = String(parsed.value!.id || ''); if (!uuid.test(id)) return apiJson({ error: 'Invalid request ID', requestId }, 400, origin, METHODS);
    const patch: Record<string, unknown> = {};
    if ('status' in parsed.value!) { const status = String(parsed.value!.status); if (!statuses.has(status)) return apiJson({ error: 'Invalid status', requestId }, 400, origin, METHODS); patch.status = status; if (status === 'contacted') patch.contacted_at = new Date().toISOString(); }
    if ('adminNotes' in parsed.value!) patch.admin_notes = String(parsed.value!.adminNotes || '').trim().slice(0, 4000) || null;
    if (!Object.keys(patch).length) return apiJson({ error: 'No changes supplied', requestId }, 400, origin, METHODS);
    const { data, error } = await admin.from('preorder_requests').update(patch).eq('id', id).select('*,products!preorder_requests_product_id_fkey(stock_left,preorder_enabled),product_variants!preorder_requests_variant_id_fkey(stock_quantity,sku)').single(); if (error) throw error;
    await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'preorder.update', entity_type: 'preorder_requests', entity_id: id, metadata: { fields: Object.keys(patch), requestId } });
    return apiJson({ preorder: data, requestId }, 200, origin, METHODS);
  } catch (error) { console.error(JSON.stringify({ event: 'admin_preorders_failed', requestId, error: error instanceof Error ? error.message : String(error) })); return apiJson({ error: 'Preorder administration is unavailable', requestId }, 500, origin, METHODS); }
});
