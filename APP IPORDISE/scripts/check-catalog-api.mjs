const STORE_ORIGIN = 'https://ipordise.com';
const FIRESTORE_ROOT = 'https://firestore.googleapis.com/v1/projects/ipordise-aef54/databases/(default)/documents';
const FIREBASE_API_KEY = 'AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const fetchJson = async (url, label, extraHeaders = {}) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'Cache-Control': 'no-cache', ...extraHeaders } });
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

const decode = value => {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
};

const decodeFields = fields => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));

const catalog = await fetchJson(`${STORE_ORIGIN}/catalog.json?health=${Date.now()}`, 'Website catalog');
if (!Array.isArray(catalog.products) || catalog.products.length === 0) throw new Error('Website catalog has no products');

const anonymousOrders = await fetch(`${FIRESTORE_ROOT}/orders?pageSize=1&key=${encodeURIComponent(FIREBASE_API_KEY)}`, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
if (anonymousOrders.ok) throw new Error('SECURITY: Firebase orders are anonymously readable');
if (![401, 403].includes(anonymousOrders.status)) throw new Error(`Firebase order privacy check: HTTP ${anonymousOrders.status}`);

const productPayload = await fetchJson(`${FIRESTORE_ROOT}/products?pageSize=300&key=${encodeURIComponent(FIREBASE_API_KEY)}`, 'Firebase products');
const firebaseProducts = (productPayload.documents || []).map(document => ({ id: String(document.name || '').split('/').pop(), ...decodeFields(document.fields || {}) })).filter(product => !product.system && !['__mobile_catalog__','_app_config','_bestsellers'].includes(product.id));
if (!firebaseProducts.length) throw new Error('Firebase has no app products');

const bestsellerSummaryResponse=await fetch(`${FIRESTORE_ROOT}/products/_bestsellers?key=${encodeURIComponent(FIREBASE_API_KEY)}`,{headers:{Accept:'application/json','Cache-Control':'no-cache'}});
const bestsellerSummary=bestsellerSummaryResponse.ok?decodeFields((await bestsellerSummaryResponse.json()).fields||{}):null;
const rankedBestsellers=Array.isArray(bestsellerSummary?.ranking)?bestsellerSummary.ranking.map(id=>({id,quantity:null})):[];

const runtimeResponse = await fetch(`${FIRESTORE_ROOT}/products/_app_config?key=${encodeURIComponent(FIREBASE_API_KEY)}`, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
const runtimeSettings = runtimeResponse.ok ? decodeFields((await runtimeResponse.json()).fields || {}) : null;
if (!runtimeResponse.ok && runtimeResponse.status !== 404) throw new Error(`Firebase app settings: HTTP ${runtimeResponse.status}`);

let supabaseProducts = null;
if (supabaseUrl && supabaseKey) {
  try {
    const rows = await fetchJson(`${supabaseUrl}/rest/v1/products?active=eq.true&select=id`, 'Supabase fallback products', { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` });
    supabaseProducts = Array.isArray(rows) ? rows.length : 0;
  } catch { supabaseProducts = 0; }
}

console.log(JSON.stringify({
  ok: true,
  mode: 'firebase-shared-runtime',
  checkedAt: new Date().toISOString(),
  websiteProducts: catalog.products.length,
  firebaseProducts: firebaseProducts.length,
  ordersProtected: true,
  rankedBestsellers,
  appSettingsPublished: Boolean(runtimeSettings),
  configuredSections: runtimeSettings ? ['homepage','offers','help','shop'].filter(section => runtimeSettings[section]) : [],
  supabaseFallbackProducts: supabaseProducts,
}, null, 2));
