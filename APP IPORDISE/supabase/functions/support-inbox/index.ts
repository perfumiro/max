import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin, verifyFirebaseStaff } from '../_shared/security.ts';

const MAX_BODY_BYTES = 32 * 1024;
const METHODS = 'POST, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
};

const createToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const threadResponse = async (admin: any, conversationId: string) => {
  const { data: conversation, error: conversationError } = await admin.from('support_conversations').select('id,status,subject').eq('id', conversationId).maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error('SUPPORT_NOT_FOUND');
  const { data: messages, error: messagesError } = await admin.from('support_messages').select('id,sender_type,body,created_at').eq('conversation_id', conversationId).order('created_at');
  if (messagesError) throw messagesError;
  return { id: conversation.id, status: conversation.status, subject: conversation.subject, messages: (messages || []).map((message: any) => ({ id: message.id, senderType: message.sender_type, body: message.body, createdAt: message.created_at })) };
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
  if (parsed.error === 'too_large') return json({ error: 'Request body too large', requestId }, 413, origin);
  if (parsed.error) return json({ error: 'Invalid JSON payload', requestId }, 400, origin);
  const payload = parsed.value!;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration missing', requestId }, 500, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const action = String(payload.action || '');
    if (action === 'create') {
      if (!await consumeRateLimit(admin, request, 'support:create', 6, 3600)) return json({ error: 'Please wait before opening another conversation.', requestId }, 429, origin);
      const name = String(payload.name || '').trim().slice(0, 120);
      const email = String(payload.email || '').trim().toLowerCase().slice(0, 254);
      const subject = String(payload.subject || '').trim().slice(0, 120);
      const message = String(payload.message || '').trim().slice(0, 4000);
      const orderNumber = String(payload.orderNumber || '').trim().slice(0, 80) || null;
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 2 || message.length < 5) return json({ error: 'Please complete every required field.', requestId }, 400, origin);
      const since = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count } = await admin.from('support_conversations').select('id', { count: 'exact', head: true }).eq('customer_email', email).gte('created_at', since);
      if ((count || 0) >= 3) return json({ error: 'Please wait before opening another conversation.', requestId }, 429, origin);
      const clientToken = createToken();
      const { data: conversationId, error } = await admin.rpc('create_support_conversation', {
        p_name: name, p_email: email, p_subject: subject, p_message: message,
        p_order_number: orderNumber, p_client_token_hash: await hashToken(clientToken),
      });
      if (error) {
        if (String(error.message || '').includes('SUPPORT_RATE_LIMITED')) return json({ error: 'Please wait before opening another conversation.', code: 'RATE_LIMITED', requestId }, 429, origin);
        throw error;
      }
      if (!conversationId) throw new Error('Support transaction did not return a conversation');
      return json({ conversationId, clientToken }, 201, origin);
    }

    if (action === 'customer_thread' || action === 'customer_reply') {
      if (!await consumeRateLimit(admin, request, `support:${action}`, 120, 3600)) return json({ error: 'Too many support requests. Please try later.', requestId }, 429, origin);
      const conversationId = String(payload.conversationId || '');
      const clientToken = String(payload.clientToken || '');
      if (!/^[0-9a-f-]{36}$/i.test(conversationId) || clientToken.length < 32) return json({ error: 'Conversation access is invalid.', requestId }, 401, origin);
      const tokenHash = await hashToken(clientToken);
      const { data: conversation } = await admin.from('support_conversations').select('id,status').eq('id', conversationId).eq('client_token_hash', tokenHash).maybeSingle();
      if (!conversation) return json({ error: 'Conversation access is invalid.', requestId }, 401, origin);
      if (action === 'customer_reply') {
        const message = String(payload.message || '').trim().slice(0, 4000);
        if (!message) return json({ error: 'Write a message before sending.', requestId }, 400, origin);
        if (conversation.status === 'closed') return json({ error: 'This conversation is closed.', requestId }, 409, origin);
        const since = new Date(Date.now() - 60 * 60_000).toISOString();
        const { count } = await admin.from('support_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversationId).eq('sender_type', 'customer').gte('created_at', since);
        if ((count || 0) >= 20) return json({ error: 'Message limit reached. Please try again later.', requestId }, 429, origin);
        const { error } = await admin.rpc('append_support_message', { p_conversation_id: conversationId, p_sender_type: 'customer', p_body: message, p_next_status: 'open' });
        if (error) {
          if (String(error.message || '').includes('SUPPORT_MESSAGE_RATE_LIMITED')) return json({ error: 'Message limit reached. Please try again later.', code: 'RATE_LIMITED', requestId }, 429, origin);
          throw error;
        }
      }
      return json(await threadResponse(admin, conversationId), 200, origin);
    }

    const staff = await verifyFirebaseStaff(request.headers.get('Authorization'));
    if (!staff) return json({ error: 'Unauthorized', requestId }, 401, origin);
    if (!await consumeRateLimit(admin, request, `support:admin:${staff.uid}`, 240, 900)) return json({ error: 'Too many administration requests', requestId }, 429, origin);

    if (action === 'admin_list') {
      const status = String(payload.status || 'open');
      const page = Number(payload.page ?? 1);
      const pageSize = Number(payload.pageSize ?? 100);
      if (!['all', 'open', 'pending_customer', 'resolved', 'closed'].includes(status) || !Number.isInteger(page) || page < 1 || page > 10_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return json({ error: 'Invalid inbox query.', code: 'INVALID_QUERY', requestId }, 400, origin);
      let query = admin.from('support_conversations').select('id,customer_name,customer_email,order_number,subject,status,priority,last_message_at,created_at', { count: 'exact' }).order('last_message_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      if (status !== 'all') query = query.eq('status', status);
      const { data, error, count } = await query;
      if (error) throw error;
      return json({ conversations: data || [], pagination: { page, pageSize, total: count || 0 }, requestId }, 200, origin);
    }
    if (action === 'admin_thread') {
      const conversationId = String(payload.conversationId || '');
      if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return json({ error: 'Invalid conversation.', requestId }, 400, origin);
      return json({ ...(await threadResponse(admin, conversationId)), requestId }, 200, origin);
    }
    if (action === 'admin_reply') {
      const conversationId = String(payload.conversationId || '');
      const message = String(payload.message || '').trim().slice(0, 4000);
      if (!/^[0-9a-f-]{36}$/i.test(conversationId) || !message) return json({ error: 'Invalid reply.', requestId }, 400, origin);
      const { error } = await admin.rpc('append_support_message', { p_conversation_id: conversationId, p_sender_type: 'staff', p_body: message, p_next_status: 'pending_customer' });
      if (error) {
        if (String(error.message || '').includes('SUPPORT_NOT_FOUND')) return json({ error: 'Conversation not found', code: 'NOT_FOUND', requestId }, 404, origin);
        throw error;
      }
      const { error: auditError } = await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'support.reply', entity_type: 'support_conversation', entity_id: conversationId, metadata: { requestId } });
      if (auditError) console.error(JSON.stringify({ requestId, event: 'admin_audit_write_failed', action: 'support.reply' }));
      return json({ ...(await threadResponse(admin, conversationId)), requestId }, 200, origin);
    }
    if (action === 'admin_update') {
      const conversationId = String(payload.conversationId || '');
      const status = String(payload.status || '');
      const priority = String(payload.priority || '');
      if (!/^[0-9a-f-]{36}$/i.test(conversationId) || !['open', 'pending_customer', 'resolved', 'closed'].includes(status) || !['low', 'normal', 'high', 'urgent'].includes(priority)) return json({ error: 'Invalid conversation update.', requestId }, 400, origin);
      const { data: updated, error } = await admin.from('support_conversations').update({ status, priority, assigned_to: null }).eq('id', conversationId).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) return json({ error: 'Conversation not found', code: 'NOT_FOUND', requestId }, 404, origin);
      return json({ ok: true, requestId }, 200, origin);
    }
    return json({ error: 'Unsupported action', requestId }, 400, origin);
  } catch (error) {
    if (error instanceof Error && error.message.includes('SUPPORT_NOT_FOUND')) return json({ error: 'Conversation not found', code: 'NOT_FOUND', requestId }, 404, origin);
    console.error(JSON.stringify({ requestId, event: 'support_inbox_failed', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Customer care could not complete this request.', requestId }, 500, origin);
  }
});
