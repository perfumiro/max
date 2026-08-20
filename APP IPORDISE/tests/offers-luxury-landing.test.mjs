import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('offers empty state keeps real commerce actions in a restrained luxury landing', async () => {
  const source = await readFile(new URL('../src/offers/OffersScreen.tsx', import.meta.url), 'utf8');

  assert.match(source, /IPORDISE PRIVATE OFFERS/);
  assert.match(source, /Something special is being prepared\./);
  assert.match(source, /Smart pricing/);
  assert.match(source, /onPress=\{onExplore\}/);
  assert.match(source, /onPress=\{\(\)=>onOpen\(product\)\}/);
  assert.match(source, /SmoothScrollView as ScrollView/);
  assert.match(source, /emptyPickImageWrap/);
  assert.match(source, /emptyPickFooter/);
  assert.match(source, /ADD TO BAG/);
  assert.match(source, /priceLine/);
  assert.match(source, /toggleFavourite\(product\)/);
  assert.match(source, /addToBag\(product,summary\.size\)/);
  assert.doesNotMatch(source, /Offers appear automatically|style=\{styles\.emptyBenefitIcon\}/);
});
