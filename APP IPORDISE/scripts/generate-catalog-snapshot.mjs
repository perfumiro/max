import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Canonical Supabase catalogue configuration is missing');

const productSelect = 'id,name,brand,image,gallery,filters,badge,description,notes,rating,review_count,active,sort_order,sizes,base_sizes,original_prices,stock_left,offer_start,offer_end,offer_featured,offer_badge,offer_display_order';
const variantSelect = 'id,product_id,size_label,size_key,format,sku,price_minor,compare_at_price_minor,stock_quantity,enabled,sort_order';

const fetchRows = async (path, label) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { Accept: 'application/json', apikey: supabaseKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error(`${label} returned no rows`);
  return rows;
};

const [products, variants] = await Promise.all([
  fetchRows(`products?select=${encodeURIComponent(productSelect)}&active=eq.true&order=sort_order.asc,updated_at.desc`, 'Canonical products'),
  fetchRows(`product_variants?select=${encodeURIComponent(variantSelect)}&enabled=eq.true&order=sort_order.asc`, 'Canonical variants'),
]);

const productIds = new Set(products.map(product => String(product.id)));
if (variants.some(variant => !productIds.has(String(variant.product_id)))) {
  throw new Error('Canonical snapshot contains orphaned variants');
}

const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/generated/catalogSnapshot.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), products, variants }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, products: products.length, variants: variants.length }));
