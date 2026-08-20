import type { ImageSourcePropType } from 'react-native';
import type { Product } from '../sharedCatalog';

export type BrandDiscoveryItem = {
  label: string;
  count: number;
  sampleImage?: ImageSourcePropType;
};

export type BrandDiscoveryState = 'loading' | 'error' | 'empty' | 'ready';

export function normalizeBrandText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLocaleLowerCase();
}

export function formatBrandProductCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function resolveBrandDiscoveryState(loading: boolean, error: boolean, itemCount: number, query: string, totalItemCount = itemCount): BrandDiscoveryState {
  if (loading && totalItemCount === 0) return 'loading';
  if (error && totalItemCount === 0) return 'error';
  if (itemCount === 0) return 'empty';
  return 'ready';
}

export function filterBrandDiscoveryItems(items: BrandDiscoveryItem[], query: string): BrandDiscoveryItem[] {
  const search = normalizeBrandText(query);
  return search ? items.filter(item => normalizeBrandText(item.label).includes(search)) : items;
}

export function buildBrandDiscoveryItems(products: Product[], featuredBrands: string[], query: string): BrandDiscoveryItem[] {
  const records = new Map<string, { label: string; count: number; sampleImage?: ImageSourcePropType }>();
  products.forEach(product => {
    const label = product.brand.trim().replace(/\s+/g, ' ');
    const key = normalizeBrandText(label);
    if (!key || product.active === false) return;
    const current = records.get(key);
    records.set(key, {
      label: current?.label || label,
      count: (current?.count || 0) + 1,
      sampleImage: current?.sampleImage || product.image,
    });
  });
  const preferred = featuredBrands.map(normalizeBrandText).filter(key => records.has(key));
  const ordered = [...new Set([...preferred, ...[...records.keys()].sort((a, b) => records.get(a)!.label.localeCompare(records.get(b)!.label))])];
  return filterBrandDiscoveryItems(ordered.map(key => records.get(key)!), query);
}
