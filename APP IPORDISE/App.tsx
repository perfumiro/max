import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, BackHandler, Easing, FlatList, Image, KeyboardAvoidingView, Linking, PanResponder, Platform, Pressable, ScrollView as NativeScrollView, Share, StatusBar as RNStatusBar,
  StyleSheet, View, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { colors, radius, shadow, sizes, spacing } from './src/designSystem';
import { useResponsiveLayout } from './src/useResponsiveLayout';
import { displaySize, formatMad, loadBundledProducts, loadSharedProducts, type Product } from './src/sharedCatalog';
import { createProductShareCard, downloadProductShareCard } from './src/sharing/productShareCard';
import { ShoppingProvider, useBagSnapshot, useFavouriteSnapshot, useLastAdded, useShoppingActions } from './src/commerce/ShoppingContext';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { SmoothScrollView as ScrollView } from './src/components/smoothHorizontalScroll';
import { isValidEmail, normalizeEmail, requestMagicLink, subscribeToNewsletter } from './src/services/customerService';
import { logger } from './src/observability/logger';
import { appConfig } from './src/config';
import { createSupportConversation, loadSupportConversation, sendCustomerSupportMessage, type SupportConversation, type SupportSession } from './src/services/supportService';
import { clearSupportSession, readSupportSession, saveSupportSession } from './src/services/supportSessionStorage';
import { BagPage, CheckoutPage, ThankYouPage, WishlistPage } from './src/commerce/CommercePages';
import type { CompletedOrder } from './src/services/orderService';
import { trackOrder, type TrackedOrder } from './src/services/orderTrackingService';
import { loadBestsellerProductIds } from './src/services/bestsellerService';
import { bestsellerNameKey } from './src/services/bestsellerRanking';
import { ResponsiveContainer } from './src/components/ResponsiveContainer';
import { searchProducts } from './src/productSearch';
import { defaultHomeConfig, loadHomeConfig, type HomeCategory, type HomeConfig, type HomeHeroSlide } from './src/home/homeConfig';
import { dailyRotationKey, millisecondsUntilNextRotation, rotateProductsDaily } from './src/home/dailyProductRotation';
import { OffersScreen } from './src/offers/OffersScreen';
import { isEligibleOffer } from './src/offers/offerPricing';
import { formatPromotionCountdown, promotionCountdownParts, promotionRemainingMilliseconds } from './src/offers/promotionLogic';
import { HelpCenter } from './src/help/HelpCenter';
import { popPreviousNavigationEntry, recordNavigationEntry, registerAndroidBackAction, runScopedAndroidBackAction } from './src/navigation/androidBackNavigation';
import { clearProtectedCommercePath, rememberProtectedCommercePath } from './src/navigation/customerCommerceNavigation';
import { parseAppNavigationIntent } from './src/navigation/appNavigationIntent';
import { defaultHelpConfig, loadHelpConfig, type HelpConfig } from './src/help/helpConfig';
import { ShopScreen } from './src/shop/ShopScreen';
import { matchesShopIntent, type ShopBrowseIntent } from './src/shop/shopLogic';
import { asFragranceFamily, matchesFragranceFamily } from './src/fragranceFamilies';
import { CustomerAuthProvider, useCustomerAuth } from './src/account/CustomerAuthContext';
import { CustomerProvider } from './src/account/CustomerContext';
import { CustomerAccountScreen } from './src/account/AccountScreen';
import { AdminEntry } from './src/admin/AdminEntry';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from './src/i18n/LocalizedPrimitives';
import { ProductReviews } from './src/reviews/ProductReviews';
import { rankSimilarProducts } from './src/productRecommendations';
import { PushNotificationProvider, usePushNotifications } from './src/notifications/PushNotificationProvider';

const RED = '#d7193f';
type BrowserSpeechResultEvent={results:ArrayLike<{0?:{transcript?:string};isFinal?:boolean}>};
type BrowserSpeechErrorEvent={error?:string};
type BrowserSpeechRecognition={lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;onstart:null|(()=>void);onresult:null|((event:BrowserSpeechResultEvent)=>void);onerror:null|((event:BrowserSpeechErrorEvent)=>void);onend:null|(()=>void);start:()=>void;stop:()=>void;abort:()=>void};
type BrowserSpeechRecognitionConstructor=new()=>BrowserSpeechRecognition;
const getBrowserSpeechRecognition=()=>{
  if(Platform.OS!=='web')return undefined;
  const browser=globalThis as typeof globalThis&{SpeechRecognition?:BrowserSpeechRecognitionConstructor;webkitSpeechRecognition?:BrowserSpeechRecognitionConstructor};
  return browser.SpeechRecognition||browser.webkitSpeechRecognition;
};
const ACCOUNT_MODES=['signin','create'] as const;
const ACCOUNT_SECURITY_ITEMS=[
  {icon:'lock-closed-outline',title:'Passwordless',text:'Nothing to remember'},
  {icon:'shield-checkmark-outline',title:'Protected',text:'Encrypted access'},
  {icon:'flash-outline',title:'One-time link',text:'Expires securely'},
] as const;
const SUPPORT_TOPICS=[
  {label:'General support',icon:'chatbubble-ellipses-outline'},
  {label:'Order help',icon:'receipt-outline'},
  {label:'Product advice',icon:'sparkles-outline'},
] as const;
const FRAGRANCE_FAMILIES=[
  {label:'Fresh',image:require('./assets/family-photos/fresh-macro-v1.png'),description:'Clean, airy and aquatic',accent:'#28718a',tint:'#eef8fa',border:'#d5e9ee'},
  {label:'Floral',image:require('./assets/family-photos/floral-macro-v1.png'),description:'Petals with elegant depth',accent:'#a63261',tint:'#fff2f6',border:'#efd9e2'},
  {label:'Woody',image:require('./assets/family-photos/woody-macro-v1.png'),description:'Dry woods and green warmth',accent:'#496b4e',tint:'#f0f6f1',border:'#d9e7db'},
  {label:'Amber',image:require('./assets/family-photos/amber-macro-v1.png'),description:'Warm, resinous and enveloping',accent:'#a85724',tint:'#fff3ea',border:'#eedccc'},
  {label:'Citrus',image:require('./assets/family-photos/citrus-macro-v1.png'),description:'Bright zest and sparkling energy',accent:'#a77b00',tint:'#fff9e7',border:'#ece2bd'},
  {label:'Sweet',image:require('./assets/family-photos/sweet-macro-v1.png'),description:'Creamy, gourmand and addictive',accent:'#85506f',tint:'#f9f0f5',border:'#e8d9e2'},
] as const;
async function openAvailabilityWhatsApp(product:Product,size?:string){
  const selectedSize=size?` (${displaySize(size)})`:'';
  const message=`Bonjour IPORDISE, je souhaite connaître la disponibilité de ${product.brand} ${product.name}${selectedSize}. Pouvez-vous m'aider, s'il vous plaît ?`;
  const url=`https://wa.me/${appConfig.availabilityWhatsApp}?text=${encodeURIComponent(message)}`;
  try{await Linking.openURL(url);}catch(error){logger.warn('availability_whatsapp_open_failed',{error,productId:product.id});Alert.alert('WhatsApp unavailable','Please contact IPORDISE at +212 663 750 210.');}
}
const categoryImages:Record<string,ImageSourcePropType> = {
  new:require('./assets/categories/new-arrivals.png'),
  women:require('./assets/categories/women-perfume-portrait-v3.png'),
  'for-women':require('./assets/categories/women-perfume-portrait-v3.png'),
  men:require('./assets/categories/men-perfume-portrait-v3.png'),
  'for-men':require('./assets/categories/men-perfume-portrait-v3.png'),
  unisex:require('./assets/categories/unisex.png'),
};
const collectionFilters = [
  { label:'All perfumes', value:'' }, { label:'Men', value:'for-men' }, { label:'Women', value:'for-women' },
  { label:'Unisex', value:'unisex' }, { label:'Niche', value:'niche' }, { label:'Offers', value:'offers' },
];
const discoveryLinks = [
  { label:'New arrivals', meta:'Meet the fragrances defining now.', kicker:'JUST LANDED', value:'new-in', icon:'sparkles-outline', image:require('./assets/explore/new-arrivals-v2.png'), number:'01' },
  { label:'Most wanted', meta:'Modern icons, chosen again and again.', kicker:'BEST SELLERS', value:'best-sellers', icon:'flame-outline', image:require('./assets/explore/best-sellers-v2.png'), number:'02' },
  { label:'Niche houses', meta:'Rare compositions with unmistakable character.', kicker:'THE CONNOISSEUR EDIT', value:'niche', icon:'diamond-outline', image:require('./assets/explore/niche-houses-v2.png'), number:'03' },
  { label:'Discovery sets', meta:'Explore, wear and find your signature.', kicker:'START YOUR JOURNEY', value:'discovery-sets', icon:'flask-outline', image:require('./assets/explore/discovery-sets-v2.png'), number:'04' },
];
const tabs = [
  { label: 'Home', icon: 'home-outline' }, { label: 'Offers', icon: 'ticket-outline' },
  { label: 'Shop', icon: 'grid-outline' }, { label: 'Help', icon: 'chatbubble-ellipses-outline' },
  { label: 'Account', icon: 'person-outline' },
];
function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return <View style={styles.brandWrap} accessibilityLabel="IPORDISE Beauty Morocco">
    <Svg width={compact?106:128} height={compact?38:45} viewBox="0 0 128 45">
      <SvgText x="64" y="25.5" textAnchor="middle" fill={light ? '#fff' : '#171717'} fontFamily="Times New Roman, serif" fontSize="25.5" fontWeight="700" letterSpacing="-0.45">IPORDISE</SvgText>
      <Path d="M8 30 C30 41.5 57 42.4 85 34.2 C99 30.7 111 32.8 121 36.5" fill="none" stroke="#e4003b" strokeWidth="2.15" strokeLinecap="round" />
    </Svg>
  </View>;
}

function LaunchIntro({onFinish}:{onFinish:()=>void}) {
  const backdrop=useRef(new Animated.Value(1)).current;
  const wordmark=useRef(new Animated.Value(0)).current;
  const signature=useRef(new Animated.Value(0)).current;
  const caption=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    let active=true;
    let animation:Animated.CompositeAnimation|undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduceMotion=>{
      if(!active)return;
      const driver=Platform.OS!=='web';
      if(reduceMotion){
        wordmark.setValue(1);
        signature.setValue(1);
        caption.setValue(1);
        animation=Animated.sequence([
          Animated.delay(100),
          Animated.timing(backdrop,{toValue:0,duration:120,easing:Easing.out(Easing.quad),useNativeDriver:driver}),
        ]);
      }else{
        animation=Animated.sequence([
          Animated.delay(20),
          Animated.parallel([
            Animated.timing(wordmark,{toValue:1,duration:220,easing:Easing.out(Easing.cubic),useNativeDriver:driver}),
            Animated.sequence([
              Animated.delay(80),
              Animated.timing(signature,{toValue:1,duration:180,easing:Easing.out(Easing.cubic),useNativeDriver:driver}),
            ]),
            Animated.sequence([
              Animated.delay(140),
              Animated.timing(caption,{toValue:1,duration:160,easing:Easing.out(Easing.quad),useNativeDriver:driver}),
            ]),
          ]),
          Animated.delay(80),
          Animated.timing(backdrop,{toValue:0,duration:140,easing:Easing.inOut(Easing.cubic),useNativeDriver:driver}),
        ]);
      }
      animation.start(({finished})=>{if(finished&&active)onFinish();});
    });
    return()=>{active=false;animation?.stop();};
  },[backdrop,caption,onFinish,signature,wordmark]);
  return <Animated.View accessibilityRole="none" accessibilityLabel="IPORDISE is opening" style={[styles.launchIntro,{opacity:backdrop}]}>
    <LinearGradient colors={['#030303','#080506','#030303']} locations={[0,.54,1]} style={StyleSheet.absoluteFill}/>
    <View style={styles.launchAmbientGlow}/>
    <Animated.View style={[styles.launchIdentity,{opacity:wordmark,transform:[{translateY:wordmark.interpolate({inputRange:[0,1],outputRange:[10,0]})},{scale:wordmark.interpolate({inputRange:[0,1],outputRange:[.965,1]})}]}]}>
      <Animated.Image accessibilityLabel="IPORDISE" source={require('./assets/ipordise-app-icon-v2.png')} resizeMode="contain" style={[styles.launchLogo,{opacity:signature,transform:[{scale:signature.interpolate({inputRange:[0,1],outputRange:[.96,1]})}]}]}/>
      <Animated.Text style={[styles.launchCaption,{opacity:caption,transform:[{translateY:caption.interpolate({inputRange:[0,1],outputRange:[5,0]})}]}]}>PARFUMERIE · MAROC</Animated.Text>
    </Animated.View>
  </Animated.View>;
}

function LocationScreen({ onContinue }: { onContinue: () => void }) {
  const layout = useResponsiveLayout();
  const heroScale = useRef(new Animated.Value(1.08)).current;
  const brandEntrance = useRef(new Animated.Value(0)).current;
  const copyEntrance = useRef(new Animated.Value(0)).current;
  const cardEntrance = useRef(new Animated.Value(0)).current;
  const arrowPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(heroScale,{toValue:1,duration:1800,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'}),
      Animated.sequence([Animated.delay(120),Animated.timing(brandEntrance,{toValue:1,duration:700,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'})]),
      Animated.sequence([Animated.delay(350),Animated.timing(copyEntrance,{toValue:1,duration:700,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'})]),
      Animated.sequence([Animated.delay(570),Animated.spring(cardEntrance,{toValue:1,tension:48,friction:8,useNativeDriver:Platform.OS!=='web'})]),
    ]);
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(arrowPulse,{toValue:1,duration:1100,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web'}),
      Animated.timing(arrowPulse,{toValue:0,duration:1100,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web'}),
    ]));
    entrance.start(({finished}) => { if(finished) pulse.start(); });
    return () => { entrance.stop(); pulse.stop(); };
  }, [arrowPulse, brandEntrance, cardEntrance, copyEntrance, heroScale]);
  return (
    <View style={styles.locationBg}>
      <Animated.Image source={require('./assets/onboarding-hero.png')} style={[styles.heroImage,{transform:[{scale:heroScale}]}]} resizeMode="cover" resizeMethod="resize" fadeDuration={0} />
      <StatusBar style="light" />
      <LinearGradient colors={['rgba(0,0,0,.04)', 'rgba(0,0,0,.22)', 'rgba(0,0,0,.98)']} locations={[0,.38,1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={[styles.locationSafe, { width: Math.min(layout.contentWidth, sizes.form) }]} edges={['top', 'bottom']}>
        <Animated.View style={[styles.locationBrand,layout.landscape&&styles.locationBrandLandscape,{opacity:brandEntrance,transform:[{translateY:brandEntrance.interpolate({inputRange:[0,1],outputRange:[-12,0]})}]}]}><Brand light /><Text style={styles.locationBrandCaption}>MOROCCO</Text></Animated.View>
        <View style={[styles.locationControls,layout.landscape&&styles.locationControlsLandscape]}>
          <Animated.View style={{opacity:copyEntrance,transform:[{translateY:copyEntrance.interpolate({inputRange:[0,1],outputRange:[18,0]})}]}}><View style={styles.locationEyebrowRow}><View style={styles.locationEyebrowLine}/><Text style={styles.locationEyebrow}>CURATED BEAUTY · MADE FOR MOROCCO</Text></View><Text style={[styles.locationQuestion,layout.compact&&{fontSize:30,lineHeight:35},layout.shortLandscape&&{fontSize:27,lineHeight:31}]}>Find your signature.</Text><Text style={[styles.locationIntro,layout.shortLandscape&&{marginBottom:9}]}>Authentic fragrances, selected with care and delivered across the Kingdom.</Text></Animated.View>
          <Animated.View style={[styles.countryCard,layout.shortLandscape&&{minHeight:82},{opacity:cardEntrance,transform:[{translateY:cardEntrance.interpolate({inputRange:[0,1],outputRange:[25,0]})},{scale:cardEntrance.interpolate({inputRange:[0,1],outputRange:[.97,1]})}]}]}>
            <View style={styles.countryAccent}/><View style={styles.moroccoFlag}><Text style={styles.flagStarText}>☆</Text></View>
            <View style={styles.marketCopy}><Text style={styles.marketLabel}>SHOP THE MOROCCO STORE</Text><Text style={styles.countryText}>Morocco</Text><View style={styles.marketDetails}><Ionicons name="location-outline" size={11} color="#8c8179"/><Text style={styles.marketMeta}>MAD · Delivery nationwide</Text></View></View>
            <View style={styles.countryDivider}/><Animated.View style={{transform:[{scale:arrowPulse.interpolate({inputRange:[0,1],outputRange:[1,1.07]})}]}}><Pressable accessibilityLabel="Continue to the IPORDISE store" accessibilityRole="button" onPress={onContinue} style={({pressed})=>[styles.arrowButton,pressed&&styles.arrowButtonPressed]}><Ionicons name="arrow-forward" size={25} color="#fff"/></Pressable></Animated.View>
          </Animated.View>
          <Animated.View style={[styles.locationTrust,{opacity:cardEntrance}]}><Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,.72)"/><Text style={styles.locationTrustText}>Authentic products · Secure shopping</Text></Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Header({ query, setQuery, mobile,onHome,onOpenWishlist,onOpenBag }: { query: string; setQuery: (v: string) => void; mobile: boolean;onHome:()=>void;onOpenWishlist:()=>void;onOpenBag:()=>void }) {
  const {language}=useLanguage();
  const {bagCount}=useBagSnapshot();
  const {favouriteIds}=useFavouriteSnapshot();
  const [searchFocused,setSearchFocused]=useState(false);
  const [listening,setListening]=useState(false);
  const recognitionRef=useRef<BrowserSpeechRecognition|null>(null);
  useEffect(()=>()=>recognitionRef.current?.abort(),[]);
  const toggleVoiceSearch=useCallback(()=>{
    if(listening){recognitionRef.current?.stop();return;}
    const Recognition=getBrowserSpeechRecognition();
    if(!Recognition){Alert.alert('Voice search unavailable','Voice search is supported in Chrome, Edge, and compatible browsers. You can still type a perfume, brand, note, or collection.');return;}
    const recognition=new Recognition();
    recognition.lang=language==='fr'?'fr-FR':language==='ar'?'ar-MA':'en-US';
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=3;
    recognition.onstart=()=>{recognitionRef.current=recognition;setListening(true);setSearchFocused(true);};
    recognition.onresult=(event)=>{
      const transcript=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').replace(/\s+/g,' ').trim();
      if(transcript)setQuery(transcript);
    };
    recognition.onerror=(event)=>{if(event.error&&event.error!=='aborted'&&event.error!=='no-speech')Alert.alert('Voice search','Microphone access was unavailable. Check the browser microphone permission and try again.');};
    recognition.onend=()=>{recognitionRef.current=null;setListening(false);setSearchFocused(false);};
    try{recognition.start();}catch{setListening(false);Alert.alert('Voice search','The microphone could not start. Please try again.');}
  },[language,listening,setQuery]);
  const searchActive=query.trim().length>0;
  const search = <View style={[styles.search,mobile&&styles.searchMobile,!mobile&&searchActive&&styles.searchActiveDesktop,searchFocused&&styles.searchFocused,listening&&styles.searchListening]}><View style={[styles.searchIconWrap,mobile&&styles.searchIconMobile,!mobile&&searchActive&&styles.searchIconActiveDesktop,searchFocused&&styles.searchIconFocused]}><Feather name="search" size={mobile?18:19} color={searchFocused||searchActive?RED:'#5f5550'} /></View><TextInput accessibilityLabel="Search the IPORDISE fragrance catalogue" accessibilityHint="Search by perfume, brand, note, collection, or voice" value={query} onChangeText={setQuery} onFocus={()=>setSearchFocused(true)} onBlur={()=>!listening&&setSearchFocused(false)} placeholder="Search perfumes, brands or collections" placeholderTextColor="#8b807a" selectionColor={RED} cursorColor={RED} style={[styles.searchInput,mobile&&styles.searchInputMobile,!mobile&&searchActive&&styles.searchInputActiveDesktop,Platform.OS==='web'&&styles.searchInputWeb]} returnKeyType="search" autoComplete="off" autoCapitalize="none" autoCorrect={false} clearButtonMode="never" /><Pressable accessibilityRole="button" accessibilityLabel={listening?'Stop voice search':'Search with microphone'} accessibilityHint="Speak a perfume, brand, note, or collection" accessibilityState={{busy:listening}} hitSlop={6} onPress={toggleVoiceSearch} style={({pressed})=>[styles.searchMic,mobile&&styles.searchMicMobile,listening&&styles.searchMicListening,pressed&&styles.searchMicPressed]}><Ionicons name={listening?'stop':'mic-outline'} size={mobile?18:20} color={listening?'#fff':RED}/>{listening?<View style={styles.searchMicPulse}/>:null}</Pressable>{query.length>0?<Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={()=>setQuery('')} style={[styles.searchClear,!mobile&&styles.searchClearActiveDesktop]}><Ionicons name="close" size={mobile?14:22} color="#655c57"/></Pressable>:!mobile?<View style={styles.searchHint}><Text style={styles.searchHintText}>SCENT FINDER</Text></View>:null}</View>;
  const actions = <View style={[styles.headerActions,mobile&&styles.headerActionsMobile]}><Pressable accessibilityRole="button" accessibilityLabel={`Favourites, ${favouriteIds.size} saved`} hitSlop={8} style={({pressed})=>[styles.headerAction,mobile&&styles.headerActionMobile,pressed&&styles.headerActionPressed]} onPress={onOpenWishlist}><Ionicons name={favouriteIds.size?'heart':'heart-outline'} size={mobile?21:26} color={favouriteIds.size?RED:'#171412'} />{favouriteIds.size>0&&<View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{Math.min(favouriteIds.size,99)}</Text></View>}</Pressable>{mobile?<View style={styles.headerActionDivider}/>:null}<Pressable accessibilityRole="button" accessibilityLabel={`Shopping bag, ${bagCount} items`} hitSlop={8} style={({pressed})=>[styles.headerAction,mobile&&styles.headerActionMobile,mobile&&styles.headerBagMobile,pressed&&styles.headerActionPressed]} onPress={onOpenBag}><Ionicons name={bagCount?'bag-handle':'bag-outline'} size={mobile?20:26} color="#171412" />{bagCount>0&&<View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{Math.min(bagCount,99)}</Text></View>}</Pressable></View>;
  const homeLogo=<Pressable accessibilityRole="button" accessibilityLabel="IPORDISE, return to Accueil" accessibilityHint="Closes the current view and opens the home page" hitSlop={6} onPress={onHome} style={({pressed})=>[styles.headerLogoButton,pressed&&styles.headerLogoButtonPressed]}><Brand compact={mobile}/></Pressable>;
  return <View style={[styles.header,mobile&&styles.headerMobile]}><View style={[styles.headerInner,mobile&&styles.headerInnerMobile]}>{mobile ? <><View style={styles.headerTopMobile}>{homeLogo}{actions}</View><View style={styles.searchMobileRow}>{search}</View></> : <>{homeLogo}{search}{actions}</>}</View></View>;
}

function DiscoveryBrandMark() {
  return <View style={styles.discoveryBrandMark} accessibilityLabel="IPORDISE Morocco"><Svg width={82} height={27} viewBox="0 0 82 27"><SvgText x="41" y="15" textAnchor="middle" fill="#fff" fontFamily="Times New Roman, serif" fontSize="14.5" fontWeight="700" letterSpacing="-.15">IPORDISE</SvgText><Path d="M8 18 C23 24 39 23.5 54 20 C63 18 70 19 75 21" fill="none" stroke="#ff315d" strokeWidth="1.35" strokeLinecap="round"/></Svg><Text style={styles.discoveryBrandCountry}>MOROCCO</Text></View>;
}

function PriveMark() {
  return <Svg width={27} height={27} viewBox="0 0 27 27"><Path d="M13.5 2.5 23 8.8l-9.5 15.7L4 8.8Z" fill="none" stroke="#fff" strokeWidth="1.35" strokeLinejoin="round"/><Path d="M4 8.8h19M8.4 8.8l5.1 15.7 5.1-15.7M9 8.8l4.5-6.3L18 8.8" fill="none" stroke="rgba(255,255,255,.78)" strokeWidth=".9" strokeLinejoin="round"/><SvgText x="13.5" y="15.3" textAnchor="middle" fill="#fff" fontFamily="Times New Roman, serif" fontSize="7.5" fontWeight="700">I</SvgText></Svg>;
}

const fragranceHouses=[
  {name:'CHANEL',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/chanel.png')},
  {name:'DIOR',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/dior.png')},
  {name:'VALENTINO',origin:'ROME · ITALY',logo:require('./assets/brand-logos/valentino.png')},
  {name:'XERJOFF',origin:'TURIN · ITALY',logo:require('./assets/brand-logos/xerjoff.png')},
  {name:'ARMANI',origin:'MILAN · ITALY',logo:require('./assets/brand-logos/armani.png')},
  {name:'YVES SAINT LAURENT',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/ysl.png')},
  {name:'GUERLAIN',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/guerlain.jpg')},
  {name:'TOM FORD',origin:'NEW YORK · USA',logo:require('./assets/brand-logos/tom-ford.png')},
  {name:'GIVENCHY',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/givenchy.png')},
  {name:'VERSACE',origin:'MILAN · ITALY',logo:require('./assets/brand-logos/versace.png')},
  {name:'JEAN PAUL GAULTIER',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/jean-paul-gaultier.png')},
  {name:'MAISON FRANCIS KURKDJIAN',origin:'PARIS · FRANCE',logo:require('./assets/brand-logos/maison-francis-kurkdjian.png')},
] as const;

function BrandHouseCard({brand,origin,logo,index,width,reveal,onPress}:{brand:string;origin:string;logo:ImageSourcePropType;index:number;width:number;reveal:Animated.Value;onPress:()=>void}) {
  const interaction=useRef(new Animated.Value(0)).current;
  const animateInteraction=(toValue:number)=>Animated.spring(interaction,{toValue,tension:240,friction:17,useNativeDriver:Platform.OS!=='web'}).start();
  const featured=index===0;
  return <Animated.View style={{opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[22,0]})},{scale:interaction.interpolate({inputRange:[0,1],outputRange:[1,.975]})}]}}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${brand} fragrances`} accessibilityHint="Opens products from this fragrance house" onPress={onPress} onPressIn={()=>animateInteraction(1)} onPressOut={()=>animateInteraction(0)} style={[styles.accueilBrandCard,{width},featured&&styles.accueilBrandCardFeatured]}>
      <LinearGradient pointerEvents="none" colors={featured?['rgba(215,25,63,.22)','rgba(255,255,255,0)']:['rgba(255,255,255,.95)','rgba(243,237,233,.7)']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
      <View style={styles.accueilBrandCardTop}><Text style={[styles.accueilBrandIndex,featured&&styles.accueilBrandTextLight]}>{String(index+1).padStart(2,'0')}</Text><View style={[styles.accueilBrandDot,featured&&styles.accueilBrandDotFeatured]}/></View>
      <View style={styles.accueilBrandIdentity}><View style={styles.accueilBrandLogoPlate}><Image source={logo} resizeMode="contain" style={styles.accueilBrandLogo}/></View><View style={styles.accueilBrandIdentityCopy}><Text numberOfLines={2} adjustsFontSizeToFit style={[styles.accueilBrandName,index===1&&styles.accueilBrandSerif,featured&&styles.accueilBrandTextLight]}>{brand}</Text><Text style={[styles.accueilBrandOrigin,featured&&styles.accueilBrandExploreLight]}>{origin}</Text></View></View>
      <View style={styles.accueilBrandCardBottom}><Text style={[styles.accueilBrandExplore,featured&&styles.accueilBrandExploreLight]}>Explore</Text><Animated.View style={[styles.accueilBrandArrow,featured&&styles.accueilBrandArrowFeatured,{transform:[{translateX:interaction.interpolate({inputRange:[0,1],outputRange:[0,3]})},{translateY:interaction.interpolate({inputRange:[0,1],outputRange:[0,-3]})}]}]}><Ionicons name="arrow-forward" size={15} color={featured?'#171310':'#fff'}/></Animated.View></View>
    </Pressable>
  </Animated.View>;
}

function AccueilShowcase({onShop,onBrand}:{onShop:()=>void;onBrand:(brand:string)=>void}) {
  const layout=useResponsiveLayout();
  const entrance=useRef(new Animated.Value(0)).current;
  const ambient=useRef(new Animated.Value(0)).current;
  const brandReveals=useRef(Array.from({length:fragranceHouses.length},()=>new Animated.Value(0))).current;
  const brandScrollRef=useRef<NativeScrollView>(null);
  const [brandIndex,setBrandIndex]=useState(0);
  useEffect(()=>{
    const reveal=Animated.timing(entrance,{toValue:1,duration:850,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'});
    const revealBrands=Animated.sequence([Animated.delay(380),Animated.stagger(90,brandReveals.map(value=>Animated.spring(value,{toValue:1,tension:55,friction:9,useNativeDriver:Platform.OS!=='web'})))]);
    const drift=Animated.loop(Animated.sequence([
      Animated.timing(ambient,{toValue:1,duration:6500,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web'}),
      Animated.timing(ambient,{toValue:0,duration:6500,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web'}),
    ]));
    Animated.parallel([reveal,revealBrands]).start(({finished})=>{if(finished)drift.start();});
    return()=>{reveal.stop();revealBrands.stop();drift.stop();};
  },[ambient,brandReveals,entrance]);
  const brandCardWidth=layout.compact?160:layout.tablet?220:Math.max(164,Math.min(210,(layout.contentWidth-46)/2));
  const brandSnap=brandCardWidth+10;
  return <View style={styles.accueilShowcase}>
    <Animated.View style={[styles.accueilHero,{height:layout.compact?290:layout.tablet?420:330},{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[18,0]})}]}]}>
      <Animated.Image source={require('./assets/explore/new-arrivals-v2.png')} resizeMode="cover" resizeMethod="resize" fadeDuration={0} style={[styles.accueilHeroImage,{transform:[{scale:ambient.interpolate({inputRange:[0,1],outputRange:[1.02,1.075]})},{translateX:ambient.interpolate({inputRange:[0,1],outputRange:[0,-5]})}]}]}/>
      <LinearGradient colors={['rgba(5,5,5,.08)','rgba(5,5,5,.18)','rgba(5,5,5,.92)']} locations={[0,.42,1]} style={StyleSheet.absoluteFill}/>
      <View style={styles.accueilHeroTop}><View style={styles.accueilLiveDot}/><Text style={styles.accueilHeroTopText}>THE NEW IPORDISE EDIT</Text><Text style={styles.accueilHeroNumber}>01 / 04</Text></View>
      <Animated.View style={[styles.accueilHeroCopy,{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[14,0]})}]}]}><Text style={styles.accueilHeroEyebrow}>JUST LANDED · MOROCCO</Text><Text style={styles.accueilHeroTitle}>Find your next{`\n`}signature.</Text><Text style={styles.accueilHeroText}>Authentic fragrances, selected with care and delivered nationwide.</Text><Pressable accessibilityRole="button" accessibilityLabel="Shop new fragrances" onPress={onShop} style={({pressed})=>[styles.accueilHeroCta,pressed&&styles.pressed]}><Text style={styles.accueilHeroCtaText}>SHOP NEW ARRIVALS</Text><Ionicons name="arrow-forward" size={15} color="#111"/></Pressable></Animated.View>
    </Animated.View>
    <Animated.View style={[styles.accueilEditorial,layout.compact&&{height:155},{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[28,0]})}]}]}>
      <Image source={require('./assets/summer-glow-campaign-v1.png')} resizeMode="cover" resizeMethod="resize" fadeDuration={0} style={styles.accueilEditorialImage}/><LinearGradient colors={['rgba(245,226,201,.98)','rgba(246,226,200,.88)','rgba(246,226,200,.1)']} locations={[0,.55,1]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={StyleSheet.absoluteFill}/>
      <View style={styles.accueilEditorialCopy}><Text style={styles.accueilEditorialEyebrow}>CURATED FOR THE SEASON</Text><Text style={styles.accueilEditorialTitle}>Summer, bottled.</Text><Text style={styles.accueilEditorialText}>Fresh signatures with lasting character.</Text><Pressable accessibilityRole="button" onPress={onShop} style={styles.accueilEditorialLink}><Text style={styles.accueilEditorialLinkText}>DISCOVER THE EDIT</Text><Ionicons name="arrow-forward" size={13} color="#111"/></Pressable></View>
    </Animated.View>
    <Animated.View style={[styles.accueilBrands,{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[18,0]})}]}]}>
      <View style={styles.accueilBrandsHead}><View style={styles.accueilBrandsHeadingCopy}><Text style={styles.accueilBrandsEyebrow}>THE HOUSES WE LOVE</Text><Text style={styles.accueilBrandsTitle}>Icons of perfumery.</Text><Text style={styles.accueilBrandsSubtitle}>Explore twelve legendary houses, each with a signature of its own.</Text></View><Text style={styles.accueilBrandsCountLabel}>12 HOUSES</Text></View>
      <View style={styles.accueilBrandViewport}><ScrollView ref={brandScrollRef} horizontal nestedScrollEnabled directionalLockEnabled alwaysBounceHorizontal bounces disableIntervalMomentum showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={brandSnap} snapToAlignment="start" scrollEventThrottle={16} onMomentumScrollEnd={({nativeEvent})=>setBrandIndex(Math.max(0,Math.min(fragranceHouses.length-1,Math.round(nativeEvent.contentOffset.x/brandSnap))))} contentContainerStyle={styles.accueilBrandRow}>{fragranceHouses.map((house,index)=><BrandHouseCard brand={house.name} origin={house.origin} logo={house.logo} index={index} width={brandCardWidth} reveal={brandReveals[index]} key={house.name} onPress={()=>onBrand(house.name)}/>)}</ScrollView><LinearGradient pointerEvents="none" colors={['rgba(241,236,232,0)','rgba(241,236,232,.96)']} start={{x:0,y:.5}} end={{x:1,y:.5}} style={styles.accueilBrandsEdgeFade}/></View>
      <View style={styles.accueilBrandsFooter}><View style={styles.accueilBrandsDots}>{fragranceHouses.map((house,index)=><Pressable accessibilityRole="button" accessibilityLabel={`Show ${house.name}`} key={house.name} onPress={()=>{setBrandIndex(index);brandScrollRef.current?.scrollTo({x:index*brandSnap,animated:true});}} style={[styles.accueilBrandsDot,index===brandIndex&&styles.accueilBrandsDotActive]}/>)}</View><Text style={styles.accueilBrandsHint}>{String(brandIndex+1).padStart(2,'0')} — {String(fragranceHouses.length).padStart(2,'0')}</Text><View style={styles.accueilBrandsSwipe}><Text style={styles.accueilBrandsSwipeText}>Swipe</Text><Ionicons name="arrow-forward" size={13} color="#786c65"/></View></View>
    </Animated.View>
  </View>;
}

type HomeFeedSection='benefits'|'categories'|'hero'|'offers'|'bestsellers'|'xerjoff'|'unique'|'products'|'seasonal'|'families'|'new'|'brands'|'trust';

function HomeBenefitStrip({messages=defaultHomeConfig.announcements}:{messages?:string[]}) {
  const icons=['shield-checkmark-outline','car-outline','cash-outline','sparkles-outline'];
  const sourceMessages=messages.length?messages:defaultHomeConfig.announcements;
  const benefits=sourceMessages.map((text,index)=>({text,icon:icons[index%icons.length]}));
  const [index,setIndex]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>setIndex(value=>(value+1)%benefits.length),3600);return()=>clearInterval(timer);},[benefits.length]);
  const benefit=benefits[index];
  return <View accessible accessibilityLiveRegion="polite" accessibilityLabel={benefit.text} style={homeStyles.benefitStrip}><View style={homeStyles.benefitIcon}><Ionicons name={benefit.icon as any} size={17} color="#176b43"/></View><Text maxFontSizeMultiplier={1.5} style={homeStyles.benefitText}>{benefit.text}</Text><View style={homeStyles.benefitDots}>{benefits.map((item,itemIndex)=><View key={item.text} style={[homeStyles.benefitDot,itemIndex===index&&homeStyles.benefitDotActive]}/>)}</View></View>;
}

function HomeCategories({products,activeFilter,onSelect,categories=defaultHomeConfig.categories}:{products:Product[];activeFilter:string;onSelect:(filter:string)=>void;categories?:HomeCategory[]}) {
  const countFor=(filter:string)=>products.filter(product=>filter==='miniatures'?Object.keys(product.sizes).some(size=>parseFloat(size)<=10):product.filters.some(item=>item.toLowerCase()===filter)).length;
  return <View style={homeStyles.section}><View style={homeStyles.compactSectionHead}><View><Text style={homeStyles.sectionEyebrow}>SHOP YOUR WAY</Text><Text style={homeStyles.sectionTitle}>Explore categories</Text></View><Text style={homeStyles.sectionMeta}>SWIPE</Text></View><ScrollView horizontal nestedScrollEnabled directionalLockEnabled disableIntervalMomentum decelerationRate="fast" snapToInterval={141} snapToAlignment="start" scrollEventThrottle={16} overScrollMode="never" showsHorizontalScrollIndicator={false} contentContainerStyle={homeStyles.categoryRail}>{categories.map(item=>{const count=countFor(item.filter);const selected=activeFilter===item.filter;const image=categoryImages[item.id]||categoryImages[item.filter];return <Pressable accessibilityRole="button" accessibilityLabel={`${item.label}${count?`, ${count} fragrances`:''}`} accessibilityState={{selected}} key={item.id} onPress={()=>onSelect(item.filter)} style={({pressed})=>[homeStyles.categoryCard,selected&&homeStyles.categoryCardActive,pressed&&homeStyles.pressed]}>{image?<View style={homeStyles.categoryImageWrap}><Image source={image} resizeMode="cover" style={homeStyles.categoryImage}/><LinearGradient colors={['transparent','rgba(39,18,20,.08)']} style={StyleSheet.absoluteFill}/></View>:<View style={[homeStyles.categoryIcon,selected&&homeStyles.categoryIconActive]}><Ionicons name={item.icon as any} size={21} color={selected?'#fff':'#6b1f31'}/></View>}<View><Text numberOfLines={1} style={[homeStyles.categoryLabel,selected&&homeStyles.categoryLabelActive]}>{item.label}</Text><Text style={[homeStyles.categoryCount,selected&&homeStyles.categoryCountActive]}>{count?`${count} scents`:'Explore edit'}</Text></View></Pressable>})}</ScrollView></View>;
}

function HomeHeroCarousel({layout,onSelect,configuredSlides=defaultHomeConfig.heroSlides}:{layout:ReturnType<typeof useResponsiveLayout>;onSelect:(filter:string)=>void;configuredSlides?:HomeHeroSlide[]}) {
  const {rtl}=useLanguage();
  const [index,setIndex]=useState(0);
  const [interacting,setInteracting]=useState(false);
  const ref=useRef<NativeScrollView>(null);
  const width=Math.min(layout.contentWidth,layout.tablet?880:560);
  const snap=width+10;
  const fallbackImages:Record<string,ImageSourcePropType>={'new-in':discoveryLinks[0].image,'best-sellers':discoveryLinks[1].image,niche:require('./assets/home/ipordise-connoisseur-couple-hero-v1.png'),'discovery-sets':discoveryLinks[3].image};
  const slides=configuredSlides.length?configuredSlides:defaultHomeConfig.heroSlides;
  useEffect(()=>{if(interacting)return;const timer=setInterval(()=>{setIndex(current=>{const next=(current+1)%slides.length;ref.current?.scrollTo({x:next*snap,animated:true});return next;});},6000);return()=>clearInterval(timer);},[interacting,slides.length,snap]);
  return <View style={homeStyles.heroSection}><ScrollView ref={ref} horizontal disableIntervalMomentum showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={snap} snapToAlignment="start" onScrollBeginDrag={()=>setInteracting(true)} onMomentumScrollEnd={({nativeEvent})=>{setIndex(Math.max(0,Math.min(slides.length-1,Math.round(nativeEvent.contentOffset.x/snap))));setInteracting(false);}} contentContainerStyle={homeStyles.heroRail}>{slides.map((slide,slideIndex)=>{const remoteImage=layout.tablet&&slide.tabletImageUrl?slide.tabletImageUrl:slide.imageUrl;const image=remoteImage?{uri:remoteImage}:fallbackImages[slide.destination]||discoveryLinks[0].image;return <Pressable accessibilityRole="button" accessibilityLabel={`${slide.headline} ${slide.ctaLabel}`} key={slide.id} onPress={()=>onSelect(slide.destination)} style={({pressed})=>[homeStyles.heroCard,{width,height:layout.tablet?390:layout.compact?310:340},pressed&&homeStyles.pressed]}><Image accessibilityIgnoresInvertColors source={image} resizeMode="cover" style={homeStyles.heroImage}/><LinearGradient pointerEvents="none" colors={['rgba(5,4,4,.05)','rgba(7,5,5,.28)','rgba(7,5,5,.94)']} locations={[0,.42,1]} style={StyleSheet.absoluteFill}/><View style={homeStyles.heroTop}><View style={homeStyles.heroLive}><View style={homeStyles.heroLiveDot}/><Text style={homeStyles.heroLiveText}>THE IPORDISE EDIT</Text></View><Text style={homeStyles.heroCounter}>{String(slideIndex+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</Text></View><View style={homeStyles.heroCopy}><Text style={[homeStyles.heroEyebrow,rtl&&homeStyles.rtlCopy]}>{slide.eyebrow}</Text><Text maxFontSizeMultiplier={1.3} style={[homeStyles.heroTitle,rtl&&homeStyles.rtlHeading]}>{slide.headline}</Text><Text maxFontSizeMultiplier={1.4} style={[homeStyles.heroDescription,rtl&&homeStyles.rtlCopy]}>{slide.description}</Text><View style={homeStyles.heroCta}><Text style={[homeStyles.heroCtaText,rtl&&homeStyles.rtlCopy]}>{slide.ctaLabel}</Text><Ionicons name={rtl?'arrow-back':'arrow-forward'} size={16} color="#171310"/></View></View></Pressable>})}</ScrollView><View style={homeStyles.heroDots}>{slides.map((slide,itemIndex)=><Pressable accessibilityRole="button" accessibilityLabel={`Show campaign ${itemIndex+1}`} key={slide.id} onPress={()=>{setIndex(itemIndex);ref.current?.scrollTo({x:itemIndex*snap,animated:true});}} style={[homeStyles.heroDot,itemIndex===index&&homeStyles.heroDotActive]}/>)}</View></View>;
}

function HomeProductRail({eyebrow,title,subtitle,products,layout,onOpen,onViewAll,tone='default'}:{eyebrow:string;title:string;subtitle:string;products:Product[];layout:ReturnType<typeof useResponsiveLayout>;onOpen:(product:Product)=>void;onViewAll:()=>void;tone?:'default'|'xerjoff'|'unique'}) {
  const {rtl}=useLanguage();
  if(!products.length)return null;
  const dark=tone==='xerjoff';
  const premium=tone!=='default';
  const cardWidth=premium?(layout.tablet?276:layout.compact?224:238):(layout.tablet?230:layout.compact?174:194);
  return <View style={[homeStyles.productSection,tone!=='default'&&homeStyles.houseProductSection,dark?homeStyles.xerjoffProductSection:tone==='unique'&&homeStyles.uniqueProductSection]}>{dark?<View style={homeStyles.houseEdition}><View style={homeStyles.houseEditionLine}/><Text style={homeStyles.houseEditionText}>XERJOFF · ITALIA</Text></View>:null}<View style={homeStyles.sectionHead}><View style={homeStyles.sectionHeadingCopy}><Text style={[homeStyles.sectionEyebrow,dark&&homeStyles.houseEyebrowDark,rtl&&homeStyles.rtlCopy]}>{eyebrow}</Text><Text maxFontSizeMultiplier={1.35} style={[homeStyles.sectionTitle,dark&&homeStyles.houseTitleDark,rtl&&homeStyles.rtlHeading]}>{title}</Text><Text style={[homeStyles.sectionSubtitle,dark&&homeStyles.houseSubtitleDark,rtl&&homeStyles.rtlCopy]}>{subtitle}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`View all ${title}`} onPress={onViewAll} style={({pressed})=>[homeStyles.viewAll,tone!=='default'&&homeStyles.houseViewAll,dark&&homeStyles.houseViewAllDark,pressed&&homeStyles.pressed]}><Text style={[homeStyles.viewAllText,dark&&homeStyles.houseViewAllTextDark,rtl&&homeStyles.rtlCopy]}>View all</Text><Ionicons name={rtl?'arrow-back':'arrow-forward'} size={14} color={dark?'#5b3d20':'#171310'}/></Pressable></View><ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={[homeStyles.productRail,premium&&homeStyles.houseProductRail]}>{products.map(product=><CatalogCard key={product.id} product={product} tablet={layout.tablet} cardWidth={cardWidth} premiumRail={premium} onOpen={()=>onOpen(product)}/>)}</ScrollView>{dark?<View style={homeStyles.houseRailFooter}><Text style={homeStyles.houseRailFooterText}>SWIPE TO EXPLORE</Text><View style={homeStyles.houseRailProgress}><View style={homeStyles.houseRailProgressActive}/><View style={homeStyles.houseRailProgressDot}/><View style={homeStyles.houseRailProgressDot}/></View></View>:null}</View>;
}

const PromotionCountdown=memo(function PromotionCountdown({endsAt}:{endsAt:number}) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1_000);return()=>clearInterval(timer);},[]);
  const remaining=promotionRemainingMilliseconds(new Date(endsAt).toISOString(),now);
  const countdown=promotionCountdownParts(remaining);
  const timerLabel=formatPromotionCountdown(remaining);
  return <View accessible accessibilityRole="timer" accessibilityLabel={`Promotion ends in ${timerLabel}`} style={homeStyles.promotionTimer}>
    <Text style={homeStyles.promotionTimerLabel}>ENDS IN</Text>
    <View style={homeStyles.promotionTimerUnits}>{([['HRS',countdown.hours],['MIN',countdown.minutes],['SEC',countdown.seconds]] as const).map(([label,value],index)=><React.Fragment key={label}>{index?<Text style={homeStyles.promotionTimerColon}>:</Text>:null}<View style={homeStyles.promotionTimerUnit}><Text style={homeStyles.promotionTimerValue}>{String(value).padStart(2,'0')}</Text><Text style={homeStyles.promotionTimerUnitLabel}>{label}</Text></View></React.Fragment>)}</View>
  </View>;
});

function HomePromotionSection({products,layout,onOpen,onViewAll}:{products:Product[];layout:ReturnType<typeof useResponsiveLayout>;onOpen:(product:Product)=>void;onViewAll:()=>void}) {
  const [boundaryNow,setBoundaryNow]=useState(()=>Date.now());
  const active=useMemo(()=>products.filter(product=>isEligibleOffer(product,boundaryNow)).sort((a,b)=>Number(Boolean(b.offerFeatured))-Number(Boolean(a.offerFeatured))||(a.sortOrder??100)-(b.sortOrder??100)),[boundaryNow,products]);
  const endingTimes=active.map(product=>product.offerEnd?Date.parse(product.offerEnd):Number.NaN).filter(Number.isFinite);
  const nextEnd=endingTimes.length?Math.min(...endingTimes):Number.NaN;
  useEffect(()=>{
    setBoundaryNow(Date.now());
    if(!Number.isFinite(nextEnd))return;
    const timer=setTimeout(()=>setBoundaryNow(Date.now()),Math.max(250,nextEnd-Date.now()+250));
    return()=>clearTimeout(timer);
  },[nextEnd,products]);
  if(!active.length)return null;
  const cardWidth=layout.tablet?230:layout.compact?174:194;
  return <View style={homeStyles.promotionSection}>
    <LinearGradient colors={['#351019','#170d10','#090707']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <View style={homeStyles.promotionGlow}/>
    <View style={homeStyles.promotionHeader}>
      <View style={homeStyles.promotionHeadingCopy}><View style={homeStyles.promotionLiveRow}><View style={homeStyles.promotionLiveDot}/><Text style={homeStyles.promotionEyebrow}>48H PROMOTION</Text></View><Text maxFontSizeMultiplier={1.35} style={homeStyles.promotionTitle}>Limited-time offers</Text><Text style={homeStyles.promotionSubtitle}>Live prices selected and controlled from the IPORDISE admin panel.</Text></View>
      {Number.isFinite(nextEnd)?<PromotionCountdown endsAt={nextEnd}/>:<View style={homeStyles.promotionTimer}><Text style={homeStyles.promotionTimerLabel}>AVAILABLE</Text><Text style={homeStyles.promotionTimerLive}>LIVE</Text></View>}
    </View>
    <ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={homeStyles.promotionRail}>{active.slice(0,10).map(product=><View key={product.id} style={homeStyles.promotionCardWrap}><View style={homeStyles.promotionCardBadge}><Ionicons name="flash" size={10} color="#fff"/><Text style={homeStyles.promotionCardBadgeText}>{product.offerBadge||'48H OFFER'}</Text></View><CatalogCard product={product} tablet={layout.tablet} cardWidth={cardWidth} onOpen={()=>onOpen(product)}/></View>)}</ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="View all active promotions" onPress={onViewAll} style={({pressed})=>[homeStyles.promotionViewAll,pressed&&homeStyles.pressed]}><Text style={homeStyles.promotionViewAllText}>VIEW ALL PROMOTIONS</Text><Ionicons name="arrow-forward" size={14} color="#fff"/></Pressable>
  </View>;
}

function HomeProductsGrid({products,layout,onOpen}:{products:Product[];layout:ReturnType<typeof useResponsiveLayout>;onOpen:(product:Product)=>void}) {
  const [visibleCount,setVisibleCount]=useState(10);
  const [rotationKey,setRotationKey]=useState(()=>dailyRotationKey());
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>;const schedule=()=>{setRotationKey(dailyRotationKey());timer=setTimeout(schedule,millisecondsUntilNextRotation()+1000);};schedule();const subscription=AppState.addEventListener('change',state=>{if(state==='active')setRotationKey(dailyRotationKey());});return()=>{clearTimeout(timer);subscription.remove();};},[]);
  useEffect(()=>setVisibleCount(10),[products,rotationKey]);
  const activeProducts=useMemo(()=>products.filter(product=>product.active!==false),[products]);
  const dailyProducts=useMemo(()=>rotateProductsDaily(activeProducts,rotationKey),[activeProducts,rotationKey]);
  const visible=dailyProducts.slice(0,visibleCount);
  const columns=layout.tablet?4:2;
  const cardWidth=Math.floor((layout.contentWidth-10*(columns-1))/columns);
  if(!visible.length)return null;
  const remaining=Math.max(0,dailyProducts.length-visible.length);
  const nextCount=Math.min(10,remaining);
  const hasMore=remaining>0;
  return <View style={homeStyles.ourProductsSection}><View style={homeStyles.sectionHead}><View style={homeStyles.sectionHeadingCopy}><View style={homeStyles.dailyEditLabel}><Ionicons name="sparkles" size={10} color={RED}/><Text style={homeStyles.sectionEyebrow}>THE DAILY EDIT</Text></View><Text maxFontSizeMultiplier={1.35} style={homeStyles.sectionTitle}>Our products</Text><Text style={homeStyles.sectionSubtitle}>A fresh selection from IPORDISE, renewed every 24 hours.</Text></View><View style={homeStyles.dailyEditMeta}><Ionicons name="time-outline" size={12} color="#6b1f31"/><Text style={homeStyles.ourProductsCount}>{visible.length} TODAY</Text></View></View><View style={homeStyles.ourProductsGrid}>{visible.map(product=><CatalogCard key={product.id} product={product} tablet={layout.tablet} cardWidth={cardWidth} onOpen={()=>onOpen(product)}/>)}</View>{hasMore?<Pressable accessibilityRole="button" accessibilityLabel={`Show ${nextCount} more products`} accessibilityHint={`${remaining} products remain in today's edit`} onPress={()=>setVisibleCount(count=>count+10)} style={({pressed})=>[homeStyles.showMoreButton,pressed&&homeStyles.showMorePressed]}><View style={homeStyles.showMoreLeading}><View style={homeStyles.showMoreMark}><Ionicons accessibilityElementsHidden name="grid-outline" size={15} color="#56514e"/></View><View><Text style={homeStyles.showMoreText}>Explore today&apos;s selection</Text><Text style={homeStyles.showMoreMeta}>{remaining} {remaining===1?'fragrance':'fragrances'} still to discover</Text></View></View><View style={homeStyles.showMoreIcon}><Ionicons accessibilityElementsHidden name="arrow-down" size={16} color="#fff"/></View></Pressable>:<View style={homeStyles.allProductsShown}><Ionicons name="checkmark-circle-outline" size={16} color="#176b43"/><Text style={homeStyles.allProductsShownText}>TODAY&apos;S EDIT EXPLORED</Text></View>}</View>;
}

function HomeSeasonal({onPress}:{onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Explore the summer fragrance edit" onPress={onPress} style={({pressed})=>[homeStyles.seasonal,pressed&&homeStyles.pressed]}><Image accessibilityIgnoresInvertColors source={require('./assets/summer-glow-campaign-v1.png')} resizeMode="cover" resizeMethod="resize" fadeDuration={0} style={homeStyles.seasonalImage}/><LinearGradient pointerEvents="none" colors={['rgba(250,239,219,.98)','rgba(250,239,219,.84)','rgba(250,239,219,.08)']} locations={[0,.56,1]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={StyleSheet.absoluteFill}/><View style={homeStyles.seasonalCopy}><Text style={homeStyles.sectionEyebrow}>CURATED FOR THE SEASON</Text><Text style={homeStyles.seasonalTitle}>Summer, bottled.</Text><Text style={homeStyles.seasonalText}>Luminous signatures for warm days and unforgettable evenings.</Text><View style={homeStyles.seasonalCta}><Text style={homeStyles.seasonalCtaText}>Explore the edit</Text><Ionicons name="arrow-forward" size={14} color="#171310"/></View></View></Pressable>;
}

function FragranceFamilies({onSelect}:{onSelect:(query:string)=>void}) {
  const layout=useResponsiveLayout();const cardWidth=layout.tablet?184:layout.compact?154:166;
  return <View style={homeStyles.section}><View style={homeStyles.sectionHead}><View style={homeStyles.sectionHeadingCopy}><Text style={homeStyles.sectionEyebrow}>SCENT DISCOVERY</Text><Text style={homeStyles.sectionTitle}>Find your fragrance</Text><Text style={homeStyles.sectionSubtitle}>Choose the character you want your signature to leave behind.</Text></View><View style={homeStyles.familyGuide}><Ionicons name="swap-horizontal-outline" size={13} color={RED}/><Text style={homeStyles.familyGuideText}>SWIPE TO EXPLORE</Text></View></View><ScrollView horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={cardWidth+10} snapToAlignment="start" contentContainerStyle={homeStyles.familyRail}>{FRAGRANCE_FAMILIES.map((family,index)=><Pressable accessibilityRole="button" accessibilityLabel={`Explore ${family.label} fragrances. ${family.description}`} key={family.label} onPress={()=>onSelect(family.label)} style={({pressed})=>[homeStyles.familyCard,{width:cardWidth,backgroundColor:family.tint,borderColor:family.border},pressed&&homeStyles.pressed]}><View style={[homeStyles.familyAccent,{backgroundColor:family.accent}]}/><View style={homeStyles.familyTop}><View style={[homeStyles.familyPhotoWrap,{borderColor:family.border}]}><Image accessibilityIgnoresInvertColors source={family.image} resizeMode="cover" style={homeStyles.familyPhoto}/></View><Text style={homeStyles.familyNumber}>{String(index+1).padStart(2,'0')}</Text></View><View><Text style={homeStyles.familyLabel}>{family.label}</Text><Text numberOfLines={2} style={homeStyles.familyDescription}>{family.description}</Text></View><View style={homeStyles.familyAction}><Text style={[homeStyles.familyActionText,{color:family.accent}]}>EXPLORE</Text><View style={[homeStyles.familyArrow,{backgroundColor:family.accent}]}><Ionicons accessibilityElementsHidden name="arrow-forward" size={13} color="#fff"/></View></View></Pressable>)}</ScrollView></View>;
}

function HomeBrandTile({house,width,reveal,onPress}:{house:(typeof fragranceHouses)[number];width:number;reveal:Animated.Value;onPress:()=>void}) {
  const interaction=useRef(new Animated.Value(0)).current;
  const animatePress=(value:number)=>Animated.spring(interaction,{toValue:value,tension:260,friction:18,useNativeDriver:Platform.OS!=='web'}).start();
  return <Animated.View style={{opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[10,0]})},{scale:interaction.interpolate({inputRange:[0,1],outputRange:[1,.96]})}]}}><Pressable accessibilityRole="button" accessibilityLabel={`Explore ${house.name} fragrances`} onPress={onPress} onPressIn={()=>animatePress(1)} onPressOut={()=>animatePress(0)} style={[homeStyles.brandCard,{width}]}><Image accessibilityIgnoresInvertColors source={house.logo} resizeMode="contain" style={homeStyles.brandLogo}/></Pressable></Animated.View>;
}

function HomeBrands({layout,onBrand}:{layout:ReturnType<typeof useResponsiveLayout>;onBrand:(brand:string)=>void}) {
  const width=layout.tablet?210:layout.compact?140:150;
  const snap=width+9;
  const railRef=useRef<NativeScrollView>(null);
  const reveals=useRef(fragranceHouses.map(()=>new Animated.Value(0))).current;
  const [,setIndex]=useState(0);
  const [interacting,setInteracting]=useState(false);
  const [reduceMotion,setReduceMotion]=useState(false);
  useEffect(()=>{AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>subscription.remove();},[]);
  useEffect(()=>{if(reduceMotion){reveals.forEach(value=>value.setValue(1));return;}const animation=Animated.stagger(75,reveals.map(value=>Animated.spring(value,{toValue:1,tension:62,friction:10,useNativeDriver:Platform.OS!=='web'})));animation.start();return()=>animation.stop();},[reduceMotion,reveals]);
  useEffect(()=>{if(interacting||reduceMotion)return;const timer=setInterval(()=>setIndex(current=>{const next=(current+1)%fragranceHouses.length;railRef.current?.scrollTo({x:next*snap,animated:true});return next;}),2800);return()=>clearInterval(timer);},[interacting,reduceMotion,snap]);
  return <View style={homeStyles.brandSection}><View style={homeStyles.brandSimpleHeader}><Text style={homeStyles.brandSimpleTitle}>Brands we love</Text></View><ScrollView ref={railRef} horizontal nestedScrollEnabled directionalLockEnabled bounces disableIntervalMomentum showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={snap} snapToAlignment="start" onScrollBeginDrag={()=>setInteracting(true)} onScrollEndDrag={()=>setInteracting(false)} onMomentumScrollEnd={({nativeEvent})=>{setIndex(Math.max(0,Math.min(fragranceHouses.length-1,Math.round(nativeEvent.contentOffset.x/snap))));setInteracting(false);}} contentContainerStyle={homeStyles.brandRail}>{fragranceHouses.map((house,houseIndex)=><HomeBrandTile house={house} width={width} reveal={reveals[houseIndex]} key={house.name} onPress={()=>onBrand(house.name)}/>)}</ScrollView></View>;
}

function HomeNewsletter() {
  const [email,setEmail]=useState('');
  const [focused,setFocused]=useState(false);
  const [status,setStatus]=useState<'idle'|'loading'|'success'|'already'|'error'>('idle');
  const [error,setError]=useState('');
  const submit=async()=>{if(!isValidEmail(email)){setStatus('error');setError('Enter a complete email address.');return;}setStatus('loading');setError('');try{const result=await subscribeToNewsletter(email);setEmail(normalizeEmail(email));setStatus(result==='already_subscribed'?'already':'success');}catch(caught){setStatus('error');setError(caught instanceof Error?caught.message:'Newsletter signup is temporarily unavailable.');}};
  const subscribed=status==='success'||status==='already';
  return <View style={homeStyles.homeNewsletter}><View style={homeStyles.homeNewsletterIntro}><View style={homeStyles.homeNewsletterMark}><Ionicons name="mail-outline" size={17} color="#fff"/></View><View style={homeStyles.homeNewsletterCopy}><Text style={homeStyles.homeNewsletterKicker}>THE IPORDISE LETTER</Text><Text style={homeStyles.homeNewsletterTitle}>Discover what’s next.</Text><Text style={homeStyles.homeNewsletterText}>New fragrances and private offers, thoughtfully selected for you.</Text></View></View><View style={homeStyles.homeNewsletterDivider}/><Text style={homeStyles.homeNewsletterLabel}>EMAIL ADDRESS</Text><View style={[homeStyles.homeNewsletterForm,focused&&homeStyles.homeNewsletterFormFocused,status==='error'&&homeStyles.homeNewsletterFormError,subscribed&&homeStyles.homeNewsletterFormSuccess]}><Ionicons name="mail-outline" size={18} color={subscribed?'#176b43':focused?'#302b2d':'#858187'}/><TextInput accessibilityLabel="Newsletter email address" accessibilityHint="Enter your email to join the IPORDISE Letter" autoCapitalize="none" autoComplete="email" autoCorrect={false} editable={status!=='loading'&&!subscribed} keyboardType="email-address" returnKeyType="send" selectionColor={RED} underlineColorAndroid="transparent" value={email} onChangeText={value=>{setEmail(value);setStatus('idle');setError('');}} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onSubmitEditing={submit} placeholder="you@example.com" placeholderTextColor="#929096" style={homeStyles.homeNewsletterInput}/><Pressable accessibilityRole="button" accessibilityLabel={status==='already'?'This email is already subscribed':'Join the IPORDISE newsletter'} accessibilityState={{busy:status==='loading',disabled:status==='loading'||subscribed}} disabled={status==='loading'||subscribed} onPress={submit} style={({pressed})=>[homeStyles.homeNewsletterButton,subscribed&&homeStyles.homeNewsletterButtonSuccess,pressed&&homeStyles.pressed]}><Text style={homeStyles.homeNewsletterButtonText}>{status==='loading'?'CHECKING':status==='already'?'SUBSCRIBED':status==='success'?'JOINED':'JOIN'}</Text><Ionicons name={subscribed?'checkmark':'arrow-forward'} size={15} color="#fff"/></Pressable></View>{status==='error'?<Text accessibilityRole="alert" style={homeStyles.homeNewsletterError}>{error}</Text>:subscribed?<View accessibilityRole="alert" style={homeStyles.homeNewsletterSuccess}><View style={homeStyles.homeNewsletterSuccessIcon}><Ionicons name={status==='already'?'mail':'checkmark'} size={15} color="#fff"/></View><View style={homeStyles.homeNewsletterSuccessCopy}><Text style={homeStyles.homeNewsletterSuccessTitle}>{status==='already'?'You’re already subscribed.':'You’re on the list.'}</Text><Text style={homeStyles.homeNewsletterSuccessText}>{status==='already'?'This email already receives the IPORDISE Letter.':'Thank you for joining the IPORDISE Letter.'}</Text></View></View>:null}<View style={homeStyles.homeNewsletterPrivacy}><Ionicons name="lock-closed-outline" size={10} color="#82766f"/><Text style={homeStyles.homeNewsletterPrivacyText}>Private, occasional, and easy to unsubscribe.</Text></View></View>;
}

type SearchSort = 'relevance'|'price-low'|'price-high'|'rating';
type SearchPriceBand = 'all'|'under-750'|'750-1000'|'over-1000';

const searchPriceValue=(product:Product)=>{
  const entries=Object.entries(product.sizes).filter(([,price])=>price>0);
  const preferred=entries.find(([size])=>size.replace(/\s+/g,'').toLowerCase()==='100ml')||entries.sort(([a],[b])=>(parseFloat(b)||0)-(parseFloat(a)||0))[0];
  return preferred?.[1]||0;
};

/* Retained in source history only; the active implementation below virtualizes results.
function LegacySearchResultsView({layout,products,query,onClear,onProduct}:{layout:ReturnType<typeof useResponsiveLayout>;products:Product[];query:string;onClear:()=>void;onProduct:(product:Product)=>void}) {
  const [brand,setBrand]=useState('');
  const [audience,setAudience]=useState('');
  const [priceBand,setPriceBand]=useState<SearchPriceBand>('all');
  const [sort,setSort]=useState<SearchSort>('relevance');
  useEffect(()=>{setBrand('');setAudience('');setPriceBand('all');setSort('relevance');},[query]);
  const brands=useMemo(()=>Array.from(new Set(products.map(product=>product.brand))).sort(),[products]);
  const brandCounts=useMemo(()=>Object.fromEntries(brands.map(value=>[value,products.filter(product=>product.brand===value).length])),[brands,products]);
  const audiences=[{label:'Women',value:'for-women'},{label:'Men',value:'for-men'},{label:'Unisex',value:'unisex'}];
  const audienceCounts=useMemo(()=>Object.fromEntries(audiences.map(item=>[item.value,products.filter(product=>product.filters.includes(item.value)).length])),[products]);
  const filtered=useMemo(()=>{
    const values=products.filter(product=>{
      const price=searchPriceValue(product);
      const matchesPrice=priceBand==='all'||(priceBand==='under-750'&&price>0&&price<750)||(priceBand==='750-1000'&&price>=750&&price<=1000)||(priceBand==='over-1000'&&price>1000);
      return (!brand||product.brand===brand)&&(!audience||product.filters.includes(audience))&&matchesPrice;
    });
    if(sort==='price-low')return [...values].sort((a,b)=>searchPriceValue(a)-searchPriceValue(b));
    if(sort==='price-high')return [...values].sort((a,b)=>searchPriceValue(b)-searchPriceValue(a));
    if(sort==='rating')return [...values].sort((a,b)=>Number(b.rating)-Number(a.rating));
    return values;
  },[products,brand,audience,priceBand,sort]);
  const desktop=layout.tablet;
  const sortLabels:Record<SearchSort,string>={relevance:'Relevance','price-low':'Price: low to high','price-high':'Price: high to low',rating:'Top rated'};
  const cycleSort=()=>setSort(value=>value==='relevance'?'price-low':value==='price-low'?'price-high':value==='price-high'?'rating':'relevance');
  const filterOption=(label:string,value:string,selected:string,onSelect:(value:string)=>void,count:number)=><Pressable accessibilityRole="checkbox" accessibilityState={{checked:selected===value}} onPress={()=>onSelect(selected===value?'':value)} key={value} style={homeStyles.searchFilterOption}><View style={[homeStyles.searchCheckbox,selected===value&&homeStyles.searchCheckboxActive]}>{selected===value?<Ionicons name="checkmark" size={12} color="#fff"/>:null}</View><Text numberOfLines={1} style={homeStyles.searchFilterLabel}>{label}</Text><Text style={homeStyles.searchFilterCount}>{count}</Text></Pressable>;
  const sidebar=<View style={homeStyles.searchSidebar}><View style={homeStyles.searchFilterSection}><Text style={homeStyles.searchFilterTitle}>BRAND</Text>{brands.slice(0,8).map(value=>filterOption(value,value,brand,setBrand,brandCounts[value]||0))}</View><View style={homeStyles.searchFilterSection}><Text style={homeStyles.searchFilterTitle}>CATEGORY</Text>{audiences.map(item=>filterOption(item.label,item.value,audience,setAudience,audienceCounts[item.value]||0))}</View><View style={homeStyles.searchFilterSection}><Text style={homeStyles.searchFilterTitle}>PRICE</Text>{[{label:'All prices',value:'all'},{label:'Under 750 MAD',value:'under-750'},{label:'750–1,000 MAD',value:'750-1000'},{label:'Over 1,000 MAD',value:'over-1000'}].map(item=>filterOption(item.label,item.value,priceBand,value=>setPriceBand((value||'all') as SearchPriceBand),products.filter(product=>{const price=searchPriceValue(product);return item.value==='all'||(item.value==='under-750'&&price>0&&price<750)||(item.value==='750-1000'&&price>=750&&price<=1000)||(item.value==='over-1000'&&price>1000);}).length))}</View></View>;
  return <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={homeStyles.searchPageScroll}><View style={[homeStyles.searchPage,{maxWidth:layout.largeTablet?1380:layout.shellWidth,paddingHorizontal:layout.gutter}]}><View style={homeStyles.searchPageTop}><View><Text style={homeStyles.searchPageEyebrow}>IPORDISE SEARCH</Text><Text style={homeStyles.searchPageTitle}>Results for “{query.trim()}”</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close search results" onPress={onClear} style={homeStyles.searchPageClose}><Ionicons name="close" size={22}/></Pressable></View>{!desktop?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={homeStyles.searchMobileFilters}><Pressable onPress={()=>setAudience('')} style={[homeStyles.searchMobileChip,!audience&&homeStyles.searchMobileChipActive]}><Text style={[homeStyles.searchMobileChipText,!audience&&homeStyles.searchMobileChipTextActive]}>All</Text></Pressable>{audiences.map(item=><Pressable key={item.value} onPress={()=>setAudience(audience===item.value?'':item.value)} style={[homeStyles.searchMobileChip,audience===item.value&&homeStyles.searchMobileChipActive]}><Text style={[homeStyles.searchMobileChipText,audience===item.value&&homeStyles.searchMobileChipTextActive]}>{item.label}</Text></Pressable>)}<Pressable onPress={cycleSort} style={homeStyles.searchMobileChip}><Text style={homeStyles.searchMobileChipText}>{sortLabels[sort]}</Text><Ionicons name="chevron-down" size={12}/></Pressable></ScrollView>:null}<View style={[homeStyles.searchBody,!desktop&&homeStyles.searchBodyMobile]}>{desktop?sidebar:null}<View style={homeStyles.searchResultsMain}><View style={homeStyles.searchResultsToolbar}><Text style={homeStyles.searchResultsCount}><Text style={homeStyles.searchResultsCountStrong}>{filtered.length}</Text> {filtered.length===1?'result':'results'}</Text>{desktop?<Pressable accessibilityRole="button" accessibilityLabel={`Sort products. Current: ${sortLabels[sort]}`} onPress={cycleSort} style={homeStyles.searchSort}><Text style={homeStyles.searchSortLabel}>Sort by:</Text><Text style={homeStyles.searchSortValue}>{sortLabels[sort]}</Text><Ionicons name="chevron-down" size={14}/></Pressable>:null}</View>{filtered.length?<View style={homeStyles.searchProductGrid}>{filtered.map(product=><CatalogCard key={product.id} product={product} tablet={layout.tablet} columns={desktop?3:2} onOpen={()=>onProduct(product)}/>)}</View>:<View accessibilityRole="alert" style={homeStyles.emptyResults}><Ionicons name="search-outline" size={27} color="#6b1f31"/><Text style={homeStyles.emptyResultsTitle}>No matching fragrances.</Text><Text style={homeStyles.emptyResultsText}>Remove a filter or try another perfume, brand, or collection.</Text><Pressable onPress={()=>{setBrand('');setAudience('');setPriceBand('all');}} style={homeStyles.emptyResultsButton}><Text style={homeStyles.emptyResultsButtonText}>Clear filters</Text></Pressable></View>}</View></View></View></ScrollView>;
}
*/

function SearchResultsView({layout,products,query,onClear,onProduct}:{layout:ReturnType<typeof useResponsiveLayout>;products:Product[];query:string;onClear:()=>void;onProduct:(product:Product)=>void}):React.ReactElement {
  const [brand,setBrand]=useState('');
  const [audience,setAudience]=useState('');
  const [priceBand,setPriceBand]=useState<SearchPriceBand>('all');
  const [sort,setSort]=useState<SearchSort>('relevance');
  useEffect(()=>{setBrand('');setAudience('');setPriceBand('all');setSort('relevance');},[query]);
  const desktop=layout.tablet;
  const columns=desktop?3:2;
  const resultsWidth=desktop?Math.max(320,layout.contentWidth-246):layout.contentWidth;
  const cardWidth=Math.floor((resultsWidth-10*(columns-1))/columns);
  const audiences=useMemo(()=>[{label:'Women',value:'for-women'},{label:'Men',value:'for-men'},{label:'Unisex',value:'unisex'}],[]);
  const brands=useMemo(()=>Array.from(new Set(products.map(product=>product.brand))).sort(),[products]);
  const {brandCounts,audienceCounts,priceCounts}=useMemo(()=>{
    const nextBrands:Record<string,number>={};
    const nextAudiences:Record<string,number>={};
    const nextPrices:Record<string,number>={all:products.length,'under-750':0,'750-1000':0,'over-1000':0};
    products.forEach(product=>{
      nextBrands[product.brand]=(nextBrands[product.brand]||0)+1;
      product.filters.forEach(value=>{nextAudiences[value]=(nextAudiences[value]||0)+1;});
      const price=searchPriceValue(product);
      if(price>0&&price<750)nextPrices['under-750']+=1;
      else if(price>=750&&price<=1000)nextPrices['750-1000']+=1;
      else if(price>1000)nextPrices['over-1000']+=1;
    });
    return {brandCounts:nextBrands,audienceCounts:nextAudiences,priceCounts:nextPrices};
  },[products]);
  const filtered=useMemo(()=>{
    const values=products.filter(product=>{
      const price=searchPriceValue(product);
      const matchesPrice=priceBand==='all'||(priceBand==='under-750'&&price>0&&price<750)||(priceBand==='750-1000'&&price>=750&&price<=1000)||(priceBand==='over-1000'&&price>1000);
      return (!brand||product.brand===brand)&&(!audience||product.filters.includes(audience))&&matchesPrice;
    });
    if(sort==='price-low')return [...values].sort((a,b)=>searchPriceValue(a)-searchPriceValue(b));
    if(sort==='price-high')return [...values].sort((a,b)=>searchPriceValue(b)-searchPriceValue(a));
    if(sort==='rating')return [...values].sort((a,b)=>Number(b.rating)-Number(a.rating));
    return values;
  },[products,brand,audience,priceBand,sort]);
  const sortLabels:Record<SearchSort,string>={relevance:'Relevance','price-low':'Price: low to high','price-high':'Price: high to low',rating:'Top rated'};
  const cycleSort=useCallback(()=>setSort(value=>value==='relevance'?'price-low':value==='price-low'?'price-high':value==='price-high'?'rating':'relevance'),[]);
  const filterOption=(label:string,value:string,selected:string,onSelect:(value:string)=>void,count:number)=><Pressable accessibilityRole="checkbox" accessibilityState={{checked:selected===value}} onPress={()=>onSelect(selected===value?'':value)} key={value} style={homeStyles.searchFilterOption}><View style={[homeStyles.searchCheckbox,selected===value&&homeStyles.searchCheckboxActive]}>{selected===value?<Ionicons name="checkmark" size={12} color="#fff"/>:null}</View><Text numberOfLines={1} style={homeStyles.searchFilterLabel}>{label}</Text><Text style={homeStyles.searchFilterCount}>{count}</Text></Pressable>;
  const sidebar=<View style={homeStyles.searchSidebar}><View style={homeStyles.searchFilterSection}><Text style={homeStyles.searchFilterTitle}>BRAND</Text>{brands.slice(0,8).map(value=>filterOption(value,value,brand,setBrand,brandCounts[value]||0))}</View><View style={homeStyles.searchFilterSection}><Text style={homeStyles.searchFilterTitle}>CATEGORY</Text>{audiences.map(item=>filterOption(item.label,item.value,audience,setAudience,audienceCounts[item.value]||0))}</View><View style={homeStyles.searchFilterSection}><Text style={homeStyles.searchFilterTitle}>PRICE</Text>{[{label:'All prices',value:'all'},{label:'Under 750 MAD',value:'under-750'},{label:'750–1,000 MAD',value:'750-1000'},{label:'Over 1,000 MAD',value:'over-1000'}].map(item=>filterOption(item.label,item.value,priceBand,value=>setPriceBand((value||'all') as SearchPriceBand),priceCounts[item.value]||0))}</View></View>;
  const renderProduct=useCallback(({item}:{item:Product})=><CatalogCard product={item} tablet={layout.tablet} cardWidth={cardWidth} onOpen={()=>onProduct(item)}/>,[cardWidth,layout.tablet,onProduct]);
  const toolbar=<View style={homeStyles.searchResultsToolbar}><Text style={homeStyles.searchResultsCount}><Text style={homeStyles.searchResultsCountStrong}>{filtered.length}</Text> {filtered.length===1?'result':'results'}</Text>{desktop?<Pressable accessibilityRole="button" accessibilityLabel={`Sort products. Current: ${sortLabels[sort]}`} onPress={cycleSort} style={homeStyles.searchSort}><Text style={homeStyles.searchSortLabel}>Sort by:</Text><Text style={homeStyles.searchSortValue}>{sortLabels[sort]}</Text><Ionicons name="chevron-down" size={14}/></Pressable>:null}</View>;
  const empty=<View accessibilityRole="alert" style={homeStyles.emptyResults}><Ionicons name="search-outline" size={27} color="#6b1f31"/><Text style={homeStyles.emptyResultsTitle}>No matching fragrances.</Text><Text style={homeStyles.emptyResultsText}>Remove a filter or try another perfume, brand, or collection.</Text><Pressable onPress={()=>{setBrand('');setAudience('');setPriceBand('all');}} style={homeStyles.emptyResultsButton}><Text style={homeStyles.emptyResultsButtonText}>Clear filters</Text></Pressable></View>;
  return <View style={homeStyles.searchVirtualRoot}>
    <View style={[homeStyles.searchPage,homeStyles.searchVirtualPage,{maxWidth:layout.largeTablet?1380:layout.shellWidth,paddingHorizontal:layout.gutter}]}>
      <View style={homeStyles.searchPinnedHeader}>
        <View style={homeStyles.searchPageTop}><View><Text style={homeStyles.searchPageEyebrow}>IPORDISE SEARCH</Text><Text style={homeStyles.searchPageTitle}>Results for “{query.trim()}”</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close search results" onPress={onClear} style={homeStyles.searchPageClose}><Ionicons name="close" size={22}/></Pressable></View>
        {!desktop?<ScrollView horizontal style={{height:62,flexGrow:0,flexShrink:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={homeStyles.searchMobileFilters}><Pressable onPress={()=>setAudience('')} style={[homeStyles.searchMobileChip,!audience&&homeStyles.searchMobileChipActive]}><Text style={[homeStyles.searchMobileChipText,!audience&&homeStyles.searchMobileChipTextActive]}>All</Text></Pressable>{audiences.map(item=><Pressable key={item.value} onPress={()=>setAudience(audience===item.value?'':item.value)} style={[homeStyles.searchMobileChip,audience===item.value&&homeStyles.searchMobileChipActive]}><Text style={[homeStyles.searchMobileChipText,audience===item.value&&homeStyles.searchMobileChipTextActive]}>{item.label}</Text></Pressable>)}<Pressable onPress={cycleSort} style={homeStyles.searchMobileChip}><Text style={homeStyles.searchMobileChipText}>{sortLabels[sort]}</Text><Ionicons name="chevron-down" size={12}/></Pressable></ScrollView>:null}
      </View>
      <View style={[homeStyles.searchBody,homeStyles.searchVirtualBody,!desktop&&homeStyles.searchBodyMobile,{alignItems:'stretch',overflow:'hidden'}]}>
        {desktop?sidebar:null}
        <View style={[homeStyles.searchResultsMain,{minHeight:0,alignSelf:'stretch'}]}>
          {toolbar}
          <FlatList key={`search-${columns}`} style={{flex:1,minHeight:0}} data={filtered} numColumns={columns} keyExtractor={item=>item.id} renderItem={renderProduct} columnWrapperStyle={columns>1?homeStyles.resultsRow:undefined} ListEmptyComponent={empty} initialNumToRender={columns*4} maxToRenderPerBatch={columns*3} updateCellsBatchingPeriod={40} windowSize={7} removeClippedSubviews={Platform.OS!=='web'} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEnabled nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={homeStyles.searchVirtualList}/>
        </View>
      </View>
    </View>
  </View>;
}

const resolveBestsellerProducts=(products:Product[],ranking:string[])=>{const active=products.filter(product=>product.active!==false);const byId=new Map(active.map(product=>[product.id,product]));const byName=new Map(active.map(product=>[bestsellerNameKey(product.name),product]));const seen=new Set<string>();const ranked:Product[]=[];ranking.forEach(key=>{const product=byId.get(key)||byName.get(key);if(product&&!seen.has(product.id)){seen.add(product.id);ranked.push(product);}});return ranked;};
const hasPublishedPrice=(product:Product)=>Object.values(product.sizes).some(price=>Number(price)>0);

function PremiumHomeFeed({layout,products,visibleProducts,bestsellerIds,query,activeFilter,catalogSynced,catalogError,homeConfig,onFilter,onSearch,onBrand,onProduct,onCollection}:{layout:ReturnType<typeof useResponsiveLayout>;products:Product[];visibleProducts:Product[];bestsellerIds:string[];query:string;activeFilter:string;catalogSynced:boolean;catalogError:boolean;homeConfig:HomeConfig;onFilter:(filter:string)=>void;onSearch:(query:string)=>void;onBrand:(brand:string)=>void;onProduct:(product:Product)=>void;onCollection:(collection:(typeof discoveryLinks)[number])=>void}) {
  const homeProducts=useMemo(()=>products.filter(product=>product.active!==false&&hasPublishedPrice(product)),[products]);
  const pricedVisibleProducts=useMemo(()=>visibleProducts.filter(hasPublishedPrice),[visibleProducts]);
  const offers=useMemo(()=>homeProducts.filter(product=>isEligibleOffer(product)),[homeProducts]);
  const bestsellers=useMemo(()=>resolveBestsellerProducts(homeProducts,bestsellerIds).slice(0,10),[homeProducts,bestsellerIds]);
  const xerjoff=useMemo(()=>homeProducts.filter(product=>product.brand.toUpperCase().includes('XERJOFF')).slice(0,10),[homeProducts]);
  const unique=useMemo(()=>homeProducts.filter(product=>product.brand.toUpperCase().includes('UNIQUE')).slice(0,10),[homeProducts]);
  const arrivals=useMemo(()=>homeProducts.filter(product=>product.filters.includes('new-in')||product.badge.toUpperCase()==='NEW').slice(0,10),[homeProducts]);
  const configuredSections=homeConfig.sectionOrder.filter(section=>section!=='families'&&!homeConfig.hiddenSections.includes(section)) as HomeFeedSection[];
  const sections:HomeFeedSection[]=query.trim()||activeFilter?[]:configuredSections.filter(section=>(section!=='offers'||offers.length>0)&&(section!=='xerjoff'||xerjoff.length>0)&&(section!=='unique'||unique.length>0)&&(section!=='hero'||homeConfig.heroSlides.length>0)&&(section!=='categories'||homeConfig.categories.length>0));
  const gridCardWidth=Math.floor((layout.contentWidth-10*(layout.catalogColumns-1))/layout.catalogColumns);
  if(query.trim())return <SearchResultsView layout={layout} products={visibleProducts} query={query} onClear={()=>{onSearch('');onFilter('');}} onProduct={onProduct}/>;
  if(activeFilter)return <FlatList data={pricedVisibleProducts} keyExtractor={product=>product.id} numColumns={layout.catalogColumns} key={`results-${layout.catalogColumns}`} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} columnWrapperStyle={layout.catalogColumns>1?homeStyles.resultsRow:undefined} contentContainerStyle={[homeStyles.feed,{maxWidth:layout.shellWidth,paddingHorizontal:layout.gutter}]} ListHeaderComponent={<><HomeBenefitStrip messages={homeConfig.announcements}/><HomeCategories products={homeProducts} categories={homeConfig.categories} activeFilter={activeFilter} onSelect={onFilter}/><View style={homeStyles.resultsHeader}><View><Text style={homeStyles.sectionEyebrow}>SHOP THE COLLECTION</Text><Text style={homeStyles.sectionTitle}>{pricedVisibleProducts.length} fragrances</Text><Text style={homeStyles.sectionSubtitle}>A live edit from the IPORDISE catalogue.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Clear product results" onPress={()=>{onSearch('');onFilter('');}} style={homeStyles.resultsClose}><Ionicons name="close" size={18} color="#171310"/></Pressable></View></>} ListEmptyComponent={<View accessibilityRole="alert" style={homeStyles.emptyResults}><Ionicons name="search-outline" size={27} color="#6b1f31"/><Text style={homeStyles.emptyResultsTitle}>No exact fragrance found.</Text><Text style={homeStyles.emptyResultsText}>Try another house, fragrance name, note, or collection.</Text><Pressable accessibilityRole="button" onPress={()=>{onSearch('');onFilter('');}} style={homeStyles.emptyResultsButton}><Text style={homeStyles.emptyResultsButtonText}>Explore all fragrances</Text></Pressable></View>} initialNumToRender={layout.catalogColumns*4} maxToRenderPerBatch={layout.catalogColumns*3} updateCellsBatchingPeriod={40} windowSize={7} removeClippedSubviews={Platform.OS!=='web'} renderItem={({item})=><CatalogCard product={item} tablet={layout.tablet} cardWidth={gridCardWidth} onOpen={()=>onProduct(item)}/>}/>;
  const renderSection=({item}:{item:HomeFeedSection})=>{
    if(item==='benefits')return <><HomeBenefitStrip messages={homeConfig.announcements}/>{!catalogSynced?<View accessibilityRole={catalogError?'alert':'text'} style={[homeStyles.catalogStatus,catalogError&&homeStyles.catalogStatusError]}><Ionicons name={catalogError?'cloud-offline-outline':'sync-outline'} size={15} color={catalogError?'#8b283e':'#176b43'}/><Text style={[homeStyles.catalogStatusText,catalogError&&homeStyles.catalogStatusTextError]}>{catalogError?'Showing the last available catalogue. Live refresh will retry automatically.':'Refreshing live products and prices…'}</Text></View>:null}</>;
    if(item==='categories')return <HomeCategories products={homeProducts} categories={homeConfig.categories} activeFilter={activeFilter} onSelect={onFilter}/>;
    if(item==='hero')return <HomeHeroCarousel layout={layout} configuredSlides={homeConfig.heroSlides} onSelect={value=>{const collection=discoveryLinks.find(entry=>entry.value===value);if(collection)onCollection(collection);else onFilter(value);}}/>;
    if(item==='offers')return <HomePromotionSection products={homeProducts} layout={layout} onOpen={onProduct} onViewAll={()=>onFilter('offers')}/>;
    if(item==='bestsellers')return <HomeProductRail eyebrow="MOST ORDERED" title="Bestsellers" subtitle="Ranked automatically from customer order quantities." products={bestsellers} layout={layout} onOpen={onProduct} onViewAll={()=>onFilter('dashboard-bestsellers')}/>;
    if(item==='xerjoff')return <HomeProductRail eyebrow="ITALIAN HAUTE PARFUMERIE" title="The House of Xerjoff" subtitle="Rare ingredients, golden artistry and unmistakable character." products={xerjoff} layout={layout} onOpen={onProduct} onViewAll={()=>onSearch('Xerjoff')} tone="xerjoff"/>;
    if(item==='unique')return <HomeProductRail eyebrow="INDEPENDENT NICHE PERFUMERY" title="Unique’e Luxury" subtitle="Bold extrait compositions created for a signature of your own." products={unique} layout={layout} onOpen={onProduct} onViewAll={()=>onSearch("Unique'e Luxury")} tone="unique"/>;
    if(item==='products')return <HomeProductsGrid products={homeProducts} layout={layout} onOpen={onProduct}/>;
    if(item==='seasonal')return <HomeSeasonal onPress={()=>onFilter('new-in')}/>;
    if(item==='families')return <FragranceFamilies onSelect={onSearch}/>;
    if(item==='new')return <HomeProductRail eyebrow="JUST LANDED" title="Just arrived" subtitle="The newest signatures at IPORDISE." products={(arrivals.length?arrivals:homeProducts).slice(0,10)} layout={layout} onOpen={onProduct} onViewAll={()=>onFilter('new-in')}/>;
    if(item==='brands')return <HomeBrands layout={layout} onBrand={onBrand}/>;
    return <HomeNewsletter/>;
  };
  return <FlatList data={sections} renderItem={renderSection} keyExtractor={item=>item} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} removeClippedSubviews={Platform.OS!=='web'} initialNumToRender={2} maxToRenderPerBatch={2} updateCellsBatchingPeriod={16} windowSize={3} contentContainerStyle={[homeStyles.feed,{maxWidth:layout.tablet?960:layout.shellWidth,paddingHorizontal:layout.gutter}]}/>;
}

function HomeContent({initialFilter='',initialQuery='',initialBrand='',initialProduct=null,onOpenWishlist,onOpenBag}:{initialFilter?:string;initialQuery?:string;initialBrand?:string;initialProduct?:Product|null;onOpenWishlist:()=>void;onOpenBag:()=>void}) {
  const previewCollectionValue = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('collection') : null;
  const previewSearchValue = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('search') || '' : '';
  const previewBrandValue = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('brand') || '' : '';
  const [selectedBrand,setSelectedBrand]=useState(initialBrand||previewBrandValue);
  const [query, setQuery] = useState(initialQuery||initialBrand||previewSearchValue||previewBrandValue);
  const deferredQuery=useDeferredValue(query);
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [collectionBrowseActive,setCollectionBrowseActive]=useState(Boolean(initialFilter));
  const [products, setProducts] = useState<Product[]>(() => loadBundledProducts());
  const [bestsellerIds,setBestsellerIds]=useState<string[]>([]);
  const [catalogSynced, setCatalogSynced] = useState(false);
  const [catalogError,setCatalogError]=useState(false);
  const [homeConfig,setHomeConfig]=useState<HomeConfig>(defaultHomeConfig);
  // Legacy-only state below is removed together with the unreachable fallback
  // after the virtualized feed has completed its production soak period.
  const [selectionLimit, setSelectionLimit] = useState(10);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterFocused, setNewsletterFocused] = useState(false);
  const [newsletterStatus,setNewsletterStatus]=useState<'idle'|'loading'|'success'|'error'>('idle');
  const [newsletterError,setNewsletterError]=useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => initialProduct);
  const selectedProductHistoryRef=useRef<Product[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<(typeof discoveryLinks)[number] | null>(() => discoveryLinks.find(item=>item.value===previewCollectionValue) || null);
  const [discoveryIndex, setDiscoveryIndex] = useState(0);
  const discoveryScrollRef = useRef<NativeScrollView>(null);
  const feedScrollRef = useRef<NativeScrollView>(null);
  const catalogYRef = useRef(0);
  const pendingCatalogScrollRef = useRef(Boolean(initialFilter));
  const catalogVersionRef = useRef('');
  const layout = useResponsiveLayout();
  const discoveryCardWidth = Math.min(360, layout.contentWidth - 12);
  const discoverySnap = discoveryCardWidth + 12;
  const openSelectedProduct=(product:Product)=>setSelectedProduct(current=>{if(current&&current.id!==product.id)recordNavigationEntry(selectedProductHistoryRef.current,current,product);return product;});
  const closeSelectedProduct=()=>setSelectedProduct(current=>{if(!current)return current;return selectedProductHistoryRef.current.pop()||null;});
  const selectCollectionFilter=(value:string)=>{setQuery('');setSelectedBrand('');setActiveFilter(value);setCollectionBrowseActive(true);pendingCatalogScrollRef.current=true;};
  const submitNewsletter=async()=>{if(!isValidEmail(newsletterEmail)){setNewsletterStatus('error');setNewsletterError('Enter a complete email address.');return;}setNewsletterStatus('loading');setNewsletterError('');try{await subscribeToNewsletter(newsletterEmail);setNewsletterEmail(normalizeEmail(newsletterEmail));setNewsletterStatus('success');}catch(error){setNewsletterStatus('error');setNewsletterError(error instanceof Error?error.message:'Newsletter signup is temporarily unavailable.');}};
  useEffect(() => {
    let mounted = true;
    let loading = false;
    const refreshCatalog = async (forceRefresh = false) => {
      if (loading) return;
      loading = true;
      try {
        const liveProducts = await loadSharedProducts(forceRefresh);
        if (!mounted) return;
        const nextVersion=JSON.stringify(liveProducts);
        if(nextVersion!==catalogVersionRef.current){
          catalogVersionRef.current=nextVersion;
          setProducts(liveProducts);
          setSelectedProduct(current => current ? liveProducts.find(product => product.id === current.id) || null : null);
        }
        setCatalogSynced(true);
        setCatalogError(false);
      } catch (error) {
        if (mounted) {setCatalogSynced(false);setCatalogError(true);}
        logger.warn('catalog_refresh_using_last_known_data', { error });
      } finally {
        loading = false;
      }
    };
    void refreshCatalog();
    const refreshTimer=setInterval(()=>{void refreshCatalog(true);},appConfig.catalogCacheTtlMs);
    let backgroundedAt=0;
    const appStateSubscription = AppState.addEventListener('change', state => {
      if(state==='background'||state==='inactive'){backgroundedAt=Date.now();return;}
      if(state==='active'&&backgroundedAt){backgroundedAt=0;void refreshCatalog(true);}
    });
    return () => { mounted = false; clearInterval(refreshTimer); appStateSubscription.remove(); };
  }, []);
  useEffect(()=>{let mounted=true;void loadBestsellerProductIds().then(ids=>{if(mounted)setBestsellerIds(ids);}).catch(error=>logger.warn('bestseller_ranking_unavailable',{error}));return()=>{mounted=false;};},[]);
  useEffect(()=>{let mounted=true;void loadHomeConfig().then(config=>{if(mounted)setHomeConfig(config);}).catch(error=>logger.warn('homepage_config_using_defaults',{error}));return()=>{mounted=false;};},[]);
  useEffect(()=>{
    if(Platform.OS==='web')return;
    return registerAndroidBackAction(()=>{
      if(selectedProduct){closeSelectedProduct();return true;}
      if(selectedCollection){setSelectedCollection(null);return true;}
      if(query){setQuery('');setSelectedBrand('');return true;}
      if(collectionBrowseActive){setActiveFilter('');setCollectionBrowseActive(false);return true;}
      return false;
    });
  },[collectionBrowseActive,query,selectedCollection,selectedProduct]);
  const visibleProducts = useMemo(() => {
    if(activeFilter==='dashboard-bestsellers'){
      return resolveBestsellerProducts(products,bestsellerIds);
    }
    const filtered = products.filter(product => {
      const matchesFilter = !activeFilter || activeFilter === 'brands' || matchesShopIntent(product,{filter:activeFilter}) || (activeFilter === 'niche' && (product.brand.includes('XERJOFF') || product.brand.includes('UNIQUE')));
      return matchesFilter;
    });
    if(selectedBrand)return filtered.filter(product=>matchesShopIntent(product,{brand:selectedBrand}));
    const family=asFragranceFamily(deferredQuery);
    return family?filtered.filter(product=>matchesFragranceFamily(product,family)):searchProducts(filtered,deferredQuery);
  }, [products, deferredQuery, activeFilter, bestsellerIds, selectedBrand]);
  const collectionProducts = useMemo(() => {
    if (!selectedCollection) return [];
    const value = selectedCollection.value;
    if(value==='best-sellers'){
      return resolveBestsellerProducts(products,bestsellerIds);
    }
    const matches = products.filter(product => {
      const filters = product.filters.map(filter => filter.toLowerCase());
      if (value === 'new-in') return product.badge.toUpperCase() === 'NEW' || filters.includes('new-in');
      if (value === 'niche') return filters.includes('niche') || ['XERJOFF',"UNIQUE'E LUXURY",'UNIQUE’E LUXURY'].some(brand => product.brand.toUpperCase().includes(brand));
      return filters.includes('discovery-sets');
    });
    return matches.length ? matches : products.slice(0, 10);
  }, [products, selectedCollection, bestsellerIds]);
  const newArrivals = useMemo(() => {
    const arrivals = products.filter(product => product.badge.toUpperCase() === 'NEW' || product.filters.some(filter => filter.toLowerCase() === 'new-in'));
    return (arrivals.length ? arrivals : products).slice(0, 10);
  }, [products]);
  const xerjoffProducts = useMemo(() => products.filter(product => product.brand.toLowerCase().includes('xerjoff') || ['alexandria-ii','erba-pura','naxos'].includes(product.id)), [products]);
  const uniqueProducts = useMemo(() => products.filter(product => product.brand.toLowerCase().includes('unique') || product.id.includes('unique-e-luxury') || ['aphrodisiac-touch','kutay','chocolate-makes-me-happy'].includes(product.id)), [products]);
  const moveDiscovery = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(discoveryLinks.length - 1, discoveryIndex + direction));
    setDiscoveryIndex(next);
    discoveryScrollRef.current?.scrollTo({ x: next * discoverySnap, animated: true });
  };
  const openCollection = (collection: (typeof discoveryLinks)[number]) => {
    setSelectedCollection(collection);
    if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined') (globalThis as any).history?.pushState({}, '', `${globalThis.location.pathname}?store=1&collection=${collection.value}`);
  };
  const closeCollection = () => {
    setSelectedCollection(null);
    if (Platform.OS === 'web' && typeof globalThis.location !== 'undefined') (globalThis as any).history?.pushState({}, '', `${globalThis.location.pathname}?store=1`);
  };
  const returnToAccueil=()=>{
    setQuery('');
    setSelectedBrand('');
    setActiveFilter('');
    setCollectionBrowseActive(false);
    setSelectedProduct(null);
    selectedProductHistoryRef.current=[];
    setSelectedCollection(null);
    pendingCatalogScrollRef.current=false;
    if(Platform.OS==='web'&&typeof globalThis.location!=='undefined')(globalThis as any).history?.pushState({},'',`${globalThis.location.pathname}?store=1`);
  };
  const ourSelection = products.slice(0, selectionLimit);
  const updateSearch=(value:string)=>{setQuery(value);setSelectedBrand('');};
  const openBrand=(brand:string)=>{
    setSelectedBrand(brand);
    setQuery(brand);
    setActiveFilter('');
    setCollectionBrowseActive(false);
    setSelectedCollection(null);
    if(Platform.OS==='web'&&typeof globalThis.location!=='undefined'){
      const params=new URLSearchParams({store:'1',brand});
      (globalThis as any).history?.pushState({},'',`${globalThis.location.pathname}?${params}`);
    }
  };
  if (selectedProduct) return <ProductDetail key={selectedProduct.id} product={selectedProduct} recommendations={products} onBack={closeSelectedProduct} onOpenBag={onOpenBag} onSelectProduct={openSelectedProduct} />;
  if (selectedCollection) return <><Header query={query} setQuery={updateSearch} mobile={!layout.tablet} onHome={returnToAccueil} onOpenWishlist={onOpenWishlist} onOpenBag={onOpenBag}/><CollectionPage collection={selectedCollection} products={collectionProducts} tablet={layout.tablet} onBack={closeCollection} onOpen={openSelectedProduct}/></>;
  return <><Header query={query} setQuery={updateSearch} mobile={!layout.tablet} onHome={returnToAccueil} onOpenWishlist={onOpenWishlist} onOpenBag={onOpenBag}/><PremiumHomeFeed layout={layout} products={products} visibleProducts={visibleProducts} bestsellerIds={bestsellerIds} query={query} activeFilter={collectionBrowseActive?activeFilter:''} catalogSynced={catalogSynced} catalogError={catalogError} homeConfig={homeConfig} onFilter={selectCollectionFilter} onSearch={value=>{setQuery(value);setSelectedBrand('');setActiveFilter('');setCollectionBrowseActive(false);}} onBrand={openBrand} onProduct={openSelectedProduct} onCollection={openCollection}/></>;
  /* Legacy home composition retained temporarily as a safe fallback while the new virtualized feed settles. */
  return <>
    <Header query={query} setQuery={setQuery} mobile={!layout.tablet} onHome={returnToAccueil} onOpenWishlist={onOpenWishlist} onOpenBag={onOpenBag}/>
    <ScrollView ref={feedScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.feed}>
      <View style={[styles.contentContainer, { maxWidth: layout.shellWidth, paddingHorizontal: layout.gutter }, Platform.OS==='web'&&({boxSizing:'border-box'} as any)]}>
      {query.length > 0 && <View style={styles.results}><View style={styles.resultsAccent}/><View style={styles.resultsTop}><View style={styles.resultsIcon}><Ionicons name={visibleProducts.length?'sparkles-outline':'search-outline'} size={18} color={visibleProducts.length?RED:'#786d67'}/></View><View style={styles.resultsCopy}><Text style={styles.resultsEyebrow}>{visibleProducts.length?'SEARCH COMPLETE':'REFINE YOUR SEARCH'}</Text><Text style={styles.resultsText}>{visibleProducts.length?`${visibleProducts.length} ${visibleProducts.length===1?'fragrance found':'fragrances found'}`:'No exact fragrance found'}</Text><Text numberOfLines={1} style={styles.resultsQuery}>{visibleProducts.length?`Results for “${query.trim()}”`:'Try a house, fragrance name, note or collection.'}</Text></View><View style={[styles.resultsCount,!visibleProducts.length&&styles.resultsCountEmpty]}><Text style={[styles.resultsCountValue,!visibleProducts.length&&styles.resultsCountValueEmpty]}>{String(visibleProducts.length).padStart(2,'0')}</Text><Text style={styles.resultsCountLabel}>RESULTS</Text></View></View>{visibleProducts[0]?<Pressable accessibilityRole="button" accessibilityLabel={`Open top result ${visibleProducts[0].brand} ${visibleProducts[0].name}`} onPress={()=>setSelectedProduct(visibleProducts[0])} style={({pressed})=>[styles.resultsBest,pressed&&styles.pressed]}><View style={styles.resultsBestMark}><Ionicons name="star" size={12} color="#fff"/></View><View style={styles.resultsBestCopy}><Text style={styles.resultsBestLabel}>TOP RESULT</Text><Text numberOfLines={1} style={styles.resultsBestValue}>{visibleProducts[0].brand} · {visibleProducts[0].name}</Text></View><View style={styles.resultsBestArrow}><Ionicons name="arrow-forward" size={14} color="#171310"/></View></Pressable>:null}</View>}
      {!query.trim()&&!collectionBrowseActive&&<AccueilShowcase onShop={()=>selectCollectionFilter('new-in')} onBrand={(brand)=>{setQuery(brand);setActiveFilter('');setCollectionBrowseActive(false);}}/>}
      <View style={styles.collectionNav}><View style={styles.collectionNavHead}><Text style={styles.collectionNavLabel}>SHOP THE COLLECTION</Text><Text style={styles.collectionNavMeta}>Luxury fragrance · Morocco</Text></View><ScrollView horizontal nestedScrollEnabled directionalLockEnabled alwaysBounceHorizontal bounces showsHorizontalScrollIndicator={false} scrollEventThrottle={16} contentContainerStyle={styles.collectionFilterRow}>{collectionFilters.map(item=>{const active=collectionBrowseActive&&activeFilter===item.value;return <Pressable accessibilityRole="button" accessibilityLabel={`Show ${item.label}`} accessibilityState={{selected:active}} key={item.label} onPress={()=>selectCollectionFilter(item.value)} style={({pressed})=>[styles.collectionFilter,active&&styles.collectionFilterActive,pressed&&styles.pressed]}><Text style={[styles.collectionFilterText,active&&styles.collectionFilterTextActive]}>{item.label}</Text></Pressable>})}</ScrollView></View>
      {!collectionBrowseActive&&layout.width>=1100&&<>
      <View style={styles.discoverySection}>
        <View style={styles.discoveryHeader}><View style={styles.discoveryHeadingCopy}><Text style={styles.discoveryEyebrow}>THE IPORDISE EDIT</Text><Text style={styles.discoveryTitle}>Find your next signature</Text><Text style={styles.discoveryHint}>Four expert-curated worlds of fragrance.</Text></View><View style={styles.discoveryControls}><Pressable accessibilityRole="button" accessibilityLabel="Previous collection" disabled={discoveryIndex===0} onPress={()=>moveDiscovery(-1)} style={[styles.discoveryControl,discoveryIndex===0&&styles.discoveryControlDisabled]}><Ionicons name="arrow-back" size={16} color={discoveryIndex===0?'#b9b2ac':'#111'}/></Pressable><View style={styles.discoveryCounter}><Text style={styles.discoveryCounterCurrent}>0{discoveryIndex+1}</Text><Text style={styles.discoveryCounterTotal}>/ 04</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Next collection" disabled={discoveryIndex===discoveryLinks.length-1} onPress={()=>moveDiscovery(1)} style={[styles.discoveryControl,styles.discoveryControlDark,discoveryIndex===discoveryLinks.length-1&&styles.discoveryControlDisabled]}><Ionicons name="arrow-forward" size={16} color={discoveryIndex===discoveryLinks.length-1?'#b9b2ac':'#fff'}/></Pressable></View></View>
        <ScrollView ref={discoveryScrollRef} horizontal nestedScrollEnabled directionalLockEnabled alwaysBounceHorizontal bounces disableIntervalMomentum showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={discoverySnap} snapToAlignment="start" scrollEventThrottle={16} onMomentumScrollEnd={({nativeEvent})=>setDiscoveryIndex(Math.max(0,Math.min(discoveryLinks.length-1,Math.round(nativeEvent.contentOffset.x/discoverySnap))))} contentContainerStyle={styles.discoveryGrid}>
          {discoveryLinks.map((item)=><Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.label}. ${item.meta}`} key={item.label} onPress={()=>openCollection(item)} style={({pressed})=>[styles.discoveryCard,{width:discoveryCardWidth},pressed&&styles.discoveryCardPressed]}><Image source={item.image} resizeMode="cover" style={styles.discoveryCardImage}/><LinearGradient pointerEvents="none" colors={['rgba(6,6,6,.02)','rgba(6,6,6,.12)','rgba(6,6,6,.94)']} locations={[0,.44,1]} style={styles.discoveryCardShade}/><View style={styles.discoveryCardTop}><View style={styles.discoveryCollectionMark}><Ionicons name={item.icon as any} size={14} color="#fff"/><Text style={styles.discoveryCollectionNumber}>{item.number} / 04</Text></View><DiscoveryBrandMark/><View style={styles.discoveryArrow}><Ionicons name="arrow-up-outline" size={14} color="#fff" style={{transform:[{rotate:'45deg'}]}}/></View></View><View style={styles.discoveryCopy}><Text style={styles.discoveryKicker}>{item.kicker}</Text><Text style={styles.discoveryLabel}>{item.label}</Text><Text numberOfLines={2} style={styles.discoveryMeta}>{item.meta}</Text><View style={styles.discoveryCardFooter}><Text style={styles.discoveryActionLabel}>EXPLORE THE EDIT</Text><View style={styles.discoveryFooterRule}/></View></View></Pressable>)}
        </ScrollView>
        <View style={styles.discoverySwipeHint}><View style={styles.discoveryProgress}>{discoveryLinks.map((item,index)=><Pressable accessibilityRole="button" accessibilityLabel={`Go to collection ${index+1}`} key={item.number} onPress={()=>{setDiscoveryIndex(index);discoveryScrollRef.current?.scrollTo({x:index*discoverySnap,animated:true});}} style={[styles.discoveryProgressDot,index===discoveryIndex&&styles.discoveryProgressDotActive]}/>)}</View><Text style={styles.discoverySwipeText}>SWIPE TO DISCOVER</Text></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open the Men's Fragrance Event offer" onPress={() => Alert.alert("Men's Fragrance Event", 'The discount is applied automatically to selected products.')} style={[styles.campaign, { height: layout.campaignHeight }]}>
        <Image source={require('./assets/mens-fragrance-campaign.png')} style={styles.campaignImage} />
        <LinearGradient colors={['rgba(0,0,0,.96)', 'rgba(0,0,0,.65)', 'rgba(0,0,0,.08)']} locations={[0,.46,1]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill} />
        <View style={styles.campaignCopy}><Text style={styles.campaignBy}>CURATED BY IPORDISE</Text><Text style={styles.campaignTitle}>{`MEN'S\nFRAGRANCE EVENT`}</Text><View style={styles.campaignOfferRow}><Text style={styles.campaignDiscount}>-15%</Text><Text style={styles.campaignSmall}>ON SELECTED{`\n`}FRAGRANCES</Text></View><View style={styles.campaignCta}><Text style={styles.campaignCtaText}>SHOP THE EVENT</Text><Ionicons name="arrow-forward" size={13} color="#fff"/></View></View>
      </Pressable>
      </>}
      {query.trim() || collectionBrowseActive ? <View onLayout={({nativeEvent})=>{catalogYRef.current=nativeEvent.layout.y;if(pendingCatalogScrollRef.current){feedScrollRef.current?.scrollTo({y:Math.max(0,nativeEvent.layout.y-12),animated:true});pendingCatalogScrollRef.current=false;}}} style={styles.catalogSection}>
        <View style={styles.catalogHeadingRow}><View><Text style={styles.catalogEyebrow}>{query.trim()?'SEARCH RESULTS':'SHOP THE COLLECTION'}</Text><Text style={styles.catalogHeading}>{visibleProducts.length} {activeFilter?collectionFilters.find(item=>item.value===activeFilter)?.label.toLowerCase():''} fragrances</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close perfume results" onPress={() => {setQuery('');setActiveFilter('');setCollectionBrowseActive(false);feedScrollRef.current?.scrollTo({y:0,animated:true});}}><Text style={styles.catalogViewAll}>Close</Text></Pressable></View>
        <View style={styles.catalogGrid}>{visibleProducts.map(product => <CatalogCard key={product.id} product={product} tablet={layout.tablet} columns={layout.catalogColumns} onOpen={() => setSelectedProduct(product)} />)}</View>
      </View> : <>
        <CatalogRailSection eyebrow="JUST LANDED" title="New arrivals" subtitle="The latest scents at IPORDISE" products={newArrivals} tablet={layout.tablet} onOpen={setSelectedProduct}/>
        <CatalogRailSection eyebrow="ITALIAN NICHE HOUSE" title="Discover Xerjoff" subtitle="Rare ingredients. Unmistakable character." products={xerjoffProducts} tablet={layout.tablet} onOpen={setSelectedProduct} dark/>
        <CatalogRailSection eyebrow="EXCLUSIVE NICHE EDIT" title="Unique’e Luxury" subtitle="Bold compositions for a signature unlike any other." products={uniqueProducts} tablet={layout.tablet} onOpen={setSelectedProduct}/>
        <View style={styles.catalogSection}>
          <View style={styles.catalogHeadingRow}><View><Text style={styles.catalogEyebrow}>{catalogSynced ? 'LIVE FROM IPORDISE.COM' : 'CURATED FOR YOU'}</Text><Text style={styles.catalogHeading}>Our selection</Text><Text style={styles.sectionSubtitle}>Handpicked fragrances for every signature.</Text></View><Text style={styles.selectionCount}>{Math.min(selectionLimit,products.length)} / {products.length}</Text></View>
          <View style={styles.catalogGrid}>{ourSelection.map(product => <CatalogCard key={product.id} product={product} tablet={layout.tablet} columns={layout.catalogColumns} onOpen={() => setSelectedProduct(product)} />)}</View>
          {selectionLimit < products.length ? <Pressable accessibilityRole="button" onPress={() => setSelectionLimit(limit => Math.min(limit + 10, products.length))} style={({pressed})=>[styles.showMoreButton,pressed&&styles.pressed]}><Text style={styles.showMoreText}>Show 10 more</Text><Ionicons name="chevron-down" size={17} color="#111"/></Pressable> : <View style={styles.allLoaded}><Ionicons name="checkmark-circle-outline" size={16} color="#777"/><Text style={styles.allLoadedText}>All fragrances are displayed</Text></View>}
        </View>
      </>}
      <View style={styles.offersSection}><View style={styles.offersHeading}><View style={{flex:1}}><Text style={styles.catalogEyebrow}>PRIVATE FRAGRANCE OFFERS</Text><Text style={styles.offersTitle}>More fragrance, just for you.</Text><Text style={styles.offersSubtitle}>Considered privileges for discovering your next signature.</Text></View><View style={styles.offersSeal}><Ionicons name="diamond-outline" size={18} color={RED}/></View></View><View style={styles.offersGrid}><Offer percent="-10%" title="Signature fragrances" detail="Selected full bottles" code="EXTRA10" icon="sparkles-outline" featured/><Offer percent="-15%" title="Discovery sets" detail="Explore before committing" code="EXTRA15" icon="flask-outline"/></View></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Explore the Summer fragrance edit" onPress={() => selectCollectionFilter('new-in')} style={({pressed})=>[styles.secondaryBanner,pressed&&styles.pressed]}><Image source={require('./assets/summer-glow-campaign-v1.png')} resizeMode="cover" style={styles.secondaryBannerImage}/><LinearGradient colors={['rgba(250,241,225,.94)','rgba(250,241,225,.78)','rgba(250,241,225,.04)']} locations={[0,.5,1]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={StyleSheet.absoluteFill}/><View style={styles.secondaryBannerCopy}><Text style={styles.eyebrow}>THE SUMMER EDIT</Text><Text style={styles.secondaryTitle}>Summer signatures</Text><Text style={styles.secondaryText}>Luminous fragrances selected for warm days and unforgettable evenings.</Text><View style={styles.secondaryCta}><Text style={styles.secondaryCtaText}>DISCOVER THE EDIT</Text><Ionicons name="arrow-forward" size={13} color="#111"/></View></View></Pressable>
      <View style={[styles.newsletter,styles.newsletterUpgraded]}><LinearGradient colors={['#1b1311','#080706']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><View style={[styles.newsletterGlow,styles.newsletterGlowUpgraded]}/><View style={styles.newsletterTop}><View style={[styles.newsletterIcon,styles.newsletterIconUpgraded]}><Ionicons name="mail-outline" size={18} color="#fff"/></View><View style={styles.newsletterEdition}><Text style={styles.newsletterEditionText}>MOROCCO EDITION</Text></View></View><Text style={styles.newsletterEyebrow}>THE IPORDISE LETTER</Text><Text style={[styles.newsletterTitle,styles.newsletterTitleUpgraded]}>Beauty worth opening.</Text><Text style={[styles.newsletterText,styles.newsletterTextUpgraded]}>New arrivals, private offers and fragrance stories—thoughtfully curated and delivered occasionally.</Text><View style={styles.newsletterBenefits}><View style={styles.newsletterBenefit}><Ionicons name="sparkles-outline" size={12} color="#ff91a9"/><Text style={styles.newsletterBenefitText}>EARLY ACCESS</Text></View><View style={styles.newsletterBenefitDot}/><View style={styles.newsletterBenefit}><Ionicons name="ticket-outline" size={12} color="#ff91a9"/><Text style={styles.newsletterBenefitText}>PRIVATE OFFERS</Text></View></View><Text style={styles.newsletterFieldLabel}>EMAIL ADDRESS</Text><View style={[styles.newsletterForm,styles.newsletterFormUpgraded,newsletterFocused&&styles.newsletterFormFocused,newsletterStatus==='error'&&styles.newsletterFormError]}><View style={styles.newsletterInputIcon}><Ionicons name="mail-outline" size={17} color="#756a64"/></View><TextInput accessibilityLabel="Newsletter email address" autoCapitalize="none" autoCorrect={false} editable={newsletterStatus!=='loading'} keyboardType="email-address" value={newsletterEmail} onChangeText={(value)=>{setNewsletterEmail(value);setNewsletterStatus('idle');setNewsletterError('');}} onFocus={()=>setNewsletterFocused(true)} onBlur={()=>setNewsletterFocused(false)} onSubmitEditing={submitNewsletter} placeholder="you@example.com" placeholderTextColor="#8e837d" style={[styles.newsletterInput,styles.newsletterInputUpgraded]}/><Pressable accessibilityRole="button" accessibilityLabel="Subscribe to the newsletter" disabled={newsletterStatus==='loading'||newsletterStatus==='success'} onPress={submitNewsletter} style={({pressed})=>[styles.newsletterButton,styles.newsletterButtonUpgraded,newsletterStatus==='success'&&styles.newsletterButtonSuccess,pressed&&styles.pressed]}><Text style={[styles.newsletterButtonText,styles.newsletterButtonTextUpgraded]}>{newsletterStatus==='loading'?'SENDING':newsletterStatus==='success'?'JOINED':'SUBSCRIBE'}</Text><Ionicons name={newsletterStatus==='success'?'checkmark':'arrow-forward'} size={15} color="#fff"/></Pressable></View>{newsletterStatus==='error'?<Text accessibilityRole="alert" style={styles.newsletterError}>{newsletterError}</Text>:newsletterStatus==='success'?<Text accessibilityRole="alert" style={styles.newsletterSuccess}>Welcome to the IPORDISE Letter.</Text>:null}<View style={[styles.newsletterPromise,styles.newsletterPromiseUpgraded]}><Ionicons name="lock-closed-outline" size={11} color="rgba(255,255,255,.5)"/><Text style={[styles.newsletterPromiseText,styles.newsletterPromiseTextUpgraded]}>No noise. Your email stays private. Unsubscribe anytime.</Text></View></View>
      <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  </>;
}

function CollectionPage({ collection, products, tablet, onBack, onOpen }: { collection: (typeof discoveryLinks)[number]; products: Product[]; tablet: boolean; onBack: () => void; onOpen: (product: Product) => void }) {
  const layout=useResponsiveLayout();
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.collectionPageScroll}>
    <View style={styles.collectionPageContainer}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={onBack} style={({pressed})=>[styles.collectionBack,pressed&&styles.pressed]}><Ionicons name="arrow-back" size={18} color="#111"/><Text style={styles.collectionBackText}>Back to IPORDISE</Text></Pressable>
      <View style={styles.collectionHero}>
        <Image source={collection.image} resizeMode="cover" style={styles.collectionHeroImage}/>
        <LinearGradient colors={['rgba(5,5,5,.08)','rgba(5,5,5,.34)','rgba(5,5,5,.94)']} locations={[0,.42,1]} style={StyleSheet.absoluteFillObject}/>
        <View style={styles.collectionHeroTop}><View style={styles.collectionHeroSeal}><Ionicons name={collection.icon as any} size={15} color="#fff"/><Text style={styles.collectionHeroSealText}>IPORDISE EDIT {collection.number}</Text></View><Text style={styles.collectionHeroCount}>{String(products.length).padStart(2,'0')} FRAGRANCES</Text></View>
        <View style={styles.collectionHeroCopy}><Text style={styles.collectionHeroKicker}>{collection.kicker}</Text><Text style={styles.collectionHeroTitle}>{collection.label}</Text><Text style={styles.collectionHeroDescription}>{collection.meta}</Text></View>
      </View>
      <View style={styles.collectionPromiseRow}><View style={styles.collectionPromise}><Ionicons name="shield-checkmark-outline" size={18} color={RED}/><View><Text style={styles.collectionPromiseTitle}>Authentic only</Text><Text style={styles.collectionPromiseText}>Sourced with care</Text></View></View><View style={styles.collectionPromiseDivider}/><View style={styles.collectionPromise}><Ionicons name="cube-outline" size={18} color={RED}/><View><Text style={styles.collectionPromiseTitle}>Morocco delivery</Text><Text style={styles.collectionPromiseText}>1–3 business days</Text></View></View></View>
      <View style={styles.collectionProductsHeader}><View><Text style={styles.catalogEyebrow}>CURATED BY IPORDISE</Text><Text style={styles.collectionProductsTitle}>Shop the collection</Text><Text style={styles.collectionProductsSubtitle}>Selected for quality, character and lasting presence.</Text></View><View style={styles.collectionProductCount}><Text style={styles.collectionProductCountNumber}>{products.length}</Text><Text style={styles.collectionProductCountLabel}>SCENTS</Text></View></View>
      {products.length ? <View style={styles.catalogGrid}>{products.map(product=><CatalogCard key={product.id} product={product} tablet={tablet} columns={layout.catalogColumns} onOpen={()=>onOpen(product)}/>)}</View> : <View style={styles.collectionEmpty}><Ionicons name="flask-outline" size={30} color={RED}/><Text style={styles.collectionEmptyTitle}>This edit is being prepared</Text><Text style={styles.collectionEmptyText}>New fragrances will appear here as soon as they are available.</Text></View>}
      <Pressable accessibilityRole="button" onPress={onBack} style={({pressed})=>[styles.collectionContinue,pressed&&styles.pressed]}><Text style={styles.collectionContinueText}>Continue exploring</Text><Ionicons name="arrow-forward" size={17} color="#fff"/></Pressable>
    </View>
  </ScrollView>;
}

function Offer({percent,title,detail,code,icon,featured=false}:{percent:string;title:string;detail:string;code:string;icon:string;featured?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${percent} on ${title}, code ${code}`} onPress={() => Alert.alert(code, `Use code ${code} on eligible fragrances at checkout.`)} style={({pressed})=>[styles.offer,featured&&styles.offerFeatured,pressed&&styles.pressed]}>
    {featured&&<LinearGradient pointerEvents="none" colors={['#321015','#15100f']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>}<View style={styles.offerTop}><View style={[styles.offerIcon,featured&&styles.offerIconFeatured]}><Ionicons name={icon as any} size={17} color={featured?'#fff':RED}/></View><Text style={[styles.offerLimited,featured&&styles.offerTextMuted]}>PRIVATE OFFER</Text></View><Text style={[styles.offerPercent,featured&&styles.offerTextLight]}>{percent}</Text><Text style={[styles.offerTitle,featured&&styles.offerTextLight]}>{title}</Text><Text style={[styles.offerDetail,featured&&styles.offerTextMuted]}>{detail}</Text><View style={[styles.offerCodeRow,featured&&styles.offerCodeRowFeatured]}><View><Text style={[styles.offerCodeLabel,featured&&styles.offerTextMuted]}>YOUR CODE</Text><Text style={[styles.offerCode,featured&&styles.offerCodeFeatured]}>{code}</Text></View><View style={[styles.offerArrow,featured&&styles.offerArrowFeatured]}><Ionicons name="arrow-forward" size={15} color={featured?RED:'#fff'}/></View></View>
  </Pressable>;
}

function CatalogRailSection({ eyebrow, title, subtitle, products, tablet, onOpen, dark = false }: { eyebrow: string; title: string; subtitle: string; products: Product[]; tablet: boolean; onOpen: (product: Product) => void; dark?: boolean }) {
  if (!products.length) return null;
  return <View style={[styles.railSection,dark&&styles.railSectionDark]}>
    {dark&&<><Image source={require('./assets/xerjoff-section-bg-v1.png')} resizeMode="cover" style={styles.railBackgroundImage}/><LinearGradient pointerEvents="none" colors={['rgba(235,233,230,.88)','rgba(224,221,217,.96)','rgba(214,211,207,.99)']} locations={[0,.48,1]} style={StyleSheet.absoluteFill}/></>}
    <View style={styles.railHeading}><View style={{flex:1}}><Text style={[styles.catalogEyebrow,dark&&styles.railEyebrowDark]}>{eyebrow}</Text><Text style={[styles.railTitle,dark&&styles.railTextDark]}>{title}</Text><Text style={[styles.sectionSubtitle,dark&&styles.railSubtitleDark]}>{subtitle}</Text>{dark&&<View style={styles.railFormatRow}><Ionicons name="flask-outline" size={12} color="#7d6c62"/><Text style={styles.railFormatText}>PREMIUM DECANTS · 5 ML & 10 ML</Text></View>}</View><View style={[styles.railCount,dark&&styles.railCountDark]}><Text style={[styles.railCountText,dark&&styles.railTextDark]}>{String(products.length).padStart(2,'0')}</Text><Text style={dark?styles.railCountLabelDark:styles.railCountLabel}>SCENTS</Text></View></View>
    <ScrollView horizontal nestedScrollEnabled directionalLockEnabled alwaysBounceHorizontal bounces disableIntervalMomentum showsHorizontalScrollIndicator={false} scrollEventThrottle={16} contentContainerStyle={styles.railProducts} snapToInterval={tablet?254:208} snapToAlignment="start" decelerationRate="fast">
      {products.map(product => <CatalogCard key={product.id} product={product} tablet={tablet} cardWidth={tablet?242:196} premiumRail={dark} onOpen={() => onOpen(product)}/>) }
    </ScrollView>
    {dark&&<View style={styles.railSwipeCue}><View style={styles.railSwipeLine}/><Text style={styles.railSwipeText}>SWIPE TO EXPLORE THE HOUSE</Text></View>}
  </View>;
}

const CatalogCard=memo(function CatalogCard({ product, tablet, onOpen, cardWidth, premiumRail = false, columns, compactProductImage = false }: { product: Product; tablet: boolean; onOpen: () => void; cardWidth?: number; premiumRail?: boolean; columns?:number; compactProductImage?: boolean }) {
  const {rtl}=useLanguage();
  const {favouriteIds}=useFavouriteSnapshot();
  const {toggleFavourite,addToBag}=useShoppingActions();
  const liked=favouriteIds.has(product.id);
  const purchasable=Object.values(product.sizes).some(price => price > 0);
  const gridWidth=columns===4?'23.4%':columns===3?'31.8%':tablet?'31.8%':'48.5%';
  const imageStageRef=useRef<any>(null);
  const addProductToBag=()=>{
    const stage=imageStageRef.current;
    if(!stage?.measureInWindow){addToBag(product);return;}
    stage.measureInWindow((x:number,y:number,width:number,height:number)=>{
      const valid=[x,y,width,height].every(Number.isFinite)&&width>0&&height>0;
      addToBag(product,undefined,valid?{x,y,width,height}:undefined);
    });
  };
  return <View style={[styles.catalogCard,premiumRail?styles.railCatalogCard:styles.standardCatalogCard,{width:cardWidth ?? gridWidth}]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${product.brand} ${product.name}, ${product.price}`} onPress={onOpen} style={({pressed})=>[styles.catalogOpen,pressed&&styles.pressed]}><View ref={imageStageRef} style={[styles.catalogImageWrap,premiumRail&&styles.railCatalogImageWrap]}><Image source={product.image} style={[styles.catalogImage,compactProductImage&&styles.recommendationProductImage]} resizeMode="contain" resizeMethod="resize" fadeDuration={0}/>{product.badge?<Text numberOfLines={1} style={[styles.catalogBadge,premiumRail&&styles.railCatalogBadge]}>{product.badge}</Text>:null}</View>
    <View style={[styles.catalogInfo,styles.catalogInfoOverlay,premiumRail?styles.railCatalogInfo:styles.standardCatalogInfo]}><Text numberOfLines={1} style={[styles.catalogBrand,premiumRail&&styles.railCatalogBrand]}>{product.brand}</Text><Text numberOfLines={3} style={[styles.catalogName,premiumRail&&styles.railCatalogName]}>{product.name}</Text><Text style={styles.catalogMeta}>{Object.keys(product.sizes).slice(-2).map(displaySize).join(' · ') || 'Coming soon'}</Text><View style={styles.catalogRatingRow}><Text style={styles.catalogRating}>★★★★★</Text><Text style={styles.catalogRatingNumber}>{product.rating}</Text></View>
    </View></Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{selected:liked}} accessibilityLabel={liked?'Remove from favourites':'Add to favourites'} onPress={()=>toggleFavourite(product)} style={[styles.catalogHeart,premiumRail&&styles.railCatalogHeart]}><Ionicons name={liked?'heart':'heart-outline'} size={23} color={liked?RED:'#111'} /></Pressable>
    {purchasable?<View style={[styles.catalogFooter,premiumRail?styles.railCatalogFooter:styles.standardCatalogFooter]}><View style={[styles.catalogPriceStack,styles.centeredCatalogPriceStack,rtl&&styles.catalogPriceRtl]}>{product.oldPrice ? <View style={styles.catalogDiscountRow}><Text style={styles.catalogOldPrice}>{product.oldPrice}</Text><Text style={styles.catalogSave}>SAVE</Text></View> : <Text style={[styles.catalogFrom,premiumRail?styles.railCatalogFrom:styles.standardCatalogFrom,rtl&&styles.catalogLabelRtl]}>PRICE</Text>}<Text style={[styles.catalogPrice,premiumRail?styles.railCatalogPrice:styles.standardCatalogPrice]}>{product.price}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name} to bag`} onPress={addProductToBag} style={({pressed})=>[styles.catalogQuickAdd,premiumRail?styles.railCatalogQuickAdd:styles.standardCatalogQuickAdd,styles.touchTarget,pressed&&styles.pressed]}><Text style={premiumRail?styles.railCatalogQuickAddText:styles.standardCatalogQuickAddText}>Add to bag</Text><Ionicons name="bag-add-outline" size={premiumRail?18:17} color="#fff" /></Pressable></View>:<Pressable accessibilityRole="button" accessibilityLabel={`Request the boutique price for ${product.name}`} onPress={onOpen} style={({pressed})=>[styles.catalogRequestPrice,styles.catalogRequestPriceOverlay,pressed&&styles.catalogRequestPricePressed]}><View style={styles.catalogRequestCopy}><Text style={styles.catalogRequestEyebrow}>BOUTIQUE PRICE</Text><Text style={styles.catalogRequestText}>Request availability</Text></View><View style={styles.catalogRequestIcon}><Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff"/></View></Pressable>}
  </View>;
});

type ProductVariantOption = {
  id: string;
  key: string;
  price: number;
  ml: number;
  available: boolean;
};

type ProductVariantGroup = {
  key: 'decants' | 'bottles';
  title: string;
  description: string;
  icon: 'flask-outline' | 'cube-outline';
  options: ProductVariantOption[];
};

function VariantCard({option,format,selected,compact,onSelect}:{option:ProductVariantOption;format:'Decant'|'Full bottle';selected:boolean;compact:boolean;onSelect:(option:ProductVariantOption)=>void}) {
  const scale=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    if(!selected)return;
    scale.setValue(.97);
    const animation=Animated.spring(scale,{toValue:1,tension:210,friction:17,useNativeDriver:true});
    animation.start();
    return ()=>animation.stop();
  },[scale,selected]);
  const unitPrice=option.ml>0?`${(option.price/option.ml).toFixed(2)} MAD / ml`:null;
  const accessibilityLabel=`${option.ml} milliliter ${format.toLowerCase()}, ${formatMad(option.price)}${unitPrice?`, ${unitPrice}`:''}${option.available?'':', out of stock'}${selected?', selected':''}`;
  const handlePress=()=>{
    if(selected||!option.available)return;
    if(Platform.OS!=='web')void Haptics.selectionAsync().catch(()=>undefined);
    onSelect(option);
  };
  return <Animated.View style={[styles.variantCardShell,styles.variantCardShellPremium,compact&&styles.variantCardShellCompact,format==='Full bottle'&&styles.variantCardShellBottle,selected&&styles.variantCardShellSelected,selected&&styles.variantCardShellSelectedPremium,!option.available&&{opacity:.45},{transform:[{scale}]}]}>
    <Pressable disabled={!option.available} accessibilityRole="radio" accessibilityLabel={accessibilityLabel} accessibilityHint={option.available?'Updates the product price and bag selection':'This variant is currently out of stock'} accessibilityState={{selected,checked:selected,disabled:!option.available}} onPress={handlePress} style={({pressed})=>[styles.variantCardPressable,styles.variantCardPressablePremium,pressed&&option.available&&styles.variantCardPressed]}>
      <View style={[styles.variantSelection,styles.variantSelectionPremium,selected&&styles.variantSelectionActive]}>{selected?<Ionicons name="checkmark" size={10} color="#fff"/>:null}</View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.82} style={[styles.variantSize,styles.variantSizePremium]}>{displaySize(option.key)}</Text>
      <Text style={[styles.variantPrice,styles.variantPricePremium,selected&&styles.variantPriceSelected]}>{formatMad(option.price)}</Text>
      {!option.available?<Text style={styles.variantUnitPrice}>OUT OF STOCK</Text>:null}
      {unitPrice?<Text numberOfLines={1} adjustsFontSizeToFit style={[styles.variantUnitPrice,styles.variantUnitPricePremium]}>{unitPrice}</Text>:null}
    </Pressable>
  </Animated.View>;
}

function VariantSection({group,selectedKey,compact,onSelect}:{group:ProductVariantGroup;selectedKey:string;compact:boolean;onSelect:(option:ProductVariantOption)=>void}) {
  const cards=group.options.map(option=><VariantCard key={option.key} option={option} format={group.key==='decants'?'Decant':'Full bottle'} selected={selectedKey===option.key} compact={compact} onSelect={onSelect}/>);
  return <View style={[styles.variantSection,group.key==='bottles'&&styles.variantSectionBottle]}>
    <View style={styles.variantSectionHeader}>
      <View style={[styles.variantSectionIcon,styles.variantSectionIconPremium,group.key==='bottles'&&styles.variantSectionIconBottle]}><Ionicons name={group.icon} size={14} color={group.key==='decants'?RED:'#5e4d44'}/></View>
      <View style={styles.variantSectionCopy}><Text style={styles.variantSectionTitle}>{group.title}</Text><Text style={styles.variantSectionDescription}>{group.description}</Text></View>
      <Text style={styles.variantSectionCount}>{group.options.length} {group.options.length===1?'SIZE':'SIZES'}</Text>
    </View>
    {compact?<NativeScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantCompactRail}>{cards}</NativeScrollView>:<View style={styles.variantRow}>{cards}</View>}
  </View>;
}

function ProductVariantSelector({groups,selectedKey,compact,onSelect}:{groups:ProductVariantGroup[];selectedKey:string;compact:boolean;onSelect:(option:ProductVariantOption)=>void}) {
  return <View accessibilityRole="radiogroup" style={styles.variantSelector}>
    <View style={styles.variantSelectorHeader}><View style={styles.variantSelectorHeadingCopy}><Text style={styles.variantSelectorEyebrow}>SELECT YOUR FORMAT</Text><Text style={styles.variantSelectorSubtitle}>Choose how you would like to experience it.</Text></View><View style={[styles.variantVatPill,styles.variantVatLabel]}><Text style={styles.variantVatText}>VAT INCLUDED</Text></View></View>
    {groups.map(group=><VariantSection key={group.key} group={group} selectedKey={selectedKey} compact={compact} onSelect={onSelect}/>)}
  </View>;
}

function ProductDetail({ product, recommendations, onBack, onOpenBag, onSelectProduct }: { product: Product; recommendations: Product[]; onBack: () => void; onOpenBag: () => void; onSelectProduct: (product: Product) => void }) {
  const {favouriteIds}=useFavouriteSnapshot();
  const {bagCount}=useBagSnapshot();
  const {toggleFavourite,addToBag}=useShoppingActions();
  const layout = useResponsiveLayout();
  const similarProducts = useMemo(() => rankSimilarProducts(product, recommendations, 6), [product, recommendations]);
  const availableSizes = Object.entries(product.sizes).filter(([,price]) => price > 0).sort(([a],[b]) => (parseFloat(a)||0)-(parseFloat(b)||0));
  const variantOptions:ProductVariantOption[]=(product.variants?.length?product.variants.filter(variant=>variant.enabled).map(variant=>({id:variant.id,key:variant.sizeKey,price:variant.price,ml:parseFloat(variant.sizeKey)||0,available:variant.stock===null||variant.stock>0})):availableSizes.map(([key,price])=>({id:`${product.id}:${key}`,key,price,ml:parseFloat(key)||0,available:true}))).sort((a,b)=>a.ml-b.ml);
  const sizeGroups = ([
    {key:'decants',title:'DECANTS',description:'Try the fragrance before committing',icon:'flask-outline',options:variantOptions.filter(option=>option.ml<50)},
    {key:'bottles',title:'FULL BOTTLES',description:'Original retail presentation',icon:'cube-outline',options:variantOptions.filter(option=>option.ml>=50)},
  ] satisfies ProductVariantGroup[]).filter(group => group.options.length>0);
  const defaultSize = variantOptions.find(option=>option.available&&option.key.replace(/\s+/g,'').toLowerCase()==='100ml')?.key || variantOptions.find(option=>option.available)?.key || '';
  const [size, setSize] = useState(defaultSize);
  const liked=favouriteIds.has(product.id);
  const [added, setAdded] = useState(false);
  const [sharing,setSharing]=useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [stickyVisible,setStickyVisible]=useState(false);
  const stickyVisibleRef=useRef(false);
  const stickyProgress=useRef(new Animated.Value(0)).current;
  const stickyRevealThreshold=Math.max(520,layout.height*.82);
  useEffect(()=>{
    setGalleryIndex(0);
    stickyVisibleRef.current=false;
    setStickyVisible(false);
    stickyProgress.setValue(0);
  },[product.id,stickyProgress]);
  useEffect(()=>{
    Animated.timing(stickyProgress,{toValue:stickyVisible?1:0,duration:stickyVisible?220:160,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();
  },[stickyProgress,stickyVisible]);
  const handleProductScroll=useCallback((event:NativeSyntheticEvent<NativeScrollEvent>)=>{
    if(layout.tablet)return;
    const offset=event.nativeEvent.contentOffset.y;
    const nextVisible=stickyVisibleRef.current?offset>stickyRevealThreshold-90:offset>stickyRevealThreshold;
    if(nextVisible===stickyVisibleRef.current)return;
    stickyVisibleRef.current=nextVisible;
    setStickyVisible(nextVisible);
  },[layout.tablet,stickyRevealThreshold]);
  const previewInfoTab = Platform.OS === 'web' && typeof globalThis.location !== 'undefined'
    ? new URLSearchParams(globalThis.location.search).get('tab')
    : null;
  const [infoTab, setInfoTab] = useState<'Details'|'Notes'|'Reviews'>(previewInfoTab === 'Notes' || previewInfoTab === 'Reviews' ? previewInfoTab : 'Details');
  const selectedPriceValue = product.sizes[size] || 0;
  const selectedPrice = selectedPriceValue ? formatMad(selectedPriceValue) : product.price;
  const selectedOldValue = product.originalSizes?.[size] || 0;
  const selectedOldPrice = selectedOldValue > selectedPriceValue ? formatMad(selectedOldValue) : product.oldPrice;
  const savingPercent = selectedOldValue > selectedPriceValue ? Math.round((1-selectedPriceValue/selectedOldValue)*100) : 0;
  const noteJourney = [
    { label:'TOP', value:product.notes?.top, detail:'The first impression', icon:'sparkles-outline' as const, color:'#d79a00', tint:'#fff8e8' },
    { label:'HEART', value:product.notes?.heart, detail:'The signature character', icon:'leaf-outline' as const, color:'#245b48', tint:'#edf7f2' },
    { label:'BASE', value:product.notes?.base, detail:'The lasting trail', icon:'flame-outline' as const, color:RED, tint:'#fff0f3' },
  ].filter(note=>Boolean(note.value));
  const selectVariant=(option:ProductVariantOption)=>{
    if(option.key===size)return;
    setSize(option.key);
    setAdded(false);
    AccessibilityInfo.announceForAccessibility(`${displaySize(option.key)} selected. Price ${formatMad(option.price)}.`);
  };
  const shareProduct=async()=>{
    const title=`${product.brand} ${product.name}`;
    const url=Platform.OS==='web'&&typeof globalThis.location!=='undefined'?(()=>{const shared=new URL('/app',globalThis.location.origin);shared.searchParams.set('store','1');shared.searchParams.set('product',product.id);return shared.toString();})():'';
    try{
      setSharing(true);
      if(Platform.OS==='web'){
        const card=await createProductShareCard({brand:product.brand,name:product.name,size:displaySize(size),price:selectedPrice,oldPrice:selectedOldPrice||undefined,savingPercent,image:product.gallery[galleryIndex]||product.image});
        const webNavigator=globalThis.navigator as Navigator & {share?:(data:{title:string;text:string;url?:string;files?:File[]})=>Promise<void>;canShare?:(data:{files?:File[]})=>boolean};
        const data={title,text:`${title} · ${selectedPrice} at IPORDISE`,url:url||undefined,...(card?{files:[card]}:{})};
        if(webNavigator.share&&(!card||!webNavigator.canShare||webNavigator.canShare({files:[card]}))){await webNavigator.share(data);return;}
        if(card)downloadProductShareCard(card);
        await webNavigator.clipboard?.writeText(url);
        Alert.alert('Share card ready','The product image was downloaded and its IPORDISE link was copied.');return;
      }
      await Share.share({title,message:`${title} · ${selectedPrice} at IPORDISE.${url?` ${url}`:''}`});
    }catch(error){logger.warn('product_share_cancelled_or_unavailable',{productId:product.id,error});}
    finally{setSharing(false);}
  };
  const handlePrimaryAction=()=>{if(availableSizes.length){if(added){onOpenBag();return;}setAdded(true);addToBag(product,size);return;}void openAvailabilityWhatsApp(product,size);};
  return <View style={styles.detailPage}><ScrollView onScroll={handleProductScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.detailScroll,styles.detailScrollPremium,!layout.tablet&&styles.detailScrollMobile]}><View style={styles.detailContainer}>
    <View style={[styles.detailLayout, layout.tablet && styles.detailLayoutTablet]}>
      <View style={[styles.detailGallery,styles.detailGalleryPremium,{height:layout.tablet?570:layout.compact?330:360},layout.tablet&&styles.detailGalleryTablet]}>
        <View style={[styles.detailImageStage,layout.tablet&&styles.detailImageStageTablet]}><Image source={product.gallery[galleryIndex]} style={[styles.detailImage,styles.detailImagePremium]} resizeMode="contain" resizeMethod="resize" fadeDuration={0}/></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to products" onPress={onBack} style={[styles.detailFloatingAction,styles.detailFloatingActionPremium,styles.detailFloatingBack,styles.detailFloatingBackPremium]}><Ionicons name="arrow-back" size={20} color="#171310" /></Pressable>
        <View style={[styles.detailFloatingActions,styles.detailFloatingActionsPremium]}><Pressable accessibilityRole="button" accessibilityLabel={`Open shopping bag, ${bagCount} ${bagCount===1?'item':'items'}`} onPress={onOpenBag} style={({pressed})=>[styles.detailFloatingAction,styles.detailFloatingActionPremium,pressed&&styles.detailFloatingActionPressed]}><Ionicons name={bagCount?'bag-handle':'bag-outline'} size={18} color="#241d19" />{bagCount>0?<View style={styles.detailCartBadge}><Text style={styles.detailCartBadgeText}>{Math.min(bagCount,99)}</Text></View>:null}</Pressable><Pressable accessibilityRole="button" accessibilityState={{selected:liked}} accessibilityLabel={liked?'Remove from favourites':'Add to favourites'} onPress={() => toggleFavourite(product)} style={({pressed})=>[styles.detailFloatingAction,styles.detailFloatingActionPremium,liked&&styles.detailFloatingActionSelected,pressed&&styles.detailFloatingActionPressed]}><Ionicons name={liked?'heart':'heart-outline'} size={20} color={liked?RED:'#241d19'} /></Pressable></View>
        {product.gallery.length>1?<><Pressable accessibilityRole="button" accessibilityLabel="Previous product photo" onPress={() => setGalleryIndex(current => (current + product.gallery.length - 1) % product.gallery.length)} style={[styles.galleryArrow,styles.galleryArrowPremium,styles.touchTarget,styles.galleryArrowLeft]}><Ionicons name="chevron-back" size={19}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Next product photo" onPress={() => setGalleryIndex(current => (current + 1) % product.gallery.length)} style={[styles.galleryArrow,styles.galleryArrowPremium,styles.touchTarget,styles.galleryArrowRight]}><Ionicons name="chevron-forward" size={19}/></Pressable></>:null}
        <View accessibilityLabel={`Product photo ${galleryIndex+1} of ${product.gallery.length}`} style={[styles.detailCounter,styles.detailCounterPremium]}><Text style={styles.detailCounterText}>{galleryIndex+1} / {product.gallery.length}</Text></View>
      </View>
      <View style={[styles.detailInfo,styles.detailInfoPremium,layout.tablet&&styles.detailInfoTablet]}>
        <View style={styles.detailBrandRow}>
          <View style={styles.detailBrandLockup}><View style={styles.detailBrandRule}/><Text style={styles.detailBrand}>{product.brand}</Text></View>
          <View style={[styles.stockPill,styles.stockStatusPremium]}><View style={[styles.stockStatusDot,!availableSizes.length&&styles.stockStatusDotMuted]}/><Text style={[styles.stockText,styles.stockTextPremium,!availableSizes.length&&styles.stockTextMuted]}>{availableSizes.length?'READY TO SHIP':'COMING SOON'}</Text></View>
        </View>
        <Text style={[styles.detailName,styles.detailNamePremium]}>{product.name}</Text>
        <View style={styles.detailRatingShareRow}>
          <View style={[styles.detailRating,styles.detailRatingPremium,styles.detailRatingInline]}>
            <Text accessibilityLabel={`${product.rating} out of 5 stars`} style={styles.detailStars}>★★★★★</Text>
            <Text style={styles.detailReview}>{product.rating}</Text><View style={styles.reviewDivider}/><Text style={styles.reviewLink}>{product.reviewCount || 0} verified reviews</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{busy:sharing,disabled:sharing}} disabled={sharing} accessibilityLabel={`Share ${product.name}`} onPress={()=>void shareProduct()} style={({pressed})=>[styles.detailShareAction,sharing&&{opacity:.55},pressed&&styles.detailShareActionPressed]}>{sharing?<ActivityIndicator size="small" color="#d7193f"/>:<Ionicons name="share-social-outline" size={15} color="#5d514b"/>}<Text style={styles.detailShareActionText}>{sharing?'CREATING':'SHARE'}</Text></Pressable>
        </View>
        <View style={styles.detailTrustRow}>
          <View style={styles.detailTrustItem}><Ionicons name="shield-checkmark-outline" size={13} color="#6b1f31"/><Text style={styles.detailTrustText}>Authentic fragrance</Text></View>
          <View style={styles.detailTrustDivider}/>
          <View style={styles.detailTrustItem}><Ionicons name="location-outline" size={13} color="#6b1f31"/><Text style={styles.detailTrustText}>Delivery across Morocco</Text></View>
        </View>
        <View style={[styles.detailPricePanel,styles.detailPricePanelPremium]}>
          <View style={styles.detailPricePanelTop}><Text style={styles.priceLabel}>IPORDISE PRICE</Text><View style={[styles.detailDeliveryPromise,styles.detailDeliveryPromisePremium]}><Ionicons name="cube-outline" size={11} color="#176b43"/><Text style={styles.detailDeliveryPromiseText}>1–3 DAY DELIVERY</Text></View></View>
          <View style={styles.detailPriceRow}><Text style={[styles.detailPrice,styles.detailPricePremium]}>{selectedPrice}</Text>{selectedOldPrice ? <Text style={styles.detailOldPrice}>{selectedOldPrice}</Text> : null}{selectedOldPrice ? <Text style={[styles.detailSaving,styles.detailSavingPremium]}>SAVE {savingPercent || 10}%</Text> : null}</View>
          <View style={styles.detailTaxRow}><Ionicons name="card-outline" size={12} color="#80736c"/><Text style={styles.detailTax}>VAT included · Cash or card on delivery</Text></View>
        </View>
        <ProductVariantSelector groups={sizeGroups} selectedKey={size} compact={layout.compact} onSelect={selectVariant}/>
        <Pressable accessibilityRole="button" accessibilityLabel={added?'Go to cart':availableSizes.length?`Add ${product.name} to bag`:`Ask about ${product.name} availability on WhatsApp`} accessibilityHint={added?'Opens your shopping cart':availableSizes.length?undefined:'Opens a prefilled conversation with IPORDISE on WhatsApp'} onPress={handlePrimaryAction} style={({pressed})=>[styles.detailAdd,styles.detailAddPremium,added&&styles.buyButtonAdded,!availableSizes.length&&{backgroundColor:'#292526'},pressed&&styles.stickyPurchasePressed]}><Ionicons name={added?'bag-handle-outline':availableSizes.length?'bag-outline':'logo-whatsapp'} size={19} color="#fff"/><Text style={[styles.detailAddText,styles.detailAddTextPremium]}>{added?'Go to cart':availableSizes.length?`Add to bag · ${selectedPrice}`:'Ask about availability'}</Text></Pressable>
        <View style={[styles.infoTabs,styles.infoTabsPremium]}>{(['Details','Notes','Reviews'] as const).map(tab => <Pressable accessibilityRole="tab" accessibilityState={{selected:infoTab===tab}} key={tab} onPress={() => setInfoTab(tab)} style={[styles.infoTab,infoTab===tab&&styles.infoTabActive]}><Text style={[styles.infoTabText,styles.infoTabTextPremium,infoTab===tab&&styles.infoTabTextActive]}>{tab}</Text></Pressable>)}</View>
        <View style={styles.infoPanel}>
          {infoTab==='Details' && <><Text style={styles.notesTitle}>The fragrance</Text><Text style={styles.notesText}>{product.description || 'The full product story is being prepared by the IPORDISE boutique.'}</Text><View style={styles.detailFacts}><View style={[styles.detailFact,styles.detailFactPremium]}><Text style={styles.factLabel}>AVAILABILITY</Text><Text style={styles.factValue}>{availableSizes.length?'In stock':'Coming soon'}</Text></View><View style={[styles.detailFact,styles.detailFactPremium]}><Text style={styles.factLabel}>SELECTED SIZE</Text><Text style={styles.factValue}>{size?displaySize(size):'Not available'}</Text></View></View><View style={[styles.deliveryRow,styles.deliveryRowPremium]}><Ionicons name="cube-outline" size={18} color={RED}/><View style={{flex:1}}><Text style={styles.deliveryTitle}>Delivery across Morocco</Text><Text style={styles.deliveryText}>Estimated delivery in 1–3 business days.</Text></View></View></>}
          {infoTab==='Notes' && <>
            <View style={styles.luxNotesHeader}><View style={styles.luxNotesRule}/><Text style={styles.luxNotesEyebrow}>FRAGRANCE ARCHITECTURE</Text><View style={styles.luxNotesRule}/></View>
            <View style={styles.luxNotesTitleRow}><View style={{flex:1}}><Text style={styles.luxNotesTitle}>The scent, revealed</Text><Text style={styles.luxNotesSubtitle}>From first impression to lasting signature</Text></View></View>
            {product.description?<Text style={styles.luxNotesIntro}>{product.description}</Text>:null}
            {noteJourney.length?<View style={styles.luxPyramid}>{noteJourney.map((note,i)=>{const dark=note.label==='BASE';return <View key={note.label} style={[styles.luxNoteCard,{width:note.label==='TOP'?'78%':note.label==='HEART'?'89%':'100%'},note.label==='TOP'&&styles.luxNoteTop,note.label==='HEART'&&styles.luxNoteHeart,dark&&styles.luxNoteBase]}><Text style={[styles.luxNoteNumber,dark&&styles.luxNoteTextDark]}>0{i+1}</Text><View style={styles.luxNoteCopy}><View style={styles.luxNoteMeta}><Text style={[styles.luxNoteLabel,dark&&styles.luxNoteLabelDark]}>{note.label} NOTES</Text><Text style={[styles.luxNotePhase,dark&&styles.luxNotePhaseDark]}>{note.label==='TOP'?'THE OPENING':note.label==='HEART'?'THE CHARACTER':'THE TRAIL'}</Text></View><Text style={[styles.luxNoteValue,dark&&styles.luxNoteTextDark]}>{note.value}</Text></View></View>})}</View>:<Text style={styles.notesText}>Fragrance notes are not currently listed for this product.</Text>}
          </>}
          {infoTab==='Reviews' && <ProductReviews productId={product.id}/>}
        </View>
      </View>
    </View>
    <View style={styles.recommendations}>
      <View style={styles.recommendationHeading}>
        <View><Text style={styles.catalogEyebrow}>SIMILAR FRAGRANCES</Text><Text style={styles.recommendationTitle}>You may also like</Text></View>
        <Text style={styles.recommendationCount}>{similarProducts.length} closest</Text>
      </View>
      <ScrollView horizontal nestedScrollEnabled directionalLockEnabled alwaysBounceHorizontal bounces disableIntervalMomentum showsHorizontalScrollIndicator={false} scrollEventThrottle={16} contentContainerStyle={styles.recommendationRow} snapToInterval={layout.tablet ? 260 : 218} snapToAlignment="start" decelerationRate="fast">
        {similarProducts.map(item => <CatalogCard key={item.id} product={item} tablet={layout.tablet} cardWidth={layout.tablet ? 248 : 206} compactProductImage onOpen={() => onSelectProduct(item)} />)}
      </ScrollView>
    </View>
  </View></ScrollView>{!layout.tablet?<Animated.View accessibilityElementsHidden={!stickyVisible} importantForAccessibility={stickyVisible?'auto':'no-hide-descendants'} pointerEvents={stickyVisible?'auto':'none'} style={[styles.stickyPurchase,{opacity:stickyProgress,transform:[{translateY:stickyProgress.interpolate({inputRange:[0,1],outputRange:[92,0]})}]}]}><View style={styles.stickyPurchaseSummary}><Text style={styles.stickyPurchaseSize}>{size?displaySize(size):'SELECT A SIZE'}</Text><Text style={styles.stickyPurchasePrice}>{selectedPrice}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={added?'Go to cart':availableSizes.length?`Add ${product.name} to bag for ${selectedPrice}`:`Ask about ${product.name} availability`} accessibilityHint={added?'Opens your shopping cart':undefined} onPress={handlePrimaryAction} style={({pressed})=>[styles.stickyPurchaseButton,added&&styles.buyButtonAdded,!availableSizes.length&&styles.stickyPurchaseUnavailable,pressed&&styles.stickyPurchasePressed]}><Ionicons name={added?'bag-handle-outline':availableSizes.length?'bag-outline':'logo-whatsapp'} size={18} color="#fff"/><Text style={styles.stickyPurchaseButtonText}>{added?'GO TO CART':availableSizes.length?'ADD TO BAG':'ASK AVAILABILITY'}</Text></Pressable></Animated.View>:null}</View>;
}

function SupportChatCard() {
  const layout=useResponsiveLayout();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [orderNumber,setOrderNumber]=useState('');
  const [subject,setSubject]=useState('General support');
  const [message,setMessage]=useState('');
  const [reply,setReply]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [session,setSession]=useState<SupportSession|null>(null);
  const [sessionReady,setSessionReady]=useState(false);
  const [conversation,setConversation]=useState<SupportConversation|null>(null);
  const refresh=async(current:SupportSession)=>{try{setConversation(await loadSupportConversation(current));setError('');}catch(error){setError(error instanceof Error?error.message:'We could not refresh this conversation.');}};
  useEffect(()=>{let mounted=true;void readSupportSession().then(saved=>{if(mounted){setSession(saved);setSessionReady(true);}});return()=>{mounted=false;};},[]);
  useEffect(()=>{if(!session)return;void refresh(session);const timer=setInterval(()=>void refresh(session),20_000);return()=>clearInterval(timer);},[session]);
  const createConversation=async()=>{setLoading(true);setError('');try{const created=await createSupportConversation({name,email,orderNumber,subject,message});await saveSupportSession(created);setSession(created);setMessage('');await refresh(created);}catch(error){setError(error instanceof Error?error.message:'Customer care is temporarily unavailable.');}finally{setLoading(false);}};
  const sendReply=async()=>{if(!session)return;setLoading(true);setError('');try{setConversation(await sendCustomerSupportMessage(session,reply));setReply('');}catch(error){setError(error instanceof Error?error.message:'Your message could not be sent.');}finally{setLoading(false);}};
  const startNew=()=>{setSession(null);setConversation(null);setReply('');setError('');void clearSupportSession();};
  const formReady=name.trim().length>=2&&isValidEmail(email)&&message.trim().length>=10;

  if(!sessionReady) return <View style={styles.supportChatCard}><View style={styles.supportChatIntro}><View style={styles.supportChatIcon}><Ionicons name="shield-checkmark-outline" size={21} color="#fff"/></View><View><Text style={styles.supportChatEyebrow}>IPORDISE CARE</Text><Text style={styles.supportChatTitle}>Restoring your private conversation…</Text></View></View></View>;

  if(session) return <View style={styles.supportChatCard}><View style={styles.supportChatHeader}><View><Text style={styles.supportChatEyebrow}>YOUR PRIVATE CONVERSATION</Text><Text style={styles.supportChatTitle}>{conversation?.subject||'Connecting to customer care…'}</Text></View><View style={styles.supportChatStatus}><View style={styles.supportChatStatusDot}/><Text style={styles.supportChatStatusText}>{(conversation?.status||'OPEN').replace('_',' ').toUpperCase()}</Text></View></View><View style={styles.supportThread}>{conversation?.messages.map(item=><View key={item.id} style={[styles.supportBubble,item.senderType==='customer'?styles.supportBubbleCustomer:styles.supportBubbleStaff]}><Text style={[styles.supportBubbleSender,item.senderType==='staff'&&styles.supportBubbleSenderStaff]}>{item.senderType==='staff'?'IPORDISE CARE':'YOU'}</Text><Text style={[styles.supportBubbleText,item.senderType==='customer'&&styles.supportBubbleTextCustomer]}>{item.body}</Text><Text style={[styles.supportBubbleTime,item.senderType==='customer'&&styles.supportBubbleTimeCustomer]}>{new Date(item.createdAt).toLocaleString()}</Text></View>)}</View>{error?<Text accessibilityRole="alert" style={styles.supportChatError}>{error}</Text>:null}<View style={styles.supportReplyRow}><TextInput accessibilityLabel="Reply to customer care" editable={!loading&&conversation?.status!=='closed'} multiline value={reply} onChangeText={setReply} placeholder="Write your reply…" placeholderTextColor="#91867f" style={styles.supportReplyInput}/><Pressable accessibilityRole="button" accessibilityLabel="Send reply" disabled={loading||!reply.trim()} onPress={sendReply} style={({pressed})=>[styles.supportSendButton,(loading||!reply.trim())&&styles.supportSendButtonDisabled,pressed&&styles.pressed]}><Ionicons name="arrow-up" size={19} color="#fff"/></Pressable></View><View style={styles.supportChatFooter}><Text style={styles.supportChatSecure}>Replies from the IPORDISE dashboard appear here automatically.</Text><Pressable accessibilityRole="button" onPress={startNew}><Text style={styles.supportNewConversation}>New conversation</Text></Pressable></View></View>;

  return <View style={styles.supportChatCard}>
    <View pointerEvents="none" style={styles.supportCardAccent}/>
    <View style={styles.supportChatIntro}><View style={styles.supportChatIcon}><Ionicons name="chatbubbles-outline" size={22} color="#fff"/></View><View style={styles.supportIntroCopy}><Text style={styles.supportChatEyebrow}>MESSAGE THE BOUTIQUE</Text><Text style={styles.supportChatTitle}>Start a private conversation.</Text><Text style={styles.supportChatCopy}>Your message goes directly to the IPORDISE care team.</Text></View></View>
    <View style={styles.supportTrustRow}><View style={styles.supportTrustItem}><Ionicons name="shield-checkmark-outline" size={14} color="#176b43"/><Text style={styles.supportTrustText}>Secure private inbox</Text></View><View style={styles.supportTrustDivider}/><View style={styles.supportTrustItem}><Ionicons name="time-outline" size={14} color="#176b43"/><Text style={styles.supportTrustText}>Replies appear here</Text></View></View>
    <Text style={styles.supportSectionLabel}>WHAT CAN WE HELP WITH?</Text>
    <View style={[styles.supportTopicRow,layout.compact&&{flexWrap:'wrap'}]}>{SUPPORT_TOPICS.map(topic=><Pressable accessibilityRole="button" accessibilityState={{selected:subject===topic.label}} key={topic.label} onPress={()=>setSubject(topic.label)} style={[styles.supportTopic,layout.compact&&{flexBasis:'47%'},subject===topic.label&&styles.supportTopicActive]}><Ionicons name={topic.icon} size={14} color={subject===topic.label?'#fff':'#6f6660'}/><Text style={[styles.supportTopicText,subject===topic.label&&styles.supportTopicTextActive]}>{topic.label}</Text></Pressable>)}</View>
    <View style={[styles.supportFieldRow,layout.compact&&{flexDirection:'column',gap:0}]}><View style={[styles.supportFieldGroup,styles.supportFieldHalf,layout.compact&&{width:'100%',flex:0}]}><Text style={styles.supportFieldLabel}>YOUR NAME</Text><TextInput accessibilityLabel="Your name" autoCapitalize="words" maxLength={80} value={name} onChangeText={setName} placeholder="e.g. Zakaria" placeholderTextColor="#a19690" style={styles.supportField}/></View><View style={[styles.supportFieldGroup,styles.supportFieldHalf,layout.compact&&{width:'100%',flex:0}]}><Text style={styles.supportFieldLabel}>EMAIL ADDRESS</Text><TextInput accessibilityLabel="Email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={254} value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor="#a19690" style={styles.supportField}/></View></View>
    <View style={styles.supportFieldGroup}><View style={styles.supportLabelRow}><Text style={styles.supportFieldLabel}>ORDER NUMBER</Text><Text style={styles.supportOptional}>OPTIONAL</Text></View><TextInput accessibilityLabel="Order number, optional" autoCapitalize="characters" maxLength={64} value={orderNumber} onChangeText={setOrderNumber} placeholder="IP-260827-0001" placeholderTextColor="#a19690" style={styles.supportField}/></View>
    <View style={styles.supportFieldGroup}><View style={styles.supportLabelRow}><Text style={styles.supportFieldLabel}>YOUR MESSAGE</Text><Text style={styles.supportOptional}>{message.length}/2000</Text></View><TextInput accessibilityLabel="Support message" multiline textAlignVertical="top" maxLength={2000} value={message} onChangeText={setMessage} placeholder="Tell us how our care team can help…" placeholderTextColor="#a19690" style={[styles.supportField,styles.supportMessageField]}/></View>
    {error?<Text accessibilityRole="alert" style={styles.supportChatError}>{error}</Text>:null}
    <Pressable accessibilityRole="button" accessibilityState={{busy:loading,disabled:loading||!formReady}} disabled={loading||!formReady} onPress={createConversation} style={({pressed})=>[styles.supportSubmitButton,(loading||!formReady)&&styles.supportSendButtonDisabled,pressed&&styles.pressed]}><Text style={styles.supportSubmitText}>{loading?'SENDING SECURELY…':'SEND TO IPORDISE CARE'}</Text><View style={styles.supportSubmitArrow}><Ionicons name="arrow-forward" size={15} color="#fff"/></View></Pressable>
    <View style={styles.supportPrivacy}><Ionicons name="lock-closed-outline" size={12} color="#6e625c"/><Text style={styles.supportPrivacyText}>Encrypted in transit. Never share passwords or payment-card details.</Text></View>
  </View>;
}

type HelpDestination='home'|'track'|'delivery'|'advice'|'contact';

function CarePageHeader({eyebrow,title,subtitle,onBack}:{eyebrow:string;title:string;subtitle:string;onBack:()=>void}) {
  return <View style={styles.carePageHeader}><View style={styles.carePageTop}><Pressable accessibilityRole="button" accessibilityLabel="Back to customer care" onPress={onBack} style={[styles.careBack,styles.touchTarget]}><Ionicons name="arrow-back" size={18} color="#171310"/></Pressable><Brand compact/><View accessible accessibilityLabel="Secure customer care" style={styles.careSecure}><Ionicons name="shield-checkmark-outline" size={13} color="#176b43"/><Text style={styles.careSecureText}>SECURE</Text></View></View><Text style={styles.carePageEyebrow}>{eyebrow}</Text><Text style={styles.carePageTitle}>{title}</Text><Text style={styles.carePageSubtitle}>{subtitle}</Text></View>;
}

const formatMoroccanPhoneInput=(value:string)=>{
  const cleaned=value.replace(/[^\d+]/g,'').replace(/(?!^)\+/g,'');
  if(cleaned.startsWith('+212')){
    const local=cleaned.slice(4,13);
    return `+212${local?` ${local[0]}`:''}${local.slice(1).match(/.{1,2}/g)?.map(part=>` ${part}`).join('')||''}`;
  }
  const digits=cleaned.replace(/\D/g,'').slice(0,10);
  return digits.match(/.{1,2}/g)?.join(' ')||digits;
};

function TrackOrderPage({onBack,onContact}:{onBack:()=>void;onContact:()=>void}) {
  const [orderNumber,setOrderNumber]=useState('');
  const [phone,setPhone]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [errorKind,setErrorKind]=useState<'network'|'not-found'|''>('');
  const [orderError,setOrderError]=useState('');
  const [phoneError,setPhoneError]=useState('');
  const [focused,setFocused]=useState<'order'|'phone'|''>('');
  const [order,setOrder]=useState<TrackedOrder|null>(null);
  const phoneRef=useRef<any>(null);

  const submit=async()=>{
    if(loading)return;
    const normalizedOrder=orderNumber.trim().toUpperCase();
    const normalizedPhone=phone.replace(/[\s()-]/g,'');
    const nextOrderError=/^IPD?-[A-Z0-9-]{8,32}$/.test(normalizedOrder)?'':'Please enter your IPORDISE order number.';
    const nextPhoneError=/^(?:\+?212|0)[5-7]\d{8}$/.test(normalizedPhone)?'':'Enter the Moroccan phone number used at checkout.';
    setOrderError(nextOrderError);setPhoneError(nextPhoneError);setError('');setErrorKind('');
    if(nextOrderError||nextPhoneError)return;
    setLoading(true);setOrder(null);
    try{setOrder(await trackOrder(normalizedOrder,normalizedPhone));}
    catch(caught){
      const message=caught instanceof Error?caught.message:'Order tracking is temporarily unavailable.';
      const notFound=/not found|couldn't find|do not match|matching order/i.test(message);
      setError(message);setErrorKind(notFound?'not-found':'network');
    }finally{setLoading(false);}
  };

  const stages=[
    {id:'pending',label:'Order received'},
    {id:'confirmed',label:'Order confirmed'},
    {id:'processing',label:'Preparing your fragrance'},
    {id:'ready_for_dispatch',label:'Ready for dispatch'},
    {id:'shipped',label:'Shipped'},
    {id:'out_for_delivery',label:'Out for delivery'},
    {id:'delivered',label:'Delivered'},
  ];
  const statusLabels:Record<TrackedOrder['status'],string>={pending:'Order received',confirmed:'Confirmed',processing:'Preparing',ready_for_dispatch:'Ready for dispatch',shipped:'Shipped',out_for_delivery:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled',return_requested:'Return requested',returned:'Returned',delivery_failed:'Delivery issue'};
  const activeIndex=order?stages.findIndex(stage=>stage.id===(order.status==='return_requested'||order.status==='returned'?'delivered':order.status==='delivery_failed'?'shipped':order.status)):-1;
  const orderDate=order&&Number.isFinite(Date.parse(order.createdAt))?new Date(order.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}):'';
  const estimatedDelivery=order?.estimatedDelivery&&Number.isFinite(Date.parse(order.estimatedDelivery))?new Date(order.estimatedDelivery).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}):'';

  return <KeyboardAvoidingView style={styles.trackPage} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.trackScroll}>
      <View style={styles.trackContainer}>
        <View style={styles.trackHeader}>
          <View style={styles.trackHeaderTop}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to customer care" onPress={onBack} style={({pressed})=>[styles.trackBack,pressed&&styles.trackPressed]}><Ionicons name="arrow-back" size={19} color="#211B18"/></Pressable>
            <Brand compact/>
            <View accessibilityLabel="Secure order verification" style={styles.trackTrust}><Ionicons name="shield-checkmark-outline" size={14} color="#456956"/><Text style={styles.trackTrustText}>SECURE</Text></View>
          </View>
          <Text style={styles.trackEyebrow}>ORDER CARE</Text>
          <Text accessibilityRole="header" style={styles.trackTitle}>Track your order</Text>
          <Text style={styles.trackSubtitle}>Enter your order number and the phone number used at checkout.</Text>
        </View>

        <View style={styles.trackForm}>
          <Text accessibilityRole="header" style={styles.trackFormTitle}>Find your delivery</Text>
          <Text style={styles.trackFormIntro}>Your order number appears on the confirmation screen.</Text>

          <View style={styles.trackLabelRow}><Text style={styles.trackLabel}>ORDER NUMBER</Text><Text style={styles.trackHint}>Begins with IP-</Text></View>
          <TextInput accessibilityLabel="IPORDISE order number" autoCapitalize="characters" autoCorrect={false} returnKeyType="next" blurOnSubmit={false} value={orderNumber} onFocus={()=>setFocused('order')} onBlur={()=>setFocused('')} onSubmitEditing={()=>phoneRef.current?.focus()} onChangeText={value=>{setOrderNumber(value.toUpperCase());if(orderError)setOrderError('');}} placeholder="IP-260806-ABC123" placeholderTextColor="#9A918B" style={[styles.trackInput,focused==='order'&&styles.trackInputFocused,orderError&&styles.trackInputError]}/>
          {orderError?<Text accessibilityRole="alert" style={styles.trackFieldError}>{orderError}</Text>:null}

          <View style={styles.trackLabelRow}><Text style={styles.trackLabel}>PHONE NUMBER</Text><Text style={styles.trackHint}>Morocco</Text></View>
          <TextInput ref={phoneRef} accessibilityLabel="Phone number used for order" keyboardType="phone-pad" returnKeyType="go" maxLength={18} value={phone} onFocus={()=>setFocused('phone')} onBlur={()=>setFocused('')} onSubmitEditing={()=>void submit()} onChangeText={value=>{setPhone(formatMoroccanPhoneInput(value));if(phoneError)setPhoneError('');}} placeholder="06 12 34 56 78" placeholderTextColor="#9A918B" style={[styles.trackInput,focused==='phone'&&styles.trackInputFocused,phoneError&&styles.trackInputError]}/>
          {phoneError?<Text accessibilityRole="alert" style={styles.trackFieldError}>{phoneError}</Text>:null}

          <Pressable accessibilityRole="button" accessibilityState={{busy:loading,disabled:loading}} disabled={loading} onPress={()=>void submit()} style={({pressed})=>[styles.trackPrimary,loading&&styles.trackPrimaryDisabled,pressed&&!loading&&styles.trackPrimaryPressed]}>
            <View style={styles.trackPrimaryContent}>{loading?<ActivityIndicator size="small" color="#fff"/>:null}<Text style={styles.trackPrimaryText}>{loading?'CHECKING YOUR ORDER…':'TRACK MY ORDER'}</Text></View>
            {!loading?<Ionicons name="arrow-forward" size={17} color="#fff"/>:null}
          </Pressable>
          <View style={styles.trackPrivacy}><Ionicons name="lock-closed-outline" size={11} color="#7B726C"/><Text style={styles.trackPrivacyText}>Your order information is securely verified.</Text></View>
        </View>

        {error?<View accessibilityRole="alert" style={styles.trackErrorState}>
          <Ionicons name={errorKind==='network'?'cloud-offline-outline':'search-outline'} size={21} color="#8E263B"/>
          <Text style={styles.trackErrorTitle}>{errorKind==='network'?"We couldn't connect right now.":"We couldn't find this order."}</Text>
          <Text style={styles.trackErrorText}>{errorKind==='network'?'Please check your connection and try again.':'Check that both details match the information used at checkout.'}</Text>
          <Text style={styles.trackErrorDetail}>{error}</Text>
          <View style={styles.trackErrorActions}><Pressable accessibilityRole="button" onPress={()=>errorKind==='network'?void submit():(setError(''),setErrorKind(''))} style={styles.trackRetry}><Text style={styles.trackRetryText}>TRY AGAIN</Text></Pressable><Pressable accessibilityRole="button" onPress={onContact} style={styles.trackContactAction}><Text style={styles.trackContactActionText}>Contact support</Text><Ionicons name="arrow-forward" size={14} color="#322A26"/></Pressable></View>
        </View>:null}

        {order?<View style={styles.trackResult}>
          <View style={styles.trackResultTop}><View style={styles.trackResultCopy}><Text style={styles.trackEyebrow}>ORDER FOUND</Text><Text accessibilityRole="header" style={styles.trackResultNumber}>{order.orderNumber}</Text></View><View style={[styles.trackStatus,order.status==='cancelled'&&styles.trackStatusCancelled]}><Text style={[styles.trackStatusText,order.status==='cancelled'&&styles.trackStatusTextCancelled]}>{statusLabels[order.status].toUpperCase()}</Text></View></View>
          <View style={styles.trackSummary}>
            <View style={styles.trackSummaryItem}><Text style={styles.trackSummaryLabel}>ORDER DATE</Text><Text style={styles.trackSummaryValue}>{orderDate||'—'}</Text></View>
            <View style={styles.trackSummaryDivider}/>
            <View style={styles.trackSummaryItem}><Text style={styles.trackSummaryLabel}>ORDER TOTAL</Text><Text style={styles.trackSummaryValue}>{formatMad(order.total)}</Text></View>
            <View style={styles.trackSummaryDivider}/>
            <View style={styles.trackSummaryItem}><Text style={styles.trackSummaryLabel}>ITEMS</Text><Text style={styles.trackSummaryValue}>{order.itemCount}</Text></View>
          </View>
          {order.status==='cancelled'?<View style={styles.trackCancelled}><Ionicons name="close-circle-outline" size={18} color="#8E263B"/><Text style={styles.trackCancelledText}>This order has been cancelled. Contact Care if you need assistance.</Text></View>:order.status==='delivery_failed'?<View style={styles.trackCancelled}><Ionicons name="alert-circle-outline" size={18} color="#8E263B"/><Text style={styles.trackCancelledText}>The courier could not complete this delivery. IPORDISE Care can help arrange the next step.</Text></View>:<View accessibilityLabel={`Delivery status: ${statusLabels[order.status]}`} style={styles.trackTimeline}>
            {stages.map((stage,index)=>{const complete=index<activeIndex;const current=index===activeIndex;const history=order.statusHistory?.find(item=>item.status.toLowerCase()===stage.id);const date=history&&Number.isFinite(Date.parse(history.createdAt))?new Date(history.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short'}):'';return <View key={stage.id} style={styles.trackStep}><View style={styles.trackStepAxis}><View style={[styles.trackDot,(complete||current)&&styles.trackDotActive,current&&styles.trackDotCurrent]}>{complete?<Ionicons name="checkmark" size={11} color="#fff"/>:null}</View>{index<stages.length-1?<View style={[styles.trackLine,complete&&styles.trackLineActive]}/>:null}</View><View style={styles.trackStepCopy}><Text style={[styles.trackStepTitle,(complete||current)&&styles.trackStepTitleActive]}>{stage.label}</Text><Text style={styles.trackStepMeta}>{current?'CURRENT STATUS':date||(!complete?'UP NEXT':'COMPLETED')}</Text></View></View>;})}
          </View>}
          {(order.courierName||order.trackingNumber)?<View style={styles.trackEstimate}><Text style={styles.trackEstimateLabel}>COURIER DETAILS</Text><Text style={styles.trackEstimateText}>{[order.courierName,order.trackingNumber&&`Tracking ${order.trackingNumber}`].filter(Boolean).join(' · ')}</Text></View>:null}
          <View style={styles.trackEstimate}><Text style={styles.trackEstimateLabel}>DELIVERY ESTIMATE</Text><Text style={styles.trackEstimateText}>{estimatedDelivery||'Your delivery estimate will appear when it is available for this order.'}</Text></View>
        </View>:null}

        {!error?<Pressable accessibilityRole="button" onPress={onContact} style={({pressed})=>[styles.trackSupport,pressed&&styles.trackPressed]}><View style={styles.trackSupportCopy}><Text style={styles.trackSupportLabel}>NEED HELP?</Text><Text style={styles.trackSupportTitle}>Our customer-care team is here to help.</Text></View><View style={styles.trackSupportAction}><Text style={styles.trackSupportActionText}>Contact support</Text><Ionicons name="arrow-forward" size={14} color="#8E263B"/></View></Pressable>:null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function DeliveryReturnsPage({onBack,onContact,config}:{onBack:()=>void;onContact:()=>void;config:HelpConfig}) {
  const [open,setOpen]=useState('');
  return <ScrollView contentContainerStyle={styles.pageScroll}><View style={styles.pageContainer}><CarePageHeader eyebrow="DELIVERY & RETURNS" title="Delivery, clearly explained." subtitle="Current delivery and return information for Morocco." onBack={onBack}/><View style={styles.deliveryPromise}><Ionicons name="shield-checkmark" size={24} color="#176b43"/><View style={{flex:1}}><Text style={styles.deliveryPromiseTitle}>Information you can trust.</Text><Text style={styles.deliveryPromiseText}>These policies are maintained by the IPORDISE team in the protected dashboard.</Text></View></View>{config.deliveryPolicies.length?config.deliveryPolicies.map((policy,index)=>{const expanded=open===policy.id;return <Pressable accessibilityRole="button" accessibilityState={{expanded}} key={policy.id} onPress={()=>setOpen(value=>value===policy.id?'':policy.id)} style={styles.policyCard}><Text style={styles.policyNumber}>{String(index+1).padStart(2,'0')}</Text><View style={styles.policyIcon}><Ionicons name="document-text-outline" size={20} color={RED}/></View><View style={{flex:1}}><Text style={styles.policyTitle}>{policy.title}</Text>{expanded?<Text style={styles.policyText}>{policy.body}</Text>:null}</View><Ionicons name={expanded?'chevron-up':'chevron-down'} size={18}/></Pressable>}):<View style={styles.policyUnavailable}><Ionicons name="information-circle-outline" size={20} color={RED}/><View style={{flex:1}}><Text style={styles.policyTitle}>Ask for current delivery information</Text><Text style={styles.policyText}>Commercial policy details have not yet been published in the Help Centre. Contact Care for verified information before ordering or returning a product.</Text></View></View>}<Pressable accessibilityRole="button" onPress={onContact} style={styles.carePrimary}><Text style={styles.carePrimaryText}>CONTACT DELIVERY SUPPORT</Text><Ionicons name="arrow-forward" size={17} color="#fff"/></Pressable></View></ScrollView>;
}

function ProductAdvicePage({onBack,onShop,onOpenProduct,onContact}:{onBack:()=>void;onShop:(filter:string)=>void;onOpenProduct:(product:Product,products:Product[])=>void;onContact:()=>void}) {
  const layout=useResponsiveLayout();
  const [profile,setProfile]=useState('Fresh');const [forWho,setForWho]=useState('for-women');const [occasion,setOccasion]=useState('Everyday');const [intensity,setIntensity]=useState('Balanced');const [budget,setBudget]=useState(1000);const [products,setProducts]=useState<Product[]>([]);
  useEffect(()=>{let mounted=true;void loadSharedProducts().then(value=>{if(mounted)setProducts(value);}).catch(error=>logger.warn('advice_catalog_unavailable',{error}));return()=>{mounted=false;};},[]);
  const recommendations=useMemo(()=>products.filter(product=>product.active&&product.stockLeft!==0&&product.filters.some(filter=>filter.toLowerCase()===forWho)&&Object.values(product.sizes).some(price=>price>0&&price<=budget)).sort((a,b)=>{const terms=`${profile} ${occasion} ${intensity}`.toLowerCase().split(' ');const textA=`${a.name} ${a.description||''} ${a.notes?.top||''} ${a.notes?.heart||''} ${a.notes?.base||''}`.toLowerCase();const textB=`${b.name} ${b.description||''} ${b.notes?.top||''} ${b.notes?.heart||''} ${b.notes?.base||''}`.toLowerCase();return terms.filter(term=>textB.includes(term)).length-terms.filter(term=>textA.includes(term)).length;}).slice(0,3),[budget,forWho,intensity,occasion,products,profile]);
  const profiles=[{label:'Fresh',icon:'water-outline'},{label:'Warm',icon:'flame-outline'},{label:'Elegant',icon:'diamond-outline'},{label:'Bold',icon:'sparkles-outline'}];
  return <ScrollView contentContainerStyle={styles.pageScroll}><View style={styles.pageContainer}><CarePageHeader eyebrow="FRAGRANCE CONCIERGE" title="Find a fragrance that feels like you." subtitle="Choose a direction and explore a personal starting point." onBack={onBack}/><View style={styles.adviceHero}><LinearGradient colors={['#251411','#0c0a09']} style={StyleSheet.absoluteFill}/><Ionicons name="sparkles-outline" size={27} color="#ff8fa9"/><Text style={styles.adviceHeroEyebrow}>YOUR SCENT PROFILE</Text><Text style={styles.adviceHeroTitle}>{profile} · {intensity.toLowerCase()}.</Text><Text style={styles.adviceHeroText}>Suggestions for {occasion.toLowerCase()}, within approximately {formatMad(budget)}.</Text></View><Text style={styles.adviceQuestion}>Who is it for?</Text><View style={[styles.adviceAudienceRow,layout.compact&&{flexWrap:'wrap'}]}>{[{label:'For her',value:'for-women'},{label:'For him',value:'for-men'},{label:'Unisex',value:'unisex'}].map(item=><Pressable accessibilityRole="button" accessibilityState={{selected:forWho===item.value}} key={item.value} onPress={()=>setForWho(item.value)} style={[styles.adviceAudience,layout.compact&&{minWidth:'47%'},forWho===item.value&&styles.adviceAudienceActive]}><Text style={[styles.adviceAudienceText,forWho===item.value&&styles.adviceAudienceTextActive]}>{item.label}</Text></Pressable>)}</View><Text style={styles.adviceQuestion}>Which fragrance family?</Text><View style={styles.adviceGrid}>{profiles.map(item=><Pressable accessibilityRole="button" accessibilityState={{selected:profile===item.label}} key={item.label} onPress={()=>setProfile(item.label)} style={[styles.adviceChoice,layout.compact&&{width:'100%'},profile===item.label&&styles.adviceChoiceActive]}><Ionicons name={item.icon as any} size={21} color={profile===item.label?'#fff':RED}/><Text style={[styles.adviceChoiceText,profile===item.label&&styles.adviceChoiceTextActive]}>{item.label}</Text></Pressable>)}</View><Text style={styles.adviceQuestion}>When will you wear it?</Text><View style={styles.adviceAudienceRow}>{['Everyday','Evening','Special'].map(value=><Pressable key={value} onPress={()=>setOccasion(value)} style={[styles.adviceAudience,occasion===value&&styles.adviceAudienceActive]}><Text style={[styles.adviceAudienceText,occasion===value&&styles.adviceAudienceTextActive]}>{value}</Text></Pressable>)}</View><Text style={styles.adviceQuestion}>Preferred intensity</Text><View style={styles.adviceAudienceRow}>{['Subtle','Balanced','Intense'].map(value=><Pressable key={value} onPress={()=>setIntensity(value)} style={[styles.adviceAudience,intensity===value&&styles.adviceAudienceActive]}><Text style={[styles.adviceAudienceText,intensity===value&&styles.adviceAudienceTextActive]}>{value}</Text></Pressable>)}</View><Text style={styles.adviceQuestion}>Approximate budget</Text><View style={styles.adviceAudienceRow}>{[500,1000,2000].map(value=><Pressable key={value} onPress={()=>setBudget(value)} style={[styles.adviceAudience,budget===value&&styles.adviceAudienceActive]}><Text style={[styles.adviceAudienceText,budget===value&&styles.adviceAudienceTextActive]}>{value===2000?'2000+ MAD':`≤ ${value} MAD`}</Text></Pressable>)}</View>{recommendations.length?<View style={styles.adviceRecommendations}><Text style={styles.carePageEyebrow}>SUGGESTED STARTING POINTS</Text>{recommendations.map(product=><Pressable accessibilityRole="button" key={product.id} onPress={()=>onOpenProduct(product,products)} style={styles.adviceProduct}><Image source={product.image} resizeMode="contain" style={styles.adviceProductImage}/><View style={{flex:1,minWidth:0}}><Text style={styles.adviceProductBrand}>{product.brand}</Text><Text numberOfLines={2} style={styles.adviceProductName}>{product.name}</Text><Text style={styles.adviceProductPrice}>{product.price}</Text></View><Ionicons name="chevron-forward" size={18}/></Pressable>)}<Text style={styles.adviceDisclaimer}>Suggestions are a starting point based on your selections, not a guarantee of personal preference.</Text></View>:null}<View style={styles.adviceNote}><Ionicons name="information-circle-outline" size={18} color={RED}/><Text style={styles.adviceNoteText}>Only currently available catalogue products within your selected budget are suggested.</Text></View><Pressable accessibilityRole="button" onPress={()=>onShop(forWho)} style={styles.carePrimary}><Text style={styles.carePrimaryText}>EXPLORE THE FULL EDIT</Text><Ionicons name="arrow-forward" size={17} color="#fff"/></Pressable><Pressable accessibilityRole="button" onPress={onContact} style={styles.careHelpLink}><Ionicons name="chatbubble-ellipses-outline" size={18} color={RED}/><Text style={styles.careHelpTitle}>Speak with a fragrance specialist</Text><Ionicons name="chevron-forward" size={16}/></Pressable></View></ScrollView>;
}

function ContactSupportPage({onBack,config}:{onBack:()=>void;config:HelpConfig}) {
  void config;
  return <KeyboardAvoidingView style={styles.supportPage} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.pageScroll,styles.supportPageScroll]}>
      <View style={[styles.pageContainer,styles.supportPageContainer]}>
        <CarePageHeader eyebrow="PRIVATE CUSTOMER CARE" title="Talk to the boutique." subtitle="Send a secure message and receive replies from the IPORDISE dashboard." onBack={onBack}/>
        <SupportChatCard/>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function HelpPage({onShop,onOpenProduct,bottomInset,initialDestination='home',onExit}:{onShop:(filter:string)=>void;onOpenProduct:(product:Product,products:Product[])=>void;bottomInset:number;initialDestination?:HelpDestination;onExit?:()=>void}) {
  const [destination,setDestination]=useState<HelpDestination>(initialDestination);
  const helpDestinationRef=useRef<HelpDestination>(initialDestination);
  const helpHistoryRef=useRef<HelpDestination[]>(initialDestination==='home'||onExit?[]:['home']);
  const navigateHelp=useCallback((next:HelpDestination)=>{const current=helpDestinationRef.current;if(!recordNavigationEntry(helpHistoryRef.current,current,next))return;helpDestinationRef.current=next;setDestination(next);},[]);
  const goBackHelp=useCallback(()=>{const previous=popPreviousNavigationEntry(helpHistoryRef.current,helpDestinationRef.current);if(!previous&&onExit){onExit();return;}const next=previous||'home';helpDestinationRef.current=next;setDestination(next);},[onExit]);
  const [config,setConfig]=useState(defaultHelpConfig);
  useEffect(()=>{let mounted=true;void loadHelpConfig().then(value=>{if(mounted)setConfig(value);}).catch(error=>logger.warn('help_config_using_defaults',{error}));return()=>{mounted=false;};},[]);
  useEffect(()=>{if(Platform.OS==='web'||(destination==='home'&&!onExit))return;return registerAndroidBackAction(()=>{goBackHelp();return true;});},[destination,goBackHelp,onExit]);
  if(destination==='track')return <TrackOrderPage onBack={goBackHelp} onContact={()=>navigateHelp('contact')}/>;
  if(destination==='delivery')return <DeliveryReturnsPage config={config} onBack={goBackHelp} onContact={()=>navigateHelp('contact')}/>;
  if(destination==='advice')return <ProductAdvicePage onBack={goBackHelp} onShop={onShop} onOpenProduct={onOpenProduct} onContact={()=>navigateHelp('contact')}/>;
  if(destination==='contact')return <ContactSupportPage config={config} onBack={goBackHelp}/>;
  return <HelpCenter config={config} onNavigate={value=>{if(value==='orders')navigateHelp('track');else if(value==='payments'||value==='faq')return;else if(value==='products'||value==='advice')navigateHelp('advice');else if(value==='account')navigateHelp('contact');else navigateHelp(value);}} onShop={onShop} bottomInset={bottomInset}/>;
}

function AdminPortalCard() {
  const openDashboard=async()=>{const localAdmin=Platform.OS==='web'&&typeof globalThis.location!=='undefined'?`${globalThis.location.origin}/admin`:null;const target=appConfig.adminDashboardUrl||localAdmin;if(!target){Alert.alert('Admin portal setup','Add EXPO_PUBLIC_ADMIN_DASHBOARD_URL to connect the secure IPORDISE dashboard.');return;}try{await Linking.openURL(target);}catch{Alert.alert('Admin portal unavailable','The dashboard could not be opened on this device.');}};
  return <View style={styles.adminPortalCard}><View style={styles.adminPortalIcon}><Ionicons name="shield-checkmark-outline" size={21} color="#fff"/></View><View style={styles.adminPortalCopy}><Text style={styles.adminPortalEyebrow}>IPORDISE TEAM · STAFF ONLY</Text><Text style={styles.adminPortalTitle}>Admin dashboard</Text><Text style={styles.adminPortalText}>Manage products, orders and customer conversations in the protected web portal.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open secure admin dashboard" onPress={openDashboard} style={({pressed})=>[styles.adminPortalButton,pressed&&styles.pressed]}><Ionicons name="open-outline" size={17} color="#171310"/></Pressable></View>;
}

function AccountPage({onShop,bottomInset}:{onShop:(filter:string)=>void;bottomInset:number}) {
  const layout=useResponsiveLayout();
  const {bagCount}=useBagSnapshot();
  const {favouriteIds}=useFavouriteSnapshot();
  const [mode,setMode]=useState<'signin'|'create'>('signin');
  const [email, setEmail] = useState('');
  const [emailFocused,setEmailFocused]=useState(false);
  const [emailError,setEmailError]=useState('');
  const [linkSent,setLinkSent]=useState(false);
  const [emailLoading,setEmailLoading]=useState(false);
  const submitEmail=async()=>{if(!isValidEmail(email)){setEmailError('Enter a complete email address.');setLinkSent(false);return;}setEmailLoading(true);setEmailError('');setLinkSent(false);try{await requestMagicLink(email);setEmail(normalizeEmail(email));setLinkSent(true);}catch(error){setEmailError(error instanceof Error?error.message:'Secure sign-in is temporarily unavailable.');}finally{setEmailLoading(false);}};
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.accountScroll,{paddingBottom:bottomInset+32}]}><ResponsiveContainer maxWidth={620} style={styles.accountContainer}>
    <View style={[styles.accountLuxuryHero,layout.compact&&{padding:16,minHeight:330}]}><LinearGradient colors={['#321017','#130c0d','#090808']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><View style={styles.accountLuxuryGlow}/><View style={styles.accountLuxuryBrand}><Brand light compact={layout.compact}/><View style={styles.accountLuxurySecure}><Ionicons name="shield-checkmark" size={12} color="#9ce1b7"/><Text style={styles.accountLuxurySecureText}>PRIVATE & SECURE</Text></View></View><View style={styles.accountLuxuryRule}/><Text style={styles.accountLuxuryEyebrow}>YOUR IPORDISE · MOROCCO</Text><Text style={[styles.accountLuxuryTitle,layout.compact&&{fontSize:29,lineHeight:33}]}>Your private{`\n`}beauty space.</Text><Text style={styles.accountLuxuryText}>Save signatures, follow orders and enjoy a more personal boutique experience.</Text><View style={styles.accountLuxuryStats}><View style={styles.accountLuxuryStat}><Ionicons name="bag-handle-outline" size={17} color="#ff7997"/><Text style={styles.accountLuxuryStatValue}>{bagCount}</Text><Text style={styles.accountLuxuryStatLabel}>IN BAG</Text></View><View style={styles.accountLuxuryStatDivider}/><View style={styles.accountLuxuryStat}><Ionicons name="heart-outline" size={17} color="#ff7997"/><Text style={styles.accountLuxuryStatValue}>{favouriteIds.size}</Text><Text style={styles.accountLuxuryStatLabel}>SAVED</Text></View><View style={styles.accountLuxuryStatDivider}/><View style={styles.accountLuxuryStat}><Ionicons name="gift-outline" size={17} color="#ff7997"/><Text style={styles.accountLuxuryStatValue}>PRIVÉ</Text><Text style={styles.accountLuxuryStatLabel}>ACCESS</Text></View></View></View>
    <View style={[styles.accountAccessCard,styles.accountAccessCardUpgraded]}>
      <View style={styles.accountAccessTopline}><View style={styles.accountAccessStatus}><View style={styles.accountAccessStatusDot}/><Text style={styles.accountAccessStatusText}>SECURE MEMBER ACCESS</Text></View><View style={styles.accountAccessSeal}><Ionicons name="shield-checkmark" size={13} color="#176b43"/><Text style={styles.accountAccessSealText}>PROTECTED</Text></View></View>
      <View style={[styles.accountModeSwitch,styles.accountModeSwitchUpgraded]}>{ACCOUNT_MODES.map(item=><Pressable accessibilityRole="tab" accessibilityState={{selected:mode===item}} key={item} onPress={()=>{setMode(item);setEmailError('');setLinkSent(false);}} style={[styles.accountModeTab,styles.accountModeTabUpgraded,mode===item&&styles.accountModeTabActive]}><Text style={[styles.accountModeText,styles.accountModeTextUpgraded,mode===item&&styles.accountModeTextActive]}>{item==='signin'?'SIGN IN':'CREATE ACCOUNT'}</Text>{mode===item?<View style={styles.accountModeIndicator}/>:null}</Pressable>)}</View>
      <View style={styles.accountAccessHeading}><View style={[styles.accountAccessIcon,styles.accountAccessIconUpgraded]}><Ionicons name={mode==='signin'?'key-outline':'person-add-outline'} size={21} color={RED}/></View><View style={{flex:1}}><Text style={styles.accountAccessEyebrow}>{mode==='signin'?'WELCOME BACK':'NEW TO IPORDISE'}</Text><Text style={[styles.accountAccessTitle,styles.accountAccessTitleUpgraded]}>{mode==='signin'?'Continue securely.':'Create your private space.'}</Text></View></View>
      <Text style={[styles.accountAccessIntro,styles.accountAccessIntroUpgraded]}>{mode==='signin'?'Enter your email and we’ll send a private one-time link—no password needed.':'Create your account with one secure email link—no password or long registration form.'}</Text>
      <View style={styles.accountFieldLabelRow}><Text style={styles.formLabel}>EMAIL ADDRESS</Text><Text style={styles.accountFieldRequired}>REQUIRED</Text></View>
      <View style={[styles.formInputWrap,styles.accountAccessInput,styles.accountAccessInputUpgraded,emailFocused&&styles.formInputWrapFocused,!!emailError&&styles.formInputWrapError]}><View style={[styles.accountInputIcon,styles.accountInputIconUpgraded]}><Ionicons name="mail-outline" size={18} color={emailError?RED:emailFocused?'#171310':'#776d67'}/></View><TextInput accessibilityLabel="Email address" accessibilityHint="Enter your email to receive a secure access link" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={(value)=>{setEmail(value);setEmailError('');setLinkSent(false);}} onFocus={()=>setEmailFocused(true)} onBlur={()=>setEmailFocused(false)} onSubmitEditing={submitEmail} placeholder="name@example.com" placeholderTextColor="#91867f" style={styles.formInput}/>{email.length>0?<Pressable accessibilityRole="button" accessibilityLabel="Clear email" onPress={()=>{setEmail('');setEmailError('');setLinkSent(false);}} style={styles.accountInputClear}><Ionicons name="close" size={14} color="#756b65"/></Pressable>:null}</View>
      {emailError?<View style={styles.formInlineMessage}><Ionicons name="alert-circle-outline" size={13} color={RED}/><Text style={styles.formErrorText}>{emailError}</Text></View>:<View style={styles.accountPrivacyHint}><Ionicons name="lock-closed-outline" size={11} color="#65736a"/><Text style={styles.accountPrivacyHintText}>Your email stays private and is used only for secure access.</Text></View>}
      <Pressable accessibilityRole="button" accessibilityState={{disabled:linkSent||emailLoading,busy:emailLoading}} accessibilityLabel={mode==='signin'?'Send my secure sign-in link':'Create my account securely'} disabled={linkSent||emailLoading} onPress={submitEmail} style={({pressed})=>[styles.signInButton,styles.accountAccessButton,styles.accountAccessButtonUpgraded,linkSent&&styles.signInButtonSent,emailLoading&&styles.signInButtonLoading,pressed&&styles.pressed]}><LinearGradient pointerEvents="none" colors={linkSent?['#176b43','#125637']:['#e31b46','#b80f32']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><Text style={[styles.signInText,styles.signInTextUpgraded]}>{emailLoading?'SENDING SECURE LINK…':linkSent?'LINK SENT — CHECK YOUR INBOX':mode==='signin'?'SEND MY SECURE LINK':'CREATE MY ACCOUNT'}</Text><View style={[styles.signInArrow,styles.signInArrowUpgraded]}><Ionicons name={emailLoading?'ellipsis-horizontal':linkSent?'checkmark':'arrow-forward'} size={18} color="#fff"/></View></Pressable>
      {linkSent?<View accessibilityRole="alert" style={styles.formSuccess}><View style={styles.formSuccessIcon}><Ionicons name="mail-open-outline" size={17} color="#176b43"/></View><View style={{flex:1}}><Text style={styles.formSuccessTitle}>{mode==='signin'?'Your sign-in link is ready':'Your account is almost ready'}</Text><Text style={styles.formSuccessText}>Open the secure link sent to {email.trim()} to continue.</Text></View></View>:null}
      <View style={[styles.accountSecurityRow,styles.accountSecurityRowUpgraded]}>{ACCOUNT_SECURITY_ITEMS.map((item,index)=><React.Fragment key={item.title}>{index?<View style={styles.accountSecurityDivider}/>:null}<View style={[styles.accountSecurityItem,styles.accountSecurityItemUpgraded]}><View style={styles.accountSecurityIcon}><Ionicons name={item.icon} size={14} color="#176b43"/></View><Text style={styles.accountSecurityTitle}>{item.title}</Text><Text style={styles.accountSecurityDescription}>{item.text}</Text></View></React.Fragment>)}</View>
      <View style={styles.accountLegalRow}><Ionicons name="information-circle-outline" size={12} color="#968b84"/><Text style={[styles.formLegal,styles.formLegalUpgraded]}>By continuing, you agree to the IPORDISE privacy and shopping terms.</Text></View>
    </View>
    <View style={styles.accountExperience}><View style={styles.accountExperienceHead}><View><Text style={styles.accountEyebrow}>MEMBER EXPERIENCE</Text><Text style={styles.accountExperienceTitle}>Everything, beautifully together.</Text></View><View style={styles.accountExperienceBadge}><PriveMark/></View></View>{[{icon:'heart-outline',title:'Your private edit',text:'Keep every fragrance you love in one place.'},{icon:'cube-outline',title:'Order history',text:'Follow purchases and delivery progress securely.'},{icon:'ticket-outline',title:'Privé access',text:'Discover selected offers and early arrivals.'}].map((item,index)=><View key={item.title} style={styles.accountExperienceRow}><Text style={styles.accountExperienceNumber}>0{index+1}</Text><View style={styles.accountExperienceIcon}><Ionicons name={item.icon as any} size={18} color={RED}/></View><View style={{flex:1}}><Text style={styles.accountExperienceRowTitle}>{item.title}</Text><Text style={styles.accountExperienceRowText}>{item.text}</Text></View><Ionicons name="checkmark-circle-outline" size={17} color="#176b43"/></View>)}<Pressable accessibilityRole="button" onPress={()=>onShop('')} style={styles.accountExplore}><Text style={styles.accountExploreText}>EXPLORE THE BOUTIQUE</Text><Ionicons name="arrow-forward" size={16} color="#fff"/></Pressable></View>
    <AdminPortalCard/>
  </ResponsiveContainer></ScrollView></KeyboardAvoidingView>;
}

function TabPage({ tab,onShop,onBoutique,onOpenProduct,onWishlist,onBag,onHelp,helpDestination,accountOrderId,onAccountOrderHandled,bottomInset }: { tab: string;onShop:(intent:ShopBrowseIntent)=>void;onBoutique:()=>void;onOpenProduct:(product:Product,products:Product[])=>void;onWishlist:()=>void;onBag:()=>void;onHelp:(destination?:'track')=>void;helpDestination:HelpDestination;accountOrderId?:string|null;onAccountOrderHandled?:()=>void;bottomInset:number }) {
  if (tab === 'Offers') return <OffersScreen fallbackProducts={[]} onOpenProduct={onOpenProduct} onExplore={onBoutique} bottomInset={bottomInset}/>;
  if (tab === 'Shop'||tab === 'Categories') return <ShopScreen fallbackProducts={[]} onBrowse={onShop} onOpenProduct={onOpenProduct} onWishlist={onWishlist} onBag={onBag} bottomInset={bottomInset}/>;
  if (tab === 'Help') return <HelpPage initialDestination={helpDestination} onShop={filter=>onShop({filter})} onOpenProduct={onOpenProduct} bottomInset={bottomInset}/>;
  return <CustomerAccountScreen initialOrderId={accountOrderId} onInitialOrderHandled={onAccountOrderHandled} onShop={filter=>onShop({filter})} onWishlist={onWishlist} onBag={onBag} onHelp={onHelp} bottomInset={bottomInset}/>;
}

function BagFlight() {
  const lastAdded=useLastAdded();
  const layout=useResponsiveLayout();
  const progress=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    if(!lastAdded)return;
    progress.setValue(0);
    const animation=Animated.sequence([
      Animated.timing(progress,{toValue:.14,duration:120,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'}),
      Animated.timing(progress,{toValue:1,duration:720,easing:Easing.inOut(Easing.cubic),useNativeDriver:Platform.OS!=='web'}),
    ]);
    animation.start();
    return()=>animation.stop();
  },[lastAdded,progress]);
  if(!lastAdded)return null;
  const origin=lastAdded.origin;
  const startX=origin?origin.x+origin.width/2:layout.width*.28;
  const startY=origin?origin.y+origin.height/2:layout.height*.58;
  const targetX=layout.width-42;
  const targetY=34;
  const deltaX=targetX-startX;
  const deltaY=targetY-startY;
  return <Animated.View pointerEvents="none" style={[styles.bagFlight,{left:startX-38,top:startY-38,opacity:progress.interpolate({inputRange:[0,.04,.84,1],outputRange:[0,1,1,0]}),transform:[{translateX:progress.interpolate({inputRange:[0,.42,1],outputRange:[0,deltaX*.42,deltaX]})},{translateY:progress.interpolate({inputRange:[0,.32,1],outputRange:[0,deltaY*.32-76,deltaY]})},{scale:progress.interpolate({inputRange:[0,.14,.72,1],outputRange:[.82,1.08,.5,.16]})},{rotate:progress.interpolate({inputRange:[0,.55,1],outputRange:['-5deg','7deg','0deg']})}]}]}><View style={styles.bagFlightGlow}/><Image source={lastAdded.product.image} resizeMode="contain" style={styles.bagFlightImage}/><View style={styles.bagFlightCheck}><Ionicons name="checkmark" size={13} color="#fff"/></View></Animated.View>;
}

type CommercePage='store'|'wishlist'|'bag'|'checkout'|'thankyou';

function IosEdgeBackGesture({enabled,onBack}:{enabled:boolean;onBack:()=>boolean}) {
  const onBackRef=useRef(onBack);
  onBackRef.current=onBack;
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>enabled,
    onMoveShouldSetPanResponder:(_,gesture)=>enabled&&gesture.dx>7&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.35,
    onPanResponderRelease:(_,gesture)=>{if(gesture.dx>64&&gesture.vx>.12)onBackRef.current();},
    onPanResponderTerminationRequest:()=>true,
  }),[enabled]);
  if(Platform.OS!=='ios'||!enabled)return null;
  return <View accessibilityElementsHidden pointerEvents="box-only" {...responder.panHandlers} style={styles.iosBackGestureEdge}/>;
}

function StoreShell() {
  const {nav,language,rtl}=useLanguage();
  const {session,ready:authReady,authCompletionId}=useCustomerAuth();
  const {pendingProductId,clearPendingProduct,setPromptEligible}=usePushNotifications();
  const previewCommercePage = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('page') : null;
  const previewTab = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('tab') : null;
  const previewFilter = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('filter') || '' : '';
  const previewQuery = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('search') || '' : '';
  const previewBrand = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('brand') || '' : '';
  const previewHelpDestination = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' ? new URLSearchParams(globalThis.location.search).get('destination') : null;
  const [active, setActive] = useState(previewTab==='offers'?'Offers':previewTab==='help'?'Help':previewTab==='account'?'Account':previewTab==='shop'||previewTab==='categories'?'Shop':'Home');
  const [homeFilter,setHomeFilter]=useState(previewFilter);
  const [homeQuery,setHomeQuery]=useState(previewQuery);
  const [homeBrand,setHomeBrand]=useState(previewBrand);
  const previewThankYouOrder:CompletedOrder={id:'preview-order',orderNumber:'IP-260807-82339D',subtotal:1850,deliveryFee:35,total:1885,currency:'MAD',status:'pending',createdAt:new Date().toISOString()};
  const [commercePage,setCommercePage]=useState<CommercePage>(previewCommercePage==='bag'||previewCommercePage==='wishlist'||previewCommercePage==='checkout'||(__DEV__&&previewCommercePage==='thankyou')?previewCommercePage:'store');
  const commerceHistoryRef=useRef<CommercePage[]>([]);
  const commercePageRef=useRef(commercePage);
  const [completedOrder,setCompletedOrder]=useState<CompletedOrder|null>(__DEV__&&previewCommercePage==='thankyou'?previewThankYouOrder:null);
  const [pendingProduct,setPendingProduct]=useState<Product|null>(null);
  const [tabProduct,setTabProduct]=useState<Product|null>(null);
  const [commerceProduct,setCommerceProduct]=useState<Product|null>(null);
  const commerceProductOriginRef=useRef<CommercePage>('store');
  const tabProductHistoryRef=useRef<Product[]>([]);
  const [tabRecommendations,setTabRecommendations]=useState<Product[]>([]);
  const [navigationRevision,setNavigationRevision]=useState(0);
  const [helpDestination,setHelpDestination]=useState<HelpDestination>(previewHelpDestination==='track'||previewHelpDestination==='contact'||previewHelpDestination==='delivery'||previewHelpDestination==='advice'?previewHelpDestination:'home');
  const [contextualHelpDestination,setContextualHelpDestination]=useState<HelpDestination|null>(null);
  const [deepLinkedOrderId,setDeepLinkedOrderId]=useState<string|null>(null);
  const [unavailableProductId,setUnavailableProductId]=useState<string|null>(null);
  const [protectedDestination,setProtectedDestination]=useState<'wishlist'|'checkout'|null>(null);
  const previousTabsRef=useRef<string[]>([]);
  const activeRef=useRef(active);
  const layout = useResponsiveLayout();
  useEffect(()=>{setPromptEligible(active==='Home'&&commercePage==='store'&&!tabProduct&&!contextualHelpDestination&&!unavailableProductId);},[active,commercePage,contextualHelpDestination,setPromptEligible,tabProduct,unavailableProductId]);
  const navigateTab=(next:string)=>{const current=activeRef.current;if(!recordNavigationEntry(previousTabsRef.current,current,next))return;activeRef.current=next;setActive(next);};
  const navigateCommerce=(next:CommercePage)=>{const current=commercePageRef.current;if(!recordNavigationEntry(commerceHistoryRef.current,current,next))return;commercePageRef.current=next;setCommercePage(next);};
  const openCustomerCommerce=(next:'wishlist'|'checkout')=>{
    if(session){navigateCommerce(next);return;}
    setProtectedDestination(next);
    if(Platform.OS==='web')rememberProtectedCommercePath(next);
    navigateTab('Account');
    resetCommerce();
  };
  const goBackCommerce=()=>{const previous=commerceHistoryRef.current.pop()||'store';commercePageRef.current=previous;setCommercePage(previous);};
  const resetCommerce=(next:CommercePage='store')=>{commerceHistoryRef.current=[];commercePageRef.current=next;setCommercePage(next);};
  const openTabProduct=(product:Product,recommendations=tabRecommendations)=>{setTabProduct(current=>{if(current&&current.id!==product.id)recordNavigationEntry(tabProductHistoryRef.current,current,product);return product;});if(recommendations.length)setTabRecommendations(recommendations);};
  const closeTabProduct=()=>setTabProduct(current=>{if(!current)return current;return tabProductHistoryRef.current.pop()||null;});
  const openCommerceProduct=(product:Product)=>{commerceProductOriginRef.current=commercePageRef.current;setCommerceProduct(product);};
  const openBagFromCommerceProduct=()=>{if(commerceProductOriginRef.current==='bag'){setCommerceProduct(null);return;}navigateCommerce('bag');};
  const returnToStore=()=>{setPendingProduct(null);goBackCommerce();};
  const openNavigationIntent=useCallback(async(url:string|null)=>{
    const intent=parseAppNavigationIntent(url);
    if(!intent)return;
    setUnavailableProductId(null);
    setCompletedOrder(null);
    setContextualHelpDestination(null);
    setCommerceProduct(null);
    commerceHistoryRef.current=[];
    commercePageRef.current='store';
    setCommercePage('store');
    previousTabsRef.current=[];
    if(intent.type==='order'){
      setTabProduct(null);
      tabProductHistoryRef.current=[];
      setDeepLinkedOrderId(intent.id);
      activeRef.current='Account';
      setActive('Account');
      return;
    }
    setDeepLinkedOrderId(null);
    activeRef.current='Shop';
    setActive('Shop');
    try{
      const products=await loadSharedProducts();
      const product=products.find(item=>item.id===intent.id);
      setTabRecommendations(products);
      setTabProduct(product||null);
      if(!product)setUnavailableProductId(intent.id);
      tabProductHistoryRef.current=[];
    }catch(error){logger.warn('deep_link_product_unavailable',{error,productId:intent.id});setTabProduct(null);setUnavailableProductId(intent.id);}
  },[]);
  useEffect(()=>{
    let mounted=true;
    const initialUrl=Platform.OS==='web'&&typeof globalThis.location!=='undefined'?globalThis.location.href:null;
    void (initialUrl?Promise.resolve(initialUrl):Linking.getInitialURL()).then(url=>{if(mounted)return openNavigationIntent(url);});
    const subscription=Platform.OS==='web'?null:Linking.addEventListener('url',event=>{void openNavigationIntent(event.url);});
    return()=>{mounted=false;subscription?.remove();};
  },[openNavigationIntent]);
  useEffect(()=>{
    if(!authReady||!pendingProductId)return;
    void openNavigationIntent(`ipordise://product/${encodeURIComponent(pendingProductId)}`).finally(clearPendingProduct);
  },[authReady,clearPendingProduct,openNavigationIntent,pendingProductId]);
  useEffect(()=>{
    if(!authCompletionId||Platform.OS==='web')return;
    navigateTab('Account');
    resetCommerce();
  },[authCompletionId]);
  useEffect(()=>{
    if(!authReady)return;
    if(session&&protectedDestination){
      const destination=protectedDestination;
      setProtectedDestination(null);
      if(Platform.OS==='web')clearProtectedCommercePath();
      commerceHistoryRef.current=[destination==='checkout'?'bag':'store'];
      commercePageRef.current=destination;
      setCommercePage(destination);
      return;
    }
    if(session&&commercePage==='wishlist'){
      if(Platform.OS==='web')clearProtectedCommercePath();
      return;
    }
    if(!session&&commercePage==='wishlist'){
      setProtectedDestination(commercePage);
      navigateTab('Account');
      resetCommerce();
    }
  },[authReady,commercePage,protectedDestination,session]);
  const handleAppBack=useCallback(()=>{
      if(commercePage==='thankyou'){setCompletedOrder(null);activeRef.current='Home';setActive('Home');resetCommerce();return true;}
      if(commerceProduct&&commercePage===commerceProductOriginRef.current){setCommerceProduct(null);return true;}
      if(commercePage!=='store'){goBackCommerce();return true;}
      if(unavailableProductId){setUnavailableProductId(null);activeRef.current='Shop';setActive('Shop');return true;}
      if(tabProduct){closeTabProduct();return true;}
      if(contextualHelpDestination){
        if(runScopedAndroidBackAction())return true;
        setContextualHelpDestination(null);
        return true;
      }
      if(runScopedAndroidBackAction())return true;
      const previous=popPreviousNavigationEntry(previousTabsRef.current,active);
      if(previous||active!=='Home'){
        const destination=previous||'Home';
        activeRef.current=destination;
        setActive(destination);
        return true;
      }
      return false;
  },[active,commercePage,commerceProduct,contextualHelpDestination,tabProduct,unavailableProductId]);
  useEffect(()=>{
    if(Platform.OS!=='android')return;
    const subscription=BackHandler.addEventListener('hardwareBackPress',handleAppBack);
    return()=>subscription.remove();
  },[handleAppBack]);
  const baseStoreBody=active === 'Home' ? <HomeContent key={`${homeFilter}|${homeQuery}|${homeBrand}|${navigationRevision}|${pendingProduct?.id||''}`} initialFilter={homeFilter} initialQuery={homeQuery} initialBrand={homeBrand} initialProduct={pendingProduct} onOpenWishlist={()=>openCustomerCommerce('wishlist')} onOpenBag={()=>navigateCommerce('bag')}/> : <TabPage key={`${active}|${navigationRevision}`} tab={active} helpDestination={helpDestination} accountOrderId={deepLinkedOrderId} onAccountOrderHandled={()=>setDeepLinkedOrderId(null)} bottomInset={layout.bottomNavHeight} onOpenProduct={(product,products)=>openTabProduct(product,products)} onWishlist={()=>openCustomerCommerce('wishlist')} onBag={()=>navigateCommerce('bag')} onHelp={(destination)=>{if(destination&&activeRef.current==='Account'){setContextualHelpDestination(destination);return;}setHelpDestination(destination||'home');navigateTab('Help');resetCommerce();}} onBoutique={()=>{setTabProduct(null);tabProductHistoryRef.current=[];setPendingProduct(null);navigateTab('Shop');resetCommerce();}} onShop={(intent)=>{const normalized=typeof intent==='string'?{filter:intent}:intent;setTabProduct(null);tabProductHistoryRef.current=[];setHomeFilter(normalized.filter||'');setHomeBrand(normalized.brand||'');setHomeQuery(normalized.query||normalized.brand||'');navigateTab('Home');resetCommerce();if(Platform.OS==='web'&&typeof globalThis.location!=='undefined'){const params=new URLSearchParams({store:'1'});if(normalized.filter)params.set('filter',normalized.filter);if(normalized.query)params.set('search',normalized.query);if(normalized.brand)params.set('brand',normalized.brand);(globalThis as any).history?.pushState({},'',`${globalThis.location.pathname}?${params}`);}}}/>;
  const unavailableCopy=language==='fr'?{title:'Ce produit n’est plus disponible.',body:'Il a peut-être été retiré ou momentanément dépublié.',action:'Explorer les produits'}:language==='ar'?{title:'هذا المنتج لم يعد متاحاً.',body:'ربما تمت إزالته أو إيقاف نشره مؤقتاً.',action:'استكشف المنتجات'}:{title:'This product is no longer available.',body:'It may have been removed or temporarily unpublished.',action:'Explore products'};
  const unavailableOverlay=unavailableProductId?<View accessibilityRole="alert" style={styles.unavailableProduct}><View style={styles.unavailableProductIcon}><Ionicons name="sparkles-outline" size={25} color={RED}/></View><Text style={[styles.unavailableProductTitle,rtl&&styles.rtlText]}>{unavailableCopy.title}</Text><Text style={[styles.unavailableProductBody,rtl&&styles.rtlText]}>{unavailableCopy.body}</Text><Pressable accessibilityRole="button" onPress={()=>{setUnavailableProductId(null);activeRef.current='Shop';setActive('Shop');}} style={styles.unavailableProductButton}><Text style={styles.unavailableProductButtonText}>{unavailableCopy.action}</Text><Ionicons name={rtl?'arrow-back':'arrow-forward'} size={16} color="#fff"/></Pressable></View>:null;
  const storeOverlay=tabProduct?<ProductDetail product={tabProduct} recommendations={tabRecommendations} onBack={closeTabProduct} onOpenBag={()=>navigateCommerce('bag')} onSelectProduct={product=>openTabProduct(product)}/>:unavailableOverlay?unavailableOverlay:contextualHelpDestination?<HelpPage initialDestination={contextualHelpDestination} onExit={()=>setContextualHelpDestination(null)} onShop={filter=>{setContextualHelpDestination(null);setHomeFilter(filter);navigateTab('Home');}} onOpenProduct={(product,products)=>{setContextualHelpDestination(null);openTabProduct(product,products);}} bottomInset={layout.bottomNavHeight}/>:null;
  const storeBody=<View style={styles.storeLayer}><View pointerEvents={storeOverlay?'none':'auto'} style={[styles.storeLayer,storeOverlay&&styles.storeLayerHidden]}>{baseStoreBody}</View>{storeOverlay?<View style={styles.commerceLayer}>{storeOverlay}</View>:null}</View>;
  let commerceBody:React.ReactNode=null;
  if(commercePage==='wishlist')commerceBody=<WishlistPage onBack={returnToStore} onBag={()=>navigateCommerce('bag')} onProduct={openCommerceProduct}/>;
  else if(commercePage==='bag')commerceBody=<BagPage onBack={returnToStore} onCheckout={()=>navigateCommerce('checkout')} onProduct={openCommerceProduct}/>;
  else if(commercePage==='checkout')commerceBody=<CheckoutPage onBack={goBackCommerce} onComplete={order=>{setCompletedOrder(order);resetCommerce('thankyou');}}/>;
  else if(commercePage==='thankyou'&&completedOrder)commerceBody=<ThankYouPage order={completedOrder} onTrack={()=>{setCompletedOrder(null);setHelpDestination('track');activeRef.current='Help';setActive('Help');resetCommerce();}} onContinue={()=>{setCompletedOrder(null);activeRef.current='Home';setActive('Home');resetCommerce();}}/>;
  return <SafeAreaView style={styles.storeSafe} edges={['top','bottom']}><StatusBar style="dark" />
    <View style={styles.screenBody}><View pointerEvents={commercePage==='store'?'auto':'none'} style={[styles.storeLayer,commercePage!=='store'&&styles.storeLayerHidden]}>{storeBody}</View>{commerceBody?<View style={styles.commerceLayer}>{commerceBody}</View>:null}{commerceProduct&&commercePage===commerceProductOriginRef.current?<View style={styles.commerceLayer}><ProductDetail product={commerceProduct} recommendations={tabRecommendations} onBack={()=>setCommerceProduct(null)} onOpenBag={openBagFromCommerceProduct} onSelectProduct={setCommerceProduct}/></View>:null}</View>
    {commercePage==='store'&&!tabProduct&&<View style={[styles.bottomNav,{height:layout.bottomNavHeight,paddingBottom:layout.shortLandscape?2:6}]}><View style={[styles.bottomNavInner, { maxWidth: layout.tablet ? 760 : 680 }]}>{tabs.map(t => {const localizedLabel=nav[t.label.toLowerCase() as keyof typeof nav] || t.label;return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === t.label }} accessibilityLabel={localizedLabel} key={t.label} onPress={() => {setTabProduct(null);tabProductHistoryRef.current=[];setPendingProduct(null);if(t.label==='Home'){setHomeFilter('');setHomeQuery('');}if(t.label==='Help')setHelpDestination('home');if(active===t.label)setNavigationRevision(value=>value+1);navigateTab(t.label);resetCommerce();}} style={styles.tab}>
      <Ionicons name={t.icon as any} size={23} color={active === t.label ? RED : '#49433f'} /><Text numberOfLines={1} style={[styles.tabText, active === t.label && { color: RED }]}>{localizedLabel}</Text>
    </Pressable>;})}</View></View>}
    <BagFlight/>
    <IosEdgeBackGesture enabled onBack={handleAppBack}/>
  </SafeAreaView>;
}

function StoreScreen(){
  return <CustomerAuthProvider><CustomerProvider><PushNotificationProvider><ShoppingProvider><StoreShell/></ShoppingProvider></PushNotificationProvider></CustomerProvider></CustomerAuthProvider>;
}

export default function App() {
  const previewAdmin = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' && (()=>{const path=globalThis.location.pathname.replace(/\/+$/,'').toLowerCase();return path==='/admin'||path.startsWith('/admin/')||new URLSearchParams(globalThis.location.search).get('admin')==='1';})();
  const previewStore = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' && (()=>{const path=globalThis.location.pathname.replace(/\/+$/,'').toLowerCase();return path==='/app'||path.startsWith('/app/')||new URLSearchParams(globalThis.location.search).get('store') === '1';})();
  const previewSkipIntro = Platform.OS === 'web' && typeof globalThis.location !== 'undefined' && new URLSearchParams(globalThis.location.search).get('skipIntro') === '1';
  // Native already displays the OS splash and IPORDISE supports one market,
  // so enter the shop immediately instead of blocking every launch twice.
  const [entered, setEntered] = useState(Platform.OS!=='web'||previewStore);
  const [launching,setLaunching]=useState(Platform.OS==='web'&&!previewAdmin&&!previewSkipIntro);
  const finishLaunch=useCallback(()=>setLaunching(false),[]);
  useEffect(()=>{if(Platform.OS!=='web'||typeof document==='undefined')return;const id='ipordise-scrollbar-policy';if(document.getElementById(id))return;const style=document.createElement('style');style.id=id;style.textContent='*{scrollbar-width:none;-ms-overflow-style:none}*::-webkit-scrollbar{display:none;width:0;height:0}';document.head.appendChild(style);return()=>style.remove();},[]);
  return <AppErrorBoundary><LanguageProvider><SafeAreaProvider><RNStatusBar translucent backgroundColor="transparent" barStyle={launching?'light-content':'dark-content'}/>{previewAdmin?<AdminEntry/>:entered ? <StoreScreen /> : <LocationScreen onContinue={() => setEntered(true)} />}{launching?<LaunchIntro onFinish={finishLaunch}/>:null}</SafeAreaProvider></LanguageProvider></AppErrorBoundary>;
}

const homeStyles=StyleSheet.create({
  familyGuide:{height:28,borderRadius:14,backgroundColor:'#fff0f4',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5},familyGuideText:{fontSize:6.5,fontWeight:'900',letterSpacing:.85,color:RED},familyAccent:{position:'absolute',left:14,right:14,top:0,height:3,borderBottomLeftRadius:3,borderBottomRightRadius:3},familyTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},familyPhotoWrap:{width:48,height:48,borderRadius:16,overflow:'hidden',borderWidth:2,backgroundColor:'#fff',padding:2,shadowColor:'#271813',shadowOpacity:.1,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:2},familyPhoto:{width:'100%',height:'100%',borderRadius:12},familyNumber:{fontSize:7,fontWeight:'900',letterSpacing:.9,color:'rgba(37,27,23,.42)'},familyDescription:{minHeight:27,fontSize:9,lineHeight:13,color:'#756a64',marginTop:3},familyAction:{minHeight:30,marginTop:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},familyActionText:{fontSize:6.5,fontWeight:'900',letterSpacing:1},familyArrow:{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',shadowColor:'#211511',shadowOpacity:.1,shadowRadius:4,shadowOffset:{width:0,height:2},elevation:2},
  feed:{width:'100%',alignSelf:'center',paddingTop:8,paddingBottom:34},
  pressed:{opacity:.86,transform:[{scale:.985}]},
  benefitStrip:{minHeight:40,borderRadius:14,backgroundColor:'#eef7f1',borderWidth:1,borderColor:'#d8eadf',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},
  benefitIcon:{width:28,height:28,borderRadius:10,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  benefitText:{flex:1,minWidth:0,fontSize:11,lineHeight:15,fontWeight:'800',color:'#285c42'},
  benefitDots:{flexDirection:'row',gap:3},benefitDot:{width:4,height:4,borderRadius:2,backgroundColor:'#aec8b8'},benefitDotActive:{width:12,backgroundColor:'#176b43'},
  catalogStatus:{minHeight:36,marginTop:7,borderRadius:12,backgroundColor:'#f2f7f4',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7},
  catalogStatusError:{backgroundColor:'#fff0f3'},catalogStatusText:{flex:1,fontSize:9,lineHeight:13,color:'#456453'},catalogStatusTextError:{color:'#7a3343'},
  promotionSection:{marginTop:28,marginHorizontal:-4,borderRadius:26,overflow:'hidden',paddingTop:18,paddingBottom:14,shadowColor:'#2a0810',shadowOpacity:.24,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:6},
  promotionGlow:{position:'absolute',right:-46,top:-58,width:176,height:176,borderRadius:88,backgroundColor:'rgba(215,25,63,.18)'},
  promotionHeader:{paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},promotionHeadingCopy:{flex:1,minWidth:0},promotionLiveRow:{flexDirection:'row',alignItems:'center',gap:6},promotionLiveDot:{width:6,height:6,borderRadius:3,backgroundColor:'#ff4268'},promotionEyebrow:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.35,color:'#ff8ba3'},promotionTitle:{fontFamily:'serif',fontSize:25,lineHeight:29,fontWeight:'700',letterSpacing:-.3,color:'#fff',marginTop:4},promotionSubtitle:{fontSize:9,lineHeight:14,color:'rgba(255,255,255,.65)',marginTop:3,maxWidth:340},
  promotionTimer:{minWidth:124,borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,.16)',backgroundColor:'rgba(255,255,255,.08)',paddingHorizontal:10,paddingVertical:8,alignItems:'center'},promotionTimerLabel:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:1.25,color:'rgba(255,255,255,.56)',marginBottom:4},promotionTimerUnits:{flexDirection:'row',alignItems:'flex-start'},promotionTimerUnit:{minWidth:27,alignItems:'center'},promotionTimerValue:{fontSize:15,lineHeight:18,fontWeight:'900',fontVariant:['tabular-nums'],color:'#fff'},promotionTimerUnitLabel:{fontSize:4.5,lineHeight:7,fontWeight:'900',letterSpacing:.75,color:'#ff8ba3'},promotionTimerColon:{fontSize:14,lineHeight:18,fontWeight:'900',color:'rgba(255,255,255,.52)'},promotionTimerLive:{fontSize:16,lineHeight:20,fontWeight:'900',letterSpacing:1.3,color:'#fff'},
  promotionRail:{paddingHorizontal:16,paddingTop:18,paddingBottom:9,gap:12},promotionCardWrap:{position:'relative',paddingTop:7},promotionCardBadge:{position:'absolute',zIndex:2,left:9,top:0,minHeight:22,borderRadius:11,backgroundColor:RED,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:4,shadowColor:'#25040b',shadowOpacity:.28,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:5},promotionCardBadgeText:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:.85,color:'#fff'},promotionViewAll:{minHeight:44,marginHorizontal:16,marginTop:3,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.12)',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},promotionViewAllText:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.15,color:'#fff'},
  section:{marginTop:24},productSection:{marginTop:28,marginHorizontal:-4,overflow:'hidden'},houseProductSection:{marginHorizontal:0,borderRadius:26,borderWidth:1,paddingHorizontal:14,paddingTop:16,paddingBottom:14,shadowColor:'#6e4d2b',shadowOpacity:.13,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:4},xerjoffProductSection:{backgroundColor:'#eadfce',borderColor:'#d5c09f'},uniqueProductSection:{backgroundColor:'#fbf2ed',borderColor:'#eadbd2'},houseEdition:{height:19,flexDirection:'row',alignItems:'center',gap:8,marginBottom:5},houseEditionLine:{width:26,height:1,backgroundColor:'#9b7138'},houseEditionText:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:1.35,color:'#8b6738'},houseEyebrowDark:{color:'#8d5f22'},houseTitleDark:{color:'#2b211a',fontSize:27,lineHeight:31},houseSubtitleDark:{color:'#716356',maxWidth:290,lineHeight:15},houseViewAll:{height:38,minHeight:38,borderRadius:19,borderWidth:1,borderColor:'rgba(130,106,96,.25)',paddingHorizontal:11},houseViewAllDark:{borderColor:'#b89a69',backgroundColor:'rgba(255,253,248,.58)'},houseViewAllTextDark:{color:'#3b2b1e'},houseProductRail:{paddingHorizontal:0,paddingTop:17,paddingBottom:9},houseRailFooter:{height:28,marginTop:2,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},houseRailFooterText:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:1.15,color:'#88745d'},houseRailProgress:{flexDirection:'row',alignItems:'center',gap:4},houseRailProgressActive:{width:24,height:3,borderRadius:2,backgroundColor:'#9b7138'},houseRailProgressDot:{width:5,height:3,borderRadius:2,backgroundColor:'rgba(91,65,38,.2)'},ourProductsSection:{marginTop:32,marginHorizontal:-4},
  compactSectionHead:{paddingHorizontal:4,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12},
  sectionHead:{paddingHorizontal:4,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12},sectionHeadingCopy:{flex:1,minWidth:0},
  sectionEyebrow:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:1.35,color:RED},
  sectionTitle:{fontFamily:'serif',fontSize:25,lineHeight:30,fontWeight:'700',letterSpacing:-.3,color:'#171310',marginTop:3},
  sectionSubtitle:{fontSize:11,lineHeight:16,color:'#786e68',marginTop:2},sectionMeta:{fontSize:8,fontWeight:'900',letterSpacing:1.1,color:'#8c817a'},
  rtlHeading:{fontFamily:Platform.OS==='web'?'Tahoma, Arial, sans-serif':undefined,textAlign:'right',writingDirection:'rtl',letterSpacing:0,lineHeight:34},
  rtlCopy:{textAlign:'right',writingDirection:'rtl',letterSpacing:0},
  categoryRail:{paddingHorizontal:4,paddingTop:14,paddingBottom:4,gap:9},
  categoryCard:{width:132,minHeight:166,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3dad5',padding:10,justifyContent:'space-between',shadowColor:'#2a1c18',shadowOpacity:.07,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:2},
  categoryCardActive:{backgroundColor:'#2b1017',borderColor:'#2b1017'},categoryIcon:{width:39,height:39,borderRadius:13,backgroundColor:'#f7e9ed',alignItems:'center',justifyContent:'center'},categoryIconActive:{backgroundColor:'rgba(255,255,255,.13)'},
  categoryImageWrap:{width:'100%',height:92,borderRadius:14,overflow:'hidden',backgroundColor:'#f7f0eb'},categoryImage:{width:'100%',height:'100%'},
  categoryLabel:{fontSize:11,lineHeight:14,fontWeight:'900',color:'#211a17',marginTop:9},categoryLabelActive:{color:'#fff'},categoryCount:{fontSize:8,lineHeight:11,color:'#8a7f78',marginTop:2},categoryCountActive:{color:'rgba(255,255,255,.64)'},
  heroSection:{marginTop:24,overflow:'hidden'},heroRail:{gap:10},heroCard:{borderRadius:24,overflow:'hidden',backgroundColor:'#181011',justifyContent:'flex-end',shadowColor:'#1d0d11',shadowOpacity:.18,shadowRadius:14,shadowOffset:{width:0,height:7},elevation:5},heroImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},
  heroTop:{position:'absolute',left:18,right:18,top:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heroLive:{minHeight:27,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,.22)',backgroundColor:'rgba(0,0,0,.24)',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:6},heroLiveDot:{width:5,height:5,borderRadius:3,backgroundColor:'#ff476d'},heroLiveText:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:.85,color:'#fff'},heroCounter:{fontSize:8,lineHeight:11,fontWeight:'900',color:'#fff'},
  heroCopy:{padding:20,maxWidth:520},heroEyebrow:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:1.35,color:'#ff89a3'},heroTitle:{fontFamily:'serif',fontSize:31,lineHeight:35,fontWeight:'700',letterSpacing:-.5,color:'#fff',marginTop:5,maxWidth:'82%'},heroDescription:{fontSize:11,lineHeight:17,color:'rgba(255,255,255,.78)',marginTop:6,maxWidth:'80%'},heroCta:{minHeight:48,alignSelf:'flex-start',borderRadius:24,backgroundColor:'#fff',paddingHorizontal:17,marginTop:15,flexDirection:'row',alignItems:'center',gap:13},heroCtaText:{fontSize:11,lineHeight:14,fontWeight:'900',color:'#171310'},
  heroDots:{minHeight:28,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},heroDot:{width:7,height:4,borderRadius:2,backgroundColor:'#cfc5bf'},heroDotActive:{width:25,backgroundColor:RED},
  viewAll:{minHeight:44,paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:5},viewAllText:{fontSize:10,lineHeight:14,fontWeight:'900',color:'#171310'},productRail:{paddingHorizontal:4,paddingTop:15,paddingBottom:8,gap:12},dailyEditLabel:{flexDirection:'row',alignItems:'center',gap:5},dailyEditMeta:{minHeight:28,paddingHorizontal:9,borderRadius:14,backgroundColor:'#fff1f4',borderWidth:1,borderColor:'#f1d6dc',flexDirection:'row',alignItems:'center',gap:5},ourProductsCount:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:1,color:'#6b1f31'},ourProductsGrid:{width:'100%',paddingHorizontal:4,paddingTop:15,flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},showMoreButton:{minHeight:64,borderRadius:18,borderWidth:1,borderColor:'#dfdcda',backgroundColor:'#f4f3f2',paddingLeft:10,paddingRight:8,paddingVertical:8,marginHorizontal:4,marginTop:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',shadowColor:'#171310',shadowOpacity:.05,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2},showMorePressed:{backgroundColor:'#eae8e6',borderColor:'#d3cfcc',transform:[{scale:.995}]},showMoreLeading:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:10},showMoreMark:{width:42,height:42,borderRadius:13,backgroundColor:'#e5e3e1',borderWidth:1,borderColor:'#d8d5d2',alignItems:'center',justifyContent:'center'},showMoreText:{fontSize:11,lineHeight:15,fontWeight:'900',letterSpacing:.1,color:'#292624'},showMoreMeta:{fontSize:7,lineHeight:11,fontWeight:'600',color:'#827b76',marginTop:2},showMoreIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#55514e',alignItems:'center',justifyContent:'center',shadowColor:'#171310',shadowOpacity:.1,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:1},allProductsShown:{height:46,marginTop:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},allProductsShownText:{fontSize:7,fontWeight:'900',letterSpacing:.8,color:'#176b43'},
  seasonal:{height:206,marginTop:28,borderRadius:22,overflow:'hidden',backgroundColor:'#f3dfc2',borderWidth:1,borderColor:'#ead4b7',shadowColor:'#5d3a20',shadowOpacity:.07,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:2},seasonalImage:{width:'100%',height:'100%'},seasonalCopy:{position:'absolute',left:20,top:20,bottom:18,width:'58%',justifyContent:'center'},seasonalTitle:{fontFamily:'serif',fontSize:27,lineHeight:31,fontWeight:'700',color:'#241913',marginTop:4},seasonalText:{fontSize:10,lineHeight:15,color:'#6f5a4c',marginTop:5},seasonalCta:{minHeight:44,alignSelf:'flex-start',borderBottomWidth:1,borderBottomColor:'#171310',flexDirection:'row',alignItems:'center',gap:9,marginTop:8},seasonalCtaText:{fontSize:10,fontWeight:'900',color:'#171310'},
  familyRail:{gap:10,marginTop:14,paddingHorizontal:2,paddingBottom:10},familyCard:{minWidth:102,height:174,borderRadius:18,borderWidth:1,borderColor:'#e2d9d4',backgroundColor:'#fff',padding:12,justifyContent:'space-between'},familyCardDark:{backgroundColor:'#361019',borderColor:'#361019'},familyIcon:{width:34,height:34,borderRadius:12,backgroundColor:'#f6e8ec',alignItems:'center',justifyContent:'center'},familyIconDark:{backgroundColor:'rgba(255,255,255,.13)'},familyLabel:{fontSize:12,lineHeight:15,fontWeight:'900',color:'#211a17'},familyLabelDark:{color:'#fff'},
  brandSection:{marginTop:30,marginHorizontal:-4,paddingTop:4,paddingBottom:4,overflow:'hidden'},brandSimpleHeader:{minHeight:42,alignItems:'center',justifyContent:'center'},brandSimpleTitle:{fontSize:19,lineHeight:24,fontWeight:'800',letterSpacing:-.25,color:'#171310',textAlign:'center'},brandRail:{paddingHorizontal:4,paddingTop:8,paddingBottom:8,gap:9},brandCard:{height:64,borderRadius:2,borderWidth:1.15,borderColor:'#292523',backgroundColor:'#fff',paddingHorizontal:15,paddingVertical:12,alignItems:'center',justifyContent:'center',overflow:'hidden'},brandLogo:{width:'100%',height:'100%'},
  homeNewsletter:{marginTop:28,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e1e1e4',padding:18,shadowColor:'#2b181c',shadowOpacity:.06,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},homeNewsletterIntro:{flexDirection:'row',alignItems:'flex-start',gap:12},homeNewsletterMark:{width:40,height:40,borderRadius:12,backgroundColor:'#24161a',alignItems:'center',justifyContent:'center'},homeNewsletterCopy:{flex:1,minWidth:0},homeNewsletterKicker:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.25,color:RED},homeNewsletterTitle:{fontFamily:'serif',fontSize:22,lineHeight:26,fontWeight:'700',letterSpacing:-.25,color:'#211719',marginTop:3},homeNewsletterText:{fontSize:9.5,lineHeight:14,color:'#706d72',marginTop:3,maxWidth:390},homeNewsletterDivider:{height:1,backgroundColor:'#e8e8eb',marginTop:16,marginBottom:14},homeNewsletterLabel:{fontSize:6.5,lineHeight:10,fontWeight:'900',letterSpacing:1.15,color:'#555258',marginBottom:7},homeNewsletterForm:{minHeight:56,borderRadius:15,borderWidth:1,borderColor:'#d5d5da',backgroundColor:'#fff',paddingLeft:13,paddingRight:5,flexDirection:'row',alignItems:'center',gap:8},homeNewsletterFormFocused:{borderColor:'#555158',backgroundColor:'#fff',shadowColor:'#242126',shadowOpacity:.06,shadowRadius:5,shadowOffset:{width:0,height:2}},homeNewsletterFormError:{borderColor:RED},homeNewsletterFormSuccess:{borderColor:'#b7d8c6',backgroundColor:'#fbfefc'},homeNewsletterInput:{flex:1,minWidth:0,height:52,paddingVertical:0,fontSize:12,color:'#211f22',backgroundColor:'transparent',outlineStyle:'none' as any},homeNewsletterButton:{height:46,minWidth:72,borderRadius:12,backgroundColor:'#24161a',paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},homeNewsletterButtonSuccess:{backgroundColor:'#176b43'},homeNewsletterButtonText:{fontSize:7.5,fontWeight:'900',letterSpacing:.9,color:'#fff'},homeNewsletterError:{fontSize:9,lineHeight:13,color:RED,marginTop:7},homeNewsletterSuccess:{minHeight:58,marginTop:10,borderRadius:13,borderWidth:1,borderColor:'#cfe6d8',backgroundColor:'#f2faf5',paddingHorizontal:11,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:10},homeNewsletterSuccessIcon:{width:28,height:28,borderRadius:14,backgroundColor:'#176b43',alignItems:'center',justifyContent:'center'},homeNewsletterSuccessCopy:{flex:1,minWidth:0},homeNewsletterSuccessTitle:{fontSize:11,lineHeight:15,fontWeight:'900',color:'#145c3a'},homeNewsletterSuccessText:{fontSize:8.5,lineHeight:12,color:'#49705b',marginTop:1},homeNewsletterPrivacy:{flexDirection:'row',alignItems:'center',gap:5,marginTop:9},homeNewsletterPrivacyText:{fontSize:7.5,lineHeight:11,color:'#7d7a80'},
  resultsHeader:{marginTop:24,marginBottom:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},resultsClose:{width:44,height:44,borderRadius:22,backgroundColor:'#fff',borderWidth:1,borderColor:'#e1d8d3',alignItems:'center',justifyContent:'center'},resultsRow:{justifyContent:'space-between',gap:10,marginBottom:10},emptyResults:{minHeight:360,alignItems:'center',justifyContent:'center',paddingHorizontal:24},emptyResultsTitle:{fontFamily:'serif',fontSize:23,lineHeight:28,fontWeight:'700',color:'#171310',marginTop:12},emptyResultsText:{fontSize:11,lineHeight:17,color:'#7c716b',textAlign:'center',marginTop:5},emptyResultsButton:{minHeight:48,borderRadius:24,backgroundColor:'#171310',paddingHorizontal:20,alignItems:'center',justifyContent:'center',marginTop:16},emptyResultsButtonText:{fontSize:10,fontWeight:'900',color:'#fff'},
  searchPageScroll:{paddingBottom:110,backgroundColor:'#fff'},searchVirtualRoot:{flex:1,minHeight:0,overflow:'hidden',backgroundColor:'#fff'},searchVirtualPage:{flex:1,minHeight:0,overflow:'hidden'},searchPinnedHeader:{zIndex:5,flexShrink:0,backgroundColor:'#fff'},searchVirtualBody:{flex:1,minHeight:0},searchVirtualList:{paddingBottom:110},searchPage:{width:'100%',alignSelf:'center',paddingTop:22,boxSizing:'border-box' as any},searchPageTop:{minHeight:70,borderBottomWidth:1,borderBottomColor:'#eee6e2',paddingBottom:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16},searchPageEyebrow:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.5,color:RED},searchPageTitle:{fontFamily:'serif',fontSize:27,lineHeight:33,fontWeight:'700',letterSpacing:-.3,color:'#171310',marginTop:4},searchPageClose:{width:42,height:42,borderRadius:21,backgroundColor:'#f7f3f1',alignItems:'center',justifyContent:'center'},searchBody:{flexDirection:'row',alignItems:'flex-start',gap:28,paddingTop:22},searchBodyMobile:{gap:0,width:'100%'},searchSidebar:{width:218,flexShrink:0,borderRightWidth:1,borderRightColor:'#eee8e4',paddingRight:22},searchFilterSection:{paddingBottom:22,marginBottom:20,borderBottomWidth:1,borderBottomColor:'#eee8e4'},searchFilterTitle:{fontSize:11,lineHeight:15,fontWeight:'900',letterSpacing:.8,color:'#211a17',marginBottom:12},searchFilterOption:{minHeight:34,flexDirection:'row',alignItems:'center',gap:9},searchCheckbox:{width:18,height:18,borderRadius:5,borderWidth:1,borderColor:'#b8aea8',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},searchCheckboxActive:{backgroundColor:RED,borderColor:RED},searchFilterLabel:{flex:1,minWidth:0,fontSize:10,lineHeight:14,color:'#3d3531'},searchFilterCount:{fontSize:9,lineHeight:13,color:'#8c817a'},searchResultsMain:{flex:1,minWidth:0,minHeight:0},searchResultsToolbar:{minHeight:43,marginBottom:14,flexShrink:0,flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},searchResultsCount:{fontSize:10,lineHeight:14,color:'#6f6560'},searchResultsCountStrong:{fontSize:12,fontWeight:'900',color:'#171310'},searchSort:{minHeight:36,borderBottomWidth:1,borderBottomColor:RED,paddingHorizontal:4,flexDirection:'row',alignItems:'center',gap:5},searchSortLabel:{fontSize:9,color:'#8a7f78'},searchSortValue:{fontSize:9,fontWeight:'900',color:'#211a17'},searchProductGrid:{width:'100%',flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},searchMobileFilters:{paddingVertical:13,gap:7},searchMobileChip:{height:36,borderRadius:18,borderWidth:1,borderColor:'#dcd4cf',backgroundColor:'#fff',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},searchMobileChipActive:{backgroundColor:'#211719',borderColor:'#211719'},searchMobileChipText:{fontSize:9,fontWeight:'800',color:'#4f4742'},searchMobileChipTextActive:{color:'#fff'},
});

const styles:Record<string,any> = StyleSheet.create({
  launchIntro:{...StyleSheet.absoluteFillObject,zIndex:10000,alignItems:'center',justifyContent:'center',overflow:'hidden',backgroundColor:'#030303'},launchAmbientGlow:{position:'absolute',width:300,height:300,borderRadius:150,backgroundColor:'rgba(215,25,63,.035)',shadowColor:'#d7193f',shadowOpacity:.12,shadowRadius:80,shadowOffset:{width:0,height:0}},launchIdentity:{width:300,alignItems:'center',justifyContent:'center'},launchLogo:{width:280,height:280},launchCaption:{marginTop:8,color:'rgba(255,255,255,.52)',fontSize:7,lineHeight:11,fontWeight:'800',letterSpacing:2.7},
  accountAccessCardUpgraded:{padding:20,borderColor:'#dfd4ce',shadowOpacity:.11,shadowRadius:20,shadowOffset:{width:0,height:9}},accountAccessTopline:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13},accountAccessStatus:{flexDirection:'row',alignItems:'center',gap:6},accountAccessStatusDot:{width:6,height:6,borderRadius:3,backgroundColor:RED},accountAccessStatusText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.25,color:'#6f625c'},accountAccessSeal:{height:26,borderRadius:13,backgroundColor:'#edf7f1',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:4},accountAccessSealText:{fontSize:6,fontWeight:'900',letterSpacing:.8,color:'#176b43'},accountModeSwitchUpgraded:{height:50,borderRadius:16,marginBottom:22,padding:4,backgroundColor:'#f1ece9'},accountModeTabUpgraded:{borderRadius:12,overflow:'hidden'},accountModeTextUpgraded:{fontSize:7,letterSpacing:1.25},accountModeIndicator:{position:'absolute',bottom:4,width:20,height:2,borderRadius:1,backgroundColor:RED},accountAccessIconUpgraded:{width:48,height:48,borderRadius:16,borderWidth:1,borderColor:'#f2dce2'},accountAccessTitleUpgraded:{fontSize:24,lineHeight:29,letterSpacing:-.25},accountAccessIntroUpgraded:{fontSize:10.5,lineHeight:16,marginTop:13,marginBottom:18,maxWidth:470},accountFieldLabelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},accountFieldRequired:{fontSize:6,fontWeight:'900',letterSpacing:.9,color:'#9a8e88'},accountAccessInputUpgraded:{height:60,borderRadius:17,borderWidth:1.2,backgroundColor:'#fff',shadowColor:'#2c1d18',shadowOpacity:.035,shadowRadius:6,shadowOffset:{width:0,height:2}},accountInputIconUpgraded:{width:42,height:42,borderRadius:14},accountPrivacyHint:{minHeight:29,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:4},accountPrivacyHintText:{fontSize:7.5,lineHeight:11,color:'#7b817d'},accountAccessButtonUpgraded:{height:58,borderRadius:29,overflow:'hidden',paddingLeft:21,paddingRight:7,shadowColor:'#a00d2d',shadowOpacity:.19,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:4},signInTextUpgraded:{fontSize:11.5,letterSpacing:.2},signInArrowUpgraded:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,.17)',borderWidth:1,borderColor:'rgba(255,255,255,.14)'},accountSecurityRowUpgraded:{minHeight:82,marginTop:17,borderTopWidth:1,borderBottomWidth:1,borderColor:'#eee6e1'},accountSecurityItemUpgraded:{gap:1,paddingHorizontal:3},accountSecurityDivider:{width:1,height:45,backgroundColor:'#eee6e1'},accountSecurityIcon:{width:29,height:29,borderRadius:10,backgroundColor:'#edf7f1',alignItems:'center',justifyContent:'center',marginBottom:3},accountSecurityTitle:{fontSize:7.5,fontWeight:'900',color:'#2d352f'},accountSecurityDescription:{fontSize:6.2,lineHeight:9,color:'#8b827d',textAlign:'center'},accountLegalRow:{minHeight:28,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingTop:7},formLegalUpgraded:{marginTop:0,paddingHorizontal:0,fontSize:7.2},
  locationBg:{flex:1,backgroundColor:'#070707',overflow:'hidden'},heroImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},locationSafe:{flex:1,maxWidth:sizes.form,alignSelf:'center'},locationBrand:{alignItems:'center',marginTop:'11%'},locationBrandLandscape:{display:'none'},locationBrandCaption:{color:'rgba(255,255,255,.72)',fontSize:7,fontWeight:'900',letterSpacing:3.2,marginTop:-5},locationControls:{marginTop:'auto',paddingBottom:spacing.lg},locationControlsLandscape:{paddingBottom:6},locationEyebrowRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:9},locationEyebrowLine:{width:23,height:2,borderRadius:2,backgroundColor:'#ff3d67'},locationEyebrow:{color:'#ff91a9',fontSize:8,lineHeight:12,fontWeight:'900',letterSpacing:1.65},locationQuestion:{color:'#fff',fontFamily:'serif',fontSize:35,lineHeight:40,fontWeight:'700',letterSpacing:-.7,textShadowColor:'rgba(0,0,0,.35)',textShadowOffset:{width:0,height:1},textShadowRadius:8},locationIntro:{maxWidth:360,color:'rgba(255,255,255,.76)',fontSize:11.5,lineHeight:17.5,marginTop:6,marginBottom:17},countryCard:{alignSelf:'stretch',minHeight:96,borderRadius:22,backgroundColor:'#fbfaf9',borderWidth:1,borderColor:'rgba(255,255,255,.9)',flexDirection:'row',alignItems:'center',paddingLeft:16,paddingRight:12,overflow:'hidden',shadowColor:'#000',shadowOpacity:.28,shadowRadius:18,shadowOffset:{width:0,height:10},elevation:8},countryAccent:{position:'absolute',left:0,top:20,bottom:20,width:3,borderTopRightRadius:4,borderBottomRightRadius:4,backgroundColor:RED},moroccoFlag:{width:44,height:36,borderRadius:8,backgroundColor:'#c92732',alignItems:'center',justifyContent:'center',marginRight:13,flexShrink:0,shadowColor:'#8d1116',shadowOpacity:.2,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:2},flagStar:{width:16,height:16,alignItems:'center',justifyContent:'center'},flagStarText:{fontSize:22,lineHeight:23,color:'#006233',fontWeight:'900'},marketCopy:{flex:1,minWidth:0},marketLabel:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.45,color:'#9a8d84'},countryText:{fontFamily:'serif',fontSize:22,color:'#171412',fontWeight:'700',lineHeight:25,marginTop:2},marketDetails:{flexDirection:'row',alignItems:'center',gap:3,marginTop:3},marketMeta:{fontSize:8.5,lineHeight:12,color:'#796f68'},marketDot:{width:3,height:3,borderRadius:2,backgroundColor:'#bbb'},countryDivider:{height:48,width:1,backgroundColor:'#e5ded9',marginHorizontal:11,flexShrink:0},arrowButton:{width:50,height:50,borderRadius:25,backgroundColor:RED,alignItems:'center',justifyContent:'center',flexShrink:0,shadowColor:RED,shadowOpacity:.32,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:4},arrowButtonPressed:{opacity:.86,transform:[{scale:.94}]},locationTrust:{height:30,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},locationTrustText:{color:'rgba(255,255,255,.72)',fontSize:8,fontWeight:'600',letterSpacing:.25},
  brandWrap:{alignItems:'center',justifyContent:'center',minWidth:106},
  brand:{fontFamily:Platform.select({web:'Times New Roman',ios:'Times New Roman',android:'serif'}),fontSize:26,lineHeight:29,fontWeight:'700',letterSpacing:-.25,color:colors.ink},brandLight:{color:'#fff'},brandSwoosh:{marginTop:-2},
  storeSafe:{flex:1,backgroundColor:'#fff'},screenBody:{flex:1,position:'relative'},storeLayer:{flex:1},storeLayerHidden:{display:'none'},commerceLayer:{...StyleSheet.absoluteFillObject,backgroundColor:'#fff'},iosBackGestureEdge:{position:'absolute',left:0,top:0,bottom:0,width:24,zIndex:12000},
  unavailableProduct:{flex:1,backgroundColor:'#fffaf6',alignItems:'center',justifyContent:'center',paddingHorizontal:28},unavailableProductIcon:{width:58,height:58,borderRadius:20,backgroundColor:'#f9e8ed',alignItems:'center',justifyContent:'center'},unavailableProductTitle:{fontFamily:'serif',fontSize:25,lineHeight:31,fontWeight:'700',color:'#211719',textAlign:'center',marginTop:18},unavailableProductBody:{maxWidth:380,fontSize:12,lineHeight:19,color:'#746861',textAlign:'center',marginTop:8},unavailableProductButton:{minHeight:50,borderRadius:25,backgroundColor:RED,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:22},unavailableProductButtonText:{fontSize:10,fontWeight:'900',color:'#fff'},rtlText:{textAlign:'right',writingDirection:'rtl'},
  header:{height:sizes.header,borderBottomColor:'#f2f2f2',borderBottomWidth:1,alignItems:'center',backgroundColor:'#fff'},
  headerMobile:{height:119,backgroundColor:'#f8f5f3',borderBottomColor:'#ebe3df',shadowColor:'#241b18',shadowOpacity:.06,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:4},
  headerInner:{height:'100%',width:'94%',maxWidth:sizes.shell,flexDirection:'row',alignItems:'center',gap:spacing.sm},
  headerInnerMobile:{width:'100%',paddingHorizontal:16,flexDirection:'column',alignItems:'stretch',justifyContent:'flex-start',gap:0},
  headerTopMobile:{width:'100%',height:59,flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  searchMobileRow:{width:'100%',height:60,paddingBottom:11,alignItems:'stretch',justifyContent:'center',flexShrink:0},searchMobileLabel:{fontSize:6.5,lineHeight:10,fontWeight:'900',letterSpacing:1.35,color:'#9a8d86',marginLeft:3,marginBottom:5},
  headerLogoButton:{minWidth:106,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:10},headerLogoButtonPressed:{opacity:.68,transform:[{scale:.97}]},headerActions:{flexDirection:'row',alignItems:'center',gap:4},headerActionsMobile:{height:46,borderRadius:23,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4dcd7',paddingHorizontal:3,gap:0,shadowColor:'#2a1b17',shadowOpacity:.055,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:2},headerAction:{width:sizes.touch,height:sizes.touch,alignItems:'center',justifyContent:'center'},touchTarget:{minWidth:sizes.touch,minHeight:sizes.touch},
  headerActionMobile:{width:38,height:38,borderRadius:19,backgroundColor:'transparent',borderWidth:0},headerActionDivider:{width:1,height:20,backgroundColor:'#e8e0dc'},headerBagMobile:{backgroundColor:'#f3eeeb'},headerActionPressed:{opacity:.7,transform:[{scale:.94}]},
  search:{height:50,borderWidth:1,borderColor:'#d9d0cb',borderRadius:25,flex:1,minWidth:70,flexDirection:'row',alignItems:'center',paddingLeft:6,paddingRight:7,gap:7,backgroundColor:'#fbfaf9',shadowColor:'#2a1b17',shadowOpacity:.045,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:1},searchFocused:{borderColor:'#672131',borderWidth:1.5,backgroundColor:'#fff',shadowColor:'#2a1b17',shadowOpacity:.09,shadowRadius:11,elevation:3},searchIconWrap:{width:38,height:38,borderRadius:19,backgroundColor:'#f0ebe8',alignItems:'center',justifyContent:'center',flexShrink:0},searchIconFocused:{backgroundColor:'#fff0f4'},
  searchActiveDesktop:{height:52,borderWidth:0,borderBottomWidth:1.5,borderBottomColor:RED,borderRadius:0,backgroundColor:'transparent',paddingLeft:0,paddingRight:0,shadowOpacity:0,elevation:0},searchIconActiveDesktop:{width:34,height:48,borderRadius:0,backgroundColor:'transparent'},searchInputActiveDesktop:{fontSize:15,letterSpacing:.15},searchClearActiveDesktop:{width:42,height:42,borderRadius:0,alignItems:'center',justifyContent:'center'},
  searchMobile:{width:'100%',height:50,minHeight:50,maxHeight:50,flex:0,backgroundColor:'#fff',borderWidth:1,borderColor:'#ddd4cf',borderRadius:25,paddingLeft:5,paddingRight:6,gap:6,overflow:'hidden',shadowColor:'#2a1b17',shadowOpacity:.055,shadowRadius:9,shadowOffset:{width:0,height:4},elevation:2},
  searchIconMobile:{width:40,height:40,borderRadius:20,backgroundColor:'#f2ece9',alignItems:'center',justifyContent:'center',flexShrink:0},searchInput:{height:48,fontSize:14,flex:1,minWidth:0,paddingVertical:0,color:'#211b18'},searchInputMobile:{height:48,fontSize:13,lineHeight:19,color:'#211d1a',paddingVertical:0,paddingHorizontal:4,borderWidth:0,backgroundColor:'transparent'},searchInputWeb:{outlineStyle:'none',outlineWidth:0,outlineColor:'transparent'} as any,searchListening:{borderColor:RED,backgroundColor:'#fff8fa'},searchMic:{width:38,height:38,borderRadius:19,backgroundColor:'#fff0f4',borderWidth:1,borderColor:'#f2d7de',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'},searchMicMobile:{width:38,height:38,borderRadius:19},searchMicListening:{backgroundColor:RED,borderColor:RED},searchMicPressed:{opacity:.76,transform:[{scale:.94}]},searchMicPulse:{position:'absolute',width:7,height:7,borderRadius:4,right:4,top:4,backgroundColor:'#fff',borderWidth:1,borderColor:RED},searchHint:{height:28,borderRadius:14,backgroundColor:'#211719',paddingHorizontal:10,alignItems:'center',justifyContent:'center'},searchHintText:{fontSize:5.5,fontWeight:'900',letterSpacing:1,color:'#fff'},
  feed:{paddingBottom:4},contentContainer:{width:'100%',alignSelf:'center'},results:{minHeight:128,marginTop:11,padding:12,backgroundColor:'#f8f4f2',borderRadius:20,borderWidth:1,borderColor:'#e4dad5',overflow:'hidden',shadowColor:'#2a1b17',shadowOpacity:.045,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:2},resultsAccent:{position:'absolute',left:0,top:18,bottom:18,width:3,borderTopRightRadius:3,borderBottomRightRadius:3,backgroundColor:RED},resultsTop:{minHeight:51,flexDirection:'row',alignItems:'center',gap:10},resultsIcon:{width:43,height:43,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#ebe3df',alignItems:'center',justifyContent:'center'},resultsCopy:{flex:1,minWidth:0},resultsEyebrow:{fontSize:5.5,fontWeight:'900',letterSpacing:1.2,color:RED},resultsText:{fontFamily:'serif',fontSize:15,lineHeight:19,fontWeight:'700',color:'#211a17',marginTop:1},resultsQuery:{fontSize:7.5,lineHeight:11,color:'#847871',marginTop:1},resultsCount:{minWidth:48,height:45,borderRadius:14,backgroundColor:'#211719',alignItems:'center',justifyContent:'center',paddingHorizontal:7},resultsCountEmpty:{backgroundColor:'#e9e1dd'},resultsCountValue:{fontFamily:'serif',fontSize:17,lineHeight:19,fontWeight:'700',color:'#fff'},resultsCountValueEmpty:{color:'#776c65'},resultsCountLabel:{fontSize:4.5,fontWeight:'900',letterSpacing:.75,color:'#a99da0',marginTop:1},resultsBest:{minHeight:45,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#e8dfda',paddingLeft:6,paddingRight:5,marginTop:9,flexDirection:'row',alignItems:'center',gap:8},resultsBestMark:{width:33,height:33,borderRadius:11,backgroundColor:RED,alignItems:'center',justifyContent:'center'},resultsBestCopy:{flex:1,minWidth:0},resultsBestLabel:{fontSize:5,fontWeight:'900',letterSpacing:.9,color:'#9a8e87'},resultsBestValue:{fontSize:8,lineHeight:11,fontWeight:'900',color:'#211b18',marginTop:2},resultsBestArrow:{width:33,height:33,borderRadius:17,backgroundColor:'#f2ece9',alignItems:'center',justifyContent:'center'},
  accueilShowcase:{paddingTop:12},
  accueilHero:{height:330,borderRadius:21,overflow:'hidden',backgroundColor:'#0a0908',shadowColor:'#160d09',shadowOpacity:.2,shadowRadius:17,shadowOffset:{width:0,height:9},elevation:6},
  accueilHeroImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},accueilHeroTop:{position:'absolute',left:15,right:15,top:14,flexDirection:'row',alignItems:'center'},
  accueilLiveDot:{width:6,height:6,borderRadius:3,backgroundColor:'#ff315d',marginRight:7},accueilHeroTopText:{flex:1,fontSize:6.5,fontWeight:'900',letterSpacing:1.25,color:'rgba(255,255,255,.82)'},accueilHeroNumber:{fontSize:7,fontWeight:'900',letterSpacing:.8,color:'#fff'},
  accueilHeroCopy:{position:'absolute',left:19,right:19,bottom:18},accueilHeroEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.55,color:'#ff7594'},accueilHeroTitle:{fontFamily:'serif',fontSize:31,lineHeight:33,fontWeight:'700',letterSpacing:-.45,color:'#fff',marginTop:5},
  accueilHeroText:{width:'78%',fontSize:10,lineHeight:15,color:'rgba(255,255,255,.76)',marginTop:7},accueilHeroCta:{height:42,alignSelf:'flex-start',borderRadius:21,backgroundColor:'#fff',paddingHorizontal:15,marginTop:14,flexDirection:'row',alignItems:'center',gap:9},accueilHeroCtaText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.05,color:'#111'},
  accueilEditorial:{height:170,borderRadius:20,overflow:'hidden',marginTop:12,backgroundColor:'#ead2b4',borderWidth:1,borderColor:'#e5d2bb'},accueilEditorialImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},accueilEditorialCopy:{width:'64%',padding:18},
  accueilEditorialEyebrow:{fontSize:6,fontWeight:'900',letterSpacing:1.35,color:RED},accueilEditorialTitle:{fontFamily:'serif',fontSize:24,lineHeight:29,fontWeight:'700',color:'#17120e',marginTop:3},accueilEditorialText:{fontSize:9,lineHeight:14,color:'#62554b',marginTop:3},
  accueilEditorialLink:{height:29,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:1,borderBottomColor:'#17120e',marginTop:10},accueilEditorialLinkText:{fontSize:6,fontWeight:'900',letterSpacing:1,color:'#17120e'},
  accueilBrands:{marginTop:27,borderRadius:24,backgroundColor:'#f5f1ee',borderWidth:1,borderColor:'#e8dfda',paddingTop:24,paddingBottom:17,overflow:'hidden'},accueilBrandsHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,paddingHorizontal:20,marginBottom:19},accueilBrandsHeadingCopy:{flex:1,minWidth:0},accueilBrandsEyebrowRow:{flexDirection:'row',alignItems:'center',gap:7},accueilBrandsAccent:{width:18,height:2,borderRadius:1,backgroundColor:RED},accueilBrandsEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.55,color:RED},accueilBrandsTitle:{fontFamily:'serif',fontSize:27,lineHeight:32,fontWeight:'700',letterSpacing:-.45,color:'#17120e',marginTop:6},accueilBrandsSubtitle:{fontSize:10.5,lineHeight:16,color:'#766b65',marginTop:4,maxWidth:290},accueilBrandsCount:{minWidth:54,height:42,borderRadius:13,borderWidth:1,borderColor:'#d8cdc7',backgroundColor:'rgba(255,255,255,.55)',paddingHorizontal:7,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},accueilBrandsCountNumber:{fontFamily:'serif',fontSize:17,fontWeight:'700',color:'#171310'},accueilBrandsCountLabel:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:1.05,color:'#958881',paddingTop:2},
  accueilBrandViewport:{position:'relative'},accueilBrandRow:{gap:11,paddingHorizontal:20,paddingRight:38},accueilBrandCard:{height:174,borderWidth:1,borderColor:'#ddd3cd',borderRadius:20,backgroundColor:'#fff',padding:15,overflow:'hidden',shadowColor:'#2d1a15',shadowOpacity:.06,shadowRadius:11,shadowOffset:{width:0,height:6},elevation:2},accueilBrandCardFeatured:{backgroundColor:'#201313',borderColor:'#201313'},accueilBrandCardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},accueilBrandIndex:{fontFamily:'serif',fontSize:10,fontWeight:'700',color:'#a0948d'},accueilBrandDot:{width:6,height:6,borderRadius:3,backgroundColor:'#d6cbc5'},accueilBrandDotFeatured:{backgroundColor:'#ff496e'},accueilBrandTextLight:{color:'#fff'},accueilBrandIdentity:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12},accueilBrandLogoPlate:{width:48,height:48,borderRadius:14,backgroundColor:'#fff',borderWidth:1,borderColor:'#ece6e2',alignItems:'center',justifyContent:'center',padding:7,overflow:'hidden'},accueilBrandLogo:{width:'100%',height:'100%'},accueilBrandIdentityCopy:{flex:1,minWidth:0},accueilBrandName:{fontSize:13,lineHeight:16,fontWeight:'900',letterSpacing:.65,color:'#171310'},accueilBrandSerif:{fontFamily:'serif',fontSize:18,lineHeight:20,fontWeight:'700',letterSpacing:.1},accueilBrandOrigin:{fontSize:5.5,lineHeight:9,fontWeight:'800',letterSpacing:.65,color:'#9b8f88',marginTop:3},accueilBrandCardBottom:{marginTop:'auto',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},accueilBrandExplore:{fontSize:10,fontWeight:'700',letterSpacing:.1,color:'#786c65'},accueilBrandExploreLight:{color:'rgba(255,255,255,.68)'},accueilBrandArrow:{width:32,height:32,borderRadius:16,backgroundColor:'#171310',alignItems:'center',justifyContent:'center'},accueilBrandArrowFeatured:{backgroundColor:'#fff'},accueilBrandsEdgeFade:{position:'absolute',right:0,top:0,bottom:0,width:20},accueilBrandsFooter:{height:28,marginTop:13,paddingHorizontal:20,flexDirection:'row',alignItems:'center'},accueilBrandsDots:{flexDirection:'row',alignItems:'center',gap:4},accueilBrandsDot:{width:4,height:4,borderRadius:2,backgroundColor:'#d1c5bf'},accueilBrandsDotActive:{width:16,backgroundColor:RED},accueilBrandsHint:{fontSize:7,fontWeight:'800',letterSpacing:.8,color:'#8d817a',marginLeft:8},accueilBrandsSwipe:{marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:5},accueilBrandsSwipeText:{fontSize:8,fontWeight:'700',color:'#786c65'},
  chipRow:{paddingVertical:14,gap:8},chip:{minHeight:sizes.touch,borderWidth:1,borderColor:'#aaa',borderRadius:radius.sm,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},chipText:{fontSize:16},pressed:{opacity:.65,transform:[{scale:.985}]},deptRow:{paddingTop:12,paddingBottom:36,gap:15},department:{width:76,minHeight:104,alignItems:'center'},deptCircle:{width:66,height:66,borderRadius:33,alignItems:'center',justifyContent:'center'},deptLabel:{fontSize:13,textAlign:'center',marginTop:10,lineHeight:17},
  campaign:{overflow:'hidden',backgroundColor:'#151515',borderRadius:18,marginTop:18,shadowColor:'#000',shadowOffset:{width:0,height:10},shadowOpacity:.18,shadowRadius:18,elevation:6},campaignImage:{width:'100%',height:'100%',resizeMode:'cover'},campaignCopy:{position:'absolute',left:20,top:19,bottom:18,maxWidth:'58%',justifyContent:'flex-start'},campaignTitle:{color:'#ff78c5',fontWeight:'900',fontSize:23,lineHeight:22,letterSpacing:-.3,marginTop:7},campaignBy:{color:'rgba(255,255,255,.75)',fontSize:7,fontWeight:'900',letterSpacing:1.5},campaignOfferRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:20},campaignDiscount:{fontSize:44,lineHeight:48,fontWeight:'900',color:'#ff78c5',letterSpacing:-1.5},campaignSmall:{color:'#ff9ad3',fontSize:7.5,lineHeight:10,fontWeight:'900',letterSpacing:.25},campaignCta:{height:28,alignSelf:'flex-start',borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,.5)',backgroundColor:'rgba(0,0,0,.28)',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:7,marginTop:'auto'},campaignCtaText:{color:'#fff',fontSize:6.5,fontWeight:'900',letterSpacing:1.1},
  offersSection:{marginTop:38},offersHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14},offersTitle:{fontFamily:'serif',fontSize:25,lineHeight:30,fontWeight:'700',color:'#151210',marginTop:3},offersSubtitle:{fontSize:9.5,lineHeight:14,color:'#786d67',marginTop:3,maxWidth:330},offersSeal:{width:42,height:42,borderRadius:15,backgroundColor:'#fff0f4',borderWidth:1,borderColor:'#f4dfe5',alignItems:'center',justifyContent:'center'},offersGrid:{flexDirection:'row',gap:10},offer:{flex:1,minHeight:210,borderRadius:18,backgroundColor:'#fbf8f6',borderWidth:1,borderColor:'#e9e0dc',padding:15,overflow:'hidden',shadowColor:'#2a1916',shadowOpacity:.08,shadowRadius:11,shadowOffset:{width:0,height:6},elevation:3},offerFeatured:{backgroundColor:'#171310',borderColor:'#241715'},offerTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},offerIcon:{width:32,height:32,borderRadius:11,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},offerIconFeatured:{backgroundColor:'rgba(215,25,63,.85)'},offerLimited:{fontSize:5.5,fontWeight:'900',letterSpacing:1,color:'#8b7e78',textAlign:'right'},offerPercent:{fontSize:35,lineHeight:40,fontWeight:'900',letterSpacing:-1.3,color:'#171210',marginTop:12},offerTitle:{fontFamily:'serif',fontSize:13,lineHeight:17,fontWeight:'700',color:'#342b27'},offerDetail:{fontSize:7.5,lineHeight:11,color:'#81756f',marginTop:2},offerTextLight:{color:'#fff'},offerTextMuted:{color:'rgba(255,255,255,.58)'},offerCodeRow:{marginTop:'auto',paddingTop:13,borderTopWidth:1,borderTopColor:'#e8dfda',flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},offerCodeRowFeatured:{borderTopColor:'rgba(255,255,255,.13)'},offerCodeLabel:{fontSize:6,fontWeight:'900',letterSpacing:1.1,color:'#9a8d86'},offerCode:{fontSize:13,lineHeight:17,fontWeight:'900',letterSpacing:.8,color:RED},offerCodeFeatured:{color:'#ff7594'},offerArrow:{width:31,height:31,borderRadius:16,backgroundColor:RED,alignItems:'center',justifyContent:'center'},offerArrowFeatured:{backgroundColor:'#fff'},
  secondaryBanner:{marginTop:20,minHeight:230,borderRadius:19,backgroundColor:'#eee1ce',overflow:'hidden',shadowColor:'#302013',shadowOpacity:.12,shadowRadius:15,shadowOffset:{width:0,height:8},elevation:4},secondaryBannerImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},secondaryBannerCopy:{width:'58%',padding:21},eyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.7,color:RED,marginBottom:7},secondaryTitle:{fontFamily:'serif',fontSize:29,lineHeight:34,fontWeight:'700',letterSpacing:-.5,color:'#17120e'},secondaryText:{fontSize:11,lineHeight:16,color:'#5f554d',marginTop:5},secondaryCta:{height:30,alignSelf:'flex-start',marginTop:16,borderBottomWidth:1,borderBottomColor:'#17120e',flexDirection:'row',alignItems:'center',gap:7},secondaryCtaText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.15,color:'#17120e'},
  newsletter:{marginTop:24,minHeight:285,borderRadius:20,overflow:'hidden',padding:22,alignItems:'flex-start'},newsletterGlow:{position:'absolute',right:-65,top:-75,width:210,height:210,borderRadius:105,backgroundColor:'rgba(215,25,63,.22)'},newsletterIcon:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'rgba(255,255,255,.22)',backgroundColor:'rgba(255,255,255,.08)',alignItems:'center',justifyContent:'center',marginBottom:18},newsletterEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.8,color:'#ff8fa9'},newsletterTitle:{fontFamily:'serif',fontSize:28,lineHeight:33,fontWeight:'700',color:'#fff',letterSpacing:-.4},newsletterText:{maxWidth:335,fontSize:11,lineHeight:17,color:'rgba(255,255,255,.68)',marginTop:7},newsletterForm:{width:'100%',height:48,borderRadius:24,marginTop:20,backgroundColor:'rgba(255,255,255,.1)',borderWidth:1,borderColor:'rgba(255,255,255,.18)',paddingLeft:16,paddingRight:5,flexDirection:'row',alignItems:'center'},newsletterInput:{flex:1,minWidth:0,height:46,fontSize:12,color:'#fff',paddingVertical:0},newsletterButton:{height:38,borderRadius:19,backgroundColor:RED,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},newsletterButtonText:{fontSize:8,fontWeight:'900',letterSpacing:1.2,color:'#fff'},newsletterPromise:{marginTop:10,flexDirection:'row',alignItems:'center',gap:5},newsletterPromiseText:{fontSize:7.5,color:'rgba(255,255,255,.48)'},newsletterUpgraded:{minHeight:350,borderRadius:22,shadowColor:'#24100d',shadowOpacity:.18,shadowRadius:17,shadowOffset:{width:0,height:9},elevation:5},newsletterGlowUpgraded:{right:-72,top:-78,width:220,height:220,borderRadius:110,backgroundColor:'rgba(215,25,63,.2)'},newsletterTop:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:17},newsletterIconUpgraded:{borderRadius:13,marginBottom:0},newsletterEdition:{height:25,borderRadius:13,borderWidth:1,borderColor:'rgba(255,255,255,.17)',backgroundColor:'rgba(0,0,0,.15)',paddingHorizontal:9,alignItems:'center',justifyContent:'center'},newsletterEditionText:{fontSize:5.5,fontWeight:'900',letterSpacing:1.15,color:'rgba(255,255,255,.68)'},newsletterTitleUpgraded:{fontSize:29,lineHeight:34,marginTop:3},newsletterTextUpgraded:{maxWidth:345,fontSize:10.5,lineHeight:16,marginTop:6},newsletterBenefits:{marginTop:13,flexDirection:'row',alignItems:'center',gap:8},newsletterBenefit:{flexDirection:'row',alignItems:'center',gap:4},newsletterBenefitText:{fontSize:5.5,fontWeight:'900',letterSpacing:1,color:'rgba(255,255,255,.7)'},newsletterBenefitDot:{width:3,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,.3)'},newsletterFieldLabel:{fontSize:6.5,fontWeight:'900',letterSpacing:1.35,color:'rgba(255,255,255,.62)',marginTop:18,marginBottom:7},newsletterFormUpgraded:{height:54,borderRadius:17,marginTop:0,backgroundColor:'#fbf7f3',borderWidth:2,borderColor:'#fbf7f3',paddingLeft:6,paddingRight:5,shadowColor:'#000',shadowOpacity:.16,shadowRadius:8,shadowOffset:{width:0,height:4}},newsletterFormFocused:{borderColor:'#f08a3c',backgroundColor:'#fffaf5'},newsletterInputIcon:{width:35,height:35,borderRadius:11,backgroundColor:'#f0e9e5',alignItems:'center',justifyContent:'center',flexShrink:0},newsletterInputUpgraded:{height:50,fontSize:11.5,color:'#211a17',paddingHorizontal:8},newsletterButtonUpgraded:{height:42,borderRadius:13,paddingHorizontal:12},newsletterButtonTextUpgraded:{fontSize:6.5,letterSpacing:1},newsletterPromiseUpgraded:{width:'100%',justifyContent:'center'},newsletterPromiseTextUpgraded:{fontSize:6.8},
  bottomNav:{height:sizes.bottomNav,minWidth:0,backgroundColor:'#FFFDF9',borderTopWidth:1,borderColor:'#E8E1DB',alignItems:'center',paddingTop:6,paddingBottom:4,shadowOpacity:0,elevation:0},bottomNavInner:{width:'100%',minWidth:0,height:'100%',flexDirection:'row'},tab:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center'},tabText:{fontSize:10,lineHeight:13,marginTop:2,color:'#49433f'},
  placeholder:{flex:1,alignItems:'center',justifyContent:'center',padding:35},placeholderIcon:{width:84,height:84,borderRadius:42,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center',marginBottom:18},placeholderTitle:{fontSize:32,lineHeight:38,fontWeight:'800'},placeholderCopy:{fontSize:17,lineHeight:24,color:'#666',marginTop:9,textAlign:'center',maxWidth:480},primaryButton:{minHeight:sizes.button,marginTop:25,backgroundColor:'#111',paddingHorizontal:34,justifyContent:'center',borderRadius:28},primaryButtonText:{color:'#fff',fontSize:16,fontWeight:'700'},
  pageScroll:{flexGrow:1,backgroundColor:'#f6f3f1',paddingTop:18,paddingBottom:32},pageContainer:{width:'100%',maxWidth:900,alignSelf:'center',paddingHorizontal:20},pageHeader:{minHeight:116,flexDirection:'row',alignItems:'center',gap:22,borderBottomWidth:1,borderBottomColor:'#e5e5e5'},pageHeaderCopy:{flex:1},pageTitle:{fontSize:27,lineHeight:33,fontWeight:'800',color:'#111'},pageSubtitle:{fontSize:13,lineHeight:18,color:'#777',marginTop:2},productCard:{marginTop:24,borderRadius:18,backgroundColor:'#fff',overflow:'hidden',...shadow},productImage:{width:'100%',aspectRatio:1.25},productInfo:{padding:20},productBadge:{fontSize:10,lineHeight:14,color:RED,fontWeight:'900',letterSpacing:1.5},productName:{fontFamily:'serif',fontSize:29,lineHeight:35,fontWeight:'700',marginTop:5},productType:{fontSize:14,lineHeight:20,color:'#666'},productNotes:{fontSize:13,lineHeight:19,color:'#555',marginTop:10},priceRow:{flexDirection:'row',alignItems:'baseline',gap:10,marginTop:15},oldPrice:{fontSize:14,color:'#999',textDecorationLine:'line-through'},price:{fontSize:24,fontWeight:'800'},buyButton:{height:54,borderRadius:27,backgroundColor:'#111',marginTop:18,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center'},buyButtonAdded:{backgroundColor:'#176b43'},buyButtonText:{color:'#fff',fontSize:16,fontWeight:'800'},menuHeader:{borderRadius:20,backgroundColor:'#fff',padding:20,borderWidth:1,borderColor:'#ebe5e1'},menuBrandRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:19},menuBag:{width:37,height:37,borderRadius:19,backgroundColor:'#f5f1ef',alignItems:'center',justifyContent:'center'},menuEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.65,color:RED},menuTitle:{fontFamily:'serif',fontSize:31,lineHeight:36,fontWeight:'700',color:'#171310',letterSpacing:-.5,marginTop:4},menuSubtitle:{fontSize:11.5,lineHeight:17,color:'#756a64',marginTop:6,maxWidth:390},menuFeatured:{height:205,marginTop:12,borderRadius:19,overflow:'hidden',backgroundColor:'#111',shadowColor:'#000',shadowOpacity:.16,shadowRadius:13,shadowOffset:{width:0,height:7},elevation:4},menuFeaturedImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},menuFeaturedBadge:{position:'absolute',left:15,top:15,height:28,borderRadius:14,backgroundColor:'rgba(0,0,0,.55)',borderWidth:1,borderColor:'rgba(255,255,255,.25)',paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:6},menuFeaturedBadgeText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.2,color:'#fff'},menuFeaturedCopy:{position:'absolute',left:17,right:17,bottom:16},menuFeaturedTitle:{fontFamily:'serif',fontSize:27,lineHeight:31,fontWeight:'700',color:'#fff'},menuFeaturedText:{fontSize:9.5,lineHeight:14,color:'rgba(255,255,255,.75)',marginTop:2},menuFeaturedAction:{marginTop:10,flexDirection:'row',alignItems:'center',gap:7},menuFeaturedActionText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.2,color:'#fff'},menuSectionHead:{marginTop:22,marginBottom:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},menuSectionTitle:{fontSize:8,fontWeight:'900',letterSpacing:1.5,color:'#241d1a'},menuSectionCount:{fontSize:7,color:'#948983',letterSpacing:.5},menuGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},menuItem:{width:'48.5%',minHeight:142,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#ebe5e1',padding:14,shadowColor:'#2a1c18',shadowOpacity:.04,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:1},menuIcon:{width:39,height:39,borderRadius:13,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},menuLabel:{fontSize:14,fontWeight:'800',color:'#1e1916',marginTop:14},menuMeta:{fontSize:8.5,lineHeight:12,color:'#81766f',marginTop:2},menuArrow:{position:'absolute',right:12,bottom:12,width:29,height:29,borderRadius:15,backgroundColor:'#f5f1ef',alignItems:'center',justifyContent:'center'},menuPromise:{minHeight:82,marginTop:14,borderRadius:17,backgroundColor:'#edf5ef',padding:15,flexDirection:'row',alignItems:'center',gap:12},menuPromiseIcon:{width:40,height:40,borderRadius:20,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},menuPromiseTitle:{fontSize:11,fontWeight:'800',color:'#214b31'},menuPromiseText:{fontSize:8.5,lineHeight:13,color:'#5c7464',marginTop:2},helpHeader:{borderRadius:20,backgroundColor:'#fff',padding:20,borderWidth:1,borderColor:'#ebe5e1'},helpBrandRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18},helpLocale:{height:27,borderRadius:14,backgroundColor:'#fff0f4',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:4},helpLocaleText:{fontSize:6,fontWeight:'900',letterSpacing:1,color:RED},helpEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.7,color:RED},helpTitle:{fontFamily:'serif',fontSize:32,lineHeight:37,fontWeight:'700',color:'#171310',letterSpacing:-.5,marginTop:4},helpSubtitle:{maxWidth:390,fontSize:12,lineHeight:18,color:'#756a64',marginTop:6},supportHero:{marginTop:12,padding:17,borderRadius:18,backgroundColor:'#171310',flexDirection:'row',alignItems:'center',gap:14},supportIcon:{width:46,height:46,borderRadius:23,backgroundColor:RED,alignItems:'center',justifyContent:'center'},supportStatusRow:{flexDirection:'row',alignItems:'center',gap:5},supportStatusDot:{width:6,height:6,borderRadius:3,backgroundColor:'#52c77c'},supportStatus:{fontSize:6,fontWeight:'900',letterSpacing:1.1,color:'#82d99f'},supportTitle:{fontFamily:'serif',fontSize:19,lineHeight:23,fontWeight:'700',color:'#fff',marginTop:3},supportText:{fontSize:9.5,lineHeight:14,color:'rgba(255,255,255,.65)',marginTop:2},helpSectionHeading:{marginTop:22,marginBottom:2,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},helpSectionTitle:{fontSize:8,fontWeight:'900',letterSpacing:1.5,color:'#27201d'},helpSectionMeta:{fontSize:8,color:'#918781'},helpRow:{minHeight:72,marginTop:9,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#ebe5e1',paddingHorizontal:12,flexDirection:'row',alignItems:'center',shadowColor:'#2a1d18',shadowOpacity:.04,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:1},helpRowIcon:{width:40,height:40,borderRadius:13,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},helpRowCopy:{flex:1,minWidth:0,marginLeft:12},helpText:{fontSize:13,fontWeight:'800',color:'#1d1815'},helpMeta:{fontSize:9,lineHeight:13,color:'#81766f',marginTop:2},helpArrow:{width:31,height:31,borderRadius:16,backgroundColor:'#f5f1ef',alignItems:'center',justifyContent:'center'},helpContact:{minHeight:104,marginTop:18,borderRadius:18,backgroundColor:'#eee4df',padding:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},helpContactEyebrow:{fontSize:6.5,fontWeight:'900',letterSpacing:1.3,color:RED},helpContactTitle:{fontFamily:'serif',fontSize:22,lineHeight:26,fontWeight:'700',color:'#171310',marginTop:2},helpContactText:{fontSize:8.5,color:'#776c66',marginTop:2},helpContactButton:{height:40,borderRadius:20,backgroundColor:'#176b43',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:7},helpContactButtonText:{fontSize:7,fontWeight:'900',letterSpacing:1,color:'#fff'},accountScroll:{flexGrow:1,backgroundColor:'#f6f3f1',paddingTop:22,paddingBottom:35},accountContainer:{maxWidth:620},accountHero:{borderRadius:20,backgroundColor:'#fff',padding:20,borderWidth:1,borderColor:'#ebe5e1'},accountBrandRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},accountSecurePill:{height:26,borderRadius:13,backgroundColor:'#edf8f1',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5},accountSecureText:{fontSize:6,fontWeight:'900',letterSpacing:1,color:'#176b43'},accountHeroRule:{height:1,backgroundColor:'#eee8e4',marginVertical:17},accountEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.65,color:RED},accountTitle:{fontFamily:'serif',fontSize:32,lineHeight:37,fontWeight:'700',color:'#171310',letterSpacing:-.5,marginTop:4},accountSubtitle:{fontSize:12,lineHeight:18,color:'#706661',marginTop:6,maxWidth:410},accountBenefits:{minHeight:70,marginTop:12,borderRadius:17,backgroundColor:'#171310',paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},accountBenefit:{flex:1,alignItems:'center',justifyContent:'center',gap:5},accountBenefitText:{fontSize:8,fontWeight:'800',color:'#fff',letterSpacing:.25},accountBenefitDivider:{width:1,height:28,backgroundColor:'rgba(255,255,255,.15)'},formCard:{marginTop:12,padding:20,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#ebe5e1',shadowColor:'#2c1d18',shadowOpacity:.07,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:3},formTitle:{fontFamily:'serif',fontSize:22,lineHeight:27,fontWeight:'700',color:'#171310'},formSubtitle:{fontSize:10.5,lineHeight:16,color:'#7c716a',marginTop:3,marginBottom:18},formLabel:{fontSize:8,fontWeight:'900',letterSpacing:1.45,color:'#6e625c'},formInputWrap:{height:52,borderWidth:1,borderColor:'#d7cfca',borderRadius:13,paddingHorizontal:14,marginTop:8,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#fcfbfa'},formInput:{height:50,flex:1,minWidth:0,paddingVertical:0,fontSize:14,color:'#1d1815'},signInButton:{height:54,borderRadius:27,backgroundColor:RED,marginTop:15,paddingLeft:22,paddingRight:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},signInText:{color:'#fff',fontSize:13,fontWeight:'900',letterSpacing:.1},signInArrow:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,255,255,.16)',alignItems:'center',justifyContent:'center'},formTrust:{marginTop:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},formTrustText:{fontSize:8.5,color:'#777'},formLegal:{fontSize:8,lineHeight:13,color:'#999',textAlign:'center',marginTop:8,paddingHorizontal:12},
  catalogSection:{marginTop:28,marginHorizontal:-20,paddingHorizontal:14,paddingTop:22,paddingBottom:20,backgroundColor:'#f3f3f3'},catalogHeadingRow:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',paddingHorizontal:4,marginBottom:16},catalogEyebrow:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:1.5,color:RED},catalogHeading:{fontSize:23,lineHeight:29,fontWeight:'800',marginTop:2},catalogViewAll:{fontSize:13,fontWeight:'800',color:RED,paddingVertical:8},catalogGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},catalogCard:{minHeight:382,borderRadius:18,backgroundColor:'#fff',overflow:'hidden',marginBottom:4,borderWidth:1,borderColor:'#eee8e4',shadowColor:'#2a1a16',shadowOpacity:.09,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:3},catalogImageWrap:{height:174,minHeight:174,flexShrink:0,backgroundColor:'#f8f6f4',position:'relative',padding:18,borderBottomWidth:1,borderBottomColor:'#eee8e4'},catalogImage:{width:'100%',height:'100%'},recommendationProductImage:{transform:[{scale:.78}]},catalogBadge:{position:'absolute',left:9,top:9,maxWidth:'68%',height:24,backgroundColor:'#211719',color:'#fff',fontSize:7,fontWeight:'900',letterSpacing:.65,paddingHorizontal:9,paddingTop:7,borderRadius:12},catalogHeart:{position:'absolute',right:9,top:9,width:40,height:40,borderRadius:14,backgroundColor:'rgba(255,255,255,.96)',borderWidth:1,borderColor:'#eee8e4',alignItems:'center',justifyContent:'center',shadowColor:'#2a1a16',shadowOpacity:.08,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:2},catalogInfo:{flex:1,paddingHorizontal:14,paddingTop:14,paddingBottom:76},catalogBrand:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:1.05,color:'#5f534d'},catalogName:{fontFamily:'serif',fontSize:15.5,lineHeight:19,minHeight:57,color:'#201917',marginTop:4},catalogMeta:{fontSize:9,lineHeight:13,color:'#91867f',marginTop:3},catalogRatingRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:7},catalogRating:{fontSize:11,lineHeight:15,color:'#d79800',letterSpacing:-.7},catalogRatingNumber:{fontSize:9.5,lineHeight:14,color:'#81766f'},catalogFooter:{position:'absolute',left:13,right:13,bottom:12,minHeight:52,borderTopWidth:1,borderTopColor:'#eee8e4',paddingTop:10,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:8},catalogPriceStack:{flex:1,minWidth:0},catalogPriceArea:{marginTop:'auto',paddingTop:9,flexDirection:'row',alignItems:'flex-end',gap:6},catalogDiscountRow:{flexDirection:'row',alignItems:'center',gap:5},catalogOldPrice:{fontSize:9,lineHeight:12,color:'#9a908a',textDecorationLine:'line-through'},catalogSave:{fontSize:6,lineHeight:10,color:'#fff',backgroundColor:RED,fontWeight:'900',paddingHorizontal:4,borderRadius:3},catalogFrom:{fontSize:7,lineHeight:10,color:'#9a908a',fontWeight:'900',letterSpacing:.9},catalogPrice:{fontSize:19,lineHeight:23,fontWeight:'900',color:'#171310'},catalogQuickAdd:{width:44,height:44,borderRadius:14,backgroundColor:RED,alignItems:'center',justifyContent:'center',shadowColor:RED,shadowOpacity:.18,shadowRadius:7,shadowOffset:{width:0,height:4},elevation:2},catalogRequestPrice:{height:46,marginTop:'auto',borderRadius:15,backgroundColor:'#f5ecee',borderWidth:1,borderColor:'#eadadd',paddingLeft:11,paddingRight:5,flexDirection:'row',alignItems:'center',gap:7},catalogRequestPricePressed:{opacity:.82,transform:[{scale:.98}]},catalogRequestCopy:{flex:1,minWidth:0},catalogRequestEyebrow:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:1.05,color:RED},catalogRequestText:{fontSize:10,lineHeight:14,fontWeight:'800',color:'#211a18',marginTop:1},catalogRequestIcon:{width:36,height:36,borderRadius:12,backgroundColor:'#211a18',alignItems:'center',justifyContent:'center'},catalogDots:{height:30,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},catalogDot:{width:7,height:7,borderRadius:4,backgroundColor:'#c8c8c8'},catalogDotActive:{width:18,height:7,borderRadius:4,backgroundColor:'#111'},
  detailPage:{flex:1,backgroundColor:'#fcfaf7'},
  detailScrollPremium:{backgroundColor:'#fcfaf7'},
  detailScrollMobile:{paddingBottom:118},
  detailInfoPremium:{width:'100%',borderRadius:0,borderWidth:0,backgroundColor:'#fffdf9',paddingHorizontal:20,paddingTop:25,paddingBottom:34,shadowOpacity:0,elevation:0},
  stockStatusPremium:{height:'auto',minHeight:20,backgroundColor:'transparent',borderWidth:0,paddingHorizontal:0,borderRadius:0,gap:6},
  stockStatusDot:{width:5,height:5,borderRadius:3,backgroundColor:'#18834d'},
  stockStatusDotMuted:{backgroundColor:'#9b9089'},
  stockTextPremium:{fontSize:6.2,lineHeight:9,fontWeight:'800',letterSpacing:1.15},
  detailNamePremium:{fontSize:28,lineHeight:34,fontWeight:'500',letterSpacing:-.35,marginTop:17,maxWidth:430},
  detailRatingPremium:{minHeight:30,marginTop:0,paddingHorizontal:0,borderRadius:0,backgroundColor:'transparent',borderWidth:0,gap:6},
  detailRatingShareRow:{minHeight:48,marginTop:14,paddingBottom:10,borderBottomWidth:1,borderBottomColor:'#eee6e1',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  detailRatingInline:{marginTop:0},
  detailShareAction:{minHeight:30,paddingHorizontal:3,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  detailShareActionPressed:{opacity:.55},
  detailShareActionText:{fontSize:6.5,lineHeight:9,fontWeight:'800',letterSpacing:1.2,color:'#6c6059'},
  detailTrustRow:{minHeight:44,marginTop:0,borderBottomWidth:1,borderColor:'#eee6e1',flexDirection:'row',alignItems:'center'},
  detailTrustItem:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  detailTrustDivider:{width:1,height:20,backgroundColor:'#e6ddd8'},
  detailTrustText:{fontSize:8.5,lineHeight:12,fontWeight:'700',color:'#625750',textAlign:'center'},
  detailPricePanelPremium:{marginTop:26,borderRadius:0,borderWidth:0,borderTopWidth:1,borderBottomWidth:1,borderColor:'#e9dfd9',backgroundColor:'transparent',paddingHorizontal:0,paddingVertical:21},
  detailDeliveryPromisePremium:{height:'auto',backgroundColor:'transparent',paddingHorizontal:0,borderRadius:0},
  detailPricePremium:{fontFamily:'serif',fontSize:34,lineHeight:41,fontWeight:'700',letterSpacing:-.65},
  detailSavingPremium:{backgroundColor:'transparent',color:RED,paddingHorizontal:0,paddingVertical:0,borderRadius:0,letterSpacing:.75},
  detailAddPremium:{height:58,borderRadius:12,marginTop:22,shadowOpacity:.09,shadowRadius:11,shadowOffset:{width:0,height:5}},
  detailAddTextPremium:{fontSize:11,lineHeight:15,fontWeight:'800',letterSpacing:.45},
  infoTabsPremium:{height:54,marginTop:28,borderTopWidth:1,borderTopColor:'#e8dfda',borderBottomColor:'#e8dfda'},
  infoTabTextPremium:{fontSize:10,fontWeight:'600',letterSpacing:.55,textTransform:'uppercase'},
  detailFactPremium:{borderRadius:0,backgroundColor:'transparent',borderTopWidth:1,borderTopColor:'#ece5e0',paddingHorizontal:0,paddingVertical:13},
  deliveryRowPremium:{borderRadius:0,backgroundColor:'transparent',borderTopWidth:1,borderTopColor:'#ece5e0',paddingHorizontal:0,paddingVertical:16},
  variantVatLabel:{height:'auto',paddingHorizontal:0,borderRadius:0,backgroundColor:'transparent'},
  variantSectionIconPremium:{width:23,height:23,borderRadius:0,backgroundColor:'transparent'},
  variantCardShellPremium:{height:96,borderRadius:11,borderColor:'#ddd3cc',shadowOpacity:0,elevation:0},
  variantCardShellSelectedPremium:{borderWidth:1,borderColor:RED,backgroundColor:'#fff9fa',shadowOpacity:0,elevation:0},
  variantCardPressablePremium:{minHeight:94,borderRadius:10,paddingHorizontal:12,paddingVertical:12},
  variantSelectionPremium:{width:16,height:16,borderRadius:8,right:9,top:9},
  variantSizePremium:{fontFamily:'serif',fontSize:18,lineHeight:22,fontWeight:'700',letterSpacing:-.15},
  variantPricePremium:{fontSize:10,lineHeight:14,fontWeight:'800',marginTop:4},
  variantUnitPricePremium:{fontSize:6.5,lineHeight:9,color:'#8b7f78',marginTop:2},
  stickyPurchase:{position:'absolute',zIndex:30,left:0,right:0,bottom:0,minHeight:76,backgroundColor:'rgba(255,253,249,.985)',borderTopWidth:1,borderTopColor:'#e7ded8',paddingHorizontal:18,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:16,shadowColor:'#21140f',shadowOpacity:.055,shadowRadius:12,shadowOffset:{width:0,height:-4},elevation:8},
  stickyPurchaseSummary:{minWidth:82},
  stickyPurchaseSize:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.15,color:'#7b6f68'},
  stickyPurchasePrice:{fontFamily:'serif',fontSize:17,lineHeight:22,fontWeight:'700',color:'#171310',marginTop:2},
  stickyPurchaseButton:{flex:1,minHeight:52,borderRadius:11,backgroundColor:RED,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
  stickyPurchaseButtonText:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:1.05,color:'#fff'},
  stickyPurchaseUnavailable:{backgroundColor:'#292526'},
  stickyPurchasePressed:{opacity:.82,transform:[{scale:.985}]},
  detailGalleryPremium:{backgroundColor:'#fff',padding:0,borderBottomWidth:1,borderBottomColor:'#f1ece8'},
  detailGalleryLabel:{position:'absolute',left:84,right:116,top:27,height:28,alignItems:'center',justifyContent:'center',zIndex:3},
  detailGalleryLabelRule:{width:22,height:1,backgroundColor:RED,marginBottom:4},
  detailGalleryLabelText:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:1.45,color:'#625650'},
  detailImageStage:{...StyleSheet.absoluteFillObject,overflow:'hidden',backgroundColor:'#fff',paddingHorizontal:24,paddingVertical:14},
  detailImageStageTablet:{left:0,right:0,top:0,bottom:0,paddingHorizontal:42,paddingVertical:34},
  detailImageGlow:{position:'absolute',left:'19%',right:'19%',bottom:10,height:38,borderRadius:24,backgroundColor:'rgba(58,39,31,.04)',transform:[{scaleX:1.2}]},
  detailImagePremium:{zIndex:1,backgroundColor:'#fff'},
  detailFloatingActionsPremium:{right:14,top:14,gap:8,height:40,alignItems:'center'},
  detailFloatingActionPremium:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(255,253,249,.96)',borderWidth:1,borderColor:'#ebe4de',shadowColor:'#241913',shadowOpacity:.045,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:2},
  detailFloatingActionSelected:{backgroundColor:'#fff5f6',borderColor:'#efdce1'},
  detailFloatingActionPressed:{backgroundColor:'#f4efeb',transform:[{scale:.95}]},
  detailCartBadge:{position:'absolute',right:2,top:2,minWidth:13,height:13,borderRadius:7,backgroundColor:RED,paddingHorizontal:2,alignItems:'center',justifyContent:'center'},
  detailCartBadgeText:{fontSize:6,lineHeight:7,fontWeight:'900',color:'#fff'},
  detailFloatingBackPremium:{left:14,top:15},
  galleryArrowPremium:{width:42,height:42,borderRadius:21,backgroundColor:'rgba(255,255,255,.97)',borderWidth:1,borderColor:'#ebe5e1'},
  detailBadgePremium:{left:82,bottom:34,backgroundColor:'#211719',paddingHorizontal:9,paddingVertical:5},
  detailCounterPremium:{right:14,bottom:12,minWidth:42,height:27,borderRadius:14,backgroundColor:'rgba(58,55,53,.76)',paddingHorizontal:8},
  recommendations:{width:'94%',alignSelf:'center',marginTop:28,paddingTop:24,paddingBottom:12,borderTopWidth:1,borderTopColor:'#ddd'},recommendationHeading:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',marginBottom:16,paddingHorizontal:2},recommendationTitle:{fontFamily:'serif',fontSize:25,lineHeight:31,fontWeight:'700',marginTop:2},recommendationCount:{fontSize:10,color:'#777',paddingBottom:4},recommendationRow:{gap:12,paddingHorizontal:2,paddingBottom:12},galleryArrow:{position:'absolute',top:'48%',width:36,height:36,borderRadius:18,backgroundColor:'rgba(246,246,246,.92)',alignItems:'center',justifyContent:'center'},galleryArrowLeft:{left:10},galleryArrowRight:{right:10},
  detailScroll:{flexGrow:1,backgroundColor:'#fff',paddingBottom:36},detailContainer:{width:'100%',maxWidth:1050,alignSelf:'center'},detailLayout:{gap:12},detailLayoutTablet:{flexDirection:'row',alignItems:'flex-start',gap:22,paddingTop:18},detailGallery:{borderRadius:0,backgroundColor:'#fff',position:'relative',padding:16,overflow:'hidden'},detailGalleryTablet:{width:'52%',height:570,borderRadius:24},detailImage:{width:'100%',height:'100%'},detailFloatingAction:{width:54,height:54,borderRadius:27,backgroundColor:'rgba(247,247,247,.96)',alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.08,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:3},detailFloatingBack:{position:'absolute',left:18,top:18,zIndex:4},detailFloatingActions:{position:'absolute',right:18,top:18,zIndex:4,flexDirection:'row',gap:11},detailBadge:{position:'absolute',left:18,bottom:18,backgroundColor:'rgba(20,20,20,.78)',color:'#fff',fontSize:8,fontWeight:'900',letterSpacing:1,paddingHorizontal:11,paddingVertical:7,borderRadius:16,overflow:'hidden'},detailCounter:{position:'absolute',right:18,bottom:18,minWidth:66,height:42,borderRadius:22,backgroundColor:'rgba(48,48,48,.72)',paddingHorizontal:13,alignItems:'center',justifyContent:'center'},detailCounterText:{fontSize:11,lineHeight:14,fontWeight:'700',color:'#fff',letterSpacing:.1},detailInfo:{width:'94%',alignSelf:'center',marginHorizontal:0,borderRadius:20,backgroundColor:'#fff',padding:20,borderWidth:1,borderColor:'#eee8e4',shadowColor:'#2b1b17',shadowOpacity:.045,shadowRadius:12,shadowOffset:{width:0,height:6},elevation:2},detailInfoTablet:{flex:1,minHeight:570,width:'auto',marginHorizontal:0},detailBrandRow:{minHeight:21,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},detailBrandLockup:{flexDirection:'row',alignItems:'center',gap:8,flex:1,minWidth:0},detailBrandRule:{width:16,height:1,backgroundColor:RED},detailBrand:{fontSize:8,lineHeight:11,fontWeight:'800',letterSpacing:1.9,color:RED},stockPill:{height:25,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#edf7f0',borderWidth:1,borderColor:'#dcece1',paddingHorizontal:8,borderRadius:13},stockDot:{width:6,height:6,borderRadius:3,backgroundColor:'#18834d'},stockText:{fontSize:6.2,lineHeight:8,fontWeight:'900',color:'#176b43',letterSpacing:.65},stockTextMuted:{color:'#776b65'},detailName:{fontFamily:'serif',fontSize:26,lineHeight:31,fontWeight:'700',letterSpacing:-.2,color:'#171310',marginTop:8},detailRating:{alignSelf:'flex-start',minHeight:30,flexDirection:'row',alignItems:'center',gap:7,marginTop:10,paddingHorizontal:9,borderRadius:15,backgroundColor:'#fffbf2',borderWidth:1,borderColor:'#f1e5c9'},detailStars:{color:'#bd8200',letterSpacing:-.65,fontSize:10.5},detailReview:{fontSize:9.5,fontWeight:'800',color:'#332c28'},reviewDivider:{width:1,height:10,backgroundColor:'#ded5cf'},reviewLink:{fontSize:8.5,color:'#726760'},detailTags:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:11},detailTag:{minHeight:28,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#f6f2f0',borderWidth:1,borderColor:'#eee7e3',paddingHorizontal:9,borderRadius:14},detailTagText:{fontSize:8.5,lineHeight:11,color:'#5d514b',fontWeight:'700'},detailPricePanel:{marginTop:16,padding:14,borderRadius:15,backgroundColor:'#fbf8f6',borderWidth:1,borderColor:'#e9dfda'},detailPricePanelTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},priceLabel:{fontSize:7,lineHeight:10,color:'#7c6f68',fontWeight:'900',letterSpacing:1.35},detailDeliveryPromise:{height:22,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,borderRadius:11,backgroundColor:'#edf7f0'},detailDeliveryPromiseText:{fontSize:5.6,lineHeight:8,fontWeight:'900',letterSpacing:.65,color:'#176b43'},detailPriceRow:{flexDirection:'row',alignItems:'baseline',flexWrap:'wrap',gap:9,marginTop:5},detailOldPrice:{fontSize:11,color:'#9b8f89',textDecorationLine:'line-through'},detailPrice:{fontSize:29,lineHeight:34,fontWeight:'900',letterSpacing:-.5,color:'#171310'},detailSaving:{fontSize:7,color:'#fff',fontWeight:'900',backgroundColor:RED,paddingHorizontal:7,paddingVertical:4,borderRadius:8},detailTaxRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:3},detailTax:{fontSize:9,lineHeight:13,color:'#80736c'},purchaseBenefits:{flexDirection:'row',justifyContent:'space-between',gap:3,marginTop:13,paddingTop:12,borderTopWidth:1,borderTopColor:'#eee'},purchaseBenefit:{flex:1,alignItems:'center',justifyContent:'center',gap:4},purchaseBenefitText:{fontSize:8,color:'#555',textAlign:'center'},notesCard:{marginTop:17,borderTopWidth:1,borderTopColor:'#eee'},notesHeadingRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},notesEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.3,color:RED},notesTitle:{fontFamily:'serif',fontSize:20,lineHeight:26,fontWeight:'700',marginTop:2},notesDuration:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#f4f4f5',paddingHorizontal:8,paddingVertical:6,borderRadius:12},notesDurationText:{fontSize:7,fontWeight:'800',color:'#555'},notesText:{fontSize:11,lineHeight:18,color:'#666',marginTop:7},notePills:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:10},notePill:{fontSize:10,color:'#555',backgroundColor:'#f3f3f3',paddingHorizontal:9,paddingVertical:6,borderRadius:12},deliveryRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:15,padding:14,borderRadius:12,backgroundColor:'#fff3f6'},deliveryTitle:{fontSize:13,fontWeight:'800'},deliveryText:{fontSize:11,color:'#666',marginTop:2},detailAdd:{height:56,borderRadius:28,backgroundColor:RED,marginTop:15,flexDirection:'row',gap:9,alignItems:'center',justifyContent:'center',shadowColor:RED,shadowOpacity:.16,shadowRadius:8,elevation:3},detailAddText:{color:'#fff',fontSize:15,fontWeight:'900'},infoTabs:{height:48,marginTop:20,borderBottomWidth:1,borderBottomColor:'#ddd',flexDirection:'row'},infoTab:{flex:1,alignItems:'center',justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent'},infoTabActive:{borderBottomColor:RED},infoTabText:{fontSize:12,fontWeight:'700',color:'#888'},infoTabTextActive:{color:'#111',fontWeight:'900'},infoPanel:{paddingTop:14},detailFacts:{flexDirection:'row',gap:8,marginTop:14},detailFact:{flex:1,padding:11,borderRadius:9,backgroundColor:'#f6f6f6'},factLabel:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:1,color:'#888'},factValue:{fontSize:12,lineHeight:17,fontWeight:'800',marginTop:3},notePyramid:{position:'relative',marginTop:15,gap:8},noteTrailLine:{position:'absolute',left:24,top:35,bottom:35,width:1,backgroundColor:'#dedee1'},noteLevel:{minHeight:72,flexDirection:'row',alignItems:'center',gap:11,padding:11,borderRadius:13,backgroundColor:'#fafafa',borderWidth:1,borderColor:'#eeeeef'},noteIcon:{zIndex:1,width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},noteContent:{flex:1},noteLabelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},noteLabel:{fontSize:7,fontWeight:'900',letterSpacing:1.15},noteTiming:{fontSize:6,color:'#aaa',fontWeight:'800',letterSpacing:.7},noteValue:{fontSize:13,fontWeight:'900',marginTop:3,color:'#111'},noteDetail:{fontSize:8,color:'#777',marginTop:2},noteIndex:{width:22,height:22,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center'},noteIndexText:{fontSize:8,fontWeight:'900'},scentTrail:{marginTop:12,flexDirection:'row',alignItems:'center',gap:11,padding:12,borderRadius:13,backgroundColor:'#111'},scentTrailIcon:{width:31,height:31,borderRadius:16,backgroundColor:RED,alignItems:'center',justifyContent:'center'},scentTrailLabel:{fontSize:7,fontWeight:'900',letterSpacing:1.1,color:'#e5b9c4'},scentTrailText:{fontSize:10,lineHeight:15,color:'#fff',fontWeight:'600',marginTop:2},reviewHeadingRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:14},reviewEyebrow:{fontSize:8,fontWeight:'900',letterSpacing:1.35,color:RED},reviewHeading:{fontFamily:'serif',fontSize:19,lineHeight:25,fontWeight:'700',marginTop:2},reviewVerifiedPill:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#eff8f2',paddingHorizontal:8,paddingVertical:6,borderRadius:12},reviewVerifiedPillText:{fontSize:7,fontWeight:'800',color:'#168352'},reviewSummary:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:16,padding:15,borderRadius:14,backgroundColor:'#f7f7f8',borderWidth:1,borderColor:'#ececef'},reviewScoreBlock:{minWidth:105},reviewScore:{fontSize:42,lineHeight:45,fontWeight:'900',letterSpacing:-1.5},reviewStarsRow:{flexDirection:'row',alignItems:'center',gap:6},reviewSummaryStars:{color:'#d79a00',letterSpacing:-1,fontSize:12},reviewOutOf:{fontSize:8,color:'#888'},reviewCount:{fontSize:8,color:'#777',marginTop:4},reviewBars:{flex:1,gap:5},reviewBarRow:{flexDirection:'row',alignItems:'center',gap:4},reviewBarLabel:{width:7,fontSize:8,fontWeight:'700',color:'#555'},reviewBarTrack:{height:6,flex:1,borderRadius:4,backgroundColor:'#e2e2e5',overflow:'hidden'},reviewBarFill:{height:'100%',borderRadius:4,backgroundColor:'#d79a00'},reviewBarPercent:{width:23,fontSize:7,color:'#777',textAlign:'right'},reviewCard:{marginTop:12,padding:15,borderRadius:14,borderWidth:1,borderColor:'#ededee',backgroundColor:'#fff',shadowColor:'#111',shadowOpacity:.045,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:1},reviewCardTop:{flexDirection:'row',alignItems:'center'},reviewAvatar:{width:34,height:34,borderRadius:17,backgroundColor:'#111',alignItems:'center',justifyContent:'center'},reviewAvatarText:{fontSize:10,fontWeight:'900',color:'#fff',letterSpacing:.4},reviewAuthorInfo:{flex:1,marginLeft:9},reviewAuthorRow:{flexDirection:'row',alignItems:'center',gap:6},reviewAuthor:{fontSize:11,fontWeight:'900'},verified:{flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'#eff8f2',paddingHorizontal:5,paddingVertical:3,borderRadius:6},verifiedText:{fontSize:6,color:'#168352',fontWeight:'900'},reviewLocation:{fontSize:7,color:'#888',marginTop:2},reviewCardStars:{fontSize:10,color:'#d79a00',letterSpacing:-1},reviewTitle:{fontSize:12,fontWeight:'900',marginTop:13},reviewBody:{fontSize:10,lineHeight:16,color:'#555',marginTop:5},reviewProductTag:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,marginTop:11,paddingHorizontal:8,paddingVertical:5,borderRadius:8,backgroundColor:'#f5f5f6'},reviewProductTagText:{fontSize:7,color:'#666',fontWeight:'700'},
  luxNotesHeader:{flexDirection:'row',alignItems:'center',gap:9},luxNotesRule:{height:1,flex:1,backgroundColor:'#d9d4ce'},luxNotesEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.6,color:'#6c6259'},luxNotesTitleRow:{flexDirection:'row',alignItems:'center',gap:14,marginTop:13},luxNotesTitle:{fontFamily:'serif',fontSize:23,lineHeight:28,fontWeight:'700',letterSpacing:-.2},luxNotesSubtitle:{fontSize:8,color:'#8b8178',fontWeight:'700',letterSpacing:.25,marginTop:3},luxEdpSeal:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:'#b9afa5',alignItems:'center',justifyContent:'center'},luxEdpText:{fontSize:6,lineHeight:8,textAlign:'center',color:'#655c54',fontWeight:'900',letterSpacing:.55},luxNotesIntro:{fontSize:10,lineHeight:17,color:'#645f5a',marginTop:11,paddingRight:4},luxPyramid:{alignItems:'center',gap:6,marginTop:17},luxNoteCard:{minHeight:70,borderRadius:4,borderWidth:1,paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',overflow:'hidden'},luxNoteTop:{backgroundColor:'#fbf8f2',borderColor:'#e9e1d5'},luxNoteHeart:{backgroundColor:'#efede9',borderColor:'#dfdbd5'},luxNoteBase:{backgroundColor:'#151515',borderColor:'#151515'},luxNoteNumber:{width:31,fontFamily:'serif',fontSize:17,color:'#aaa096'},luxNoteCopy:{flex:1,borderLeftWidth:1,borderLeftColor:'rgba(140,130,120,.3)',paddingLeft:11},luxNoteMeta:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},luxNoteLabel:{fontSize:6,fontWeight:'900',letterSpacing:1.2,color:'#766b61'},luxNoteLabelDark:{color:'#d5b8bf'},luxNotePhase:{fontSize:5,fontWeight:'800',letterSpacing:.8,color:'#aaa098'},luxNotePhaseDark:{color:'#817b7d'},luxNoteValue:{fontFamily:'serif',fontSize:15,lineHeight:20,fontWeight:'700',color:'#171717',marginTop:3},luxNoteTextDark:{color:'#fff'},luxProfile:{minHeight:39,marginTop:13,borderTopWidth:1,borderBottomWidth:1,borderColor:'#e2dfdc',flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:3},luxProfileLabel:{fontSize:6,fontWeight:'900',letterSpacing:1.1,color:'#82786f'},luxProfileDivider:{width:1,height:14,backgroundColor:'#d7d2cd'},luxProfileItem:{flexDirection:'row',alignItems:'center',gap:4},luxProfileDot:{width:5,height:5,borderRadius:3,backgroundColor:'#c8a768'},luxProfileText:{fontSize:6,fontWeight:'800',letterSpacing:.65,color:'#5f5953'},
  railSection:{marginTop:24,marginHorizontal:-20,paddingTop:24,paddingBottom:24,backgroundColor:'#f4f1ee',overflow:'hidden'},railSectionDark:{backgroundColor:'#ddd9d5',paddingTop:30,paddingBottom:22,borderTopWidth:1,borderBottomWidth:1,borderColor:'#cbc6c1'},railBackgroundImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%',opacity:.13},railHeading:{paddingHorizontal:20,marginBottom:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},railTitle:{fontFamily:'serif',fontSize:28,lineHeight:33,fontWeight:'700',marginTop:3,color:'#111',letterSpacing:-.5},sectionSubtitle:{fontSize:10,lineHeight:15,color:'#777',marginTop:4},railEyebrowDark:{color:'#b7183a'},railTextDark:{color:'#171412'},railSubtitleDark:{color:'#625d58'},railFormatRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:9},railFormatText:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:1.05,color:'#7d6c62'},railCount:{width:40,height:40,borderRadius:20,borderWidth:1,borderColor:'#bbb',alignItems:'center',justifyContent:'center'},railCountDark:{width:48,height:48,borderRadius:24,borderColor:'#aca59f',backgroundColor:'rgba(255,255,255,.52)'},railCountText:{fontFamily:'serif',fontSize:11,lineHeight:13,fontWeight:'900',color:'#111'},railCountLabel:{fontSize:4.5,fontWeight:'900',letterSpacing:.65,color:'#8a817b'},railCountLabelDark:{fontSize:4.5,fontWeight:'900',letterSpacing:.65,color:'#726a64'},railProducts:{paddingHorizontal:20,paddingBottom:10,gap:14},railSwipeCue:{paddingHorizontal:20,marginTop:13,flexDirection:'row',alignItems:'center',gap:9},railSwipeLine:{width:31,height:2,borderRadius:2,backgroundColor:RED},railSwipeText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.3,color:'#5f5853'},selectionCount:{fontSize:9,fontWeight:'800',color:'#777',paddingBottom:4},showMoreButton:{height:52,marginTop:20,borderRadius:26,borderWidth:1.5,borderColor:'#111',backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},showMoreText:{fontSize:13,fontWeight:'900',color:'#111'},allLoaded:{marginTop:19,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},allLoadedText:{fontSize:10,color:'#777'},
  collectionNav:{marginHorizontal:-20,paddingTop:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'#ece9e6',backgroundColor:'#fff'},collectionNavHead:{paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11},collectionNavLabel:{fontSize:8,fontWeight:'900',letterSpacing:1.45,color:'#111'},collectionNavMeta:{fontSize:7,color:'#918982',letterSpacing:.25},collectionFilterRow:{paddingHorizontal:20,gap:7},collectionFilter:{height:36,paddingHorizontal:15,borderRadius:18,borderWidth:1,borderColor:'#d9d5d1',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},collectionFilterActive:{backgroundColor:'#111',borderColor:'#111'},collectionFilterText:{fontSize:11,fontWeight:'700',color:'#4e4945'},collectionFilterTextActive:{color:'#fff'},discoverySection:{marginHorizontal:-20,paddingTop:27,paddingBottom:20,backgroundColor:'#f7f5f2',borderBottomWidth:1,borderBottomColor:'#e8e3df'},discoveryHeader:{marginBottom:17,marginRight:20,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},discoveryHeadingCopy:{flex:1,minWidth:0},discoveryEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.75,color:RED},discoveryTitle:{fontFamily:'serif',fontSize:25,lineHeight:29,fontWeight:'700',letterSpacing:-.25,color:'#111',marginTop:4},discoveryHint:{fontSize:9.5,lineHeight:14,color:'#817a74',marginTop:3},discoveryControls:{flexDirection:'row',alignItems:'center',gap:5},discoveryControl:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'#cdc6c0',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},discoveryControlDark:{backgroundColor:'#111',borderColor:'#111'},discoveryControlDisabled:{opacity:.42},discoveryCounter:{minWidth:37,alignItems:'center',justifyContent:'center'},discoveryCounterCurrent:{fontFamily:'serif',fontSize:14,fontWeight:'700',lineHeight:16},discoveryCounterTotal:{fontSize:6,color:'#8b837c',fontWeight:'900',letterSpacing:.6},discoveryEdition:{width:46,height:46,borderRadius:23,borderWidth:1,borderColor:'#cec7c1',backgroundColor:'rgba(255,255,255,.64)',alignItems:'center',justifyContent:'center'},discoveryEditionText:{fontFamily:'serif',fontSize:16,lineHeight:17,fontWeight:'700'},discoveryEditionLabel:{fontSize:5,fontWeight:'900',letterSpacing:1,color:'#8c837c'},discoveryGrid:{paddingHorizontal:20,paddingBottom:14,gap:12},discoveryCard:{width:284,height:218,borderRadius:19,overflow:'hidden',backgroundColor:'#111',justifyContent:'space-between',borderWidth:1,borderColor:'rgba(25,20,18,.12)',shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:.2,shadowRadius:14,elevation:6},discoveryCardPressed:{opacity:.88,transform:[{scale:.975}]},discoveryCardImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},discoveryCardShade:{...StyleSheet.absoluteFillObject},discoveryCardTop:{padding:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},discoveryCollectionMark:{height:30,paddingHorizontal:10,borderRadius:15,backgroundColor:'rgba(8,8,8,.6)',borderWidth:1,borderColor:'rgba(255,255,255,.24)',flexDirection:'row',alignItems:'center',gap:7},discoveryCollectionNumber:{fontSize:7,fontWeight:'900',letterSpacing:1.05,color:'#fff'},discoveryArrow:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'rgba(255,255,255,.62)',backgroundColor:'rgba(8,8,8,.36)',alignItems:'center',justifyContent:'center'},discoveryCopy:{paddingHorizontal:16,paddingBottom:15},discoveryKicker:{fontSize:6.5,lineHeight:10,fontWeight:'900',letterSpacing:1.5,color:'#ff6f8d',marginBottom:4},discoveryLabel:{fontFamily:'serif',fontSize:24,lineHeight:28,fontWeight:'700',letterSpacing:-.25,color:'#fff'},discoveryMeta:{maxWidth:230,fontSize:10,lineHeight:14,color:'rgba(255,255,255,.8)',marginTop:3},discoveryCardFooter:{marginTop:10,flexDirection:'row',alignItems:'center',gap:9},discoveryActionLabel:{fontSize:6.5,fontWeight:'900',letterSpacing:1.25,color:'#fff'},discoveryFooterRule:{height:1,flex:1,maxWidth:54,backgroundColor:RED},discoverySwipeHint:{paddingHorizontal:20,flexDirection:'row',alignItems:'center',gap:10},discoveryProgress:{flexDirection:'row',alignItems:'center',gap:5},discoveryProgressDot:{width:6,height:3,borderRadius:2,backgroundColor:'#c8c0ba'},discoveryProgressDotActive:{width:27,backgroundColor:RED},discoverySwipeText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.35,color:'#756d67'},
  collectionPageScroll:{paddingBottom:36,backgroundColor:'#f5f3f1'},collectionPageContainer:{width:'94%',maxWidth:980,alignSelf:'center'},collectionBack:{height:54,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:8},collectionBackText:{fontSize:12,fontWeight:'900',color:'#111'},collectionHero:{height:300,borderRadius:22,overflow:'hidden',backgroundColor:'#111',justifyContent:'space-between',shadowColor:'#000',shadowOffset:{width:0,height:9},shadowOpacity:.2,shadowRadius:16,elevation:6},collectionHeroImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},collectionHeroTop:{padding:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},collectionHeroSeal:{height:31,paddingHorizontal:11,borderRadius:16,backgroundColor:'rgba(8,8,8,.58)',borderWidth:1,borderColor:'rgba(255,255,255,.28)',flexDirection:'row',alignItems:'center',gap:7},collectionHeroSealText:{fontSize:7,fontWeight:'900',letterSpacing:1.05,color:'#fff'},collectionHeroCount:{fontSize:7,fontWeight:'900',letterSpacing:1.1,color:'#fff',backgroundColor:'rgba(8,8,8,.48)',paddingHorizontal:9,paddingVertical:7,borderRadius:12},collectionHeroCopy:{padding:20},collectionHeroKicker:{fontSize:8,fontWeight:'900',letterSpacing:1.7,color:'#ff7895'},collectionHeroTitle:{fontFamily:'serif',fontSize:36,lineHeight:42,fontWeight:'700',letterSpacing:-.5,color:'#fff',marginTop:4},collectionHeroDescription:{fontSize:12,lineHeight:18,color:'rgba(255,255,255,.8)',maxWidth:430,marginTop:5},collectionPromiseRow:{minHeight:75,marginTop:14,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#e8e3df',paddingHorizontal:15,flexDirection:'row',alignItems:'center',shadowColor:'#000',shadowOpacity:.04,shadowRadius:8,elevation:1},collectionPromise:{flex:1,flexDirection:'row',alignItems:'center',gap:9},collectionPromiseDivider:{width:1,height:34,backgroundColor:'#e8e3df',marginHorizontal:10},collectionPromiseTitle:{fontSize:10,fontWeight:'900',color:'#111'},collectionPromiseText:{fontSize:8,color:'#777',marginTop:2},collectionProductsHeader:{marginTop:28,marginBottom:16,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12},collectionProductsTitle:{fontFamily:'serif',fontSize:27,lineHeight:32,fontWeight:'700',marginTop:3},collectionProductsSubtitle:{fontSize:10,lineHeight:15,color:'#777',marginTop:3},collectionProductCount:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:'#cfc8c2',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},collectionProductCountNumber:{fontFamily:'serif',fontSize:15,lineHeight:17,fontWeight:'700'},collectionProductCountLabel:{fontSize:5,fontWeight:'900',letterSpacing:.75,color:'#827a74'},collectionEmpty:{minHeight:230,borderRadius:18,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',padding:30},collectionEmptyTitle:{fontFamily:'serif',fontSize:21,fontWeight:'700',marginTop:12},collectionEmptyText:{fontSize:11,lineHeight:17,color:'#777',textAlign:'center',maxWidth:300,marginTop:5},collectionContinue:{height:54,marginTop:22,borderRadius:27,backgroundColor:'#111',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},collectionContinueText:{fontSize:13,fontWeight:'900',color:'#fff'},
  helpHeaderProfessional:{padding:22,borderColor:'#e4dcd7',shadowColor:'#2a1b16',shadowOpacity:.06,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},helpHeaderRule:{height:1,backgroundColor:'#eee7e2',marginBottom:17},helpTitleProfessional:{fontSize:30,lineHeight:35},helpSubtitleProfessional:{fontSize:11.5,lineHeight:18},supportHeroProfessional:{minHeight:118,padding:18,overflow:'hidden'},supportHeroGlow:{position:'absolute',right:-35,top:-55,width:145,height:145,borderRadius:73,backgroundColor:'rgba(215,25,63,.2)'},supportIconProfessional:{width:48,height:48,borderRadius:16},supportStatusProfessional:{fontSize:6.5,letterSpacing:1.15},supportTitleProfessional:{fontSize:20,lineHeight:24},supportTextProfessional:{fontSize:10,lineHeight:15},supportResponse:{marginTop:7,flexDirection:'row',alignItems:'center',gap:4},supportResponseText:{fontSize:7.5,color:'rgba(255,255,255,.58)'},helpRowProfessional:{minHeight:78,paddingHorizontal:13,borderColor:'#e5ddd8',shadowOpacity:.055,shadowRadius:9},helpRowNumber:{width:19,fontFamily:'serif',fontSize:9,color:'#b3a7a0'},helpRowIconProfessional:{width:42,height:42,borderRadius:14},helpTextProfessional:{fontSize:13.5},helpMetaProfessional:{fontSize:9.5,lineHeight:14},helpContactProfessional:{minHeight:112,backgroundColor:'#eee4df',borderWidth:1,borderColor:'#e4d7d0'},helpContactTextProfessional:{fontSize:9,lineHeight:14},helpContactButtonProfessional:{height:44,borderRadius:22,paddingHorizontal:15},
  menuHeaderProfessional:{minHeight:276,borderWidth:0,overflow:'hidden',padding:22,shadowColor:'#1b0b09',shadowOpacity:.2,shadowRadius:16,shadowOffset:{width:0,height:8},elevation:5},menuHeaderGlow:{position:'absolute',right:-65,top:-85,width:220,height:220,borderRadius:110,backgroundColor:'rgba(215,25,63,.2)'},menuBagProfessional:{backgroundColor:'rgba(255,255,255,.09)',borderWidth:1,borderColor:'rgba(255,255,255,.18)'},menuEyebrowProfessional:{color:'#ff8fa9'},menuTitleProfessional:{color:'#fff',fontSize:31,lineHeight:36,maxWidth:360},menuSubtitleProfessional:{color:'rgba(255,255,255,.68)',fontSize:11,lineHeight:17},menuHeaderPromises:{height:34,marginTop:18,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.13)',flexDirection:'row',alignItems:'flex-end'},menuHeaderPromise:{flexDirection:'row',alignItems:'center',gap:5},menuHeaderPromiseText:{fontSize:5.7,fontWeight:'900',letterSpacing:1,color:'rgba(255,255,255,.68)'},menuHeaderPromiseDivider:{width:1,height:14,backgroundColor:'rgba(255,255,255,.16)',marginHorizontal:12},menuFeaturedProfessional:{height:215,marginTop:14},menuFeaturedNumber:{position:'absolute',right:15,top:20,fontSize:6,fontWeight:'900',letterSpacing:1.1,color:'rgba(255,255,255,.65)'},menuFeaturedActionProfessional:{alignSelf:'flex-start',height:28,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,.35)',paddingHorizontal:10},menuSectionSubtitle:{fontFamily:'serif',fontSize:19,lineHeight:23,fontWeight:'700',color:'#171310',marginTop:3},menuItemProfessional:{minHeight:150,padding:15,borderColor:'#e4dbd6',shadowOpacity:.055,shadowRadius:9},menuItemTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},menuIconProfessional:{backgroundColor:'#f8ecef'},menuItemNumber:{fontFamily:'serif',fontSize:9,color:'#b5a9a2'},menuLabelProfessional:{fontFamily:'serif',fontSize:16,lineHeight:20,fontWeight:'700',marginTop:14},menuMetaProfessional:{fontSize:9,lineHeight:13},menuArrowProfessional:{backgroundColor:'#171310',width:31,height:31,borderRadius:16},
  offerPageSeal:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,255,255,.1)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center'},offerPageCta:{height:42,alignSelf:'flex-start',borderRadius:21,marginTop:19,backgroundColor:'#fff',paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:9},offerPageCtaText:{fontSize:7,fontWeight:'900',letterSpacing:1.1,color:'#111'},offerPageHeading:{marginTop:24,marginBottom:14,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between'},offerPageNote:{minHeight:66,marginTop:14,borderRadius:15,backgroundColor:'#fff0f4',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:10},offerPageNoteText:{flex:1,fontSize:9,lineHeight:14,color:'#71656a'},
  accountLuxuryHero:{minHeight:350,borderRadius:24,overflow:'hidden',padding:21,shadowColor:'#21090d',shadowOpacity:.22,shadowRadius:18,shadowOffset:{width:0,height:9},elevation:5},accountLuxuryGlow:{position:'absolute',right:-70,top:-75,width:230,height:230,borderRadius:115,backgroundColor:'rgba(215,25,63,.24)'},accountLuxuryBrand:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},accountLuxurySecure:{height:27,borderRadius:14,backgroundColor:'rgba(74,176,111,.13)',borderWidth:1,borderColor:'rgba(126,219,160,.18)',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5},accountLuxurySecureText:{fontSize:5.3,fontWeight:'900',letterSpacing:.9,color:'#9ce1b7'},accountLuxuryRule:{height:1,backgroundColor:'rgba(255,255,255,.12)',marginVertical:18},accountLuxuryEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.55,color:'#ff8fa9'},accountLuxuryTitle:{fontFamily:'serif',fontSize:34,lineHeight:37,fontWeight:'700',letterSpacing:-.6,color:'#fff',marginTop:5},accountLuxuryText:{maxWidth:390,fontSize:10.5,lineHeight:16,color:'rgba(255,255,255,.67)',marginTop:7},accountLuxuryStats:{minHeight:66,marginTop:21,borderRadius:17,backgroundColor:'rgba(255,255,255,.07)',borderWidth:1,borderColor:'rgba(255,255,255,.1)',paddingHorizontal:8,flexDirection:'row',alignItems:'center'},accountLuxuryStat:{flex:1,alignItems:'center',justifyContent:'center',gap:2},accountLuxuryStatValue:{fontFamily:'serif',fontSize:13,fontWeight:'700',color:'#fff'},accountLuxuryStatLabel:{fontSize:4.8,fontWeight:'900',letterSpacing:.85,color:'rgba(255,255,255,.48)'},accountLuxuryStatDivider:{width:1,height:29,backgroundColor:'rgba(255,255,255,.12)'},
  accountAccessCard:{marginTop:13,borderRadius:23,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5dcd7',padding:18,shadowColor:'#2c1d18',shadowOpacity:.08,shadowRadius:15,shadowOffset:{width:0,height:7},elevation:3},accountModeSwitch:{height:44,borderRadius:14,backgroundColor:'#f2edeb',padding:4,flexDirection:'row',marginBottom:19},accountModeTab:{flex:1,borderRadius:10,alignItems:'center',justifyContent:'center'},accountModeTabActive:{backgroundColor:'#fff',shadowColor:'#2c1d18',shadowOpacity:.09,shadowRadius:6,shadowOffset:{width:0,height:2},elevation:2},accountModeText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.05,color:'#91857e'},accountModeTextActive:{color:'#171310'},accountAccessHeading:{flexDirection:'row',alignItems:'center',gap:11},accountAccessIcon:{width:44,height:44,borderRadius:15,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},accountAccessEyebrow:{fontSize:6.3,fontWeight:'900',letterSpacing:1.25,color:RED},accountAccessTitle:{fontFamily:'serif',fontSize:21,lineHeight:25,fontWeight:'700',color:'#171310',marginTop:2},accountAccessIntro:{fontSize:9.5,lineHeight:14.5,color:'#786e68',marginTop:12,marginBottom:16},accountAccessInput:{height:56,borderRadius:15,marginTop:8,paddingLeft:6,paddingRight:6,gap:6},accountInputIcon:{width:38,height:38,borderRadius:12,backgroundColor:'#f2edeb',alignItems:'center',justifyContent:'center'},accountInputClear:{width:30,height:30,borderRadius:15,backgroundColor:'#eee8e5',alignItems:'center',justifyContent:'center'},accountAccessButton:{height:56,borderRadius:28,marginTop:14},accountSecurityRow:{minHeight:47,marginTop:14,borderTopWidth:1,borderBottomWidth:1,borderColor:'#eee7e3',flexDirection:'row',alignItems:'center'},accountSecurityItem:{flex:1,alignItems:'center',justifyContent:'center',gap:3},accountSecurityText:{fontSize:5.8,fontWeight:'800',color:'#6b766d'},
  accountExperience:{marginTop:13,borderRadius:23,backgroundColor:'#f0e7e3',padding:18},accountExperienceHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},accountExperienceTitle:{fontFamily:'serif',fontSize:22,lineHeight:27,fontWeight:'700',color:'#171310',marginTop:3},accountExperienceBadge:{width:43,height:43,borderRadius:15,backgroundColor:RED,alignItems:'center',justifyContent:'center'},accountExperienceRow:{minHeight:69,borderTopWidth:1,borderTopColor:'rgba(73,54,47,.1)',flexDirection:'row',alignItems:'center',gap:10},accountExperienceNumber:{fontFamily:'serif',fontSize:8,color:'#a59389'},accountExperienceIcon:{width:37,height:37,borderRadius:13,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},accountExperienceRowTitle:{fontSize:10.5,fontWeight:'900',color:'#171310'},accountExperienceRowText:{fontSize:7.8,lineHeight:11.5,color:'#796d66',marginTop:2},accountExplore:{height:48,borderRadius:24,backgroundColor:'#171310',marginTop:10,paddingHorizontal:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},accountExploreText:{fontSize:6.8,fontWeight:'900',letterSpacing:1.1,color:'#fff'},
  formInputWrapFocused:{borderColor:'#3b312c',borderWidth:1.5,backgroundColor:'#fff'},formInputWrapError:{borderColor:RED,backgroundColor:'#fff8fa'},formInlineMessage:{marginTop:7,marginLeft:3,flexDirection:'row',alignItems:'center',gap:5},formErrorText:{fontSize:9,color:RED,fontWeight:'700'},signInButtonSent:{backgroundColor:'#176b43'},formSuccess:{marginTop:12,borderRadius:14,backgroundColor:'#edf8f1',borderWidth:1,borderColor:'#d4eddd',padding:12,flexDirection:'row',alignItems:'center',gap:10},formSuccessIcon:{width:34,height:34,borderRadius:17,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},formSuccessTitle:{fontSize:10,fontWeight:'900',color:'#176b43'},formSuccessText:{fontSize:8.5,lineHeight:13,color:'#52715e',marginTop:2},accountJoin:{minHeight:210,marginTop:12,borderRadius:20,backgroundColor:'#171310',padding:20,overflow:'hidden'},accountJoinTop:{flexDirection:'row',alignItems:'center',gap:9},accountJoinMark:{width:36,height:36,borderRadius:18,backgroundColor:RED,alignItems:'center',justifyContent:'center'},accountJoinKicker:{fontSize:7,fontWeight:'900',letterSpacing:1.4,color:'#ff91a9'},accountJoinTitle:{fontFamily:'serif',fontSize:23,lineHeight:28,fontWeight:'700',color:'#fff',marginTop:15},accountJoinText:{fontSize:9.5,lineHeight:15,color:'rgba(255,255,255,.65)',marginTop:5,maxWidth:410},accountJoinButton:{height:38,alignSelf:'flex-start',borderRadius:19,borderWidth:1,borderColor:'rgba(255,255,255,.28)',paddingHorizontal:13,marginTop:16,flexDirection:'row',alignItems:'center',gap:8},accountJoinButtonText:{fontSize:6.5,fontWeight:'900',letterSpacing:1.1,color:'#fff'},
  accountJoinPremium:{minHeight:286,padding:21,shadowColor:'#21090d',shadowOpacity:.2,shadowRadius:16,shadowOffset:{width:0,height:8},elevation:4},accountJoinGlow:{position:'absolute',right:-65,top:-85,width:210,height:210,borderRadius:105,backgroundColor:'rgba(215,25,63,.18)'},accountJoinMarkPremium:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,.18)',backgroundColor:'rgba(215,25,63,.78)'},accountJoinMembership:{fontSize:5.5,fontWeight:'800',letterSpacing:1,color:'rgba(255,255,255,.52)',marginTop:3},accountJoinEdition:{width:31,height:31,borderRadius:16,borderWidth:1,borderColor:'rgba(255,255,255,.18)',alignItems:'center',justifyContent:'center'},accountJoinEditionText:{fontFamily:'serif',fontSize:9,fontWeight:'700',color:'#fff'},accountJoinTitlePremium:{fontSize:26,lineHeight:31,marginTop:18},accountJoinTextPremium:{fontSize:10,lineHeight:16,maxWidth:390},accountJoinBenefits:{minHeight:55,marginTop:15,borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(255,255,255,.12)',flexDirection:'row',alignItems:'center'},accountJoinBenefit:{flex:1,alignItems:'center',justifyContent:'center',gap:4},accountJoinBenefitText:{fontSize:5.2,fontWeight:'900',letterSpacing:.65,color:'rgba(255,255,255,.68)',textAlign:'center'},accountJoinBenefitDivider:{width:1,height:23,backgroundColor:'rgba(255,255,255,.12)'},accountJoinButtonPremium:{height:46,alignSelf:'stretch',borderRadius:23,borderWidth:0,backgroundColor:'#fff',paddingLeft:17,paddingRight:5,marginTop:16,justifyContent:'space-between'},accountJoinButtonTextPremium:{fontSize:7,color:'#171310'},accountJoinButtonArrow:{width:36,height:36,borderRadius:18,backgroundColor:'#f1ebe8',alignItems:'center',justifyContent:'center'},
  accountJoinLockup:{flex:1,minWidth:0},accountJoinNameRow:{flexDirection:'row',alignItems:'center',gap:7},accountJoinBrandName:{fontFamily:'serif',fontSize:12,lineHeight:15,fontWeight:'700',letterSpacing:.35,color:'#fff'},accountJoinNameRule:{width:14,height:1,backgroundColor:RED},accountJoinPriveName:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.5,color:'#ff91a9'},
  contactChannels:{marginTop:13,flexDirection:'row',flexWrap:'wrap',gap:8},contactChannel:{minWidth:130,flexGrow:1,minHeight:56,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3dad5',paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:9},contactChannelIcon:{width:36,height:36,borderRadius:12,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},contactChannelText:{flex:1,fontSize:11,fontWeight:'900',color:'#171310'},
  policyUnavailable:{minHeight:96,marginTop:12,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5ddd8',padding:14,flexDirection:'row',alignItems:'flex-start',gap:11},
  adviceRecommendations:{marginTop:20,borderRadius:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#e4dbd6',padding:15},adviceProduct:{minHeight:82,borderTopWidth:1,borderTopColor:'#eee7e3',flexDirection:'row',alignItems:'center',gap:11},adviceProductImage:{width:62,height:62,backgroundColor:'#faf8f6'},adviceProductBrand:{fontSize:7,fontWeight:'900',letterSpacing:.8,color:RED},adviceProductName:{fontFamily:'serif',fontSize:15,lineHeight:18,fontWeight:'700',marginTop:2},adviceProductPrice:{fontSize:10,fontWeight:'900',marginTop:3},adviceDisclaimer:{fontSize:8.5,lineHeight:13,color:'#7c716a',marginTop:9},
  searchClear:{width:36,height:36,borderRadius:18,backgroundColor:'#e9e1dd',alignItems:'center',justifyContent:'center',flexShrink:0},headerBadge:{position:'absolute',right:1,top:1,minWidth:16,height:16,borderRadius:8,backgroundColor:RED,borderWidth:2,borderColor:'#fff',paddingHorizontal:3,alignItems:'center',justifyContent:'center'},headerBadgeText:{fontSize:7,lineHeight:9,fontWeight:'900',color:'#fff'},
  catalogPriceRtl:{alignItems:'flex-end'},catalogLabelRtl:{textAlign:'right',writingDirection:'rtl',letterSpacing:0},
  newsletterFormError:{borderColor:'#ff6b82',backgroundColor:'#fff7f8'},newsletterButtonSuccess:{backgroundColor:'#176b43'},newsletterError:{width:'100%',fontSize:8.5,lineHeight:13,fontWeight:'700',color:'#ff9bad',marginTop:7},newsletterSuccess:{width:'100%',fontSize:8.5,lineHeight:13,fontWeight:'700',color:'#8be0ad',marginTop:7},signInButtonLoading:{opacity:.82},
  centeredCatalogPriceStack:{width:'100%',alignItems:'center'},standardCatalogCard:{minHeight:438},standardCatalogInfo:{paddingBottom:132},standardCatalogFooter:{left:0,right:0,bottom:0,minHeight:118,borderTopColor:'#eee3dd',paddingTop:11,paddingBottom:12,paddingHorizontal:13,backgroundColor:'#fffaf8',flexDirection:'column',alignItems:'stretch',gap:8},standardCatalogFrom:{fontSize:6.5,lineHeight:9,letterSpacing:1.2,color:'#94847c',textAlign:'center'},standardCatalogPrice:{fontSize:21,lineHeight:26,letterSpacing:-.25,textAlign:'center'},standardCatalogQuickAdd:{width:'100%',height:44,borderRadius:13,backgroundColor:'#d7193f',flexDirection:'row',gap:7,shadowColor:'#a80f2e',shadowOpacity:.16,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:3},standardCatalogQuickAddText:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:.65,color:'#fff',textTransform:'uppercase'},
  railCatalogCard:{minHeight:498,borderRadius:21,borderWidth:1,borderColor:'rgba(204,181,142,.72)',backgroundColor:'#fffdfa',shadowColor:'#755833',shadowOpacity:.17,shadowRadius:16,shadowOffset:{width:0,height:8},elevation:5},railCatalogImageWrap:{height:202,padding:20,backgroundColor:'#f8f5ef',borderBottomColor:'#e9e0d1'},railCatalogBadge:{height:26,paddingTop:7.5,backgroundColor:'#271d1f',color:'#f2d48e',borderWidth:1,borderColor:'rgba(224,188,110,.24)'},railCatalogHeart:{right:11,top:11,width:43,height:43,borderRadius:15,borderWidth:1,borderColor:'#e9e0d4',backgroundColor:'#fffdf9'},railCatalogInfo:{paddingHorizontal:16,paddingTop:16,paddingBottom:146},railCatalogBrand:{fontSize:9.5,lineHeight:14,color:'#7a6241'},railCatalogName:{fontSize:18,lineHeight:22,minHeight:56,marginTop:5},railCatalogFooter:{left:0,right:0,bottom:0,minHeight:132,borderTopColor:'#eadfce',paddingTop:13,paddingBottom:13,paddingHorizontal:16,backgroundColor:'#fff9f1',flexDirection:'column',alignItems:'stretch',gap:10},railCatalogFrom:{fontSize:6.5,lineHeight:9,letterSpacing:1.35,color:'#927b66'},railCatalogPrice:{fontSize:23,lineHeight:28,letterSpacing:-.35,color:'#201719'},railCatalogQuickAdd:{width:'100%',height:48,borderRadius:14,backgroundColor:'#aa1231',flexDirection:'row',gap:8,shadowColor:'#7e0b23',shadowOpacity:.18,shadowRadius:8,shadowOffset:{width:0,height:4},elevation:3},railCatalogQuickAddText:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:.8,color:'#fff',textTransform:'uppercase'},
  discoveryBrandMark:{width:88,height:34,borderRadius:17,backgroundColor:'rgba(7,7,7,.48)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center',paddingTop:1},discoveryBrandCountry:{fontSize:4.3,lineHeight:6,fontWeight:'900',letterSpacing:1.35,color:'rgba(255,255,255,.68)',marginTop:-7},
  supportPage:{flex:1,backgroundColor:'#f7f4f2'},supportPageScroll:{paddingTop:18,paddingBottom:32},supportPageContainer:{maxWidth:620},carePageHeader:{borderRadius:24,backgroundColor:'#fffdfb',borderWidth:1,borderColor:'#e8ddd7',paddingHorizontal:19,paddingVertical:18,shadowColor:'#2a1915',shadowOpacity:.045,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:1},carePageTop:{height:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:15},careBack:{width:42,height:42,borderRadius:15,backgroundColor:'#f5f1ef',borderWidth:1,borderColor:'#eee6e1',alignItems:'center',justifyContent:'center'},careSecure:{minWidth:72,height:32,borderRadius:16,backgroundColor:'#edf8f1',paddingHorizontal:9,flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center'},careSecureText:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:.9,color:'#176b43'},carePageEyebrow:{fontSize:7,fontWeight:'900',letterSpacing:1.6,color:RED},carePageTitle:{fontFamily:'serif',fontSize:30,lineHeight:35,fontWeight:'700',color:'#171310',marginTop:4,letterSpacing:-.35},carePageSubtitle:{fontSize:10.5,lineHeight:16,color:'#756a64',marginTop:6,maxWidth:440},
  careFormCard:{marginTop:13,borderRadius:21,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5dcd7',padding:18,shadowColor:'#291914',shadowOpacity:.06,shadowRadius:12,shadowOffset:{width:0,height:6}},careFormIcon:{width:47,height:47,borderRadius:16,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},careFormTitle:{fontFamily:'serif',fontSize:21,lineHeight:26,fontWeight:'700',color:'#171310',marginTop:14},careFormText:{fontSize:9.5,lineHeight:14,color:'#7c716a',marginTop:3,marginBottom:10},careFieldLabel:{fontSize:6.5,fontWeight:'900',letterSpacing:1.25,color:'#71665f',marginTop:12},careInput:{height:50,borderRadius:13,borderWidth:1,borderColor:'#d8cfca',backgroundColor:'#fcfbfa',paddingHorizontal:13,fontSize:12,color:'#211c19',marginTop:7},careError:{minHeight:43,borderRadius:12,backgroundColor:'#fff0f4',paddingHorizontal:11,marginTop:10,flexDirection:'row',alignItems:'center',gap:7},careErrorText:{flex:1,fontSize:8.5,lineHeight:12,color:RED,fontWeight:'700'},carePrimary:{height:52,borderRadius:26,backgroundColor:RED,marginTop:15,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},carePrimaryText:{fontSize:7.5,fontWeight:'900',letterSpacing:1.1,color:'#fff'},careHelpLink:{minHeight:74,marginTop:12,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5ddd8',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:11},careHelpTitle:{fontSize:11,fontWeight:'900',color:'#171310'},careHelpText:{fontSize:8.5,color:'#80756e',marginTop:2},
  trackingResult:{marginTop:13,borderRadius:21,backgroundColor:'#171310',padding:18},trackingResultTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},trackingNumber:{fontFamily:'serif',fontSize:19,lineHeight:24,fontWeight:'700',color:'#fff',marginTop:3},trackingStatus:{height:26,borderRadius:13,backgroundColor:'rgba(255,255,255,.1)',paddingHorizontal:9,alignItems:'center',justifyContent:'center'},trackingStatusText:{fontSize:5.5,fontWeight:'900',letterSpacing:.9,color:'#ff91a9'},trackingSummary:{marginTop:14,paddingVertical:12,borderTopWidth:1,borderBottomWidth:1,borderColor:'rgba(255,255,255,.12)',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},trackingMeta:{fontSize:6.5,fontWeight:'900',letterSpacing:1,color:'rgba(255,255,255,.55)'},trackingTotal:{fontSize:16,fontWeight:'900',color:'#fff'},trackingTimeline:{flexDirection:'row',marginTop:18},trackingStep:{flex:1,alignItems:'center',position:'relative'},trackingDot:{zIndex:1,width:20,height:20,borderRadius:10,backgroundColor:'#3b3735',borderWidth:2,borderColor:'#625b57',alignItems:'center',justifyContent:'center'},trackingDotActive:{backgroundColor:RED,borderColor:RED},trackingLine:{position:'absolute',height:2,left:'50%',right:'-50%',top:9,backgroundColor:'#3b3735'},trackingLineActive:{backgroundColor:RED},trackingStepText:{fontSize:4.8,fontWeight:'900',letterSpacing:.55,color:'#716a66',marginTop:6},trackingStepTextActive:{color:'#fff'},
  deliveryPromise:{minHeight:82,marginTop:13,borderRadius:18,backgroundColor:'#edf7f0',borderWidth:1,borderColor:'#d7e9dc',padding:15,flexDirection:'row',alignItems:'center',gap:12},deliveryPromiseTitle:{fontSize:11,fontWeight:'900',color:'#245b3a'},deliveryPromiseText:{fontSize:8.5,lineHeight:13,color:'#617a68',marginTop:2},policyCard:{minHeight:92,marginTop:10,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e5ddd8',padding:13,flexDirection:'row',alignItems:'center',gap:11},policyNumber:{fontFamily:'serif',fontSize:9,color:'#b5a79f'},policyIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#fff0f4',alignItems:'center',justifyContent:'center'},policyTitle:{fontSize:12,fontWeight:'900',color:'#171310'},policyText:{fontSize:8.5,lineHeight:13,color:'#7c716a',marginTop:3},returnSteps:{marginTop:14,borderRadius:20,backgroundColor:'#eee4df',padding:17},returnTitle:{fontFamily:'serif',fontSize:22,lineHeight:27,fontWeight:'700',color:'#171310',marginTop:3,marginBottom:10},returnStep:{minHeight:43,flexDirection:'row',alignItems:'center',gap:10},returnStepNumber:{width:25,height:25,borderRadius:13,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},returnStepNumberText:{fontSize:8,fontWeight:'900',color:RED},returnStepText:{flex:1,fontSize:9,lineHeight:13,color:'#5f5550'},
  adviceHero:{marginTop:13,minHeight:185,borderRadius:21,overflow:'hidden',padding:19,justifyContent:'flex-end'},adviceHeroEyebrow:{fontSize:6.5,fontWeight:'900',letterSpacing:1.4,color:'#ff91a9',marginTop:19},adviceHeroTitle:{fontFamily:'serif',fontSize:25,lineHeight:30,fontWeight:'700',color:'#fff',marginTop:3},adviceHeroText:{fontSize:9.5,lineHeight:14,color:'rgba(255,255,255,.65)',marginTop:3,maxWidth:330},adviceQuestion:{fontFamily:'serif',fontSize:18,lineHeight:23,fontWeight:'700',color:'#171310',marginTop:20,marginBottom:9},adviceGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},adviceChoice:{width:'48.7%',height:78,borderRadius:16,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3dad5',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10},adviceChoiceActive:{backgroundColor:'#171310',borderColor:'#171310'},adviceChoiceText:{fontSize:11,fontWeight:'900',color:'#171310'},adviceChoiceTextActive:{color:'#fff'},adviceAudienceRow:{flexDirection:'row',gap:7},adviceAudience:{flex:1,height:42,borderRadius:21,borderWidth:1,borderColor:'#d7cec9',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},adviceAudienceActive:{backgroundColor:RED,borderColor:RED},adviceAudienceText:{fontSize:9,fontWeight:'800',color:'#5f5650'},adviceAudienceTextActive:{color:'#fff'},adviceNote:{minHeight:61,marginTop:14,borderRadius:15,backgroundColor:'#fff8f2',padding:12,flexDirection:'row',alignItems:'center',gap:9},adviceNoteText:{flex:1,fontSize:8.2,lineHeight:12,color:'#786a61'},
  supportChatCard:{position:'relative',marginTop:14,borderRadius:24,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3d8d2',paddingHorizontal:17,paddingTop:20,paddingBottom:16,shadowColor:'#2a1915',shadowOpacity:.075,shadowRadius:16,shadowOffset:{width:0,height:7},elevation:3},supportCardAccent:{position:'absolute',top:-1,left:24,right:24,height:3,borderBottomLeftRadius:3,borderBottomRightRadius:3,backgroundColor:RED},supportChatIntro:{flexDirection:'row',alignItems:'center',gap:13},supportChatIcon:{width:48,height:48,borderRadius:16,backgroundColor:RED,alignItems:'center',justifyContent:'center',shadowColor:RED,shadowOpacity:.18,shadowRadius:8,shadowOffset:{width:0,height:4},elevation:2},supportIntroCopy:{flex:1,minWidth:0},supportChatEyebrow:{fontSize:6.5,lineHeight:10,fontWeight:'900',letterSpacing:1.45,color:RED},supportChatTitle:{fontFamily:'serif',fontSize:21,lineHeight:25,fontWeight:'700',color:'#171310',marginTop:2},supportChatCopy:{fontSize:9,lineHeight:13,color:'#7b7069',marginTop:3},supportTrustRow:{minHeight:42,marginTop:14,borderRadius:14,backgroundColor:'#f0f8f3',borderWidth:1,borderColor:'#dcebe1',paddingHorizontal:10,flexDirection:'row',alignItems:'center'},supportTrustItem:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},supportTrustDivider:{width:1,height:20,backgroundColor:'#d4e5da'},supportTrustText:{fontSize:7.2,lineHeight:10,fontWeight:'800',color:'#416450',textAlign:'center'},supportSectionLabel:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:1.25,color:'#786b65',marginTop:16,marginBottom:7},supportTopicRow:{flexDirection:'row',gap:7},supportTopic:{flex:1,minHeight:42,borderRadius:14,borderWidth:1,borderColor:'#ddd4cf',backgroundColor:'#faf8f7',paddingHorizontal:6,flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center'},supportTopicActive:{backgroundColor:'#171310',borderColor:'#171310',shadowColor:'#171310',shadowOpacity:.12,shadowRadius:6,shadowOffset:{width:0,height:3},elevation:1},supportTopicText:{fontSize:7.2,fontWeight:'800',color:'#6f6660',textAlign:'center'},supportTopicTextActive:{color:'#fff'},supportFieldRow:{flexDirection:'row',gap:9},supportFieldGroup:{flexGrow:1,marginTop:13},supportLabelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},supportFieldLabel:{fontSize:6.3,lineHeight:9,fontWeight:'900',letterSpacing:1.15,color:'#625852',marginLeft:2},supportOptional:{fontSize:6,lineHeight:9,fontWeight:'800',letterSpacing:.75,color:'#a0928b',marginRight:2},supportField:{height:50,borderRadius:14,borderWidth:1,borderColor:'#d9d0cb',backgroundColor:'#fdfcfb',paddingHorizontal:13,fontSize:11,color:'#211c19',marginTop:6},supportFieldHalf:{flex:1,minWidth:0},supportMessageField:{height:108,paddingTop:13,paddingBottom:13},supportChatError:{fontSize:9,lineHeight:13,fontWeight:'700',color:RED,marginTop:9},supportSubmitButton:{height:52,borderRadius:18,backgroundColor:RED,marginTop:15,paddingLeft:18,paddingRight:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between',shadowColor:RED,shadowOpacity:.18,shadowRadius:8,shadowOffset:{width:0,height:4},elevation:2},supportSubmitText:{fontSize:7.5,fontWeight:'900',letterSpacing:1.15,color:'#fff'},supportSubmitArrow:{width:38,height:38,borderRadius:13,backgroundColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center'},supportPrivacy:{minHeight:36,marginTop:10,borderRadius:12,backgroundColor:'#f8f5f3',paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},supportPrivacyText:{flex:1,fontSize:7,lineHeight:10,color:'#7f746e',textAlign:'center'},supportChatHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingBottom:13,borderBottomWidth:1,borderBottomColor:'#eee8e4'},supportChatStatus:{height:25,borderRadius:13,backgroundColor:'#edf8f1',paddingHorizontal:8,flexDirection:'row',alignItems:'center',gap:5},supportChatStatusDot:{width:5,height:5,borderRadius:3,backgroundColor:'#2c9b5c'},supportChatStatusText:{fontSize:5.5,fontWeight:'900',letterSpacing:.8,color:'#176b43'},supportThread:{gap:8,paddingVertical:14},supportBubble:{maxWidth:'86%',borderRadius:15,paddingHorizontal:12,paddingVertical:10},supportBubbleCustomer:{alignSelf:'flex-end',backgroundColor:'#171310',borderBottomRightRadius:4},supportBubbleStaff:{alignSelf:'flex-start',backgroundColor:'#f5eeee',borderBottomLeftRadius:4},supportBubbleSender:{fontSize:5.5,fontWeight:'900',letterSpacing:1,color:'rgba(255,255,255,.6)'},supportBubbleSenderStaff:{color:RED},supportBubbleText:{fontSize:10,lineHeight:15,color:'#29211d',marginTop:3},supportBubbleTextCustomer:{color:'#fff'},supportBubbleTime:{fontSize:5.8,color:'#8b7f78',marginTop:5},supportBubbleTimeCustomer:{color:'rgba(255,255,255,.46)'},supportReplyRow:{minHeight:52,borderRadius:16,borderWidth:1,borderColor:'#d9d1cc',backgroundColor:'#fcfbfa',paddingLeft:12,paddingRight:5,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:7},supportReplyInput:{flex:1,minWidth:0,maxHeight:90,fontSize:11,color:'#211c19',paddingVertical:5},supportSendButton:{width:40,height:40,borderRadius:14,backgroundColor:RED,alignItems:'center',justifyContent:'center'},supportSendButtonDisabled:{opacity:.42,shadowOpacity:0,elevation:0},supportChatFooter:{marginTop:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},supportChatSecure:{flex:1,fontSize:6.5,lineHeight:10,color:'#8a7f79'},supportNewConversation:{fontSize:7,fontWeight:'900',color:RED},adminPortalCard:{minHeight:94,marginTop:12,borderRadius:18,backgroundColor:'#e9e5e2',borderWidth:1,borderColor:'#d9d2cd',padding:14,flexDirection:'row',alignItems:'center',gap:11},adminPortalIcon:{width:43,height:43,borderRadius:14,backgroundColor:'#171310',alignItems:'center',justifyContent:'center'},adminPortalCopy:{flex:1,minWidth:0},adminPortalEyebrow:{fontSize:5.8,fontWeight:'900',letterSpacing:1.15,color:RED},adminPortalTitle:{fontFamily:'serif',fontSize:17,lineHeight:21,fontWeight:'700',color:'#171310',marginTop:2},adminPortalText:{fontSize:7.8,lineHeight:11.5,color:'#736963',marginTop:2},adminPortalButton:{width:38,height:38,borderRadius:19,backgroundColor:'#fff',borderWidth:1,borderColor:'#d7cfca',alignItems:'center',justifyContent:'center'},
  catalogOpen:{flex:1},catalogInfoOverlay:{paddingBottom:76},catalogQuickAddOverlay:{zIndex:3,position:'absolute',right:14,bottom:13},catalogRequestPriceOverlay:{zIndex:3,position:'absolute',left:14,right:14,bottom:13},
  bagFlight:{position:'absolute',zIndex:1000,left:'15%',top:'57%',width:74,height:74,borderRadius:24,backgroundColor:'#fff',borderWidth:1,borderColor:'#eadfda',padding:7,shadowColor:RED,shadowOpacity:.28,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:20},bagFlightGlow:{position:'absolute',left:-8,top:-8,right:-8,bottom:-8,borderRadius:30,backgroundColor:'rgba(215,25,63,.09)'},bagFlightImage:{width:'100%',height:'100%'},bagFlightCheck:{position:'absolute',right:-7,top:-7,width:25,height:25,borderRadius:13,backgroundColor:RED,borderWidth:2,borderColor:'#fff',alignItems:'center',justifyContent:'center'},
  variantSelector:{marginTop:20,maxWidth:520,width:'100%',alignSelf:'center'},
  variantSelectorHeader:{minHeight:50,paddingBottom:13,borderBottomWidth:1,borderBottomColor:'#ece4df',flexDirection:'row',alignItems:'center',gap:12},variantSelectorHeadingCopy:{flex:1,minWidth:0},variantSelectorEyebrow:{fontSize:9,lineHeight:13,fontWeight:'900',letterSpacing:1.45,color:'#211917'},variantSelectorSubtitle:{fontSize:10,lineHeight:15,color:'#776b65',marginTop:2},variantVatPill:{height:24,paddingHorizontal:9,borderRadius:12,backgroundColor:'#f3efed',alignItems:'center',justifyContent:'center'},variantVatText:{fontSize:5.8,lineHeight:8,fontWeight:'900',letterSpacing:.8,color:'#776b65'},
  variantSection:{marginTop:10},variantSectionBottle:{marginTop:17},variantSectionHeader:{minHeight:40,paddingHorizontal:2,flexDirection:'row',alignItems:'center',gap:9},variantSectionIcon:{width:29,height:29,borderRadius:10,backgroundColor:'#fff0f3',alignItems:'center',justifyContent:'center'},variantSectionIconBottle:{backgroundColor:'#f1ece8'},variantSectionCopy:{flex:1,minWidth:0},variantSectionTitle:{fontSize:8.5,lineHeight:11,fontWeight:'900',letterSpacing:1.2,color:'#241b18'},variantSectionDescription:{fontSize:9,lineHeight:13,color:'#83766f',marginTop:1},variantSectionCount:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:.8,color:'#958981'},
  variantRow:{flexDirection:'row',gap:8,marginTop:4},variantCompactRail:{gap:8,paddingRight:2,paddingBottom:2},variantCardShell:{flex:1,minWidth:0,height:90,borderRadius:15,borderWidth:1,borderColor:'#ded5d0',backgroundColor:'#fff',shadowColor:'#2b1b17',shadowOpacity:.025,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:0},variantCardShellCompact:{flexGrow:0,flexBasis:'auto',width:104},variantCardShellBottle:{backgroundColor:'#fdfbf9'},variantCardShellSelected:{borderWidth:1.5,borderColor:RED,backgroundColor:'#fff5f7',shadowColor:RED,shadowOpacity:.07,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:1},variantCardPressable:{flex:1,minHeight:88,borderRadius:15,paddingHorizontal:11,paddingVertical:10,justifyContent:'center'},variantCardPressed:{opacity:.78},
  variantSelection:{position:'absolute',right:9,top:9,width:18,height:18,borderRadius:9,borderWidth:1,borderColor:'#cec3bd',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},variantSelectionActive:{borderColor:RED,backgroundColor:RED},variantSize:{fontSize:17,lineHeight:21,fontWeight:'900',letterSpacing:-.3,color:'#211917',paddingRight:19},variantPrice:{fontSize:10.5,lineHeight:14,fontWeight:'800',color:'#564a45',marginTop:4},variantPriceSelected:{color:RED},variantUnitPrice:{fontSize:6.5,lineHeight:9,fontWeight:'700',letterSpacing:.1,color:'#988b84',marginTop:2,maxWidth:'100%'},
});

const trackingLuxuryStyles=StyleSheet.create({
  trackPage:{flex:1,minWidth:0,backgroundColor:'#FBF9F5'},
  trackScroll:{flexGrow:1,width:'100%',paddingTop:22,paddingBottom:116,backgroundColor:'#FBF9F5',boxSizing:'border-box' as any},
  trackContainer:{width:'100%',maxWidth:620,alignSelf:'center',paddingHorizontal:20,boxSizing:'border-box' as any},
  trackHeader:{paddingTop:2,paddingBottom:4},
  trackHeaderTop:{height:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:30},
  trackBack:{width:44,height:44,alignItems:'flex-start',justifyContent:'center'},
  trackTrust:{minWidth:44,minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:5},
  trackTrustText:{fontSize:6,lineHeight:9,fontWeight:'800',letterSpacing:.9,color:'#557060'},
  trackPressed:{opacity:.55},
  trackEyebrow:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:1.65,color:'#9E1734'},
  trackTitle:{maxWidth:'100%',fontFamily:'serif',fontSize:34,lineHeight:40,fontWeight:'700',letterSpacing:-.55,color:'#191411',marginTop:7},
  trackSubtitle:{maxWidth:470,fontSize:11.5,lineHeight:18,color:'#716963',marginTop:8},
  trackForm:{marginTop:35,paddingTop:28,borderTopWidth:1,borderTopColor:'#DCD5CE'},
  trackFormTitle:{fontFamily:'serif',fontSize:25,lineHeight:31,fontWeight:'700',letterSpacing:-.25,color:'#191411'},
  trackFormIntro:{fontSize:10.5,lineHeight:16,color:'#7A716B',marginTop:5,marginBottom:12},
  trackLabelRow:{minHeight:25,marginTop:14,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12},
  trackLabel:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.25,color:'#4E4641'},
  trackHint:{fontSize:8,lineHeight:11,color:'#918780'},
  trackInput:{height:52,borderRadius:10,borderWidth:1,borderColor:'#D4CCC6',backgroundColor:'#FFFDF9',paddingHorizontal:14,fontSize:12.5,color:'#201A17',marginTop:7,outlineStyle:'none' as any},
  trackInputFocused:{borderColor:'#806A5F',backgroundColor:'#fff'},
  trackInputError:{borderColor:'#B64A60',backgroundColor:'#FFFBFB'},
  trackFieldError:{fontSize:8.5,lineHeight:13,fontWeight:'600',color:'#9E1734',marginTop:6},
  trackPrimary:{height:52,borderRadius:4,backgroundColor:'#9E1734',marginTop:22,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  trackPrimaryContent:{flexDirection:'row',alignItems:'center',gap:9},
  trackPrimaryText:{fontSize:8,lineHeight:11,fontWeight:'900',letterSpacing:1.05,color:'#fff'},
  trackPrimaryPressed:{opacity:.78},
  trackPrimaryDisabled:{opacity:.62},
  trackPrivacy:{minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
  trackPrivacyText:{fontSize:7.5,lineHeight:11,color:'#817871'},
  trackErrorState:{marginTop:32,paddingVertical:24,borderTopWidth:1,borderBottomWidth:1,borderColor:'#E1D8D2'},
  trackErrorTitle:{fontFamily:'serif',fontSize:22,lineHeight:27,fontWeight:'700',color:'#201916',marginTop:10},
  trackErrorText:{maxWidth:480,fontSize:10.5,lineHeight:17,color:'#6F6660',marginTop:5},
  trackErrorDetail:{maxWidth:480,fontSize:8,lineHeight:12,color:'#988B84',marginTop:7},
  trackErrorActions:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:18,marginTop:15},
  trackRetry:{minHeight:44,borderRadius:3,backgroundColor:'#211916',paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
  trackRetryText:{fontSize:7.5,lineHeight:10,fontWeight:'900',letterSpacing:.9,color:'#fff'},
  trackContactAction:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8},
  trackContactActionText:{fontSize:9.5,lineHeight:14,fontWeight:'700',color:'#322A26'},
  trackResult:{marginTop:38,paddingTop:27,borderTopWidth:1,borderTopColor:'#D6CEC8'},
  trackResultTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:14},
  trackResultCopy:{flex:1,minWidth:0},
  trackResultNumber:{fontFamily:'serif',fontSize:24,lineHeight:30,fontWeight:'700',letterSpacing:-.2,color:'#191411',marginTop:5},
  trackStatus:{minHeight:26,borderRadius:3,backgroundColor:'#EAF3ED',paddingHorizontal:9,alignItems:'center',justifyContent:'center'},
  trackStatusCancelled:{backgroundColor:'#F7E8EB'},
  trackStatusText:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:.8,color:'#426550'},
  trackStatusTextCancelled:{color:'#8E263B'},
  trackSummary:{minHeight:78,marginTop:19,paddingVertical:14,borderTopWidth:1,borderBottomWidth:1,borderColor:'#E2DBD5',flexDirection:'row',alignItems:'stretch'},
  trackSummaryItem:{flex:1,minWidth:0,justifyContent:'center',paddingHorizontal:8},
  trackSummaryDivider:{width:1,backgroundColor:'#E5DED8'},
  trackSummaryLabel:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:1,color:'#90857E'},
  trackSummaryValue:{fontSize:10,lineHeight:15,fontWeight:'700',color:'#29211D',marginTop:4},
  trackTimeline:{marginTop:25},
  trackStep:{minHeight:61,flexDirection:'row',alignItems:'stretch'},
  trackStepAxis:{width:30,alignItems:'center'},
  trackDot:{zIndex:1,width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:'#C9C0BA',backgroundColor:'#FBF9F5',alignItems:'center',justifyContent:'center'},
  trackDotActive:{borderColor:'#456956',backgroundColor:'#456956'},
  trackDotCurrent:{backgroundColor:'#FBF9F5',borderWidth:5,borderColor:'#9E1734'},
  trackLine:{position:'absolute',top:17,bottom:-1,width:1,backgroundColor:'#D8D0CA'},
  trackLineActive:{backgroundColor:'#759080'},
  trackStepCopy:{flex:1,minWidth:0,paddingLeft:7,paddingBottom:19},
  trackStepTitle:{fontSize:11,lineHeight:16,fontWeight:'600',color:'#928780'},
  trackStepTitleActive:{color:'#241D19',fontWeight:'700'},
  trackStepMeta:{fontSize:6,lineHeight:9,fontWeight:'800',letterSpacing:.75,color:'#9A8F88',marginTop:3},
  trackEstimate:{marginTop:3,paddingVertical:17,borderTopWidth:1,borderBottomWidth:1,borderColor:'#E2DBD5'},
  trackEstimateLabel:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:1.1,color:'#8D827B'},
  trackEstimateText:{fontSize:9.5,lineHeight:15,color:'#6F6660',marginTop:4},
  trackCancelled:{minHeight:66,marginTop:21,borderTopWidth:1,borderBottomWidth:1,borderColor:'#E6D7DA',flexDirection:'row',alignItems:'center',gap:10},
  trackCancelledText:{flex:1,fontSize:9.5,lineHeight:15,color:'#76565D'},
  trackSupport:{minHeight:94,marginTop:42,paddingVertical:20,borderTopWidth:1,borderBottomWidth:1,borderColor:'#DDD6D0',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:18},
  trackSupportCopy:{flex:1,minWidth:0},
  trackSupportLabel:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.25,color:'#9E1734'},
  trackSupportTitle:{fontFamily:'serif',fontSize:17,lineHeight:22,fontWeight:'700',color:'#241D19',marginTop:4},
  trackSupportAction:{minHeight:44,flexDirection:'row',alignItems:'center',gap:7},
  trackSupportActionText:{fontSize:8.5,lineHeight:12,fontWeight:'700',color:'#8E263B'},
});
Object.assign(styles,trackingLuxuryStyles);
