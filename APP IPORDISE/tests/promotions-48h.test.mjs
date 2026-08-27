import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createPromotionWindow,
  formatPromotionCountdown,
  formatPromotionRemaining,
  isPromotionWindowActive,
  PROMOTION_DURATION_MS,
} from '../src/offers/promotionLogic.ts';

test('a promotion window lasts exactly 48 hours', () => {
  const now = Date.parse('2026-08-27T10:00:00.000Z');
  const window = createPromotionWindow(now);
  assert.equal(Date.parse(window.endsAt) - Date.parse(window.startsAt), PROMOTION_DURATION_MS);
  assert.equal(isPromotionWindowActive(window.startsAt, window.endsAt, now), true);
  assert.equal(isPromotionWindowActive(window.startsAt, window.endsAt, now + PROMOTION_DURATION_MS), false);
  assert.equal(formatPromotionRemaining(PROMOTION_DURATION_MS), '48h 00m');
  assert.equal(formatPromotionCountdown(PROMOTION_DURATION_MS), '48:00:00');
  assert.equal(formatPromotionCountdown(3_661_000), '01:01:01');
});

test('admin, catalogue, checkout and push delivery share the promotion contract', async () => {
  const [admin, catalog, edge, sender, migration] = await Promise.all([
    readFile(new URL('../src/admin/AdminDashboard.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/sharedCatalog.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/admin-catalog-sync/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/_shared/pushNotifications.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/202608270001_48h_product_promotions.sql', import.meta.url), 'utf8'),
  ]);
  assert.match(admin, /48H PROMOTION CONTROL/);
  assert.match(admin, /notify_promotion:\s*true/);
  assert.match(catalog, /offer_start,offer_end,offer_featured,offer_badge,offer_display_order/);
  assert.match(edge, /sendPromotionNotification/);
  assert.match(sender, /offers_enabled/);
  assert.match(sender, /dataType:\s*'promotion'/);
  assert.match(migration, /expire_product_promotions/);
  assert.match(migration, /create_commerce_order_safe/);
});
