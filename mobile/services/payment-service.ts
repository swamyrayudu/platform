import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { api } from './api-client';
import { vault } from './vault';
import type { PublicUser } from '@/types/auth';
import { createPaymentFlow } from './payment-flow';
import { playBillingAvailable } from './play-billing-service';
export interface Plan {id:string;name:string;amountPaise:number;originalAmountPaise:number;period:string;durationDays:number;badge:string;popular:boolean;features:string[]}
export interface PaymentOrder {id:string;planId:string;amount:number;currency:string;status:string;createdAt:string;paidAt:string|null;razorpayOrderId:string}
export const canCheckout = !isRunningInExpoGo() && Platform.OS==='android' && Constants.expoConfig?.extra?.distribution==='direct';
/**
 * Who sells Pro in this install:
 *   'razorpay'    direct APK (downloaded from the website) — unchanged Razorpay checkout
 *   'google_play' Google Play build with the Play Billing module — Play's own billing, as
 *                 Play policy requires for digital subscriptions
 *   null          any other store build (e.g. App Store): no plans, prices or purchase prompts
 * Pro bought on the website works everywhere after signing in, and Pro bought on Google Play
 * works on the website too (shared server-side entitlement).
 */
export const planSource:'razorpay'|'google_play'|null = Constants.expoConfig?.extra?.distribution==='direct'?'razorpay':playBillingAvailable?'google_play':null;
export const showsPlans = planSource!==null;
const flow=createPaymentFlow({
  request:api.request,storage:vault,canCheckout:()=>canCheckout,
  checkout:async order=>{
    // Expo Go does not include Razorpay; load it only in a supported native build.
    const {default:RazorpayCheckout}=await import('react-native-razorpay');
    try {
      return await RazorpayCheckout.open({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'RSD Education',description:order.plan.name,prefill:order.prefill,theme:{color:'#2E2B55'}});
    } catch(error) {
      const cancelled=typeof error==='object'&&error!==null&&'code' in error&&Number(error.code)===2;
      throw new Error(cancelled?'Checkout was closed. Check payment status before trying again.':'Payment could not be completed. Check payment status before trying again.');
    }
  },
});
export const paymentService = {
  plans:()=>api.request<{plans:Plan[]}>('/api/payments/plans'),
  history:()=>api.request<{user:PublicUser;orders:PaymentOrder[]}>('/api/payments/history'),
  coupon:(code:string)=>api.request<{valid:boolean;code:string;discountPercent?:number;prices?:Record<string,number>}>('/api/payments/coupons','POST',{code}),
  ...flow,
};
