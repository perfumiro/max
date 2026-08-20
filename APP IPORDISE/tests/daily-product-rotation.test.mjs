import assert from 'node:assert/strict';
import test from 'node:test';
import { DAILY_ROTATION_MS, dailyRotationKey, millisecondsUntilNextRotation, rotateProductsDaily } from '../src/home/dailyProductRotation.ts';

const products=Array.from({length:20},(_,index)=>({id:`perfume-${index+1}`}));

test('daily perfume edit stays stable throughout the same 24-hour window',()=>{
  const morning=DAILY_ROTATION_MS*2500+1000;
  const evening=morning+DAILY_ROTATION_MS-2000;
  assert.equal(dailyRotationKey(morning),dailyRotationKey(evening));
  assert.deepEqual(rotateProductsDaily(products,dailyRotationKey(morning)),rotateProductsDaily(products,dailyRotationKey(evening)));
});

test('daily perfume edit changes at the next 24-hour boundary without losing products',()=>{
  const today=rotateProductsDaily(products,2500);
  const tomorrow=rotateProductsDaily(products,2501);
  assert.notDeepEqual(today,tomorrow);
  assert.deepEqual(today.map(item=>item.id).sort(),products.map(item=>item.id).sort());
  assert.deepEqual(tomorrow.map(item=>item.id).sort(),products.map(item=>item.id).sort());
});

test('next rotation delay points to the following daily boundary',()=>{
  assert.equal(millisecondsUntilNextRotation(DAILY_ROTATION_MS*4+1234),DAILY_ROTATION_MS-1234);
});
