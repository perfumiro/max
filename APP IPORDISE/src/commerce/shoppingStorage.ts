import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SHOPPING_STORAGE_KEY = 'ipordise.shopping.local.v1';

export type StoredShoppingState = {
  favouriteIds: string[];
  bag: { productId: string; variantId: string; size?: string; quantity: number }[];
};

const emptyState = (): StoredShoppingState => ({ favouriteIds: [], bag: [] });

export async function readLocalShoppingState(): Promise<StoredShoppingState> {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof localStorage === 'undefined' ? null : localStorage.getItem(SHOPPING_STORAGE_KEY))
      : await SecureStore.getItemAsync(SHOPPING_STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<StoredShoppingState>;
    return {
      favouriteIds: Array.isArray(parsed.favouriteIds) ? parsed.favouriteIds.map(String).slice(0, 200) : [],
      bag: Array.isArray(parsed.bag) ? parsed.bag.slice(0, 50).map(line => ({
        productId: String(line.productId || ''),
        variantId: String(line.variantId || ''),
        size: line.size ? String(line.size) : undefined,
        quantity: Math.max(1, Math.min(20, Number(line.quantity) || 1)),
      })).filter(line => line.productId && line.variantId) : [],
    };
  } catch { return emptyState(); }
}

export async function saveLocalShoppingState(value: StoredShoppingState) {
  const raw = JSON.stringify(value);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SHOPPING_STORAGE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(SHOPPING_STORAGE_KEY, raw);
}
