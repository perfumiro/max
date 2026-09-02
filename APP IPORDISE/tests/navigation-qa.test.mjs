import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const intentSource=read('src/navigation/appNavigationIntent.ts');
const intentJs=ts.transpileModule(intentSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const intentModule={exports:{}};
vm.runInNewContext(`(function(module,exports){${intentJs}})(module,module.exports)`,{module:intentModule,URL});
const {parseAppNavigationIntent}=intentModule.exports;

test('native and web product deep links resolve to a safe product intent',()=>{
  assert.equal(JSON.stringify(parseAppNavigationIntent('ipordise://product/xerjoff-naxos')),JSON.stringify({type:'product',id:'xerjoff-naxos'}));
  assert.equal(JSON.stringify(parseAppNavigationIntent('https://ipordise.com/app?product=xerjoff-naxos')),JSON.stringify({type:'product',id:'xerjoff-naxos'}));
  assert.equal(parseAppNavigationIntent('ipordise://product/%2Funsafe'),null);
});

test('native and web order deep links resolve without accepting unsafe identifiers',()=>{
  assert.equal(JSON.stringify(parseAppNavigationIntent('ipordise://orders/9fca_123')),JSON.stringify({type:'order',id:'9fca_123'}));
  assert.equal(JSON.stringify(parseAppNavigationIntent('https://ipordise.com/app?order=IP-260820-ABC123')),JSON.stringify({type:'order',id:'IP-260820-ABC123'}));
  assert.equal(parseAppNavigationIntent('https://ipordise.com/app?order=../../admin'),null);
});

test('customer app owns exactly one Android hardware BackHandler subscription',()=>{
  const files=['App.tsx','src/account/AccountScreen.tsx','src/shop/ShopScreen.tsx','src/commerce/CommercePages.tsx','src/offers/OffersScreen.tsx'];
  const occurrences=files.flatMap(path=>read(path).match(/BackHandler\.addEventListener\(/g)||[]);
  assert.equal(occurrences.length,1);
  assert.doesNotMatch(files.map(read).join('\n'),/BackHandler\.exitApp\(/);
  const app=read('App.tsx');
  assert.match(app,/BackHandler\.addEventListener\('hardwareBackPress',\(\)=>handleAppBackRef\.current\(\)\)/);
  assert.match(app,/return\(\)=>subscription\.remove\(\);\s*\},\[\]\)/);
});

test('favorites and bag products preserve their commerce origin until Product Back',()=>{
  const app=read('App.tsx');
  const commerce=read('src/commerce/CommercePages.tsx');
  assert.match(commerce,/export function WishlistPage\([\s\S]*onProduct/);
  assert.match(commerce,/onPress=\{\(\) => onProduct\(product\)\}/);
  assert.match(app,/commerceProductOriginRef\.current=commercePageRef\.current/);
  assert.match(app,/if\(commerceProduct&&commercePage===commerceProductOriginRef\.current\)\{setCommerceProduct\(null\);return true;\}/);
  assert.match(app,/onBack=\{\(\)=>setCommerceProduct\(null\)\}/);
});

test('direct product falls back to Shop and direct order falls back to My Orders',()=>{
  const app=read('App.tsx');
  const account=read('src/account/AccountScreen.tsx');
  assert.match(app,/activeRef\.current='Shop';\s*setActive\('Shop'\)/);
  assert.match(app,/activeRef\.current='Account';\s*setActive\('Account'\)/);
  assert.match(account,/pageHistoryRef\.current = order \? \["orders"\] : \[\]/);
  assert.match(account,/pageRef\.current = order \? "order-details" : "orders"/);
});

test('customer modals dismiss themselves before root navigation and order success cannot reopen checkout',()=>{
  const app=read('App.tsx');
  const push=read('src/notifications/PushNotificationProvider.tsx');
  const customerModals=[read('src/offers/OffersScreen.tsx'),read('src/commerce/CommercePages.tsx'),read('src/account/AccountScreen.tsx'),push].join('\n');
  const modalTags=customerModals.match(/<Modal\b[^>]*>/g)||[];
  assert.ok(modalTags.length>=4);
  for(const tag of modalTags)assert.match(tag,/onRequestClose=/);
  assert.doesNotMatch(customerModals,/onRequestClose=\{\(\) => undefined\}/);
  assert.match(push,/onRequestClose=\{dismissPrompt\}/);
  assert.match(app,/if\(commercePage==='thankyou'\)\{setCompletedOrder\(null\);activeRef\.current='Home';setActive\('Home'\);resetCommerce\(\);return true;\}/);
  assert.match(app,/onComplete=\{order=>\{setCompletedOrder\(order\);resetCommerce\('thankyou'\);\}\}/);
});

test('iOS edge Back and every visible custom Back use the same stored actions',()=>{
  const app=read('App.tsx');
  const account=read('src/account/AccountScreen.tsx');
  assert.match(app,/<IosEdgeBackGesture enabled onBack=\{handleAppBack\}/);
  assert.match(app,/onPanResponderRelease:[\s\S]*onBackRef\.current\(\)/);
  assert.match(account,/onBack=\{page === "home" \? undefined : requestAccountBack\}/);
  assert.match(app,/onBack=\{closeTabProduct\}/);
  assert.match(app,/onBack=\{goBackHelp\}/);
});
