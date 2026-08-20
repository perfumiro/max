export type BestsellerOrder = {
  status?: string;
  items?: { productId?: string; name?: string; quantity?: number; qty?: number }[];
};

export const bestsellerNameKey=(name:string)=>`name:${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}`;

export function rankBestsellerProductIds(orders: BestsellerOrder[]): string[] {
  const quantities = new Map<string, number>();
  orders.forEach(order => {
    if (order.status === 'cancelled' || !Array.isArray(order.items)) return;
    order.items.forEach(item => {
      const productId = String(item.productId || '').trim();
      const productKey = productId || (String(item.name || '').trim() ? bestsellerNameKey(String(item.name)) : '');
      const quantity = Math.max(0, Number(item.quantity ?? item.qty ?? 1) || 0);
      if (productKey && quantity) quantities.set(productKey, (quantities.get(productKey) || 0) + quantity);
    });
  });
  return [...quantities.entries()]
    .sort(([firstId, firstQuantity], [secondId, secondQuantity]) => secondQuantity - firstQuantity || firstId.localeCompare(secondId))
    .map(([productId]) => productId);
}
