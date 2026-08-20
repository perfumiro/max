export function mergeCatalogProducts<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const merged = new Map(secondary.map(product => [product.id, product]));
  primary.forEach(product => merged.set(product.id, product));
  return [...merged.values()];
}
