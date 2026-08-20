import type { ImageSourcePropType } from 'react-native';
import { appConfig } from './config';
import { logger } from './observability/logger';
import { mergeProductGallery } from './productGallery';
import { normalizeProductNotes, type ProductNotes } from './productNotes';

const { storeOrigin: STORE_ORIGIN, firestoreRoot: FIRESTORE_ROOT, firebaseApiKey: FIREBASE_API_KEY } = appConfig;
let cachedProducts: Product[] | null = null;
let cacheExpiresAt = 0;
let pendingCatalogRequest: Promise<Product[]> | null = null;

export type Product = {
  id: string;
  brand: string;
  name: string;
  price: string;
  oldPrice: string;
  badge: string;
  rating: string;
  reviewCount: number;
  image: ImageSourcePropType;
  gallery: ImageSourcePropType[];
  sizes: Record<string, number>;
  originalSizes?: Record<string, number>;
  filters: string[];
  active: boolean;
  stockLeft?: number;
  description?: string;
  notes?: ProductNotes;
  offerStart?: string;
  offerEnd?: string;
  offerFeatured?: boolean;
  offerBadge?: string;
  sortOrder?: number;
  variants?: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  size: string;
  sizeKey: string;
  format: 'decant' | 'full_bottle' | 'other';
  price: number;
  compareAtPrice?: number;
  stock: number | null;
  sku?: string;
  enabled: boolean;
};

type JsonMap = Record<string, any>;

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const fetchJson = async (url: string, label: string, headers: Record<string, string> = {}): Promise<JsonMap> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= appConfig.requestRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), appConfig.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', ...headers },
      });
      if (!response.ok) {
        const error = new Error(`${label} returned HTTP ${response.status}`) as Error & { retryAfterMs?: number; retryable?: boolean };
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('Retry-After'));
          error.retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2_000 * (attempt + 1);
        }
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      const requestError = error as Error & { retryAfterMs?: number; retryable?: boolean };
      if (requestError.retryable === false) break;
      if (attempt < appConfig.requestRetries) {
        const retryAfterMs = requestError.retryAfterMs;
        await wait(retryAfterMs || 750 * (2 ** attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${label} is unavailable`, { cause: lastError });
};

const decodeFirestoreValue = (value: JsonMap): any => {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {});
  return undefined;
};

const decodeFirestoreFields = (fields: JsonMap) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value as JsonMap)])
);

const listCollection = async (collection: string) => {
  const documents: JsonMap[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '300', key: FIREBASE_API_KEY });
    if (pageToken) query.set('pageToken', pageToken);
    const payload = await fetchJson(`${FIRESTORE_ROOT}/${collection}?${query}`, `Dashboard ${collection}`);
    documents.push(...(Array.isArray(payload.documents) ? payload.documents : []));
    pageToken = typeof payload.nextPageToken === 'string' ? payload.nextPageToken : '';
  } while (pageToken);
  return documents.map((document: JsonMap) => ({
      id: String(document.name || '').split('/').pop(),
      ...decodeFirestoreFields(document.fields || {}),
    }))
    .filter((document: JsonMap) => document.id);
};

const loadRuntimeCatalog = async (): Promise<{ overrides: JsonMap[]; products: JsonMap[] }> => {
  try {
    const [overrides, products] = await Promise.all([
      listCollection('productOverrides'),
      listCollection('products'),
    ]);
    return { overrides, products: products.filter(product => !['__mobile_catalog__','_app_config','_bestsellers'].includes(String(product.id||''))) };
  } catch (error) {
    // The public website catalogue must remain available when the optional
    // dashboard override service is offline or being migrated.
    logger.warn('dashboard_catalog_unavailable_using_website_catalog', { error });
    return { overrides: [], products: [] };
  }
};

const absoluteUrl = (value: string) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${STORE_ORIGIN}/${value.replace(/^\/+/, '')}`;
};

const normalizeSizes = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([size, price]) => [size.toLowerCase().replace(/\s+/g, ''), Number(price)])
      .filter(([, price]) => Number(price) > 0)
  );
};

const optionalFiniteNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const displaySize = (size: string) => size.replace(/\s+/g, '').replace(/(\d+(?:\.\d+)?)ml/i, '$1 ml');
const formatMad = (price: number) => `${Math.round(price).toLocaleString('en-US')} MAD`;

const preferredSize = (sizes: Record<string, number>, brand = '') => {
  const entries = Object.entries(sizes).filter(([, price]) => price > 0);
  if (!entries.length) return undefined;
  const nicheDecantHouse = /XERJOFF|UNIQUE/i.test(brand);
  if (nicheDecantHouse) {
    return entries.sort(([a], [b]) => (parseFloat(a) || Number.MAX_SAFE_INTEGER) - (parseFloat(b) || Number.MAX_SAFE_INTEGER))[0];
  }
  return entries.find(([size]) => size.replace(/\s+/g, '').toLowerCase() === '100ml')
    || entries.sort(([a], [b]) => (parseFloat(b) || 0) - (parseFloat(a) || 0))[0];
};

