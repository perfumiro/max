import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('product page uses the real verified-review component instead of a fabricated testimonial', async () => {
  const app = await read('App.tsx');
  const component = await read('src/reviews/ProductReviews.tsx');

  assert.match(app, /<ProductReviews productId=\{product\.id\}\s*\/>/);
  assert.doesNotMatch(app, /Youssef A\./);
  assert.match(component, /loadProductReviews\(productId\)/);
  assert.match(component, /requestProductReviewCode\(productId, email\)/);
  assert.match(component, /verifyProductReviewCode/);
  assert.match(component, /submitProductReview/);
  assert.match(component, /Only delivered orders qualify/);
});

test('review API only accepts a matching delivered order and verifies email possession', async () => {
  const api = await read('supabase/functions/product-reviews/index.ts');
  const hardening = await read('supabase/migrations/202608130004_adversarial_invariants.sql');

  assert.match(api, /\.eq\('status', 'delivered'\)/);
  assert.match(api, /orderHasProduct\(candidate, productId\)/);
  assert.match(api, /sendVerificationCode\(email, code\)/);
  assert.match(api, /REVIEW_VERIFICATION_SECRET/);
  assert.match(api, /p_email_hash: hashedEmail/);
  assert.match(api, /p_code_hash: expectedHash/);
  assert.match(api, /verification\.verified_at/);
  assert.match(api, /verify_product_review_code/);
  assert.match(hardening, /v_row\.email_hash <> p_email_hash/);
  assert.match(hardening, /v_row\.code_hash <> p_code_hash/);
  assert.match(hardening, /v_row\.expires_at <= now\(\)/);
  assert.match(api, /consumeRateLimit/);
});

test('review storage prevents duplicate purchase reviews and keeps customer email private', async () => {
  const migration = await read('supabase/migrations/202608100002_verified_product_reviews.sql');
  const api = await read('supabase/functions/product-reviews/index.ts');
  const config = await read('supabase/config.toml');

  assert.match(migration, /unique \(order_id, product_id\)/i);
  assert.match(migration, /reviewer_email_hash text not null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.product_reviews from public, anon, authenticated/i);
  assert.doesNotMatch(api, /reviewerEmail:/);
  assert.doesNotMatch(api, /email: review\./);
  assert.match(config, /\[functions\.product-reviews\]\s+verify_jwt = false/);
});
