import { fragranceFamilyLabels, matchesFragranceFamily } from './fragranceFamilies';
import type { Product } from './sharedCatalog';

const AUDIENCE_FILTERS = ['for-men', 'for-women', 'unisex'];
const MERCHANDISING_FILTERS = new Set(['new-in', 'best-sellers', 'offers']);
const CONCENTRATION_TERMS = ['elixir', 'intense', 'intensely', 'parfum', 'eau de parfum', 'eau de toilette'];
const NOTE_STOP_WORDS = new Set(['accord', 'accords', 'absolute', 'base', 'depth', 'essence', 'heart', 'opening', 'profile', 'signature', 'technology']);
const GENERIC_NOTE_WORDS = new Set(['amber', 'citrus', 'fresh', 'musk', 'spice', 'vanilla', 'wood']);
const NAME_STOP_WORDS = new Set(['eau', 'de', 'for', 'him', 'her', 'homme', 'pour', 'spray', 'toilette', 'parfum', 'perfume', 'intense', 'intensely', 'elixir', 'with']);

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const searchableCopy = (product: Product) => normalize([
  product.name,
  product.description || '',
  product.notes?.top || '',
  product.notes?.heart || '',
  product.notes?.base || '',
].join(' '));

const meaningfulWords = (product: Product) => new Set(
  searchableCopy(product)
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 4)
);

const canonicalNoteWord = (word: string) => {
  if (/^(amber|ambery|ambergris|amberwood|amberxtreme)/.test(word)) return 'amber';
  if (/^(cedar|cedars|cedarwood)/.test(word)) return 'cedar';
  if (/^(wood|woods|woody)$/.test(word)) return 'wood';
  if (/^(vanilla|vanillin)$/.test(word)) return 'vanilla';
  if (/^(pepper|pepperwood)$/.test(word)) return 'pepper';
  return word.replace(/s$/, '');
};

const noteWords = (value?: string) => new Set(
  normalize(value || '')
    .split(/[^a-z0-9]+/)
    .map(canonicalNoteWord)
    .filter(word => word.length >= 3 && !NOTE_STOP_WORDS.has(word))
);

const allNoteWords = (product: Product) => new Set([
  ...noteWords(product.notes?.top),
  ...noteWords(product.notes?.heart),
  ...noteWords(product.notes?.base),
]);

const collectionWords = (product: Product) => {
  const brandWords = new Set(normalize(product.brand).split(/[^a-z0-9]+/));
  return new Set(normalize(product.name)
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 4 && !brandWords.has(word) && !NAME_STOP_WORDS.has(word)));
};

const audienceCompatibility = (source: Product, candidate: Product) => {
  const sourceAudience = AUDIENCE_FILTERS.filter(filter => source.filters.map(normalize).includes(filter));
  const candidateAudience = AUDIENCE_FILTERS.filter(filter => candidate.filters.map(normalize).includes(filter));
  if (!sourceAudience.length || !candidateAudience.length) return { compatible: true, exact: false };
  const exact = sourceAudience.some(audience => candidateAudience.includes(audience));
  const compatible = exact || sourceAudience.includes('unisex') || candidateAudience.includes('unisex');
  return { compatible, exact };
};

const representativePrice = (product: Product) => {
  const entries = Object.entries(product.sizes).filter(([, price]) => price > 0);
  const preferred = entries.find(([size]) => size.replace(/\s+/g, '').toLowerCase() === '100ml');
  if (preferred) return preferred[1];
  const prices = entries.map(([, price]) => price).sort((a, b) => a - b);
  return prices[Math.floor(prices.length / 2)] || 0;
};

const sharedCount = (left: Set<string>, right: Set<string>) => {
  let count = 0;
  left.forEach(value => { if (right.has(value)) count += 1; });
  return count;
};

const weightedNoteOverlap = (left: Set<string>, right: Set<string>) => {
  let score = 0;
  left.forEach(value => {
    if (right.has(value)) score += GENERIC_NOTE_WORDS.has(value) ? .45 : 1;
  });
  return score;
};

const sameHouse = (source: Product, candidate: Product) => {
  const sourceBrand = normalize(source.brand).trim();
  const candidateBrand = normalize(candidate.brand).trim();
  return sourceBrand === candidateBrand || sourceBrand.endsWith(` ${candidateBrand}`) || candidateBrand.endsWith(` ${sourceBrand}`);
};

