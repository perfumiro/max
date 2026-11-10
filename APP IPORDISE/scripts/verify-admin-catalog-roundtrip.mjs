// Exercise the protected production write path without publishing a customer-visible product.
import assert from 'node:assert/strict';

const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(base, 'https://gdgrskgegrcgmzswefmn.supabase.co');
assert.ok(process.env.IPORDISE_ADMIN_EMAIL && process.env.IPORDISE_ADMIN_PASSWORD);
const auth = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.IPORDISE_ADMIN_EMAIL, password: process.env.IPORDISE_ADMIN_PASSWORD, returnSecureToken: true }),
  signal: AbortSignal.timeout(20_000),
});
assert.equal(auth.status, 200, 'Configured staff authentication must succeed');
const { idToken } = await auth.json();
const headers = { apikey: key, Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
const id = `catalog-sync-check-${crypto.randomUUID()}`;
const write = async value => {
  const response = await fetch(`${base}/functions/v1/admin-catalog-sync`, {
    method: 'POST', headers, body: JSON.stringify({ section: 'products', id, value }), signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `Catalog write failed: ${payload.error || response.status}`);
  assert.equal(payload.ok, true);
};
const read = async () => {
  const response = await fetch(`${base}/functions/v1/admin-catalog-sync?q=${id}&pageSize=1`, { headers, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200);
  return (await response.json()).products;
};
try {
  await write({ name: 'Catalog synchronization verification', brand: 'IPORDISE', image: 'https://ipordise.com/assets/ipordise-app-icon-v3.png', sizes: { '100ml': 100 }, active: false, publicationStatus: 'draft', stockLeft: 0, createOnly: true });
  const rows = await read();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].active, false);
  assert.equal(rows[0].publication_status, 'draft');
  assert.equal(rows[0].product_variants.length, 1);
  const publicRead = await fetch(`${base}/rest/v1/products?select=id&id=eq.${id}`, { headers: { apikey: key }, signal: AbortSignal.timeout(20_000) });
  assert.equal(publicRead.status, 200);
  assert.deepEqual(await publicRead.json(), [], 'Verification product must remain invisible to customers');
} finally {
  await write(null);
}
assert.deepEqual(await read(), [], 'Deleted product must disappear from the canonical admin catalog');
const variantRead = await fetch(`${base}/rest/v1/product_variants?select=id&product_id=eq.${id}`, { headers: { apikey: key }, signal: AbortSignal.timeout(20_000) });
assert.equal(variantRead.status, 200);
assert.deepEqual(await variantRead.json(), []);
console.log(JSON.stringify({ ok: true, draftCreation: true, variantsCreated: true, customerVisible: false, deletionVerified: true, verificationProductRemoved: true }));
