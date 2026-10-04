import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../supabase/functions/create-preorder/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

for (const [label, patch, variants, variantId, expectedStatus, expectedCode] of [
  ['disabled preorder on sold-out product', { preorder_enabled: false }, [], null, 409, 'PREORDER_NOT_ALLOWED'],
  ['inactive product', { active: false }, [], null, 409, 'PREORDER_NOT_ALLOWED'],
  ['available selected size', {}, [{ id: 'full', enabled: true, price_minor: 90000, stock_quantity: 3 }], 'full', 409, 'PRODUCT_AVAILABLE'],
  ['available product without a selected size', {}, [{ enabled: true, price_minor: 90000, stock_quantity: null }], null, 409, 'PRODUCT_AVAILABLE'],
  ['unpriced explicitly enabled product', {}, [], null, 201, undefined],
  ['sold-out selected size', {}, [{ id: 'small', enabled: true, price_minor: 9000, stock_quantity: 0 }], 'small', 201, undefined],
]) {
  test(`preorder endpoint: ${label}`, async () => {
    let handler;
    let writes = 0;
    const product = { id: 'perfume', name: 'Perfume', active: true, preorder_enabled: true, stock_left: 0, ...patch };
    const admin = { from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        upsert() { writes++; return query; },
        async maybeSingle() { return { data: table === 'products' ? product : table === 'store_settings' ? { value: {} } : table === 'product_variants' ? variants[0] : { id: 'request', status: 'new' } }; },
        then(resolve, reject) { return Promise.resolve({ data: variants }).then(resolve, reject); },
      };
      return query;
    } };
    const security = {
      requestOrigin: () => 'https://store.test', rejectUntrustedOrigin: () => null, rejectNonJson: () => null,
      consumeRateLimit: async () => true, bearerToken: () => null,
      readJsonObject: async () => ({ value: { productId: 'perfume', variantId, customerName: 'Test Customer', phone: '0612345678', quantity: 1, idempotencyKey: 'preorder-test-1234567890' } }),
      apiJson: (body, status) => ({ body, status }),
    };
    vm.runInNewContext(compiled, { exports: {}, require: name => name.includes('supabase-js') ? { createClient: () => admin } : security, Deno: { serve: fn => { handler = fn; }, env: { get: () => 'test' } }, crypto: { randomUUID: () => 'test-request' }, console });
    const result = await handler({ method: 'POST', headers: new Headers() });
    assert.equal(result.status, expectedStatus);
    assert.equal(result.body.code, expectedCode);
    assert.equal(writes, expectedStatus === 201 ? 1 : 0);
  });
}
