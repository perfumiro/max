import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { appConfig } from '../config';
import { ApiError, apiRequest } from './apiClient';

export type PreorderInput = { productId: string; variantId?: string; selectedVariant?: string; customerName: string; phone: string; email?: string; city?: string; quantity: number; customerMessage?: string };
export type PreorderConfirmation = { id: string; status: string; createdAt: string };
const pending = new Map<string, Promise<PreorderConfirmation>>();
const keyFor = (input: PreorderInput) => `preorder-${input.productId}-${input.variantId || 'product'}-${input.phone.replace(/\D/g, '')}`;
const randomKey = () => globalThis.crypto?.randomUUID?.() || `preorder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const readStoredKey = async (storageKey: string) => {
  try { return Platform.OS === 'web' ? (typeof localStorage === 'undefined' ? '' : localStorage.getItem(storageKey) || '') : await SecureStore.getItemAsync(storageKey) || ''; } catch { return ''; }
};
const storeKey = async (storageKey: string, value: string) => {
  try { if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, value); } else await SecureStore.setItemAsync(storageKey, value); } catch {}
};
const clearStoredKey = async (storageKey: string) => {
  try { if (Platform.OS === 'web') { if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey); } else await SecureStore.deleteItemAsync(storageKey); } catch {}
};

export async function createPreorder(input: PreorderInput, accessToken = ''): Promise<PreorderConfirmation> {
  const fingerprint = keyFor(input);
  const existing = pending.get(fingerprint); if (existing) return existing;
  const request = (async () => {
    if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new ApiError('Preorder requests are not configured yet.');
    const storageKey = `ipordise.preorder.${fingerprint}`;
    let idempotencyKey = await readStoredKey(storageKey);
    if (!idempotencyKey) { idempotencyKey = randomKey(); await storeKey(storageKey, idempotencyKey); }
    const result = await apiRequest<any>(`${appConfig.supabaseUrl}/functions/v1/create-preorder`, { method: 'POST', headers: { apikey: appConfig.supabasePublishableKey, 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ ...input, idempotencyKey, source: Platform.OS === 'web' ? 'website' : 'mobile_app' }), timeoutMs: 30_000, maxAttempts: 1 });
    const row = result?.request;
    if (!row?.id) throw new ApiError('The request response could not be verified.', 502);
    await clearStoredKey(storageKey);
    return { id: String(row.id), status: String(row.status || 'new'), createdAt: String(row.created_at || new Date().toISOString()) };
  })().finally(() => pending.delete(fingerprint));
  pending.set(fingerprint, request); return request;
}
