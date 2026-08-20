import type { Product } from '../sharedCatalog';
import { searchProducts } from '../productSearch';
import { normalizeBrandText } from './brandDiscoveryLogic';

export type ShopBrowseIntent={filter?:string;query?:string;brand?:string};
export const minimumProductPrice=(product:Product)=>{const values=Object.values(product.sizes).filter(value=>Number.isFinite(value)&&value>0);return values.length?Math.min(...values):Number.POSITIVE_INFINITY;};
export function matchesShopIntent(product:Product,intent:ShopBrowseIntent){
  if(intent.brand)return normalizeBrandText(product.brand)===normalizeBrandText(intent.brand);
  if(intent.query)return searchProducts([product],intent.query).length>0;
  const filter=(intent.filter||'').toLowerCase();if(!filter)return true;
  if(filter.startsWith('price-under-'))return minimumProductPrice(product)<=Number(filter.replace('price-under-',''));
  if(filter==='offers')return Boolean(product.oldPrice)||product.filters.some(value=>value.toLowerCase()==='offers');
  if(filter==='best-sellers')return product.filters.some(value=>value.toLowerCase()===filter)||['BESTSELLER','TRENDING','ICONIC','TOP RATED'].includes(product.badge.toUpperCase());
  if(filter==='new-in')return product.filters.some(value=>value.toLowerCase()===filter)||product.badge.toUpperCase()==='NEW';
  return product.filters.some(value=>value.toLowerCase()===filter);
}