const similarityScore = (source: Product, candidate: Product) => {
  let score = 0;
  const sourceFilters = new Set(source.filters.map(normalize));
  const candidateFilters = new Set(candidate.filters.map(normalize));
  const sourceAudiences = new Set(AUDIENCE_FILTERS.filter(filter => sourceFilters.has(filter)));
  const candidateAudiences = new Set(AUDIENCE_FILTERS.filter(filter => candidateFilters.has(filter)));

  const audienceMatches = sharedCount(sourceAudiences, candidateAudiences);
  if (audienceMatches) score += 45 * audienceMatches;

  const sourceFamilies = fragranceFamilyLabels.filter(family => matchesFragranceFamily(source, family));
  const candidateFamilies = new Set(fragranceFamilyLabels.filter(family => matchesFragranceFamily(candidate, family)));
  score += sourceFamilies.filter(family => candidateFamilies.has(family)).length * 32;

  if (sameHouse(source, candidate)) score += 32;

  const sourceNotes = allNoteWords(source);
  const candidateNotes = allNoteWords(candidate);
  score += Math.min(84, weightedNoteOverlap(sourceNotes, candidateNotes) * 24);
  score += Math.min(32, weightedNoteOverlap(noteWords(source.notes?.top), noteWords(candidate.notes?.top)) * 14);
  score += Math.min(32, weightedNoteOverlap(noteWords(source.notes?.heart), noteWords(candidate.notes?.heart)) * 14);
  score += Math.min(32, weightedNoteOverlap(noteWords(source.notes?.base), noteWords(candidate.notes?.base)) * 14);

  score += Math.min(220, sharedCount(collectionWords(source), collectionWords(candidate)) * 180);

  const sourceTraits = new Set([...sourceFilters].filter(filter => !MERCHANDISING_FILTERS.has(filter) && !AUDIENCE_FILTERS.includes(filter)));
  const candidateTraits = new Set([...candidateFilters].filter(filter => !MERCHANDISING_FILTERS.has(filter) && !AUDIENCE_FILTERS.includes(filter)));
  score += sharedCount(sourceTraits, candidateTraits) * 12;

  const sourceWords = meaningfulWords(source);
  const candidateWords = meaningfulWords(candidate);
  score += Math.min(18, sharedCount(sourceWords, candidateWords) * 3);

  const sourceCopy = searchableCopy(source);
  const candidateCopy = searchableCopy(candidate);
  score += CONCENTRATION_TERMS.filter(term => sourceCopy.includes(term) && candidateCopy.includes(term)).length * 5;

  const sourcePrice = representativePrice(source);
  const candidatePrice = representativePrice(candidate);
  if (sourcePrice && candidatePrice) {
    const difference = Math.abs(sourcePrice - candidatePrice) / sourcePrice;
    score += difference <= .2 ? 8 : difference <= .4 ? 4 : 0;
  }

  return score;
};

export function rankSimilarProducts(source: Product, catalog: Product[], limit = 10): Product[] {
  return catalog
    .filter(candidate => candidate.id !== source.id && candidate.active !== false && candidate.stockLeft !== 0 && Object.values(candidate.sizes).some(price => price > 0))
    .filter(candidate => audienceCompatibility(source, candidate).compatible)
    .map((candidate, index) => {
      const sharedNotes = sharedCount(allNoteWords(source), allNoteWords(candidate));
      const sharedFamilies = fragranceFamilyLabels.filter(family => matchesFragranceFamily(source, family) && matchesFragranceFamily(candidate, family)).length;
      const sameBrand = sameHouse(source, candidate);
      const sameCollection = sharedCount(collectionWords(source), collectionWords(candidate)) > 0;
      return { candidate, index, score: similarityScore(source, candidate), connected: sharedNotes > 0 || sharedFamilies > 0 || sameBrand || sameCollection };
    })
    .filter(result => result.connected)
    .sort((left, right) => right.score - left.score || Number(right.candidate.rating) - Number(left.candidate.rating) || left.index - right.index)
    .slice(0, limit)
    .map(result => result.candidate);
}
