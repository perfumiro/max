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

const [products, variants, settings] = await Promise.all([
  fetchJson('products?active=eq.true&select=id,name,image,gallery,active,publication_status,preorder_enabled,preorder_message,preorder_estimated_availability', 'Canonical products'),
  fetchJson('product_variants?enabled=eq.true&select=id,product_id,size_key,price_minor,stock_quantity,enabled', 'Canonical variants'),
  fetchJson('store_settings?id=eq.main&select=value', 'Canonical store settings'),
]);

if (!Array.isArray(products) || !products.length) throw new Error('Canonical catalog has no active products');
if (!Array.isArray(variants) || !variants.length) throw new Error('Canonical catalog has no purchasable variants');
if (!Array.isArray(settings) || !settings[0]?.value?.preorders || typeof settings[0].value.preorders.enabled !== 'boolean') throw new Error('Canonical preorder settings are missing');

const imageValues = products.flatMap(product => [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])]).filter(value => typeof value === 'string' && value.trim());
if (!imageValues.length) throw new Error('Canonical catalog has no product images');
const insecureImages = imageValues.filter(value => /^http:\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https:\/\//i.test(value));
if (insecureImages.length) throw new Error(`Canonical catalog has ${insecureImages.length} insecure product image URLs`);

const productIds = new Set(products.map(product => String(product.id)));
const invalidVariants = variants.filter(variant => !variant.id || !productIds.has(String(variant.product_id)) || !variant.size_key || Number(variant.price_minor) <= 0);
if (invalidVariants.length) throw new Error(`Canonical catalog has ${invalidVariants.length} invalid or orphaned variants`);

const purchasableProductIds = new Set(variants.filter(variant => variant.stock_quantity == null || Number(variant.stock_quantity) > 0).map(variant => String(variant.product_id)));
if (!purchasableProductIds.size) throw new Error('Canonical catalog has no in-stock products');

const functionNames = ['create-order', 'track-order', 'push-devices', 'create-preorder', 'admin-preorders'];
const functionChecks = await Promise.all(functionNames.map(async name => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'OPTIONS', signal: controller.signal,
      headers: { apikey: supabaseKey, Origin: 'https://ipordise.com', 'Access-Control-Request-Method': 'POST' },
    });
    return {
      name,
      status: response.status,
      ok: response.ok && response.headers.get('Access-Control-Allow-Origin') === 'https://ipordise.com',
    };
  } finally { clearTimeout(timeout); }
}));
const failedFunctions = functionChecks.filter(check => !check.ok);
if (failedFunctions.length) {
  const failures = failedFunctions.map(check => `${check.name} (HTTP ${check.status})`).join(', ');
  const verified = functionChecks.filter(check => check.ok).map(check => check.name).join(', ') || 'none';
  throw new Error(`Production function preflight failed: ${failures}. Verified: ${verified}`);
}

const unauthorizedAdminResponse = await fetch(`${supabaseUrl}/functions/v1/admin-preorders?page=1&pageSize=1`, {
  headers: { apikey: supabaseKey, Origin: 'https://ipordise.com', Accept: 'application/json' },
});
if (unauthorizedAdminResponse.status !== 401) throw new Error(`Admin preorder authorization check failed: expected HTTP 401, received ${unauthorizedAdminResponse.status}`);

const invalidPreorderResponse = await fetch(`${supabaseUrl}/functions/v1/create-preorder`, {
  method: 'POST',
  headers: { apikey: supabaseKey, Origin: 'https://ipordise.com', Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
if (invalidPreorderResponse.status !== 400) throw new Error(`Preorder validation check failed: expected HTTP 400, received ${invalidPreorderResponse.status}`);

const productionHtmlResponse = await fetch(`https://ipordise.com/app?preorderHealth=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
if (!productionHtmlResponse.ok) throw new Error(`Production website check failed: HTTP ${productionHtmlResponse.status}`);
const productionHtml = await productionHtmlResponse.text();
const bundlePath = productionHtml.match(/<script[^>]+src=["']([^"']*AppEntry-[^"']+\.js[^"']*)["']/i)?.[1];
if (!bundlePath) throw new Error('Production website does not reference the Expo application bundle');
const productionBundleResponse = await fetch(new URL(bundlePath, 'https://ipordise.com').toString(), { headers: { 'Cache-Control': 'no-cache' } });
if (!productionBundleResponse.ok) throw new Error(`Production application bundle check failed: HTTP ${productionBundleResponse.status}`);
const productionBundle = await productionBundleResponse.text();
if (!productionBundle.includes('create-preorder') || !productionBundle.includes('PREORDER REQUEST') || !productionBundle.includes('admin-preorders')) throw new Error('Production application bundle does not contain the shared preorder customer/admin integration');

console.log(JSON.stringify({
  ok: true,
  mode: 'supabase-canonical-commerce',
  checkedAt: new Date().toISOString(),
  activeProducts: products.length,
  enabledVariants: variants.length,
  inStockProducts: purchasableProductIds.size,
  productImages: imageValues.length,
  preorderEnabledProducts: products.filter(product => product.preorder_enabled === true).length,
  preordersGloballyEnabled: settings[0].value.preorders.enabled,
  preorderUnauthorizedStatus: unauthorizedAdminResponse.status,
  preorderInvalidPayloadStatus: invalidPreorderResponse.status,
  productionPreorderUi: true,
  verifiedFunctions: functionChecks.map(check => check.name),
  checkoutFunction: 'create-order',
  adminOrdersFunction: 'admin-orders',
}, null, 2));
