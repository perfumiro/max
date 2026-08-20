export type SearchableProduct = {
  id: string;
  brand: string;
  name: string;
  badge?: string;
  filters?: string[];
  description?: string;
  ingredients?: string;
  accords?: string[];
  notes?: Record<string, string | undefined>;
};

export const normalizeSearchText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/['’`]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();

const editDistanceAtMostOne = (left: string, right: string) => {
  if (Math.abs(left.length-right.length)>1) return false;
  let edits=0;let i=0;let j=0;
  while(i<left.length&&j<right.length){
    if(left[i]===right[j]){i+=1;j+=1;continue;}
    edits+=1;if(edits>1)return false;
    if(left.length>right.length)i+=1;else if(right.length>left.length)j+=1;else{i+=1;j+=1;}
  }
  return edits+(i<left.length||j<right.length?1:0)<=1;
};

type SearchFields={brand:string;name:string;details:string;all:string};
const searchFieldCache=new WeakMap<object,SearchFields>();

const searchableFields = (product: SearchableProduct):SearchFields => {
  const cached=searchFieldCache.get(product as object);
  if(cached)return cached;
  const brand=normalizeSearchText(product.brand);
  const name=normalizeSearchText(product.name);
  const details=normalizeSearchText([
    product.id,product.badge,...(product.filters||[]),product.description,product.ingredients,
    ...(product.accords||[]),...Object.values(product.notes||{}),
  ].join(' '));
  const fields={brand,name,details,all:`${brand} ${name} ${details}`.trim()};
  searchFieldCache.set(product as object,fields);
  return fields;
};

const termScore = (term:string,fields:ReturnType<typeof searchableFields>):number => {
  if(fields.brand===term)return 120;
  if(fields.name===term)return 115;
  if(fields.brand.startsWith(term))return 90;
  if(fields.name.startsWith(term))return 85;
  const words=fields.all.split(' ');
  if(words.some(word=>word===term))return 65;
  if(words.some(word=>word.startsWith(term)))return 48;
  if(fields.all.includes(term))return 32;
  if(term.length>=4&&words.some(word=>editDistanceAtMostOne(term,word)))return 18;
  return 0;
};

export function searchProducts<T extends SearchableProduct>(products:T[],query:string):T[] {
  const normalized=normalizeSearchText(query);
  if(!normalized)return products;
  const terms=[...new Set(normalized.split(' ').filter(Boolean))];
  return products.map((product,index)=>{
    const fields=searchableFields(product);
    const scores=terms.map(term=>termScore(term,fields));
    const phraseBonus=fields.name.includes(normalized)?80:fields.brand.includes(normalized)?70:fields.all.includes(normalized)?35:0;
    return {product,index,score:scores.reduce<number>((sum,value)=>sum+value,0)+phraseBonus,matched:scores.every(value=>value>0)};
  }).filter(result=>result.matched).sort((a,b)=>b.score-a.score||a.index-b.index).map(result=>result.product);
}
