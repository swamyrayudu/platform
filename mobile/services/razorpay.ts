// Website APK only: RSD Pro through Razorpay.
//
// The Google Play build never contains this file: metro.config.cjs replaces it
// with stubs/razorpay.store.ts, and react-native.config.js leaves the Razorpay
// native SDK out. Play sells Pro only through Google Play Billing.
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { api } from './api-client';
import { vault } from './vault';
import { createPaymentFlow } from './payment-flow';

const directBuild = Constants.expoConfig?.extra?.distribution === 'direct';
// Checking for the native module means checkout can never open in a build
// without it, even if an update carried the wrong settings.
const razorpayLinked = TurboModuleRegistry.get('RNRazorpayCheckout') != null || NativeModules.RNRazorpayCheckout != null;
export const canCheckout = !isRunningInExpoGo() && Platform.OS === 'android' && directBuild && razorpayLinked;

const flow = createPaymentFlow({
  request: api.request, storage: vault, canCheckout: () => canCheckout,
  checkout: async order => {
    const {default: RazorpayCheckout} = await import('react-native-razorpay');
    try {
      return await RazorpayCheckout.open({key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: 'RSD Education', description: order.plan.name, prefill: order.prefill, theme: {color: '#2E2B55'}});
    } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 2;
      throw new Error(cancelled ? 'Checkout was closed. Check payment status before trying again.' : 'Payment could not be completed. Check payment status before trying again.');
    }
  },
});

export const webPayments = {
  coupon: (code: string) => api.request<{valid: boolean; code: string; discountPercent?: number; prices?: Record<string, number>}>('/api/payments/coupons', 'POST', {code}),
  ...flow,
};
