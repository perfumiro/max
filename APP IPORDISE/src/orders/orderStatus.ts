import type { TrackingStatus } from '../services/orderTrackingService';

export const ORDER_TIMELINE: readonly { id: TrackingStatus; label: string }[] = [
  { id: 'pending', label: 'Order received' },
  { id: 'confirmed', label: 'Order confirmed' },
  { id: 'processing', label: 'Preparing your perfume' },
  { id: 'ready_for_dispatch', label: 'Ready for dispatch' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'delivered', label: 'Delivered' },
];

export const ORDER_STATUS_LABELS: Record<TrackingStatus, string> = {
  pending: 'Order received',
  confirmed: 'Order confirmed',
  processing: 'Preparing your perfume',
  ready_for_dispatch: 'Ready for dispatch',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned',
  delivery_failed: 'Delivery issue',
};

export const timelineStatus = (status: TrackingStatus): TrackingStatus =>
  status === 'return_requested' || status === 'returned'
    ? 'delivered'
    : status === 'delivery_failed'
      ? 'shipped'
      : status;
