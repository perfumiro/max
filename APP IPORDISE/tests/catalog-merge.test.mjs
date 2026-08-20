import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCatalogProducts } from '../src/catalogMerge.ts';

const product=(id,filters,name=id)=>({id,name,filters});

test('catalog merge keeps checkout-only women fragrances visible',()=>{
  const firebase=[product('live-men',['for-men']),product('shared',['for-men'],'Firebase edit')];
  const checkout=[product('valentino-women',['for-women']),product('shared',['for-women'],'Stale checkout edit')];
  const merged=mergeCatalogProducts(firebase,checkout);
  assert.equal(merged.length,3);
  assert.equal(merged.find(item=>item.id==='valentino-women')?.filters[0],'for-women');
  assert.equal(merged.find(item=>item.id==='shared')?.name,'Firebase edit');
});
