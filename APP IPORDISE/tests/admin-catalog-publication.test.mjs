import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const service = readFileSync(new URL('../src/services/adminService.ts', import.meta.url), 'utf8');
const source = service.slice(service.indexOf('const syncCatalogProduct ='), service.indexOf('type AdminPage<T>'));
const js = ts.transpileModule(source + '\nglobalThis.sync = syncCatalogProduct;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

for (const existing of [{}, { addedAt: '2026-08-01T12:00:00.000Z' }]) {
  test(`app-admin publication mirrors confirmed data to the website (existing=${Boolean(existing.addedAt)})`, async () => {
    const calls = [];
    let mirrored;
    const context = vm.createContext({ edgeFunctionConfig: () => ({ url: 'https://api.test/admin-catalog-sync', key: 'public' }),
      fetch: async (_url, options) => { calls.push('canonical'); return JSON.parse(options.body); },
      parseResponse: async body => ({ ok: true, id: body.id }), getDocument: async () => existing,
      patchDocument: async (_session, path, value) => { calls.push('website'); mirrored = { path, value }; },
    });
    vm.runInContext(js, context);
    const result = await context.sync({ accessToken: 'test' }, 'new-perfume', { name: 'New perfume', sizes: { '100ml': 450 }, active: true, stockLeft: null, priceComingSoon: false, preorderEnabled: false, createOnly: true });
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ['canonical', 'website']);
    assert.equal(mirrored.path, 'products/new-perfume');
    assert.equal(mirrored.value.slug, 'new-perfume');
    assert.equal(mirrored.value.sizes['100ml'], 450);
    assert.equal(mirrored.value.priceComingSoon, false);
    assert.equal(mirrored.value.active, true);
    assert.equal(mirrored.value.createOnly, undefined);
    assert.ok(mirrored.value.addedAt);
    if (existing.addedAt) assert.equal(mirrored.value.addedAt, existing.addedAt);
  });
}

test('a rejected canonical save never publishes a website product', async () => {
  let mirrored = false;
  const context = vm.createContext({ edgeFunctionConfig: () => ({ url: 'test', key: 'public' }), fetch: async () => ({}), parseResponse: async () => { throw new Error('Rejected'); }, patchDocument: async () => { mirrored = true; } });
  vm.runInContext(js, context);
  await assert.rejects(context.sync({ accessToken: 'test' }, 'new-perfume', { name: 'New perfume' }), /Rejected/);
  assert.equal(mirrored, false);
});

test('website mirror errors surface so staff can repair a partial publication', async () => {
  const context = vm.createContext({ edgeFunctionConfig: () => ({ url: 'test', key: 'public' }), fetch: async () => ({}), parseResponse: async () => ({ ok: true }), getDocument: async () => ({}), patchDocument: async () => { throw new Error('Website unavailable'); } });
  vm.runInContext(js, context);
  await assert.rejects(context.sync({ accessToken: 'test' }, 'new-perfume', { name: 'New perfume' }), /Website unavailable/);
});
