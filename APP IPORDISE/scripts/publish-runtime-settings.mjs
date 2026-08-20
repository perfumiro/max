try { process.loadEnvFile?.('.env'); } catch {}

const apiKey='AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4';
const root='https://firestore.googleapis.com/v1/projects/ipordise-aef54/databases/(default)/documents';
const email=process.env.IPORDISE_ADMIN_EMAIL;
const password=process.env.IPORDISE_ADMIN_PASSWORD;
if(!email||!password)throw new Error('IPORDISE_ADMIN_EMAIL and IPORDISE_ADMIN_PASSWORD are required.');

const signIn=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
if(!signIn.ok)throw new Error(`Firebase admin sign-in failed: HTTP ${signIn.status}`);
const {idToken}=await signIn.json();
const headers={Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'};

const decode=value=>{
  if(!value||typeof value!=='object')return value;
  if('stringValue'in value)return value.stringValue;
  if('booleanValue'in value)return value.booleanValue;
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return Number(value.doubleValue);
  if('nullValue'in value)return null;
  if('arrayValue'in value)return(value.arrayValue.values||[]).map(decode);
  if('mapValue'in value)return decodeFields(value.mapValue.fields||{});
};
const decodeFields=fields=>Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,decode(value)]));
const encode=value=>value==null?{nullValue:null}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?(Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value}):typeof value==='string'?{stringValue:value}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:{mapValue:{fields:encodeFields(value)}};
const encodeFields=value=>Object.fromEntries(Object.entries(value).map(([key,item])=>[key,encode(item)]));

const privateResponse=await fetch(`${root}/admin_config/settings?key=${encodeURIComponent(apiKey)}`,{headers});
const privateSettings=privateResponse.ok?decodeFields((await privateResponse.json()).fields||{}):{};
if(!privateResponse.ok&&privateResponse.status!==404)throw new Error(`Private settings read failed: HTTP ${privateResponse.status}`);
const settings={homepage:privateSettings.homepage??null,offers:privateSettings.offers??null,help:privateSettings.help??null,shop:privateSettings.shop??null};
const publicSettings={...settings,system:true,active:false,updatedAt:new Date().toISOString()};
const publish=await fetch(`${root}/products/_app_config?key=${encodeURIComponent(apiKey)}`,{method:'PATCH',headers,body:JSON.stringify({fields:encodeFields(publicSettings)})});
if(!publish.ok)throw new Error(`Runtime settings publish failed: HTTP ${publish.status}`);
console.log(JSON.stringify({ok:true,published:'products/_app_config',publishedFields:['homepage','offers','help','shop'],configuredSections:['homepage','offers','help','shop'].filter(section=>settings[section])},null,2));
