import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin } from '../_shared/security.ts';

const MAX_BODY_BYTES = 16 * 1024;
const METHODS = 'POST, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase().slice(0, 254);
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validProductId = (value: string) => /^[a-z0-9][a-z0-9_-]{1,127}$/i.test(value);
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('');
const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const orderHasProduct = (order: any, productId: string) => Array.isArray(order?.items) && order.items.some((item: any) => String(item?.productId || item?.product_id || '') === productId);
const purchasedItem = (order: any, productId: string) => Array.isArray(order?.items) ? order.items.find((item: any) => String(item?.productId || item?.product_id || '') === productId) : null;
const displayName = (value: unknown) => {
  const parts = String(value || 'Verified customer').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.slice(0, 1).toUpperCase()}.` : parts[0] || 'Verified customer';
};
const verificationHash = async (secret: string, verificationId: string, email: string, productId: string, code: string) => digest(`${secret}:review-code:${verificationId}:${email}:${productId}:${code}`);
const emailHash = async (secret: string, email: string) => digest(`${secret}:review-email:${email}`);
const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 8_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
};

async function sendVerificationCode(email: string, code: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!apiKey || !from) throw new Error('Review email configuration missing');
  const response = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `${code} is your IPORDISE review code`,
      html: `<!doctype html><html><body style="margin:0;background:#f7f3f1;font-family:Arial,sans-serif;color:#211719"><div style="max-width:560px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e7ded9;border-radius:20px;padding:28px"><div style="font-family:Georgia,serif;font-size:27px;font-weight:700">IPORDISE</div><div style="width:68px;height:2px;background:#d7193f;margin:8px 0 24px"></div><p style="font-size:11px;font-weight:800;letter-spacing:1.3px;color:#d7193f">VERIFIED PRODUCT REVIEW</p><h1 style="font-family:Georgia,serif;font-size:24px">Confirm your purchase.</h1><p style="color:#746963;line-height:1.6">Enter this one-time code in the IPORDISE app. It expires in 10 minutes.</p><div style="margin:24px 0;padding:18px;border-radius:14px;background:#211719;color:#fff;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px">${code}</div><p style="font-size:12px;color:#8b817b">If you did not request this code, you can ignore this message.</p></div></div></body></html>`,
    }),
  });
  if (!response.ok) throw new Error(`Review email delivery failed with ${response.status}`);
}

Deno.serve(async request => {
  const origin = requestOrigin(request);
  const requestId = crypto.randomUUID();
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS);
  if (originError) return originError;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED', requestId }, 405, origin);
  const mediaError = rejectNonJson(request, origin, requestId, METHODS);
  if (mediaError) return mediaError;
  const parsed = await readJsonObject(request, MAX_BODY_BYTES);
  if (parsed.error === 'too_large') return json({ error: 'Request is too large', code: 'PAYLOAD_TOO_LARGE', requestId }, 413, origin);
  if (parsed.error) return json({ error: 'Invalid request', code: 'INVALID_REQUEST', requestId }, 400, origin);
  const payload = parsed.value!;
  const action = String(payload.action || 'list');
  const productId = String(payload.productId || '').trim();
  if (!validProductId(productId)) return json({ error: 'Invalid product', code: 'INVALID_PRODUCT', requestId }, 400, origin);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Review service unavailable', code: 'SERVICE_UNAVAILABLE', requestId }, 503, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    if (action === 'list') {
      if (!await consumeRateLimit(admin, request, `product-reviews:list:${productId}`, 120, 60)) return json({ error: 'Please wait and try again', code: 'RATE_LIMITED', requestId }, 429, origin);
      const [{ data, error }, { data: summary, error: summaryError }] = await Promise.all([
        admin.from('product_reviews').select('id,rating,title,body,reviewer_name,reviewer_city,purchased_size,created_at').eq('product_id', productId).eq('status', 'published').order('created_at', { ascending: false }).limit(50),
        admin.rpc('product_review_summary', { p_product_id: productId }),
      ]);
      if (error || summaryError) throw error || summaryError;
      const reviews = data || [];
      const count = Number(summary?.count || 0);
      const average = Number(summary?.average || 0);
      const distribution = (Array.isArray(summary?.distribution) ? summary.distribution : []).map((entry: any) => ({ stars: Number(entry.stars), count: Number(entry.count), percent: count ? Math.round(Number(entry.count) * 100 / count) : 0 }));
      return json({ average, count, distribution, reviews: reviews.map((review: any) => ({ id: review.id, rating: review.rating, title: review.title, body: review.body, reviewerName: review.reviewer_name, city: review.reviewer_city, purchasedSize: review.purchased_size, createdAt: review.created_at })) }, 200, origin);
    }

    const secret = Deno.env.get('REVIEW_VERIFICATION_SECRET');
    if (!secret || secret.length < 32) return json({ error: 'Review verification unavailable', code: 'SERVICE_UNAVAILABLE', requestId }, 503, origin);
    const email = normalizeEmail(payload.email);
    if (!validEmail(email)) return json({ error: 'Enter a complete email address', code: 'INVALID_EMAIL', requestId }, 400, origin);
    const hashedEmail = await emailHash(secret, email);

    if (action === 'request-code') {
      if (!await consumeRateLimit(admin, request, `product-reviews:request:${hashedEmail}:${productId}`, 4, 3600)) return json({ error: 'Too many verification attempts. Please try later.', code: 'RATE_LIMITED', requestId }, 429, origin);
      if (crypto.getRandomValues(new Uint8Array(1))[0] < 3) {
        await admin.from('product_review_verifications').delete().lt('expires_at', new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString());
      }
      const { data: orders, error } = await admin.from('orders').select('id,customer,items,status,created_at').eq('status', 'delivered').eq('customer->>email', email).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const order = (orders || []).find((candidate: any) => orderHasProduct(candidate, productId));
      if (!order) return json({ eligible: false, code: 'PURCHASE_NOT_FOUND' }, 200, origin);
      const { data: existingReview } = await admin.from('product_reviews').select('id').eq('order_id', order.id).eq('product_id', productId).maybeSingle();
      if (existingReview) return json({ eligible: false, alreadyReviewed: true, code: 'ALREADY_REVIEWED' }, 200, origin);
      const verificationId = crypto.randomUUID();
      const random = new Uint32Array(1); crypto.getRandomValues(random);
      const code = String(100000 + random[0] % 900000);
      const codeHash = await verificationHash(secret, verificationId, email, productId, code);
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const { error: insertError } = await admin.from('product_review_verifications').insert({ id: verificationId, product_id: productId, order_id: order.id, email_hash: hashedEmail, code_hash: codeHash, expires_at: expiresAt });
      if (insertError) throw insertError;
      try { await sendVerificationCode(email, code); } catch (emailError) {
        await admin.from('product_review_verifications').delete().eq('id', verificationId);
        throw emailError;
      }
      return json({ eligible: true, verificationId, expiresAt }, 200, origin);
    }

    const verificationId = String(payload.verificationId || '');
    const code = String(payload.code || '').trim();
    if (!/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(verificationId)) return json({ error: 'Enter the six-digit code', code: 'INVALID_CODE', requestId }, 400, origin);
    if (!await consumeRateLimit(admin, request, `product-reviews:verify:${verificationId}`, 8, 900)) return json({ error: 'Too many verification attempts', code: 'RATE_LIMITED', requestId }, 429, origin);
    const expectedHash = await verificationHash(secret, verificationId, email, productId, code);
    const { data: validCode, error: codeError } = await admin.rpc('verify_product_review_code', {
      p_verification_id: verificationId,
      p_product_id: productId,
      p_email_hash: hashedEmail,
      p_code_hash: expectedHash,
      p_mark_verified: action === 'verify-code',
    });
    if (codeError) throw codeError;
    if (!validCode) {
      return json({ error: 'The verification code is invalid or expired', code: 'INVALID_CODE', requestId }, 400, origin);
    }

    const { data: verification, error: verificationError } = await admin.from('product_review_verifications').select('id,product_id,order_id,verified_at,consumed_at').eq('id', verificationId).eq('product_id', productId).maybeSingle();
    if (verificationError) throw verificationError;
    if (!verification || verification.consumed_at) return json({ error: 'The verification code is invalid or expired', code: 'INVALID_CODE', requestId }, 400, origin);

    if (action === 'verify-code') {
      return json({ verified: true }, 200, origin);
    }

    if (action !== 'submit') return json({ error: 'Invalid review action', code: 'INVALID_ACTION', requestId }, 400, origin);
    if (!verification.verified_at) return json({ error: 'Verify your email first', code: 'NOT_VERIFIED', requestId }, 403, origin);
    const rating = Math.floor(Number(payload.rating));
    const title = String(payload.title || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    const body = String(payload.body || '').trim().replace(/\s+/g, ' ').slice(0, 1200);
    if (rating < 1 || rating > 5 || title.length < 3 || body.length < 15) return json({ error: 'Complete your rating, title, and review', code: 'INVALID_REVIEW', requestId }, 400, origin);
    const { data: order, error: orderError } = await admin.from('orders').select('id,customer,items,status').eq('id', verification.order_id).eq('status', 'delivered').maybeSingle();
    if (orderError) throw orderError;
    if (!order || !orderHasProduct(order, productId)) return json({ error: 'The delivered purchase could not be verified', code: 'PURCHASE_NOT_FOUND', requestId }, 403, origin);
    const item = purchasedItem(order, productId);
    const { error: reviewError } = await admin.from('product_reviews').insert({ product_id: productId, order_id: order.id, reviewer_email_hash: hashedEmail, reviewer_name: displayName(order.customer?.name), reviewer_city: String(order.customer?.city || '').trim().slice(0, 100) || null, purchased_size: String(item?.size || '').trim().slice(0, 30) || null, rating, title, body, status: 'published' });
    if (reviewError?.code === '23505') return json({ error: 'This purchase already has a review', code: 'ALREADY_REVIEWED', requestId }, 409, origin);
    if (reviewError) throw reviewError;
    await admin.from('product_review_verifications').update({ consumed_at: new Date().toISOString() }).eq('id', verificationId);
    const { data: ratings } = await admin.from('product_reviews').select('rating').eq('product_id', productId).eq('status', 'published');
    if (ratings?.length) await admin.from('products').update({ rating: Math.round((ratings.reduce((sum: number, review: any) => sum + Number(review.rating), 0) / ratings.length) * 10) / 10, review_count: ratings.length }).eq('id', productId);
    return json({ submitted: true }, 201, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'product_review_failed', action, productId, error: error instanceof Error ? error.message : String(error) }));
    return json({ error: 'The review service could not complete this request', code: 'REVIEW_SERVICE_ERROR', requestId }, 500, origin);
  }
});
