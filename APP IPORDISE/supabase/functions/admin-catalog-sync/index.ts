import { createClient } from 'npm:@supabase/supabase-js@2';
import { apiHeaders, apiJson, consumeRateLimit, readJsonObject, rejectNonJson, rejectUntrustedOrigin, requestOrigin, verifyFirebaseStaff } from '../_shared/security.ts';
import { sendNewProductNotification } from '../_shared/pushNotifications.ts';

const MAX_BODY_BYTES = 256 * 1024;
const METHODS = 'GET, POST, OPTIONS';
const json = (body: unknown, status: number, origin: string | null) => apiJson(body, status, origin, METHODS);
const fallbackRateLimits = new Map<string, { startedAt: number; hits: number }>();

const consumeFallbackRateLimit = (key: string, maximumHits: number, windowSeconds: number) => {
  const now = Date.now();
  const current = fallbackRateLimits.get(key);
  if (!current || now - current.startedAt >= windowSeconds * 1000) {
    fallbackRateLimits.set(key, { startedAt: now, hits: 1 });
    return true;
  }
  current.hits += 1;
  return current.hits <= maximumHits;
};
const isMissingProductVariants = (error: any) => (
  ['PGRST200', 'PGRST205', '42P01'].includes(String(error?.code || ''))
  || String(error?.message || '').includes('product_variants')
);
const isMissingColumn = (error: any, column: string) => (
  ['PGRST204', '42703'].includes(String(error?.code || ''))
  || String(error?.message || '').toLowerCase().includes(column.toLowerCase())
);

const updateProductCompat = async (admin: any, id: string, patch: Record<string, unknown>) => {
  let result = await admin.from('products').update(patch).eq('id', id);
  if (result.error && 'publication_status' in patch && isMissingColumn(result.error, 'publication_status')) {
    const legacyPatch = { ...patch };
    delete legacyPatch.publication_status;
    result = await admin.from('products').update(legacyPatch).eq('id', id);
  }
  return result;
};

const upsertProductCompat = async (admin: any, row: Record<string, unknown>) => {
  let candidate = { ...row };
  const optionalColumns = ['publication_status', 'base_sizes'];
  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const result = await admin.from('products').upsert(candidate, { onConflict: 'id' });
    if (!result.error) return result;
    const missingColumn = optionalColumns.find(column => column in candidate && isMissingColumn(result.error, column));
    if (!missingColumn) return result;
    delete candidate[missingColumn];
  }
  return admin.from('products').upsert(candidate, { onConflict: 'id' });
};

const readProductPublication = async (admin: any, id: string) => {
  let result = await admin.from('products').select('id,name,active,publication_status').eq('id', id).maybeSingle();
  if (result.error && isMissingColumn(result.error, 'publication_status')) result = await admin.from('products').select('id,name,active').eq('id', id).maybeSingle();
  return result;
};

const normalizeSizes = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([size, price]) => [size.toLowerCase().replace(/\s+/g, ''), Number(price)])
    .filter(([size, price]) => /^[0-9]{1,4}(?:ml|g)$/i.test(size) && Number.isFinite(price) && price >= 0 && price <= 1_000_000));
};
const cleanText = (value: unknown, maximum: number) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum);
const safeImage = (value: unknown) => { const image = cleanText(value, 1000); return image.startsWith('https://') || image.startsWith('/') ? image : null; };
const positiveInteger = (value: string | null, fallback: number, maximum: number) => {
  if (value === null) return fallback;
  return /^\d+$/.test(value) ? Math.max(1, Math.min(maximum, Number(value))) : null;
};

