import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { appConfig } from '../config';
import { apiRequest } from '../services/apiClient';
import { normalizePushPermission, safeNotificationProductId, type NormalizedPushPermission } from './notificationLogic';

const INSTALLATION_KEY = 'ipordise.push.installation.v1';
const TOKEN_KEY = 'ipordise.push.token.v1';
const PROMPT_KEY = 'ipordise.push.prompt-seen.v1';
const PREFERENCES_KEY = 'ipordise.push.preferences.v1';
export type PushPermissionStatus = NormalizedPushPermission;
export type PushPreferences = { newProductsEnabled: boolean; orderUpdatesEnabled: boolean; offersEnabled: boolean };

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

const readLocal = async (key: string) => Platform.OS === 'web'
  ? (typeof localStorage === 'undefined' ? null : localStorage.getItem(key))
  : SecureStore.getItemAsync(key);
const writeLocal = async (key: string, value: string) => Platform.OS === 'web'
  ? (typeof localStorage === 'undefined' ? undefined : localStorage.setItem(key, value))
  : SecureStore.setItemAsync(key, value);
const uuid = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
  const random = Math.floor(Math.random() * 16);
  return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
});

export async function getInstallationId() {
  const current = await readLocal(INSTALLATION_KEY);
  if (current) return current;
  const next = uuid();
  await writeLocal(INSTALLATION_KEY, next);
  return next;
}
export const hasSeenPushPrompt = async () => (await readLocal(PROMPT_KEY)) === '1';
export const markPushPromptSeen = async () => writeLocal(PROMPT_KEY, '1');
export const readStoredPushToken = () => readLocal(TOKEN_KEY);
export async function readLocalPushPreferences(): Promise<PushPreferences | null> {
  try {
    const value = JSON.parse((await readLocal(PREFERENCES_KEY)) || 'null');
    return value && typeof value === 'object' ? { newProductsEnabled: value.newProductsEnabled === true, orderUpdatesEnabled: value.orderUpdatesEnabled === true, offersEnabled: value.offersEnabled === true } : null;
  } catch { return null; }
}
export const saveLocalPushPreferences = (preferences: PushPreferences) => writeLocal(PREFERENCES_KEY, JSON.stringify(preferences));

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (Platform.OS === 'web' || !Device.isDevice) return normalizePushPermission({ available: false, granted: false, status: 'undetermined' });
  const permission = await Notifications.getPermissionsAsync();
  return normalizePushPermission({ available: true, granted: permission.granted, status: permission.status, provisional: permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL });
}

async function configureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('new-products', { name: 'New arrivals', description: 'New fragrances and products from IPORDISE.', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default', vibrationPattern: [0, 180, 120, 180], lightColor: '#D7193F' }),
    Notifications.setNotificationChannelAsync('offers', { name: '48H promotions', description: 'Limited-time fragrance promotions from IPORDISE.', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 180, 120, 180], lightColor: '#D7193F' }),
    Notifications.setNotificationChannelAsync('order-updates', { name: 'Order updates', description: 'Confirmation, preparation, shipping and delivery updates.', importance: Notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 180, 120, 180], lightColor: '#D7193F' }),
  ]);
}

const projectId = () => Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
export async function requestProductionPushToken() {
  if (Platform.OS === 'web' || !Device.isDevice) throw new Error('Push notifications require a physical Android or iPhone device.');
  await configureAndroidChannels();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.status !== Notifications.PermissionStatus.DENIED) {
    permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  }
  const status = await getPushPermissionStatus();
  if (status !== 'granted' && status !== 'provisional') throw new Error(status === 'denied' ? 'Notifications are disabled in phone settings.' : 'Notification permission was not granted.');
  const easProjectId = projectId();
  if (!easProjectId) throw new Error('The EAS project must be linked before push registration can finish.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
  await writeLocal(TOKEN_KEY, token);
  return token;
}

export async function savePushDevice(input: { token: string; accessToken?: string | null; language: 'fr' | 'en' | 'ar'; preferences: PushPreferences; action?: 'register' | 'preferences' }) {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey || Platform.OS === 'web') return;
  await saveLocalPushPreferences(input.preferences);
  await apiRequest(`${appConfig.supabaseUrl}/functions/v1/push-devices`, {
    method: 'POST',
    headers: { apikey: appConfig.supabasePublishableKey, Authorization: `Bearer ${input.accessToken || appConfig.supabasePublishableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: input.action || 'register', installationId: await getInstallationId(), expoPushToken: input.token, platform: Platform.OS, language: input.language, appVersion: Constants.expoConfig?.version, ...input.preferences }),
  });
}

export async function unlinkPushDevice(accessToken?: string | null) {
  const token = await readStoredPushToken();
  if (!token || !accessToken || !appConfig.supabaseUrl || !appConfig.supabasePublishableKey || Platform.OS === 'web') return;
  await apiRequest(`${appConfig.supabaseUrl}/functions/v1/push-devices`, {
    method: 'POST', headers: { apikey: appConfig.supabasePublishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unlink', installationId: await getInstallationId(), expoPushToken: token }),
  });
}

export const openNotificationSettings = () => Linking.openSettings();
export const notificationProductId = (response: Notifications.NotificationResponse | null | undefined) => {
  const data = response?.notification.request.content.data;
  return safeNotificationProductId(data);
};
export { Notifications };
