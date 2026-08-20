import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('every bundled perfume includes secondary product photography', async () => {
  const catalog = JSON.parse(await readFile(new URL('../website-ipordise/catalog.json', import.meta.url), 'utf8'));
  assert.equal(catalog.products.length, 51);
  for (const product of catalog.products) {
    assert.ok(product.gallery.length > 1, `${product.id} needs more than one gallery image`);
  }
});

test('bundled gallery files exist and use mobile-compatible formats', async () => {
  const catalog = JSON.parse(await readFile(new URL('../website-ipordise/catalog.json', import.meta.url), 'utf8'));
  const supported = catalog.products.flatMap(product => product.gallery)
    .filter(image => /\.(?:jpe?g|png|webp)$/i.test(image));
  assert.ok(supported.length >= catalog.products.length * 2);
  await Promise.all(supported.map(image => access(new URL(`../website-ipordise/${image.replace(/^\//, '')}`, import.meta.url))));
});

test('all catalogue adapters merge the live and bundled product galleries', async () => {
  const [gallerySource, catalogSource, appSource] = await Promise.all([
    readFile(new URL('../src/productGallery.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/sharedCatalog.ts', import.meta.url), 'utf8'),
    readFile(new URL('../App.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(gallerySource, /export const mergeProductGallery/);
  assert.match(gallerySource, /new Set<string>/);
  assert.equal((catalogSource.match(/mergeProductGallery\(/g) || []).length, 2);
  assert.match(appSource, /setGalleryIndex\(0\);[\s\S]*?\},\[product\.id,stickyProgress\]\)/);
  assert.match(appSource, /setGalleryIndex\(current =>/);
  assert.match(appSource, /detailCounterPremium:\{right:14,bottom:12,minWidth:42,height:27/);
  assert.match(appSource, /detailCounterText:\{fontSize:11,lineHeight:14,fontWeight:'700'/);
});

test('Armani Stronger With You Powerfully exposes its five real photos', async () => {
  const catalog = JSON.parse(await readFile(new URL('../website-ipordise/catalog.json', import.meta.url), 'utf8'));
  const product = catalog.products.find(item => item.id === 'armani-stronger-with-you-powerfully-eau-de-parfum');
  assert.equal(product.gallery.length, 5);
  assert.deepEqual(product.gallery.map(image => image.split('/').pop()), ['1.webp', '2.webp', '3.webp', '4.webp', '5.webp']);
});
