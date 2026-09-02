import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('product gallery keeps cart and wishlist as the primary floating actions', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  const floatingActionsLine = app.split(/\r?\n/).find(line => line.includes('detailFloatingActionsPremium')) || '';
  assert.match(floatingActionsLine, /Open shopping bag/);
  assert.match(floatingActionsLine, /bagCount\?'bag-handle':'bag-outline'/);
  assert.match(floatingActionsLine, /Remove from favourites/);
  assert.doesNotMatch(floatingActionsLine, /Share \$\{product\.name\}/);
  assert.match(app, /detailFloatingActionsPremium:\{right:14,top:14,gap:8,height:40/);
  assert.match(app, /detailFloatingActionPremium:\{width:40,height:40,borderRadius:20/);
  assert.match(app, /detailCartBadge:\{position:'absolute',right:2,top:2,minWidth:13,height:13/);
  assert.match(app, /liked&&styles\.detailFloatingActionSelected/);
});

test('share remains available as a quiet labelled product-information action', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /style=\{styles\.detailRatingShareRow\}/);
  assert.match(app, /accessibilityLabel=\{`Share \$\{product\.name\}`\}/);
  assert.match(app, /style=\{styles\.detailShareActionText\}>\{sharing\?'CREATING':'SHARE'\}<\/Text>/);
});

test('product introduction uses a restrained editorial hierarchy', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /detailNamePremium:\{fontSize:28,lineHeight:34,fontWeight:'500'/);
  assert.match(app, /detailRatingShareRow:\{minHeight:48,marginTop:14,paddingBottom:10,borderBottomWidth:1/);
  assert.match(app, /detailShareAction:\{minHeight:30,paddingHorizontal:3/);
  assert.match(app, /reviewLink:\{fontSize:8\.5,color:'#726760'\}/);
  assert.doesNotMatch(app, /reviewLink:\{[^}]*textDecorationLine:'underline'/);
});

test('every product-detail entry point provides working bag navigation', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  const productDetailCalls = app.split(/\r?\n/).filter(line => line.includes('<ProductDetail '));
  assert.equal(productDetailCalls.length, 3);
  for (const call of productDetailCalls) assert.match(call, /onOpenBag=/);
  assert.match(app, /onOpenBag=\{\(\)=>navigateCommerce\('bag'\)\}/);
  assert.doesNotMatch(app, /onOpenBag=\{\(\)=>\{setTabProduct\(null\);tabProductHistoryRef\.current=\[\];navigateCommerce\('bag'\);\}\}/);
});

test('mobile sticky purchase is immediately available without excessive scrolling', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /stickyRevealThreshold/);
  assert.doesNotMatch(app, /handleProductScroll/);
  assert.match(app, /new Animated\.Value\(layout\.tablet\?0:1\)/);
  assert.match(app, /stickyProgress\.setValue\(layout\.tablet\?0:1\)/);
  assert.match(app, /outputRange:\[92,0\]/);
  assert.match(app, /stickyPurchase:\{position:'absolute'/);
});

test('added confirmation becomes a working route to the cart', async () => {
  const app = await readFile(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /if\(added\)\{onOpenBag\(\);return;\}setAdded\(true\);addToBag\(product,size\)/);
  assert.match(app, /added\?'Go to cart'/);
  assert.match(app, /added\?'GO TO CART'/);
  assert.match(app, /added\?'bag-handle-outline'/);
  assert.doesNotMatch(app, /added\?'Added to bag'/);
});
