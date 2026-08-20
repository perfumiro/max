const PRODUCTION_ORIGIN = 'https://ipordise.com';
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  'https://www.ipordise.com',
  'https://admin.ipordise.com',
  'https://ipordise-app.vercel.app',
  'http://localhost:3000',
  'http://localhost:8000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
]);

export const requestOrigin = (request: Request) => request.headers.get('Origin');
export const originAllowed = (origin: string | null) => !origin || ALLOWED_ORIGINS.has(origin);

export function apiHeaders(origin: string | null, methods: string) {
  return {
    ...(originAllowed(origin) ? { 'Access-Control-Allow-Origin': origin || PRODUCTION_ORIGIN } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    // These APIs are intentionally consumed by the separately hosted
    // ipordise.com web app. CORS still restricts access to ALLOWED_ORIGINS;
    // CORP must permit that approved cross-site response.
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    Vary: 'Origin',
  };
}

export function apiJson(body: unknown, status: number, origin: string | null, methods: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...apiHeaders(origin, methods), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function rejectUntrustedOrigin(origin: string | null, requestId: string, methods: string) {
  return originAllowed(origin) ? null : apiJson({ error: 'Origin is not allowed', code: 'ORIGIN_NOT_ALLOWED', requestId }, 403, origin, methods);
}

export function rejectNonJson(request: Request, origin: string | null, requestId: string, methods: string) {
  const mediaType = request.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' ? null : apiJson({ error: 'Content-Type must be application/json', code: 'UNSUPPORTED_MEDIA_TYPE', requestId }, 415, origin, methods);
}

export async function readJsonObject(request: Request, maximumBytes: number) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maximumBytes) return { error: 'too_large' as const, value: null };
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maximumBytes) return { error: 'too_large' as const, value: null };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'invalid' as const, value: null };
    return { error: null, value: value as Record<string, any> };
  } catch {
    return { error: 'invalid' as const, value: null };
  }
}

export function bearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  const token = match?.[1] || '';
  return token.length >= 20 && token.length <= 8192 ? token : null;
}

export async function hashedRateKey(request: Request, scope: string) {
  const address = request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${address}:${scope}`));
  return `api:${Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export async function consumeRateLimit(admin: any, request: Request, scope: string, maximumHits: number, windowSeconds: number) {
  const { data, error } = await admin.rpc('consume_api_rate_limit', {
    rate_key: await hashedRateKey(request, scope),
    maximum_hits: maximumHits,
    window_seconds: windowSeconds,
  });
  if (error) throw error;
  return Boolean(data);
}

export type VerifiedStaff = { uid: string; email: string };

export async function verifyFirebaseStaff(authorization: string | null): Promise<VerifiedStaff | null> {
  const idToken = bearerToken(authorization);
  if (!idToken) return null;
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY')?.trim();
  const allowedEmails = new Set((Deno.env.get('ADMIN_EMAILS') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  if (!apiKey || allowedEmails.size === 0) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const user = payload.users?.[0];
    const email = String(user?.email || '').trim().toLowerCase();
    const uid = String(user?.localId || '').trim();
    if (!uid || !allowedEmails.has(email) || user?.emailVerified !== true || user?.disabled === true) return null;
    return { uid, email };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
