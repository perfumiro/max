import { appConfig } from '../config';
import { logger } from '../observability/logger';
import { parseFirestoreDocument, publicFirestoreUrl } from './firestoreRest';
import { apiRequest } from './apiClient';

export const RUNTIME_SETTINGS_DOCUMENT='products/_app_config';
type RuntimeSettings=Record<string,unknown>;

let cached:RuntimeSettings|null=null;
let cachedUntil=0;
let inflight:Promise<RuntimeSettings>|null=null;

const fetchFirebaseSettings=async():Promise<RuntimeSettings>=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),appConfig.requestTimeoutMs);
  try{
    const response=await fetch(publicFirestoreUrl(RUNTIME_SETTINGS_DOCUMENT),{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}});
    if(!response.ok)throw new Error(`Firebase app settings returned HTTP ${response.status}`);
    const {id:_,system:__,active:___,updatedAt:____,...settings}=parseFirestoreDocument(await response.json());
    return settings;
  }finally{clearTimeout(timeout);}
};

const fetchSupabaseSettings=async():Promise<RuntimeSettings>=>{
  const url=appConfig.supabaseUrl,key=appConfig.supabasePublishableKey;
  if(!appConfig.supabaseConfigured||!url||!key)return{};
  const rows=await apiRequest<{value?:RuntimeSettings}[]>(`${url}/rest/v1/store_settings?id=eq.main&select=value`,{headers:{apikey:key,Authorization:`Bearer ${key}`},maxAttempts:2});
  return rows[0]?.value||{};
};

export async function loadRuntimeSettings(force=false):Promise<RuntimeSettings>{
  const now=Date.now();
  if(!force&&cached&&now<cachedUntil)return cached;
  if(inflight)return inflight;
  inflight=(async()=>{
    let settings:RuntimeSettings={};
    try{settings=await fetchFirebaseSettings();}
    catch(firebaseError){
      logger.warn('firebase_runtime_settings_unavailable',{error:firebaseError});
      try{settings=await fetchSupabaseSettings();}
      catch(fallbackError){logger.warn('supabase_runtime_settings_unavailable',{error:fallbackError});}
    }
    cached=settings;cachedUntil=Date.now()+60_000;return settings;
  })().finally(()=>{inflight=null;});
  return inflight;
}

export const clearRuntimeSettingsCache=()=>{cached=null;cachedUntil=0;inflight=null;};
