import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeMoroccanPhone } from '../_shared/orderIdentity.ts';
import { guestOrderToken } from '../_shared/guestOrderToken.ts';
import { apiHeaders, apiJson, bearerToken, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_BOUTIQUE_EMAIL = 'perfumiro@gmail.com';
// These identifiers are intentionally public and already shipped by the
// website checkout. Keeping the same defaults here makes native-app orders use
// the proven EmailJS service without placing any private credential in the app.
const DEFAULT_EMAILJS_SERVICE_ID = 'service_8aoubkb';
const DEFAULT_EMAILJS_ADMIN_TEMPLATE_ID = 'template_ab23cpc';
const DEFAULT_EMAILJS_CUSTOMER_TEMPLATE_ID = 'template_bp5cscd';
const DEFAULT_EMAILJS_PUBLIC_KEY = 'kNyQsCbHg-0jS4Xks';
const DEFAULT_EMAILJS_ALLOWED_ORIGIN = 'https://ipordise.com';
const METHODS = 'POST, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const normalizeSize = (value: unknown) => String(value || '').toLowerCase().replace(/\s+/g, '');
const preferredSize = (sizes: Record<string, number>) => Object.entries(sizes).find(([size]) => normalizeSize(size) === '100ml') || Object.entries(sizes).sort(([a], [b]) => (parseFloat(b) || 0) - (parseFloat(a) || 0))[0];
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] || character);
const formatMad = (value: number) => `${new Intl.NumberFormat('fr-MA').format(value)} MAD`;
const hasOnlyKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};
const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 8_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
};

const legacySchemaError = (error: any) => {
  const message = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('pgrst202') || message.includes('create_commerce_order_safe') || message.includes('product_variants');
};

