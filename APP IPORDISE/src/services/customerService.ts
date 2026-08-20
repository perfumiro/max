import { appConfig } from '../config';
import { ApiError, apiRequest } from './apiClient';
import { normalizeEmail } from './customerValidation';

export { isValidEmail, normalizeEmail } from './customerValidation';

const requireSupabase = () => {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) {
    throw new ApiError('Account services are not configured yet.');
  }
  return { url: appConfig.supabaseUrl, key: appConfig.supabasePublishableKey };
};

export async function requestMagicLink(email: string) {
  const { url, key } = requireSupabase();
  await apiRequest(`${url}/auth/v1/otp`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeEmail(email), create_user: true }),
  });
}

export type NewsletterSubscriptionResult = 'subscribed' | 'already_subscribed';

export async function subscribeToNewsletter(email: string): Promise<NewsletterSubscriptionResult> {
  const { url, key } = requireSupabase();
  const normalizedEmail = normalizeEmail(email);
  const result = await apiRequest<{status:NewsletterSubscriptionResult}>(`${url}/functions/v1/newsletter-subscribe`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });
  return result.status;
}
