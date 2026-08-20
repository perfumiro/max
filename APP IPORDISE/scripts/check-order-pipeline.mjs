import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('Missing server-side Supabase diagnostic configuration');

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const productSchema = await admin.from('products').select('*').eq('active', true).limit(1);
console.log(JSON.stringify({
  productColumns: Object.keys(productSchema.data?.[0] || {}),
  hasProduct: Boolean(productSchema.data?.length),
  productSchemaError: productSchema.error?.message || null,
}, null, 2));
const variantSchema = await admin.from('product_variants').select('*').limit(1);
console.log(JSON.stringify({
  variantColumns: Object.keys(variantSchema.data?.[0] || {}),
  variantSchemaError: variantSchema.error?.message || null,
}, null, 2));
const { data, error, count } = await admin
  .from('orders')
  .select('id,order_number,status,notification_status,created_at', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(10);

if (error) throw error;
console.log(JSON.stringify({
  totalOrders: count || 0,
  latest: (data || []).map(order => ({
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    notificationStatus: order.notification_status,
    createdAt: order.created_at,
  })),
}, null, 2));

const adminEmail = process.env.IPORDISE_ADMIN_EMAIL;
const adminPassword = process.env.IPORDISE_ADMIN_PASSWORD;
const firebaseApiKey = 'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4';
if (adminEmail && adminPassword) {
  const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true }),
  });
  const authBody = await authResponse.json();
  if (!authResponse.ok || !authBody.idToken) throw new Error(`Admin authentication failed: HTTP ${authResponse.status}`);
  const adminResponse = await fetch(`${url}/functions/v1/admin-orders?page=1&pageSize=10`, {
    headers: {
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${authBody.idToken}`,
    },
  });
  const adminBody = await adminResponse.json().catch(() => null);
  console.log(JSON.stringify({
    adminOrdersStatus: adminResponse.status,
    adminOrderCount: Array.isArray(adminBody?.orders) ? adminBody.orders.length : null,
    adminError: adminResponse.ok ? null : adminBody?.error || 'Unknown administration error',
    requestId: adminBody?.requestId || null,
  }, null, 2));
}

const resendKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || '';
if (resendKey) {
  const domainsResponse = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  const domainsBody = await domainsResponse.json().catch(() => null);
  console.log(JSON.stringify({
    resendDomainsStatus: domainsResponse.status,
    configuredSenderDomain: resendFrom.includes('@') ? resendFrom.split('@').pop() : null,
    domains: Array.isArray(domainsBody?.data)
      ? domainsBody.data.map(domain => ({ name: domain.name, status: domain.status }))
      : [],
  }, null, 2));
}

if (process.env.RUN_EMAIL_TEST === '1' && adminEmail) {
  const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: 'service_8aoubkb',
      template_id: 'template_ab23cpc',
      user_id: 'kNyQsCbHg-0jS4Xks',
      template_params: {
        to_email: adminEmail,
        reply_to: adminEmail,
        subject: 'IPORDISE order email pipeline test',
        order_id: 'PIPELINE-TEST',
        order_number: 'PIPELINE-TEST',
        customer_name: 'IPORDISE Release Test',
        customer_phone: '+212600000000',
        customer_email: adminEmail,
        delivery_address: 'Tangier, Morocco',
        customer_address: 'Tangier, Morocco',
        order_total: '0 MAD',
        order_notes: 'Automated diagnostic — no order was created.',
        customer_notes: 'Automated diagnostic — no order was created.',
        order_subtotal: '0 MAD',
        order_shipping: '0 MAD',
        order_discount: '0 MAD',
        order_date: new Date().toISOString(),
        order_channel: 'diagnostic',
        order_items: 'No products — email pipeline test only',
        message_html: '<p>IPORDISE email pipeline diagnostic. No order was created.</p>',
      },
    }),
  });
  console.log(JSON.stringify({
    emailJsTestStatus: emailResponse.status,
    emailJsTestResponse: (await emailResponse.text()).slice(0, 300),
  }, null, 2));
}

if (process.env.RUN_ORDER_TEST === '1' && adminEmail) {
  const { data: candidates, error: candidateError } = await admin
    .from('products')
    .select('id,name,sizes,stock_left,active')
    .eq('active', true)
    .limit(50);
  if (candidateError) throw candidateError;
  const product = (candidates || []).find(candidate =>
    candidate.sizes && typeof candidate.sizes === 'object'
      && Object.values(candidate.sizes).some(value => Number(value) > 0)
      && (candidate.stock_left == null || Number(candidate.stock_left) > 0));
  if (!product) throw new Error('No purchasable product is available for the pipeline test');
  const [size, price] = Object.entries(product.sizes).find(([, value]) => Number(value) > 0);
  const sizeKey = String(size).toLowerCase().replace(/\s+/g, '');
  const response = await fetch(`${url}/functions/v1/create-order`, {
    method: 'POST',
    headers: {
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotencyKey: `codex-pipeline-${crypto.randomUUID()}`,
      customer: {
        name: 'IPORDISE Pipeline Test',
        phone: '+212600000000',
        email: adminEmail,
        city: 'Tangier',
        address: 'IPORDISE boutique — test order, do not fulfil',
      },
      items: [{
        variantId: `${product.id}:${sizeKey}`,
        quantity: 1,
        expectedUnitPriceMinor: Math.round(Number(price) * 100),
      }],
      notes: 'CODEX PIPELINE TEST — CANCEL — DO NOT FULFIL',
      source: 'website',
    }),
  });
  const responseBody = await response.json().catch(() => null);
  console.log(JSON.stringify({
    createOrderStatus: response.status,
    createdOrderId: responseBody?.id || null,
    createdOrderNumber: responseBody?.orderNumber || null,
    createOrderError: response.ok ? null : responseBody?.error || 'Unknown checkout error',
    requestId: responseBody?.requestId || null,
  }, null, 2));
}
