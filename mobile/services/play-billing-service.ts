import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { api } from './api-client';
import { createPlayBillingFlow, type PlayNative, type PlayPurchase } from './play-billing-flow';

interface PlayModule extends PlayNative {
  addListener(event:'onPurchasesUpdated',listener:(payload:{purchases:PlayPurchase[]})=>void):{remove():void};
}

// Only the Google Play (store) build sells through Google Play Billing. The
// direct APK keeps Razorpay (payment-service.ts); the website is untouched.
const storeBuild=Constants.expoConfig?.extra?.distribution!=='direct';
const native=Platform.OS==='android'&&storeBuild&&!isRunningInExpoGo()?requireOptionalNativeModule<PlayModule>('RsdPlayBilling'):null;

/** True when this install can buy RSD Pro through Google Play. */
export const playBillingAvailable=!!native;

export const playBilling={
  ...createPlayBillingFlow({native,request:api.request}),
  /** Purchases completed outside the purchase sheet (e.g. a pending UPI payment). */
  onPurchasesUpdated:(listener:(purchases:PlayPurchase[])=>void)=>{
    const subscription=native?.addListener('onPurchasesUpdated',payload=>listener(payload.purchases??[]));
    return ()=>subscription?.remove();
  },
};

const PLAY_PLAN_NAMES:Record<string,string>={play_monthly:'Pro · 1 Month',play_quarterly:'Pro · 3 Months',play_yearly:'Pro · 1 Year'};
export function playPlanName(planKey:string|null|undefined) { return planKey?PLAY_PLAN_NAMES[planKey]??null:null; }
