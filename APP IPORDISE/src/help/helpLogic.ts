import type { HelpConfig, HelpFaq } from './helpConfig';

const partsAt=(date:Date,timeZone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));

export function resolveSupportAvailability(config:HelpConfig,date=new Date()){
  if(config.availabilityOverride==='online'&&!config.temporaryClosure)return {available:true,reason:'override' as const};
  if(config.availabilityOverride==='offline'||config.temporaryClosure)return {available:false,reason:'closure' as const};
  const parts=partsAt(date,config.timezone);const localDate=`${parts.year}-${parts.month}-${parts.day}`;
  if(config.holidayClosures.includes(localDate))return {available:false,reason:'holiday' as const};
  const weekdays:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};const schedule=config.businessHours.find(item=>item.day===weekdays[parts.weekday]);
  if(!schedule||schedule.closed)return {available:false,reason:'hours' as const};
  const current=Number(parts.hour)*60+Number(parts.minute);const [oh,om]=schedule.open.split(':').map(Number);const [ch,cm]=schedule.close.split(':').map(Number);
  return {available:current>=oh*60+om&&current<ch*60+cm,reason:'hours' as const};
}

export const normalizeHelpSearch=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const searchHelpFaqs=(faqs:HelpFaq[],query:string)=>{
  const term=normalizeHelpSearch(query);if(!term)return faqs;
  return faqs.filter(item=>normalizeHelpSearch(`${item.question} ${item.answer} ${item.category} ${(item.keywords||[]).join(' ')}`).includes(term));
};
