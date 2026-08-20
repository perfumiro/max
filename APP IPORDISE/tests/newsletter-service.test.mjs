import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('newsletter service calls the protected rate-limited edge API',async()=>{
  const [service,edge]=await Promise.all([
    readFile(new URL('../src/services/customerService.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/functions/newsletter-subscribe/index.ts',import.meta.url),'utf8'),
  ]);
  assert.match(service,/functions\/v1\/newsletter-subscribe/);
  assert.match(service,/method: 'POST'/);
  assert.match(service,/email: normalizedEmail/);
  assert.doesNotMatch(service,/rest\/v1\/newsletter_subscribers/);
  assert.match(edge,/consumeRateLimit/);
  assert.match(edge,/upsert\(\{ email, active: true/);
  assert.match(edge,/already_subscribed/);
});

test('newsletter database API validates and idempotently reactivates subscribers',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/202608100001_newsletter_subscription_api.sql',import.meta.url),'utf8');
  assert.match(migration,/security definer/);
  assert.match(migration,/on conflict \(email\) do update/);
  assert.match(migration,/set active = true/);
  assert.match(migration,/return 'already_subscribed'/);
  assert.match(migration,/return 'subscribed'/);
  assert.match(migration,/grant execute.*to anon, authenticated/);
  assert.match(migration,/revoke insert.*from anon/);
});