async function createLegacySchemaOrder(admin: any, input: {
  userId: string | null;
  customer: Record<string, unknown>;
  requested: Array<{ variantId: string; quantity: unknown; expectedUnitPriceMinor: unknown }>;
  idempotencyKey: string;
  notes: string | null;
  source: string;
}) {
  const { data: existing, error: existingError } = await admin.from('orders').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.user_id !== input.userId) throw new Error('IDEMPOTENCY_OWNER_MISMATCH');
    return { order: { ...existing, discount: 0, source: input.source }, replayed: true };
  }

  const parsed = input.requested.map(item => {
    const separator = item.variantId.lastIndexOf(':');
    return {
      ...item,
      productId: separator > 0 ? item.variantId.slice(0, separator) : '',
      sizeKey: separator > 0 ? normalizeSize(item.variantId.slice(separator + 1)) : '',
    };
  });
  if (parsed.some(item => !item.productId || !item.sizeKey)) throw new Error('ITEM_UNAVAILABLE');
  const productIds = [...new Set(parsed.map(item => item.productId))];
  const { data: products, error: productError } = await admin.from('products').select('id,name,brand,image,sizes,stock_left,active').in('id', productIds);
  if (productError) throw productError;
  const byId = new Map((products || []).map((product: any) => [String(product.id), product]));
  let subtotal = 0;
  const items = parsed.map(item => {
    const product: any = byId.get(item.productId);
    if (!product?.active || !product.sizes || typeof product.sizes !== 'object') throw new Error('ITEM_UNAVAILABLE');
    const sizeEntry = Object.entries(product.sizes as Record<string, unknown>).find(([size]) => normalizeSize(size) === item.sizeKey);
    const unitPrice = Number(sizeEntry?.[1]);
    const quantity = Number(item.quantity);
    if (!sizeEntry || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('ITEM_UNAVAILABLE');
    if (Math.round(unitPrice * 100) !== Number(item.expectedUnitPriceMinor)) throw new Error('PRICE_CHANGED');
    if (product.stock_left != null && Number(product.stock_left) < quantity) throw new Error('OUT_OF_STOCK');
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    return {
      productId: item.productId,
      variantId: item.variantId,
      name: product.name,
      productName: product.name,
      brand: product.brand,
      image: product.image,
      size: sizeEntry[0],
      quantity,
      unitPrice,
      unitPriceMinor: Math.round(unitPrice * 100),
      lineTotal,
      lineTotalMinor: Math.round(lineTotal * 100),
    };
  });

  const city = String(input.customer.city || '').trim().toLowerCase();
  const { data: settingsRows, error: settingsError } = await admin.from('store_settings').select('value').eq('id', 'main').limit(1);
  if (settingsError) throw settingsError;
  const settings = settingsRows?.[0]?.value || {};
  const supported = Array.isArray(settings.supported_cities) ? settings.supported_cities.map((value: unknown) => String(value).trim().toLowerCase()) : [];
  if (supported.length && !supported.includes(city)) throw new Error('DELIVERY_UNAVAILABLE');
  let deliveryFee = Number(settings.delivery_fees?.[city] ?? settings.delivery_fee ?? 35);
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > 100_000) throw new Error('DELIVERY_CONFIGURATION_INVALID');
  const freeThreshold = Number(settings.free_delivery_threshold);
  if (Number.isFinite(freeThreshold) && freeThreshold >= 0 && subtotal >= freeThreshold) deliveryFee = 0;
  const orderNumber = `IP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const payload = {
    user_id: input.userId,
    order_number: orderNumber,
    customer: input.customer,
    items,
    subtotal,
    delivery_fee: deliveryFee,
    total: subtotal + deliveryFee,
    currency: 'MAD',
    status: 'pending',
    payment_method: 'cash_on_delivery',
    notes: input.notes,
    idempotency_key: input.idempotencyKey,
    risk_score: 0,
    risk_level: 'low',
    risk_flags: [],
    notification_status: 'pending',
  };
  const { data: inserted, error: insertError } = await admin.from('orders').insert(payload).select('*').single();
  if (insertError?.code === '23505') {
    const { data: replay, error: replayError } = await admin.from('orders').select('*').eq('idempotency_key', input.idempotencyKey).single();
    if (replayError) throw replayError;
    if (replay.user_id !== input.userId) throw new Error('IDEMPOTENCY_OWNER_MISMATCH');
    return { order: { ...replay, discount: 0, source: input.source }, replayed: true };
  }
  if (insertError) throw insertError;
  return { order: { ...inserted, discount: 0, source: input.source }, replayed: false };
}

async function sendOrderNotifications(order: any, customer: any, items: any[], notes: string | null, risk: { score: number; level: string; flags: string[] }) {
  const emailJsServiceId = Deno.env.get('EMAILJS_SERVICE_ID')?.trim() || DEFAULT_EMAILJS_SERVICE_ID;
  const emailJsTemplateId = Deno.env.get('EMAILJS_ORDER_TEMPLATE_ID')?.trim();
  const emailJsAdminTemplateId = Deno.env.get('EMAILJS_ADMIN_TEMPLATE_ID')?.trim() || emailJsTemplateId || DEFAULT_EMAILJS_ADMIN_TEMPLATE_ID;
  const emailJsCustomerTemplateId = Deno.env.get('EMAILJS_CUSTOMER_TEMPLATE_ID')?.trim() || emailJsTemplateId || DEFAULT_EMAILJS_CUSTOMER_TEMPLATE_ID;
  const emailJsPublicKey = Deno.env.get('EMAILJS_PUBLIC_KEY')?.trim() || DEFAULT_EMAILJS_PUBLIC_KEY;
  const emailJsPrivateKey = Deno.env.get('EMAILJS_PRIVATE_KEY')?.trim();
  const emailJsAllowedOrigin = (Deno.env.get('EMAILJS_ALLOWED_ORIGIN')?.trim() || DEFAULT_EMAILJS_ALLOWED_ORIGIN).replace(/\/$/, '');
  const resendApiKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL')?.trim();
  const boutiqueEmail = Deno.env.get('ORDER_NOTIFICATION_EMAIL')?.trim() || DEFAULT_BOUTIQUE_EMAIL;
  const emailJsConfigured = Boolean(emailJsServiceId && emailJsAdminTemplateId && emailJsPublicKey);
  const resendConfigured = Boolean(resendApiKey && resendFrom);
  if (!emailJsConfigured && !resendConfigured) {
    console.warn(JSON.stringify({ event: 'order_email_skipped', orderId: order.id, reason: 'email_configuration_missing' }));
    return 'skipped' as const;
  }
  const itemRows = items.map(item => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(item.brand)} ${escapeHtml(item.name)}<br><span style="color:#777">${escapeHtml(item.size)} × ${item.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:700">${escapeHtml(formatMad(item.lineTotal))}</td></tr>`).join('');
  const shell = (heading: string, introduction: string, details: string) => `<!doctype html><html><body style="margin:0;background:#f6f3f1;font-family:Arial,sans-serif;color:#211719"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e5ddda;border-radius:20px;padding:28px"><div style="font-family:Georgia,serif;font-size:28px;font-weight:700">IPORDISE</div><div style="height:2px;width:72px;background:#d7193f;margin:8px 0 24px"></div><p style="font-size:12px;letter-spacing:1.4px;color:#d7193f;font-weight:700">ORDER ${escapeHtml(order.order_number)}</p><h1 style="font-family:Georgia,serif;font-size:25px;margin:8px 0">${heading}</h1><p style="color:#6f6661;line-height:1.6">${introduction}</p>${details}<table style="width:100%;border-collapse:collapse;margin-top:18px">${itemRows}</table><div style="display:flex;justify-content:space-between;align-items:center;background:#f5f1ef;border-radius:14px;padding:16px;margin-top:20px"><span style="font-weight:700">Order total</span><strong style="font-size:22px">${escapeHtml(formatMad(order.total))}</strong></div><p style="font-size:12px;color:#887d77;margin-top:22px">Cash on delivery · Delivery across Morocco</p></div></div></body></html>`;
  const messages: Array<{ to: string; subject: string; html: string; key: string; templateId?: string; replyTo?: string }> = [];
  if (boutiqueEmail) messages.push({
    to: boutiqueEmail,
    subject: `New IPORDISE order ${order.order_number} · ${formatMad(order.total)}`,
    key: `boutique-order-${order.id}`,
    templateId: emailJsAdminTemplateId,
    replyTo: customer.email || undefined,
    html: shell('A new order is ready to review.', 'The order is now available in the protected IPORDISE administration panel.', `<div style="background:#f9f8f7;border-radius:14px;padding:16px;margin-top:18px"><strong>${escapeHtml(customer.name)}</strong><br>${escapeHtml(customer.phone)}${customer.email ? `<br>${escapeHtml(customer.email)}` : ''}<br>${escapeHtml(customer.address)}, ${escapeHtml(customer.city)}${notes ? `<p style="margin:12px 0 0"><strong>Note:</strong> ${escapeHtml(notes)}</p>` : ''}</div>${risk.level !== 'low' ? `<div style="background:#fff4df;color:#704515;border-radius:14px;padding:14px;margin-top:14px"><strong>Review priority: ${escapeHtml(risk.level.toUpperCase())}</strong><br>Score ${risk.score}/100 · ${escapeHtml(risk.flags.join(', '))}</div>` : ''}<p style="margin:20px 0 0"><a href="https://ipordise.com/app?admin=1" style="display:inline-block;background:#211719;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:700">Open administration panel</a></p>`),
  });
  if (customer.email) messages.push({
    to: customer.email,
    subject: `We received your IPORDISE order ${order.order_number}`,
    key: `customer-order-${order.id}`,
    templateId: emailJsCustomerTemplateId || emailJsAdminTemplateId,
    html: shell(`Thank you, ${escapeHtml(customer.name)}.`, 'Your fragrance order has been received. Our boutique team will confirm availability and contact you before dispatch.', `<div style="background:#edf8f1;color:#176b43;border-radius:14px;padding:14px;margin-top:18px;font-weight:700">Pending boutique confirmation</div><p style="margin:20px 0 0"><a href="https://ipordise.com/app?store=1&tab=help&destination=track" style="display:inline-block;background:#d7193f;color:#fff;text-decoration:none;border-radius:12px;padding:13px 18px;font-weight:700">Track my order</a></p>`),
  });
  const sendMessage = async (message: typeof messages[number]) => {
    const providerErrors: string[] = [];
    if (emailJsConfigured && message.templateId) {
      try {
        const response = await fetchWithTimeout('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: emailJsAllowedOrigin,
            Referer: `${emailJsAllowedOrigin}/`,
          },
          body: JSON.stringify({
            service_id: emailJsServiceId,
            template_id: message.templateId,
            user_id: emailJsPublicKey,
            ...(emailJsPrivateKey ? { accessToken: emailJsPrivateKey } : {}),
            template_params: {
              to_email: message.to,
              reply_to: message.replyTo || boutiqueEmail,
              subject: message.subject,
              order_id: order.order_number,
              order_number: order.order_number,
              customer_name: customer.name,
              customer_phone: customer.phone,
              customer_email: customer.email || '',
              delivery_address: `${customer.address}, ${customer.city}`,
              customer_address: `${customer.address}, ${customer.city}`,
              order_total: formatMad(order.total),
              order_notes: notes || '',
              customer_notes: notes || '',
              order_subtotal: formatMad(Number(order.subtotal || 0)),
              order_shipping: formatMad(Number(order.delivery_fee || 0)),
              order_discount: formatMad(Number(order.discount || 0)),
              order_date: new Intl.DateTimeFormat('fr-MA',{dateStyle:'long'}).format(new Date(order.created_at)),
              order_channel: String(order.source || 'website'),
              order_items: items.map(item => `${item.quantity} x ${item.brand} ${item.name} (${item.size}) - ${formatMad(item.lineTotal)}`).join('\n'),
              message_html: message.html,
            },
          }),
        });
        if (response.ok) return;
        providerErrors.push(`EmailJS ${response.status}`);
      } catch (error) {
        providerErrors.push(error instanceof DOMException && error.name === 'AbortError' ? 'EmailJS timeout' : 'EmailJS network error');
      }
    }
    if (resendConfigured) {
      try {
        const response = await fetchWithTimeout('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.key }, body: JSON.stringify({ from: resendFrom, to: [message.to], subject: message.subject, html: message.html, ...(message.replyTo ? { reply_to: message.replyTo } : {}) }) });
        if (response.ok) return;
        providerErrors.push(`Resend ${response.status}`);
      } catch (error) {
        providerErrors.push(error instanceof DOMException && error.name === 'AbortError' ? 'Resend timeout' : 'Resend network error');
      }
    }
    throw new Error(providerErrors.join('; ') || 'No email provider is configured');
  };
  const results: PromiseSettledResult<void>[] = [];
  for (const message of messages) {
    if (emailJsConfigured && results.length) await new Promise(resolve => setTimeout(resolve, 1_050));
    try { await sendMessage(message); results.push({ status: 'fulfilled', value: undefined }); }
    catch (reason) { results.push({ status: 'rejected', reason }); }
  }
  results.forEach((result, index) => {
    if (result.status === 'rejected') console.error(JSON.stringify({ event: 'order_email_failed', orderId: order.id, recipientType: index === 0 && boutiqueEmail ? 'boutique' : 'customer', error: String(result.reason) }));
  });
  const sent = results.filter(result => result.status === 'fulfilled').length;
  return sent === results.length ? 'sent' as const : sent > 0 ? 'partial' as const : 'failed' as const;
}

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
  if (parsed.error === 'too_large') return json({ error: 'Order is too large', requestId }, 413, origin);
  if (parsed.error) return json({ error: 'Invalid order payload', requestId }, 400, origin);
  const payload = parsed.value!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Checkout configuration missing', requestId }, 500, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  try {
    if (!await consumeRateLimit(admin, request, 'create-order:preauth', 60, 900)) return json({ error: 'Too many checkout attempts. Please wait and try again.', code: 'RATE_LIMITED', requestId }, 429, origin);
    const bearer = bearerToken(request.headers.get('Authorization'));
    const apiKey = request.headers.get('apikey')?.trim() || '';
    let authenticatedUser: { id: string; email?: string } | null = null;
    if (bearer && bearer !== apiKey) {
      const { data: authData, error: authError } = await admin.auth.getUser(bearer);
      if (authError || !authData.user) return json({ error: 'Your session has expired. Please sign in again.', requestId }, 401, origin);
      authenticatedUser = { id: authData.user.id, email: authData.user.email };
    }
    const checkoutScope = authenticatedUser ? `create-order:${authenticatedUser.id}` : 'create-order:guest';
    const checkoutLimit = authenticatedUser ? 25 : 8;
    if (!await consumeRateLimit(admin, request, checkoutScope, checkoutLimit, 900)) return json({ error: 'Too many checkout attempts. Please wait and try again.', code: 'RATE_LIMITED', requestId }, 429, origin);
    if (!hasOnlyKeys(payload, ['idempotencyKey', 'customer', 'items', 'notes', 'source'])) return json({ error: 'Order payload contains unsupported fields', code: 'INVALID_REQUEST', requestId }, 400, origin);
    const key = String(payload.idempotencyKey || '');
    if (!/^[a-z0-9-]{20,100}$/i.test(key)) return json({ error: 'Invalid checkout session', requestId }, 400, origin);
    if (!payload.customer || typeof payload.customer !== 'object' || Array.isArray(payload.customer)) return json({ error: 'Please verify your delivery details', code: 'INVALID_CUSTOMER', requestId }, 400, origin);
    const customer = payload.customer as Record<string, unknown>;
    if (!hasOnlyKeys(customer, ['name', 'phone', 'email', 'city', 'address']) || ['name', 'phone', 'city', 'address'].some(field => typeof customer[field] !== 'string') || (customer.email != null && typeof customer.email !== 'string')) return json({ error: 'Please verify your delivery details', code: 'INVALID_CUSTOMER', requestId }, 400, origin);
    const name = customer.name.trim().slice(0, 120);
    const phone = normalizeMoroccanPhone(customer.phone);
    const email = typeof customer.email === 'string' ? customer.email.trim().toLowerCase().slice(0, 254) || null : null;
    const city = customer.city.trim().slice(0, 100);
    const address = customer.address.trim().slice(0, 300);
    if (name.length < 2 || !phone || city.length < 2 || address.length < 5 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: 'Please verify your delivery details', code: 'INVALID_CUSTOMER', requestId }, 400, origin);
    if (!Array.isArray(payload.items) || payload.items.length > 50 || payload.items.some(item => !item || typeof item !== 'object' || Array.isArray(item) || !hasOnlyKeys(item, ['variantId', 'quantity', 'expectedUnitPriceMinor']))) return json({ error: 'One or more bag items are invalid', code: 'INVALID_ITEMS', requestId }, 400, origin);
    const requested = payload.items.map((item: Record<string, unknown>) => ({
      variantId: typeof item.variantId === 'string' ? item.variantId : '',
      quantity: item.quantity,
      expectedUnitPriceMinor: item.expectedUnitPriceMinor,
    })).sort((left, right) => left.variantId.localeCompare(right.variantId));
    if (!requested.length) return json({ error: 'Your shopping bag is empty', requestId }, 400, origin);
    if (requested.some(item => !/^[a-z0-9][a-z0-9:_-]{2,255}$/i.test(item.variantId) || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20 || !Number.isSafeInteger(item.expectedUnitPriceMinor) || Number(item.expectedUnitPriceMinor) < 0 || Number(item.expectedUnitPriceMinor) > 100_000_000)) {
      return json({ error: 'One or more bag items are invalid', code: 'INVALID_ITEMS', requestId }, 400, origin);
    }
    if (new Set(requested.map(item => item.variantId)).size !== requested.length) return json({ error: 'Duplicate bag items must be combined before checkout', code: 'DUPLICATE_ITEM', requestId }, 400, origin);
    if (payload.notes != null && typeof payload.notes !== 'string') return json({ error: 'Order notes are invalid', code: 'INVALID_REQUEST', requestId }, 400, origin);
    const notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 1000) || null : null;
    if (payload.source !== 'website' && payload.source !== 'mobile_app') return json({ error: 'Invalid order source', code: 'INVALID_REQUEST', requestId }, 400, origin);
    const source = payload.source;
    const normalizedCustomer = { name, phone, email, city, address };
    const confirmedCustomer = { ...normalizedCustomer, email: authenticatedUser?.email || normalizedCustomer.email };
    const requestHash = await sha256(JSON.stringify({ customer: confirmedCustomer, items: [...requested].sort((a, b) => a.variantId.localeCompare(b.variantId)), notes, source }));
    const { data: rpcCheckoutResult, error: checkoutError } = await admin.rpc('create_commerce_order_safe', {
      p_user_id: authenticatedUser?.id || null,
      p_customer: confirmedCustomer,
      p_requested_items: requested,
      p_idempotency_key: key,
      p_request_hash: requestHash,
      p_notes: notes,
      p_source: source,
    });
    let checkoutResult = rpcCheckoutResult;
    if (checkoutError && legacySchemaError(checkoutError)) {
      console.warn(JSON.stringify({ requestId, event: 'legacy_order_schema_fallback' }));
      try {
        checkoutResult = await createLegacySchemaOrder(admin, {
          userId: authenticatedUser?.id || null,
          customer: confirmedCustomer,
          requested,
          idempotencyKey: key,
          notes,
          source,
        });
      } catch (legacyError) {
        const code = ['PRICE_CHANGED', 'OUT_OF_STOCK', 'ITEM_UNAVAILABLE', 'DELIVERY_UNAVAILABLE', 'IDEMPOTENCY_OWNER_MISMATCH'].find(value => String(legacyError instanceof Error ? legacyError.message : legacyError).includes(value));
        if (code) {
          const messages: Record<string, string> = {
            PRICE_CHANGED: 'The price of one item has changed. Please review your order.',
            OUT_OF_STOCK: 'An item in your bag is no longer available in the requested quantity.',
            ITEM_UNAVAILABLE: 'An item in your bag is no longer available.',
            DELIVERY_UNAVAILABLE: 'Delivery is not currently available for the selected city.',
            IDEMPOTENCY_OWNER_MISMATCH: 'This checkout session belongs to another account.',
          };
          return json({ error: messages[code], code, requestId }, 409, origin);
        }
        throw legacyError;
      }
    } else if (checkoutError) {
      const code = ['PRICE_CHANGED', 'OUT_OF_STOCK', 'ITEM_UNAVAILABLE', 'DELIVERY_UNAVAILABLE', 'IDEMPOTENCY_PAYLOAD_MISMATCH', 'IDEMPOTENCY_OWNER_MISMATCH'].find(value => String(checkoutError.message || '').includes(value));
      if (code) {
        const messages: Record<string, string> = {
          PRICE_CHANGED: 'The price of one item has changed. Please review your order.',
          OUT_OF_STOCK: 'An item in your bag is no longer available in the requested quantity.',
          ITEM_UNAVAILABLE: 'An item in your bag is no longer available.',
          DELIVERY_UNAVAILABLE: 'Delivery is not currently available for the selected city.',
          IDEMPOTENCY_PAYLOAD_MISMATCH: 'This checkout session was already used for a different order.',
          IDEMPOTENCY_OWNER_MISMATCH: 'This checkout session belongs to another account.',
        };
        return json({ error: messages[code], code, requestId }, 409, origin);
      }
      throw checkoutError;
    }
    const order = checkoutResult?.order;
    if (!order?.id) throw new Error('Transactional checkout did not return an order');
    const items = Array.isArray(order.items) ? order.items : [];
    const total = Number(order.total || 0);
    const flags: string[] = [];
    let riskScore = 0;
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (!checkoutResult.replayed) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentQuery = admin.from('orders').select('created_at,total').gte('created_at', since).neq('status', 'cancelled');
      const { data: recentOrders, error: recentError } = authenticatedUser
        ? await recentQuery.eq('user_id', authenticatedUser.id)
        : await recentQuery.eq('customer->>phone', phone);
      if (recentError) console.error(JSON.stringify({ requestId, event: 'order_risk_lookup_failed', orderId: order.id }));
      const recent = recentOrders || [];
      const lastFifteenMinutes = recent.filter((entry: any) => Date.parse(entry.created_at) >= Date.now() - 15 * 60 * 1000).length;
      if (lastFifteenMinutes >= 2) { riskScore += 45; flags.push('rapid_repeat_orders'); }
      else if (recent.length >= 3) { riskScore += 25; flags.push('high_daily_order_frequency'); }
    }
    if (total >= 5000) { riskScore += 30; flags.push('high_order_value'); }
    if (totalQuantity >= 8) { riskScore += 20; flags.push('bulk_quantity'); }
    if (email && authenticatedUser?.email && email !== authenticatedUser.email.toLowerCase()) { riskScore += 15; flags.push('checkout_email_mismatch'); }
    riskScore = Math.min(100, riskScore);
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 25 ? 'review' : 'low';
    const risk = checkoutResult.replayed
      ? { score: Number(order.risk_score || 0), level: String(order.risk_level || 'low'), flags: Array.isArray(order.risk_flags) ? order.risk_flags : [] }
      : { score: riskScore, level: riskLevel, flags };
    const notificationNeedsDelivery = String(order.notification_status || 'pending') !== 'sent';
    if (notificationNeedsDelivery) {
      const notificationCustomer = checkoutResult.replayed && order.customer && typeof order.customer === 'object'
        ? order.customer
        : confirmedCustomer;
      const notificationNotes = checkoutResult.replayed
        ? (typeof order.notes === 'string' ? order.notes : null)
        : notes;
      const notificationStatus = await sendOrderNotifications(order, notificationCustomer, items, notificationNotes, risk);
      const update = checkoutResult.replayed
        ? { notification_status: notificationStatus }
        : { risk_score: riskScore, risk_level: riskLevel, risk_flags: flags, notification_status: notificationStatus };
      const { error: notificationError } = await admin.from('orders').update(update).eq('id', order.id);
      if (notificationError) console.error(JSON.stringify({ requestId, event: 'order_post_commit_update_failed', orderId: order.id }));
    }
    const trackingToken = await guestOrderToken(serviceKey, order.id, order.order_number);
    return json({ id: order.id, orderNumber: order.order_number, trackingToken, subtotal: order.subtotal, deliveryFee: order.delivery_fee, discount: order.discount, total: order.total, currency: order.currency, status: order.status, paymentMethod: order.payment_method, source: order.source, createdAt: order.created_at }, checkoutResult.replayed ? 200 : 201, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'order_create_failed', error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'Checkout could not complete your order', requestId }, 500, origin);
  }
});
