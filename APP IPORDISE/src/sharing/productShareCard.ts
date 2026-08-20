import { Image, type ImageSourcePropType } from 'react-native';

export type ProductShareCardInput = {
  brand: string;
  name: string;
  size: string;
  price: string;
  oldPrice?: string;
  savingPercent?: number;
  image: ImageSourcePropType;
};

const roundedRect=(context:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,radius:number)=>{
  const r=Math.min(radius,width/2,height/2);
  context.beginPath();context.moveTo(x+r,y);context.arcTo(x+width,y,x+width,y+height,r);context.arcTo(x+width,y+height,x,y+height,r);context.arcTo(x,y+height,x,y,r);context.arcTo(x,y,x+width,y,r);context.closePath();
};

const loadImage=(uri:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
  const image=new globalThis.Image();
  image.crossOrigin='anonymous';
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(new Error('The product image could not be prepared for sharing.'));
  image.src=uri;
});

const fitText=(context:CanvasRenderingContext2D,text:string,maxWidth:number,startSize:number,minSize:number,weight=700)=>{
  let size=startSize;
  while(size>minSize){context.font=`${weight} ${size}px Georgia, serif`;if(context.measureText(text).width<=maxWidth)break;size-=2;}
  return size;
};

export async function createProductShareCard(input:ProductShareCardInput):Promise<File|null>{
  if(typeof document==='undefined'||typeof File==='undefined')return null;
  const resolved=Image.resolveAssetSource(input.image)?.uri;
  if(!resolved)return null;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const context=canvas.getContext('2d');if(!context)return null;
  const background=context.createLinearGradient(0,0,1080,1350);background.addColorStop(0,'#fffdfc');background.addColorStop(.58,'#f7f1ee');background.addColorStop(1,'#eadbd7');context.fillStyle=background;context.fillRect(0,0,1080,1350);
  const glow=context.createRadialGradient(860,210,20,860,210,520);glow.addColorStop(0,'rgba(215,25,63,.20)');glow.addColorStop(1,'rgba(215,25,63,0)');context.fillStyle=glow;context.fillRect(0,0,1080,760);
  context.fillStyle='#171310';context.font='700 56px Georgia, serif';context.fillText('IPORDISE',70,92);
  context.fillStyle='#d7193f';context.fillRect(70,112,148,6);context.font='800 18px Arial, sans-serif';context.letterSpacing='5px';context.fillText('BEAUTY MOROCCO',70,153);context.letterSpacing='0px';
  context.fillStyle='rgba(255,255,255,.82)';roundedRect(context,60,195,960,690,46);context.fill();context.strokeStyle='rgba(91,65,55,.10)';context.lineWidth=2;context.stroke();
  try{
    const productImage=await loadImage(resolved);
    const maxWidth=700,maxHeight=590,scale=Math.min(maxWidth/productImage.naturalWidth,maxHeight/productImage.naturalHeight);
    const width=productImage.naturalWidth*scale,height=productImage.naturalHeight*scale;
    context.shadowColor='rgba(56,32,24,.18)';context.shadowBlur=40;context.shadowOffsetY=22;context.drawImage(productImage,540-width/2,535-height/2,width,height);context.shadowColor='transparent';
  }catch{/* A branded card is still useful if a remote image blocks canvas access. */}
  context.fillStyle='#d7193f';roundedRect(context,82,218,190,50,25);context.fill();context.fillStyle='#fff';context.font='800 17px Arial, sans-serif';context.textAlign='center';context.fillText('CURATED ORIGINAL',177,250);context.textAlign='left';
  if(input.savingPercent){context.fillStyle='#171310';roundedRect(context,805,218,175,58,29);context.fill();context.fillStyle='#fff';context.font='900 22px Arial, sans-serif';context.textAlign='center';context.fillText(`SAVE ${input.savingPercent}%`,892,255);context.textAlign='left';}
  context.fillStyle='#d7193f';context.font='900 19px Arial, sans-serif';context.letterSpacing='5px';context.fillText(input.brand.toUpperCase(),70,960);context.letterSpacing='0px';
  const titleSize=fitText(context,input.name,930,58,38);context.fillStyle='#171310';context.font=`700 ${titleSize}px Georgia, serif`;context.fillText(input.name,70,1033);
  context.fillStyle='#766a64';context.font='700 24px Arial, sans-serif';context.fillText(input.size||'Selected format',70,1082);
  context.fillStyle='#171310';context.font='900 58px Arial, sans-serif';context.fillText(input.price,70,1170);
  if(input.oldPrice){const priceWidth=context.measureText(input.price).width;context.fillStyle='#938782';context.font='500 27px Arial, sans-serif';context.fillText(input.oldPrice,88+priceWidth,1167);const oldWidth=context.measureText(input.oldPrice).width;context.strokeStyle='#d7193f';context.lineWidth=3;context.beginPath();context.moveTo(88+priceWidth,1157);context.lineTo(88+priceWidth+oldWidth,1157);context.stroke();}
  context.strokeStyle='rgba(76,57,49,.15)';context.lineWidth=2;context.beginPath();context.moveTo(70,1222);context.lineTo(1010,1222);context.stroke();
  context.fillStyle='#176b43';context.font='800 18px Arial, sans-serif';context.fillText('✓  AUTHENTIC FRAGRANCE',70,1270);context.textAlign='right';context.fillText('DELIVERY ACROSS MOROCCO  →',1010,1270);context.textAlign='left';
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png',.96));
  return blob?new File([blob],`ipordise-${input.brand}-${input.name}.png`.toLowerCase().replace(/[^a-z0-9.]+/g,'-'),{type:'image/png'}):null;
}

export function downloadProductShareCard(file:File){
  if(typeof document==='undefined')return;
  const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=file.name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1_000);
}
