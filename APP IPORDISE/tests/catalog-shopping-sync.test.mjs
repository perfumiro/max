import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/commerce/ShoppingContext.tsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const purchasableVariant='), source.indexOf('export function ShoppingProvider'));
const context = vm.createContext({ bagLineKey: (id, variant) => `${id}:${variant}` });
vm.runInContext(ts.transpileModule(`${helpers}\nglobalThis.reconcile = reconcileBag;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const product = { id: 'perfume', active: true, sizes: { '100ml': 450 }, variants: [{ id: 'perfume:100ml', sizeKey: '100ml', enabled: true, stock: null }] };
const line = { key: 'perfume:perfume:100ml', product, variantId: 'perfume:100ml', size: '100ml', quantity: 2 };

test('live removal clears a saved bag line, including removal of the final product', () => {
  assert.equal(context.reconcile([line], []).length, 0);
});

test('live publication replaces the bag product with its current price and data', () => {
  const updated = { ...product, sizes: { '100ml': 600 } };
  const [result] = context.reconcile([line], [updated]);
  assert.equal(result.product, updated);
  assert.equal(result.product.sizes['100ml'], 600);
  assert.equal(result.quantity, 2);
});

test('unpublishing a product or disabling its selected size removes its bag line', () => {
  assert.equal(context.reconcile([line], [{ ...product, active: false }]).length, 0);
  assert.equal(context.reconcile([line], [{ ...product, variants: [{ ...product.variants[0], enabled: false }] }]).length, 0);
});
