import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import {
  deleteCustomerAddress,
  loadCustomerAccount,
  loadCustomerOrders,
  saveCustomerAddress,
  saveCustomerProfile,
  saveNotificationPreferences,
  type CustomerAccountSection,
  type CustomerAddress,
  type CustomerOrderSummary,
  type CustomerProfile,
  type NotificationPreferences,
} from '../services/customerAccountService';
import { logger } from '../observability/logger';
import { useCustomerAuth } from './CustomerAuthContext';

export const defaultNotificationPreferences: NotificationPreferences = {
  order_updates: true,
  security_alerts: true,
  back_in_stock: true,
  wishlist_price_changes: true,
  new_products: false,
  offers_marketing: false,
};

type CustomerValue = {
  profile: CustomerProfile | null;
  orders: CustomerOrderSummary[];
  addresses: CustomerAddress[];
  defaultAddress: CustomerAddress | null;
  preferences: NotificationPreferences;
  loading: boolean;
  refreshing: boolean;
  error: string;
  unavailableSections: CustomerAccountSection[];
  refresh: (force?: boolean) => Promise<void>;
  refreshOrders: () => Promise<void>;
  updateProfile: (patch: Partial<CustomerProfile>) => Promise<CustomerProfile>;
  upsertAddress: (address: Omit<CustomerAddress, 'id'> & { id?: string }) => Promise<CustomerAddress>;
  removeAddress: (id: string) => Promise<void>;
  updatePreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
};

const CustomerContext = createContext<CustomerValue | null>(null);

export function CustomerProvider({ children }: PropsWithChildren) {
  const { session, ready } = useCustomerAuth();
  const identity = session?.user.id || null;
  const token = session?.access_token || '';
  const identityRef = useRef<string | null>(null);
  const lastRefreshRef = useRef(0);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [preferences, setPreferences] = useState(defaultNotificationPreferences);
  const [loading, setLoading] = useState(Boolean(identity));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unavailableSections, setUnavailableSections] = useState<CustomerAccountSection[]>([]);

  const clear = useCallback(() => {
    setProfile(null);
    setOrders([]);
    setAddresses([]);
    setPreferences(defaultNotificationPreferences);
    setUnavailableSections([]);
    setError('');
    lastRefreshRef.current = 0;
  }, []);

  const refresh = useCallback(async (force = false) => {
    if (!token || !identity) return;
    const firstLoad = !lastRefreshRef.current;
    if (firstLoad) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const data = await loadCustomerAccount(token, force);
      if (identityRef.current !== identity) return;
      if (data.profile !== undefined) setProfile(data.profile);
      if (data.orders !== undefined) setOrders(data.orders);
      if (data.addresses !== undefined) setAddresses(data.addresses);
      if (data.preferences !== undefined) setPreferences(data.preferences || defaultNotificationPreferences);
      setUnavailableSections(data.unavailable);
      lastRefreshRef.current = Date.now();
    } catch (cause) {
      if (identityRef.current !== identity) return;
      setUnavailableSections(['profile', 'orders', 'addresses', 'preferences']);
      setError(cause instanceof Error ? cause.message : "We couldn't refresh your account information.");
      logger.warn('customer_account_refresh_failed', { error: cause, userId: identity });
    } finally {
      if (identityRef.current === identity) { setLoading(false); setRefreshing(false); }
    }
  }, [identity, token]);

  useEffect(() => {
    if (!ready) return;
    if (identityRef.current !== identity) {
      identityRef.current = identity;
      clear();
    }
    if (!identity) { setLoading(false); return; }
    void refresh();
  }, [clear, identity, ready, refresh]);

  useEffect(() => {
    if (!identity) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastRefreshRef.current > 5 * 60_000) void refresh(true);
    });
    return () => subscription.remove();
  }, [identity, refresh]);

  const refreshOrders = useCallback(async () => {
    if (!token || !identity) return;
    try {
      const next = await loadCustomerOrders(token);
      if (identityRef.current === identity) {
        setOrders(next);
        setUnavailableSections(current => current.filter(section => section !== 'orders'));
      }
    } catch (cause) {
      setUnavailableSections(current => current.includes('orders') ? current : [...current, 'orders']);
      throw cause;
    }
  }, [identity, token]);

  const updateProfile = useCallback(async (patch: Partial<CustomerProfile>) => {
    if (!token) throw new Error('Sign in to update your profile.');
    const saved = await saveCustomerProfile(token, patch);
    setProfile(saved);
    setUnavailableSections(current => current.filter(section => section !== 'profile'));
    return saved;
  }, [token]);

  const upsertAddress = useCallback(async (address: Omit<CustomerAddress, 'id'> & { id?: string }) => {
    if (!token) throw new Error('Sign in to save an address.');
    const saved = await saveCustomerAddress(token, address);
    await refresh(true);
    return saved;
  }, [refresh, token]);

  const removeAddress = useCallback(async (id: string) => {
    if (!token) throw new Error('Sign in to remove an address.');
    await deleteCustomerAddress(token, id);
    await refresh(true);
  }, [refresh, token]);

  const updatePreferences = useCallback(async (patch: Partial<NotificationPreferences>) => {
    if (!token) throw new Error('Sign in to update notifications.');
    const previous = preferences;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try { await saveNotificationPreferences(token, next); }
    catch (cause) { setPreferences(previous); throw cause; }
  }, [preferences, token]);

  const defaultAddress = useMemo(() => addresses.find(address => address.is_default) || addresses[0] || null, [addresses]);
  const value = useMemo<CustomerValue>(() => ({
    profile, orders, addresses, defaultAddress, preferences, loading, refreshing, error, unavailableSections,
    refresh, refreshOrders, updateProfile, upsertAddress, removeAddress, updatePreferences,
  }), [addresses, defaultAddress, error, loading, orders, preferences, profile, refresh, refreshOrders, refreshing, removeAddress, unavailableSections, updatePreferences, updateProfile, upsertAddress]);

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const value = useContext(CustomerContext);
  if (!value) throw new Error('useCustomer must be used inside CustomerProvider');
  return value;
}
