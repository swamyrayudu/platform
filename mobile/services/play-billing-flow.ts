import type { PublicUser } from '../types/auth';

// ---- Shapes returned by modules/rsd-play-billing (RsdPlayBillingModule.kt) ----

export interface PlayPricingPhase {
  formattedPrice:string; priceAmountMicros:number; priceCurrencyCode:string;
  /** ISO 8601 duration, e.g. P1M, P3M, P1Y, P7D */
  billingPeriod:string; billingCycleCount:number;
  /** 1 = infinite recurring, 2 = finite recurring, 3 = non-recurring */
  recurrenceMode:number;
}
export interface PlayOffer {basePlanId:string;offerId:string|null;offerToken:string;offerTags:string[];pricingPhases:PlayPricingPhase[]}
export interface PlayProduct {productId:string;title:string;name:string;offers:PlayOffer[]}
export interface PlayPurchase {
  purchaseToken:string; products:string[]; orderId:string|null;
  /** 0 = unspecified, 1 = purchased, 2 = pending (e.g. UPI / cash not yet paid) */
  purchaseState:number; purchaseTime:number; isAcknowledged:boolean; isAutoRenewing:boolean;
  obfuscatedAccountId:string|null;
}
export interface PlayNative {
  getSubscription(productId:string):Promise<PlayProduct|null>;
  purchase(productId:string,offerToken:string,obfuscatedAccountId:string,oldPurchaseToken:string|null,replacementMode:number|null):Promise<PlayPurchase[]>;
  queryActivePurchases():Promise<PlayPurchase[]>;
}

// ---- Shapes from the backend (/api/payments/google-play/*) ----

export interface PlayCatalogPlan {key:string;basePlanIds:string[];name:string;period:string;badge:string|null;popular:boolean}
export type PlayConfig =
  | {configured:false}
  | {configured:true;packageName:string;productId:string;obfuscatedAccountId:string;plans:PlayCatalogPlan[];features:string[]};
export interface VerifiedSubscription {planKey:string;state:string;entitled:boolean;pending:boolean;autoRenewing:boolean;expiresAt:string|null}
export interface VerifyResponse {subscription:VerifiedSubscription;user:PublicUser}

/** A catalog plan joined with the prepaid offer Google says this user can buy, priced by Google. */
export interface PlayPlanOffer {
  plan:PlayCatalogPlan; offerToken:string;
  /** Google's localized one-time price, e.g. "₹299.00" */
  price:string;
  /** ISO 8601 length of Pro the pass gives, e.g. P1M */
  billingPeriod:string;
}

export const PURCHASE_STATE_PENDING=2;
/** PricingPhase.recurrenceMode NON_RECURRING: a prepaid (one-time, no auto-pay) base plan */
export const NON_RECURRING=3;

/** "P1M" → "month", "P3M" → "3 months", "P1Y" → "year", "P7D" → "7 days". */
export function describePeriod(iso:string) {
  const match=/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso);
  if(!match)return iso;
  const units:[string|undefined,string][]=[[match[1],'year'],[match[2],'month'],[match[3],'week'],[match[4],'day']];
  const [count,unit]=units.find(([value])=>value)??['1','period'];
  return Number(count)===1?unit:`${count} ${unit}s`;
}

/** A prepaid offer: exactly one non-recurring phase (pay once, no auto-renewal, no auto-pay). */
export function isPrepaidOffer(offer:PlayOffer) {
  return offer.pricingPhases.length===1&&offer.pricingPhases[0].recurrenceMode===NON_RECURRING;
}

/**
 * Pick the prepaid offer to sell for each catalog plan. Auto-renewing offers are
 * never shown, so the app cannot sell auto-pay even if one is left active in Play
 * Console. Plans Google does not return (not active) are left out instead of
 * being shown without a price.
 */
export function matchOffers(plans:PlayCatalogPlan[],product:PlayProduct|null):PlayPlanOffer[] {
  if(!product)return [];
  const result:PlayPlanOffer[]=[];
  for(const plan of plans) {
    const offer=plan.basePlanIds.map(id=>product.offers.find(o=>o.basePlanId===id&&isPrepaidOffer(o))).find(Boolean);
    if(!offer)continue;
    const phase=offer.pricingPhases[0];
    result.push({plan,offerToken:offer.offerToken,price:phase.formattedPrice,billingPeriod:phase.billingPeriod});
  }
  return result;
}

export class PlayFlowError extends Error {
  constructor(public code:'CANCELLED'|'UNAVAILABLE'|'OWNED_BY_OTHER_ACCOUNT'|'NOT_VERIFIED'|'BUSY',message:string){super(message);}
}

function nativeCode(error:unknown) {
  return typeof error==='object'&&error!==null&&'code' in error?String((error as {code:unknown}).code):'';
}
function serverCode(error:unknown) {
  return typeof error==='object'&&error!==null&&'code' in error&&'status' in error?String((error as {code:unknown}).code):'';
}

