import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const detail = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ProductDetail');
const render = detail.body.statements.find(ts.isReturnStatement);
// Execute the real render setup and hook dependencies, without native UI bindings.
const source = app.slice(detail.getStart(ast), render.getStart(ast)) + 'return null; }';
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

for (const preorderEnabled of [false, true]) {
  test(`product render initializes hook dependencies (preorder=${preorderEnabled})`, () => {
    const effects = [];
    let starts = 0;
    let stops = 0;
    const context = {
      useCustomerAuth: () => ({ session: null }),
      useFavouriteSnapshot: () => ({ favouriteIds: new Set() }),
      useBagSnapshot: () => ({ bagCount: 0 }),
      useShoppingActions: () => ({ toggleFavourite() {}, addToBag() {} }),
      useResponsiveLayout: () => ({ tablet: false }),
      rankSimilarProducts: () => [],
      useMemo: fn => fn(),
      useState: initial => [initial, () => {}],
      useRef: current => ({ current }),
      useEffect: effect => effects.push(effect),
      Animated: {
        Value: class { setValue() {} },
        timing: () => ({}),
        sequence: () => ({}),
        loop: () => ({ start() { starts++; }, stop() { stops++; } }),
      },
      Platform: { OS: 'android' },
      formatMad: value => `${value} MAD`,
      RED: '#d7193f',
      product: { id: 'test', sizes: { '100ml': 900 }, stockLeft: 0, preorderEnabled },
    };
    assert.doesNotThrow(() => vm.runInNewContext(`${js}\nProductDetail({ product, recommendations: [] });`, context));
    const cleanups = effects.map(effect => effect());
    assert.equal(starts, preorderEnabled ? 1 : 0);
    cleanups.forEach(cleanup => cleanup?.());
    assert.equal(stops, starts);
  });
}

const actionJs = ts.transpileModule(app.slice(detail.getStart(ast), render.getStart(ast)) + 'return { selectedAvailable, canPreorder, selectedPrice, size, handlePrimaryAction }; }', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const [label, patch, selectedSize, expected] of [
  ['available with preorder enabled', { preorderEnabled: true }, null, 'bag'],
  ['available with preorder disabled', { preorderEnabled: false }, null, 'bag'],
  ['sold out with preorder enabled', { stockLeft: 0, preorderEnabled: true }, null, 'preorder'],
  ['sold out with preorder disabled', { stockLeft: 0, preorderEnabled: false }, null, 'availability'],
  ['no price with preorder disabled', { sizes: {}, preorderEnabled: false }, null, 'availability'],
  ['no price with preorder enabled', { sizes: {}, preorderEnabled: true }, null, 'preorder'],
  ['available size on a mixed-stock product', { preorderEnabled: true, variants: [{ id: 'small', sizeKey: '10ml', price: 90, enabled: true, stock: 0 }, { id: 'full', sizeKey: '100ml', price: 900, enabled: true, stock: 3 }] }, null, 'bag'],
  ['sold out size on a mixed-stock product', { preorderEnabled: true, variants: [{ id: 'small', sizeKey: '10ml', price: 90, enabled: true, stock: 0 }, { id: 'full', sizeKey: '100ml', price: 900, enabled: true, stock: 3 }] }, '10ml', 'preorder'],
]) {
  for (const priceComingSoon of [false, true]) {
    test(`${label}, price coming soon=${priceComingSoon}`, () => {
      let action;
      let stateIndex = 0;
      const product = { id: 'test', active: true, sizes: { '10ml': 90, '100ml': 900 }, price: '900 MAD', priceComingSoon, ...patch };
      const context = {
        product,
        useCustomerAuth: () => ({ session: null }), useFavouriteSnapshot: () => ({ favouriteIds: new Set() }), useBagSnapshot: () => ({ bagCount: 0 }),
        useShoppingActions: () => ({ toggleFavourite() {}, addToBag() { action = 'bag'; } }), useResponsiveLayout: () => ({ tablet: false }),
        rankSimilarProducts: () => [], useMemo: fn => fn(),
        useState: initial => { const index = stateIndex++; return [index === 0 && selectedSize ? selectedSize : initial, value => { if (index === 3 && value === true) action = 'preorder'; }]; },
        useRef: current => ({ current }), useEffect() {}, Animated: { Value: class {} }, Platform: { OS: 'android' },
        formatMad: value => `${value} MAD`, RED: '#d7193f', openAvailabilityWhatsApp() { action = 'availability'; },
      };
      const result = vm.runInNewContext(`${actionJs}\nProductDetail({ product, recommendations: [] });`, context);
      result.handlePrimaryAction();
      assert.equal(action, expected);
      assert.equal(result.canPreorder, expected === 'preorder');
      assert.equal(result.selectedAvailable, expected === 'bag');
      if (priceComingSoon) assert.equal(result.selectedPrice, 'Price coming soon');
    });
  }
}
