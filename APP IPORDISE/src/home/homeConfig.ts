import { loadRuntimeSettings } from '../services/runtimeSettings';

export type HomeHeroSlide = {
  id: string;
  eyebrow: string;
  headline: string;
  description: string;
  ctaLabel: string;
  destination: string;
  imageUrl?: string;
  tabletImageUrl?: string;
  active: boolean;
  order: number;
  startsAt?: string;
  endsAt?: string;
};

export type HomeCategory = {
  id: string;
  label: string;
  filter: string;
  icon: string;
  active: boolean;
  order: number;
};

export type HomeConfig = {
  announcements: string[];
  heroSlides: HomeHeroSlide[];
  categories: HomeCategory[];
  sectionOrder: string[];
  hiddenSections: string[];
  featuredBrands: string[];
};

export const defaultHomeConfig: HomeConfig = {
  announcements:['100% authentic fragrances','Delivery across Morocco','Pay when your order arrives','Carefully prepared by IPORDISE'],
  heroSlides:[
    {id:'new-arrivals',eyebrow:'JUST LANDED · MOROCCO',headline:'Find your next signature.',description:'New fragrances selected for character, quality and lasting presence.',ctaLabel:'Shop new arrivals',destination:'new-in',active:true,order:1},
    {id:'bestsellers',eyebrow:'MOST WANTED',headline:'Icons, chosen again.',description:'Discover the fragrances our clients return to season after season.',ctaLabel:'Explore bestsellers',destination:'best-sellers',active:true,order:2},
    {id:'luxury',eyebrow:'THE CONNOISSEUR EDIT',headline:'Rare by nature.',description:'Independent houses and exceptional compositions for collectors.',ctaLabel:'Discover luxury',destination:'niche',active:true,order:3},
    {id:'discovery',eyebrow:'START YOUR JOURNEY',headline:'Begin with discovery.',description:'Explore smaller formats before choosing your full bottle.',ctaLabel:'Shop discovery sets',destination:'discovery-sets',active:true,order:4},
  ],
  categories:[
    {id:'new',label:'New arrivals',filter:'new-in',icon:'sparkles-outline',active:true,order:1},
    {id:'women',label:'Women',filter:'for-women',icon:'female-outline',active:true,order:2},
    {id:'men',label:'Men',filter:'for-men',icon:'male-outline',active:true,order:3},
    {id:'unisex',label:'Unisex',filter:'unisex',icon:'male-female-outline',active:true,order:4},
    {id:'luxury',label:'Luxury',filter:'niche',icon:'diamond-outline',active:true,order:5},
    {id:'gifts',label:'Gift sets',filter:'discovery-sets',icon:'gift-outline',active:true,order:6},
    {id:'miniatures',label:'Miniatures',filter:'miniatures',icon:'flask-outline',active:true,order:7},
    {id:'offers',label:'Offers',filter:'offers',icon:'ticket-outline',active:true,order:8},
  ],
  sectionOrder:['benefits','categories','hero','offers','bestsellers','xerjoff','unique','products','seasonal','families','new','brands','trust'],
  hiddenSections:[],
  featuredBrands:[],
};

const isCurrent=(slide:HomeHeroSlide,now=Date.now())=>(!slide.startsAt||Date.parse(slide.startsAt)<=now)&&(!slide.endsAt||Date.parse(slide.endsAt)>=now);

export function normalizeHomeConfig(value:unknown,includeInactive=false):HomeConfig {
  const candidate=(value&&typeof value==='object'?(value as Record<string,unknown>).homepage:null) as Partial<HomeConfig>|null;
  if(!candidate)return defaultHomeConfig;
  const configuredOrder=Array.isArray(candidate.sectionOrder)?candidate.sectionOrder.filter((item):item is string=>typeof item==='string'):defaultHomeConfig.sectionOrder;
  const desiredSections=['xerjoff','unique','products'];
  const anchorIndex=configuredOrder.indexOf('bestsellers');
  const insertAt=anchorIndex>=0?anchorIndex+1:configuredOrder.length;
  const sectionOrder=[...configuredOrder];
  desiredSections.forEach((section,offset)=>{if(!sectionOrder.includes(section))sectionOrder.splice(insertAt+offset,0,section);});
  return {
    announcements:Array.isArray(candidate.announcements)&&candidate.announcements.length?candidate.announcements.filter((item):item is string=>typeof item==='string'&&item.trim().length>0):defaultHomeConfig.announcements,
    heroSlides:Array.isArray(candidate.heroSlides)?candidate.heroSlides.filter((item):item is HomeHeroSlide=>Boolean(item&&typeof item.id==='string'&&typeof item.destination==='string'&&(includeInactive||(item.active&&isCurrent(item))))).sort((a,b)=>a.order-b.order):defaultHomeConfig.heroSlides,
    categories:Array.isArray(candidate.categories)?candidate.categories.filter((item):item is HomeCategory=>Boolean(item&&typeof item.id==='string'&&typeof item.filter==='string'&&(includeInactive||item.active))).sort((a,b)=>a.order-b.order):defaultHomeConfig.categories,
    sectionOrder,
    hiddenSections:Array.isArray(candidate.hiddenSections)?candidate.hiddenSections.filter((item):item is string=>typeof item==='string'):[],
    featuredBrands:Array.isArray(candidate.featuredBrands)?candidate.featuredBrands.filter((item):item is string=>typeof item==='string'):[],
  };
}

export async function loadHomeConfig():Promise<HomeConfig> {
  return normalizeHomeConfig(await loadRuntimeSettings());
}
