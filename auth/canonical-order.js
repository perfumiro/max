const SUPABASE_URL = 'https://gdgrskgegrcgmzswefmn.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_XbhrBW9Na65u8EkpgtEz4g_PuYkxs_H';
const IDEMPOTENCY_KEY = 'ipordise-checkout-idempotency-v1';
const normalizeSize = value => String(value || '').toLowerCase().replace(/\s+/g, '').trim();
const normalizeProductName = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const resolveProductId = (item, products) => {
  const cartProductId = String(item?.id || '').trim();
  const directMatch = products.find(product => String(product.id) === cartProductId);
  if (directMatch) return String(directMatch.id);

  const cartName = normalizeProductName(item?.name);
  if (!cartName) return null;
  const nameMatches = products.filter(product => {
    const productName = normalizeProductName(product.name);
    const brand = normalizeProductName(product.brand);
    if (productName === cartName) return true;
    if (!brand) return false;
    return normalizeProductName(`${brand} ${productName}`) === cartName
      || normalizeProductName(`${productName} ${brand}`) === cartName;
  });
  return nameMatches.length === 1 ? String(nameMatches[0].id) : null;
};

export async function saveGlobalOrder(orderData) {
  const items = Array.isArray(orderData?.items) ? orderData.items : [];
  const customer = orderData?.customer || {};
  if (!items.length) throw new Error('Your shopping bag is empty.');

  const requestOptions = { headers: { apikey: PUBLISHABLE_KEY, Accept: 'application/json' }, cache: 'no-store' };
  const [productResponse, variantResponse] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand&active=eq.true`, requestOptions),
    fetch(`${SUPABASE_URL}/rest/v1/product_variants?select=id,product_id,size_key,size_label,price_minor,stock_quantity,enabled&enabled=eq.true`, requestOptions),
  ]);
  if (!productResponse.ok || !variantResponse.ok) {
    const status = !productResponse.ok ? productResponse.status : variantResponse.status;
    throw new Error(`Product availability could not be verified (${status}).`);
  }
  const [products, variants] = await Promise.all([productResponse.json(), variantResponse.json()]);
  const requestedItems = items.map(item => {
    const productId = resolveProductId(item, products);
    const size = normalizeSize(item.size);
    const matches = variants.filter(variant => String(variant.product_id) === productId);
    const variant = matches.find(candidate => normalizeSize(candidate.size_key) === size)
      || matches.find(candidate => normalizeSize(candidate.size_label) === size)
      || (matches.length === 1 ? matches[0] : null);
    if (!variant) throw new Error(`${item.name || 'A product'} is no longer available in the selected size.`);
    return { variantId: variant.id, quantity: Math.max(1, Math.min(20, Math.floor(Number(item.qty) || 1))), expectedUnitPriceMinor: Math.round(Number(item.price || 0) * 100) };
  });

  const fingerprint = JSON.stringify({ customer: [customer.firstName, customer.lastName, customer.phone, customer.email, customer.address, customer.city], items: requestedItems, notes: customer.notes || '' });
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(IDEMPOTENCY_KEY) || 'null'); } catch {}
  const idempotencyKey = pending?.fingerprint === fingerprint && pending?.key
    ? pending.key
    : (globalThis.crypto?.randomUUID?.() || `website-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  localStorage.setItem(IDEMPOTENCY_KEY, JSON.stringify({ fingerprint, key: idempotencyKey }));

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
    method: 'POST', headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey,
      customer: { name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(), phone: String(customer.phone || '').trim(), email: String(customer.email || '').trim().toLowerCase() || null, city: String(customer.city || '').trim(), address: String(customer.address || '').trim() },
      items: requestedItems, notes: String(customer.notes || '').trim() || null, source: 'website',
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Order could not be saved (${response.status}).`);
  const orderNumber = String(result.orderNumber || result.order_number || '').trim();
  if (!orderNumber) throw new Error('The order server did not return an order number.');
  localStorage.removeItem(IDEMPOTENCY_KEY);
  return orderNumber;
}
