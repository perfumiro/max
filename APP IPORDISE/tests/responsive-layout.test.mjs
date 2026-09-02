import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveResponsiveLayout } from '../src/responsive.ts';

const cases=[
  [320,568,'compact',2],[360,640,'phone',2],[375,667,'phone',2],[390,844,'phone',2],
  [412,915,'phone',2],[430,932,'largePhone',2],[768,1024,'tablet',3],[820,1180,'tablet',3],[1024,1366,'largeTablet',4],[1366,1024,'largeTablet',5],
];

test('representative phone and tablet sizes resolve to adaptive layouts',()=>{
  for(const [width,height,size,columns] of cases){const layout=resolveResponsiveLayout(width,height);assert.equal(layout.size,size);assert.equal(layout.catalogColumns,columns);assert.ok(layout.contentWidth<=layout.contentMaxWidth);assert.ok(layout.shellWidth<=width);}
});

test('landscape layouts are detected without scaling the whole UI',()=>{
  const compactLandscape=resolveResponsiveLayout(667,375,1.4);
  const tabletLandscape=resolveResponsiveLayout(1366,1024,1.2);
  assert.equal(compactLandscape.landscape,true);
  assert.equal(compactLandscape.shortLandscape,true);
  assert.equal(tabletLandscape.largeTablet,true);
  assert.ok(compactLandscape.bottomNavHeight<tabletLandscape.bottomNavHeight);
});

test('mobile account scrolling stays touch-native without visible scrollbars',async()=>{
  const [app,account]=await Promise.all([
    readFile(new URL('../App.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/account/AccountScreen.tsx',import.meta.url),'utf8'),
  ]);
  assert.match(app,/ipordise-scrollbar-policy/);
  assert.match(app,/scrollbar-width:none/);
  assert.ok((account.match(/showsVerticalScrollIndicator=\{false\}/g)||[]).length>=3);
});

test('offers view all opens the Boutique tab',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/onExplore=\{onBoutique\}/);
  assert.match(app,/onBoutique=\{\(\)=>\{[^}]*navigateTab\('Shop'\)/);
});

