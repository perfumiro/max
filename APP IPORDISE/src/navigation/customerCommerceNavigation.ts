export type ProtectedCommerceDestination = 'wishlist' | 'checkout';

const safeAppPath = (pathname: string) => pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/app';

export function protectedCommercePath(pathname: string, destination: ProtectedCommerceDestination) {
  const params = new URLSearchParams({ store: '1', page: destination });
  return `${safeAppPath(pathname)}?${params.toString()}`;
}

export function rememberProtectedCommercePath(destination: ProtectedCommerceDestination) {
  if (typeof globalThis.location === 'undefined') return;
  const nextPath = protectedCommercePath(globalThis.location.pathname, destination);
  const currentPath = `${globalThis.location.pathname}${globalThis.location.search}`;
  if (currentPath !== nextPath) (globalThis as any).history?.replaceState({}, '', nextPath);
}

export function clearProtectedCommercePath() {
  if (typeof globalThis.location === 'undefined') return;
  const url = new URL(globalThis.location.href);
  if (!url.searchParams.has('page') && !url.searchParams.has('returnTo')) return;
  url.searchParams.delete('page');
  url.searchParams.delete('returnTo');
  const query = url.searchParams.toString();
  (globalThis as any).history?.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}`);
}
