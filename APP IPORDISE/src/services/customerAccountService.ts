import { appConfig } from '../config';

export type CustomerProfile = { user_id: string; email?: string; first_name?: string; last_name?: string; display_name?: string; phone?: string; locale?: string; currency?: string; avatar_url?: string; marketing_consent?: boolean; default_address_id?: string | null };
export type CustomerAddress = { id: string; label: string; recipient_name: string; recipient_first_name?: string | null; recipient_last_name?: string | null; phone: string; country?: string; address_line1: string; address_line2?: string | null; building?: string | null; apartment?: string | null; city: string; region?: string | null; postal_code?: string | null; delivery_instructions?: string | null; latitude?: number | null; longitude?: number | null; is_default: boolean };
export type CustomerOrderItem = { productId?: string; name?: string; brand?: string; image?: string; size?: string; quantity?: number; unitPrice?: number; lineTotal?: number };
export type CustomerOrderSummary = { id: string; order_number: string; status: string; subtotal?: number; delivery_fee?: number; discount?: number; total: number; currency: string; payment_method?: string; customer?: Record<string, unknown>; customer_snapshot?: Record<string, unknown>; shipping_address?: Record<string, unknown>; courier_name?: string | null; tracking_number?: string | null; tracking_url?: string | null; estimated_delivery?: string | null; created_at: string; items?: CustomerOrderItem[]; order_status_history?: {to_status:string;created_at:string}[] };
export type NotificationPreferences = { order_updates: boolean; security_alerts: boolean; back_in_stock: boolean; wishlist_price_changes: boolean; new_products: boolean; offers_marketing: boolean };
export type CustomerAccountSection = 'profile' | 'orders' | 'addresses' | 'preferences';
type CustomerAccountData=Awaited<ReturnType<typeof fetchCustomerAccount>>;
const accountCache=new Map<string,{until:number;data:CustomerAccountData}>();
const accountRequests=new Map<string,Promise<CustomerAccountData>>();

async function rest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new Error('Account data is temporarily unavailable.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), appConfig.requestTimeoutMs);
  try {
    const response = await fetch(`${appConfig.supabaseUrl}/rest/v1/${path}`, { ...init, signal:controller.signal, headers: { apikey: appConfig.supabasePublishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers } });
    if (!response.ok) throw new Error('Account data is temporarily unavailable.');
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  } catch (error) {
    if (error instanceof Error && error.message === 'Account data is temporarily unavailable.') throw error;
    throw new Error('The connection timed out. Check your internet connection and try again.');
  } finally { clearTimeout(timeout); }
}

async function fetchCustomerAccount(token: string) {
  const sections: CustomerAccountSection[] = ['profile', 'orders', 'addresses', 'preferences'];
  const results = await Promise.allSettled([
    rest<CustomerProfile[]>('profiles?select=*&limit=1', token),
    rest<CustomerOrderSummary[]>('orders?select=id,order_number,status,subtotal,delivery_fee,total,currency,payment_method,customer,created_at,items&order=created_at.desc&limit=50', token),
    rest<CustomerAddress[]>('customer_addresses?select=*&order=is_default.desc,created_at.desc', token),
    rest<NotificationPreferences[]>('notification_preferences?select=*&limit=1', token),
  ]);
  const unavailable = sections.filter((_, index) => results[index].status === 'rejected');
  if (unavailable.length === sections.length) {
    const failure = results.find(result => result.status === 'rejected');
    throw failure?.reason instanceof Error ? failure.reason : new Error('Account data is temporarily unavailable.');
  }
  const profiles = results[0].status === 'fulfilled' ? results[0].value : undefined;
  const orders = results[1].status === 'fulfilled' ? results[1].value : undefined;
  const addresses = results[2].status === 'fulfilled' ? results[2].value : undefined;
  const preferences = results[3].status === 'fulfilled' ? results[3].value : undefined;
  return {
    profile: profiles ? profiles[0] || null : undefined,
    orders,
    addresses,
    preferences: preferences ? preferences[0] || null : undefined,
    unavailable,
  };
}

export async function loadCustomerAccount(token:string,force=false){
  const cached=accountCache.get(token);
  if(!force&&cached&&cached.until>Date.now())return cached.data;
  const pending=accountRequests.get(token);
  if(pending)return pending;
  const request=fetchCustomerAccount(token).then(data=>{
    // Never cache a partial outage: the Retry action must make a real request
    // as soon as the missing table or transient API failure is repaired.
    if(data.unavailable.length===0){
      accountCache.set(token,{data,until:Date.now()+60_000});
      while(accountCache.size>2)accountCache.delete(accountCache.keys().next().value!);
    }else accountCache.delete(token);
    return data;
  }).finally(()=>accountRequests.delete(token));
  accountRequests.set(token,request);
  return request;
}

