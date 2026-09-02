import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('returning clients receive the branded launch intro on every fresh app mount',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/function LaunchIntro\(\{onFinish\}/);
  assert.match(app,/const \[launching,setLaunching\]=useState\(!previewAdmin&&!previewSkipIntro\)/);
  assert.match(app,/launching\?<LaunchIntro onFinish=\{finishLaunch\}/);
  assert.match(app,/source=\{require\('\.\/assets\/ipordise-app-icon-v2\.png'\)\}/);
  assert.match(app,/Application developed by Zakaria Zemzami/);
  assert.match(app,/APPLICATION DEVELOPED BY/);
  assert.match(app,/ZAKARIA ZEMZAMI/);
  assert.match(app,/MAISON DE PARFUM · MAROC/);
  assert.match(app,/entered \? <StoreScreen \/> : <LocationScreen/);
  assert.match(app,/\{launching\?<LaunchIntro onFinish=\{finishLaunch\}\/>:null\}/);
});

test('classic launch sequence lasts three seconds while the app loads underneath',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/Animated\.delay\(2700\)/);
  assert.match(app,/duration:300/);
  assert.match(app,/Animated\.delay\(50\)/);
  assert.match(app,/duration:650/);
  assert.match(app,/Animated\.delay\(480\)/);
  assert.match(app,/duration:360/);
  assert.match(app,/Animated\.delay\(1660\)/);
  assert.match(app,/duration:450/);
  assert.match(app,/load during the branded three-second opening instead of afterwards/);
});

test('native splash and animated intro share the same dark first frame',async()=>{
  const config=JSON.parse(await readFile(new URL('../app.json',import.meta.url),'utf8'));
  assert.equal(config.expo.splash.backgroundColor,'#030303');
  assert.equal(config.expo.splash.resizeMode,'contain');
  assert.equal(config.expo.icon,'./assets/ipordise-app-icon-v3.png');
  assert.equal(config.expo.splash.image,'./assets/ipordise-app-icon-v3.png');
  assert.equal(config.expo.android.adaptiveIcon.foregroundImage,'./assets/ipordise-app-icon-v3.png');
});

test('launch animation respects reduced-motion preferences',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(app,/if\(reduceMotion\)/);
});
