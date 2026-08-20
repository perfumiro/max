import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SupportSession } from './supportService';

const storageKey = 'ipordise-support-session-v1';

export async function readSupportSession(): Promise<SupportSession | null> {
  try {
    const value = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? localStorage.getItem(storageKey)
      : await SecureStore.getItemAsync(storageKey);
    return value ? JSON.parse(value) as SupportSession : null;
  } catch {
    return null;
  }
}

export async function saveSupportSession(session: SupportSession) {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(storageKey, value);
  else await SecureStore.setItemAsync(storageKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function clearSupportSession() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
  else await SecureStore.deleteItemAsync(storageKey);
}