const legacyVariants = (productId: string, sizes: Record<string, number>, originals: Record<string, number> = {}, stock: number | undefined): ProductVariant[] => Object.entries(sizes).map(([sizeKey, price]) => ({
  id: `${productId}:${sizeKey}`,
  size: displaySize(sizeKey),
  sizeKey,
  format: (parseFloat(sizeKey) || 0) < 50 ? 'decant' : 'full_bottle',
  price,
  compareAtPrice: originals[sizeKey] > price ? originals[sizeKey] : undefined,
  stock: stock ?? null,
  enabled: price > 0 && stock !== 0,
}));

const productFromCatalog = (raw: JsonMap, override?: JsonMap): Product | null => {
  if (override?.disabled || raw.active === false) return null;
  const removed = new Set((override?.removedSizes || []).map((size: string) => size.toLowerCase().replace(/\s+/g, '')));
  const baseSizes = normalizeSizes(raw.sizes);
  const overrideSizes = normalizeSizes(override?.prices);
  const fullSizes = { ...baseSizes, ...overrideSizes };
  Object.keys(fullSizes).forEach((size) => { if (removed.has(size)) delete fullSizes[size]; });

  const promoSizes = normalizeSizes(override?.promoPrices);
  const effectiveSizes = { ...fullSizes };
  const originalSizes: Record<string, number> = {};
  Object.entries(promoSizes).forEach(([size, salePrice]) => {
    if (fullSizes[size] > 0 && salePrice < fullSizes[size]) {
      originalSizes[size] = fullSizes[size];
      effectiveSizes[size] = salePrice;
    }
  });

  const selected = preferredSize(effectiveSizes, String(raw.brand || ''));
  const selectedOriginal = selected ? originalSizes[selected[0]] : 0;
  const images = mergeProductGallery(String(raw.id || raw.slug || ''), raw.image, raw.gallery).map(absoluteUrl).filter(Boolean);
  if (!images.length) return null;
  const id = raw.id || raw.slug;
  return {
    id,
    brand: String(raw.brand || 'IPORDISE').toUpperCase(),
    name: raw.name || raw.slug,
    price: selected ? formatMad(selected[1]) : 'Coming soon',
    oldPrice: selectedOriginal ? formatMad(selectedOriginal) : '',
    badge: Object.keys(originalSizes).length ? 'OFFER' : (raw.badge || 'NEW'),
    rating: Number(raw.rating || 4.8).toFixed(1),
    reviewCount: Number(raw.reviewCount || 0),
    image: { uri: images[0], cache: 'force-cache' },
    gallery: images.map((uri: string) => ({ uri, cache: 'force-cache' })),
    sizes: effectiveSizes,
    originalSizes,
    filters: Array.isArray(raw.filters) ? raw.filters : [],
    active: true,
    description: raw.description || undefined,
    notes: normalizeProductNotes(String(id || ''), raw.notes),
    stockLeft: optionalFiniteNumber(override?.stockLeft ?? raw.stockLeft),
    offerStart: typeof (override?.offerStart ?? raw.offerStart) === 'string' ? String(override?.offerStart ?? raw.offerStart) : undefined,
    offerEnd: typeof (override?.offerEnd ?? raw.offerEnd) === 'string' ? String(override?.offerEnd ?? raw.offerEnd) : undefined,
    offerFeatured: (override?.offerFeatured ?? raw.offerFeatured) === true,
    offerBadge: typeof (override?.offerBadge ?? raw.offerBadge) === 'string' ? String(override?.offerBadge ?? raw.offerBadge) : undefined,
    sortOrder: Number.isFinite(Number(override?.offerDisplayOrder ?? raw.offerDisplayOrder)) ? Number(override?.offerDisplayOrder ?? raw.offerDisplayOrder) : undefined,
    variants: legacyVariants(id, effectiveSizes, originalSizes, optionalFiniteNumber(override?.stockLeft ?? raw.stockLeft)),
  };
};

