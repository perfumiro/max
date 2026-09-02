import React,{memo,useCallback,useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {FlatList,Image,Keyboard,Platform,Pressable,StyleSheet,View,type ImageSourcePropType} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg,{Path,Text as SvgText} from 'react-native-svg';
import {useResponsiveLayout} from '../useResponsiveLayout';
import {loadBundledProducts,loadSharedProducts,type Product} from '../sharedCatalog';
import {searchProducts} from '../productSearch';
import {useBagSnapshot,useFavouriteSnapshot,useShoppingActions} from '../commerce/ShoppingContext';
import {logger} from '../observability/logger';
import {defaultShopConfig,loadShopConfig,type ShopConfig,type ShopLink} from './shopConfig';
import {matchesShopIntent,type ShopBrowseIntent} from './shopLogic';
import {SmoothScrollView as ScrollView} from '../components/smoothHorizontalScroll';
import {BrandDiscovery} from './BrandDiscovery';
import {buildBrandDiscoveryItems} from './brandDiscoveryLogic';
import {LocalizedText as Text,LocalizedTextInput as TextInput} from '../i18n/LocalizedPrimitives';
import {registerAndroidBackAction} from '../navigation/androidBackNavigation';

const RED='#d7193f';let shopOffset=0;let recentSearches:string[]=[];
type SectionId='saved'|'categories'|'brands'|'promise';
const CATEGORY_PHOTOS:Record<string,ImageSourcePropType>={
  men:require('../../assets/category-photos/for-him-editorial-v2.png'),
  'for-men':require('../../assets/category-photos/for-him-editorial-v2.png'),
  women:require('../../assets/category-photos/for-her-editorial-v1.png'),
  'for-women':require('../../assets/category-photos/for-her-editorial-v1.png'),
  unisex:require('../../assets/category-photos/unisex-editorial-v1.png'),
  luxury:require('../../assets/category-photos/luxury-editorial-v1.png'),
  niche:require('../../assets/category-photos/luxury-editorial-v1.png'),
  new:require('../../assets/category-photos/new-arrivals-editorial-v1.png'),
  'new-in':require('../../assets/category-photos/new-arrivals-editorial-v1.png'),
  offers:require('../../assets/category-photos/offers-editorial-v1.png'),
};
const CATEGORY_LOGOS:Record<string,ImageSourcePropType>={
  men:require('../../assets/category-logos/ipordise-men-mark-v1.png'),
  'for-men':require('../../assets/category-logos/ipordise-men-mark-v1.png'),
  women:require('../../assets/category-logos/ipordise-women-mark-v1.png'),
  'for-women':require('../../assets/category-logos/ipordise-women-mark-v1.png'),
  unisex:require('../../assets/category-logos/ipordise-unisex-mark-v1.png'),
  luxury:require('../../assets/category-logos/ipordise-luxury-mark-v1.png'),
  niche:require('../../assets/category-logos/ipordise-luxury-mark-v1.png'),
  new:require('../../assets/category-logos/ipordise-new-arrivals-mark-v1.png'),
  'new-in':require('../../assets/category-logos/ipordise-new-arrivals-mark-v1.png'),
  offers:require('../../assets/category-logos/ipordise-offers-mark-v1.png'),
};
const CATEGORY_MARKS:Record<string,string>={
  men:'male-outline','for-men':'male-outline',
  women:'female-outline','for-women':'female-outline',
  unisex:'male-female-outline',
  gifts:'gift-outline','discovery-sets':'gift-outline',
  miniatures:'flask-outline',
  luxury:'diamond-outline',niche:'diamond-outline',
  new:'sparkles-outline','new-in':'sparkles-outline',
  offers:'pricetag-outline',
};

const countFor=(products:Product[],item:Pick<ShopLink,'filter'|'query'>)=>products.filter(product=>matchesShopIntent(product,item)).length;

function ShopWordmark(){
  return <View accessibilityLabel="IPORDISE Shop" style={styles.shopWordmark}>
    <Svg accessibilityElementsHidden width={132} height={38} viewBox="0 0 132 38">
      <SvgText x="3" y="24.5" fill="#171310" fontFamily="Georgia, Times New Roman, serif" fontSize="25" fontWeight="700" letterSpacing="0.1">IPORDISE</SvgText>
      <Path d="M3 30.2 C27 38.2 53 38.1 78 33.1 C95 29.6 110 31 127 35.7" fill="none" stroke={RED} strokeWidth="1.9" strokeLinecap="round"/>
    </Svg>
    <View style={styles.shopEdition}><Text style={styles.shopEditionText}>SHOP</Text><View style={styles.shopEditionRule}/></View>
  </View>;
}

const CategoryCard=memo(function CategoryCard({item,count,width,onPress}:{item:ShopLink;count:number;width:number;onPress:()=>void}){
  const photo=CATEGORY_PHOTOS[item.id]||CATEGORY_PHOTOS[item.filter||''];
  const logo=CATEGORY_LOGOS[item.id]||CATEGORY_LOGOS[item.filter||''];
  const mark=CATEGORY_MARKS[item.id]||CATEGORY_MARKS[item.filter||'']||item.icon||'sparkles-outline';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}. ${item.description}. ${count} products`} onPress={onPress} style={({pressed})=>[styles.category,photo?styles.categoryPhotoCard:undefined,{width},pressed&&styles.pressed]}>{photo?<View style={styles.categoryMedia}><Image accessibilityIgnoresInvertColors source={photo} resizeMode="cover" style={styles.categoryPhoto}/><LinearGradient pointerEvents="none" colors={['rgba(12,8,7,0)','rgba(12,8,7,.18)']} style={StyleSheet.absoluteFill}/></View>:<View style={styles.categoryTop}><View style={styles.categoryIcon}>{logo?<Image accessibilityIgnoresInvertColors source={logo} resizeMode="contain" style={styles.categoryLogo}/>:<><View style={styles.categoryIconRing}><Ionicons accessibilityElementsHidden name={mark as any} size={21} color={RED}/></View><View style={styles.categoryIconDot}/></>}</View></View>}<View style={photo?styles.categoryPhotoCopy:styles.categoryCopy}><Text numberOfLines={1} style={[styles.categoryTitle,photo?styles.categoryPhotoTitle:undefined]}>{item.label}</Text><Text numberOfLines={1} style={styles.categoryDescription}>{item.description}</Text><View style={styles.categoryFooter}><Text style={styles.categoryCount}>{count} {count===1?'FRAGRANCE':'FRAGRANCES'}</Text><View style={styles.categoryArrow}><Ionicons accessibilityElementsHidden name="arrow-forward" size={14} color="#fff"/></View></View></View></Pressable>;
});

const BoutiqueProductCard=memo(function BoutiqueProductCard({product,width,liked=false,onPress,onToggleFavourite}:{product:Product;width:number;liked?:boolean;onPress:()=>void;onToggleFavourite?:()=>void}){
  const sizeCount=Object.values(product.sizes).filter(price=>price>0).length;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${product.brand} ${product.name}, ${product.price}`} onPress={onPress} style={({pressed})=>[styles.resultCard,{width},pressed&&styles.resultCardPressed]}><View style={styles.resultImageWrap}><Image accessibilityIgnoresInvertColors source={product.image} resizeMode="contain" resizeMethod="resize" fadeDuration={0} style={styles.resultImage}/>{product.badge?<View style={styles.resultBadge}><Text numberOfLines={1} style={styles.resultBadgeText}>{product.badge}</Text></View>:null}{onToggleFavourite?<Pressable accessibilityRole="button" accessibilityLabel={liked?'Remove from favourites':'Add to favourites'} accessibilityState={{selected:liked}} hitSlop={6} onPress={event=>{event.stopPropagation();onToggleFavourite();}} style={({pressed})=>[styles.resultHeart,pressed&&styles.pressed]}><Ionicons name={liked?'heart':'heart-outline'} size={23} color={liked?RED:'#171310'}/></Pressable>:null}</View><View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultBrand}>{product.brand}</Text><Text numberOfLines={2} style={styles.resultName}>{product.name}</Text><Text style={styles.resultAvailability}>{sizeCount?`${sizeCount} ${sizeCount===1?'size':'sizes'} available`:'Availability on request'}</Text><View style={styles.resultFooter}><Text style={styles.resultPrice}>{product.price}</Text><View style={styles.resultArrow}><Ionicons name="arrow-forward" size={14} color="#fff"/></View></View></View></Pressable>;
});

