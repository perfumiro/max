export const DAILY_ROTATION_MS=24*60*60*1000;

export function dailyRotationKey(now=Date.now()) {
  return Math.floor(now/DAILY_ROTATION_MS);
}

function hashSeed(value:string) {
  let hash=2166136261;
  for(let index=0;index<value.length;index+=1) {
    hash^=value.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function seededRandom(seed:number) {
  let state=seed||0x6d2b79f5;
  return () => {
    state+=0x6d2b79f5;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

export function rotateProductsDaily<T extends {id:string}>(products:T[],rotationKey=dailyRotationKey()) {
  const random=seededRandom(hashSeed(`ipordise-daily-edit:${rotationKey}`));
  const shuffled=[...products];
  for(let index=shuffled.length-1;index>0;index-=1) {
    const target=Math.floor(random()*(index+1));
    [shuffled[index],shuffled[target]]=[shuffled[target],shuffled[index]];
  }
  return shuffled;
}

export function millisecondsUntilNextRotation(now=Date.now()) {
  return DAILY_ROTATION_MS-(now%DAILY_ROTATION_MS);
}
