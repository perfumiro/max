import { appConfig } from '../config';
import { logger } from '../observability/logger';

export class ApiError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'signal'> & { timeoutMs?: number; maxAttempts?: number };

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const safeServiceMessage = (body: any) => {
  const message = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : '';
  return message.length > 0 && message.length <= 240 ? message : 'The service could not complete this request.';
};

export async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  let lastError: unknown;
  const {timeoutMs,maxAttempts:configuredAttempts,...requestOptions}=options;
  const method=String(requestOptions.method||'GET').toUpperCase();
  const headers=new Headers(requestOptions.headers);
  if(!headers.has('Accept'))headers.set('Accept','application/json');
  const retrySafe=['GET','HEAD','OPTIONS'].includes(method)||headers.has('Idempotency-Key');
  const maxAttempts=Math.max(1,Math.min(3,configuredAttempts??(retrySafe?3:1)));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || appConfig.requestTimeoutMs);
    try {
      const response = await fetch(url, { ...requestOptions, headers, credentials:'omit', redirect:'error', referrerPolicy:'no-referrer', signal: controller.signal });
      const text = await response.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }
      if (!response.ok) {
        const code = typeof body?.code === 'string' ? body.code : undefined;
        const error = new ApiError(safeServiceMessage(body), response.status, code);
        if (![408, 429].includes(response.status) && response.status < 500) throw error;
        lastError = error;
        if (attempt < maxAttempts-1) {
          const retryAfter = Number(response.headers.get('Retry-After'));
          await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(30_000,retryAfter * 1000) : 500 * (2 ** attempt));
          continue;
        }
        throw error;
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError && error.status && ![408, 429].includes(error.status) && error.status < 500) throw error;
      const normalizedError = error instanceof ApiError
        ? error
        : error instanceof Error && error.name === 'AbortError'
          ? new ApiError('The request took too long. Please try again.', 408, 'TIMEOUT')
          : new ApiError('Please check your connection and try again.', undefined, 'NETWORK_ERROR');
      lastError = normalizedError;
      if (attempt < maxAttempts-1) { await wait(500 * (2 ** attempt)); continue; }
    } finally {
      clearTimeout(timeout);
    }
  }
  logger.warn('api_request_failed', { url: new URL(url).origin, error: lastError });
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError('The service is temporarily unavailable. Please try again.', undefined, 'SERVER_ERROR');
}
