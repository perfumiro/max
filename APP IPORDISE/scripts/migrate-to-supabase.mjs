const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL is missing from .env');
if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is missing from .env (server-side migration only)');

const catalogResponse = await fetch(`https://ipordise.com/catalog.json?migration=${Date.now()}`);
if (!catalogResponse.ok) throw new Error(`Could not download IPORDISE catalog: HTTP ${catalogResponse.status}`);
const catalog = await catalogResponse.json();
if (!Array.isArray(catalog.products) || !catalog.products.length) throw new Error('IPORDISE catalog is empty');

const rows = catalog.products.map((product, sortOrder) => ({
  id: product.id || product.slug,
  name: product.name,
  brand: product.brand || 'IPORDISE',
  image: product.image,
  gallery: Array.isArray(product.gallery) ? product.gallery : [product.image],
  sizes: product.sizes || {},
  original_prices: product.originalPrices || {},
  filters: Array.isArray(product.filters) ? product.filters : [],
  badge: product.badge || null,
  description: product.description || null,
  accords: Array.isArray(product.accords) ? product.accords : [],
  notes: product.notes || {},
  ingredients: product.ingredients || null,
  rating: Number(product.rating || 4.8),
  review_count: Number(product.reviewCount || 0),
  stock_left: product.stockLeft ?? null,
  active: product.active !== false,
  sort_order: sortOrder,
}));

const response = await fetch(`${supabaseUrl}/rest/v1/products?on_conflict=id`, {
  method: 'POST',
  headers: {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});

if (!response.ok) throw new Error(`Supabase import failed: HTTP ${response.status} ${await response.text()}`);
console.log(`Imported ${rows.length} IPORDISE products into Supabase.`);