test('phone back and active bottom tabs return through app navigation',async()=>{
  const [app,account,shop,backNavigation]=await Promise.all([
    readFile(new URL('../App.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/account/AccountScreen.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/shop/ShopScreen.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/navigation/androidBackNavigation.ts',import.meta.url),'utf8'),
  ]);
  assert.equal((app.match(/BackHandler\.addEventListener\('hardwareBackPress'/g)||[]).length,1);
  assert.equal((account.match(/BackHandler\.addEventListener/g)||[]).length,0);
  assert.equal((shop.match(/BackHandler\.addEventListener/g)||[]).length,0);
  assert.match(account,/registerAndroidBackAction/);
  assert.match(shop,/registerAndroidBackAction/);
  assert.match(backNavigation,/scopedActions\.splice/);
  assert.doesNotMatch(app,/BackHandler\.exitApp/);
  assert.match(app,/if\(commercePage!==['"]store['"]\)\{goBackCommerce\(\);return true;\}/);
  assert.match(app,/if\(tabProduct\)\{closeTabProduct\(\);return true;\}/);
  assert.match(app,/if\(runScopedAndroidBackAction\(\)\)return true/);
  assert.match(app,/const current=activeRef\.current;\s*const previous=popPreviousNavigationEntry\(previousTabsRef\.current,current\)/);
  assert.match(app,/previous\|\|current!==['"]Home['"]/);
  assert.match(app,/storeLayerHidden:\{display:'none'\}/);
  assert.match(app,/if\(active===t\.label\)setNavigationRevision/);
  assert.doesNotMatch(app,/popPreviousNavigationEntry\(previousTabsRef\.current,active\)/);
});

test('category portraits and swipe rail stay consistent and smooth',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/men-perfume-portrait-v3\.png/);
  assert.match(app,/women-perfume-portrait-v3\.png/);
  assert.match(app,/disableIntervalMomentum decelerationRate="fast" snapToInterval=\{141\}/);
  assert.match(app,/scrollEventThrottle=\{16\} overScrollMode="never"/);
});

test('catalog photography cannot collapse inside mobile result cards',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/catalogImageWrap:\{height:174,minHeight:174,flexShrink:0/);
  assert.match(app,/<Image source=\{product\.image\}[^>]+resizeMode="contain"/);
});

test('mobile search chrome stays pinned while only the product grid scrolls',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/<View style=\{homeStyles\.searchPinnedHeader\}>/);
  assert.match(app,/searchVirtualRoot:\{flex:1,minHeight:0,overflow:'hidden'/);
  assert.match(app,/searchVirtualPage:\{flex:1,minHeight:0,overflow:'hidden'/);
  assert.match(app,/searchResultsMain:\{flex:1,minWidth:0,minHeight:0\}/);
  assert.match(app,/style=\{\{flex:1,minHeight:0\}\} data=\{filtered\}/);
});

test('all horizontal rails share native smooth swipe physics',async()=>{
  const [shared,...screens]=await Promise.all([
    readFile(new URL('../src/components/smoothHorizontalScroll.ts',import.meta.url),'utf8'),
    readFile(new URL('../App.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/shop/ShopScreen.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/offers/OffersScreen.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/commerce/CommercePages.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/help/HelpCenter.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/admin/AdminDashboard.tsx',import.meta.url),'utf8'),
  ]);
  assert.match(shared,/directionalLockEnabled:\s*true/);
  assert.match(shared,/nestedScrollEnabled:\s*true/);
  assert.match(shared,/scrollEventThrottle:\s*16/);
  assert.match(shared,/decelerationRate:\s*'fast'/);
  assert.match(shared,/overScrollMode:\s*'never'/);
  for(const screen of screens)assert.match(screen,/SmoothScrollView as ScrollView/);
});

test('responsive foundations constrain readable content and normalize Android controls',async()=>{
  const [responsive,design,localized,help,offers,checkout,shop]=await Promise.all([
    readFile(new URL('../src/responsive.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/designSystem.ts',import.meta.url),'utf8'),
    readFile(new URL('../src/i18n/LocalizedPrimitives.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/help/HelpCenter.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/offers/OffersScreen.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/commerce/CommercePages.tsx',import.meta.url),'utf8'),
    readFile(new URL('../src/shop/ShopScreen.tsx',import.meta.url),'utf8'),
  ]);
  assert.match(responsive,/resolveGridColumns/);
  assert.match(design,/readable:\s*680/);
  assert.match(localized,/includeFontPadding:false/);
  assert.match(localized,/maxFontSizeMultiplier=\{1\.5\}/);
  assert.match(help,/sizes\.readable \+ layout\.gutter \* 2/);
  assert.match(offers,/modalBackdropTablet/);
  assert.match(offers,/sheetTablet/);
  assert.match(checkout,/addressSheetTablet/);
  assert.match(shop,/resultColumns=layout\.catalogColumns/);
});

test('responsive customer UI has no stale global Dimensions snapshots or iPhone-frame sizing',async()=>{
  const files=['../App.tsx','../src/account/AccountScreen.tsx','../src/commerce/CommercePages.tsx','../src/help/HelpCenter.tsx','../src/offers/OffersScreen.tsx','../src/shop/ShopScreen.tsx'];
  const sources=await Promise.all(files.map(file=>readFile(new URL(file,import.meta.url),'utf8')));
  for(const source of sources){
    assert.doesNotMatch(source,/Dimensions\.get\(['"](?:window|screen)['"]\)/);
    assert.doesNotMatch(source,/width:\s*(?:390|430)\b/);
    assert.doesNotMatch(source,/height:\s*(?:844|1000)\b/);
  }
});
