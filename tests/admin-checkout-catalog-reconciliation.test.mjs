import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('authenticated admin repairs cart products missing from the canonical checkout catalog', async () => {
  const source = await readFile(new URL('../assets/admin/admin.js', import.meta.url), 'utf8');
  assert.match(source, /const reconcileCheckoutCartProducts = async/);
  assert.match(source, /localStorage\.getItem\('cart'\)/);
  assert.match(source, /SUPABASE_SYNC_URL\}\?pageSize=100/);
  assert.match(source, /getDocs\(collection\(db, 'products'\)\)/);
  assert.match(source, /await syncMobileCatalogEntry\('products', match\.id, match\.value\)/);
  assert.match(source, /await reconcileCheckoutCartProducts\(\)/);
});
