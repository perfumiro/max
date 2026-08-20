import { loadRuntimeSettings } from '../services/runtimeSettings';

export type SupportDay={day:number;open:string;close:string;closed:boolean};
export type HelpFaq={id:string;category:string;question:string;answer:string;keywords:string[];active:boolean;order:number};
export type HelpPolicy={id:string;title:string;body:string;active:boolean;order:number};
export type HelpTopic={id:'track'|'delivery'|'orders'|'payments'|'products'|'account'|'contact'|'faq'|'advice';title:string;description:string;icon:string;active:boolean;order:number};
export type HelpConfig={
  timezone:string;
  availabilityOverride:'auto'|'online'|'offline';
  temporaryClosure:boolean;
  holidayClosures:string[];
  businessHours:SupportDay[];
  expectedResponse:string;
  contacts:{whatsapp:string;phone:string;email:string};
  topics:HelpTopic[];
  faqs:HelpFaq[];
  deliveryPolicies:HelpPolicy[];
  adviceQuestions:string[];
};

export const defaultHelpConfig:HelpConfig={
  timezone:'Africa/Casablanca',availabilityOverride:'auto',temporaryClosure:false,holidayClosures:[],businessHours:[],expectedResponse:'',
  contacts:{whatsapp:'',phone:'',email:''},
  topics:[
    {id:'track',title:'Track my order',description:'View live status and delivery updates',icon:'cube-outline',active:true,order:1},
    {id:'delivery',title:'Delivery & returns',description:'Delivery times, fees, exchanges and returns',icon:'swap-horizontal-outline',active:true,order:2},
    {id:'orders',title:'Orders',description:'Manage, change or understand an order',icon:'receipt-outline',active:true,order:3},
    {id:'payments',title:'Payments',description:'Payment methods and pay-on-delivery help',icon:'card-outline',active:true,order:4},
    {id:'products',title:'Products & fragrances',description:'Authenticity, sizes and fragrance advice',icon:'sparkles-outline',active:true,order:5},
    {id:'account',title:'Account & security',description:'Sign-in, profile and privacy assistance',icon:'person-circle-outline',active:true,order:6},
    {id:'contact',title:'Contact support',description:'Speak with the IPORDISE customer-care team',icon:'chatbubble-ellipses-outline',active:true,order:7},
    {id:'faq',title:'Frequently asked questions',description:'Browse the most useful customer answers',icon:'help-circle-outline',active:true,order:8},
  ],
  faqs:[
    {id:'authenticity',category:'Authenticity',question:'Are all IPORDISE fragrances authentic?',answer:'IPORDISE presents authentic fragrances sourced with care. Contact our team if you need information about a specific product.',keywords:['original','genuine','authentic','أصلي','authentique'],active:true,order:1},
    {id:'delivery-time',category:'Delivery',question:'How long does delivery take?',answer:'Delivery timing depends on your location and is confirmed with your order. Track an existing order for its latest verified status.',keywords:['shipping','morocco','livraison','توصيل'],active:true,order:2},
    {id:'payment',category:'Payments',question:'Can I pay when my order arrives?',answer:'Pay on delivery is supported where shown during checkout. The final payment method is confirmed before you place the order.',keywords:['cash','cod','payment','paiement','الدفع'],active:true,order:3},
    {id:'change-order',category:'Orders',question:'How can I change my order?',answer:'Contact IPORDISE Care promptly with your verified order number. Changes depend on the order’s current fulfilment status.',keywords:['cancel','modify','change','commande','تعديل'],active:true,order:4},
    {id:'missed-delivery',category:'Delivery',question:'What happens if I miss the delivery?',answer:'Contact the delivery team or IPORDISE Care using your order number so the available next step can be confirmed.',keywords:['failed','attempt','absent','livraison','توصيل'],active:true,order:5},
    {id:'opened-return',category:'Returns',question:'Can I return an opened perfume?',answer:'Return eligibility depends on product condition and the current return policy. Contact Care before sending any product back.',keywords:['return','opened','exchange','retour','إرجاع'],active:true,order:6},
    {id:'choose-fragrance',category:'Fragrance advice',question:'How do I choose the right fragrance?',answer:'Use our fragrance finder for a tailored starting point, or speak with a fragrance specialist for personal guidance.',keywords:['notes','family','scent','parfum','عطر'],active:true,order:7},
  ],
  deliveryPolicies:[],adviceQuestions:['recipient','family','occasion','intensity','budget'],
};

const string=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const array=<T>(value:unknown,fallback:T[])=>Array.isArray(value)?value as T[]:fallback;
export const normalizeHelpConfig=(value:unknown):HelpConfig=>{
  const raw=value&&typeof value==='object'?value as Record<string,any>:{};
  const contacts=raw.contacts&&typeof raw.contacts==='object'?raw.contacts:{};
  const configuredFaqs=Array.isArray(raw.faqs)&&raw.faqs.length?raw.faqs:defaultHelpConfig.faqs;
  return {
    timezone:string(raw.timezone,defaultHelpConfig.timezone),availabilityOverride:['online','offline'].includes(raw.availabilityOverride)?raw.availabilityOverride:'auto',temporaryClosure:raw.temporaryClosure===true,
    holidayClosures:array<string>(raw.holidayClosures,[]).filter(item=>typeof item==='string'),businessHours:array<SupportDay>(raw.businessHours,[]).filter(item=>Number.isInteger(item?.day)&&typeof item?.open==='string'&&typeof item?.close==='string'),expectedResponse:string(raw.expectedResponse),
    contacts:{whatsapp:string(contacts.whatsapp),phone:string(contacts.phone),email:string(contacts.email)},
    topics:(()=>{const configured=array<HelpTopic>(raw.topics,[]).filter(item=>item&&item.active!==false);const byId=new Map(configured.map(item=>[item.id,item]));return defaultHelpConfig.topics.map(item=>byId.get(item.id)||item).filter(item=>item.active!==false).sort((a,b)=>(a.order||0)-(b.order||0));})(),
    faqs:array<HelpFaq>(configuredFaqs,defaultHelpConfig.faqs).filter(item=>item&&item.active!==false&&item.question&&item.answer).sort((a,b)=>(a.order||0)-(b.order||0)),
    deliveryPolicies:array<HelpPolicy>(raw.deliveryPolicies,[]).filter(item=>item&&item.active!==false&&item.title&&item.body).sort((a,b)=>(a.order||0)-(b.order||0)),adviceQuestions:array<string>(raw.adviceQuestions,defaultHelpConfig.adviceQuestions),
  };
};

export async function loadHelpConfig(){
  return normalizeHelpConfig((await loadRuntimeSettings()).help);
}