const productFromFirestore = (raw: JsonMap): Product | null => {
  if (raw.active === false) return null;
  const stockLeft = optionalFiniteNumber(raw.stockLeft ?? raw.stock_left);
  const sizes = stockLeft === 0 ? {} : normalizeSizes(raw.sizes);
  const originalSizes = normalizeSizes(raw.originalPrices ?? raw.original_prices);
  const selected = preferredSize(sizes, String(raw.brand || ''));
  const id = raw.slug || raw.id;
  const images = mergeProductGallery(String(id || ''), raw.image, raw.images ?? raw.gallery).map(absoluteUrl).filter(Boolean);
  if (!raw.name || !images.length) return null;
  return {
    id,
    brand: String(raw.brand || 'IPORDISE').toUpperCase(),
    name: raw.name,
    price: selected ? formatMad(selected[1]) : 'Coming soon',
    oldPrice: selected && originalSizes[selected[0]] > selected[1] ? formatMad(originalSizes[selected[0]]) : '',
    badge: raw.badge || 'NEW',
    rating: Number(raw.rating || 4.8).toFixed(1),
    reviewCount: Number(raw.reviewCount || 0),
    image: { uri: images[0], cache: 'force-cache' },
    gallery: images.map((uri: string) => ({ uri, cache: 'force-cache' })),
    sizes,
    originalSizes,
    filters: Array.isArray(raw.filters) ? raw.filters : ['new-in'],
    active: true,
    stockLeft,
    description: raw.description || undefined,
    notes: normalizeProductNotes(String(id || ''), raw.notes),
    offerStart: typeof raw.offerStart === 'string' ? raw.offerStart : undefined,
    offerEnd: typeof raw.offerEnd === 'string' ? raw.offerEnd : undefined,
    offerFeatured: raw.offerFeatured === true,
    offerBadge: typeof raw.offerBadge === 'string' ? raw.offerBadge : undefined,
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : undefined,
    variants: legacyVariants(id, sizes, originalSizes, stockLeft),
  };
};

const loadSupabaseProducts = async (): Promise<Product[]> => {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new Error('Supabase catalogue is not configured');
  // Production stores live variants directly in products.sizes. Query that
  // canonical schema once instead of first calling an unavailable relation and
  // then waiting for rate-limited Firestore retries during every cold launch.
  const select = 'id,name,brand,image,gallery,filters,badge,description,notes,rating,review_count,active,sort_order,sizes,original_prices,stock_left';
  const rows = await fetchJson(`${appConfig.supabaseUrl}/rest/v1/products?select=${encodeURIComponent(select)}&active=eq.true&order=sort_order.asc,updated_at.desc`, 'IPORDISE commerce catalogue', { apikey: appConfig.supabasePublishableKey });
  if (!Array.isArray(rows)) throw new Error('IPORDISE commerce catalogue returned invalid data');
  const products = rows.map(productFromFirestore).filter(Boolean) as Product[];
  if (!products.length) throw new Error('IPORDISE commerce catalogue contains no published products');
  return products;
};

// Retained only for one-time migration tooling; never used by the app runtime.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loadWebsiteAndDashboardProducts = async (): Promise<Product[]> => {
  const [catalog, runtimeCatalog] = await Promise.all([
    fetchJson(`${STORE_ORIGIN}/catalog.json?source=app&ts=${Date.now()}`, 'IPORDISE catalog'),
    loadRuntimeCatalog(),
  ]);
  if (!Array.isArray(catalog.products)) throw new Error('IPORDISE catalog returned invalid product data');

  const { overrides: overridesList, products: productsList } = runtimeCatalog;
  const overrides = Object.fromEntries(overridesList.map((item: JsonMap) => [item.id, item]));
  const baseProducts = (catalog.products || [])
    .map((item: JsonMap) => productFromCatalog(item, overrides[item.id]))
    .filter(Boolean) as Product[];
  const adminProducts = productsList.map(productFromFirestore).filter(Boolean) as Product[];

  const merged = new Map(baseProducts.map((product) => [product.id, product]));
  adminProducts.forEach((product) => merged.set(product.id, product));
  const products = [...merged.values()];
  if (!products.length) throw new Error('IPORDISE catalog did not contain any available products');
  return products;
};

// Retained only for one-time migration tooling; never used by the app runtime.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loadFirebaseAdminProducts = async (): Promise<Product[]> => {
  const { products } = await loadRuntimeCatalog();
  const managedProducts = products.map(productFromFirestore).filter(Boolean) as Product[];
  if (!managedProducts.length) throw new Error('The IPORDISE admin catalogue does not contain active products');
  return managedProducts;
};

const fetchSharedProducts = async (): Promise<Product[]> => {
  // Fail closed when the canonical commerce API is unavailable. Serving a
  // second catalogue can expose archived products or prices that checkout will
  // reject, so availability must never be manufactured from a legacy source.
  return loadSupabaseProducts();
};

export const loadSharedProducts = async (forceRefresh = false): Promise<Product[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedProducts && now < cacheExpiresAt) return cachedProducts;
  if (pendingCatalogRequest) return pendingCatalogRequest;

  pendingCatalogRequest = fetchSharedProducts()
    .then(products => {
      cachedProducts = products;
      cacheExpiresAt = Date.now() + appConfig.catalogCacheTtlMs;
      return products;
    })
    .finally(() => { pendingCatalogRequest = null; });
  return pendingCatalogRequest;
};

export { displaySize, formatMad };
