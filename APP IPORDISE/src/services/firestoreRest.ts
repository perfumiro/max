import { appConfig } from '../config';

type JsonMap=Record<string,any>;

export const decodeFirestoreValue=(value:any):any=>{
  if(!value||typeof value!=='object')return value;
  if('stringValue'in value)return value.stringValue;
  if('booleanValue'in value)return value.booleanValue;
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return Number(value.doubleValue);
  if('timestampValue'in value)return value.timestampValue;
  if('nullValue'in value)return null;
  if('arrayValue'in value)return(value.arrayValue.values||[]).map(decodeFirestoreValue);
  if('mapValue'in value)return decodeFirestoreFields(value.mapValue.fields||{});
  return undefined;
};

export const decodeFirestoreFields=(fields:JsonMap):JsonMap=>Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,decodeFirestoreValue(value)]));

export const encodeFirestoreValue=(value:any):any=>{
  if(value===null||value===undefined)return{nullValue:null};
  if(typeof value==='boolean')return{booleanValue:value};
  if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(typeof value==='string')return{stringValue:value};
  if(Array.isArray(value))return{arrayValue:{values:value.map(encodeFirestoreValue)}};
  if(typeof value==='object')return{mapValue:{fields:encodeFirestoreFields(value)}};
  return{stringValue:String(value)};
};

export const encodeFirestoreFields=(value:JsonMap):JsonMap=>Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encodeFirestoreValue(item)]));

export const publicFirestoreUrl=(path:string)=>`${appConfig.firestoreRoot}/${path}?key=${encodeURIComponent(appConfig.firebaseApiKey)}`;

export const parseFirestoreDocument=(body:any):JsonMap=>({id:String(body?.name||'').split('/').pop()||'',...decodeFirestoreFields(body?.fields||{})});
