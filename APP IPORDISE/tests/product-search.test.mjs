import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizeSearchText, searchProducts } from '../src/productSearch.ts';

const products=[
  {id:'alexandria-ii',brand:'XERJOFF',name:'Alexandria II',filters:['niche','unisex'],accords:['Amber Oud'],notes:{top:'Bergamot Cardamom',base:'Vanilla Sandalwood'}},
  {id:'dior-sauvage',brand:'DIOR',name:'Sauvage Eau de Parfum',filters:['best-sellers','for-men'],description:'Fresh spicy signature'},
  {id:'ysl-y',brand:'YVES SAINT LAURENT',name:'Y Eau de Parfum',filters:['designer','for-men']},
  {id:'chanel-chance',brand:'CHANEL',name:'Chance Eau Tendre',filters:['designer','for-women','offers'],accords:['Floral Fruity']},
];

test('search normalization ignores accents, punctuation, and apostrophes',()=>{
  assert.equal(normalizeSearchText("L’Homme Idéal — Extrême"),'lhomme ideal extreme');
});

test('product search matches multiple terms across brand, name, notes, and collections',()=>{
  assert.equal(searchProducts(products,'xerjoff vanilla')[0]?.id,'alexandria-ii');
  assert.equal(searchProducts(products,'best sellers')[0]?.id,'dior-sauvage');
  assert.equal(searchProducts(products,'saint laurent parfum')[0]?.id,'ysl-y');
});

test('product search ranks exact brand and name matches first and tolerates one typo',()=>{
  assert.equal(searchProducts(products,'dior')[0]?.brand,'DIOR');
  assert.equal(searchProducts(products,'alexandria')[0]?.id,'alexandria-ii');
  assert.equal(searchProducts(products,'sauvag')[0]?.id,'dior-sauvage');
});

test('product search understands multilingual shopping intent and longer typos',()=>{
  assert.equal(searchProducts(products,'parfum pour homme')[0]?.id,'dior-sauvage');
  assert.equal(searchProducts(products,'parfum femme')[0]?.id,'chanel-chance');
  assert.equal(searchProducts(products,'رجالي')[0]?.id,'dior-sauvage');
  assert.equal(searchProducts(products,'offre femme')[0]?.id,'chanel-chance');
  assert.equal(searchProducts(products,'sauvagge')[0]?.id,'dior-sauvage');
});

test('home brand logos open an explicit brand-filtered perfume destination',async()=>{
  const app=await readFile(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/onPress=\{\(\)=>onBrand\(house\.name\)\}/);
  assert.match(app,/const openBrand=\(brand:string\)=>/);
  assert.match(app,/setSelectedBrand\(brand\)/);
  assert.match(app,/new URLSearchParams\(\{store:'1',brand\}\)/);
  assert.match(app,/<HomeBrands layout=\{layout\} onBrand=\{onBrand\}/);
});
