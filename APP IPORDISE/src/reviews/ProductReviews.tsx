import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useCustomerAuth } from '../account/CustomerAuthContext';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../i18n/LocalizedPrimitives';
import { useLanguage } from '../i18n/LanguageContext';
import {
  loadProductReviews,
  productReviewErrorMessage,
  requestProductReviewCode,
  submitProductReview,
  verifyProductReviewCode,
  type ProductReviewSummary,
} from '../services/productReviewService';

const RED = '#d7193f';
const GOLD = '#d79a00';
const emptySummary: ProductReviewSummary = { average: 0, count: 0, distribution: [5, 4, 3, 2, 1].map(stars => ({ stars, count: 0, percent: 0 })), reviews: [] };
type ReviewStep = 'closed' | 'email' | 'code' | 'review' | 'success';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'VC';
const dateLabel = (value: string, language: 'fr' | 'ar' | 'en') => {
  const date = new Date(value);
  const locale = language === 'fr' ? 'fr-MA' : language === 'ar' ? 'ar-MA' : 'en-MA';
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date) : 'Recent purchase';
};

export function ProductReviews({ productId }: { productId: string }) {
  const { session } = useCustomerAuth();
  const { language } = useLanguage();
  const [summary, setSummary] = useState<ProductReviewSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<ReviewStep>('closed');
  const [email, setEmail] = useState(session?.user.email || '');
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reviewRequestSequence = useRef(0);

  const refresh = useCallback(async (force = false) => {
    const sequence = ++reviewRequestSequence.current;
    setLoading(true);
    setLoadError(false);
    try {
      const nextSummary = await (force ? loadProductReviews(productId, true) : loadProductReviews(productId));
      if (sequence === reviewRequestSequence.current) setSummary(nextSummary);
    } catch {
      if (sequence === reviewRequestSequence.current) setLoadError(true);
    } finally {
      if (sequence === reviewRequestSequence.current) setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    setSummary(emptySummary);
    setStep('closed');
    setVerificationId('');
    setCode('');
    setRating(5);
    setTitle('');
    setBody('');
    setError('');
    void refresh();
    return () => { reviewRequestSequence.current += 1; };
  }, [refresh]);

  const averageLabel = summary.count ? summary.average.toFixed(1) : '—';
  const reviewCountLabel = summary.count
    ? language === 'fr' ? `Basé sur ${summary.count} avis vérifié${summary.count === 1 ? '' : 's'}`
      : language === 'ar' ? `بناءً على ${summary.count} تقييم موثّق`
        : `Based on ${summary.count} verified ${summary.count === 1 ? 'review' : 'reviews'}`
    : language === 'fr' ? 'Aucun avis vérifié pour le moment' : language === 'ar' ? 'لا توجد تقييمات موثّقة بعد' : 'No verified reviews yet';
  const stars = useMemo(() => Array.from({ length: 5 }, (_, index) => index + 1), []);
  const requestCode = async () => {
    setBusy(true); setError('');
    try {
      const result = await requestProductReviewCode(productId, email);
      if (!result.eligible) { setError(result.alreadyReviewed ? 'This purchase already has a verified review.' : 'We could not verify a delivered purchase for this product and email.'); return; }
      setVerificationId(result.verificationId || '');
      setStep('code');
    } catch (caught) { setError(productReviewErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  const verifyCode = async () => {
    setBusy(true); setError('');
    try { await verifyProductReviewCode({ productId, email, verificationId, code }); setStep('review'); }
    catch (caught) { setError(productReviewErrorMessage(caught)); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await submitProductReview({ productId, email, verificationId, code, rating, title, body });
      setStep('success');
      await refresh(true);
    } catch (caught) { setError(productReviewErrorMessage(caught)); }
    finally { setBusy(false); }
  };

  return <View style={s.section}>
    <View style={s.headingRow}><View style={s.headingCopy}><Text style={s.eyebrow}>CUSTOMER REVIEWS</Text><Text style={s.heading}>Real experiences, verified.</Text><Text style={s.headingText}>Every published review is linked to a delivered IPORDISE order.</Text></View><View style={s.verifiedPill}><Ionicons name="shield-checkmark" size={13} color="#176b43"/><Text style={s.verifiedPillText}>VERIFIED ONLY</Text></View></View>

    <View style={s.summary}>
      <View style={s.scoreBlock}><Text style={s.score}>{averageLabel}</Text><View style={s.scoreStars}>{stars.map(star=><Ionicons key={star} name={summary.count&&star<=Math.round(summary.average)?'star':'star-outline'} size={13} color={GOLD}/>)}</View><Text style={s.count}>{reviewCountLabel}</Text></View>
      <View style={s.bars}>{summary.distribution.map(item=><View key={item.stars} style={s.barRow}><Text style={s.barLabel}>{item.stars}</Text><Ionicons name="star" size={9} color={GOLD}/><View style={s.barTrack}><View style={[s.barFill,{width:`${item.percent}%`}]}/></View><Text style={s.barPercent}>{item.percent}%</Text></View>)}</View>
    </View>

    {loading?<View style={s.loading}><ActivityIndicator color={RED}/><Text style={s.loadingText}>Loading verified reviews…</Text></View>:loadError?<Pressable accessibilityRole="button" onPress={()=>void refresh()} style={s.retry}><Ionicons name="refresh" size={15} color={RED}/><Text style={s.retryText}>Reviews could not load. Try again.</Text></Pressable>:summary.reviews.length?<View style={s.reviewList}>{summary.reviews.map(review=><View key={review.id} style={s.reviewCard}><View style={s.reviewTop}><View style={s.avatar}><Text style={s.avatarText}>{initials(review.reviewerName)}</Text></View><View style={s.authorCopy}><View style={s.authorRow}><Text style={s.author}>{review.reviewerName}</Text><View style={s.buyerPill}><Ionicons name="checkmark-circle" size={11} color="#176b43"/><Text style={s.buyerText}>VERIFIED BUYER</Text></View></View><Text style={s.meta}>{[review.city,dateLabel(review.createdAt, language)].filter(Boolean).join(' · ')}</Text></View><View style={s.cardStars}>{stars.map(star=><Ionicons key={star} name={star<=review.rating?'star':'star-outline'} size={11} color={GOLD}/>)}</View></View><Text style={s.reviewTitle}>{review.title}</Text><Text style={s.reviewBody}>{review.body}</Text><View style={s.orderTag}><Ionicons name="cube-outline" size={13} color="#6f655f"/><Text style={s.orderTagText}>{review.purchasedSize ? `${review.purchasedSize} · ` : ''}<Text>Verified delivered order</Text></Text></View></View>)}</View>:<View style={s.empty}><View style={s.emptyIcon}><Ionicons name="chatbubble-ellipses-outline" size={22} color={RED}/></View><View style={s.emptyCopy}><Text style={s.emptyTitle}>Be the first verified reviewer.</Text><Text style={s.emptyText}>Purchased this fragrance from IPORDISE? Share your experience after delivery.</Text></View></View>}

    <View style={s.formCard}>
      {step==='closed'?<><View style={s.formIntro}><View style={s.formIcon}><Ionicons name="create-outline" size={20} color={RED}/></View><View style={s.formIntroCopy}><Text style={s.formEyebrow}>PURCHASE REQUIRED</Text><Text style={s.formTitle}>Write a verified review</Text><Text style={s.formText}>We’ll confirm your delivered order privately by email before opening the review form.</Text></View></View><Pressable accessibilityRole="button" onPress={()=>setStep('email')} style={s.primary}><Text style={s.primaryText}>VERIFY MY PURCHASE</Text><Ionicons name="arrow-forward" size={16} color="#fff"/></Pressable></>:null}

      {step==='email'?<><View style={s.stepHead}><View style={s.stepNumber}><Text style={s.stepNumberText}>01</Text></View><View style={s.stepCopy}><Text style={s.formTitle}>Confirm your order email</Text><Text style={s.formText}>Use the same email address entered at checkout. Only delivered orders qualify.</Text></View></View><Text style={s.fieldLabel}>ORDER EMAIL</Text><View style={s.inputWrap}><Ionicons name="mail-outline" size={17} color="#776d67"/><TextInput accessibilityLabel="Order email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={value=>{setEmail(value);setError('');}} placeholder="you@example.com" placeholderTextColor="#9a8f88" style={s.input}/></View><View style={s.formActions}><Pressable onPress={()=>{setStep('closed');setError('');}} style={s.secondary}><Text style={s.secondaryText}>CANCEL</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{busy}} disabled={busy} onPress={()=>void requestCode()} style={[s.primary,s.formPrimary,busy&&s.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<><Text style={s.primaryText}>CHECK PURCHASE</Text><Ionicons name="arrow-forward" size={16} color="#fff"/></>}</Pressable></View></>:null}

      {step==='code'?<><View style={s.stepHead}><View style={s.stepNumber}><Text style={s.stepNumberText}>02</Text></View><View style={s.stepCopy}><Text style={s.formTitle}>Enter your verification code</Text><Text style={s.formText}>We sent a six-digit code to your order email. It expires in 10 minutes.</Text></View></View><Text style={s.fieldLabel}>SIX-DIGIT CODE</Text><TextInput accessibilityLabel="Six-digit review verification code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={value=>{setCode(value.replace(/\D/g,''));setError('');}} placeholder="000000" placeholderTextColor="#b1a7a1" style={s.codeInput}/><View style={s.formActions}><Pressable onPress={()=>{setStep('email');setCode('');setError('');}} style={s.secondary}><Text style={s.secondaryText}>BACK</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{busy}} disabled={busy||code.length!==6} onPress={()=>void verifyCode()} style={[s.primary,s.formPrimary,(busy||code.length!==6)&&s.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<><Text style={s.primaryText}>VERIFY CODE</Text><Ionicons name="checkmark" size={16} color="#fff"/></>}</Pressable></View></>:null}

      {step==='review'?<><View style={s.stepHead}><View style={[s.stepNumber,s.stepVerified]}><Ionicons name="checkmark" size={15} color="#fff"/></View><View style={s.stepCopy}><Text style={s.formTitle}>Your verified review</Text><Text style={s.formText}>Your name, city, and purchased size come securely from the delivered order.</Text></View></View><Text style={s.fieldLabel}>YOUR RATING</Text><View accessibilityRole="radiogroup" style={s.ratingRow}>{stars.map(star=><Pressable accessibilityRole="radio" accessibilityState={{checked:rating===star}} accessibilityLabel={`${star} stars`} key={star} onPress={()=>setRating(star)} style={s.ratingButton}><Ionicons name={star<=rating?'star':'star-outline'} size={28} color={GOLD}/></Pressable>)}</View><Text style={s.fieldLabel}>REVIEW TITLE</Text><TextInput accessibilityLabel="Review title" maxLength={100} value={title} onChangeText={value=>{setTitle(value);setError('');}} placeholder="Summarize your experience" placeholderTextColor="#9a8f88" style={[s.inputWrap,s.textInput]}/><View style={s.fieldLabelRow}><Text style={s.fieldLabel}>YOUR REVIEW</Text><Text style={s.characterCount}>{body.length}/1200</Text></View><TextInput accessibilityLabel="Product review" multiline maxLength={1200} textAlignVertical="top" value={body} onChangeText={value=>{setBody(value);setError('');}} placeholder="Tell other customers about the fragrance, presentation, and delivery." placeholderTextColor="#9a8f88" style={[s.inputWrap,s.bodyInput]}/><Pressable accessibilityRole="button" accessibilityState={{busy}} disabled={busy} onPress={()=>void submit()} style={[s.primary,s.submit,busy&&s.disabled]}>{busy?<ActivityIndicator color="#fff"/>:<><Text style={s.primaryText}>PUBLISH VERIFIED REVIEW</Text><Ionicons name="shield-checkmark-outline" size={17} color="#fff"/></>}</Pressable></>:null}

      {step==='success'?<View accessibilityRole="alert" style={s.success}><View style={s.successIcon}><Ionicons name="checkmark" size={20} color="#fff"/></View><View style={s.successCopy}><Text style={s.successTitle}>Thank you for your review.</Text><Text style={s.successText}>Your verified experience is now helping other IPORDISE customers.</Text></View></View>:null}
      {error?<View accessibilityRole="alert" style={s.error}><Ionicons name="alert-circle-outline" size={16} color={RED}/><Text style={s.errorText}>{error}</Text></View>:null}
      {step!=='closed'?<View style={s.privacy}><Ionicons name="lock-closed-outline" size={11} color="#80756e"/><Text style={s.privacyText}>Your email and order details remain private and are never shown with your review.</Text></View>:null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  section:{paddingTop:2},headingRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},headingCopy:{flex:1,minWidth:0},eyebrow:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:1.35,color:RED},heading:{fontFamily:'serif',fontSize:21,lineHeight:26,fontWeight:'700',color:'#171310',marginTop:3},headingText:{fontSize:9,lineHeight:14,color:'#796e68',marginTop:3},verifiedPill:{minHeight:27,borderRadius:14,backgroundColor:'#edf8f1',paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5},verifiedPillText:{fontSize:5.5,lineHeight:8,fontWeight:'900',letterSpacing:.7,color:'#176b43'},
  summary:{marginTop:14,borderRadius:18,backgroundColor:'#f7f6f5',borderWidth:1,borderColor:'#e9e5e2',padding:15,flexDirection:'row',alignItems:'center',gap:17},scoreBlock:{width:100},score:{fontSize:41,lineHeight:44,fontWeight:'900',letterSpacing:-1.5,color:'#171310'},scoreStars:{flexDirection:'row',gap:1,marginTop:2},count:{fontSize:7,lineHeight:11,color:'#837872',marginTop:5},bars:{flex:1,gap:5},barRow:{flexDirection:'row',alignItems:'center',gap:4},barLabel:{width:7,fontSize:8,fontWeight:'800',color:'#5f5651'},barTrack:{height:6,flex:1,borderRadius:3,backgroundColor:'#dedcdf',overflow:'hidden'},barFill:{height:'100%',borderRadius:3,backgroundColor:GOLD},barPercent:{width:25,textAlign:'right',fontSize:7,color:'#817771'},
  loading:{minHeight:80,alignItems:'center',justifyContent:'center',gap:8},loadingText:{fontSize:8,color:'#837872'},retry:{minHeight:52,marginTop:12,borderRadius:14,backgroundColor:'#fff3f5',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},retryText:{fontSize:9,fontWeight:'800',color:RED},reviewList:{marginTop:3},reviewCard:{marginTop:11,borderRadius:17,backgroundColor:'#fff',borderWidth:1,borderColor:'#e7e0dc',padding:14,shadowColor:'#251714',shadowOpacity:.045,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:1},reviewTop:{flexDirection:'row',alignItems:'center'},avatar:{width:38,height:38,borderRadius:19,backgroundColor:'#201719',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:9,fontWeight:'900',letterSpacing:.5,color:'#fff'},authorCopy:{flex:1,minWidth:0,marginLeft:9},authorRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},author:{fontSize:10.5,fontWeight:'900',color:'#171310'},buyerPill:{height:18,borderRadius:9,backgroundColor:'#edf8f1',paddingHorizontal:6,flexDirection:'row',alignItems:'center',gap:3},buyerText:{fontSize:5,lineHeight:7,fontWeight:'900',letterSpacing:.55,color:'#176b43'},meta:{fontSize:7,lineHeight:10,color:'#91857e',marginTop:2},cardStars:{flexDirection:'row',gap:1},reviewTitle:{fontSize:11.5,lineHeight:16,fontWeight:'900',color:'#211a17',marginTop:13},reviewBody:{fontSize:9.5,lineHeight:15.5,color:'#5f5651',marginTop:5},orderTag:{alignSelf:'flex-start',minHeight:29,borderRadius:10,backgroundColor:'#f6f3f1',paddingHorizontal:8,marginTop:11,flexDirection:'row',alignItems:'center',gap:5},orderTagText:{fontSize:6.5,lineHeight:9,fontWeight:'800',color:'#71665f'},empty:{marginTop:12,minHeight:76,borderRadius:16,borderWidth:1,borderColor:'#e8e1dd',backgroundColor:'#fbfaf9',padding:12,flexDirection:'row',alignItems:'center',gap:10},emptyIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#fff0f3',alignItems:'center',justifyContent:'center'},emptyCopy:{flex:1},emptyTitle:{fontSize:10.5,lineHeight:14,fontWeight:'900',color:'#211a17'},emptyText:{fontSize:8,lineHeight:12,color:'#81766f',marginTop:2},
  formCard:{marginTop:16,borderRadius:19,borderWidth:1,borderColor:'#e4d9d5',backgroundColor:'#fffaf8',padding:15},formIntro:{flexDirection:'row',alignItems:'flex-start',gap:11},formIcon:{width:43,height:43,borderRadius:14,backgroundColor:'#fff0f3',alignItems:'center',justifyContent:'center'},formIntroCopy:{flex:1,minWidth:0},formEyebrow:{fontSize:6,lineHeight:9,fontWeight:'900',letterSpacing:1.15,color:RED},formTitle:{fontFamily:'serif',fontSize:17,lineHeight:21,fontWeight:'700',color:'#211a17',marginTop:2},formText:{fontSize:8.5,lineHeight:13,color:'#7d716b',marginTop:3},primary:{height:47,borderRadius:14,backgroundColor:RED,paddingHorizontal:15,marginTop:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,shadowColor:RED,shadowOpacity:.14,shadowRadius:7,shadowOffset:{width:0,height:3},elevation:2},primaryText:{fontSize:7,lineHeight:10,fontWeight:'900',letterSpacing:.85,color:'#fff'},stepHead:{flexDirection:'row',alignItems:'center',gap:10},stepNumber:{width:38,height:38,borderRadius:13,backgroundColor:'#211719',alignItems:'center',justifyContent:'center'},stepNumberText:{fontSize:8,fontWeight:'900',letterSpacing:.7,color:'#fff'},stepVerified:{backgroundColor:'#176b43'},stepCopy:{flex:1,minWidth:0},fieldLabel:{fontSize:6.5,lineHeight:9,fontWeight:'900',letterSpacing:1.1,color:'#756962',marginTop:14},fieldLabelRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},characterCount:{fontSize:6.5,color:'#9b918b',marginTop:14},inputWrap:{height:48,borderRadius:13,borderWidth:1,borderColor:'#d9cfca',backgroundColor:'#fff',paddingHorizontal:12,marginTop:7,flexDirection:'row',alignItems:'center',gap:8},input:{flex:1,minWidth:0,height:46,fontSize:11,color:'#211a17'},textInput:{fontSize:11,color:'#211a17'},codeInput:{height:58,borderRadius:14,borderWidth:1,borderColor:'#d9cfca',backgroundColor:'#fff',marginTop:7,textAlign:'center',fontSize:24,fontWeight:'800',letterSpacing:8,color:'#211a17'},formActions:{flexDirection:'row',alignItems:'center',gap:8,marginTop:13},secondary:{height:47,minWidth:82,borderRadius:14,borderWidth:1,borderColor:'#d9cfca',alignItems:'center',justifyContent:'center'},secondaryText:{fontSize:7,fontWeight:'900',letterSpacing:.8,color:'#655b55'},formPrimary:{flex:1,marginTop:0},disabled:{opacity:.48},ratingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:5,paddingHorizontal:4},ratingButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},bodyInput:{height:112,paddingTop:12,alignItems:'flex-start',fontSize:10.5,lineHeight:16,color:'#211a17'},submit:{marginTop:14},success:{minHeight:76,flexDirection:'row',alignItems:'center',gap:11},successIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#176b43',alignItems:'center',justifyContent:'center'},successCopy:{flex:1},successTitle:{fontFamily:'serif',fontSize:17,lineHeight:21,fontWeight:'700',color:'#174d31'},successText:{fontSize:8.5,lineHeight:13,color:'#60786a',marginTop:2},error:{minHeight:43,borderRadius:12,backgroundColor:'#fff0f3',paddingHorizontal:10,marginTop:11,flexDirection:'row',alignItems:'center',gap:7},errorText:{flex:1,fontSize:8,lineHeight:12,fontWeight:'700',color:'#9a2440'},privacy:{marginTop:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},privacyText:{flex:1,fontSize:6.5,lineHeight:10,color:'#8c817b',textAlign:'center'},
});
