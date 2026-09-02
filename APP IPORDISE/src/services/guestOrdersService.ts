import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { CompletedOrder } from './orderService';
import { trackSavedGuestOrder, type TrackedOrder } from './orderTrackingService';

const STORAGE_KEY = 'ipordise.guest-orders.v1';
// Keeps the native SecureStore payload comfortably small while retaining a
// useful purchase history. Full order details remain on the server.
const MAX_SAVED_ORDERS = 12;
let storageMutation: Promise<void> = Promise.resolve();

export type SavedGuestOrder = {
  orderReference: string;
  trackingToken: string;
  createdAt: string;
};

const validCredential = (value: unknown): value is SavedGuestOrder => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return /^IPD?-[A-Z0-9-]{8,32}$/.test(String(item.orderReference || ''))
    && /^[A-Za-z0-9_-]{43}$/.test(String(item.trackingToken || ''))
    && Number.isFinite(Date.parse(String(item.createdAt || '')));
};

const readRaw = async () => Platform.OS === 'web'
  ? (typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY))
  : SecureStore.getItemAsync(STORAGE_KEY);

const writeRaw = async (value: string) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') throw new Error('Local order storage is unavailable.');
    localStorage.setItem(STORAGE_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export async function getGuestOrders(): Promise<SavedGuestOrder[]> {
  try {
    const raw = await readRaw();
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(validCredential).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, MAX_SAVED_ORDERS)
      : [];
  } catch {
    return [];
  }
}

export async function saveGuestOrder(order: Pick<CompletedOrder, 'orderNumber' | 'trackingToken' | 'createdAt'> | SavedGuestOrder) {
  const credential: SavedGuestOrder = 'orderReference' in order
    ? order
    : { orderReference: order.orderNumber, trackingToken: order.trackingToken, createdAt: order.createdAt };
  if (!validCredential(credential)) throw new Error('The guest-order credential is invalid.');
  const mutation = storageMutation.then(async () => {
    const existing = await getGuestOrders();
    const next = [credential, ...existing.filter(item => item.orderReference !== credential.orderReference)].slice(0, MAX_SAVED_ORDERS);
    await writeRaw(JSON.stringify(next));
  });
  storageMutation = mutation.then(() => undefined, () => undefined);
  await mutation;
  return credential;
}

export async function removeGuestOrder(orderReference: string) {
  const mutation = storageMutation.then(async () => {
    const next = (await getGuestOrders()).filter(item => item.orderReference !== orderReference.trim().toUpperCase());
    await writeRaw(JSON.stringify(next));
  });
  storageMutation = mutation.then(() => undefined, () => undefined);
  await mutation;
}

export async function syncGuestOrders(): Promise<{ saved: SavedGuestOrder; order?: TrackedOrder; error?: unknown }[]> {
  const savedOrders = await getGuestOrders();
  return Promise.all(savedOrders.map(async saved => {
    try { return { saved, order: await trackSavedGuestOrder(saved.orderReference, saved.trackingToken) }; }
    catch (error) { return { saved, error }; }
  }));
}
