import { loadRuntimeSettings } from '../services/runtimeSettings';

export type OfferHeroConfig = {
  eyebrow:string;
  heading:string;
  description:string;
  ctaLabel:string;
  destination:string;
  backgroundImage:string;
  mobileImage:string;
  tabletImage:string;
  active:boolean;
  startsAt:string;
  endsAt:string;
};

export const defaultOfferHero:OfferHeroConfig={
  eyebrow:'PRIVATE PRICES · LIMITED TIME',
  heading:'Exceptional scents. Special prices.',
  description:'Selected fragrance offers and private discovery privileges, curated for Morocco.',
  ctaLabel:'SHOP ALL OFFERS.',
  destination:'offers',
  backgroundImage:'',
  mobileImage:'',
  tabletImage:'',
  active:true,
  startsAt:'',
  endsAt:'',
};

const text=(value:unknown,fallback:string)=>typeof value==='string'?value:fallback;
export const normalizeOfferHero=(value:unknown):OfferHeroConfig=>{
  const raw=value&&typeof value==='object'?value as Record<string,unknown>:{};
  return {
    eyebrow:text(raw.eyebrow,defaultOfferHero.eyebrow),
    heading:text(raw.heading,defaultOfferHero.heading),
    description:text(raw.description,defaultOfferHero.description),
    ctaLabel:text(raw.ctaLabel,defaultOfferHero.ctaLabel),
    destination:text(raw.destination,defaultOfferHero.destination),
    backgroundImage:text(raw.backgroundImage,''),
    mobileImage:text(raw.mobileImage,''),
    tabletImage:text(raw.tabletImage,''),
    active:raw.active!==false,
    startsAt:text(raw.startsAt,''),
    endsAt:text(raw.endsAt,''),
  };
};

export async function loadOfferHero(){
  return normalizeOfferHero((await loadRuntimeSettings()).offers);
}

export const isScheduledNow=(startsAt:string,endsAt:string,now=Date.now())=>{
  const start=startsAt?Date.parse(startsAt):Number.NaN;
  const end=endsAt?Date.parse(endsAt):Number.NaN;
  return (!Number.isFinite(start)||start<=now)&&(!Number.isFinite(end)||end>=now);
};
