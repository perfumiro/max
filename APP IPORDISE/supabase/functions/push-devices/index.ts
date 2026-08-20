import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, bearerToken, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const METHODS = 'POST, OPTIONS';
const MAX_BODY_BYTES = 16 * 1024;
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const tokenPattern = /^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (parsed.error) return json({ error: 'Invalid device registration', requestId }, parsed.error === 'too_large' ? 413 : 400, origin);
  const payload = parsed.value!;
  const installationId = String(payload.installationId || '');
  const expoPushToken = String(payload.expoPushToken || '');
  const action = ['register', 'preferences', 'unlink'].includes(String(payload.action)) ? String(payload.action) : 'register';
  if (!uuidPattern.test(installationId) || !tokenPattern.test(expoPushToken)) return json({ error: 'Invalid device registration', requestId }, 400, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Push registration is unavailable', requestId }, 500, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  try {
    if (!await consumeRateLimit(admin, request, 'push-devices', 40, 900)) return json({ error: 'Too many registration attempts', requestId }, 429, origin);
    const bearer = bearerToken(request.headers.get('Authorization'));
    const apiKey = request.headers.get('apikey')?.trim() || '';
    let userId: string | null = null;
    if (bearer && bearer !== apiKey) {
      const { data, error } = await admin.auth.getUser(bearer);
      if (error || !data.user) return json({ error: 'Your session has expired', requestId }, 401, origin);
      userId = data.user.id;
    }
    const { data: current, error: readError } = await admin.from('push_devices').select('id,user_id,expo_push_token').eq('installation_id', installationId).maybeSingle();
    if (readError) throw readError;
    if (current?.user_id && current.user_id !== userId) return json({ error: 'This installation is linked to another account. Sign out before switching customers.', requestId }, 409, origin);
    if (action === 'unlink') {
      if (!userId || current?.user_id !== userId) return json({ error: 'Unauthorized', requestId }, 401, origin);
      const { error } = await admin.from('push_devices').update({ user_id: null, order_updates_enabled: false, last_seen_at: new Date().toISOString() }).eq('installation_id', installationId).eq('user_id', userId);
      if (error) throw error;
      return json({ ok: true, linked: false, requestId }, 200, origin);
    }
    const language = ['fr', 'en', 'ar'].includes(String(payload.language)) ? String(payload.language) : 'fr';
    const platform = ['android', 'ios'].includes(String(payload.platform)) ? String(payload.platform) : null;
    if (!platform) return json({ error: 'Unsupported platform', requestId }, 400, origin);
    const row = {
      installation_id: installationId, expo_push_token: expoPushToken, user_id: userId, platform, provider: 'expo', language,
      app_version: String(payload.appVersion || '').trim().slice(0, 40) || null, enabled: true,
      new_products_enabled: payload.newProductsEnabled === true,
      order_updates_enabled: Boolean(userId && payload.orderUpdatesEnabled === true),
      offers_enabled: payload.offersEnabled === true, last_seen_at: new Date().toISOString(), disabled_at: null,
    };
    const { data, error } = await admin.from('push_devices').upsert(row, { onConflict: 'installation_id' }).select('id,user_id,platform,language,enabled,new_products_enabled,order_updates_enabled,offers_enabled').single();
    if (error) throw error;
    return json({ device: data, requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'push_device_registration_failed', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Push registration could not be saved', requestId }, 500, origin);
  }
});
