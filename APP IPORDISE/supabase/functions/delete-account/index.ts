import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, bearerToken, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const METHODS = 'POST, OPTIONS';
const MAX_BODY_BYTES = 1024;
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const emailHash = async (email: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
};

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
  if (parsed.error || Object.keys(parsed.value || {}).length) return json({ error: 'Invalid request', requestId }, 400, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Account deletion is temporarily unavailable', requestId }, 503, origin);
  const token = bearerToken(request.headers.get('Authorization'));
  if (!token || token === request.headers.get('apikey')) return json({ error: 'Sign in again to delete your account', requestId }, 401, origin);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  let stage = 'authenticate';

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData.user;
    if (authError || !user?.id || !user.email) return json({ error: 'Sign in again to delete your account', requestId }, 401, origin);
    if (!await consumeRateLimit(admin, request, `delete-account:${user.id}`, 3, 86_400)) return json({ error: 'Please wait before trying again', code: 'RATE_LIMITED', requestId }, 429, origin);

    stage = 'prepare';
    const normalizedEmail = user.email.trim().toLowerCase();
    const hash = await emailHash(normalizedEmail);
    const { data: orders, error: orderReadError } = await admin.from('orders').select('id').eq('user_id', user.id);
    if (orderReadError) throw orderReadError;
    const orderIds = (orders || []).map(order => order.id);

    stage = 'remove-reviews';
    if (orderIds.length) {
      const { error: verificationOrderError } = await admin.from('product_review_verifications').delete().in('order_id', orderIds);
      if (verificationOrderError) throw verificationOrderError;
      const { error: reviewOrderError } = await admin.from('product_reviews').delete().in('order_id', orderIds);
      if (reviewOrderError) throw reviewOrderError;
    }
    const { error: verificationEmailError } = await admin.from('product_review_verifications').delete().eq('email_hash', hash);
    if (verificationEmailError) throw verificationEmailError;
    const { error: reviewEmailError } = await admin.from('product_reviews').delete().eq('reviewer_email_hash', hash);
    if (reviewEmailError) throw reviewEmailError;

    stage = 'anonymize-orders';
    const deletedCustomer = {
      name: 'Deleted customer',
      phone: '+212500000000',
      email: null,
      city: 'Deleted',
      address: 'Deleted',
    };
    const { error: orderError } = await admin.from('orders').update({
      user_id: null,
      customer: deletedCustomer,
      notes: null,
    }).eq('user_id', user.id);
    if (orderError) throw orderError;
    stage = 'remove-support';
    const { error: supportError } = await admin.from('support_conversations').delete().ilike('customer_email', normalizedEmail);
    if (supportError) throw supportError;
    stage = 'remove-newsletter';
    const { error: newsletterError } = await admin.from('newsletter_subscribers').delete().ilike('email', normalizedEmail);
    if (newsletterError) throw newsletterError;
    stage = 'remove-avatar';
    const { error: avatarError } = await admin.storage.from('customer-avatars').remove([`${user.id}/profile`]);
    if (avatarError) console.warn(JSON.stringify({ requestId, event: 'customer_avatar_cleanup_skipped', error: avatarError.message }));

    stage = 'delete-auth-user';
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    console.info(JSON.stringify({ requestId, event: 'customer_account_deleted', userId: user.id }));
    return json({ deleted: true, requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'customer_account_deletion_failed', stage, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Account deletion could not be completed. Please try again.', code: 'DELETE_FAILED', requestId }, 500, origin);
  }
});
