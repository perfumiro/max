import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { appConfig } from '../config';
import { ApiError, apiRequest } from './apiClient';
import type { BagLine } from '../commerce/ShoppingContext';

export type CheckoutCustomer = { name: string; phone: string; email?: string; city: string; address: string };
export type CompletedOrder = { id: string; orderNumber: string; subtotal: number; deliveryFee: number; discount?: number; total: number; currency: string; status: string; paymentMethod?: string; source?: string; createdAt: string };
export type DeliveryQuote = { deliveryFee: number; currency: string; available: boolean };

const IDEMPOTENCY_STORAGE_KEY='ipordise.checkout.pending.v1';
const pendingOrderRequests=new Map<string,Promise<CompletedOrder>>();
const newIdempotencyKey=()=>globalThis.crypto?.randomUUID?.()||`order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fingerprint=(value:string)=>{let hash=2166136261;for(let index=0;index<value.length;index+=1){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);};
const checkoutOwnerKey=(accessToken:string)=>{try{const encoded=accessToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const payload=JSON.parse(globalThis.atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')));return String(payload.sub||fingerprint(accessToken));}catch{return fingerprint(accessToken);}};
type PendingAttempt={fingerprint:string;owner:string;key:string;createdAt:number};
const readPendingAttempt=async()=>{try{const raw=Platform.OS==='web'?(typeof localStorage==='undefined'?null:localStorage.getItem(IDEMPOTENCY_STORAGE_KEY)):await SecureStore.getItemAsync(IDEMPOTENCY_STORAGE_KEY);return raw?JSON.parse(raw) as PendingAttempt:null;}catch{return null;}};
const savePendingAttempt=async(value:PendingAttempt)=>{const raw=JSON.stringify(value);if(Platform.OS==='web'){if(typeof localStorage!=='undefined')localStorage.setItem(IDEMPOTENCY_STORAGE_KEY,raw);return;}await SecureStore.setItemAsync(IDEMPOTENCY_STORAGE_KEY,raw);};
const clearPendingAttempt=async()=>{try{if(Platform.OS==='web'){if(typeof localStorage!=='undefined')localStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);return;}await SecureStore.deleteItemAsync(IDEMPOTENCY_STORAGE_KEY);}catch{}};
const idempotencyKeyFor=async(payload:unknown,owner:string)=>{const currentFingerprint=fingerprint(JSON.stringify(payload));const pending=await readPendingAttempt();if(pending&&pending.owner===owner&&pending.fingerprint===currentFingerprint&&Date.now()-pending.createdAt<24*60*60*1000)return pending.key;const attempt={fingerprint:currentFingerprint,owner,key:newIdempotencyKey(),createdAt:Date.now()};await savePendingAttempt(attempt);return attempt.key;};
const normalizeCompletedOrder=(response:unknown):CompletedOrder=>{
  const envelope=response&&typeof response==='object' ? response as Record<string,any> : {};
  const raw=envelope.order&&typeof envelope.order==='object' ? envelope.order as Record<string,any> : envelope;
  const orderNumber=String(raw.orderNumber??raw.order_number??'').trim().toUpperCase();
  const total=Number(raw.total);
  if(!/^IPD?-[A-Z0-9-]{8,32}$/.test(orderNumber)||!Number.isFinite(total)||total<0){
    throw new ApiError('Your order was received, but its confirmation could not be displayed. Please use Track Order or contact IPORDISE Care.',502,'INVALID_ORDER_CONFIRMATION');
  }
  return{
    id:String(raw.id??''),
    orderNumber,
    subtotal:Math.max(0,Number(raw.subtotal)||0),
    deliveryFee:Math.max(0,Number(raw.deliveryFee??raw.delivery_fee)||0),
    discount:Math.max(0,Number(raw.discount)||0),
    total,
    currency:String(raw.currency||'MAD'),
    status:String(raw.status||'pending'),
    paymentMethod:String(raw.paymentMethod??raw.payment_method??'cash_on_delivery'),
    source:String(raw.source||(Platform.OS==='web'?'website':'mobile_app')),
    createdAt:String(raw.createdAt??raw.created_at??new Date().toISOString()),
  };
};

export async function loadDeliveryQuote(city: string, subtotal = 0): Promise<DeliveryQuote> {
  if (!appConfig.supabaseUrl || !appConfig.supabasePublishableKey) return { deliveryFee: 35, currency: 'MAD', available: true };
  const rows=await apiRequest<{value?:Record<string,any>}[]>(`${appConfig.supabaseUrl}/rest/v1/store_settings?select=value&id=eq.main&limit=1`,{headers:{apikey:appConfig.supabasePublishableKey,Accept:'application/json'},timeoutMs:10_000,maxAttempts:2});
  const settings=rows[0]?.value||{};
  const normalizedCity=city.trim().toLowerCase();
  const supported=Array.isArray(settings.supported_cities)?settings.supported_cities.map((value:unknown)=>String(value).trim().toLowerCase()):[];
  const available=!supported.length||!normalizedCity||supported.includes(normalizedCity);
  const configuredFee=Number(settings.delivery_fees?.[normalizedCity]??settings.delivery_fee??35);
  const threshold=Number(settings.free_delivery_threshold);
  return{deliveryFee:Number.isFinite(threshold)&&threshold>=0&&subtotal>=threshold?0:Math.max(0,Number.isFinite(configuredFee)?configuredFee:35),currency:String(settings.currency||'MAD'),available};
}

export async function createOrder(customer: CheckoutCustomer, bag: BagLine[], accessToken: string, notes?: string): Promise<CompletedOrder> {
  if (customer.name.trim().length < 2) throw new ApiError('Please enter your full name.');
  if (!/^(?:\+?212|0)[5-7]\d{8}$/.test(customer.phone.replace(/[\s()-]/g, ''))) throw new ApiError('Please enter a valid Moroccan phone number.');
  if (customer.city.trim().length < 2 || customer.address.trim().length < 5) throw new ApiError('Please complete your delivery address.');
  if (!bag.length) throw new ApiError('Your shopping bag is empty.');
  const normalizedCustomer={...customer,name:customer.name.trim(),phone:customer.phone.trim(),email:customer.email?.trim().toLowerCase()||null,city:customer.city.trim(),address:customer.address.trim()};
  const orderPayload={customer:normalizedCustomer,items:bag.map(line=>{
    const variant=line.product.variants?.find(item=>item.id===line.variantId);
    const displayedPrice=variant?.price||(line.size?line.product.sizes[line.size]:0);
    return{variantId:line.variantId,quantity:line.quantity,expectedUnitPriceMinor:Math.round(displayedPrice*100)};
  }),notes:notes?.trim()||null,source:Platform.OS==='web'?'website':'mobile_app'};
  const supabaseUrl=appConfig.supabaseUrl;const supabaseKey=appConfig.supabasePublishableKey;
  if(!supabaseUrl||!supabaseKey)throw new ApiError('Checkout is not configured yet.');
  const owner=accessToken.trim()?checkoutOwnerKey(accessToken):`guest:${fingerprint(normalizedCustomer.phone)}`;
  const requestFingerprint=`${owner}:${fingerprint(JSON.stringify(orderPayload))}`;
  const existing=pendingOrderRequests.get(requestFingerprint);
  if(existing)return existing;
  const request=(async()=>{
    const idempotencyKey=await idempotencyKeyFor(orderPayload,owner);
    const requestBody=JSON.stringify({idempotencyKey,...orderPayload});
    const legacyRequestBody=JSON.stringify({
      idempotencyKey,
      customer:normalizedCustomer,
      items:bag.map(line=>({productId:line.product.id,size:line.size||null,quantity:line.quantity})),
      notes:notes?.trim()||null,
    });
    const submitOrder=async(token:string,body=requestBody)=>normalizeCompletedOrder(await apiRequest<unknown>(`${supabaseUrl}/functions/v1/create-order`,{
      method:'POST',
      headers:{apikey:supabaseKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
      body,
      timeoutMs:45_000,
      maxAttempts:1,
    }));
    const submitCompatibleOrder=async(token:string)=>{
      try {
        return await submitOrder(token);
      } catch (error) {
        // Some installed clients can briefly overlap a legacy checkout function
        // during a backend rollout. That function rejects variant-only items with
        // this exact response before creating an order, so a same-key retry is safe.
        const legacyProductValidation=error instanceof ApiError
          && error.status===400
          && error.message.trim().toLowerCase()==='one or more products are invalid';
        if(!legacyProductValidation)throw error;
        return submitOrder(token,legacyRequestBody);
      }
    };
    let order:CompletedOrder;
    try {
      order=await submitCompatibleOrder(accessToken.trim());
    } catch (error) {
      // Checkout remains available to guests even when a locally cached member
      // session has expired. The rejected authenticated request cannot have
      // created an order, and the same idempotency key protects the guest retry.
      if (!(error instanceof ApiError) || error.status!==401 || !accessToken.trim()) throw error;
      order=await submitCompatibleOrder('');
    }
    await clearPendingAttempt();
    return order;
  })().finally(()=>pendingOrderRequests.delete(requestFingerprint));
  pendingOrderRequests.set(requestFingerprint,request);
  return request;
}
