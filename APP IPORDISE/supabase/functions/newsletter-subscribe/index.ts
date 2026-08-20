import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin, verifyFirebaseStaff } from '../_shared/security.ts';

const METHODS = 'POST, OPTIONS';
const MAX_BODY_BYTES = 4 * 1024;
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase().slice(0, 254);
const validEmail = (value: string) => /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);

Deno.serve(async request => {
  const origin = requestOrigin(request);
  const requestId = crypto.randomUUID();
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS);
  if (originError) return originError;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed', requestId }, 405, origin);
  const mediaError = rejectNonJson(request, origin, requestId, METHODS);
  if (mediaError) return mediaError;
  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if (parsed.error === 'too_large') return json({ error: 'Request is too large', requestId }, 413, origin);
  if (parsed.error) return json({ error: 'Invalid request', requestId }, 400, origin);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Newsletter service unavailable', requestId }, 503, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  try {
    if (parsed.value!.action === 'admin_count') {
      const staff = await verifyFirebaseStaff(request.headers.get('Authorization'));
      if (!staff) return json({ error: 'Unauthorized', requestId }, 401, origin);
      if (!await consumeRateLimit(admin, request, `newsletter-admin:${staff.uid}`, 120, 900)) return json({ error: 'Too many administration requests', requestId }, 429, origin);
      const { count, error } = await admin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('active', true);
      if (error) throw error;
      return json({ count: count || 0, requestId }, 200, origin);
    }
    const email = normalizeEmail(parsed.value!.email);
    if (!validEmail(email)) return json({ error: 'Enter a complete email address', code: 'INVALID_EMAIL', requestId }, 400, origin);
    if (!await consumeRateLimit(admin, request, 'newsletter-subscribe', 8, 3600)) return json({ error: 'Please wait before trying again', code: 'RATE_LIMITED', requestId }, 429, origin);
    const { data: existing, error: readError } = await admin.from('newsletter_subscribers').select('active').eq('email', email).maybeSingle();
    if (readError) throw readError;
    if (existing?.active) return json({ status: 'already_subscribed', requestId }, 200, origin);
    const { error } = await admin.from('newsletter_subscribers').upsert({ email, active: true, updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (error) throw error;
    return json({ status: 'subscribed', requestId }, 201, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'newsletter_subscribe_failed', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Newsletter service temporarily unavailable', requestId }, 500, origin);
  }
});
