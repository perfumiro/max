export const normalizeProductSearch = value => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/['’`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();

export const matchesProductSearch = (value, query) => {
  const text = normalizeProductSearch(value);
  return normalizeProductSearch(query).split(' ').filter(Boolean).every(term => text.includes(term));
};
