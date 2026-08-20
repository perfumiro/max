import assert from 'node:assert/strict';
import test from 'node:test';
import { addBagLine, bagLineKey, countBagItems, removeBagLine, updateBagLineQuantity } from '../src/commerce/shoppingState.ts';

const product = { id: 'scent-1', name: 'Scent', brand: 'IPORDISE' };

test('bag lines aggregate identical product and size combinations', () => {
  const once = addBagLine([], product, '100ml');
  const twice = addBagLine(once, product, '100ml');
  assert.equal(twice.length, 1);
  assert.equal(twice[0].quantity, 2);
  assert.equal(countBagItems(twice), 2);
});

test('bag lines keep different sizes separate and remove deterministically', () => {
  const lines = addBagLine(addBagLine([], product, '50ml'), product, '100ml');
  assert.equal(lines.length, 2);
  assert.deepEqual(removeBagLine(lines, bagLineKey(product.id, '50ml')).map(line => line.size), ['100ml']);
});

test('bag quantities update safely, cap at 20, and remove at zero', () => {
  const key = bagLineKey(product.id, '100ml');
  const lines = addBagLine([], product, '100ml');
  assert.equal(updateBagLineQuantity(lines, key, 3.8)[0].quantity, 3);
  assert.equal(updateBagLineQuantity(lines, key, 99)[0].quantity, 20);
  assert.deepEqual(updateBagLineQuantity(lines, key, 0), []);
});
