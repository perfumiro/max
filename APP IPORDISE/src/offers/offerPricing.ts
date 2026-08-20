import type { Product } from '../sharedCatalog';

export type OfferVariant={size:string;price:number;original:number};

export const getOfferVariants=(product:Product):OfferVariant[]=>Object.entries(product.sizes)
  .map(([size,price])=>({size,price,original:product.originalSizes?.[size]||0}))
  .filter(item=>item.price>0&&item.original>item.price);

export const summarizeOffer=(product:Product)=>{
  const selected=getOfferVariants(product).sort((a,b)=>(b.original-b.price)-(a.original-a.price))[0];
  return selected?{...selected,saved:selected.original-selected.price,discount:Math.round((1-selected.price/selected.original)*100)}:null;
};

export const isEligibleOffer=(product:Product,now=Date.now())=>product.active
  && getOfferVariants(product).length>0
  && isOfferScheduleActive(product.offerStart||'',product.offerEnd||'',now);

const isOfferScheduleActive=(startsAt:string,endsAt:string,now:number)=>{
  const start=startsAt?Date.parse(startsAt):Number.NaN;
  const end=endsAt?Date.parse(endsAt):Number.NaN;
  return (!Number.isFinite(start)||start<=now)&&(!Number.isFinite(end)||end>=now);
};
