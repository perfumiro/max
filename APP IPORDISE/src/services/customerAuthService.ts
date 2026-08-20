import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { appConfig } from '../config';
import { normalizeEmail } from './customerValidation';
import { CustomerAuthError, classifyCustomerAuthError } from './customerAuthErrors';
export { CustomerAuthError, classifyCustomerAuthError } from './customerAuthErrors';
export type { CustomerAuthErrorCode } from './customerAuthErrors';

export type CustomerUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type CustomerSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: CustomerUser;
  remembered?: boolean;
};

const SESSION_KEY = 'ipordise.customer.session.v1';
let memorySession: CustomerSession | null = null;

function requireConfig() {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new CustomerAuthError('unavailable');
  return { url: appConfig.supabaseUrl, key: appConfig.supabasePublishableKey };
}

const customerRedirectUrl = (mode: 'confirmed' | 'recovery') => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/app?auth=${mode}`;
  return `ipordise://auth?auth=${mode}`;
};

async function authRequest<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const { url, key } = requireConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), appConfig.requestTimeoutMs);
  try {
    const response = await fetch(`${url}/auth/v1${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: { apikey: key, 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new CustomerAuthError(classifyCustomerAuthError(response.status, body));
    return body as T;
  } catch (error) {
    if (error instanceof CustomerAuthError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new CustomerAuthError('timeout');
    throw new CustomerAuthError('network');
  } finally { clearTimeout(timer); }
}

function withExpiry(session: CustomerSession): CustomerSession {
  return { ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in };
}

export async function saveCustomerSession(session: CustomerSession | null, remember = true) {
  memorySession = session ? withExpiry({ ...session, remembered: remember }) : null;
  const value = memorySession ? JSON.stringify(memorySession) : null;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    if (value) (remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, value);
    return;
  }
  if (value) await SecureStore.setItemAsync(SESSION_KEY, value); else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function readCustomerSession(): Promise<CustomerSession | null> {
  if (memorySession) return memorySession;
  try {
    const raw = Platform.OS === 'web'
      ? (typeof window === 'undefined' ? null : window.sessionStorage.getItem(SESSION_KEY) || window.localStorage.getItem(SESSION_KEY))
      : await SecureStore.getItemAsync(SESSION_KEY);
    memorySession = raw ? JSON.parse(raw) : null;
    return memorySession;
  } catch { return null; }
}

export async function signUpCustomer(input: { email: string; password: string; firstName: string; lastName: string; phone?: string; marketingConsent: boolean }) {
  return authRequest<{ user: CustomerUser; session: CustomerSession | null }>(`/signup?redirect_to=${encodeURIComponent(customerRedirectUrl('confirmed'))}`, {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email), password: input.password,
      data: { first_name: input.firstName.trim(), last_name: input.lastName.trim(), display_name: `${input.firstName} ${input.lastName}`.trim(), phone: input.phone?.trim() || null, marketing_consent: input.marketingConsent },
    }),
  });
}

export async function signInCustomer(email: string, password: string) {
  return authRequest<CustomerSession>('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: normalizeEmail(email), password }) });
}

export async function resendCustomerVerification(email: string) {
  await authRequest(`/resend?redirect_to=${encodeURIComponent(customerRedirectUrl('confirmed'))}`, { method: 'POST', body: JSON.stringify({ type: 'signup', email: normalizeEmail(email) }) });
}

export async function requestCustomerPasswordReset(email: string) {
  await authRequest(`/recover?redirect_to=${encodeURIComponent(customerRedirectUrl('recovery'))}`, { method: 'POST', body: JSON.stringify({ email: normalizeEmail(email), gotrue_meta_security: {} }) });
}

export async function refreshCustomerSession(refreshToken: string) {
  return authRequest<CustomerSession>('/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
}

export async function getCustomerUser(accessToken: string) { return authRequest<CustomerUser>('/user', { method: 'GET' }, accessToken); }

export async function updateCustomerPassword(accessToken: string, password: string) {
  return authRequest<CustomerUser>('/user', { method: 'PUT', body: JSON.stringify({ password }) }, accessToken);
}

export async function verifyCustomerTokenHash(tokenHash: string, type: 'email' | 'recovery' | 'invite' | 'magiclink') {
  return authRequest<CustomerSession>('/verify', { method: 'POST', body: JSON.stringify({ token_hash: tokenHash, type }) });
}

export async function signOutCustomer(accessToken?: string) {
  try { if (accessToken) await authRequest('/logout', { method: 'POST' }, accessToken); } finally { await saveCustomerSession(null); }
}

export function sessionFromUrl(url: string): CustomerSession | null {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.hash.replace(/^#/, '') || parsed.search);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return null;
    const encoded = access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(globalThis.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    return withExpiry({ access_token, refresh_token, expires_in: Number(params.get('expires_in') || 3600), token_type: params.get('token_type') || 'bearer', user: { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata } });
  } catch { return null; }
}
