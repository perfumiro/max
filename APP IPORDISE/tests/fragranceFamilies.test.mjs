import test from 'node:test';
import assert from 'node:assert/strict';
import {asFragranceFamily,matchesFragranceFamily} from '../src/fragranceFamilies.ts';

const product=(overrides={})=>({id:'sample',brand:'HOUSE',name:'Signature',price:'',oldPrice:'',badge:'',rating:'',reviewCount:0,image:{uri:''},gallery:[],sizes:{},filters:[],active:true,...overrides});

test('fragrance family labels resolve case-insensitively',()=>{
  assert.equal(asFragranceFamily(' fresh '),'Fresh');
  assert.equal(asFragranceFamily('WOODY'),'Woody');
  assert.equal(asFragranceFamily('designer'),null);
});

test('fragrance families match perfume notes and curated catalogue products',()=>{
  assert.equal(matchesFragranceFamily(product({notes:{top:'Bergamot and lemon'}}),'Citrus'),true);
  assert.equal(matchesFragranceFamily(product({description:'A smooth vanilla and tonka trail'}),'Sweet'),true);
  assert.equal(matchesFragranceFamily(product({id:'bleu-de-chanel-eau-de-parfum-spray'}),'Woody'),true);
  assert.equal(matchesFragranceFamily(product({name:'Neutral composition'}),'Floral'),false);
});
