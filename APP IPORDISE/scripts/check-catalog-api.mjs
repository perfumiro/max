const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) throw new Error('Canonical Supabase catalog configuration is missing');

const fetchJson = async (path, label) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', apikey: supabaseKey },
      });
      if (response.ok) return response.json();
      if (response.status !== 429 || attempt === 3) throw new Error(`${label}: HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get('Retry-After'));
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2_000 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${label} is unavailable`);
};

const [products, variants] = await Promise.all([
  fetchJson('products?active=eq.true&select=id,name,active,publication_status', 'Canonical products'),
  fetchJson('product_variants?enabled=eq.true&select=id,product_id,size_key,price_minor,stock_quantity,enabled', 'Canonical variants'),
]);

if (!Array.isArray(products) || !products.length) throw new Error('Canonical catalog has no active products');
if (!Array.isArray(variants) || !variants.length) throw new Error('Canonical catalog has no purchasable variants');

const productIds = new Set(products.map(product => String(product.id)));
const invalidVariants = variants.filter(variant => !variant.id || !productIds.has(String(variant.product_id)) || !variant.size_key || Number(variant.price_minor) <= 0);
if (invalidVariants.length) throw new Error(`Canonical catalog has ${invalidVariants.length} invalid or orphaned variants`);

const purchasableProductIds = new Set(variants.filter(variant => variant.stock_quantity == null || Number(variant.stock_quantity) > 0).map(variant => String(variant.product_id)));
if (!purchasableProductIds.size) throw new Error('Canonical catalog has no in-stock products');

console.log(JSON.stringify({
  ok: true,
  mode: 'supabase-canonical-commerce',
  checkedAt: new Date().toISOString(),
  activeProducts: products.length,
  enabledVariants: variants.length,
  inStockProducts: purchasableProductIds.size,
  checkoutFunction: 'create-order',
  adminOrdersFunction: 'admin-orders',
}, null, 2));
