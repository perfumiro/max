import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfferVariants, isEligibleOffer, summarizeOffer } from '../src/offers/offerPricing.ts';

const product=(patch={})=>({id:'offer-1',brand:'IPORDISE',name:'Signature',price:'800 MAD',oldPrice:'1,000 MAD',badge:'OFFER',rating:'4.8',reviewCount:0,image:{uri:'https://example.com/a.jpg'},gallery:[],sizes:{'50ml':450,'100ml':800},originalSizes:{'50ml':500,'100ml':1000},filters:['offers','unisex'],active:true,...patch});

test('offer pricing uses backend variant prices and chooses the greatest real saving',()=>{
  assert.equal(getOfferVariants(product()).length,2);
  assert.deepEqual(summarizeOffer(product()),{size:'100ml',price:800,original:1000,saved:200,discount:20});
});

test('invalid sale prices never become offers',()=>{
  assert.equal(isEligibleOffer(product({sizes:{'100ml':1000},originalSizes:{'100ml':1000}})),false);
});

test('inactive, future, and expired offers are hidden',()=>{
  const now=Date.parse('2026-08-06T12:00:00Z');
  assert.equal(isEligibleOffer(product({active:false}),now),false);
  assert.equal(isEligibleOffer(product({offerStart:'2026-08-07T00:00:00Z'}),now),false);
  assert.equal(isEligibleOffer(product({offerEnd:'2026-08-05T23:59:59Z'}),now),false);
  assert.equal(isEligibleOffer(product({offerStart:'2026-08-01T00:00:00Z',offerEnd:'2026-08-07T00:00:00Z'}),now),true);
});

test('out-of-stock offer remains identifiable so the UI can disable its action',()=>{
  assert.equal(isEligibleOffer(product({stockLeft:0})),true);
});
