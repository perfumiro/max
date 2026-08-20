import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { CustomerAuthError, getCustomerUser, readCustomerSession, refreshCustomerSession, saveCustomerSession, sessionFromUrl, signInCustomer, signOutCustomer, signUpCustomer, verifyCustomerTokenHash, type CustomerSession } from '../services/customerAuthService';
import { unlinkPushDevice } from '../notifications/pushNotificationService';

const AUTH_RETURN_KEY = 'ipordise.customer.auth-return.v1';
const DEFAULT_ACCOUNT_DESTINATION = '/app?store=1&tab=account';

const safeDestination = (value: string | null | undefined) => {
  if (!value || value.length > 500 || !value.startsWith('/') || value.startsWith('//')) return DEFAULT_ACCOUNT_DESTINATION;
  try {
    const parsed = new URL(value, 'https://ipordise.local');
    if (parsed.origin !== 'https://ipordise.local') return DEFAULT_ACCOUNT_DESTINATION;
    for (const key of ['access_token', 'refresh_token', 'token_hash', 'error', 'error_code', 'auth']) parsed.searchParams.delete(key);
    return `${parsed.pathname}${parsed.search}`;
  } catch { return DEFAULT_ACCOUNT_DESTINATION; }
};

async function rememberDestination() {
  let destination = DEFAULT_ACCOUNT_DESTINATION;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const current = new URL(window.location.href);
    destination = safeDestination(current.searchParams.get('returnTo') || `${current.pathname}${current.search}`);
    window.sessionStorage.setItem(AUTH_RETURN_KEY, destination);
  } else {
    await SecureStore.setItemAsync(AUTH_RETURN_KEY, destination);
  }
}

async function consumeDestination() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const destination = safeDestination(window.sessionStorage.getItem(AUTH_RETURN_KEY));
    window.sessionStorage.removeItem(AUTH_RETURN_KEY);
    return destination;
  }
  const destination = safeDestination(await SecureStore.getItemAsync(AUTH_RETURN_KEY));
  await SecureStore.deleteItemAsync(AUTH_RETURN_KEY);
  return destination;
}

const navigateWeb = (destination: string) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== destination) window.location.replace(destination);
  else window.history.replaceState({}, '', destination);
};

type AuthValue = {
  session: CustomerSession | null;
  ready: boolean;
  recoveryMode: boolean;
  authNotice: string;
  authCompletionId: number;
  clearRecoveryMode: () => void;
  rememberIntendedDestination: () => Promise<void>;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUp: (input: Parameters<typeof signUpCustomer>[0]) => Promise<'signed-in' | 'verify-email'>;
  reauthenticate: (password: string) => Promise<string>;
  signOut: () => Promise<void>;
};

const CustomerAuthContext = createContext<AuthValue | null>(null);