Deno.serve(async request => {
  const origin = requestOrigin(request);
  const requestId = crypto.randomUUID();
  const originError = rejectUntrustedOrigin(origin, requestId, METHODS);
  if (originError) return originError;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders(origin, METHODS) });
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed', requestId }, 405, origin);
  if (request.method === 'POST') {
    const mediaError = rejectNonJson(request, origin, requestId, METHODS);
    if (mediaError) return mediaError;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration missing', requestId }, 500, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const staff = await verifyFirebaseStaff(request.headers.get('Authorization'));
  if (!staff) return json({ error: 'Unauthorized', requestId }, 401, origin);

  try {
    let withinRateLimit = false;
    try {
      withinRateLimit = await consumeRateLimit(admin, request, `admin-catalog:${staff.uid}`, 240, 900);
    } catch (rateLimitError: any) {
      const code = String(rateLimitError?.code || '');
      const message = String(rateLimitError?.message || '');
      if (!['PGRST202', '42883'].includes(code) && !message.includes('consume_api_rate_limit')) throw rateLimitError;
      console.warn(JSON.stringify({ requestId, event: 'catalog_rate_limit_rpc_unavailable', code }));
      withinRateLimit = consumeFallbackRateLimit(`admin-catalog:${staff.uid}`, 240, 900);
    }
    if (!withinRateLimit) return json({ error: 'Too many administration requests', requestId }, 429, origin);
    if (request.method === 'GET') {
      const search = new URL(request.url).searchParams;
      const source = search.get('source');
      const page = positiveInteger(search.get('page'), 1, 10_000);
      const pageSize = positiveInteger(search.get('pageSize'), 50, 100);
      if (page === null || pageSize === null) return json({ error: 'Invalid pagination', code: 'INVALID_QUERY', requestId }, 400, origin);
      const term = cleanText(search.get('q'), 80).replace(/[%_,()]/g, '');
      const publicationStatus = search.get('status');
      const buildProductsQuery = (selection: string) => {
        let query = admin.from('products').select(selection, { count: 'exact' }).order('updated_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
        if (source && ['website', 'admin'].includes(source)) query = query.eq('source', source);
        if (term) query = query.or(`name.ilike.%${term}%,brand.ilike.%${term}%,id.ilike.%${term}%`);
        if (publicationStatus && ['draft', 'active', 'archived'].includes(publicationStatus)) query = query.eq('publication_status', publicationStatus);
        return query;
      };

      let result = await buildProductsQuery('*,product_variants(*)');
      if (result.error && isMissingProductVariants(result.error)) {
        console.warn(JSON.stringify({ requestId, event: 'catalog_variants_unavailable', code: result.error.code }));
        result = await buildProductsQuery('*');
      }
      if (result.error) throw result.error;
      return json({ ok: true, products: result.data || [], pagination: { page, pageSize, total: result.count || 0 } }, 200, origin);
    }

    const parsed = await readJsonObject(request, MAX_BODY_BYTES);
    if (parsed.error === 'too_large') return json({ error: 'Request body too large', requestId }, 413, origin);
    if (parsed.error) return json({ error: 'Invalid JSON payload', requestId }, 400, origin);
    const payload = parsed.value!;
    const { section, id, value } = payload as { section?: unknown; id?: unknown; value?: any };
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,127}$/i.test(id) || !['products', 'overrides'].includes(section)) return json({ error: 'Invalid sync payload', requestId }, 400, origin);
    if (value !== null && (!value || typeof value !== 'object' || Array.isArray(value))) return json({ error: 'Invalid product payload', requestId }, 400, origin);
    let wasPublished = false;
    if (section === 'products') {
      const previous = await readProductPublication(admin, id);
      if (previous.error) throw previous.error;
      wasPublished = Boolean(previous.data?.active && (!previous.data.publication_status || previous.data.publication_status === 'active'));
    }
    const variantsProbe = await admin.from('product_variants').select('id').limit(1);
    const variantsAvailable = !variantsProbe.error;
    if (variantsProbe.error && !isMissingProductVariants(variantsProbe.error)) throw variantsProbe.error;
    if (!variantsAvailable) console.warn(JSON.stringify({ requestId, event: 'catalog_legacy_price_storage' }));

    if (section === 'products') {
      if (value === null) {
        if (variantsAvailable) {
          const { error: variantsError } = await admin.from('product_variants').delete().eq('product_id', id);
          if (variantsError) throw variantsError;
        }
        const { error } = await admin.from('products').delete().eq('id', id);
        if (error) throw error;
      } else if (!value.name) {
        const patch: Record<string, unknown> = {};
        if (typeof value.active === 'boolean') { patch.active = value.active; patch.publication_status = value.active ? 'active' : 'archived'; }
        if (value.stockLeft === null) patch.stock_left = null;
        else if (Number.isInteger(value.stockLeft) && value.stockLeft >= 0 && value.stockLeft <= 100_000) patch.stock_left = value.stockLeft;
        else if (value.stockLeft !== undefined) return json({ error: 'Invalid stock quantity', requestId }, 400, origin);
        if (!Object.keys(patch).length) return json({ error: 'Empty product update', requestId }, 400, origin);
        const { error } = await updateProductCompat(admin, id, patch);
        if (error) throw error;
        if (variantsAvailable && value.stockLeft !== undefined) {
          const { error: variantsStockError } = await admin.from('product_variants').update({ stock_quantity: value.stockLeft }).eq('product_id', id);
          if (variantsStockError) throw variantsStockError;
        }
        if (variantsAvailable && typeof value.active === 'boolean') {
          const { error: variantsError } = await admin.from('product_variants').update({ enabled: value.active }).eq('product_id', id);
          if (variantsError) throw variantsError;
        }
      } else {
        if (value.createOnly === true) {
          const { data: existing, error: existingError } = await admin.from('products').select('id').eq('id', id).maybeSingle();
          if (existingError) throw existingError;
          if (existing) return json({ error: 'A product with this identifier already exists', code: 'PRODUCT_EXISTS', requestId }, 409, origin);
        }
        const sizes = normalizeSizes(value.sizes);
        const name = cleanText(value.name, 160);
        const brand = cleanText(value.brand || 'IPORDISE', 100).toUpperCase();
        const images = (Array.isArray(value.images) && value.images.length ? value.images : [value.image]).slice(0, 12).map(safeImage).filter(Boolean);
        const stockLeft = value.stockLeft === null ? null : Math.floor(Number(value.stockLeft));
        const rating = Number(value.rating ?? 4.8);
        const reviewCount = Number(value.reviewCount ?? 0);
        const variantStocks = value.variantStocks && typeof value.variantStocks === 'object' && !Array.isArray(value.variantStocks) ? value.variantStocks : {};
        const invalidVariantStock = Object.keys(sizes).some(size => variantStocks[size] !== undefined && variantStocks[size] !== null && (!Number.isInteger(variantStocks[size]) || variantStocks[size] < 0 || variantStocks[size] > 100_000));
        if (name.length < 2 || !brand || !Object.keys(sizes).length || !images.length || (stockLeft !== null && (!Number.isFinite(stockLeft) || stockLeft < 0 || stockLeft > 100_000)) || !Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(reviewCount) || reviewCount < 0 || reviewCount > 100_000_000 || invalidVariantStock) return json({ error: 'Invalid product details', requestId }, 400, origin);
        const publicationStatus = ['draft', 'active', 'archived'].includes(String(value.publicationStatus)) ? String(value.publicationStatus) : value.active === false ? 'archived' : 'active';
        const published = publicationStatus === 'active' && value.active !== false;
        const row = {
          id, name, brand, image: safeImage(value.image) || images[0],
          gallery: images, sizes, base_sizes: sizes, original_prices: normalizeSizes(value.originalPrices),
          filters: Array.isArray(value.filters) ? value.filters.slice(0, 30).map((entry: unknown) => cleanText(entry, 60)).filter(Boolean) : ['new-in'], badge: cleanText(value.badge, 40) || null,
          description: cleanText(value.description, 4000) || null, accords: Array.isArray(value.accords) ? value.accords.slice(0, 30).map((entry: unknown) => cleanText(entry, 80)).filter(Boolean) : [],
          notes: value.notes && typeof value.notes === 'object' && !Array.isArray(value.notes) ? value.notes : {}, ingredients: cleanText(value.ingredients, 4000) || null,
          rating, review_count: reviewCount,
          // Keep the product customer-invisible until every variant write has
          // succeeded. A failed multi-row sync therefore fails closed instead
          // of exposing mixed old/new prices or inventory.
          stock_left: stockLeft, active: false, publication_status: 'draft',
          source: 'admin',
        };
        const { error } = await upsertProductCompat(admin, row);
        if (error) throw error;
        const activeVariantIds: string[] = [];
        if (variantsAvailable) for (const [size, price] of Object.entries(sizes)) {
          const variantId = `${id}:${size}`;
          activeVariantIds.push(variantId);
          const millilitres = Number.parseFloat(size);
          const compareAt = normalizeSizes(value.originalPrices)[size];
          const variantStock = variantStocks[size] === null ? null : Number.isInteger(Number(variantStocks[size])) ? Number(variantStocks[size]) : stockLeft;
          const { error: variantError } = await admin.from('product_variants').upsert({
            id: variantId, product_id: id, size_label: size.replace(/(\d)(ml)$/i, '$1 ml'), size_key: size,
            format: Number.isFinite(millilitres) && millilitres < 50 ? 'decant' : 'full_bottle',
            sku: typeof value.skus?.[size] === 'string' ? cleanText(value.skus[size], 80) || null : null,
            price_minor: Math.round(Number(price) * 100),
            compare_at_price_minor: compareAt > Number(price) ? Math.round(compareAt * 100) : null,
            stock_quantity: variantStock, enabled: published && Number(price) > 0,
            sort_order: Number.isFinite(millilitres) ? Math.round(millilitres) : 100,
          }, { onConflict: 'id' });
          if (variantError) throw variantError;
        }
        if (variantsAvailable && activeVariantIds.length) {
          const { data: existingVariants, error: variantsReadError } = await admin.from('product_variants').select('id').eq('product_id', id);
          if (variantsReadError) throw variantsReadError;
          const removedIds = (existingVariants || []).map((variant: any) => variant.id).filter((variantId: string) => !activeVariantIds.includes(variantId));
          if (removedIds.length) {
            const { error: disableError } = await admin.from('product_variants').update({ enabled: false }).in('id', removedIds);
            if (disableError) throw disableError;
          }
        }
        const { error: publishError } = await updateProductCompat(admin, id, { active: published, publication_status: publicationStatus });
        if (publishError) throw publishError;
      }
    } else {
      let productResult = await admin.from('products').select('base_sizes,sizes,badge').eq('id', id).single();
      if (productResult.error && isMissingColumn(productResult.error, 'base_sizes')) {
        productResult = await admin.from('products').select('sizes,badge').eq('id', id).single();
      }
      const { data: product, error: readError } = productResult;
      if (readError) throw readError;
      const baseSizes = normalizeSizes(product.base_sizes && Object.keys(product.base_sizes).length ? product.base_sizes : product.sizes);
      const fullSizes = value === null ? { ...baseSizes } : { ...baseSizes, ...normalizeSizes(value.prices) };
      if (value !== null) for (const removed of Array.isArray(value.removedSizes) ? value.removedSizes : []) delete fullSizes[String(removed).toLowerCase().replace(/\s+/g, '')];
      const effectiveSizes = { ...fullSizes };
      const originalPrices: Record<string, number> = {};
      if (value !== null) for (const [size, promoPrice] of Object.entries(normalizeSizes(value.promoPrices))) {
        if (fullSizes[size] > 0 && promoPrice > 0 && promoPrice < fullSizes[size]) {
          originalPrices[size] = fullSizes[size];
          effectiveSizes[size] = promoPrice;
        }
      }
      const published = value === null || value.disabled !== true;
      const { error: hideError } = await updateProductCompat(admin, id, { active: false, publication_status: 'draft' });
      if (hideError) throw hideError;
      const activeVariantIds: string[] = [];
      if (variantsAvailable) for (const [size, price] of Object.entries(effectiveSizes)) {
        const variantId = `${id}:${size}`;
        activeVariantIds.push(variantId);
        const millilitres = Number.parseFloat(size);
        const { error: variantError } = await admin.from('product_variants').upsert({
          id: variantId, product_id: id, size_label: size.replace(/(\d)(ml)$/i, '$1 ml'), size_key: size,
          format: Number.isFinite(millilitres) && millilitres < 50 ? 'decant' : 'full_bottle',
          price_minor: Math.round(Number(price) * 100),
          compare_at_price_minor: originalPrices[size] > Number(price) ? Math.round(originalPrices[size] * 100) : null,
          enabled: published && Number(price) > 0, sort_order: Number.isFinite(millilitres) ? Math.round(millilitres) : 100,
        }, { onConflict: 'id', defaultToNull: false });
        if (variantError) throw variantError;
      }
      if (variantsAvailable) {
        const { data: existingVariants, error: variantsReadError } = await admin.from('product_variants').select('id').eq('product_id', id);
        if (variantsReadError) throw variantsReadError;
        const removedIds = (existingVariants || []).map((variant: any) => variant.id).filter((variantId: string) => !activeVariantIds.includes(variantId));
        if (removedIds.length) {
          const { error: disableError } = await admin.from('product_variants').update({ enabled: false }).in('id', removedIds);
          if (disableError) throw disableError;
        }
      }
      const { error: publishError } = await updateProductCompat(admin, id, {
        sizes: effectiveSizes, original_prices: originalPrices, active: published, publication_status: published ? 'active' : 'archived',
        badge: Object.keys(originalPrices).length ? 'OFFER' : product.badge,
      });
      if (publishError) throw publishError;
    }
    const { error: auditError } = await admin.from('admin_audit_logs').insert({ admin_email: staff.email, action: 'catalog.sync', entity_type: section, entity_id: id, metadata: { requestId } });
    if (auditError) console.error(JSON.stringify({ requestId, event: 'admin_audit_write_failed', action: 'catalog.sync' }));
    let notification: Record<string, unknown> | null = null;
    if (section === 'products' && value !== null && !wasPublished) {
      const published = await readProductPublication(admin, id);
      if (published.error) console.error(JSON.stringify({ requestId, event: 'new_product_publication_check_failed', productId: id }));
      else if (published.data?.active && (!published.data.publication_status || published.data.publication_status === 'active')) {
        const pushTask = sendNewProductNotification(admin, { id, name: published.data.name }).catch(pushError => {
          console.error(JSON.stringify({ requestId, event: 'new_product_push_failed', productId: id, error: pushError instanceof Error ? pushError.message : String(pushError) }));
          return { status: 'failed' as const, attempted: 0, accepted: 0, failed: 0 };
        });
        const edgeRuntime = (globalThis as any).EdgeRuntime;
        if (edgeRuntime?.waitUntil) {
          edgeRuntime.waitUntil(pushTask);
          notification = { status: 'scheduled' };
        } else notification = await pushTask;
      }
    }
    return json({ ok: true, id, section, notification, syncedAt: new Date().toISOString(), requestId }, 200, origin);
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'catalog_sync_failed', error: error instanceof Error ? error.message : String(error) }));
    const detail = cleanText(error instanceof Error ? error.message : String(error), 220);
    return json({ error: detail ? `Catalog sync failed: ${detail}` : 'Catalog sync failed', requestId }, 500, origin);
  }
});
