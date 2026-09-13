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
      product: { id: 'test', sizes: { '100ml': 900 }, preorderEnabled },
    };
    assert.doesNotThrow(() => vm.runInNewContext(`${js}\nProductDetail({ product, recommendations: [] });`, context));
    const cleanups = effects.map(effect => effect());
    assert.equal(starts, preorderEnabled ? 1 : 0);
    cleanups.forEach(cleanup => cleanup?.());
    assert.equal(stops, starts);
  });
}
