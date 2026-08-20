import type { Product } from '../sharedCatalog';
import type { BagLine } from './ShoppingContext';

export const bagLineKey = (productId: string, variantId?: string) => variantId?.startsWith(`${productId}:`) ? variantId : `${productId}:${variantId || 'default'}`;

export function addBagLine(lines: BagLine[], product: Product, size?: string): BagLine[] {
  const normalizedSize=String(size||'').toLowerCase().replace(/\s+/g,'');
  const availableVariants=(product.variants||[]).filter(variant=>variant.enabled&&(variant.stock===null||variant.stock>0));
  const selectedVariant=availableVariants.find(variant=>variant.sizeKey===normalizedSize)
    ||availableVariants.find(variant=>variant.sizeKey==='100ml')||availableVariants[0];
  const selectedSize=selectedVariant?.sizeKey||normalizedSize||Object.keys(product.sizes||{})[0]||'default';
  const variantId=selectedVariant?.id||`${product.id}:${selectedSize}`;
  const key = bagLineKey(product.id, variantId);
  const existing = lines.find(line => line.key === key);
  if (!existing) return [...lines, { key, product, variantId, size:selectedSize, quantity: 1 }];
  return lines.map(line => line.key === key ? { ...line, quantity: line.quantity + 1 } : line);
}

export const removeBagLine = (lines: BagLine[], key: string) => lines.filter(line => line.key !== key);

export const updateBagLineQuantity = (lines: BagLine[], key: string, quantity: number) => quantity <= 0
  ? removeBagLine(lines, key)
  : lines.map(line => line.key === key ? { ...line, quantity: Math.min(20, Math.max(1, Math.floor(quantity))) } : line);

export const countBagItems = (lines: BagLine[]) => lines.reduce((total, line) => total + line.quantity, 0);
