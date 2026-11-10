import Constants from 'expo-constants';
import { api } from './api-client';
import type { PublicUser } from '@/types/auth';
import { playBillingAvailable } from './play-billing-service';
// Website APK: the real checkout. Google Play build: an empty stand-in (metro.config.cjs).
import { canCheckout } from './razorpay';
export interface Plan {id:string;name:string;amountPaise:number;originalAmountPaise:number;period:string;durationDays:number;badge:string;popular:boolean;features:string[]}
export interface PaymentOrder {id:string;planId:string;amount:number;currency:string;status:string;createdAt:string;paidAt:string|null;razorpayOrderId:string}
export { canCheckout };
const directBuild = Constants.expoConfig?.extra?.distribution==='direct';
/**
 * Who sells Pro in this install:
 *   'web'         website APK — Razorpay checkout (services/razorpay.ts)
 *   'google_play' Google Play build with the Play Billing module — Play's own billing, as
 *                 Play policy requires for digital subscriptions
 *   null          any other store build (e.g. App Store): no plans, prices or purchase prompts
 * Pro bought on the website works everywhere after signing in, and Pro bought on Google Play
 * works on the website too (shared server-side entitlement).
 */
export const planSource:'web'|'google_play'|null = directBuild?(canCheckout?'web':null):playBillingAvailable?'google_play':null;
export const showsPlans = planSource!==null;
/** Plan names and the account's payment history: shared by every build. */
export const paymentService = {
  plans:()=>api.request<{plans:Plan[]}>('/api/payments/plans'),
  history:()=>api.request<{user:PublicUser;orders:PaymentOrder[]}>('/api/payments/history'),
};
