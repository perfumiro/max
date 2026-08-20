import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('returning clients receive the branded launch intro on every fresh app mount',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/function LaunchIntro\(\{onFinish\}/);
  assert.match(app,/const \[launching,setLaunching\]=useState\(Platform\.OS===['"]web['"]&&!previewAdmin&&!previewSkipIntro\)/);
  assert.match(app,/launching\?<LaunchIntro onFinish=\{finishLaunch\}/);
  assert.match(app,/IPORDISE<\/SvgText>/);
  assert.match(app,/PARFUMERIE · MAROC/);
});

test('native splash and animated intro share the same dark first frame',async()=>{
  const config=JSON.parse(await readFile(new URL('../app.json',import.meta.url),'utf8'));
  assert.equal(config.expo.splash.backgroundColor,'#030303');
  assert.equal(config.expo.splash.resizeMode,'contain');
});

test('launch animation respects reduced-motion preferences',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/AccessibilityInfo\.isReduceMotionEnabled\(\)/);
  assert.match(app,/if\(reduceMotion\)/);
});