export function CustomerAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [ready, setReady] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [authCompletionId, setAuthCompletionId] = useState(0);

  const acceptUrl = useCallback(async (url: string | null) => {
    if (!url) return false;
    let parsed: URL;
    try { parsed = new URL(url); }
    catch { setAuthNotice('authLinkInvalid'); return false; }
    const authParams = new URLSearchParams(parsed.search);
    new URLSearchParams(parsed.hash.replace(/^#/, '')).forEach((value, key) => authParams.set(key, value));
    if (authParams.get('error') || authParams.get('error_code')) {
      setAuthNotice('authLinkInvalid');
      return false;
    }
    let incoming = sessionFromUrl(url);
    const tokenHash = authParams.get('token_hash');
    const rawType = authParams.get('type');
    if (!incoming && tokenHash && (rawType === 'email' || rawType === 'recovery' || rawType === 'invite' || rawType === 'magiclink')) {
      try { incoming = await verifyCustomerTokenHash(tokenHash, rawType); }
      catch { setAuthNotice('authLinkInvalid'); return false; }
    }
    if (!incoming) return false;
    try {
      incoming.user = await getCustomerUser(incoming.access_token);
    } catch {
      await saveCustomerSession(null);
      setAuthNotice('authLinkInvalid');
      return false;
    }
    await saveCustomerSession(incoming, true);
    setSession(incoming);
    const recovering = rawType === 'recovery' || authParams.get('auth') === 'recovery';
    setRecoveryMode(recovering);
    setAuthNotice('');
    setAuthCompletionId(Date.now());
    navigateWeb(recovering ? DEFAULT_ACCOUNT_DESTINATION : await consumeDestination());
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (await acceptUrl(initialUrl)) { if (active) setReady(true); return; }
      let stored = await readCustomerSession();
      if (stored && (stored.expires_at || 0) <= Math.floor(Date.now() / 1000) + 30) {
        try { const remembered=stored.remembered !== false; stored = await refreshCustomerSession(stored.refresh_token); stored.remembered=remembered; await saveCustomerSession(stored, remembered); }
        catch (error) { await saveCustomerSession(null); stored = null; if (active) setAuthNotice(error instanceof CustomerAuthError && ['network','timeout','unavailable'].includes(error.code) ? 'authNetworkError' : 'sessionExpired'); }
      }
      if (stored) {
        try { stored = { ...stored, user: await getCustomerUser(stored.access_token) }; }
        catch (error) {
          if (error instanceof CustomerAuthError && ['network','timeout','unavailable'].includes(error.code) && (stored.expires_at || 0) > Math.floor(Date.now() / 1000)) setAuthNotice('offlineSession');
          else { await saveCustomerSession(null); stored = null; if (active) setAuthNotice('sessionExpired'); }
        }
      }
      if (active) { setSession(stored); setReady(true); }
    })();
    const subscription = Linking.addEventListener('url', event => { void acceptUrl(event.url); });
    return () => { active = false; subscription.remove(); };
  }, [acceptUrl]);

  const refreshNow = useCallback(async () => {
    if (!session?.refresh_token) return;
    try {
      const next = await refreshCustomerSession(session.refresh_token);
      next.user = await getCustomerUser(next.access_token);
      next.remembered=session.remembered !== false;
      await saveCustomerSession(next, next.remembered);
      setSession(next);
    } catch {
      await saveCustomerSession(null);
      setSession(null);
      setAuthNotice('sessionExpired');
    }
  }, [session?.refresh_token, session?.remembered]);

  useEffect(() => {
    if (!session) return;
    const refreshIn = Math.max(1_000, Math.min(2_000_000_000, ((session.expires_at || 0) * 1000) - Date.now() - 60_000));
    const timer = setTimeout(() => { void refreshNow(); }, refreshIn);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && (session.expires_at || 0) * 1000 <= Date.now() + 60_000) void refreshNow();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [refreshNow, session]);

  const clearRecoveryMode = useCallback(() => {
    setRecoveryMode(false);
    void consumeDestination().then(navigateWeb);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    session, ready, recoveryMode, authNotice, authCompletionId, clearRecoveryMode,
    rememberIntendedDestination: rememberDestination,
    signIn: async (email, password, remember = true) => {
      await rememberDestination();
      const next = await signInCustomer(email, password);
      next.remembered=remember;
      await saveCustomerSession(next, remember);
      setAuthNotice('');
      setSession(next);
      navigateWeb(await consumeDestination());
    },
    signUp: async input => {
      await rememberDestination();
      const result = await signUpCustomer(input);
      if (result.session) {
        await saveCustomerSession(result.session, true);
        setAuthNotice('');
        setSession(result.session);
        navigateWeb(await consumeDestination());
        return 'signed-in';
      }
      return 'verify-email';
    },
    reauthenticate: async password => {
      if (!session?.user.email) throw new CustomerAuthError('generic');
      const next = await signInCustomer(session.user.email, password);
      if (next.user.id !== session.user.id) throw new CustomerAuthError('invalid_credentials');
      const remembered = session.remembered !== false;
      next.remembered = remembered;
      await saveCustomerSession(next, remembered);
      setSession(next);
      return next.access_token;
    },
    signOut: async () => {
      try { await unlinkPushDevice(session?.access_token); }
      catch { /* Logout continues if push unlinking is temporarily unavailable. */ }
      try { await signOutCustomer(session?.access_token); }
      catch { /* Local session removal is authoritative when the network is unavailable. */ }
      finally { await saveCustomerSession(null); setSession(null); setAuthNotice(''); }
    },
  }), [authCompletionId, authNotice, clearRecoveryMode, ready, recoveryMode, session]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error('useCustomerAuth must be used inside CustomerAuthProvider');
  return value;
}
