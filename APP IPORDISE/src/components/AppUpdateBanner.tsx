import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { logger } from '../observability/logger';

const copy = {
  en: { ready: 'An update is ready.', restart: 'Restart now', error: 'Restart failed. Try again.' },
  fr: { ready: 'Une mise à jour est prête.', restart: 'Redémarrer', error: 'Échec du redémarrage. Réessayez.' },
  ar: { ready: 'التحديث جاهز.', restart: 'إعادة التشغيل', error: 'تعذرت إعادة التشغيل. حاول مجددًا.' },
};

export function AppUpdateBanner() {
  const { isUpdatePending, isDownloading } = Updates.useUpdates();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [restarting, setRestarting] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const updateState = useRef({ isUpdatePending, isDownloading });
  updateState.current = { isUpdatePending, isDownloading };
  const enabled = Platform.OS !== 'web' && !__DEV__ && Updates.isEnabled;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const check = async () => {
      if (busy.current || updateState.current.isUpdatePending || updateState.current.isDownloading) return;
      busy.current = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (active && result.isAvailable) await Updates.fetchUpdateAsync();
      } catch (error) {
        logger.warn('app_update_check_failed', { error });
      } finally {
        busy.current = false;
      }
    };
    void check();
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', state => {
      const resumed = state === 'active' && previous !== 'active';
      previous = state;
      if (resumed) void check();
    });
    return () => { active = false; subscription.remove(); };
  }, [enabled]);

  if (!enabled || !isUpdatePending) return null;
  const restart = async () => {
    if (restarting) return;
    setRestarting(true);
    setFailed(false);
    try { await Updates.reloadAsync(); }
    catch (error) {
      logger.warn('app_update_restart_failed', { error });
      setFailed(true);
      setRestarting(false);
    }
  };
  return <View accessibilityLiveRegion="polite" style={[styles.banner, { top: insets.top + 8 }]}>
    <Text style={styles.message}>{failed ? copy[language].error : copy[language].ready}</Text>
    <Pressable accessibilityRole="button" disabled={restarting} accessibilityState={{ disabled: restarting }} onPress={restart} style={styles.button}>
      <Text style={styles.action}>{copy[language].restart}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 12, right: 12, zIndex: 2000, elevation: 30, padding: 12, borderRadius: 14, backgroundColor: '#171310', flexDirection: 'row', alignItems: 'center', gap: 12 },
  message: { flex: 1, color: '#fff', fontSize: 13 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#d7193f' },
  action: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
