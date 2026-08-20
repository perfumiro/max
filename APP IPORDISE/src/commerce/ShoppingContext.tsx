import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { loadSharedProducts, type Product } from '../sharedCatalog';
import { addBagLine, bagLineKey, countBagItems, removeBagLine, updateBagLineQuantity } from './shoppingState';
import { useCustomerAuth } from '../account/CustomerAuthContext';
import { loadCustomerShoppingState, saveCustomerShoppingState } from '../services/customerAccountService';
import { logger } from '../observability/logger';

export type BagLine = {
  key: string;
  product: Product;
  variantId: string;
  size?: string;
  quantity: number;
};

export type BagFlightOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ShoppingState = {
  bag: BagLine[];
  bagCount: number;
  favouriteIds: Set<string>;
  favourites: Product[];
  lastAdded: { product: Product; animationId: number; origin?: BagFlightOrigin } | null;
   addToBag: (product: Product, size?: string, origin?: BagFlightOrigin) => void;
  removeFromBag: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearBag: () => void;
  refreshBag: () => Promise<void>;
  toggleFavourite: (product: Product) => void;
};

type ShoppingActions = Pick<ShoppingState,'addToBag'|'removeFromBag'|'updateQuantity'|'clearBag'|'refreshBag'|'toggleFavourite'>;
type ShoppingSnapshot = Omit<ShoppingState,keyof ShoppingActions>;

const ShoppingContext = createContext<ShoppingState | null>(null);
const ShoppingActionsContext = createContext<ShoppingActions | null>(null);
const ShoppingSnapshotContext = createContext<ShoppingSnapshot | null>(null);
const FavouriteSnapshotContext=createContext<Pick<ShoppingSnapshot,'favouriteIds'|'favourites'>|null>(null);
const BagSnapshotContext=createContext<Pick<ShoppingSnapshot,'bag'|'bagCount'>|null>(null);
const LastAddedContext=createContext<ShoppingSnapshot['lastAdded']|undefined>(undefined);

