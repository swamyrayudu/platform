import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { api } from './api-client';
import { vault } from './vault';
import type { PublicUser } from '@/types/auth';
export interface Plan {id:string;name:string;amountPaise:number;originalAmountPaise:number;period:string;durationDays:number;badge:string;popular:boolean;features:string[]}
export interface PaymentOrder {id:string;planId:string;amount:number;currency:string;status:string;createdAt:string;paidAt:string|null;razorpayOrderId:string}
interface CheckoutOrder {orderId:string;amount:number;currency:string;keyId:string;plan:{id:string;name:string};prefill:{name:string;email:string}}
interface PendingPayment {userId:string;orderId:string;receipt?:{razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string}}
export const canCheckout = !isRunningInExpoGo() && Platform.OS==='android' && Constants.expoConfig?.extra?.distribution==='direct';
export const paymentService = {
  plans:()=>api.request<{plans:Plan[]}>('/api/payments/plans'),
  history:()=>api.request<{user:PublicUser;orders:PaymentOrder[]}>('/api/payments/history'),
  coupon:(code:string)=>api.request<{valid:boolean;code:string;discountPercent?:number;prices?:Record<string,number>}>('/api/payments/coupons','POST',{code}),
  async pending(userId:string) {const pending=await vault.read<PendingPayment>('pending-payment');return pending?.userId===userId?pending:null;},
  async recover(userId:string) {
    const pending=await paymentService.pending(userId);if(!pending)return null;
    const result=await api.request<{settled:boolean;outcome:string;user:PublicUser}>('/api/payments/recover','POST',{orderId:pending.orderId});
    if(result.settled)await vault.remove('pending-payment');return result;
  },
  async buy(userId:string,planId:string,couponCode?:string) {
    if(!canCheckout)throw new Error('Checkout is unavailable in this distribution.');
    // Expo Go does not include Razorpay; load it only in a supported native build.
    const {default:RazorpayCheckout}=await import('react-native-razorpay');
    if(await paymentService.pending(userId))throw new Error('Resolve your pending payment before starting another checkout.');
    const order=await api.request<CheckoutOrder>('/api/payments/orders','POST',{planId,couponCode});
    const pending:PendingPayment={userId,orderId:order.orderId};await vault.write('pending-payment',pending);
    const receipt=await RazorpayCheckout.open({key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,name:'RSD Education',description:order.plan.name,prefill:order.prefill,theme:{color:'#A87922'}});
    pending.receipt=receipt;await vault.write('pending-payment',pending);
    // A native success event never grants access. Server checks capture/signature.
    const verified=await api.request<{user:PublicUser}>('/api/payments/verify','POST',receipt);
    await vault.remove('pending-payment');return verified.user;
  },
};
