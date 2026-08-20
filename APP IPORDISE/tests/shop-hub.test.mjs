import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/shop/shopLogic.ts',import.meta.url),'utf8')
  .replace("import { searchProducts } from '../productSearch';","const searchProducts=(products,query)=>products.filter(product=>JSON.stringify(product).toLowerCase().includes(query.toLowerCase()));")
  .replace("import { normalizeBrandText } from './brandDiscoveryLogic';","const normalizeBrandText=value=>value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase();");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};vm.runInNewContext(`(function(module,exports){${js}})(module,module.exports)`,{module});
const {matchesShopIntent,minimumProductPrice}=module.exports;
const brandLogicSource=readFileSync(new URL('../src/shop/brandDiscoveryLogic.ts',import.meta.url),'utf8');
const brandLogicJs=ts.transpileModule(brandLogicSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const brandModule={exports:{}};vm.runInNewContext(`(function(module,exports,require){${brandLogicJs}})(module,module.exports,()=>({}))`,{module:brandModule});
const {buildBrandDiscoveryItems,filterBrandDiscoveryItems,formatBrandProductCount,resolveBrandDiscoveryState}=brandModule.exports;
const shopScreenSource=readFileSync(new URL('../src/shop/ShopScreen.tsx',import.meta.url),'utf8');
const brandDiscoverySource=readFileSync(new URL('../src/shop/BrandDiscovery.tsx',import.meta.url),'utf8');
const appSource=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const languageSource=readFileSync(new URL('../src/i18n/LanguageContext.tsx',import.meta.url),'utf8');
const product={id:'one',brand:'HOUSE',name:'Scent',price:'450 MAD',oldPrice:'',badge:'NEW',rating:'4.8',reviewCount:0,image:{},gallery:[],sizes:{'50ml':450,'100ml':800},filters:['for-men','new-in'],active:true,notes:{top:'citrus'}};

test('price shortcuts use the lowest real available size price',()=>{assert.equal(minimumProductPrice(product),450);assert.equal(matchesShopIntent(product,{filter:'price-under-500'}),true);assert.equal(matchesShopIntent(product,{filter:'price-under-300'}),false);});
test('catalogue shortcuts match real filters and badge semantics',()=>{assert.equal(matchesShopIntent(product,{filter:'for-men'}),true);assert.equal(matchesShopIntent(product,{filter:'new-in'}),true);assert.equal(matchesShopIntent(product,{filter:'offers'}),false);});
test('internal Boutique category results retain reliable product and back navigation',()=>{
  assert.match(shopScreenSource,/for-him-editorial-v2\.png/);
  assert.match(shopScreenSource,/onPress=\{\(\)=>openCategory\(link\)\}/);
  assert.match(shopScreenSource,/data=\{selectedProducts\}/);
  assert.match(shopScreenSource,/accessibilityLabel="Back to Boutique"/);
  assert.match(shopScreenSource,/registerAndroidBackAction/);
});

test('Boutique omits the retired price collection and fragrance family sections',()=>{
  assert.doesNotMatch(shopScreenSource,/Collections & price/);
  assert.doesNotMatch(shopScreenSource,/Shop by fragrance family/);
  assert.doesNotMatch(shopScreenSource,/CURATED WAYS TO SHOP|SCENT DISCOVERY/);
});

test('Boutique landing displays only the iconic brand discovery section',()=>{
  assert.match(shopScreenSource,/const sections=useMemo<SectionId\[]>\(\(\)=>\['brands'\],\[\]\)/);
});

test('Boutique brand search removes native orange input decoration',()=>{
  assert.match(brandDiscoverySource,/accessibilityLabel=\{t\('brandSearchLabel'\)\}[^>]*underlineColorAndroid="transparent"/s);
  assert.match(brandDiscoverySource,/selectionColor=\{RED\}[^>]*cursorColor=\{RED\}/s);
  assert.match(brandDiscoverySource,/WEB_INPUT_RESET = Platform\.OS === 'web'/);
  assert.match(brandDiscoverySource,/borderColor: '#dcd6d2'/);
});

test('premium brand discovery uses live counts, local identities, states, and working navigation',()=>{
  assert.match(shopScreenSource,/buildBrandDiscoveryItems\(products,config\.featuredBrands,''\)/);
  assert.match(shopScreenSource,/const openBrand=useCallback\(\(label:string\)=>\{Keyboard\.dismiss\(\);setSelectedCategory\(null\);setSelectedBrand\(label\)/);
  assert.match(shopScreenSource,/if\(selectedCategory\|\|selectedBrand\)return/);
  assert.match(shopScreenSource,/onOpenBrand=\{openBrand\}/);
  assert.match(shopScreenSource,/layout\.largeTablet\?4:layout\.tablet\?3:layout\.compact\?1:2/);
  assert.match(brandDiscoverySource,/t\(directory \? 'brandDirectoryTitle' : 'brandTitle'\)/);
  assert.match(brandDiscoverySource,/BRAND_LOGOS/);
  assert.match(brandDiscoverySource,/BrandSkeleton/);
  assert.match(brandDiscoverySource,/BrandEmptyState/);
  assert.match(brandDiscoverySource,/formatBrandProductCount/);
  assert.match(brandDiscoverySource,/isReduceMotionEnabled/);
});

test('brand discovery derives real counts and normalizes case, accents, and whitespace',()=>{
  const products=[
    {...product,id:'dior-one',brand:'Dior'},
    {...product,id:'dior-two',brand:'  DIOR  '},
    {...product,id:'chanel-one',brand:'CHANEL'},
    {...product,id:'inactive',brand:'Mock Brand',active:false},
    {...product,id:'accented',brand:'Parfums Élégance'},
  ];
  const all=buildBrandDiscoveryItems(products,['Dior'],'');
  assert.equal(JSON.stringify(all.map(item=>[item.label,item.count])),JSON.stringify([['Dior',2],['CHANEL',1],['Parfums Élégance',1]]));
  assert.equal(JSON.stringify(filterBrandDiscoveryItems(all,'  CHA  ').map(item=>item.label)),JSON.stringify(['CHANEL']));
  assert.equal(JSON.stringify(filterBrandDiscoveryItems(all,'parfums   elegance').map(item=>item.label)),JSON.stringify(['Parfums Élégance']));
  assert.equal(formatBrandProductCount(1,'product','products'),'1 product');
  assert.equal(formatBrandProductCount(2,'product','products'),'2 products');
});

test('brand cards navigate by exact normalized brand intent and the main grid exposes every brand',()=>{
  assert.equal(matchesShopIntent({...product,brand:'Parfums Élégance'},{brand:' parfums elegance '}),true);
  assert.equal(matchesShopIntent({...product,brand:'Another House'},{brand:'parfums elegance'}),false);
  assert.match(brandDiscoverySource,/const visibleBrands = brands;/);
  assert.doesNotMatch(brandDiscoverySource,/brands\.slice\(0, 8\)/);
  assert.doesNotMatch(brandDiscoverySource,/ViewAllBrandsAction/);
  assert.doesNotMatch(shopScreenSource,/onViewAll=/);
  assert.match(appSource,/matchesShopIntent\(product,\{brand:selectedBrand\}\)/);
  assert.match(appSource,/params\.set\('brand',normalized\.brand\)/);
});

test('brand UI resolves loading, empty, and failed API states with a forced retry',()=>{
  assert.equal(resolveBrandDiscoveryState(true,false,0,''),'loading');
  assert.equal(resolveBrandDiscoveryState(true,false,0,'missing',4),'empty');
  assert.equal(resolveBrandDiscoveryState(false,false,0,'missing'),'empty');
  assert.equal(resolveBrandDiscoveryState(false,true,0,''),'error');
  assert.equal(resolveBrandDiscoveryState(false,true,0,'missing',4),'empty');
  assert.equal(resolveBrandDiscoveryState(false,true,4,''),'ready');
  assert.match(shopScreenSource,/const retryBrands=useCallback\(\(\)=>\{void refresh\(true\);\}/);
  assert.match(shopScreenSource,/onRetry=\{retryBrands\}/);
  assert.match(shopScreenSource,/loadSharedProducts\(forceRefresh===true\)/);
});

test('brand discovery text is localized in French English and Arabic with RTL support',()=>{
  assert.ok((languageSource.match(/brandDirectoryTitle:/g)||[]).length===3);
  assert.ok((languageSource.match(/brandProduct:/g)||[]).length===3);
  assert.match(brandDiscoverySource,/const \{\s*t,\s*rtl\s*\} = useLanguage\(\)/);
  assert.match(brandDiscoverySource,/rtlSection: \{ direction: 'rtl' \}/);
  assert.match(brandDiscoverySource,/bottleRtl: \{ right: 'auto', left: -1 \}/);
  assert.match(brandDiscoverySource,/writingDirection: 'rtl'/);
});
