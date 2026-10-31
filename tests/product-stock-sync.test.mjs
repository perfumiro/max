import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/admin/admin.js', import.meta.url), 'utf8');
const syncSource = source.slice(source.indexOf('const syncMobileCatalogEntry ='), source.indexOf('const fetchSupabaseAdminProducts ='));

test('Firestore quota exhaustion cannot prevent a new product reaching the native app catalogue', async () => {
  let canonical;
  const context = vm.createContext({
    MOBILE_CATALOG_DOC_ID: '__mobile_catalog__', SUPABASE_SYNC_URL: 'https://catalog.test/sync', SUPABASE_PUBLISHABLE_KEY: 'public',
    auth: { currentUser: { getIdToken: async () => 'test' } }, db: {}, doc: (...args) => args,
    getDoc: async () => { throw new Error('Quota exceeded'); },
    setDoc: async () => { throw new Error('Quota exceeded'); },
    fetch: async (_url, init) => { canonical = JSON.parse(init.body); return { ok: true }; },
    console: { warn() {} },
  });
  vm.runInContext(syncSource + '\nglobalThis.sync = syncMobileCatalogEntry;', context);
  await assert.rejects(context.sync('products', 'new-admin-perfume', { name: 'New admin perfume', active: true, sizes: { '100ml': 450 } }), /Saved to the app catalogue, but the website mirror failed/);
  assert.equal(canonical.id, 'new-admin-perfume');
  assert.equal(canonical.value.active, true);
  assert.equal(canonical.value.sizes['100ml'], 450);
});

for (const [label, value, expected] of [
  ['blank stock', { name: 'Test perfume' }, null],
  ['unlimited stock', { name: 'Test perfume', stockLeft: null }, null],
  ['out of stock', { name: 'Test perfume', stockLeft: 0 }, 0],
  ['finite stock', { name: 'Test perfume', stockLeft: 12 }, 12],
  ['partial update', { active: false }, undefined],
]) {
  test(`catalog sync handles ${label}`, async () => {
    let sent;
    const mirrors = [];
    const context = vm.createContext({
      MOBILE_CATALOG_DOC_ID: '__mobile_catalog__',
      SUPABASE_SYNC_URL: 'https://catalog.test/sync',
      SUPABASE_PUBLISHABLE_KEY: 'test-key',
      auth: { currentUser: { getIdToken: async () => 'test-token' } },
      db: {}, doc: (...args) => args,
      getDoc: async () => ({ exists: () => false }),
      setDoc: async (_target, data) => mirrors.push(data),
      deleteDoc: async () => {}, serverTimestamp: () => 0,
      fetch: async (_url, init) => { sent = JSON.parse(init.body); return { ok: true }; },
      console,
    });
    vm.runInContext(syncSource + '\nglobalThis.sync = syncMobileCatalogEntry;', context);
    await context.sync('products', 'test-perfume', value);
    assert.equal(sent.value.stockLeft, expected);
    assert.equal(mirrors[0].stockLeft, expected);
    if (expected === undefined) assert.equal('stockLeft' in sent.value, false);
  });
}

test('API accepts omitted stock while still rejecting invalid stock', async () => {
  const api = await readFile(new URL('../APP IPORDISE/supabase/functions/admin-catalog-sync/index.ts', import.meta.url), 'utf8');
  const expression = api.match(/const stockLeft = (.*);/)[1];
  const parse = value => vm.runInNewContext(expression, { value });
  assert.equal(parse({}), null);
  assert.equal(parse({ stockLeft: null }), null);
  assert.equal(parse({ stockLeft: 0 }), 0);
  assert.equal(parse({ stockLeft: 12 }), 12);
  assert.ok(Number.isNaN(parse({ stockLeft: 'invalid' })));
});

for (const checked of [false, true]) {
  test('price coming soon choice survives save and both catalog mirrors: ' + checked, async () => {
    let sent;
    const mirrors = [];
    const context = vm.createContext({
      MOBILE_CATALOG_DOC_ID: '__mobile_catalog__', SUPABASE_SYNC_URL: 'https://catalog.test/sync', SUPABASE_PUBLISHABLE_KEY: 'key',
      auth: { currentUser: { getIdToken: async () => 'token' } }, db: {}, doc: (...args) => args,
      getDoc: async () => ({ exists: () => true, data: () => ({ priceComingSoon: true }) }),
      setDoc: async (_target, data) => mirrors.push(data), deleteDoc: async () => {}, serverTimestamp: () => 0,
      fetch: async (_url, init) => { sent = JSON.parse(init.body); return { ok: true }; }, console,
    });
    vm.runInContext(syncSource + '\nglobalThis.sync = syncMobileCatalogEntry;', context);
    await context.sync('products', 'new-perfume', { name: 'New perfume', active: true, priceComingSoon: checked });
    assert.equal(sent.value.priceComingSoon, checked);
    assert.equal(mirrors[0].priceComingSoon, checked);
    assert.equal(mirrors[1].products['new-perfume'].priceComingSoon, checked);
    assert.equal(sent.value.active, true);
  });
}
