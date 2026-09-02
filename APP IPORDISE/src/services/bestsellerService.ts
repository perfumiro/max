import { appConfig } from '../config';
import { decodeFirestoreFields, parseFirestoreDocument, publicFirestoreUrl } from './firestoreRest';
import { rankBestsellerProductIds, type BestsellerOrder } from './bestsellerRanking';
import { ApiError, apiRequest } from './apiClient';

const CACHE_MS = 5 * 60_000;
let cachedIds: string[] | null = null;
let cachedUntil = 0;
let pendingRequest: Promise<string[]> | null = null;

async function fetchPublishedRanking():Promise<string[]|null>{
  try {
    const body=await apiRequest<Record<string,unknown>>(publicFirestoreUrl('products/_bestsellers'),{headers:{Accept:'application/json','Cache-Control':'no-cache'},maxAttempts:2});
    const document=parseFirestoreDocument(body);
    return Array.isArray(document.ranking)?document.ranking.filter((item):item is string=>typeof item==='string'&&item.length>0):[];
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function fetchOrderRanking(): Promise<string[]> {
  const orders: BestsellerOrder[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ key: appConfig.firebaseApiKey, pageSize: '300' });
    query.append('mask.fieldPaths', 'items');
    query.append('mask.fieldPaths', 'status');
    if (pageToken) query.set('pageToken', pageToken);
    const body = await apiRequest<{documents?:{fields?:Record<string,unknown>}[];nextPageToken?:string}>(`${appConfig.firestoreRoot}/orders?${query}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, maxAttempts:2,
    });
    orders.push(...(body.documents || []).map((document: { fields?: Record<string, unknown> }) => decodeFirestoreFields(document.fields || {})));
    pageToken = String(body.nextPageToken || '');
  } while (pageToken);
  return rankBestsellerProductIds(orders);
}

async function fetchBestsellerIds():Promise<string[]>{
  try{const published=await fetchPublishedRanking();if(published)return published;}catch{}
  return fetchOrderRanking();
}

export function loadBestsellerProductIds(forceRefresh = false): Promise<string[]> {
  if (!forceRefresh && cachedIds && Date.now() < cachedUntil) return Promise.resolve(cachedIds);
  if (pendingRequest) return pendingRequest;
  pendingRequest = fetchBestsellerIds()
    .then(ids => {
      cachedIds = ids;
      cachedUntil = Date.now() + CACHE_MS;
      return ids;
    })
    .finally(() => { pendingRequest = null; });
  return pendingRequest;
}
