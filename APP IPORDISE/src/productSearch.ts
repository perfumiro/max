export type SearchableProduct = {
  id: string;
  brand: string;
  name: string;
  badge?: string;
  filters?: string[];
  description?: string;
  ingredients?: string;
  accords?: string[];
  notes?: Record<string, string | undefined>;
};

export const normalizeSearchText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/['’`]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase();

const editDistanceWithin = (left: string, right: string, maximum: number) => {
  if (Math.abs(left.length - right.length) > maximum) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const value = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + Number(left[row - 1] !== right[column - 1]));
      current[column] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maximum) return false;
    previous = current;
  }
  return previous[right.length] <= maximum;
};

const ignoredTerms = new Set(['a', 'an', 'and', 'de', 'des', 'du', 'et', 'for', 'fragrance', 'fragrances', 'la', 'le', 'les', 'of', 'parfum', 'parfums', 'perfume', 'perfumes', 'pour', 'scent', 'scents', 'the', 'un', 'une']);
const searchAliases: Record<string, string[]> = {
  homme: ['homme', 'hommes', 'men', 'man', 'male', 'masculin', 'for men', 'رجال', 'رجالي'],
  hommes: ['homme', 'hommes', 'men', 'man', 'male', 'masculin', 'for men', 'رجال', 'رجالي'],
  men: ['men', 'man', 'male', 'homme', 'hommes', 'masculin', 'for men', 'رجال', 'رجالي'],
  رجال: ['رجال', 'رجالي', 'men', 'man', 'male', 'homme', 'for men'],
  رجالي: ['رجال', 'رجالي', 'men', 'man', 'male', 'homme', 'for men'],
  femme: ['femme', 'femmes', 'women', 'woman', 'female', 'feminin', 'for women', 'نساء', 'نسائي'],
  femmes: ['femme', 'femmes', 'women', 'woman', 'female', 'feminin', 'for women', 'نساء', 'نسائي'],
  women: ['women', 'woman', 'female', 'femme', 'femmes', 'feminin', 'for women', 'نساء', 'نسائي'],
  نساء: ['نساء', 'نسائي', 'women', 'woman', 'female', 'femme', 'for women'],
  نسائي: ['نساء', 'نسائي', 'women', 'woman', 'female', 'femme', 'for women'],
  nouveaute: ['nouveaute', 'nouveautes', 'new', 'new in', 'new arrivals', 'recent'],
  nouveautes: ['nouveaute', 'nouveautes', 'new', 'new in', 'new arrivals', 'recent'],
  new: ['new', 'new in', 'new arrivals', 'nouveaute', 'nouveautes', 'recent'],
  promo: ['promo', 'promotion', 'promotions', 'offer', 'offers', 'sale', 'discount', 'deal'],
  promotion: ['promo', 'promotion', 'promotions', 'offer', 'offers', 'sale', 'discount', 'deal'],
  offre: ['offre', 'offres', 'offer', 'offers', 'promo', 'promotion', 'sale', 'discount'],
  offres: ['offre', 'offres', 'offer', 'offers', 'promo', 'promotion', 'sale', 'discount'],
  cadeau: ['cadeau', 'cadeaux', 'gift', 'gifts', 'gift sets', 'discovery sets'],
  cadeaux: ['cadeau', 'cadeaux', 'gift', 'gifts', 'gift sets', 'discovery sets'],
  luxe: ['luxe', 'luxury', 'niche', 'exclusive'],
};

const termAlternatives = (term: string) => {
  const values = new Set([term, ...(searchAliases[term] || [])]);
  if (term.length > 4 && term.endsWith('s')) values.add(term.slice(0, -1));
  if (term.length > 5 && term.endsWith('es')) values.add(term.slice(0, -2));
  return [...values];
};

type SearchFields = { brand: string; name: string; details: string; all: string; brandWords: string[]; nameWords: string[]; detailWords: string[] };
const searchFieldCache = new WeakMap<object, SearchFields>();

const searchableFields = (product: SearchableProduct): SearchFields => {
  const cached = searchFieldCache.get(product as object);
  if (cached) return cached;
  const brand = normalizeSearchText(product.brand);
  const name = normalizeSearchText(product.name);
  const details = normalizeSearchText([product.id, product.badge, ...(product.filters || []), product.description, product.ingredients, ...(product.accords || []), ...Object.values(product.notes || {})].join(' '));
  const fields = {
    brand,
    name,
    details,
    all: `${brand} ${name} ${details}`.trim(),
    brandWords: brand.split(' ').filter(Boolean),
    nameWords: name.split(' ').filter(Boolean),
    detailWords: details.split(' ').filter(Boolean),
  };
  searchFieldCache.set(product as object, fields);
  return fields;
};

const singleTermScore = (term: string, fields: SearchFields): number => {
  if (fields.brand === term) return 140;
  if (fields.name === term) return 135;
  if (fields.brandWords.includes(term)) return 110;
  if (fields.nameWords.includes(term)) return 105;
  if (fields.brand.startsWith(term)) return 95;
  if (fields.name.startsWith(term)) return 90;
  if (fields.detailWords.includes(term)) return 68;
  if (fields.brandWords.some(word => word.startsWith(term))) return 62;
  if (fields.nameWords.some(word => word.startsWith(term))) return 58;
  if (fields.detailWords.some(word => word.startsWith(term))) return 44;
  if (fields.all.includes(term)) return 34;
  const maximumDistance = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
  if (maximumDistance && [...fields.brandWords, ...fields.nameWords].some(word => editDistanceWithin(term, word, maximumDistance))) return 26;
  if (maximumDistance && fields.detailWords.some(word => editDistanceWithin(term, word, maximumDistance))) return 15;
  return 0;
};

const termScore = (term: string, fields: SearchFields) => Math.max(...termAlternatives(term).map(alternative => singleTermScore(alternative, fields)));

export function searchProducts<T extends SearchableProduct>(products: T[], query: string): T[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return products;
  const rawTerms = [...new Set(normalized.split(' ').filter(Boolean))];
  const meaningfulTerms = rawTerms.filter(term => !ignoredTerms.has(term));
  const terms = meaningfulTerms.length ? meaningfulTerms : rawTerms;
  return products.map((product, index) => {
    const fields = searchableFields(product);
    const scores = terms.map(term => termScore(term, fields));
    const phraseBonus = fields.name.includes(normalized) ? 100 : fields.brand.includes(normalized) ? 90 : fields.all.includes(normalized) ? 45 : 0;
    return { product, index, score: scores.reduce<number>((sum, value) => sum + value, 0) + phraseBonus, matched: scores.every(value => value > 0) };
  }).filter(result => result.matched).sort((a, b) => b.score - a.score || a.index - b.index).map(result => result.product);
}
