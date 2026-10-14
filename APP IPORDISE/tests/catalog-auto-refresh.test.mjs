import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/catalogAutoRefresh.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
test('catalog refresh follows foreground publications and stops on unmount', async () => {
  let tick, onState, removed = false, cleared = false, calls = 0, finish;
  const AppState = { currentState: 'active', addEventListener(_event, callback) { onState = callback; return { remove() { removed = true; } }; } };
  const context = vm.createContext({ exports: {}, require: () => ({ AppState }),
    setInterval(callback, interval) { assert.equal(interval, 30000); tick = callback; return 1; },
    clearInterval() { cleared = true; },
  });
  vm.runInContext(js, context);
  const stop = context.exports.startCatalogAutoRefresh(async () => { calls++; await new Promise(resolve => { finish = resolve; }); }, 30000);
  assert.equal(calls, 1);
  tick(); onState('active');
  assert.equal(calls, 1, 'foreground and timer must share the in-flight refresh');
  finish(); await new Promise(resolve => setImmediate(resolve));
  tick(); assert.equal(calls, 2, 'an open catalog receives new publications');
  finish(); await new Promise(resolve => setImmediate(resolve));
  AppState.currentState = 'background'; tick(); assert.equal(calls, 2);
  AppState.currentState = 'active'; onState('active'); assert.equal(calls, 3);
  finish(); await new Promise(resolve => setImmediate(resolve));
  stop(); tick(); onState('active'); assert.equal(calls, 3);
  assert.ok(removed && cleared);
});
