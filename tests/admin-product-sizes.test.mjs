import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const start = script.indexOf('const normalizeAdminProduct =');
const end = script.indexOf('snap.forEach(docSnap =>', start);
const normalize = vm.runInNewContext(script.slice(start, end) + '\nnormalizeAdminProduct;');

test('published decant-only products retain their priced sizes on the website', () => {
  const product = normalize({ name: 'Sample fragrance', brand: 'IPORDISE', sizes: { '5 ML': 70, '10ml': 120, '30': 250 } });
  assert.deepEqual(JSON.parse(JSON.stringify(product.sizes)), { '5ml': 70, '10ml': 120, '30ml': 250 });
  assert.ok(Object.values(product.sizes).some(price => price > 0));
});

test('mixed decant and bottle sizes match the admin catalog', () => {
  const product = normalize({ name: 'Fragrance', sizes: { '10ml': '100', '50 ML': 450, '100ml': 800 } });
  assert.deepEqual(JSON.parse(JSON.stringify(product.sizes)), { '10ml': 100, '50ml': 450, '100ml': 800 });
});

test('invalid sizes and prices do not generate invented bottle options', () => {
  const product = normalize({ name: 'Fragrance', sizes: { nope: 20, '0ml': 50, '10ml': -5, '100ml': 'invalid' } });
  assert.deepEqual(JSON.parse(JSON.stringify(product.sizes)), {});
});
