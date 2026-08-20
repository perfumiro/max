export type CustomerAuthErrorCode =
  | 'invalid_credentials'
  | 'email_unverified'
  | 'email_registered'
  | 'weak_password'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'unavailable'
  | 'invalid_link'
  | 'expired_session'
  | 'generic';

const safeMessages: Record<CustomerAuthErrorCode, string> = {
  invalid_credentials: 'The email or password is incorrect.',
  email_unverified: 'Verify your email before signing in.',
  email_registered: 'An account already exists for this email.',
  weak_password: 'Choose a stronger password.',
  rate_limited: 'Too many attempts. Please wait before trying again.',
  network: 'Check your internet connection and try again.',
  timeout: 'The request took too long. Please try again.',
  unavailable: 'Customer access is temporarily unavailable.',
  invalid_link: 'This secure link is invalid or has expired.',
  expired_session: 'Your session has expired. Sign in again.',
  generic: 'We could not complete that request.',
};

export class CustomerAuthError extends Error {
  readonly code: CustomerAuthErrorCode;
  constructor(code: CustomerAuthErrorCode) {
    super(safeMessages[code]);
    this.code = code;
    this.name = 'CustomerAuthError';
  }
}

export function classifyCustomerAuthError(status: number, body: unknown): CustomerAuthErrorCode {
  const value = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const source = String(value.msg || value.message || value.error_description || value.error || '').toLowerCase();
  if (source.includes('invalid login') || source.includes('invalid credentials')) return 'invalid_credentials';
  if (source.includes('already registered') || source.includes('already been registered')) return 'email_registered';
  if (source.includes('email not confirmed')) return 'email_unverified';
  if (status === 401 || source.includes('jwt') || source.includes('token') && source.includes('expired')) return 'expired_session';
  if (source.includes('password') && (source.includes('weak') || source.includes('characters'))) return 'weak_password';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unavailable';
  return 'generic';
}
