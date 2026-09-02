import assert from 'node:assert/strict';
import test from 'node:test';
import { addBagLine, bagLineKey, countBagItems, removeBagLine, updateBagLineQuantity } from '../src/commerce/shoppingState.ts';
import { readFile } from 'node:fs/promises';

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

test('rapid add tapping cannot push a line above the checkout limit', () => {
  let lines = addBagLine([], product, '100ml');
  for (let index = 0; index < 50; index += 1) lines = addBagLine(lines, product, '100ml');
  assert.equal(lines[0].quantity, 20);
});

test('inactive and out-of-stock catalogue products cannot be added', () => {
  const unavailableVariant = {id:'scent-1:100ml',sizeKey:'100ml',enabled:true,stock:0};
  assert.deepEqual(addBagLine([], {...product,active:false,variants:[{...unavailableVariant,stock:2}]}, '100ml'), []);
  assert.deepEqual(addBagLine([], {...product,active:true,variants:[unavailableVariant]}, '100ml'), []);
});

test('quick add selects the same preferred size represented by the catalogue price', () => {
  const variants=[
    {id:'scent-1:10ml',sizeKey:'10ml',enabled:true,stock:null},
    {id:'scent-1:20ml',sizeKey:'20ml',enabled:true,stock:null},
  ];
  assert.equal(addBagLine([], {...product,variants})[0].size,'20ml');
  assert.equal(addBagLine([], {...product,brand:'XERJOFF',variants})[0].size,'10ml');
});

test('cart and favourites persist locally and restore against the live catalogue', async () => {
  const [context, storage] = await Promise.all([
    readFile(new URL('../src/commerce/ShoppingContext.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/commerce/shoppingStorage.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(context, /readLocalShoppingState\(\)/);
  assert.match(context, /saveLocalShoppingState\(/);
  assert.match(context, /loadSharedProducts\(\)/);
  assert.match(storage, /SecureStore\.getItemAsync\(SHOPPING_STORAGE_KEY\)/);
  assert.match(storage, /SecureStore\.setItemAsync\(SHOPPING_STORAGE_KEY, raw\)/);
  assert.match(storage, /bag: Array\.isArray\(parsed\.bag\).*slice\(0, 50\)/s);
});

test('checkout inputs keep stable native identity and use one keyboard inset strategy', async () => {
  const [checkout, appConfig] = await Promise.all([
    readFile(new URL('../src/commerce/CommercePages.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
  ]);
  assert.match(checkout, /const CheckoutFormField = React\.memo/);
  assert.match(checkout, /showSoftInputOnFocus/);
  assert.match(checkout, /keyboardShouldPersistTaps="always"/);
  assert.match(checkout, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === "ios"\}/);
  assert.equal(JSON.parse(appConfig).expo.android.softwareKeyboardLayoutMode, 'pan');
  assert.match(checkout, /onSubmitEditing=\{onSubmitEditing\}/);
  assert.doesNotMatch(checkout, /React\.cloneElement/);
  assert.doesNotMatch(checkout, /editable: !loading/);
  assert.doesNotMatch(checkout, /<KeyboardAvoidingView/);
  assert.doesNotMatch(checkout, /fieldFocused:\s*\{[^}]*borderWidth/s);
  for (const key of ['name', 'phone', 'email', 'city', 'address', 'notes']) {
    assert.match(checkout, new RegExp(`key="checkout-${key}"`));
  }
  assert.match(checkout, /fieldMessagePlaceholder/);
});