interface PlayPorts {
  native:PlayNative|null;
  request:<T>(path:string,method?:string,body?:unknown)=>Promise<T>;
}

export type PurchaseOutcome =
  | {kind:'active';user:PublicUser;subscription:VerifiedSubscription}
  | {kind:'pending';user:PublicUser}
  | {kind:'none'};

/**
 * Google Play purchase flow. Access is granted ONLY from the server's answer:
 * every purchase token goes to /api/payments/google-play/verify, which reads
 * it from Google, stores it and acknowledges it.
 */
export function createPlayBillingFlow({native,request}:PlayPorts) {
  let working=false;
  async function exclusively<T>(action:()=>Promise<T>) {
    if(working)throw new PlayFlowError('BUSY','A Google Play purchase is already being checked. Please wait.');
    working=true;
    try{return await action();}finally{working=false;}
  }
  // Never cached: obfuscatedAccountId belongs to whoever is signed in NOW. A cached
  // value would tag a purchase with the previous account after a sign-out/sign-in,
  // and the server would then refuse it as another account's purchase.
  function config() {
    return request<PlayConfig>('/api/payments/google-play/config');
  }
  async function readyConfig() {
    const value=await config();
    if(!native||!value.configured)throw new PlayFlowError('UNAVAILABLE','Google Play purchases are not available right now.');
    return value;
  }

  /** Send purchases to the server. Returns the most useful outcome among them. */
  async function verifyAll(purchases:PlayPurchase[],productId:string,strict:boolean):Promise<PurchaseOutcome> {
    let outcome:PurchaseOutcome={kind:'none'};
    let ownedElsewhere=false;
    for(const purchase of purchases.filter(p=>p.products.includes(productId))) {
      try {
        const verified=await request<VerifyResponse>('/api/payments/google-play/verify','POST',{purchaseToken:purchase.purchaseToken});
        if(verified.subscription.entitled)outcome={kind:'active',user:verified.user,subscription:verified.subscription};
        else if(outcome.kind==='none'&&(verified.subscription.pending||purchase.purchaseState===PURCHASE_STATE_PENDING))outcome={kind:'pending',user:verified.user};
      } catch(error) {
        if(serverCode(error)==='OWNED_BY_OTHER_USER'){ownedElsewhere=true;continue;}
        if(strict)throw error;
      }
    }
    if(strict&&ownedElsewhere&&outcome.kind==='none') {
      throw new PlayFlowError('OWNED_BY_OTHER_ACCOUNT','This Google Play subscription belongs to a different RSD Education account. Sign in with that account to use it.');
    }
    return outcome;
  }

  return {
    config,
    /** Plans with Google's prices for this user. Empty when Play has none active. */
    offers:async()=>{
      const value=await readyConfig();
      const product=await native!.getSubscription(value.productId);
      return {config:value,offers:matchOffers(value.plans,product)};
    },
    /** Buy a pass. Buying again while Pro is active is a Google "top-up" that adds the time. */
    buy:(offer:PlayPlanOffer)=>exclusively(async():Promise<PurchaseOutcome>=>{
      const value=await readyConfig();
      let purchases:PlayPurchase[];
      try {
        purchases=await native!.purchase(value.productId,offer.offerToken,value.obfuscatedAccountId,null,null);
      } catch(error) {
        const code=nativeCode(error);
        if(code==='E_PLAY_CANCELLED')throw new PlayFlowError('CANCELLED','Purchase was cancelled.');
        if(code==='E_PLAY_ALREADY_OWNED') {
          // The Play account already pays for this: link it instead of failing.
          const restored=await verifyAll(await native!.queryActivePurchases(),value.productId,true);
          if(restored.kind!=='none')return restored;
        }
        throw error;
      }
      const outcome=await verifyAll(purchases,value.productId,true);
      if(outcome.kind==='none'&&purchases.length>0) {
        throw new PlayFlowError('NOT_VERIFIED','Google Play took the payment but it could not be confirmed yet. Use Restore purchases in a minute.');
      }
      return outcome;
    }),
    /**
     * Re-send this Play account's subscriptions to the server.
     * quiet: start-up sync — only this account's purchases, never throws.
     */
    restore:(quiet=false)=>exclusively(async():Promise<PurchaseOutcome>=>{
      try {
        const value=await readyConfig();
        const owned=await native!.queryActivePurchases();
        const mine=quiet?owned.filter(p=>!p.obfuscatedAccountId||p.obfuscatedAccountId===value.obfuscatedAccountId):owned;
        return await verifyAll(mine,value.productId,!quiet);
      } catch(error) {
        if(quiet)return {kind:'none'};
        throw error;
      }
    }),
    /** Purchases Google reports outside a purchase sheet (a pending UPI payment completed). */
    handleUpdates:(purchases:PlayPurchase[])=>exclusively(async()=>{
      const value=await readyConfig();
      return verifyAll(purchases,value.productId,false);
    }),
  };
}
