export type NormalizedPushPermission = 'notDetermined' | 'granted' | 'denied' | 'provisional' | 'unavailable';
export function normalizePushPermission(input: { available: boolean; granted: boolean; status: string; provisional?: boolean }): NormalizedPushPermission {
  if (!input.available) return 'unavailable';
  if (input.provisional) return 'provisional';
  if (input.granted || input.status === 'granted') return 'granted';
  if (input.status === 'denied') return 'denied';
  return 'notDetermined';
}
export const shouldShowNotificationInvitation = (status: NormalizedPushPermission, seen: boolean) => status === 'notDetermined' && !seen;
export const safeNotificationProductId = (data: Record<string, unknown> | null | undefined) => {
  const id = typeof data?.productId === 'string' ? data.productId.trim() : '';
  return id && /^[a-z0-9_.:-]{1,160}$/i.test(id) ? id : null;
};
export const shouldScheduleNewProduct = (wasPublished: boolean, isPublished: boolean) => !wasPublished && isPublished;
export const shouldDeliverNewProduct = (device: { enabled: boolean; newProductsEnabled: boolean }) => device.enabled && device.newProductsEnabled;
