import { loadRuntimeSettings } from '../services/runtimeSettings';

export type ShopLink={id:string;label:string;description:string;filter?:string;query?:string;icon:string;active:boolean;order:number};
export type ShopBanner={eyebrow:string;headline:string;description:string;ctaLabel:string;filter:string;imageUrl?:string;tabletImageUrl?:string;startsAt?:string;endsAt?:string;active:boolean};
export type ShopConfig={banner:ShopBanner;quickLinks:ShopLink[];categories:ShopLink[];familyOrder:string[];featuredBrands:string[];collections:ShopLink[]};

export const defaultShopConfig:ShopConfig={
  banner:{eyebrow:'JUST LANDED',headline:'New arrivals',description:'Meet the fragrances defining now.',ctaLabel:'Explore new arrivals',filter:'new-in',active:true},
  quickLinks:[
    {id:'new',label:'New',description:'Latest arrivals',filter:'new-in',icon:'sparkles-outline',active:true,order:1},
    {id:'best',label:'Bestsellers',description:'Most wanted',filter:'best-sellers',icon:'ribbon-outline',active:true,order:2},
    {id:'offers',label:'Offers',description:'Current reductions',filter:'offers',icon:'ticket-outline',active:true,order:3},
    {id:'under-500',label:'Under 500 MAD',description:'Shop by price',filter:'price-under-500',icon:'wallet-outline',active:true,order:4},
    {id:'gifts',label:'Gift sets',description:'Ready to give',filter:'discovery-sets',icon:'gift-outline',active:true,order:5},
    {id:'miniatures',label:'Miniatures',description:'Smaller formats',filter:'miniatures',icon:'flask-outline',active:true,order:6},
  ],
  categories:[
    {id:'men',label:'For Him',description:'Modern masculine signatures',filter:'for-men',icon:'male-outline',active:true,order:1},
    {id:'women',label:'For Her',description:'Expressive feminine scents',filter:'for-women',icon:'female-outline',active:true,order:2},
    {id:'unisex',label:'Unisex',description:'Signatures without boundaries',filter:'unisex',icon:'male-female-outline',active:true,order:3},
    {id:'gifts',label:'Gift Sets',description:'Thoughtfully selected gifts',filter:'discovery-sets',icon:'gift-outline',active:true,order:4},
    {id:'miniatures',label:'Miniatures',description:'Discover smaller formats',filter:'miniatures',icon:'flask-outline',active:true,order:5},
    {id:'luxury',label:'Luxury',description:'Rare and distinctive houses',filter:'niche',icon:'diamond-outline',active:true,order:6},
    {id:'new',label:'New Arrivals',description:'The latest additions',filter:'new-in',icon:'sparkles-outline',active:true,order:7},
    {id:'offers',label:'Offers',description:'Special prices available now',filter:'offers',icon:'ticket-outline',active:true,order:8},
  ],
  familyOrder:['Fresh','Floral','Woody','Amber','Citrus','Sweet','Spicy','Aromatic'],
  featuredBrands:[],
  collections:[
    {id:'under-300',label:'Under 300 MAD',description:'Accessible discoveries',filter:'price-under-300',icon:'pricetag-outline',active:true,order:1},
    {id:'under-500',label:'Under 500 MAD',description:'Curated within your budget',filter:'price-under-500',icon:'wallet-outline',active:true,order:2},
    {id:'luxury',label:'Luxury selection',description:'Exceptional compositions',filter:'niche',icon:'diamond-outline',active:true,order:3},
    {id:'offers',label:'Current offers',description:'Live catalogue reductions',filter:'offers',icon:'ticket-outline',active:true,order:4},
  ],
};

const live=(item:{active:boolean;startsAt?:string;endsAt?:string})=>item.active&&(!item.startsAt||Date.now()>=Date.parse(item.startsAt))&&(!item.endsAt||Date.now()<=Date.parse(item.endsAt));
const links=(value:unknown,fallback:ShopLink[])=>Array.isArray(value)?value.filter((item):item is ShopLink=>Boolean(item&&typeof item.id==='string'&&typeof item.label==='string'&&(item.filter||item.query))).map(item=>({...item,description:item.description||'',icon:item.icon||'arrow-forward-outline',active:item.active!==false,order:Number(item.order)||0})).sort((a,b)=>a.order-b.order):fallback;
export function normalizeShopConfig(value:unknown,includeInactive=false):ShopConfig{
  const candidate=(value&&typeof value==='object'?value:{}) as Partial<ShopConfig>;
  const banner={...defaultShopConfig.banner,...(candidate.banner||{})};
  return {banner:includeInactive||live(banner)?banner:{...banner,active:false},quickLinks:links(candidate.quickLinks,defaultShopConfig.quickLinks).filter(item=>includeInactive||item.active),categories:links(candidate.categories,defaultShopConfig.categories).filter(item=>includeInactive||item.active),familyOrder:Array.isArray(candidate.familyOrder)?candidate.familyOrder.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())):defaultShopConfig.familyOrder,featuredBrands:Array.isArray(candidate.featuredBrands)?candidate.featuredBrands.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())):[],collections:links(candidate.collections,defaultShopConfig.collections).filter(item=>includeInactive||item.active)};
}
export async function loadShopConfig():Promise<ShopConfig>{
  return normalizeShopConfig((await loadRuntimeSettings()).shop);
}
