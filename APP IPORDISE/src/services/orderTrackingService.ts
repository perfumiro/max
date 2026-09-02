import { appConfig } from '../config';
import { normalizeMoroccanPhone, normalizeOrderNumber } from '../../supabase/functions/_shared/orderIdentity';
import { ApiError, apiRequest } from './apiClient';

export type TrackingStatus =
  | 'pending' | 'confirmed' | 'processing' | 'ready_for_dispatch'
  | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled'
  | 'return_requested' | 'returned' | 'delivery_failed';

export type TrackingTimelineEvent = { status: TrackingStatus; createdAt: string };
export type TrackedOrderItem = {
  brand?: string;
  name: string;
  image?: string;
  size?: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;
};

export type TrackedOrder = {
  orderNumber: string;
  status: TrackingStatus;
  statusLabel?: string;
  total: number;
  currency: string;
  createdAt: string;
  itemCount: number;
  city?: string;
  customerName?: string;
  deliveryAddress?: string;
  phoneMasked?: string;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  paymentMethod?: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  courierName?: string;
  items?: TrackedOrderItem[];
  statusHistory?: TrackingTimelineEvent[];
  trackingToken?: string;
};

type TrackCredential = { phone: string } | { trackingToken: string };

const TRACKING_STATUSES: ReadonlySet<string> = new Set<TrackingStatus>([
  'pending', 'confirmed', 'processing', 'ready_for_dispatch', 'shipped',
  'out_for_delivery', 'delivered', 'cancelled', 'return_requested',
  'returned', 'delivery_failed',
]);
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const optionalText = (value: unknown, maxLength = 500) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maxLength) return undefined;
  return value;
};
const finiteMoney = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ? value
  : undefined;
const validDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? value
  : undefined;

/** Runtime boundary for an untrusted network response. */
export function normalizeTrackedOrderResponse(response: unknown): TrackedOrder {
  const envelope = asRecord(response);
  const raw = asRecord(envelope?.order);
  const orderNumber = normalizeOrderNumber(raw?.orderNumber);
  const status = raw?.status;
  const total = finiteMoney(raw?.total);
  const createdAt = validDate(raw?.createdAt);
  const currency = typeof raw?.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : null;
  if (envelope?.success !== true || !raw || !orderNumber || typeof status !== 'string'
    || !TRACKING_STATUSES.has(status) || total === undefined || !createdAt || !currency) {
    throw new ApiError('Order tracking returned an invalid response. Please try again.', 502, 'INVALID_TRACKING_RESPONSE');
  }

  const items: TrackedOrderItem[] | undefined = Array.isArray(raw.items) && raw.items.length <= 100
    ? raw.items.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)).map(item => {
      const name = optionalText(item.name, 300);
      const quantity = item.quantity;
      if (!name || !Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 20) {
        throw new ApiError('Order tracking returned invalid item data. Please try again.', 502, 'INVALID_TRACKING_RESPONSE');
      }
      return {
        name,
        quantity: Number(quantity),
        brand: optionalText(item.brand, 150),
        image: optionalText(item.image, 2_048),
        size: optionalText(item.size, 100),
        unitPrice: finiteMoney(item.unitPrice),
        lineTotal: finiteMoney(item.lineTotal),
      };
    })
    : undefined;
  const statusHistory: TrackingTimelineEvent[] | undefined = Array.isArray(raw.statusHistory) && raw.statusHistory.length <= 100
    ? raw.statusHistory.flatMap(value => {
      const entry = asRecord(value);
      const entryStatus = entry?.status;
      const entryDate = validDate(entry?.createdAt);
      return typeof entryStatus === 'string' && TRACKING_STATUSES.has(entryStatus) && entryDate
        ? [{ status: entryStatus as TrackingStatus, createdAt: entryDate }]
        : [];
    })
    : undefined;
  const itemCount = raw.itemCount;
  const safeItemCount = Number.isSafeInteger(itemCount) && Number(itemCount) >= 0
    ? Number(itemCount)
    : items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const recoveredToken = envelope.trackingToken;

  return {
    orderNumber,
    status: status as TrackingStatus,
    total,
    currency,
    createdAt,
    itemCount: safeItemCount,
    statusLabel: optionalText(raw.statusLabel, 100),
    city: optionalText(raw.city, 150),
    customerName: optionalText(raw.customerName, 200),
    deliveryAddress: optionalText(raw.deliveryAddress, 600),
    phoneMasked: optionalText(raw.phoneMasked, 50),
    subtotal: finiteMoney(raw.subtotal),
    deliveryFee: finiteMoney(raw.deliveryFee),
    discount: finiteMoney(raw.discount),
    paymentMethod: optionalText(raw.paymentMethod, 100),
    estimatedDelivery: optionalText(raw.estimatedDelivery, 100),
    trackingNumber: optionalText(raw.trackingNumber, 200),
    courierName: optionalText(raw.courierName, 200),
    items,
    statusHistory,
    trackingToken: typeof recoveredToken === 'string' && TOKEN_PATTERN.test(recoveredToken) ? recoveredToken : undefined,
  };
}

async function requestTrackedOrder(orderNumber: string, credential: TrackCredential): Promise<TrackedOrder> {
  const normalizedOrder = normalizeOrderNumber(orderNumber);
  if (!normalizedOrder) throw new ApiError('Please enter a valid IPORDISE order number.', 400, 'INVALID_INPUT');
  const body=JSON.stringify({ orderNumber: normalizedOrder, ...credential });
  if(!appConfig.supabaseUrl||!appConfig.supabasePublishableKey)throw new ApiError('Order tracking is not configured yet.',500,'SERVER_ERROR');
  const response=await apiRequest<unknown>(`${appConfig.supabaseUrl}/functions/v1/track-order`,{
    method:'POST',
    headers:{apikey:appConfig.supabasePublishableKey,'Content-Type':'application/json'},
    body,
    timeoutMs:12_000,
    maxAttempts:1,
  });
  return normalizeTrackedOrderResponse(response);
}

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackedOrder> {
  const normalizedOrder = normalizeOrderNumber(orderNumber);
  const normalizedPhone = normalizeMoroccanPhone(phone);
  if (!normalizedOrder) throw new ApiError('Please enter a valid IPORDISE order number.', 400, 'INVALID_INPUT');
  if (!normalizedPhone) throw new ApiError('Please enter the Moroccan phone number used for the order.', 400, 'INVALID_INPUT');
  return requestTrackedOrder(normalizedOrder, { phone: normalizedPhone });
}

export async function trackSavedGuestOrder(orderNumber: string, trackingToken: string): Promise<TrackedOrder> {
  if (!TOKEN_PATTERN.test(trackingToken)) throw new ApiError('This saved order credential is invalid.', 400, 'INVALID_INPUT');
  return requestTrackedOrder(orderNumber, { trackingToken });
}
