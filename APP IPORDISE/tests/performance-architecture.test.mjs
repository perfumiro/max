import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appPath = new URL('../App.tsx', import.meta.url);
const commercePath = new URL('../src/commerce/CommercePages.tsx', import.meta.url);
const offersPath = new URL('../src/offers/OffersScreen.tsx', import.meta.url);
const catalogPath = new URL('../src/sharedCatalog.ts', import.meta.url);
const accountPath = new URL('../src/account/AccountScreen.tsx', import.meta.url);
const reviewsPath = new URL('../src/services/productReviewService.ts', import.meta.url);
const navigationPath = new URL('../src/navigation/androidBackNavigation.ts', import.meta.url);

test('large catalogue search and collection results stay virtualized', async () => {
  const source = await readFile(appPath, 'utf8');
  const commerce = await readFile(commercePath, 'utf8');
  assert.ok(source.includes('key={`search-${columns}`}'));
  assert.ok(source.includes('data={filtered}'));
  assert.ok(source.includes('renderItem={renderProduct}'));
  assert.ok(source.includes('initialNumToRender={columns*4}'));
  assert.ok(source.includes('maxToRenderPerBatch={columns*3}'));
  assert.ok(source.includes('windowSize={7}'));
  assert.ok(source.includes('if(activeFilter)return <FlatList'));
  assert.ok(source.includes("removeClippedSubviews={Platform.OS!=='web'}"));
  assert.match(commerce, /key=\{`wishlist-\$\{columns\}`\}/);
  assert.match(commerce, /data=\{favourites\}\s+numColumns=\{columns\}/);
});

test('repeated product cards do not subscribe to window dimensions', async () => {
  const source = await readFile(appPath, 'utf8');
  const card = source.slice(source.indexOf('const CatalogCard='), source.indexOf('type ProductVariantOption'));
  assert.doesNotMatch(card, /useResponsiveLayout\(/);
});

test('bag progress animation remains on the native driver', async () => {
  const source = await readFile(commercePath, 'utf8');
  assert.doesNotMatch(source, /useNativeDriver:false/);
  assert.match(source, /transform:\s*\[\{\s*scaleX:\s*progress\s*\}\]/);
});

test('offer feedback timers are cleaned up on unmount', async () => {
  const source = await readFile(offersPath, 'utf8');
  assert.match(source, /clearTimeout\(resetTimer\.current\)/);
  assert.match(source, /clearTimeout\(closeTimer\.current\)/);
  assert.match(source, /renderItem={renderOffer}/);
});

test('catalogue requests and remote images use bounded caching and deduplication', async () => {
  const source = await readFile(catalogPath, 'utf8');
  assert.match(source, /pendingCatalogRequest/);
  assert.match(source, /cacheExpiresAt = Date\.now\(\) \+ appConfig\.catalogCacheTtlMs/);
  assert.match(source, /cache: 'force-cache'/);
});

test('high-frequency shopping consumers use narrow context subscriptions', async () => {
  const app = await readFile(appPath, 'utf8');
  const commerce = await readFile(commercePath, 'utf8');
  const account = await readFile(accountPath, 'utf8');
  const context = await readFile(new URL('../src/account/CustomerContext.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /\buseShopping\(/);
  assert.doesNotMatch(commerce, /\buseShopping\(/);
  assert.doesNotMatch(account, /\buseShopping\(/);
});

test('product reviews deduplicate reopen requests and bound memory', async () => {
  const source = await readFile(reviewsPath, 'utf8');
  assert.match(source, /reviewRequests\.get\(productId\)/);
  assert.match(source, /reviewCache\.size > 30/);
  assert.match(source, /reviewCache\.delete\(input\.productId\)/);
});

test('navigation history and account order refreshes stay bounded', async () => {
  const navigation = await readFile(navigationPath, 'utf8');
  const account = await readFile(accountPath, 'utf8');
  const context = await readFile(new URL('../src/account/CustomerContext.tsx', import.meta.url), 'utf8');
  assert.match(navigation, /MAX_NAVIGATION_HISTORY = 24/);
  assert.doesNotMatch(account, /setInterval\(refreshOrders/);
  assert.match(account, /refreshOrders/);
  assert.match(context, /loadCustomerOrders\(token\)/);
});

test('product galleries update in place without forced image remounts', async () => {
  const source = await readFile(appPath, 'utf8');
  assert.doesNotMatch(source, /<Image key=\{galleryIndex\}/);
  assert.match(source, /resizeMethod="resize" fadeDuration=\{0\}/);
});
