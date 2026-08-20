import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { displaySize, formatMad, loadSharedProducts, type Product } from '../sharedCatalog';
import { useFavouriteSnapshot, useShoppingActions } from '../commerce/ShoppingContext';
import { useResponsiveLayout } from '../useResponsiveLayout';
import { defaultOfferHero, isScheduledNow, loadOfferHero, type OfferHeroConfig } from './offerConfig';
import { getOfferVariants as offerValues, isEligibleOffer as isActiveOffer, summarizeOffer as offerSummary } from './offerPricing';
import { logger } from '../observability/logger';
import { SmoothScrollView as ScrollView } from '../components/smoothHorizontalScroll';
import { LocalizedText as Text } from '../i18n/LocalizedPrimitives';

const RED='#d7193f';
const EMPTY_OFFERS_IMAGE=require('../../assets/category-photos/offers-editorial-v1.png');
const EMPTY_BENEFITS=[
  ['shield-checkmark-outline','Authentic','Verified fragrances'],
  ['sparkles-outline','Curated','Private edits'],
  ['pricetag-outline','Smart pricing','Prices update live'],
] as const;
let retainedOffset=0;
type Category='all'|'women'|'men'|'unisex'|'gifts'|'under500'|'discount';
type Sort='recommended'|'discount'|'low'|'high'|'newest'|'bestselling';
type AdvancedFilters={brands:string[];families:string[];sizes:string[];minDiscount:number;inStock:boolean};
const emptyAdvanced:AdvancedFilters={brands:[],families:[],sizes:[],minDiscount:0,inStock:false};
let retainedCategory:Category='all';
let retainedSort:Sort='recommended';
let retainedFilters:AdvancedFilters=emptyAdvanced;

const has=(product:Product,value:string)=>product.filters.some(item=>item.toLowerCase().includes(value));
const labelForBadge=(product:Product)=>{
  const value=(product.offerBadge||product.badge||'').toUpperCase();
  return ['TRENDING','NEW','BESTSELLER'].includes(value)?value:'';
};

function Wordmark(){return <View accessibilityLabel="IPORDISE"><Text style={styles.wordmark}>IPORDISE</Text><View style={styles.wordmarkLine}/></View>;}

