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
  paymentMethod?: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  courierName?: string;
  items?: TrackedOrderItem[];
  statusHistory?: TrackingTimelineEvent[];
};

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackedOrder> {
  const normalizedOrder = normalizeOrderNumber(orderNumber);
  const normalizedPhone = normalizeMoroccanPhone(phone);
  if (!normalizedOrder) throw new ApiError('Please enter a valid IPORDISE order number.', 400, 'INVALID_INPUT');
  if (!normalizedPhone) throw new ApiError('Please enter the Moroccan phone number used for the order.', 400, 'INVALID_INPUT');
  const body=JSON.stringify({ orderNumber: normalizedOrder, phone: normalizedPhone });
  if(!appConfig.supabaseUrl||!appConfig.supabasePublishableKey)throw new ApiError('Order tracking is not configured yet.',500,'SERVER_ERROR');
  const response=await apiRequest<{success:true;order:TrackedOrder}>(`${appConfig.supabaseUrl}/functions/v1/track-order`,{
    method:'POST',
    headers:{apikey:appConfig.supabasePublishableKey,'Content-Type':'application/json'},
    body,
    timeoutMs:12_000,
    maxAttempts:1,
  });
  return response.order;
}