export async function loadCustomerOrders(token:string){
  const orders=await rest<CustomerOrderSummary[]>('orders?select=id,order_number,status,subtotal,delivery_fee,total,currency,payment_method,customer,created_at,items&order=created_at.desc&limit=50',token);
  const cached=accountCache.get(token);
  if(cached)accountCache.set(token,{...cached,data:{...cached.data,orders,unavailable:cached.data.unavailable.filter(section=>section!=='orders')}});
  return orders;
}

const invalidateCustomerAccount=(token:string)=>accountCache.delete(token);

export async function saveCustomerProfile(token: string, patch: Partial<CustomerProfile>) {
  const avatarUrl = patch.avatar_url?.trim();
  if (avatarUrl && !/^https:\/\//i.test(avatarUrl)) throw new Error('Profile photo must use a secure HTTPS link.');
  const allowed = Object.fromEntries(Object.entries({ first_name: patch.first_name?.trim(), last_name: patch.last_name?.trim(), display_name: patch.display_name?.trim(), phone: patch.phone?.trim(), locale: patch.locale, currency: patch.currency, avatar_url: avatarUrl === undefined ? undefined : avatarUrl || null, marketing_consent: patch.marketing_consent, default_address_id: patch.default_address_id }).filter(([,value])=>value!==undefined));
  const [profile] = await rest<CustomerProfile[]>('profiles?on_conflict=user_id', token, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(allowed) });
  invalidateCustomerAccount(token);return profile;
}

export async function saveCustomerAddress(token: string, address: Omit<CustomerAddress, 'id'> & { id?: string }) {
  const path = address.id ? `customer_addresses?id=eq.${encodeURIComponent(address.id)}` : 'customer_addresses';
  const method = address.id ? 'PATCH' : 'POST';
  const [saved] = await rest<CustomerAddress[]>(path, token, { method, body: JSON.stringify(address) });
  invalidateCustomerAccount(token);return saved;
}

export async function deleteCustomerAddress(token: string, id: string) { await rest(`customer_addresses?id=eq.${encodeURIComponent(id)}`, token, { method: 'DELETE' });invalidateCustomerAccount(token); }
export async function saveNotificationPreferences(token: string, preferences: Partial<NotificationPreferences>) { await rest('notification_preferences?on_conflict=user_id', token, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(preferences) });invalidateCustomerAccount(token); }
export async function requestDataExport(token: string) { await rest('data_export_requests', token, { method: 'POST', body: '{}' }); }
export async function deleteCustomerAccount(token: string) {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) throw new Error('Account deletion is temporarily unavailable.');
  const response = await fetch(`${appConfig.supabaseUrl}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { apikey: appConfig.supabasePublishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.deleted !== true) throw new Error('Account deletion could not be confirmed.');
}

export async function loadCustomerShoppingState(token: string) {
  const [wishlist, carts] = await Promise.all([
    rest<{ product_id: string }[]>('customer_wishlist?select=product_id', token),
    rest<{ items: { productId: string; variantId?: string; size?: string; quantity: number }[] }[]>('customer_carts?select=items&limit=1', token),
  ]);
  return { favouriteIds: wishlist.map(item => item.product_id), bag: Array.isArray(carts[0]?.items) ? carts[0].items : [] };
}

export async function saveCustomerShoppingState(token: string, favouriteIds: string[], bag: { productId: string; variantId: string; size?: string; quantity: number }[]) {
  const current = await rest<{ product_id: string }[]>('customer_wishlist?select=product_id', token);
  const wanted = new Set(favouriteIds);
  const remove = current.filter(item => !wanted.has(item.product_id)).map(item => item.product_id);
  await Promise.all([
    remove.length ? rest(`customer_wishlist?product_id=in.(${remove.map(encodeURIComponent).join(',')})`, token, { method:'DELETE' }) : Promise.resolve(),
    favouriteIds.length ? rest('customer_wishlist', token, { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(favouriteIds.map(product_id => ({ product_id }))) }) : Promise.resolve(),
    rest('customer_carts?on_conflict=user_id', token, { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify({ items:bag }) }),
  ]);
}
