import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/navigation/androidBackNavigation.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
vm.runInNewContext(`(function(module,exports){${js}})(module,module.exports)`,{module});
const {registerAndroidBackAction,runScopedAndroidBackAction,hasScopedAndroidBackAction,recordNavigationEntry,popPreviousNavigationEntry}=module.exports;

test('scoped Android back actions run from the deepest mounted screen first',()=>{
  const calls=[];
  const removeParent=registerAndroidBackAction(()=>{calls.push('parent');return true;});
  const removeChild=registerAndroidBackAction(()=>{calls.push('child');return false;});
  assert.equal(hasScopedAndroidBackAction(),true);
  assert.equal(runScopedAndroidBackAction(),true);
  assert.deepEqual(calls,['child','parent']);
  removeChild();
  removeParent();
  assert.equal(hasScopedAndroidBackAction(),false);
});

test('cleaned-up Android back actions cannot consume later back presses',()=>{
  let calls=0;
  const remove=registerAndroidBackAction(()=>{calls+=1;return true;});
  remove();
  remove();
  assert.equal(runScopedAndroidBackAction(),false);
  assert.equal(calls,0);
});

test('tab history records synchronously and pops the actual previous destination',()=>{
  const history=[];
  assert.equal(recordNavigationEntry(history,'Home','Shop'),true);
  assert.equal(recordNavigationEntry(history,'Shop','Product'),true);
  assert.equal(recordNavigationEntry(history,'Product','Product'),false);
  assert.deepEqual(history,['Home','Shop']);
  assert.equal(popPreviousNavigationEntry(history,'Product'),'Shop');
  assert.equal(popPreviousNavigationEntry(history,'Shop'),'Home');
  assert.equal(popPreviousNavigationEntry(history,'Home'),undefined);
});

test('root navigation preserves Product under Cart and exits only from the genuine Home root',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  const commerceIndex=app.indexOf("if(commercePage!=='store'){goBackCommerce();return true;}");
  const productIndex=app.indexOf('if(tabProduct){closeTabProduct();return true;}');
  const scopedIndex=app.indexOf('if(runScopedAndroidBackAction())return true;');
  const tabIndex=app.indexOf("if(previous||current!=='Home')");
  const rootGuardIndex=app.indexOf('return true;',tabIndex);
  assert.ok(commerceIndex>0&&commerceIndex<productIndex);
  assert.ok(productIndex<scopedIndex&&scopedIndex<tabIndex);
  assert.ok(tabIndex<rootGuardIndex);
  assert.match(app,/const current=activeRef\.current;\s*const previous=popPreviousNavigationEntry\(previousTabsRef\.current,current\)/);
  assert.match(app,/recordNavigationEntry\(commerceHistoryRef\.current,current,next\)/);
  assert.match(app,/recordNavigationEntry\(previousTabsRef\.current,current,next\)/);
  assert.match(app,/recordNavigationEntry\(tabProductHistoryRef\.current,current,product\)/);
  assert.match(app,/commercePage!==['"]store['"]&&styles\.storeLayerHidden/);
  assert.match(app,/const handleAppBackRef=useRef\(handleAppBack\);\s*handleAppBackRef\.current=handleAppBack/);
  assert.match(app,/BackHandler\.addEventListener\('hardwareBackPress',\(\)=>handleAppBackRef\.current\(\)\)/);
  assert.match(app,/return false;\s*\},\[commercePage,commerceProduct,contextualHelpDestination,tabProduct,unavailableProductId\]\)/);
});

test('long category, product, cart and checkout flow unwinds one layer at a time',()=>{
  const tabHistory=[];
  const commerceHistory=[];
  let tab='Home';
  let categoryOpen=false;
  let productOpen=false;
  let commercePage='store';
  const navigateTab=next=>{recordNavigationEntry(tabHistory,tab,next);tab=next;};
  const navigateCommerce=next=>{recordNavigationEntry(commerceHistory,commercePage,next);commercePage=next;};
  const back=()=>{
    if(commercePage!=='store'){commercePage=commerceHistory.pop()||'store';return commercePage;}
    if(productOpen){productOpen=false;return 'Product closed';}
    if(categoryOpen){categoryOpen=false;return 'Category closed';}
    const previous=popPreviousNavigationEntry(tabHistory,tab);
    if(previous||tab!=='Home'){tab=previous||'Home';return tab;}
    return 'EXIT';
  };

  navigateTab('Shop');
  categoryOpen=true;
  productOpen=true;
  navigateCommerce('bag');
  navigateCommerce('checkout');
  assert.equal(back(),'bag');
  assert.equal(back(),'store');
  assert.equal(back(),'Product closed');
  assert.equal(back(),'Category closed');
  assert.equal(back(),'Home');
  assert.equal(back(),'EXIT');
});

test('keyboard yields to Android before application history is consumed',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  const keyboardIndex=app.indexOf('if(keyboardVisibleRef.current)return false;');
  const commerceIndex=app.indexOf("if(commercePage==='thankyou')");
  assert.ok(keyboardIndex>0&&keyboardIndex<commerceIndex);
  assert.match(app,/Keyboard\.addListener\('keyboardDidShow'/);
  assert.match(app,/Keyboard\.addListener\('keyboardDidHide'/);
  assert.match(app,/showSubscription\.remove\(\);hideSubscription\.remove\(\)/);
});

test('Help and authentication nested screens pop their local history instead of jumping home',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  const account=readFileSync(new URL('../src/account/AccountScreen.tsx',import.meta.url),'utf8');
  assert.match(app,/helpHistoryRef=useRef<HelpDestination\[]>/);
  assert.match(app,/onContact=\{\(\)=>navigateHelp\('contact'\)\}/);
  assert.match(app,/onBack=\{goBackHelp\}/);
  assert.match(account,/authHistoryRef=useRef<AuthMode\[]>/);
  assert.match(account,/navigateAuth\("forgot"\)/);
  assert.match(account,/navigateAuth\("verify"\)/);
  assert.doesNotMatch(app,/BackHandler\.exitApp\(/);
});

test('product, bag, checkout and contextual order help preserve their underlying routes',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/onOpenBag=\{\(\)=>navigateCommerce\('bag'\)\}/);
  assert.doesNotMatch(app,/onOpenBag=\{\(\)=>\{setTabProduct\(null\);tabProductHistoryRef\.current=\[\];navigateCommerce\('bag'\);\}\}/);
  assert.match(app,/contextualHelpDestination/);
  assert.match(app,/onExit=\{\(\)=>setContextualHelpDestination\(null\)\}/);
  assert.match(app,/<IosEdgeBackGesture enabled onBack=\{handleAppBack\}/);
});
