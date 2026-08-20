const firebaseProject='ipordise-aef54';
const firebaseApiKey='AIzaSyAt-fnGB3Y69qEmg4pjOWneKrutbnQLMM4';
const supabaseUrl=process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
const secretKey=process.env.SUPABASE_SECRET_KEY;
const publishableKey=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const adminEmail=process.env.IPORDISE_ADMIN_EMAIL;
const adminPassword=process.env.IPORDISE_ADMIN_PASSWORD;

if(!supabaseUrl)throw new Error('EXPO_PUBLIC_SUPABASE_URL is missing');
if(!secretKey)throw new Error('SUPABASE_SECRET_KEY is missing');
if(!publishableKey)throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');

const decode=value=>{
  if(!value||typeof value!=='object')return value;
  if('stringValue'in value)return value.stringValue;
  if('booleanValue'in value)return value.booleanValue;
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return Number(value.doubleValue);
  if('timestampValue'in value)return value.timestampValue;
  if('nullValue'in value)return null;
  if('arrayValue'in value)return(value.arrayValue.values||[]).map(decode);
  if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([key,item])=>[key,decode(item)]));
  return undefined;
};

const response=await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProject}/databases/(default)/documents/products?pageSize=300&key=${firebaseApiKey}`);
if(!response.ok)throw new Error(`Firebase catalogue returned HTTP ${response.status}`);
const payload=await response.json();
const products=(payload.documents||[]).map(document=>{
  const id=String(document.name||'').split('/').pop();
  const value=Object.fromEntries(Object.entries(document.fields||{}).map(([key,item])=>[key,decode(item)]));
  return{id,value};
}).filter(product=>product.id&&!product.id.startsWith('_')&&product.value.name&&Object.values(product.value.sizes||{}).some(price=>Number(price)>0));
const rows=products.map(({id,value})=>{
  const images=Array.isArray(value.images)?value.images.filter(item=>typeof item==='string'&&item):Array.isArray(value.gallery)?value.gallery.filter(item=>typeof item==='string'&&item):[];
  const image=typeof value.image==='string'?value.image:images[0]||'';
  const sizes=value.sizes&&typeof value.sizes==='object'?value.sizes:{};
  return{id,name:value.name,brand:String(value.brand||'IPORDISE').toUpperCase(),image,gallery:images.length?images:[image].filter(Boolean),sizes,base_sizes:sizes,original_prices:value.originalPrices&&typeof value.originalPrices==='object'?value.originalPrices:{},filters:Array.isArray(value.filters)?value.filters:['new-in'],badge:value.badge||null,description:value.description||null,accords:Array.isArray(value.accords)?value.accords:[],notes:value.notes&&typeof value.notes==='object'?value.notes:{},ingredients:value.ingredients||null,rating:Number(value.rating||4.8),review_count:Number(value.reviewCount||0),stock_left:value.stockLeft??null,active:value.active!==false,sort_order:Number(value.sortOrder||0),source:'admin'};
});

if(!rows.length)throw new Error('Firebase catalogue contains no sellable products');
const upsert=await fetch(`${supabaseUrl}/rest/v1/products?on_conflict=id`,{method:'POST',headers:{apikey:secretKey,Authorization:`Bearer ${secretKey}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
if(upsert.ok){
  console.log(`Synced ${rows.length} Firebase products to the checkout catalogue.`);
}else{
  if(!adminEmail||!adminPassword)throw new Error(`Direct sync failed with HTTP ${upsert.status}; Firebase administrator credentials are not configured`);
  const auth=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:adminEmail,password:adminPassword,returnSecureToken:true})});
  if(!auth.ok)throw new Error(`Firebase administrator sign-in failed: HTTP ${auth.status}`);
  const {idToken}=await auth.json();
  for(const {id,value} of products){
    const sync=await fetch(`${supabaseUrl}/functions/v1/admin-catalog-sync`,{method:'POST',headers:{apikey:publishableKey,Authorization:`Bearer ${idToken}`,'Content-Type':'application/json'},body:JSON.stringify({section:'products',id,value})});
    if(!sync.ok)throw new Error(`Protected checkout sync failed for ${id}: HTTP ${sync.status} ${await sync.text()}`);
  }
  console.log(`Synced ${products.length} Firebase products through the protected administrator API.`);
}
