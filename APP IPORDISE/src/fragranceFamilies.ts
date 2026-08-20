import type { Product } from './sharedCatalog';

export const fragranceFamilyLabels = ['Fresh','Floral','Woody','Amber','Citrus','Sweet'] as const;
export type FragranceFamily = typeof fragranceFamilyLabels[number];

const familyKeywords: Record<FragranceFamily,string[]> = {
  Fresh:['fresh','aquatic','marine','ocean','ozonic','mint','aromatic','lavender','clean','airy','green'],
  Floral:['floral','flower','rose','jasmine','peony','iris','violet','orange blossom','tuberose','ylang'],
  Woody:['woody','wood','cedar','sandalwood','oud','woud','vetiver','patchouli','oak','cypress'],
  Amber:['amber','resin','benzoin','incense','labdanum','warm','spice','tobacco','leather'],
  Citrus:['citrus','bergamot','lemon','orange','mandarin','grapefruit','lime','neroli'],
  Sweet:['sweet','vanilla','caramel','tonka','chocolate','gourmand','honey','praline','cocoa'],
};

const curatedProductIds: Record<FragranceFamily,string[]> = {
  Fresh:['dior-sauvage-eau-de-parfum','bleu-de-chanel-eau-de-parfum-spray','yves-saint-laurent-y-eau-de-parfum','akdeniz-unique-e-luxury','ocean-the-rive-unique-e-luxury','erba-pura'],
  Floral:['valentino-donna-born-in-roma-eau-de-parfum','valentino-born-in-roma-donna-intense-eau-de-parfum','erba-pura'],
  Woody:['dior-sauvage-eau-de-parfum','bleu-de-chanel-eau-de-parfum-spray','alexandria-ii','woud-and-mood-absolute-by-unique-e-luxury','kutay'],
  Amber:['emporio-armani-stronger-with-you-intensely-edp','jean-paul-gaultier-le-male-elixir-eau-de-parfum','azzaro-the-most-wanted-eau-de-parfum-intense','alexandria-ii','kutay'],
  Citrus:['yves-saint-laurent-y-eau-de-parfum','akdeniz-unique-e-luxury','ocean-the-rive-unique-e-luxury','erba-pura'],
  Sweet:['emporio-armani-stronger-with-you-intensely-edp','jean-paul-gaultier-le-male-elixir-eau-de-parfum','azzaro-the-most-wanted-eau-de-parfum-intense','valentino-born-in-roma-donna-intense-eau-de-parfum','aphrodisiac-touch','chocolate-makes-me-happy','erba-pura'],
};

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function asFragranceFamily(value:string):FragranceFamily|null {
  const normalized=normalize(value.trim());
  return fragranceFamilyLabels.find(label=>normalize(label)===normalized)||null;
}

export function matchesFragranceFamily(product:Product,family:FragranceFamily):boolean {
  if(curatedProductIds[family].includes(product.id))return true;
  const searchable=normalize([product.name,product.brand,product.description||'',product.notes?.top||'',product.notes?.heart||'',product.notes?.base||'',...product.filters].join(' '));
  return familyKeywords[family].some(keyword=>searchable.includes(normalize(keyword)));
}
