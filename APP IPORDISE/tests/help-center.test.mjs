import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupportAvailability, searchHelpFaqs } from '../src/help/helpLogic.ts';

const config={timezone:'Africa/Casablanca',availabilityOverride:'auto',temporaryClosure:false,holidayClosures:[],businessHours:[{day:1,open:'09:00',close:'18:00',closed:false}]};

test('support availability respects Casablanca hours, closures, holidays, and overrides',()=>{
  assert.equal(resolveSupportAvailability(config,new Date('2026-08-03T10:00:00Z')).available,true);
  assert.equal(resolveSupportAvailability(config,new Date('2026-08-03T20:00:00Z')).available,false);
  assert.equal(resolveSupportAvailability({...config,temporaryClosure:true},new Date('2026-08-03T10:00:00Z')).available,false);
  assert.equal(resolveSupportAvailability({...config,availabilityOverride:'online'},new Date('2026-08-03T20:00:00Z')).available,true);
  assert.equal(resolveSupportAvailability({...config,holidayClosures:['2026-08-03']},new Date('2026-08-03T10:00:00Z')).available,false);
});

test('help search matches English, French, and Arabic keywords',()=>{
  const faqs=[{id:'delivery',category:'Delivery',question:'How long does delivery take?',answer:'Track your order.',keywords:['livraison','توصيل'],active:true,order:1}];
  assert.equal(searchHelpFaqs(faqs,'delivery').length,1);
  assert.equal(searchHelpFaqs(faqs,'livraison').length,1);
  assert.equal(searchHelpFaqs(faqs,'توصيل').length,1);
  assert.equal(searchHelpFaqs(faqs,'refund').length,0);
});
