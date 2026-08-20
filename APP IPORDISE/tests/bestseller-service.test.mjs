import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { rankBestsellerProductIds } from '../src/services/bestsellerRanking.ts';

test('bestsellers are ranked from non-cancelled dashboard order quantities', () => {
  const ranking=rankBestsellerProductIds([
    {status:'delivered',items:[{productId:'alpha',quantity:2},{productId:'beta',qty:1}]},
    {status:'processing',items:[{productId:'beta',quantity:3}]},
    {status:'cancelled',items:[{productId:'alpha',quantity:20}]},
    {status:'confirmed',items:[{productId:'gamma',quantity:2},{name:'Legacy Product',quantity:1}]},
  ]);
  assert.deepEqual(ranking,['beta','alpha','gamma','name:legacy product']);
});

test('homepage exposes a ten-product daily Our products edit with progressive discovery', async () => {
  const [source,service]=await Promise.all([readFile(new URL('../App.tsx',import.meta.url),'utf8'),readFile(new URL('../src/services/bestsellerService.ts',import.meta.url),'utf8')]);
  assert.match(source,/title="Bestsellers"/);
  assert.match(source,/loadBestsellerProductIds/);
  assert.match(service,/mask\.fieldPaths.*items/);
  assert.match(source,/function HomeProductsGrid/);
  assert.match(source,/useState\(10\)/);
  assert.match(source,/THE DAILY EDIT/);
  assert.match(source,/rotateProductsDaily/);
  assert.match(source,/Explore today&apos;s selection/);
  assert.match(source,/const nextCount=Math\.min\(10,remaining\)/);
  assert.match(source,/item==='products'/);
});

test('homepage exposes Xerjoff and Unique house edits using canonical catalogue prices', async () => {
  const [source,config]=await Promise.all([readFile(new URL('../App.tsx',import.meta.url),'utf8'),readFile(new URL('../src/home/homeConfig.ts',import.meta.url),'utf8')]);
  assert.match(source,/title="The House of Xerjoff"/);
  assert.match(source,/title="Unique’e Luxury"/);
  assert.match(source,/homeProducts\.filter\(product=>product\.brand\.toUpperCase\(\)\.includes\('XERJOFF'\)\)/);
  assert.match(source,/homeProducts\.filter\(product=>product\.brand\.toUpperCase\(\)\.includes\('UNIQUE'\)\)/);
  assert.doesNotMatch(source,/const catalogProducts: Product\[\]/);
  assert.match(config,/\['xerjoff','unique','products'\]/);
});