function SectionHeader({eyebrow,title,action,onAction}:{eyebrow:string;title:string;action?:string;onAction?:()=>void}){return <View style={styles.sectionHeader}><View style={{flex:1}}><Text style={styles.eyebrow}>{eyebrow}</Text><Text maxFontSizeMultiplier={1.4} style={styles.sectionTitle}>{title}</Text></View>{action&&onAction?<Pressable accessibilityRole="button" onPress={onAction} style={styles.textAction}><Text style={styles.textActionLabel}>{action}</Text><Ionicons name="arrow-forward" size={14}/></Pressable>:null}</View>;}

function SkeletonGrid({width}:{width:number}){return <View accessibilityLabel="Loading catalogue categories" style={styles.grid}>{[0,1,2,3].map(item=><View key={item} style={[styles.skeletonCard,{width}]}><View style={styles.skeletonIcon}/><View style={styles.skeletonLine}/><View style={[styles.skeletonLine,{width:'68%'}]}/></View>)}</View>;}

export function ShopScreen({fallbackProducts,onBrowse,onOpenProduct,onWishlist,onBag,bottomInset}:{fallbackProducts:Product[];onBrowse:(intent:ShopBrowseIntent)=>void;onOpenProduct:(product:Product,products:Product[])=>void;onWishlist:()=>void;onBag:()=>void;bottomInset:number}){
  const layout=useResponsiveLayout();const {bagCount}=useBagSnapshot();const {favouriteIds,favourites}=useFavouriteSnapshot();const {toggleFavourite}=useShoppingActions();const listRef=useRef<FlatList<SectionId>>(null);
  const restoredOffset=useRef(false);
  const bundledProducts=useMemo(()=>fallbackProducts.length?fallbackProducts:loadBundledProducts(),[fallbackProducts]);
  const [products,setProducts]=useState(bundledProducts);const [config,setConfig]=useState<ShopConfig>({...defaultShopConfig,banner:{...defaultShopConfig.banner,active:false}});const [loading,setLoading]=useState(true);const [error,setError]=useState(false);const [query,setQuery]=useState('');const deferredQuery=useDeferredValue(query);const [selectedCategory,setSelectedCategory]=useState<ShopLink|null>(null);const [selectedBrand,setSelectedBrand]=useState<string|null>(()=>Platform.OS==='web'&&typeof globalThis.location!=='undefined'?new URLSearchParams(globalThis.location.search).get('shopBrand'):null);const [sortMode,setSortMode]=useState<'featured'|'name'|'price-asc'|'price-desc'>('featured');const [availableOnly,setAvailableOnly]=useState(false);
  const refresh=useCallback(async(forceRefresh:unknown=false)=>{setLoading(true);setError(false);try{const catalog=await loadSharedProducts(forceRefresh===true);setProducts(catalog);}catch(reason){setProducts(bundledProducts);setError(!bundledProducts.length);logger.warn('shop_hub_using_cached_catalogue',{error:reason});}finally{setLoading(false);}},[bundledProducts]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{let mounted=true;void loadShopConfig().then(shop=>{if(mounted)setConfig({...shop,banner:{...shop.banner,active:false}});}).catch(reason=>logger.warn('shop_config_using_defaults',{error:reason}));return()=>{mounted=false;};},[]);
  const openIntent=useCallback((intent:ShopBrowseIntent)=>{const search=intent.brand||intent.query;if(search){recentSearches=[search,...recentSearches.filter(value=>value.toLowerCase()!==search.toLowerCase())].slice(0,5);}Keyboard.dismiss();onBrowse(intent);},[onBrowse]);
  const openBrand=useCallback((label:string)=>{Keyboard.dismiss();setSelectedCategory(null);setSelectedBrand(label);setSortMode('featured');setAvailableOnly(false);},[]);
  const retryBrands=useCallback(()=>{void refresh(true);},[refresh]);
  const suggestions=useMemo(()=>deferredQuery.trim().length>1?searchProducts(products,deferredQuery).slice(0,5):[],[deferredQuery,products]);
  const visibleCategories=useMemo(()=>config.categories.map(item=>({item,count:countFor(products,item)})).filter(entry=>entry.count>0),[config.categories,products]);
  const allBrands=useMemo(()=>buildBrandDiscoveryItems(products,config.featuredBrands,''),[config.featuredBrands,products]);
  const brands=allBrands;
  const columns=layout.compact?1:layout.catalogColumns;const cardWidth=Math.floor((layout.contentWidth-10*(columns-1))/columns);
  const resultColumns=layout.catalogColumns;const resultCardWidth=Math.floor((layout.contentWidth-10*(resultColumns-1))/resultColumns);
  const selectedProducts=useMemo(()=>{
    if(!selectedCategory&&!selectedBrand)return [];
    let matches=products.filter(product=>selectedBrand?matchesShopIntent(product,{brand:selectedBrand}):matchesShopIntent(product,selectedCategory!));
    if(availableOnly)matches=matches.filter(product=>product.stockLeft!==0&&Object.values(product.sizes).some(price=>price>0));
    const isNewArrivals=selectedCategory?.id==='new'||selectedCategory?.filter==='new-in';
    if(sortMode==='name')matches=[...matches].sort((a,b)=>a.name.localeCompare(b.name));
    if(sortMode==='price-asc'||sortMode==='price-desc')matches=[...matches].sort((a,b)=>{const price=(product:Product)=>Math.min(...Object.values(product.sizes).filter(value=>value>0),Number.MAX_SAFE_INTEGER);return sortMode==='price-asc'?price(a)-price(b):price(b)-price(a);});
    return isNewArrivals?matches.slice(0,15):matches;
  },[availableOnly,products,selectedBrand,selectedCategory,sortMode]);
  const openCategory=useCallback((category:ShopLink)=>{Keyboard.dismiss();setSelectedBrand(null);setSelectedCategory(category);setSortMode('featured');setAvailableOnly(false);},[]);
  const closeResults=useCallback(()=>{setSelectedCategory(null);setSelectedBrand(null);setSortMode('featured');setAvailableOnly(false);},[]);
  const cycleSort=useCallback(()=>setSortMode(current=>current==='featured'?'name':current==='name'?'price-asc':current==='price-asc'?'price-desc':'featured'),[]);
  useEffect(()=>{if(Platform.OS==='web'||(!selectedCategory&&!selectedBrand))return;return registerAndroidBackAction(()=>{closeResults();return true;});},[closeResults,selectedBrand,selectedCategory]);
  const sections=useMemo<SectionId[]>(()=>['brands'],[]);
  const resultTitle=selectedBrand||selectedCategory?.label||'';
  const resultDescription=selectedBrand?'Explore the house, its signatures and available formats.':selectedCategory?.description||'';
  const sortLabel={featured:'Featured',name:'Name A–Z','price-asc':'Price low–high','price-desc':'Price high–low'}[sortMode];
  const bannerImage:ImageSourcePropType={uri:(layout.tablet&&config.banner.tabletImageUrl?config.banner.tabletImageUrl:config.banner.imageUrl)||''};
  const searchPanel=query?<View style={[styles.suggestions,styles.suggestionsPremium]}>
    <View style={styles.suggestionsHeader}><View><Text style={styles.suggestionsEyebrow}>IPORDISE SEARCH</Text><Text style={styles.suggestionsTitle}>{query.trim().length<2?'Find your fragrance':`${suggestions.length} ${suggestions.length===1?'match':'matches'}`}</Text></View><View style={styles.suggestionsMark}><Ionicons name="sparkles-outline" size={17} color={RED}/></View></View>
    {suggestions.length?suggestions.map((product,index)=><Pressable accessibilityRole="button" accessibilityLabel={`Open ${product.brand} ${product.name}`} key={product.id} onPress={()=>onOpenProduct(product,products)} style={({pressed})=>[styles.suggestion,styles.suggestionPremium,index>0&&styles.suggestionDivider,pressed&&styles.suggestionPressed]}><View style={styles.suggestionImageWrap}><Image source={product.image} resizeMode="contain" style={[styles.suggestionImage,styles.suggestionImagePremium]}/></View><View style={styles.suggestionCopy}><Text style={styles.suggestionBrand}>{product.brand}</Text><Text numberOfLines={1} style={[styles.suggestionName,styles.suggestionNamePremium]}>{product.name}</Text><Text style={styles.suggestionMeta}>Available in the boutique</Text></View><Text style={[styles.suggestionPrice,styles.suggestionPricePremium]}>{product.price}</Text><View style={styles.suggestionArrow}><Ionicons name="arrow-forward" size={13} color="#fff"/></View></Pressable>):<View style={[styles.noSuggestion,styles.noSuggestionPremium]}><View style={styles.noSuggestionIcon}><Ionicons name="search-outline" size={20} color={RED}/></View><Text style={styles.noSuggestionTitle}>{query.length<2?'Keep typing to search':'No exact match found'}</Text><Text style={styles.noSuggestionText}>{query.length<2?'Search by fragrance, house, note, or collection.':'Try another fragrance, brand, or note.'}</Text></View>}
    {query.trim().length>1?<Pressable accessibilityRole="button" accessibilityLabel={`View all results for ${query.trim()}`} onPress={()=>openIntent({query:query.trim()})} style={({pressed})=>[styles.allResults,styles.allResultsPremium,pressed&&styles.allResultsPressed]}><View><Text style={styles.allResultsEyebrow}>EXPLORE THE CATALOGUE</Text><Text style={styles.allResultsText}>VIEW ALL RESULTS</Text></View><View style={styles.allResultsArrow}><Ionicons name="arrow-forward" size={15} color="#171310"/></View></Pressable>:null}
  </View>:recentSearches.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRail}><Text style={styles.recentLabel}>RECENT</Text>{recentSearches.map(value=><Pressable key={value} onPress={()=>setQuery(value)} style={styles.recentChip}><Text style={styles.recentChipText}>{value}</Text></Pressable>)}</ScrollView>:null;
  const header=<>
    <View style={styles.globalHeader}><ShopWordmark/><View style={styles.headerActions}><Pressable accessibilityRole="button" accessibilityLabel={`Wishlist, ${favouriteIds.size} saved`} onPress={onWishlist} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}><Ionicons name={favouriteIds.size?'heart':'heart-outline'} size={22}/>{favouriteIds.size?<View style={styles.badge}><Text style={styles.badgeText}>{Math.min(favouriteIds.size,99)}</Text></View>:null}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Shopping bag, ${bagCount} items`} onPress={onBag} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}><Ionicons name={bagCount?'bag-handle':'bag-outline'} size={21}/>{bagCount?<View style={styles.badge}><Text style={styles.badgeText}>{Math.min(bagCount,99)}</Text></View>:null}</Pressable></View></View>
    <View style={[styles.searchBox,styles.searchBoxPremium,query&&styles.searchBoxActive]}><View style={[styles.searchIconWrap,query&&styles.searchIconWrapActive]}><Ionicons name="search-outline" size={19} color={query?RED:'#5f5550'}/></View><TextInput accessibilityRole="search" accessibilityLabel="Search perfumes, brands or collections" accessibilityHint="Search the full IPORDISE fragrance catalogue" value={query} onChangeText={setQuery} onSubmitEditing={()=>query.trim()&&openIntent({query:query.trim()})} placeholder="Search perfumes, brands or collections" placeholderTextColor="#8b807a" selectionColor={RED} cursorColor={RED} returnKeyType="search" autoCapitalize="none" autoCorrect={false} style={[styles.searchInput,styles.searchInputPremium]}/>{query?<Pressable accessibilityRole="button" accessibilityLabel="Clear catalogue search" onPress={()=>setQuery('')} style={({pressed})=>[styles.clearButton,styles.clearButtonPremium,pressed&&styles.clearButtonPressed]}><Ionicons name="close" size={17}/></Pressable>:null}</View>
    {searchPanel}
    {error?<View accessibilityRole="alert" style={styles.offline}><Ionicons name="cloud-offline-outline" size={17} color="#7d3a48"/><Text style={styles.offlineText}>Showing the last available catalogue. Live information is unavailable.</Text><Pressable accessibilityRole="button" onPress={refresh} style={styles.retry}><Text style={styles.retryText}>RETRY</Text></Pressable></View>:null}
    {config.banner.active?<Pressable accessibilityRole="button" accessibilityLabel={`${config.banner.headline}. ${config.banner.ctaLabel}`} onPress={()=>openIntent({filter:config.banner.filter})} style={({pressed})=>[styles.banner,{height:layout.tablet?290:layout.compact?210:230},pressed&&styles.pressed]}><Image source={bannerImage} resizeMode="cover" style={StyleSheet.absoluteFill}/><LinearGradient start={{x:0,y:.5}} end={{x:1,y:.5}} colors={['rgba(8,6,6,.96)','rgba(8,6,6,.66)','rgba(8,6,6,.06)']} locations={[0,.48,1]} style={StyleSheet.absoluteFill}/><View style={styles.bannerCopy}><Text style={styles.bannerEyebrow}>{config.banner.eyebrow}</Text><Text maxFontSizeMultiplier={1.35} style={styles.bannerTitle}>{config.banner.headline}</Text><Text style={styles.bannerText}>{config.banner.description}</Text><View style={styles.bannerCta}><Text style={styles.bannerCtaText}>{config.banner.ctaLabel.toUpperCase()}</Text><Ionicons name="arrow-forward" size={15} color="#171310"/></View></View></Pressable>:null}
  </>;
  const renderSection=({item}:{item:SectionId})=>{
    if(item==='saved')return <View style={styles.section}><SectionHeader eyebrow="YOUR EDIT" title="Saved fragrances" action="View wishlist" onAction={onWishlist}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRail}>{favourites.slice(0,8).map(product=><Pressable accessibilityRole="button" key={product.id} onPress={()=>onOpenProduct(product,products)} style={styles.savedCard}><Image source={product.image} resizeMode="contain" style={styles.savedImage}/><Text style={styles.savedBrand}>{product.brand}</Text><Text numberOfLines={2} style={styles.savedName}>{product.name}</Text></Pressable>)}</ScrollView></View>;
    if(item==='categories')return <View style={styles.section}><SectionHeader eyebrow="EXPLORE THE BOUTIQUE" title="Shop by category"/>{loading&&!products.length?<SkeletonGrid width={cardWidth}/>:visibleCategories.length?<View style={styles.grid}>{visibleCategories.map(({item:link,count})=><CategoryCard key={link.id} item={link} count={count} width={cardWidth} onPress={()=>openCategory(link)}/>)}</View>:<View style={styles.empty}><Ionicons name="grid-outline" size={28} color={RED}/><Text style={styles.emptyTitle}>Categories are being curated.</Text><Text style={styles.emptyText}>You can still explore every available fragrance.</Text><Pressable accessibilityRole="button" onPress={()=>openIntent({})} style={styles.emptyCta}><Text style={styles.emptyCtaText}>BROWSE ALL PRODUCTS</Text></Pressable></View>}</View>;
    if(item==='brands')return <BrandDiscovery brands={brands} totalBrandCount={allBrands.length} query="" cardWidth={cardWidth} contentWidth={layout.contentWidth} loading={loading} error={error} onQueryChange={()=>{}} onOpenBrand={openBrand} onRetry={retryBrands}/>;
    return <View style={styles.promise}><View style={styles.promiseIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#176b43"/></View><View style={{flex:1}}><Text style={styles.promiseTitle}>Authentic, always.</Text><Text style={styles.promiseText}>Carefully sourced fragrances with delivery across Morocco.</Text></View></View>;
  };
  if((selectedCategory||selectedBrand)&&loading)return <View style={styles.resultsShell}><View style={styles.brandPageTopbar}><Pressable accessibilityRole="button" accessibilityLabel="Back to Boutique" onPress={closeResults} style={styles.brandBack}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={1} style={styles.brandTopbarTitle}>{resultTitle}</Text><View style={styles.brandTopbarActions}/></View><View style={styles.resultsLoading}><Text style={styles.brandIdentityEyebrow}>IPORDISE BOUTIQUE</Text><Text style={styles.resultsLoadingTitle}>Preparing the edit…</Text><SkeletonGrid width={resultCardWidth}/></View></View>;
  if(selectedCategory||selectedBrand)return <View style={styles.resultsShell}><FlatList
    style={[styles.resultsList,{width:layout.contentWidth}]}
    key={`results-${selectedBrand||selectedCategory?.id}-${resultColumns}`}
    data={selectedProducts}
    numColumns={resultColumns}
    keyExtractor={product=>product.id}
    renderItem={({item})=><BoutiqueProductCard product={item} width={resultCardWidth} liked={favouriteIds.has(item.id)} onToggleFavourite={()=>toggleFavourite(item)} onPress={()=>onOpenProduct(item,selectedProducts)}/>}
    columnWrapperStyle={resultColumns>1?[styles.resultRow,selectedProducts.length<resultColumns&&styles.resultRowSparse]:undefined}
    showsVerticalScrollIndicator={false}
    removeClippedSubviews={Platform.OS!=='web'}
    initialNumToRender={resultColumns*4}
    maxToRenderPerBatch={resultColumns*3}
    windowSize={7}
    contentContainerStyle={[styles.resultsCatalogue,{paddingBottom:bottomInset+28}]}
    ListHeaderComponent={<View>
      <View style={styles.brandPageTopbar}><Pressable accessibilityRole="button" accessibilityLabel="Back to Boutique" onPress={closeResults} style={({pressed})=>[styles.brandBack,pressed&&styles.pressed]}><Ionicons name="arrow-back" size={24}/></Pressable><Text numberOfLines={1} style={styles.brandTopbarTitle}>{resultTitle}</Text><View style={styles.brandTopbarActions}><Pressable accessibilityRole="button" accessibilityLabel="Open wishlist" onPress={onWishlist} style={styles.brandTopbarButton}><Ionicons name={favouriteIds.size?'heart':'heart-outline'} size={23}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Shopping bag, ${bagCount} items`} onPress={onBag} style={styles.brandTopbarButton}><Ionicons name={bagCount?'bag-handle':'bag-outline'} size={22}/>{bagCount?<View style={styles.badge}><Text style={styles.badgeText}>{Math.min(bagCount,99)}</Text></View>:null}</Pressable></View></View>
      <View style={styles.brandIdentity}>{selectedBrand?<><Text style={styles.brandIdentityEyebrow}>THE HOUSE OF</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.brandIdentityName}>{selectedBrand}</Text></>:<><View style={styles.resultsHeaderMark}><Ionicons name={(CATEGORY_MARKS[selectedCategory?.id||'']||CATEGORY_MARKS[selectedCategory?.filter||'']||selectedCategory?.icon||'sparkles-outline') as any} size={19} color={RED}/></View><Text style={styles.brandIdentityEyebrow}>IPORDISE SELECTED EDIT</Text><Text style={styles.brandIdentityName}>{resultTitle}</Text></>}<Text style={styles.brandIdentityDescription}>{resultDescription}</Text><Pressable accessibilityRole="button" accessibilityLabel="Explore brands, categories and collections" onPress={closeResults} style={styles.brandExploreRow}><View><Text style={styles.brandExploreLabel}>Explore the boutique</Text><Text style={styles.brandExploreText}>Brands, categories and collections</Text></View><Ionicons name="chevron-forward" size={22} color="#8b807a"/></Pressable></View>
      <View style={styles.catalogueControls}><Pressable accessibilityRole="button" accessibilityLabel={`Sort products. Current: ${sortLabel}`} onPress={cycleSort} style={styles.catalogueControl}><Text style={styles.catalogueControlText}>Sort</Text><Text numberOfLines={1} style={styles.catalogueControlValue}>{sortLabel}</Text><Ionicons name="chevron-down" size={16}/></Pressable><View style={styles.catalogueControlDivider}/><Pressable accessibilityRole="button" accessibilityLabel="Filter to available products" accessibilityState={{selected:availableOnly}} onPress={()=>setAvailableOnly(value=>!value)} style={styles.catalogueControl}><Text style={styles.catalogueControlText}>Filter</Text><Ionicons name="options-outline" size={19} color={availableOnly?RED:'#171310'}/>{availableOnly?<View style={styles.filterActiveDot}/>:null}</Pressable></View>
      <Text accessibilityLiveRegion="polite" style={styles.catalogueCount}>{selectedProducts.length} {selectedProducts.length===1?'product':'products'}</Text>
    </View>}
    ListEmptyComponent={<View style={styles.empty}><Ionicons name="sparkles-outline" size={28} color={RED}/><Text style={styles.emptyTitle}>This edit is being prepared.</Text><Text style={styles.emptyText}>New fragrances will appear here as soon as they are available.</Text><Pressable accessibilityRole="button" onPress={closeResults} style={styles.emptyCta}><Text style={styles.emptyCtaText}>BACK TO BOUTIQUE</Text></Pressable></View>}
  /></View>;
  return <View style={styles.page}><FlatList ref={listRef} data={sections} keyExtractor={item=>item} renderItem={renderSection} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS!=='web'} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} contentContainerStyle={[styles.content,{width:layout.contentWidth,paddingHorizontal:0,paddingBottom:bottomInset+28}]} onScroll={({nativeEvent})=>{shopOffset=nativeEvent.contentOffset.y;}} onContentSizeChange={()=>{if(restoredOffset.current)return;restoredOffset.current=true;listRef.current?.scrollToOffset({offset:shopOffset,animated:false});}} scrollEventThrottle={80}/></View>;
}

