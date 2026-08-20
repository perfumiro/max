import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, rejectUntrustedOrigin, requestOrigin, verifyFirebaseStaff } from '../_shared/security.ts';

const METHODS = 'GET, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const positiveInteger = (value: string | null, fallback: number, maximum: number) => {
  if (value === null) return fallback;
  return /^\d+$/.test(value) ? Math.max(1, Math.min(maximum, Number(value))) : null;
};

Deno.serve(async request => {
  const origin = requestOrigin(request);
  const requestId = crypto.randomUUID();
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS);
  if (originError) return originError;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED', requestId }, 405, origin);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Administration configuration missing', requestId }, 503, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const staff = await verifyFirebaseStaff(request.headers.get('Authorization'));
  if (!staff) return json({ error: 'Unauthorized', code: 'UNAUTHORIZED', requestId }, 401, origin);
  try {
    if (!await consumeRateLimit(admin, request, `admin-customers:${staff.uid}`, 120, 900)) return json({ error: 'Too many administration requests', code: 'RATE_LIMITED', requestId }, 429, origin);
    const search = new URL(request.url).searchParams;
    const page = positiveInteger(search.get('page'), 1, 10_000);
    const pageSize = positiveInteger(search.get('pageSize'), 50, 100);
    const term = String(search.get('q') || '').trim().slice(0, 80);
    if (page === null || pageSize === null) return json({ error: 'Invalid pagination', code: 'INVALID_QUERY', requestId }, 400, origin);
    const { data, error } = await admin.rpc('list_admin_customers', { p_page: page, p_page_size: pageSize, p_search: term || null });
    if (error) throw error;
    return json({ ...(data || { customers: [], pagination: { page, pageSize, total: 0 } }), requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'admin_customers_failed', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Customer administration request failed', requestId }, 500, origin);
  }
});
