import Ionicons from '@expo/vector-icons/Ionicons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCustomerAuth } from '../account/CustomerAuthContext';
import { useCustomer } from '../account/CustomerContext';
import { useLanguage } from '../i18n/LanguageContext';
import { logger } from '../observability/logger';
import { shouldShowNotificationInvitation } from './notificationLogic';
import { getPushPermissionStatus, hasSeenPushPrompt, markPushPromptSeen, notificationProductId, Notifications, openNotificationSettings, readLocalPushPreferences, readStoredPushToken, requestProductionPushToken, savePushDevice, type PushPermissionStatus, type PushPreferences } from './pushNotificationService';

type PushValue = { permission: PushPermissionStatus; enabling: boolean; error: string; pendingProductId: string | null; enable: (preferences?: Partial<PushPreferences>) => Promise<boolean>; openSettings: () => Promise<void>; refreshPermission: () => Promise<void>; clearPendingProduct: () => void; setPromptEligible: (eligible: boolean) => void };
const PushContext = createContext<PushValue | null>(null);
const copy = {
  en: { eyebrow: 'STAY IN THE KNOW', title: 'Discover new arrivals first.', body: 'Turn on notifications to hear about new fragrances, exclusive releases and your order updates.', enable: 'Enable notifications', later: 'Maybe later', note: 'You can change this anytime in Account → Notifications.' },
  fr: { eyebrow: 'RESTEZ INFORMÉ', title: 'Découvrez les nouveautés en premier.', body: 'Activez les notifications pour découvrir les nouveaux parfums, les lancements exclusifs et le suivi de vos commandes.', enable: 'Activer les notifications', later: 'Plus tard', note: 'Modifiable à tout moment dans Compte → Notifications.' },
  ar: { eyebrow: 'ابقَ على اطلاع', title: 'اكتشف أحدث العطور أولاً.', body: 'فعّل الإشعارات لمعرفة العطور الجديدة والإصدارات الحصرية وتحديثات طلباتك.', enable: 'تفعيل الإشعارات', later: 'ربما لاحقاً', note: 'يمكنك تغيير ذلك في أي وقت من الحساب ← الإشعارات.' },
};