const styles=StyleSheet.create({
  categoryPhotoCard:{minHeight:222,padding:0,overflow:'hidden'},
  categoryMedia:{height:128,backgroundColor:'#e8dfda',overflow:'hidden'},
  categoryPhoto:{width:'100%',height:'100%'},
  categoryPhotoCopy:{flex:1,paddingHorizontal:13,paddingTop:11,paddingBottom:11},
  categoryCopy:{flex:1},
  categoryPhotoTitle:{marginTop:0},
  categoryFooter:{marginTop:'auto',paddingTop:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  resultsShell:{flex:1,backgroundColor:'#f3f3f3'},
  resultsList:{alignSelf:'center'},
  resultsCatalogue:{width:'100%',paddingTop:0},
  resultsLoading:{paddingHorizontal:10,paddingTop:35},
  resultsLoadingTitle:{fontFamily:'serif',fontSize:25,lineHeight:31,fontWeight:'700',color:'#171310',marginTop:5,marginBottom:20},
  brandPageTopbar:{height:70,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e7e2df',paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brandBack:{width:48,height:48,alignItems:'center',justifyContent:'center'},
  brandTopbarTitle:{flex:1,textAlign:'center',fontSize:17,lineHeight:22,fontWeight:'800',color:'#171310',paddingHorizontal:6},
  brandTopbarActions:{width:82,flexDirection:'row',alignItems:'center',justifyContent:'flex-end'},
  brandTopbarButton:{width:40,height:46,alignItems:'center',justifyContent:'center'},
  brandIdentity:{backgroundColor:'#fff',paddingTop:32,paddingHorizontal:20,alignItems:'center'},
  brandIdentityEyebrow:{fontSize:8,lineHeight:12,fontWeight:'900',letterSpacing:2.1,color:RED},
  brandIdentityName:{maxWidth:'100%',fontFamily:'serif',fontSize:32,lineHeight:39,fontWeight:'800',letterSpacing:1.6,color:'#111',textAlign:'center',marginTop:5},
  brandIdentityDescription:{maxWidth:430,fontSize:11,lineHeight:17,color:'#756d68',textAlign:'center',marginTop:8},
  brandExploreRow:{width:'100%',minHeight:74,borderTopWidth:1,borderTopColor:'#e6e0dc',marginTop:24,paddingVertical:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brandExploreLabel:{fontSize:10,lineHeight:14,color:'#817872'},
  brandExploreText:{fontSize:14,lineHeight:19,fontWeight:'700',color:'#171310',marginTop:2},
  catalogueControls:{height:72,backgroundColor:'#fff',borderTopWidth:1,borderBottomWidth:1,borderColor:'#e3dedb',flexDirection:'row',alignItems:'center'},
  catalogueControl:{flex:1,minHeight:52,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  catalogueControlText:{fontSize:15,lineHeight:20,fontWeight:'700',color:'#171310'},
  catalogueControlValue:{maxWidth:88,fontSize:9,lineHeight:13,color:'#817872'},
  catalogueControlDivider:{width:1,height:42,backgroundColor:'#cfc8c4'},
  filterActiveDot:{position:'absolute',right:17,top:14,width:7,height:7,borderRadius:4,backgroundColor:RED},
  catalogueCount:{height:70,textAlign:'center',textAlignVertical:'center',paddingTop:25,fontSize:13,lineHeight:18,fontWeight:'700',color:'#756d68'},
  resultsPage:{alignSelf:'center',paddingTop:10},resultsHeader:{borderRadius:22,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3d9d4',padding:18,marginBottom:14},resultsHeaderTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},resultsBack:{width:44,height:44,borderRadius:22,backgroundColor:'#f2ece8',alignItems:'center',justifyContent:'center'},resultsHeaderMark:{width:44,height:44,borderRadius:15,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},resultsEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.25,color:RED,marginTop:18},resultsTitle:{fontFamily:'serif',fontSize:30,lineHeight:35,fontWeight:'700',color:'#171310',marginTop:3},resultsDescription:{fontSize:11,lineHeight:17,color:'#746963',marginTop:4},resultsSummary:{height:34,alignSelf:'flex-start',borderRadius:17,backgroundColor:'#251317',paddingHorizontal:12,marginTop:13,flexDirection:'row',alignItems:'center',gap:7},resultsSummaryValue:{fontSize:12,fontWeight:'900',color:'#fff'},resultsSummaryText:{fontSize:7.5,fontWeight:'900',letterSpacing:.7,color:'rgba(255,255,255,.72)'},resultRow:{gap:10},resultRowSparse:{justifyContent:'center'},resultCard:{height:348,borderRadius:8,backgroundColor:'#fff',borderWidth:0,overflow:'hidden',marginBottom:10,shadowColor:'#2c211d',shadowOpacity:.08,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:2},resultCardPressed:{opacity:.86,transform:[{scale:.99}]},resultImageWrap:{height:180,backgroundColor:'#fff',padding:15,borderBottomWidth:0},resultImage:{width:'100%',height:'100%'},resultBadge:{position:'absolute',left:10,top:12,maxWidth:'65%',height:23,borderRadius:0,borderWidth:1,borderColor:'#251317',backgroundColor:'#fff',paddingHorizontal:6,alignItems:'center',justifyContent:'center'},resultBadgeText:{fontSize:7,fontWeight:'900',letterSpacing:.45,color:'#251317'},resultHeart:{position:'absolute',right:8,top:8,width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,.96)',alignItems:'center',justifyContent:'center'},resultCopy:{flex:1,paddingHorizontal:13,paddingTop:9,paddingBottom:13,alignItems:'center'},resultBrand:{fontSize:10,fontWeight:'900',letterSpacing:.9,color:'#171310'},resultName:{height:42,fontSize:14,lineHeight:19,fontWeight:'600',color:'#171310',textAlign:'center',marginTop:5},resultAvailability:{fontSize:9.5,lineHeight:14,color:'#756d68',textAlign:'center',marginTop:10},resultFooter:{width:'100%',marginTop:'auto',alignItems:'center',justifyContent:'center'},resultPrice:{fontSize:18,lineHeight:24,fontWeight:'900',color:'#171310',textAlign:'center'},resultArrow:{display:'none'},
  shopWordmark:{width:132,minHeight:48,justifyContent:'flex-start'},
  shopEdition:{height:10,marginTop:-3,paddingLeft:3,flexDirection:'row',alignItems:'center',gap:6},
  shopEditionText:{fontSize:7.5,lineHeight:9,fontWeight:'900',letterSpacing:1.75,color:RED},
  shopEditionRule:{width:22,height:1,backgroundColor:'rgba(215,25,63,.42)'},
  categoryLogo:{width:39,height:39},
  searchBoxPremium:{minHeight:58,borderRadius:22,paddingLeft:7,paddingRight:7,gap:8,shadowColor:'#2a1713',shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:2},
  searchBoxActive:{borderColor:'rgba(215,25,63,.52)',shadowColor:RED,shadowOpacity:.1},
  searchIconWrap:{width:42,height:42,borderRadius:15,backgroundColor:'#f5f0ed',alignItems:'center',justifyContent:'center'},
  searchIconWrapActive:{backgroundColor:'#fff0f4'},
  searchInputPremium:{height:56,fontSize:14.5},
  clearButtonPremium:{width:42,height:42,borderRadius:15},
  clearButtonPressed:{opacity:.62},
  suggestionsPremium:{borderRadius:22,padding:8,marginTop:8,borderColor:'#ddd3ce',shadowColor:'#2a1713',shadowOpacity:.09,shadowRadius:18,shadowOffset:{width:0,height:7},elevation:4},
  suggestionsHeader:{minHeight:62,paddingHorizontal:10,paddingVertical:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  suggestionsEyebrow:{fontSize:7.5,lineHeight:11,fontWeight:'900',letterSpacing:1.35,color:RED},
  suggestionsTitle:{fontFamily:'serif',fontSize:18,lineHeight:23,fontWeight:'700',color:'#171310',marginTop:2},
  suggestionsMark:{width:36,height:36,borderRadius:13,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},
  suggestionPremium:{minHeight:74,borderRadius:15,paddingHorizontal:7,gap:10},
  suggestionDivider:{borderTopWidth:1,borderTopColor:'#eee8e4'},
  suggestionPressed:{backgroundColor:'#faf5f2'},
  suggestionImageWrap:{width:56,height:56,borderRadius:14,backgroundColor:'#f7f3f0',borderWidth:1,borderColor:'#eee7e3',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  suggestionImagePremium:{width:48,height:48,borderRadius:0,backgroundColor:'transparent'},
  suggestionCopy:{flex:1,minWidth:0},
  suggestionNamePremium:{fontSize:12.5,lineHeight:17,marginTop:2},
  suggestionMeta:{fontSize:8.5,lineHeight:12,color:'#8a7f79',marginTop:2},
  suggestionPricePremium:{fontSize:10.5,color:'#171310'},
  suggestionArrow:{width:30,height:30,borderRadius:15,backgroundColor:'#211719',alignItems:'center',justifyContent:'center'},
  noSuggestionPremium:{minHeight:150,alignItems:'center',justifyContent:'center'},
  noSuggestionIcon:{width:44,height:44,borderRadius:16,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center',marginBottom:9},
  allResultsPremium:{minHeight:62,borderRadius:17,paddingHorizontal:15,marginTop:7,backgroundColor:'#211719'},
  allResultsEyebrow:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.05,color:'rgba(255,255,255,.55)'},
  allResultsArrow:{width:35,height:35,borderRadius:18,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  allResultsPressed:{opacity:.78},
  page:{flex:1,backgroundColor:'#f7f3f0'},content:{width:'100%',alignSelf:'center',paddingTop:10},pressed:{opacity:.78,transform:[{scale:.985}]},globalHeader:{minHeight:60,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:3},wordmark:{fontFamily:'serif',fontSize:25,lineHeight:28,fontWeight:'700'},wordmarkLine:{height:2,width:103,borderRadius:2,backgroundColor:RED,marginTop:1,transform:[{rotate:'-2deg'}]},shopLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.4,color:RED,marginTop:5},headerActions:{flexDirection:'row',gap:8},headerButton:{width:46,height:46,borderRadius:23,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4dbd6',alignItems:'center',justifyContent:'center'},badge:{position:'absolute',right:-2,top:-3,minWidth:18,height:18,borderRadius:9,backgroundColor:RED,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},badgeText:{fontSize:9,fontWeight:'900',color:'#fff'},searchBox:{minHeight:54,borderRadius:19,borderWidth:1,borderColor:'#d9cfca',backgroundColor:'#fff',paddingLeft:16,paddingRight:6,flexDirection:'row',alignItems:'center',gap:9,marginTop:8},searchInput:{flex:1,minWidth:0,height:52,fontSize:14,color:'#171310'},clearButton:{width:40,height:40,borderRadius:14,backgroundColor:'#f1ece9',alignItems:'center',justifyContent:'center'},suggestions:{borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2d8d3',marginTop:6,padding:6},suggestion:{minHeight:58,borderRadius:13,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:9},suggestionImage:{width:42,height:42,borderRadius:9,backgroundColor:'#faf8f7'},suggestionBrand:{fontSize:9,fontWeight:'900',letterSpacing:.55,color:RED},suggestionName:{fontSize:12,lineHeight:16,fontWeight:'700',marginTop:2},suggestionPrice:{fontSize:10,fontWeight:'800'},noSuggestion:{padding:15},noSuggestionTitle:{fontFamily:'serif',fontSize:17,fontWeight:'700'},noSuggestionText:{fontSize:11,lineHeight:16,color:'#776c66',marginTop:3},allResults:{minHeight:46,borderRadius:14,backgroundColor:'#171310',paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},allResultsText:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:'#fff'},recentRail:{minHeight:42,alignItems:'center',gap:7,paddingVertical:7},recentLabel:{fontSize:9,fontWeight:'900',letterSpacing:1,color:'#81756f'},recentChip:{minHeight:32,borderRadius:16,backgroundColor:'#eee7e3',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},recentChipText:{fontSize:11,fontWeight:'700'},offline:{minHeight:52,borderRadius:15,backgroundColor:'#f6e8eb',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,marginTop:8},offlineText:{flex:1,fontSize:10,lineHeight:15,color:'#713341'},retry:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},retryText:{fontSize:9,fontWeight:'900',letterSpacing:.7,color:RED},banner:{borderRadius:22,overflow:'hidden',marginTop:12,justifyContent:'flex-end',backgroundColor:'#171310'},bannerCopy:{padding:20,maxWidth:500},bannerEyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.25,color:'#ff6688'},bannerTitle:{fontFamily:'serif',fontSize:29,lineHeight:34,fontWeight:'700',color:'#fff',marginTop:4},bannerText:{fontSize:11.5,lineHeight:17,color:'rgba(255,255,255,.8)',marginTop:3},bannerCta:{minHeight:45,alignSelf:'flex-start',borderRadius:23,backgroundColor:'#fff',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:12,marginTop:13},bannerCtaText:{fontSize:9,fontWeight:'900',letterSpacing:.65},section:{marginTop:26},sectionHeader:{minHeight:52,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginBottom:12},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:RED},sectionTitle:{fontFamily:'serif',fontSize:24,lineHeight:29,fontWeight:'700',marginTop:3},textAction:{minHeight:44,flexDirection:'row',alignItems:'center',gap:7,paddingLeft:12},textActionLabel:{fontSize:10,fontWeight:'800'},quickRail:{gap:9,paddingRight:3},quickCard:{width:128,minHeight:102,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3dad5',padding:12},quickIcon:{width:36,height:36,borderRadius:12,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},quickLabel:{fontFamily:'serif',fontSize:15,lineHeight:19,fontWeight:'700',marginTop:9},quickCount:{fontSize:9.5,color:'#80746e',marginTop:2},savedRail:{gap:9},savedCard:{width:140,minHeight:174,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3dad5',padding:10},savedImage:{width:'100%',height:105,backgroundColor:'#faf8f7',borderRadius:11},savedBrand:{fontSize:9,fontWeight:'900',letterSpacing:.55,color:RED,marginTop:8},savedName:{fontSize:11.5,lineHeight:15,fontWeight:'700',marginTop:2},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},category:{minHeight:166,borderRadius:19,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2d9d4',padding:14},categoryTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},categoryIcon:{width:48,height:48,borderRadius:16,backgroundColor:'#fff0f4',borderWidth:1,borderColor:'#f5dfe5',alignItems:'center',justifyContent:'center',position:'relative'},categoryIconRing:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'rgba(215,25,63,.24)',backgroundColor:'rgba(255,255,255,.6)',alignItems:'center',justifyContent:'center'},categoryIconDot:{position:'absolute',right:5,bottom:5,width:5,height:5,borderRadius:3,backgroundColor:RED,borderWidth:1,borderColor:'#fff'},categoryArrow:{width:38,height:38,borderRadius:19,backgroundColor:'#171310',alignItems:'center',justifyContent:'center'},categoryTitle:{fontFamily:'serif',fontSize:18,lineHeight:22,fontWeight:'700',marginTop:13},categoryDescription:{fontSize:10.5,lineHeight:15,color:'#756a64',marginTop:3},categoryCount:{fontSize:9,fontWeight:'900',letterSpacing:.55,color:'#91857f',marginTop:9},familyRail:{gap:9},family:{width:156,minHeight:158,borderRadius:19,backgroundColor:'#eee4df',padding:15},familyDark:{backgroundColor:'#351018'},familyOrb:{width:48,height:48,borderRadius:24,backgroundColor:'rgba(255,255,255,.7)',alignItems:'center',justifyContent:'center'},familyOrbDark:{backgroundColor:'rgba(255,255,255,.12)'},familyTitle:{fontFamily:'serif',fontSize:19,lineHeight:23,fontWeight:'700',marginTop:14},familyTitleDark:{color:'#fff'},familyCount:{fontSize:10,color:'#746862',marginTop:3,marginBottom:11},familyCountDark:{color:'rgba(255,255,255,.67)'},brandSearch:{minHeight:48,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#ddd3ce',paddingLeft:14,paddingRight:4,flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},brandInput:{flex:1,minWidth:0,height:46,fontSize:13},brandGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},brandCard:{minHeight:112,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2d9d4',padding:14,justifyContent:'center'},brandName:{fontFamily:'serif',fontSize:16,lineHeight:20,fontWeight:'700'},brandCount:{fontSize:9,fontWeight:'900',letterSpacing:.55,color:'#988b84',marginTop:7,marginBottom:10},noBrands:{fontSize:12,color:'#756a64',paddingVertical:25,textAlign:'center'},collectionGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},collection:{minHeight:170,borderRadius:19,backgroundColor:'#f0e9e5',padding:15},collectionIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#e7f5ed',alignItems:'center',justifyContent:'center'},collectionTitle:{fontFamily:'serif',fontSize:17,lineHeight:21,fontWeight:'700',marginTop:12},collectionText:{fontSize:10.5,lineHeight:15,color:'#726660',marginTop:3},collectionFoot:{marginTop:'auto',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},collectionCount:{fontSize:9,fontWeight:'900',letterSpacing:.55,color:'#847871'},promise:{minHeight:92,borderRadius:19,backgroundColor:'#fff',borderWidth:1,borderColor:'#e1d8d3',padding:16,marginTop:27,flexDirection:'row',alignItems:'center',gap:13},promiseIcon:{width:46,height:46,borderRadius:16,backgroundColor:'#eaf6ee',alignItems:'center',justifyContent:'center'},promiseTitle:{fontFamily:'serif',fontSize:17,fontWeight:'700'},promiseText:{fontSize:10.5,lineHeight:16,color:'#786d67',marginTop:3},empty:{minHeight:220,borderRadius:19,backgroundColor:'#fff',borderWidth:1,borderColor:'#e2d9d4',alignItems:'center',justifyContent:'center',padding:22},emptyTitle:{fontFamily:'serif',fontSize:20,fontWeight:'700',marginTop:9},emptyText:{fontSize:11,lineHeight:17,color:'#786d67',textAlign:'center',marginTop:4},emptyCta:{minHeight:46,borderRadius:23,backgroundColor:'#171310',paddingHorizontal:16,alignItems:'center',justifyContent:'center',marginTop:13},emptyCtaText:{fontSize:9,fontWeight:'900',letterSpacing:.65,color:'#fff'},skeletonCard:{height:166,borderRadius:19,backgroundColor:'#ece6e2',padding:14},skeletonIcon:{width:44,height:44,borderRadius:15,backgroundColor:'#dfd6d1'},skeletonLine:{height:12,borderRadius:6,backgroundColor:'#dfd6d1',width:'82%',marginTop:18},
});
