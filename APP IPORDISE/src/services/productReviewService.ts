import { appConfig } from '../config';
import { ApiError, apiRequest } from './apiClient';

export type ProductReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewerName: string;
  city?: string | null;
  purchasedSize?: string | null;
  createdAt: string;
};

export type ProductReviewSummary = {
  average: number;
  count: number;
  distribution: { stars: number; count: number; percent: number }[];
  reviews: ProductReview[];
};

type CodeRequestResult = { eligible: boolean; alreadyReviewed?: boolean; verificationId?: string; expiresAt?: string; code?: string };
const REVIEW_CACHE_MS = 2 * 60_000;
const reviewCache = new Map<string, { until: number; data: ProductReviewSummary }>();
const reviewRequests = new Map<string, Promise<ProductReviewSummary>>();

const endpoint = () => {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new ApiError('Verified reviews are not configured yet.', 503, 'SERVICE_UNAVAILABLE');
  return `${appConfig.supabaseUrl}/functions/v1/product-reviews`;
};

async function reviewRequest<T>(body: Record<string, unknown>) {
  return apiRequest<T>(endpoint(), {
    method: 'POST',
    headers: { apikey: appConfig.supabasePublishableKey!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function loadProductReviews(productId: string, force = false) {
  const cached = reviewCache.get(productId);
  if (!force && cached && cached.until > Date.now()) return Promise.resolve(cached.data);
  const pending = reviewRequests.get(productId);
  if (pending) return pending;
  const request = reviewRequest<ProductReviewSummary>({ action: 'list', productId })
    .then(data => {
      reviewCache.set(productId, { data, until: Date.now() + REVIEW_CACHE_MS });
      while (reviewCache.size > 30) reviewCache.delete(reviewCache.keys().next().value!);
      return data;
    })
    .finally(() => reviewRequests.delete(productId));
  reviewRequests.set(productId, request);
  return request;
}

export const requestProductReviewCode = (productId: string, email: string) => reviewRequest<CodeRequestResult>({ action: 'request-code', productId, email: email.trim().toLowerCase() });

export const verifyProductReviewCode = (input: { productId: string; email: string; verificationId: string; code: string }) => reviewRequest<{ verified: boolean }>({ action: 'verify-code', ...input, email: input.email.trim().toLowerCase() });

export const submitProductReview = async (input: { productId: string; email: string; verificationId: string; code: string; rating: number; title: string; body: string }) => {
  const result = await reviewRequest<{ submitted: boolean }>({ action: 'submit', ...input, email: input.email.trim().toLowerCase() });
  reviewCache.delete(input.productId);
  return result;
};

export function productReviewErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'The review service is temporarily unavailable.';
  if (error.code === 'INVALID_EMAIL') return 'Enter the same complete email address used for your order.';
  if (error.code === 'INVALID_CODE') return 'That verification code is invalid or has expired.';
  if (error.code === 'RATE_LIMITED') return 'Too many attempts. Please wait before trying again.';
  if (error.code === 'ALREADY_REVIEWED') return 'This purchase already has a verified review.';
  if (error.code === 'PURCHASE_NOT_FOUND') return 'We could not verify a delivered purchase for this product.';
  if (error.code === 'INVALID_REVIEW') return 'Add a rating, a short title, and at least 15 characters.';
  if (error.code === 'SERVICE_UNAVAILABLE') return 'Verified reviews are temporarily unavailable.';
  return 'The review service is temporarily unavailable. Please try again.';
}
