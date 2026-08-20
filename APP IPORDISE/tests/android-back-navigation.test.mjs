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

test('root navigation source preserves Product under Cart and exits only at empty Home',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  const commerceIndex=app.indexOf("if(commercePage!=='store'){goBackCommerce();return true;}");
  const productIndex=app.indexOf('if(tabProduct){closeTabProduct();return true;}');
  const scopedIndex=app.indexOf('if(runScopedAndroidBackAction())return true;');
  const tabIndex=app.indexOf("if(previous||active!=='Home')");
  const rootExitIndex=app.indexOf('return false;',tabIndex);
  assert.ok(commerceIndex>0&&commerceIndex<productIndex);
  assert.ok(productIndex<scopedIndex&&scopedIndex<tabIndex);
  assert.ok(tabIndex<rootExitIndex);
  assert.match(app,/recordNavigationEntry\(commerceHistoryRef\.current,current,next\)/);
  assert.match(app,/recordNavigationEntry\(previousTabsRef\.current,current,next\)/);
  assert.match(app,/recordNavigationEntry\(tabProductHistoryRef\.current,current,product\)/);
  assert.match(app,/commercePage!==['"]store['"]&&styles\.storeLayerHidden/);
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