function Hero({config,tablet,onShop}:{config:OfferHeroConfig;tablet:boolean;onShop:()=>void}){
  if(!config.active||!isScheduledNow(config.startsAt,config.endsAt))return null;
  const uri=(tablet?config.tabletImage:config.mobileImage)||config.backgroundImage;
  const end= config.endsAt&&Number.isFinite(Date.parse(config.endsAt)) ? new Date(config.endsAt).toLocaleDateString('en-MA',{day:'numeric',month:'short'}) : '';
  return <View style={styles.hero}>
    {uri?<Image source={{uri}} resizeMode="cover" style={StyleSheet.absoluteFill}/>:null}
    <LinearGradient colors={uri?['rgba(49,8,17,.82)','rgba(17,9,10,.94)']:['#4a101c','#150b0d']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View style={styles.heroGlow}/><View style={styles.heroTop}><Wordmark/><View accessibilityLabel="Private offer ticket" accessible style={styles.ticket}><Ionicons name="ticket-outline" size={18} color="#fff"/></View></View>
    <Text style={styles.heroEyebrow}>{config.eyebrow}</Text><Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={.82} style={styles.heroTitle}>{config.heading}</Text><Text style={styles.heroDescription}>{config.description}</Text>
    {end?<View style={styles.endDate}><Ionicons name="time-outline" size={13} color="#ff9bb0"/><Text style={styles.endDateText}>ENDS {end.toUpperCase()}</Text></View>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={config.ctaLabel} onPress={onShop} style={({pressed})=>[styles.heroCta,pressed&&styles.pressed]}><Text style={styles.heroCtaText}>{config.ctaLabel}</Text><Ionicons name="arrow-forward" size={17} color="#17110f"/></Pressable>
  </View>;
}

function SkeletonCard({width}:{width:number}){return <View style={[styles.card,{width}]}><View style={[styles.imageWrap,styles.skeleton]}/><View style={styles.cardBody}><View style={[styles.skeletonLine,{width:'38%'}]}/><View style={[styles.skeletonLine,{width:'88%',height:14}]}/><View style={[styles.skeletonLine,{width:'62%'}]}/><View style={[styles.skeletonLine,{width:'70%',height:18,marginTop:22}]}/></View></View>;}

type CardProps={product:Product;width:number;onOpen:(product:Product)=>void;onChooseVariant:(product:Product)=>void};
const OfferProductCard=memo(function OfferProductCard({product,width,onOpen,onChooseVariant}:CardProps){
  const {favouriteIds}=useFavouriteSnapshot();
  const {toggleFavourite,addToBag}=useShoppingActions();
  const [locked,setLocked]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const resetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(resetTimer.current)clearTimeout(resetTimer.current);},[]);
  const summary=offerSummary(product);
  if(!summary)return null;
  const variants=offerValues(product);
  const liked=favouriteIds.has(product.id);
  const add=()=>{if(locked||product.stockLeft===0)return;if(variants.length>1){onChooseVariant(product);return;}setLocked(true);addToBag(product,summary.size);setConfirmed(true);resetTimer.current=setTimeout(()=>{setLocked(false);setConfirmed(false);resetTimer.current=null;},1100);};
  const badge=labelForBadge(product);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${product.brand} ${product.name}, ${formatMad(summary.price)}, ${summary.discount}% off`} onPress={()=>onOpen(product)} style={({pressed})=>[styles.card,{width},pressed&&styles.cardPressed]}>
    <View style={styles.imageWrap}><Image source={product.image} resizeMode="contain" resizeMethod="resize" fadeDuration={0} style={styles.image}/><View style={styles.badgeRow}><View style={styles.discountBadge}><Text style={styles.discountBadgeText}>-{summary.discount}%</Text></View>{badge?<View style={styles.metaBadge}><Text style={styles.metaBadgeText}>{badge}</Text></View>:null}</View><Pressable accessibilityRole="button" accessibilityState={{selected:liked}} accessibilityLabel={liked?`Remove ${product.name} from wishlist`:`Add ${product.name} to wishlist`} hitSlop={4} onPress={event=>{event.stopPropagation();toggleFavourite(product);}} style={({pressed})=>[styles.wishlist,pressed&&styles.pressed]}><Ionicons name={liked?'heart':'heart-outline'} size={21} color={liked?RED:'#171310'}/></Pressable></View>
    <View style={styles.cardBody}><Text numberOfLines={1} style={styles.brand}>{product.brand}</Text><Text numberOfLines={2} style={styles.name}>{product.name}</Text><Text numberOfLines={1} style={styles.variant}>{displaySize(summary.size)}{variants.length>1?` · ${variants.length} sizes`:''}</Text>
      <View style={styles.ratingSlot}>{product.reviewCount>0?<><Ionicons name="star" size={13} color="#c98910"/><Text style={styles.rating}>{product.rating} ({product.reviewCount})</Text></>:null}</View>
      <View style={styles.priceBlock}><View style={styles.priceLine}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.78} style={styles.current}>{formatMad(summary.price)}</Text><Text style={styles.original}>{formatMad(summary.original)}</Text></View><Text style={styles.saved}>You save {formatMad(summary.saved)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityState={{disabled:locked||product.stockLeft===0}} accessibilityLabel={variants.length>1?`Choose a size for ${product.name}`:`Add ${product.name} to bag`} disabled={locked||product.stockLeft===0} onPress={event=>{event.stopPropagation();add();}} style={({pressed})=>[styles.addButton,confirmed&&styles.added,pressed&&styles.pressed,(locked||product.stockLeft===0)&&styles.disabled]}><Ionicons name={confirmed?'checkmark':'bag-add-outline'} size={17} color="#fff"/><Text style={styles.addText}>{product.stockLeft===0?'OUT OF STOCK':confirmed?'ADDED':variants.length>1?'CHOOSE SIZE':'ADD TO BAG'}</Text></Pressable>
    </View>
  </Pressable>;
});

function VariantSheet({product,onClose}:{product:Product|null;onClose:()=>void}){
  const {addToBag}=useShoppingActions();const [busy,setBusy]=useState('');const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
  if(!product)return null;
  return <Modal transparent visible animationType="slide" onRequestClose={onClose}><Pressable accessibilityRole="button" accessibilityLabel="Close size selector" onPress={onClose} style={styles.modalBackdrop}><Pressable accessibilityRole="none" onPress={event=>event.stopPropagation()} style={styles.sheet}>
    <View style={styles.sheetHandle}/><View style={styles.sheetHead}><View><Text style={styles.sheetEyebrow}>{product.brand}</Text><Text style={styles.sheetTitle}>Choose your size</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close size selector" onPress={onClose} style={styles.close}><Ionicons name="close" size={21}/></Pressable></View>
    {offerValues(product).map(item=>{const discount=Math.round((1-item.price/item.original)*100);return <Pressable accessibilityRole="button" accessibilityState={{disabled:!!busy}} key={item.size} disabled={!!busy} onPress={()=>{setBusy(item.size);addToBag(product,item.size);closeTimer.current=setTimeout(onClose,450);}} style={({pressed})=>[styles.variantRow,pressed&&styles.pressed]}><View style={styles.variantSize}><Text style={styles.variantSizeText}>{displaySize(item.size)}</Text></View><View style={{flex:1}}><Text style={styles.variantPrice}>{formatMad(item.price)}</Text><Text style={styles.variantOld}>{formatMad(item.original)} · Save {discount}%</Text></View><View style={styles.variantAdd}>{busy===item.size?<ActivityIndicator color="#fff" size="small"/>:<Ionicons name="add" size={20} color="#fff"/>}</View></Pressable>})}
  </Pressable></Pressable></Modal>;
}

function FilterSheet({visible,onClose,filters,setFilters,sort,setSort,brands,families,sizes}:{visible:boolean;onClose:()=>void;filters:AdvancedFilters;setFilters:(v:AdvancedFilters)=>void;sort:Sort;setSort:(v:Sort)=>void;brands:string[];families:string[];sizes:string[]}){
  const toggle=(key:'brands'|'families'|'sizes',value:string)=>setFilters({...filters,[key]:filters[key].includes(value)?filters[key].filter(item=>item!==value):[...filters[key],value]});
  const sorts:[Sort,string][]=[['recommended','Recommended'],['discount','Biggest discount'],['low','Price: low to high'],['high','Price: high to low'],['newest','Newest'],['bestselling','Bestselling']];
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}><Pressable onPress={onClose} style={styles.modalBackdrop}><Pressable onPress={event=>event.stopPropagation()} style={[styles.sheet,styles.filterSheet]}><View style={styles.sheetHandle}/><View style={styles.sheetHead}><View><Text style={styles.sheetEyebrow}>REFINE THE EDIT</Text><Text style={styles.sheetTitle}>Filter & sort</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={styles.close}><Ionicons name="close" size={21}/></Pressable></View><ScrollView showsVerticalScrollIndicator={false}>
    <Text style={styles.filterLabel}>SORT BY</Text><View style={styles.optionWrap}>{sorts.map(([value,label])=><Pressable accessibilityRole="radio" accessibilityState={{checked:sort===value}} key={value} onPress={()=>setSort(value)} style={[styles.option,sort===value&&styles.optionActive]}><Text style={[styles.optionText,sort===value&&styles.optionTextActive]}>{label}</Text></Pressable>)}</View>
    {[['BRAND','brands',brands],['FRAGRANCE FAMILY','families',families],['PRODUCT SIZE','sizes',sizes]] .map(([label,key,items])=><View key={String(key)}><Text style={styles.filterLabel}>{String(label)}</Text><View style={styles.optionWrap}>{(items as string[]).slice(0,18).map(value=><Pressable accessibilityRole="checkbox" accessibilityState={{checked:filters[key as 'brands'|'families'|'sizes'].includes(value)}} key={value} onPress={()=>toggle(key as 'brands'|'families'|'sizes',value)} style={[styles.option,filters[key as 'brands'|'families'|'sizes'].includes(value)&&styles.optionActive]}><Text style={[styles.optionText,filters[key as 'brands'|'families'|'sizes'].includes(value)&&styles.optionTextActive]}>{key==='sizes'?displaySize(value):value}</Text></Pressable>)}</View></View>)}
    <Text style={styles.filterLabel}>MINIMUM DISCOUNT</Text><View style={styles.optionWrap}>{[0,10,20,30].map(value=><Pressable key={value} onPress={()=>setFilters({...filters,minDiscount:value})} style={[styles.option,filters.minDiscount===value&&styles.optionActive]}><Text style={[styles.optionText,filters.minDiscount===value&&styles.optionTextActive]}>{value?`${value}%+`:'Any'}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:filters.inStock}} onPress={()=>setFilters({...filters,inStock:!filters.inStock})} style={styles.stockOption}><Ionicons name={filters.inStock?'checkbox':'square-outline'} size={22} color={filters.inStock?RED:'#665c57'}/><Text style={styles.stockOptionText}>In-stock products only</Text></Pressable>
  </ScrollView><View style={styles.sheetActions}><Pressable accessibilityRole="button" onPress={()=>setFilters(emptyAdvanced)} style={styles.clearButton}><Text style={styles.clearText}>CLEAR ALL</Text></Pressable><Pressable accessibilityRole="button" onPress={onClose} style={styles.applyButton}><Text style={styles.applyText}>SHOW OFFERS</Text></Pressable></View></Pressable></Pressable></Modal>;
}

function DiscoveryRail({title,products,onOpen}:{title:string;products:Product[];onOpen:(product:Product)=>void}){if(!products.length)return null;return <View style={styles.discovery}><View style={styles.discoveryHead}><Text style={styles.discoveryTitle}>{title}</Text><Text style={styles.discoveryCount}>{products.length} PICKS</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryRail}>{products.map(product=>{const summary=offerSummary(product)!;return <Pressable accessibilityRole="button" key={product.id} onPress={()=>onOpen(product)} style={styles.discoveryCard}><Image source={product.image} resizeMode="contain" style={styles.discoveryImage}/><Text numberOfLines={1} style={styles.discoveryBrand}>{product.brand}</Text><Text numberOfLines={2} style={styles.discoveryName}>{product.name}</Text><Text style={styles.discoveryPrice}>{formatMad(summary.price)}</Text></Pressable>})}</ScrollView></View>;}

function EmptyOffersState({products,onOpen,onExplore,shellWidth,gutter,tablet,bottomInset}:{products:Product[];onOpen:(product:Product)=>void;onExplore:()=>void;shellWidth:number;gutter:number;tablet:boolean;bottomInset:number}){
  const picks=products.filter(product=>product.stockLeft!==0).slice(0,6);
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.emptyPage,{paddingHorizontal:gutter,paddingBottom:bottomInset+28}]}><View style={[styles.emptyShell,{maxWidth:shellWidth}]}>
    <View style={[styles.emptyHero,{height:tablet?430:382}]}>
      <Image accessibilityIgnoresInvertColors source={EMPTY_OFFERS_IMAGE} resizeMode="cover" style={styles.emptyHeroImage}/>
      <LinearGradient colors={['rgba(18,12,10,.12)','rgba(18,12,10,.34)','rgba(14,9,8,.92)']} locations={[0,.48,1]} style={StyleSheet.absoluteFill}/>
      <View style={styles.emptyHeroTop}><Wordmark/><View style={styles.emptyStatus}><View style={styles.emptyStatusDot}/><Text style={styles.emptyStatusText}>NEXT EDIT IN PREPARATION</Text></View></View>
      <View style={styles.emptyHeroCopy}><Text style={styles.emptyEyebrow}>IPORDISE PRIVATE OFFERS</Text><Text style={styles.emptyTitle}>Something special is being prepared.</Text><Text style={styles.emptyDescription}>Our next fragrance edit is coming soon. In the meantime, discover the boutique’s most desired signatures.</Text><Pressable accessibilityRole="button" accessibilityLabel="Explore the fragrance boutique" onPress={onExplore} style={({pressed})=>[styles.emptyPrimary,pressed&&styles.pressed]}><Text style={styles.emptyPrimaryText}>EXPLORE THE BOUTIQUE</Text><Ionicons name="arrow-forward" size={16} color="#171310"/></Pressable></View>
    </View>
    <View style={styles.emptyBenefits}>{EMPTY_BENEFITS.map(([icon,title,description],index)=><React.Fragment key={title}>{index?<View style={styles.emptyBenefitDivider}/>:null}<View style={styles.emptyBenefit}><Ionicons accessibilityElementsHidden name={icon} size={18} color="#5d554f"/><Text style={styles.emptyBenefitTitle}>{title}</Text><Text style={styles.emptyBenefitText}>{description}</Text></View></React.Fragment>)}</View>
    {picks.length?<View style={styles.emptyPicks}><View style={styles.emptyPicksHead}><View style={styles.emptyPicksCopy}><Text style={styles.emptyPicksEyebrow}>THE IPORDISE SELECTION</Text><Text style={styles.emptyPicksTitle}>Discover the boutique</Text></View><Pressable accessibilityRole="button" onPress={onExplore} style={({pressed})=>[styles.emptyViewAll,pressed&&styles.pressed]}><Text style={styles.emptyViewAllText}>View all</Text><Ionicons name="arrow-forward" size={14} color="#2d2724"/></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emptyPicksRail}>{picks.map(product=><Pressable accessibilityRole="button" accessibilityLabel={`${product.brand} ${product.name}, ${product.price}`} key={product.id} onPress={()=>onOpen(product)} style={({pressed})=>[styles.emptyPickCard,pressed&&styles.productPressed]}><View style={styles.emptyPickImageWrap}><Image accessibilityIgnoresInvertColors source={product.image} resizeMode="contain" style={styles.emptyPickImage}/></View><Text numberOfLines={1} style={styles.emptyPickBrand}>{product.brand}</Text><Text numberOfLines={2} style={styles.emptyPickName}>{product.name}</Text><View style={styles.emptyPickFooter}><Text style={styles.emptyPickPrice}>{product.price}</Text><Ionicons name="arrow-forward" size={13} color="#7B726C"/></View></Pressable>)}</ScrollView></View>:null}
  </View></ScrollView>;
}

export function OffersScreen({fallbackProducts,onOpenProduct,onExplore,bottomInset}:{fallbackProducts:Product[];onOpenProduct:(product:Product,products:Product[])=>void;onExplore:()=>void;bottomInset:number}){
  const layout=useResponsiveLayout();const listRef=useRef<FlatList<Product>>(null);
  const [products,setProducts]=useState<Product[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState(false);const [offline,setOffline]=useState(false);const [hero,setHero]=useState(defaultOfferHero);
  const [category,setCategory]=useState<Category>(retainedCategory);const [sort,setSort]=useState<Sort>(retainedSort);const [filters,setFilters]=useState<AdvancedFilters>(retainedFilters);const [filterOpen,setFilterOpen]=useState(false);const [variantProduct,setVariantProduct]=useState<Product|null>(null);
  const load=useCallback(async(force=false)=>{setLoading(true);setError(false);try{const live=await loadSharedProducts(force);setProducts(live);setOffline(false);}catch(loadError){logger.warn('offers_catalog_unavailable',{error:loadError});const cached=fallbackProducts.filter(isActiveOffer);setProducts(cached);setError(!cached.length);setOffline(Boolean(cached.length));}finally{setLoading(false);}},[fallbackProducts]);
  useEffect(()=>{void load();void loadOfferHero().then(setHero).catch(configError=>logger.warn('offer_config_using_defaults',{error:configError}));},[load]);
  useEffect(()=>{retainedCategory=category;retainedSort=sort;retainedFilters=filters;},[category,filters,sort]);
  useEffect(()=>{if(loading)return;const timer=setTimeout(()=>listRef.current?.scrollToOffset({offset:retainedOffset,animated:false}),0);return()=>clearTimeout(timer);},[loading]);
  const offers=useMemo(()=>products.filter(isActiveOffer),[products]);
  const brands=useMemo(()=>[...new Set(offers.map(p=>p.brand))].sort(),[offers]);
  const sizes=useMemo(()=>[...new Set(offers.flatMap(p=>offerValues(p).map(v=>v.size)))].sort((a,b)=>(parseFloat(a)||0)-(parseFloat(b)||0)),[offers]);
  const families=useMemo(()=>[...new Set(offers.flatMap(p=>p.filters.map(f=>f.toLowerCase())).filter(f=>!['offers','for-men','for-women','unisex','new-in','best-sellers','niche','designer','gift-sets'].includes(f)))].slice(0,12),[offers]);
  const shown=useMemo(()=>offers.filter(product=>{const summary=offerSummary(product)!;const categoryMatch=category==='all'||(category==='women'&&has(product,'women'))||(category==='men'&&has(product,'men'))||(category==='unisex'&&has(product,'unisex'))||(category==='gifts'&&has(product,'gift'))||(category==='under500'&&summary.price<500)||category==='discount';return categoryMatch&&(!filters.brands.length||filters.brands.includes(product.brand))&&(!filters.families.length||filters.families.some(f=>has(product,f)))&&(!filters.sizes.length||filters.sizes.some(s=>offerValues(product).some(v=>v.size===s)))&&summary.discount>=filters.minDiscount&&(!filters.inStock||product.stockLeft!==0);}).sort((a,b)=>{const aa=offerSummary(a)!;const bb=offerSummary(b)!;if(category==='discount'||sort==='discount')return bb.discount-aa.discount;if(sort==='low')return aa.price-bb.price;if(sort==='high')return bb.price-aa.price;if(sort==='newest')return Number(has(b,'new-in'))-Number(has(a,'new-in'));if(sort==='bestselling')return b.reviewCount-a.reviewCount;return Number(b.offerFeatured)-Number(a.offerFeatured)||(a.sortOrder??100)-(b.sortOrder??100);}),[offers,category,filters,sort]);
  const activeFilterCount=filters.brands.length+filters.families.length+filters.sizes.length+Number(filters.minDiscount>0)+Number(filters.inStock);
  const columns=layout.compact?1:layout.catalogColumns;const gap=12;const cardWidth=(layout.contentWidth-gap*(columns-1))/columns;
  const biggest=useMemo(()=>[...offers].sort((a,b)=>offerSummary(b)!.saved-offerSummary(a)!.saved).slice(0,6),[offers]);
  const under500=useMemo(()=>offers.filter(p=>offerSummary(p)!.price<500&&!biggest.some(x=>x.id===p.id)).slice(0,6),[offers,biggest]);
  const best=useMemo(()=>[...offers].filter(p=>!biggest.slice(0,3).some(x=>x.id===p.id)).sort((a,b)=>b.reviewCount-a.reviewCount).slice(0,6),[offers,biggest]);
  const categories:{label:string;value:Category}[]=[{label:'All',value:'all'},{label:'Women',value:'women'},{label:'Men',value:'men'},{label:'Unisex',value:'unisex'},{label:'Gift Sets',value:'gifts'},{label:'Under 500 MAD',value:'under500'},{label:'Biggest Discount',value:'discount'}];
  const openOffer=useCallback((product:Product)=>onOpenProduct(product,offers),[offers,onOpenProduct]);
  const renderOffer=useCallback(({item}:{item:Product})=><OfferProductCard product={item} width={cardWidth} onOpen={openOffer} onChooseVariant={setVariantProduct}/>,[cardWidth,openOffer]);
  const header=<><Hero config={hero} tablet={layout.tablet} onShop={()=>{setCategory('all');listRef.current?.scrollToOffset({offset:230,animated:true});}}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.map(item=><Pressable accessibilityRole="button" accessibilityState={{selected:category===item.value}} key={item.value} onPress={()=>setCategory(item.value)} style={[styles.chip,category===item.value&&styles.chipActive]}><Text style={[styles.chipText,category===item.value&&styles.chipTextActive]}>{item.label}</Text></Pressable>)}</ScrollView><View style={styles.toolbar}><Pressable accessibilityRole="button" accessibilityLabel={`Open filters, ${activeFilterCount} active`} onPress={()=>setFilterOpen(true)} style={styles.toolButton}><Ionicons name="options-outline" size={18}/><Text style={styles.toolText}>Filter & sort</Text>{activeFilterCount?<View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>:null}</Pressable>{activeFilterCount?<Pressable accessibilityRole="button" onPress={()=>setFilters(emptyAdvanced)} style={styles.clearInline}><Text style={styles.clearInlineText}>Clear all</Text></Pressable>:<Text style={styles.sortLabel}>{sort==='recommended'?'RECOMMENDED':sort.replaceAll('_',' ').toUpperCase()}</Text>}</View><View style={styles.sectionHead}><View><Text style={styles.eyebrow}>AVAILABLE NOW</Text><Text style={styles.sectionTitle}>Featured offers</Text></View><View style={styles.countPill}><Text style={styles.countValue}>{shown.length}</Text><Text style={styles.countText}>{shown.length===1?'PRODUCT':'PRODUCTS'}</Text></View></View>{offline?<View style={styles.offline}><Ionicons name="cloud-offline-outline" size={16} color="#7a5d20"/><Text style={styles.offlineText}>Offline edit · showing saved offers</Text></View>:null}</>;
  const footer=<><DiscoveryRail title="Biggest savings" products={biggest} onOpen={p=>onOpenProduct(p,offers)}/><DiscoveryRail title="Offers under 500 MAD" products={under500} onOpen={p=>onOpenProduct(p,offers)}/><DiscoveryRail title="Bestselling deals" products={best} onOpen={p=>onOpenProduct(p,offers)}/><View style={styles.notice}><View style={styles.noticeIcon}><Ionicons name="information-circle-outline" size={20} color={RED}/></View><Text style={styles.noticeText}>Prices and availability may change. Eligible discounts are applied automatically.</Text></View></>;
  if(loading&&!products.length)return <View style={[styles.page,{paddingHorizontal:layout.gutter}]}><View style={[styles.shell,{maxWidth:layout.contentWidth}]}><Hero config={hero} tablet={layout.tablet} onShop={()=>{}}/><View style={styles.skeletonGrid}>{Array.from({length:columns*2},(_,i)=><SkeletonCard width={cardWidth} key={i}/>)}</View></View></View>;
  if(error)return <View style={styles.state}><View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={32} color={RED}/></View><Text style={styles.stateTitle}>Offers could not be loaded</Text><Text style={styles.stateText}>Check your connection and try again. Your shopping bag and wishlist are safe.</Text><Pressable accessibilityRole="button" onPress={()=>void load(true)} style={styles.stateButton}><Text style={styles.stateButtonText}>TRY AGAIN</Text></Pressable></View>;
  if(!offers.length)return <EmptyOffersState products={products.length?products:fallbackProducts} onOpen={product=>onOpenProduct(product,products.length?products:fallbackProducts)} onExplore={onExplore} shellWidth={layout.shellWidth} gutter={layout.gutter} tablet={layout.tablet} bottomInset={bottomInset}/>;
  return <View style={styles.page}><FlatList ref={listRef} key={`offers-${columns}`} data={shown} numColumns={columns} keyExtractor={item=>item.id} renderItem={renderOffer} columnWrapperStyle={columns>1?styles.row:undefined} contentContainerStyle={[styles.list,{maxWidth:layout.shellWidth,paddingHorizontal:layout.gutter,paddingBottom:bottomInset+28}]} ListHeaderComponent={header} ListFooterComponent={footer} ListEmptyComponent={<View style={styles.inlineEmpty}><Text style={styles.stateTitle}>No matching offers</Text><Text style={styles.stateText}>Try another category or clear your filters.</Text><Pressable onPress={()=>{setCategory('all');setFilters(emptyAdvanced);}} style={styles.stateButton}><Text style={styles.stateButtonText}>CLEAR FILTERS</Text></Pressable></View>} showsVerticalScrollIndicator={false} onScroll={event=>{retainedOffset=event.nativeEvent.contentOffset.y;}} scrollEventThrottle={80} initialNumToRender={columns*4} maxToRenderPerBatch={columns*3} updateCellsBatchingPeriod={40} windowSize={7} removeClippedSubviews={Platform.OS!=='web'}/><VariantSheet product={variantProduct} onClose={()=>setVariantProduct(null)}/><FilterSheet visible={filterOpen} onClose={()=>setFilterOpen(false)} filters={filters} setFilters={setFilters} sort={sort} setSort={setSort} brands={brands} families={families} sizes={sizes}/></View>;
}

const styles:Record<string,any>=StyleSheet.create({
  emptyPage:{flexGrow:1,backgroundColor:'#f6f2ef',paddingTop:14},emptyShell:{width:'100%',alignSelf:'center'},emptyHero:{borderRadius:24,overflow:'hidden',padding:20,justifyContent:'space-between',backgroundColor:'#2b1718',shadowColor:'#281417',shadowOpacity:.2,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:5},emptyHeroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},emptyStatus:{minHeight:28,borderRadius:14,backgroundColor:'rgba(255,255,255,.12)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:6},emptyStatusDot:{width:5,height:5,borderRadius:3,backgroundColor:'#ff6688'},emptyStatusText:{fontSize:6.5,fontWeight:'900',letterSpacing:.7,color:'#fff'},emptyHeroCopy:{maxWidth:530},emptyEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.45,color:'#ff8ca5'},emptyTitle:{maxWidth:450,fontFamily:'serif',fontSize:31,lineHeight:35,fontWeight:'700',letterSpacing:-.35,color:'#fff',marginTop:5},emptyDescription:{maxWidth:490,fontSize:11.5,lineHeight:17,color:'rgba(255,255,255,.8)',marginTop:7},emptyPrimary:{minHeight:47,alignSelf:'flex-start',borderRadius:24,backgroundColor:'#fff',paddingHorizontal:16,marginTop:15,flexDirection:'row',alignItems:'center',gap:12},emptyPrimaryText:{fontSize:8.5,fontWeight:'900',letterSpacing:.75,color:'#171310'},emptyBenefits:{minHeight:104,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4dad5',marginTop:14,paddingVertical:14,paddingHorizontal:8,flexDirection:'row',alignItems:'center'},emptyBenefit:{flex:1,alignItems:'center',paddingHorizontal:4},emptyBenefitDivider:{width:1,height:50,backgroundColor:'#eee5e0'},emptyBenefitIcon:{width:32,height:32,borderRadius:11,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},emptyBenefitTitle:{fontFamily:'serif',fontSize:13,fontWeight:'700',marginTop:5},emptyBenefitText:{fontSize:7.5,lineHeight:11,color:'#80746e',textAlign:'center',marginTop:1},emptyPicks:{marginTop:27},emptyPicksHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginBottom:11},emptyPicksEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.3,color:RED},emptyPicksTitle:{fontFamily:'serif',fontSize:24,lineHeight:29,fontWeight:'700',marginTop:3},emptyViewAll:{minHeight:44,paddingLeft:12,flexDirection:'row',alignItems:'center',gap:6},emptyViewAllText:{fontSize:10,fontWeight:'800'},emptyPicksRail:{gap:10,paddingRight:2},emptyPickCard:{width:154,minHeight:220,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5dcd7',padding:10},emptyPickImage:{width:'100%',height:130,borderRadius:12,backgroundColor:'#faf8f6'},emptyPickBrand:{fontSize:7.5,fontWeight:'900',letterSpacing:.65,color:RED,marginTop:8},emptyPickName:{height:34,fontFamily:'serif',fontSize:14,lineHeight:16,fontWeight:'700',marginTop:2},emptyPickPrice:{fontSize:11,fontWeight:'900',marginTop:'auto'},emptyNote:{minHeight:78,borderRadius:18,backgroundColor:'#fff0f4',borderWidth:1,borderColor:'#efd6dd',padding:14,marginTop:22,flexDirection:'row',alignItems:'center',gap:11},emptyNoteTitle:{fontFamily:'serif',fontSize:15,fontWeight:'700'},emptyNoteText:{fontSize:9.5,lineHeight:14,color:'#6f6165',marginTop:2},
  page:{flex:1,backgroundColor:'#f6f2ef'},shell:{width:'100%',alignSelf:'center'},list:{width:'100%',alignSelf:'center',paddingTop:16},pressed:{opacity:.76,transform:[{scale:.985}]},hero:{minHeight:276,borderRadius:22,overflow:'hidden',padding:22,shadowColor:'#2c1116',shadowOpacity:.18,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:5},heroGlow:{position:'absolute',width:190,height:190,borderRadius:95,right:-45,top:-70,backgroundColor:'rgba(215,25,63,.16)'},heroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},wordmark:{fontFamily:'serif',fontSize:24,lineHeight:28,fontWeight:'700',color:'#fff'},wordmarkLine:{width:88,height:2,borderRadius:2,backgroundColor:'#f22b55',marginTop:1,transform:[{rotate:'-2deg'}]},ticket:{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:'rgba(255,255,255,.25)',backgroundColor:'rgba(255,255,255,.09)',alignItems:'center',justifyContent:'center'},heroEyebrow:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:1.35,color:'#ff8da7',marginTop:20},heroTitle:{maxWidth:580,fontFamily:'serif',fontSize:33,lineHeight:37,fontWeight:'700',letterSpacing:-.5,color:'#fff',marginTop:4},heroDescription:{maxWidth:510,fontSize:12,lineHeight:18,color:'rgba(255,255,255,.78)',marginTop:7},endDate:{flexDirection:'row',alignItems:'center',gap:5,marginTop:9},endDateText:{fontSize:8,fontWeight:'900',letterSpacing:1,color:'#ffb0c0'},heroCta:{minHeight:46,alignSelf:'flex-start',borderRadius:23,backgroundColor:'#fff',paddingHorizontal:17,marginTop:16,flexDirection:'row',alignItems:'center',gap:12},heroCtaText:{fontSize:9,fontWeight:'900',letterSpacing:.85,color:'#17110f'},chips:{gap:8,paddingVertical:18,paddingHorizontal:1},chip:{minHeight:42,borderRadius:21,borderWidth:1,borderColor:'#dcd2cd',backgroundColor:'#fff',paddingHorizontal:15,alignItems:'center',justifyContent:'center'},chipActive:{backgroundColor:'#251317',borderColor:'#251317'},chipText:{fontSize:11,fontWeight:'700',color:'#615752'},chipTextActive:{color:'#fff'},toolbar:{minHeight:48,borderTopWidth:1,borderBottomWidth:1,borderColor:'#e4dcd7',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},toolButton:{minHeight:44,flexDirection:'row',alignItems:'center',gap:7},toolText:{fontSize:11,fontWeight:'800',color:'#231c19'},filterCount:{minWidth:20,height:20,borderRadius:10,backgroundColor:RED,alignItems:'center',justifyContent:'center'},filterCountText:{fontSize:9,fontWeight:'900',color:'#fff'},clearInline:{minHeight:44,justifyContent:'center'},clearInlineText:{fontSize:10,fontWeight:'800',color:RED},sortLabel:{fontSize:8,fontWeight:'900',letterSpacing:.8,color:'#8d817b'},sectionHead:{marginTop:22,marginBottom:12,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},eyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.4,color:RED},sectionTitle:{fontFamily:'serif',fontSize:25,lineHeight:30,fontWeight:'700',color:'#171310',marginTop:3},countPill:{minWidth:61,height:42,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2d9d4',alignItems:'center',justifyContent:'center',paddingHorizontal:8},countValue:{fontSize:13,fontWeight:'900'},countText:{fontSize:6,fontWeight:'900',letterSpacing:.65,color:'#81756f'},offline:{minHeight:40,borderRadius:13,backgroundColor:'#fff8e8',paddingHorizontal:12,marginBottom:10,flexDirection:'row',alignItems:'center',gap:8},offlineText:{fontSize:10,fontWeight:'700',color:'#705d31'},row:{gap:12},card:{height:448,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#e6ddd8',overflow:'hidden',marginBottom:12,shadowColor:'#39251d',shadowOpacity:.08,shadowRadius:11,shadowOffset:{width:0,height:5},elevation:3},cardPressed:{opacity:.88,transform:[{scale:.99}]},imageWrap:{height:190,backgroundColor:'#faf8f6',borderBottomWidth:1,borderBottomColor:'#eee7e3',padding:15},image:{width:'100%',height:'100%'},badgeRow:{position:'absolute',left:10,top:10,flexDirection:'row',gap:5},discountBadge:{height:25,borderRadius:7,backgroundColor:'#171310',paddingHorizontal:8,alignItems:'center',justifyContent:'center'},discountBadgeText:{fontSize:9,fontWeight:'900',color:'#fff'},metaBadge:{height:25,borderRadius:7,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5dcd7',paddingHorizontal:7,alignItems:'center',justifyContent:'center'},metaBadgeText:{fontSize:7,fontWeight:'900',color:RED},wishlist:{position:'absolute',right:8,top:8,width:44,height:44,borderRadius:22,backgroundColor:'#fff',borderWidth:1,borderColor:'#eee6e1',alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.06,shadowRadius:6,elevation:2},cardBody:{flex:1,padding:14},brand:{fontSize:9,lineHeight:12,fontWeight:'900',letterSpacing:.8,color:'#251b18'},name:{height:40,fontFamily:'serif',fontSize:17,lineHeight:20,fontWeight:'700',color:'#181311',marginTop:3},variant:{fontSize:9.5,lineHeight:14,color:'#7d716a',marginTop:3},ratingSlot:{height:22,flexDirection:'row',alignItems:'center',gap:4},rating:{fontSize:9.5,fontWeight:'700',color:'#645951'},priceBlock:{height:73,justifyContent:'flex-end'},original:{fontSize:10,color:'#8d837e',textDecorationLine:'line-through'},current:{fontSize:19,lineHeight:23,fontWeight:'900',color:'#171310'},saved:{fontSize:9,lineHeight:13,fontWeight:'800',color:'#176b43'},addButton:{height:44,borderRadius:14,backgroundColor:RED,marginTop:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},added:{backgroundColor:'#176b43'},disabled:{opacity:.45},addText:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:'#fff'},skeleton:{backgroundColor:'#ebe6e3'},skeletonGrid:{marginTop:18,flexDirection:'row',flexWrap:'wrap',gap:12},skeletonLine:{height:10,borderRadius:5,backgroundColor:'#ebe6e3',marginTop:10},discovery:{marginTop:25},discoveryHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginBottom:10},discoveryTitle:{fontFamily:'serif',fontSize:23,lineHeight:28,fontWeight:'700'},discoveryCount:{fontSize:7,fontWeight:'900',letterSpacing:1,color:'#8f827b'},discoveryRail:{gap:10,paddingBottom:4},discoveryCard:{width:166,height:226,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5dcd7',padding:11},discoveryImage:{width:'100%',height:130,backgroundColor:'#faf8f6'},discoveryBrand:{fontSize:7,fontWeight:'900',letterSpacing:.7,color:RED,marginTop:9},discoveryName:{height:31,fontFamily:'serif',fontSize:14,lineHeight:16,fontWeight:'700'},discoveryPrice:{fontSize:11,fontWeight:'900',marginTop:'auto'},notice:{minHeight:72,borderRadius:17,backgroundColor:'#fff0f4',borderWidth:1,borderColor:'#f0d7de',padding:14,marginTop:22,flexDirection:'row',alignItems:'center',gap:11},noticeIcon:{width:38,height:38,borderRadius:13,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},noticeText:{flex:1,fontSize:11,lineHeight:17,color:'#65575c'},modalBackdrop:{flex:1,backgroundColor:'rgba(17,10,11,.62)',justifyContent:'flex-end'},sheet:{maxHeight:'82%',borderTopLeftRadius:26,borderTopRightRadius:26,backgroundColor:'#faf8f6',padding:20},filterSheet:{height:'82%'},sheetHandle:{width:42,height:4,borderRadius:2,backgroundColor:'#d5cbc6',alignSelf:'center',marginBottom:17},sheetHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:15},sheetEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.3,color:RED},sheetTitle:{fontFamily:'serif',fontSize:27,lineHeight:32,fontWeight:'700',marginTop:2},close:{width:44,height:44,borderRadius:22,backgroundColor:'#eee8e5',alignItems:'center',justifyContent:'center'},variantRow:{minHeight:72,borderTopWidth:1,borderTopColor:'#e6ded9',flexDirection:'row',alignItems:'center',gap:12},variantSize:{width:58,height:42,borderRadius:13,backgroundColor:'#251317',alignItems:'center',justifyContent:'center'},variantSizeText:{fontSize:11,fontWeight:'900',color:'#fff'},variantPrice:{fontSize:14,fontWeight:'900'},variantOld:{fontSize:9,color:'#81756f',marginTop:2},variantAdd:{width:44,height:44,borderRadius:15,backgroundColor:RED,alignItems:'center',justifyContent:'center'},filterLabel:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:'#665b56',marginTop:17,marginBottom:8},optionWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},option:{minHeight:38,borderRadius:19,borderWidth:1,borderColor:'#ddd3ce',backgroundColor:'#fff',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},optionActive:{backgroundColor:'#251317',borderColor:'#251317'},optionText:{fontSize:9.5,fontWeight:'700',color:'#655b55'},optionTextActive:{color:'#fff'},stockOption:{minHeight:48,flexDirection:'row',alignItems:'center',gap:9,marginTop:14},stockOptionText:{fontSize:11,fontWeight:'700'},sheetActions:{paddingTop:13,marginTop:10,borderTopWidth:1,borderTopColor:'#e4dcd7',flexDirection:'row',gap:9},clearButton:{height:48,borderRadius:15,borderWidth:1,borderColor:'#d8cfca',paddingHorizontal:18,alignItems:'center',justifyContent:'center'},clearText:{fontSize:9,fontWeight:'900'},applyButton:{height:48,borderRadius:15,backgroundColor:RED,flex:1,alignItems:'center',justifyContent:'center'},applyText:{fontSize:9,fontWeight:'900',color:'#fff'},state:{flex:1,backgroundColor:'#f6f2ef',alignItems:'center',justifyContent:'center',padding:28},stateIcon:{width:72,height:72,borderRadius:24,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},stateTitle:{fontFamily:'serif',fontSize:25,lineHeight:30,fontWeight:'700',textAlign:'center',marginTop:14},stateText:{maxWidth:390,fontSize:11,lineHeight:17,color:'#756a64',textAlign:'center',marginTop:5},stateButton:{minHeight:48,borderRadius:24,backgroundColor:'#171310',paddingHorizontal:20,alignItems:'center',justifyContent:'center',marginTop:16},stateButtonText:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:'#fff'},inlineEmpty:{minHeight:260,alignItems:'center',justifyContent:'center'},
});

const luxuryStyles=StyleSheet.create({
  emptyPage:{flexGrow:1,backgroundColor:'#FCFAF7',paddingTop:20},
  emptyShell:{width:'100%',minWidth:0,alignSelf:'center'},
  emptyHero:{overflow:'hidden',borderRadius:10,padding:24,justifyContent:'space-between',backgroundColor:'#251b18',shadowColor:'#21130f',shadowOpacity:.08,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:2},
  emptyHeroImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  emptyHeroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:16},
  emptyStatus:{minHeight:25,flexDirection:'row',alignItems:'center',gap:7},
  emptyStatusDot:{width:4,height:4,borderRadius:2,backgroundColor:'#D9B783'},
  emptyStatusText:{fontSize:6.5,lineHeight:10,fontWeight:'800',letterSpacing:.85,color:'rgba(255,255,255,.84)'},
  emptyHeroCopy:{maxWidth:510,minWidth:0},
  emptyEyebrow:{fontSize:8,lineHeight:12,fontWeight:'800',letterSpacing:1.55,color:'#E6C59A'},
  emptyTitle:{maxWidth:470,fontFamily:'serif',fontSize:34,lineHeight:39,fontWeight:'700',letterSpacing:-.45,color:'#fff',marginTop:7},
  emptyDescription:{maxWidth:475,fontSize:11.5,lineHeight:18,color:'rgba(255,255,255,.78)',marginTop:9},
  emptyPrimary:{minHeight:48,alignSelf:'flex-start',borderRadius:5,backgroundColor:'#FFFDF9',paddingHorizontal:18,marginTop:18,flexDirection:'row',alignItems:'center',gap:14},
  emptyPrimaryText:{fontSize:8,lineHeight:12,fontWeight:'900',letterSpacing:.9,color:'#171310'},
  emptyBenefits:{minHeight:104,marginTop:18,paddingVertical:19,flexDirection:'row',alignItems:'stretch',borderTopWidth:1,borderBottomWidth:1,borderColor:'#DCD4CD'},
  emptyBenefit:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',paddingHorizontal:8},
  emptyBenefitDivider:{width:1,backgroundColor:'#DED7D1',marginVertical:2},
  emptyBenefitTitle:{fontFamily:'serif',fontSize:13,lineHeight:17,fontWeight:'700',color:'#211A17',marginTop:7},
  emptyBenefitText:{fontSize:7.5,lineHeight:11,color:'#7C746E',textAlign:'center',marginTop:2},
  emptyPicks:{marginTop:38},
  emptyPicksHead:{minHeight:55,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:14,marginBottom:16},
  emptyPicksCopy:{flex:1,minWidth:0},
  emptyPicksEyebrow:{fontSize:8,lineHeight:12,fontWeight:'800',letterSpacing:1.45,color:'#9E1734'},
  emptyPicksTitle:{fontFamily:'serif',fontSize:26,lineHeight:31,fontWeight:'700',letterSpacing:-.25,color:'#1A1512',marginTop:4},
  emptyViewAll:{minHeight:44,paddingLeft:12,flexDirection:'row',alignItems:'center',gap:8},
  emptyViewAllText:{fontSize:9.5,lineHeight:14,fontWeight:'700',color:'#2D2724'},
  emptyPicksRail:{gap:14,paddingRight:4,paddingBottom:4},
  emptyPickCard:{width:176,minHeight:258,backgroundColor:'transparent'},
  emptyPickImageWrap:{width:'100%',height:166,borderRadius:5,overflow:'hidden',backgroundColor:'#F2EDE7',padding:13},
  emptyPickImage:{width:'100%',height:'100%'},
  emptyPickBrand:{fontSize:7.5,lineHeight:11,fontWeight:'900',letterSpacing:.75,color:'#9E1734',marginTop:11},
  emptyPickName:{height:38,fontFamily:'serif',fontSize:15,lineHeight:18,fontWeight:'700',color:'#1A1512',marginTop:3},
  emptyPickPrice:{fontSize:11.5,lineHeight:17,fontWeight:'800',color:'#201A17',marginTop:'auto'},
  productPressed:{opacity:.7},
  page:{flex:1,backgroundColor:'#FCFAF7'},
  list:{width:'100%',alignSelf:'center',paddingTop:20},
  hero:{minHeight:292,borderRadius:10,overflow:'hidden',padding:24,shadowColor:'#21130f',shadowOpacity:.08,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:2},
  heroGlow:{display:'none'},
  ticket:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(255,255,255,.26)',backgroundColor:'rgba(255,255,255,.07)',alignItems:'center',justifyContent:'center'},
  card:{height:456,borderRadius:8,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E1D9D2',overflow:'hidden',marginBottom:14,shadowOpacity:0,elevation:0},
  imageWrap:{height:200,backgroundColor:'#F7F3EF',borderBottomWidth:1,borderBottomColor:'#E9E2DC',padding:17},
  addButton:{height:44,borderRadius:5,backgroundColor:'#9E1734',marginTop:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  discoveryCard:{width:170,height:236,borderRadius:6,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E2DAD3',padding:12},
  notice:{minHeight:72,borderRadius:0,backgroundColor:'transparent',borderWidth:0,borderTopWidth:1,borderBottomWidth:1,borderColor:'#DED7D1',paddingVertical:16,paddingHorizontal:2,marginTop:28,flexDirection:'row',alignItems:'center',gap:11},
  noticeIcon:{width:32,height:32,alignItems:'center',justifyContent:'center'},
});
Object.assign(styles,luxuryStyles);

const finalPolishStyles=StyleSheet.create({
  emptyPage:{flexGrow:1,backgroundColor:'#FBF9F5',paddingTop:22},
  emptyHero:{overflow:'hidden',borderRadius:7,paddingHorizontal:25,paddingVertical:24,justifyContent:'space-between',backgroundColor:'#211815',shadowColor:'#21130F',shadowOpacity:.055,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:1},
  emptyHeroImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%',transform:[{scale:1.015}]},
  emptyHeroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},
  emptyStatus:{minHeight:24,flexShrink:1,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6},
  emptyStatusText:{flexShrink:1,fontSize:6,lineHeight:9,fontWeight:'800',letterSpacing:.8,color:'rgba(255,255,255,.8)',textAlign:'right'},
  emptyEyebrow:{fontSize:7.5,lineHeight:11,fontWeight:'800',letterSpacing:1.65,color:'#E4C39A'},
  emptyTitle:{maxWidth:455,fontFamily:'serif',fontSize:35,lineHeight:40,fontWeight:'700',letterSpacing:-.55,color:'#FFFDF9',marginTop:7},
  emptyDescription:{maxWidth:460,fontSize:11,lineHeight:18,color:'rgba(255,255,255,.77)',marginTop:9},
  emptyPrimary:{minHeight:46,alignSelf:'flex-start',borderRadius:3,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'rgba(226,195,153,.42)',paddingHorizontal:18,marginTop:18,flexDirection:'row',alignItems:'center',gap:15},
  emptyPrimaryText:{fontSize:7.5,lineHeight:11,fontWeight:'900',letterSpacing:1,color:'#171310'},
  emptyBenefits:{minHeight:92,marginTop:20,paddingVertical:17,flexDirection:'row',alignItems:'stretch',borderTopWidth:1,borderBottomWidth:1,borderColor:'#DCD5CE'},
  emptyBenefit:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center',paddingHorizontal:7},
  emptyBenefitDivider:{width:1,backgroundColor:'#E0D9D3',marginVertical:4},
  emptyBenefitTitle:{fontFamily:undefined,fontSize:10.5,lineHeight:15,fontWeight:'700',letterSpacing:.1,color:'#28211E',marginTop:6},
  emptyBenefitText:{fontSize:7,lineHeight:10.5,color:'#817972',textAlign:'center',marginTop:2},
  emptyPicks:{marginTop:44},
  emptyPicksHead:{minHeight:58,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:16,marginBottom:18},
  emptyPicksEyebrow:{fontSize:7.5,lineHeight:11,fontWeight:'800',letterSpacing:1.55,color:'#9E1734'},
  emptyPicksTitle:{fontFamily:'serif',fontSize:27,lineHeight:33,fontWeight:'700',letterSpacing:-.35,color:'#191411',marginTop:5},
  emptyViewAll:{minHeight:44,paddingLeft:14,flexDirection:'row',alignItems:'center',gap:9},
  emptyViewAllText:{fontSize:9,lineHeight:13,fontWeight:'700',color:'#312A26'},
  emptyPicksRail:{gap:16,paddingRight:6,paddingBottom:6},
  emptyPickCard:{width:182,minHeight:270,backgroundColor:'transparent'},
  emptyPickImageWrap:{width:'100%',height:174,overflow:'hidden',backgroundColor:'#FFFDF9',padding:10},
  emptyPickImage:{width:'100%',height:'100%',backgroundColor:'#FFFDF9'},
  emptyPickBrand:{fontSize:7,lineHeight:10.5,fontWeight:'900',letterSpacing:.85,color:'#8F2138',marginTop:12},
  emptyPickName:{height:41,fontFamily:'serif',fontSize:15.5,lineHeight:19,fontWeight:'700',letterSpacing:-.1,color:'#191411',marginTop:4},
  emptyPickPrice:{fontSize:11,lineHeight:16,fontWeight:'800',color:'#241E1A',marginTop:'auto'},
  page:{flex:1,backgroundColor:'#FBF9F5'},
  card:{height:456,borderRadius:5,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E6DFD8',overflow:'hidden',marginBottom:16,shadowOpacity:0,elevation:0},
  imageWrap:{height:204,backgroundColor:'#FBF8F4',borderBottomWidth:1,borderBottomColor:'#ECE5DF',padding:18},
  discoveryCard:{width:174,height:242,borderRadius:4,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E7E0DA',padding:12},
});
Object.assign(styles,finalPolishStyles);

const productCardStyles=StyleSheet.create({
  emptyPicksRail:{gap:17,paddingRight:8,paddingBottom:8},
  emptyPickCard:{width:188,minHeight:294,backgroundColor:'transparent'},
  emptyPickImageWrap:{width:'100%',height:192,overflow:'hidden',backgroundColor:'#FFFDF9'},
  emptyPickImage:{width:'100%',height:'100%',backgroundColor:'#FFFDF9',transform:[{scale:1.08}]},
  emptyPickBrand:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1,color:'#8C263B',marginTop:14},
  emptyPickName:{height:44,fontFamily:'serif',fontSize:16,lineHeight:20,fontWeight:'700',letterSpacing:-.15,color:'#191411',marginTop:4},
  emptyPickFooter:{minHeight:34,marginTop:'auto',paddingTop:9,borderTopWidth:1,borderTopColor:'#E8E1DB',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  emptyPickPrice:{flex:1,minWidth:0,fontSize:11.5,lineHeight:17,fontWeight:'800',color:'#241E1A'},
  card:{height:450,borderRadius:4,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E5DED8',overflow:'hidden',marginBottom:16,shadowOpacity:0,elevation:0},
  cardPressed:{opacity:.74},
  imageWrap:{height:210,overflow:'hidden',backgroundColor:'#FFFDF9',borderBottomWidth:1,borderBottomColor:'#ECE5DF',padding:10},
  image:{width:'100%',height:'100%',transform:[{scale:1.06}]},
  badgeRow:{position:'absolute',left:10,top:10,flexDirection:'row',gap:5},
  discountBadge:{height:23,borderRadius:3,backgroundColor:'#8E1E35',paddingHorizontal:8,alignItems:'center',justifyContent:'center'},
  discountBadgeText:{fontSize:8,fontWeight:'900',letterSpacing:.35,color:'#fff'},
  metaBadge:{height:23,borderRadius:3,backgroundColor:'rgba(255,253,249,.94)',borderWidth:1,borderColor:'#E6DED7',paddingHorizontal:7,alignItems:'center',justifyContent:'center'},
  metaBadgeText:{fontSize:6.5,fontWeight:'900',letterSpacing:.55,color:'#6C5F58'},
  wishlist:{position:'absolute',right:5,top:3,width:44,height:44,alignItems:'center',justifyContent:'center'},
  cardBody:{flex:1,paddingHorizontal:13,paddingTop:14,paddingBottom:12},
  brand:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1,color:'#8C263B'},
  name:{height:43,fontFamily:'serif',fontSize:16,lineHeight:20,fontWeight:'700',letterSpacing:-.15,color:'#191411',marginTop:4},
  variant:{fontSize:8.5,lineHeight:13,color:'#80766F',marginTop:3},
  ratingSlot:{height:20,flexDirection:'row',alignItems:'center',gap:4},
  rating:{fontSize:8.5,fontWeight:'600',color:'#6D625B'},
  priceBlock:{height:55,justifyContent:'flex-end'},
  priceLine:{flexDirection:'row',alignItems:'baseline',flexWrap:'wrap',gap:7},
  current:{fontSize:18,lineHeight:22,fontWeight:'900',color:'#191411'},
  original:{fontSize:9,lineHeight:13,color:'#958A83',textDecorationLine:'line-through'},
  saved:{fontSize:8,lineHeight:12,fontWeight:'700',color:'#49715B',marginTop:2},
  addButton:{height:43,borderRadius:3,backgroundColor:'#211916',marginTop:9,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  addText:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:.85,color:'#fff'},
});
Object.assign(styles,productCardStyles);
