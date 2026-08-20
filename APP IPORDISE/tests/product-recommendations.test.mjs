import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/productRecommendations.ts', import.meta.url), 'utf8')
  .replace(
    "import { fragranceFamilyLabels, matchesFragranceFamily } from './fragranceFamilies';",
    `const fragranceFamilyLabels=['Fresh','Floral','Woody','Amber','Citrus','Sweet'];
     const familyTerms={Fresh:['fresh','marine','aquatic'],Floral:['iris','rose','jasmine'],Woody:['wood','cedar','vetiver'],Amber:['amber','spice','leather'],Citrus:['bergamot','lemon','citrus'],Sweet:['vanilla','tonka','caramel']};
     const matchesFragranceFamily=(product,family)=>familyTerms[family].some(term=>[product.name,product.description,product.notes?.top,product.notes?.heart,product.notes?.base].join(' ').toLowerCase().includes(term));`,
  );
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(module,exports){${js}})(module,module.exports)`, { module });
const { rankSimilarProducts } = module.exports;

const product = (id, overrides = {}) => ({
  id,
  brand: 'HOUSE',
  name: id,
  price: '900 MAD',
  oldPrice: '',
  badge: '',
  rating: '4.8',
  reviewCount: 0,
  image: {},
  gallery: [],
  sizes: { '100ml': 900 },
  filters: ['for-men'],
  active: true,
  stockLeft: 5,
  ...overrides,
});

test('recommendations prioritize shared notes over generic price or audience matches', () => {
  const current = product('dior-homme-intense', { brand: 'DIOR', notes: { top: 'Iris', heart: 'Amber', base: 'Cedar' } });
  const close = product('gentleman-private-reserve', { brand: 'GIVENCHY', notes: { top: 'Airy iris', heart: 'Whisky', base: 'Amber woods' } });
  const sameBrandButDifferentScent = product('dior-aquatic', { brand: 'DIOR', notes: { top: 'Marine salt', heart: 'Mint', base: 'Clean musk' } });
  const random = product('unrelated', { notes: { top: 'Marine salt', heart: 'Mint', base: 'Clean musk' } });

  const ranked = rankSimilarProducts(current, [random, sameBrandButDifferentScent, close], 6);
  assert.equal(ranked[0].id, close.id);
  assert.equal(ranked.some(item => item.id === random.id), false);
});

test('recommendations never cross a defined men/women audience and stay concise', () => {
  const current = product('source', { notes: { top: 'Iris', heart: 'Amber', base: 'Cedar' } });
  const wrongAudience = product('women-copy', { filters: ['for-women'], notes: current.notes });
  const matches = Array.from({ length: 9 }, (_, index) => product(`match-${index}`, { notes: { top: 'Iris', heart: 'Amber', base: 'Wood' } }));
  const ranked = rankSimilarProducts(current, [wrongAudience, ...matches], 6);

  assert.equal(ranked.length, 6);
  assert.equal(ranked.some(item => item.id === wrongAudience.id), false);
});

test('a fragrance from the same collection is treated as the closest sibling', () => {
  const current = product('stronger-intensely', { brand: 'EMPORIO ARMANI', name: 'Stronger With You Intensely', notes: { top: 'Pepper', heart: 'Vanilla', base: 'Amber woods' } });
  const sibling = product('stronger-absolutely', { brand: 'ARMANI', name: 'Stronger With You Absolutely', notes: { top: 'Rum', heart: 'Lavender', base: 'Smoke' } });
  const notesOnly = product('other', { notes: { top: 'Pepper', heart: 'Vanilla', base: 'Amber woods' } });
  assert.equal(rankSimilarProducts(current, [notesOnly, sibling], 6)[0].id, sibling.id);
});

test('product page requests six scent-led suggestions', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /rankSimilarProducts\(product, recommendations, 6\)/);
});