export function PushNotificationProvider({ children }: PropsWithChildren) {
  const { session, ready } = useCustomerAuth();
  const { preferences, updatePreferences } = useCustomer();
  const { language, rtl } = useLanguage();
  const [permission, setPermission] = useState<PushPermissionStatus>('notDetermined');
  const [promptVisible, setPromptVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState('');
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [promptEligible, setPromptEligible] = useState(false);
  const [guestPreferences, setGuestPreferences] = useState<PushPreferences>({ newProductsEnabled: false, orderUpdatesEnabled: false, offersEnabled: false });
  const handledResponseRef = useRef('');
  const accountPreferences = useMemo(() => ({ newProductsEnabled: preferences.new_products, orderUpdatesEnabled: preferences.order_updates, offersEnabled: preferences.offers_marketing }), [preferences.new_products, preferences.offers_marketing, preferences.order_updates]);
  const pushPreferences = session ? accountPreferences : guestPreferences;
  const refreshPermission = useCallback(async () => setPermission(await getPushPermissionStatus()), []);
  const sync = useCallback(async (token: string, action: 'register' | 'preferences' = 'register') => savePushDevice({ token, accessToken: session?.access_token, language, preferences: pushPreferences, action }), [language, pushPreferences, session?.access_token]);
  const enable = useCallback(async (preferencePatch: Partial<PushPreferences> = { newProductsEnabled: true }) => {
    setEnabling(true); setError('');
    await markPushPromptSeen();
    try {
      const token = await requestProductionPushToken();
      const enabledPreferences = { ...pushPreferences, ...preferencePatch };
      setGuestPreferences(enabledPreferences);
      if (session) await updatePreferences({ new_products: enabledPreferences.newProductsEnabled, order_updates: enabledPreferences.orderUpdatesEnabled, offers_marketing: enabledPreferences.offersEnabled });
      await savePushDevice({ token, accessToken: session?.access_token, language, preferences: enabledPreferences });
      await refreshPermission();
      setPromptVisible(false);
      return true;
    } catch (cause) {
      await refreshPermission();
      setError(cause instanceof Error ? cause.message : "We couldn't enable notifications right now. You can try again later.");
      return false;
    } finally { setEnabling(false); }
  }, [language, pushPreferences, refreshPermission, session, updatePreferences]);
  const handleResponse = useCallback((response: Notifications.NotificationResponse | null) => {
    if (!response || handledResponseRef.current === response.notification.request.identifier) return;
    handledResponseRef.current = response.notification.request.identifier;
    const productId = notificationProductId(response);
    if (productId) setPendingProductId(productId);
    void Notifications.setBadgeCountAsync(0).catch(() => undefined);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void refreshPermission();
    void Notifications.getLastNotificationResponseAsync().then(handleResponse);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const tokenSubscription = Notifications.addPushTokenListener(token => { void sync(token.data).catch(cause => logger.warn('push_token_refresh_failed', { error: cause })); });
    return () => { responseSubscription.remove(); tokenSubscription.remove(); };
  }, [handleResponse, refreshPermission, sync]);
  useEffect(() => {
    if (!ready || !promptEligible || Platform.OS === 'web') return;
    let active = true;
    const timer = setTimeout(() => { void (async () => {
      const status = await getPushPermissionStatus();
      if (!active) return;
      setPermission(status);
      if (shouldShowNotificationInvitation(status, await hasSeenPushPrompt()) && active && AppState.currentState === 'active') setPromptVisible(true);
    })(); }, 2500);
    return () => { active = false; clearTimeout(timer); };
  }, [promptEligible, ready]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void readLocalPushPreferences().then(value => { if (value) setGuestPreferences(value); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refreshPermission(); });
    return () => subscription.remove();
  }, [refreshPermission]);
  useEffect(() => {
    if (Platform.OS === 'web' || !session || (permission !== 'granted' && permission !== 'provisional')) return;
    void readStoredPushToken().then(token => token ? sync(token, 'preferences') : undefined).catch(cause => logger.warn('push_preferences_sync_failed', { error: cause }));
  }, [permission, session, sync]);
  const value = useMemo<PushValue>(() => ({ permission, enabling, error, pendingProductId, enable, openSettings: openNotificationSettings, refreshPermission, clearPendingProduct: () => setPendingProductId(null), setPromptEligible }), [enable, enabling, error, pendingProductId, permission, refreshPermission]);
  const message = copy[language];
  return <PushContext.Provider value={value}>{children}<Modal visible={promptVisible} transparent animationType="fade" onRequestClose={() => undefined}><View style={styles.backdrop}><View style={styles.card}><View style={styles.icon}><Ionicons name="notifications-outline" size={25} color="#7b1830" /></View><Text style={[styles.eyebrow, rtl && styles.rtl]}>{message.eyebrow}</Text><Text style={[styles.title, rtl && styles.rtl]}>{message.title}</Text><Text style={[styles.body, rtl && styles.rtl]}>{message.body}</Text>{error ? <Text style={[styles.error, rtl && styles.rtl]}>{error}</Text> : null}<Pressable disabled={enabling} onPress={() => void enable()} style={styles.primary}>{enabling ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{message.enable}</Text>}</Pressable><Pressable disabled={enabling} onPress={() => { void markPushPromptSeen(); setPromptVisible(false); }} style={styles.secondary}><Text style={styles.secondaryText}>{message.later}</Text></Pressable><Text style={[styles.note, rtl && styles.rtl]}>{message.note}</Text></View></View></Modal></PushContext.Provider>;
}
export function usePushNotifications() { const value = useContext(PushContext); if (!value) throw new Error('usePushNotifications must be used inside PushNotificationProvider'); return value; }
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(24,14,16,.48)', alignItems: 'center', justifyContent: 'center', padding: 22 }, card: { width: '100%', maxWidth: 430, borderRadius: 26, backgroundColor: '#fffaf4', borderWidth: 1, borderColor: '#eadfd5', padding: 26, shadowColor: '#210d12', shadowOpacity: .2, shadowRadius: 24, elevation: 12 }, icon: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#f8e8ec', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }, eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: '#a51d3b' }, title: { marginTop: 8, fontFamily: 'Georgia', fontSize: 27, lineHeight: 33, fontWeight: '700', color: '#211719' }, body: { marginTop: 12, fontSize: 14, lineHeight: 21, color: '#6f625c' }, primary: { minHeight: 50, borderRadius: 15, backgroundColor: '#7b1830', alignItems: 'center', justifyContent: 'center', marginTop: 24 }, primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' }, secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: '#5d514b', fontSize: 13, fontWeight: '700' }, note: { textAlign: 'center', fontSize: 11, lineHeight: 16, color: '#91837b' }, error: { marginTop: 10, fontSize: 12, lineHeight: 18, color: '#b4233f' }, rtl: { textAlign: 'right', writingDirection: 'rtl' } });
