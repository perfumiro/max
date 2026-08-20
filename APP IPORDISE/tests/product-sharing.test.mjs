import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('product sharing creates a branded price card and exact product link',async()=>{
  const [app,card]=await Promise.all([read('App.tsx'),read('src/sharing/productShareCard.ts')]);
  assert.match(app,/searchParams\.set\('product',product\.id\)/);
  assert.match(app,/createProductShareCard\(\{brand:product\.brand,name:product\.name,size:displaySize\(size\),price:selectedPrice/);
  assert.match(app,/canShare\(\{files:\[card\]\}\)/);
  assert.match(app,/downloadProductShareCard\(card\)/);
  assert.match(app,/clipboard\?\.writeText\(url\)/);
  assert.match(card,/canvas\.width=1080;canvas\.height=1350/);
  assert.match(card,/SAVE \$\{input\.savingPercent\}%/);
  assert.match(card,/DELIVERY ACROSS MOROCCO/);
  assert.match(card,/new File\(\[blob\]/);
});