export function ShoppingProvider({ children }: PropsWithChildren) {
  const {session}=useCustomerAuth();
  const accessToken=session?.access_token;
  const [bag, setBag] = useState<BagLine[]>([]);
  const [favourites, setFavourites] = useState<Product[]>([]);
  const [lastAdded,setLastAdded]=useState<{product:Product;animationId:number;origin?:BagFlightOrigin}|null>(null);
  const syncReady=useRef(false);
  const activeUserId=session?.user.id;
  const previousUserId=useRef<string|null|undefined>(undefined);

  useEffect(()=>{
    if(previousUserId.current===activeUserId)return;
    const previous=previousUserId.current;
    previousUserId.current=activeUserId??null;
    syncReady.current=false;
    if(!accessToken||!activeUserId){
      if(previous){setBag([]);setFavourites([]);setLastAdded(null);}
      return;
    }
    const mayMergeGuestState=previous==null;
    if(previous&&previous!==activeUserId){setBag([]);setFavourites([]);setLastAdded(null);}
    let active=true;
    (async()=>{
      try{
        const [remote,products]=await Promise.all([loadCustomerShoppingState(accessToken),loadSharedProducts()]);
        if(!active)return;
        const byId=new Map(products.map(product=>[product.id,product]));
        setFavourites(current=>{const local=mayMergeGuestState?current:[];const ids=new Set([...remote.favouriteIds,...local.map(product=>product.id)]);return [...ids].map(id=>byId.get(id)).filter((product):product is Product=>Boolean(product));});
        setBag(current=>{const local=mayMergeGuestState?current:[];const merged=new Map(local.map(line=>[line.key,line]));remote.bag.forEach(line=>{const product=byId.get(line.productId);if(product){const normalizedSize=String(line.size||'').toLowerCase().replace(/\s+/g,'');const variant=product.variants?.find(item=>item.id===line.variantId||item.sizeKey===normalizedSize);const variantId=variant?.id||line.variantId||`${product.id}:${normalizedSize}`;const size=variant?.sizeKey||normalizedSize||undefined;const key=bagLineKey(product.id,variantId);if(variantId&&!merged.has(key))merged.set(key,{key,product,variantId,size,quantity:Math.max(1,Math.min(20,Number(line.quantity)||1))});}});return [...merged.values()];});
      }catch(error){logger.warn('customer_shopping_restore_failed',{error});}
      finally{if(active)syncReady.current=true;}
    })();
    return()=>{active=false;};
  },[accessToken,activeUserId]);

  useEffect(()=>{
    if(!accessToken||!syncReady.current)return;
    const timer=setTimeout(()=>{void saveCustomerShoppingState(accessToken,favourites.map(product=>product.id),bag.map(line=>({productId:line.product.id,variantId:line.variantId,size:line.size,quantity:line.quantity}))).catch(error=>logger.warn('customer_shopping_sync_failed',{error}));},500);
    return()=>clearTimeout(timer);
  },[accessToken,bag,favourites]);

  const addToBag = useCallback((product: Product, size?: string, origin?: BagFlightOrigin) => {
    setBag(lines => addBagLine(lines, product, size));
    setLastAdded({product,animationId:Date.now(),origin});
  }, []);

  const removeFromBag = useCallback((key: string) => {
    setBag(lines => removeBagLine(lines, key));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => setBag(lines => updateBagLineQuantity(lines,key,quantity)), []);
  const clearBag = useCallback(() => setBag([]), []);
  const refreshBag = useCallback(async()=>{const products=await loadSharedProducts(true);const byId=new Map(products.map(product=>[product.id,product]));setBag(lines=>lines.map(line=>byId.has(line.product.id)?{...line,product:byId.get(line.product.id)!}:line));},[]);

  const toggleFavourite = useCallback((product: Product) => {
    setFavourites(current => current.some(item=>item.id===product.id) ? current.filter(item=>item.id!==product.id) : [...current,product]);
  }, []);

  const favouriteIds=useMemo(()=>new Set(favourites.map(product=>product.id)),[favourites]);
  const actions=useMemo<ShoppingActions>(()=>({addToBag,removeFromBag,updateQuantity,clearBag,refreshBag,toggleFavourite}),[addToBag,clearBag,refreshBag,removeFromBag,toggleFavourite,updateQuantity]);
  const snapshot=useMemo<ShoppingSnapshot>(()=>({bag,bagCount:countBagItems(bag),favouriteIds,favourites,lastAdded}),[bag,favouriteIds,favourites,lastAdded]);
  const favouriteSnapshot=useMemo(()=>({favouriteIds,favourites}),[favouriteIds,favourites]);
  const bagSnapshot=useMemo(()=>({bag,bagCount:countBagItems(bag)}),[bag]);

  const value = useMemo<ShoppingState>(() => ({
    ...snapshot,...actions,
  }), [actions,snapshot]);

  return <ShoppingActionsContext.Provider value={actions}><FavouriteSnapshotContext.Provider value={favouriteSnapshot}><BagSnapshotContext.Provider value={bagSnapshot}><LastAddedContext.Provider value={lastAdded}><ShoppingSnapshotContext.Provider value={snapshot}><ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider></ShoppingSnapshotContext.Provider></LastAddedContext.Provider></BagSnapshotContext.Provider></FavouriteSnapshotContext.Provider></ShoppingActionsContext.Provider>;
}

export function useShopping() {
  const value = useContext(ShoppingContext);
  if (!value) throw new Error('useShopping must be used inside ShoppingProvider');
  return value;
}

export function useShoppingActions(){
  const value=useContext(ShoppingActionsContext);
  if(!value)throw new Error('useShoppingActions must be used inside ShoppingProvider');
  return value;
}

export function useShoppingSnapshot(){
  const value=useContext(ShoppingSnapshotContext);
  if(!value)throw new Error('useShoppingSnapshot must be used inside ShoppingProvider');
  return value;
}

export function useFavouriteSnapshot(){
  const value=useContext(FavouriteSnapshotContext);
  if(!value)throw new Error('useFavouriteSnapshot must be used inside ShoppingProvider');
  return value;
}

export function useBagSnapshot(){
  const value=useContext(BagSnapshotContext);
  if(!value)throw new Error('useBagSnapshot must be used inside ShoppingProvider');
  return value;
}

export function useLastAdded(){
  const value=useContext(LastAddedContext);
  if(value===undefined)throw new Error('useLastAdded must be used inside ShoppingProvider');
  return value;
}
