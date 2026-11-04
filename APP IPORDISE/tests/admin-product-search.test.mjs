import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { matchesProductSearch } from '../../assets/admin/product-search.mjs';

const staticSource = readFileSync(new URL('../../assets/admin/admin.js', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/adminService.ts', import.meta.url), 'utf8');
const rows = Array.from({ length: 201 }, (_, index) => ({ id: `perfume-${index}`, name: `Perfume ${index}`, active: index !== 200 }));

test('product search finds names, brands and IDs with accents, punctuation and reordered words', () => {
  const text = "Unique’e Luxury Café Rose perfume-201";
  for (const query of ['cafe', 'rose uniquee', 'PERFUME-201', '  luxury   cafe  ', '']) {
    assert.equal(matchesProductSearch(text, query), true, query);
  }
  assert.equal(matchesProductSearch(text, 'missing'), false);
});

test('website admin retrieves all pages, including older inactive products, with its source filter', async () => {
  const calls = [];
  const context = vm.createContext({ URLSearchParams, auth: { currentUser: { getIdToken: async () => 'staff' } },
    SUPABASE_SYNC_URL: 'https://test/catalog', SUPABASE_PUBLISHABLE_KEY: 'public',
    fetch: async (url, options) => {
      const params = new URL(url).searchParams;
      calls.push(Number(params.get('page')));
      assert.equal(params.get('source'), 'admin');
      assert.equal(options.headers.Authorization, 'Bearer staff');
      const start = (Number(params.get('page')) - 1) * 100;
      return { ok: true, status: 200, json: async () => ({ products: rows.slice(start, start + 100), pagination: { total: rows.length } }) };
    },
  });
  vm.runInContext(staticSource.slice(staticSource.indexOf('const fetchSupabaseAdminProducts ='), staticSource.indexOf('// Product variants are the live source')) + '\nglobalThis.load = fetchSupabaseAdminProducts;', context);
  const products = await context.load('admin');
  assert.equal(products.length, 201);
  assert.equal(products.at(-1).active, false);
  assert.deepEqual(calls, [1, 2, 3]);
});

test('app admin retrieves the entire catalog instead of searching only its first 100 products', async () => {
  const calls = [];
  const context = vm.createContext({
    loadAdminPage: async (_session, endpoint, field, pageSize, { page }) => {
      assert.equal(endpoint, 'admin-catalog-sync');
      assert.equal(field, 'products');
      calls.push(page);
      return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length };
    },
  });
  const source = service.slice(service.indexOf('const loadAdminCatalog ='), service.indexOf('const loadLegacyAdminOrders ='));
  vm.runInContext(ts.transpileModule(source + '\nglobalThis.load = loadAdminCatalog;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const result = await context.load({});
  assert.equal(result.items.length, 201);
  assert.equal(result.items.at(-1).id, 'perfume-200');
  assert.deepEqual(calls, [1, 2, 3]);
});

test('admin-added search hides other cards without replacing their editable fields and clears correctly', () => {
  const cards = [
    { dataset: { productSearch: 'Dior Sauvage dior-sauvage' }, style: {}, editValue: '125' },
    { dataset: { productSearch: 'Unique’e Luxury Café Rose' }, style: {}, editValue: '250' },
  ];
  const input = { value: 'cafe' }, count = {}, empty = {};
  const section = { querySelectorAll: () => cards, querySelector: selector => selector.includes('count') ? count : empty };
  const context = vm.createContext({ matchesProductSearch, document: { getElementById: id => id === 'productsSearch' ? input : section } });
  vm.runInContext(staticSource.slice(staticSource.indexOf('const applyAdminAddedProductSearch ='), staticSource.indexOf('const loadProductsView =')) + '\nglobalThis.apply = applyAdminAddedProductSearch;', context);
  context.apply();
  assert.equal(cards[0].style.display, 'none');
  assert.equal(cards[1].style.display, 'flex');
  assert.equal(cards[1].editValue, '250');
  assert.equal(count.textContent, '1 of 2 products');
  input.value = 'no matching product'; context.apply(); assert.equal(empty.hidden, false);
  input.value = ''; context.apply();
  assert.ok(cards.every(card => card.style.display === 'flex'));
  assert.equal(empty.hidden, true);
});
