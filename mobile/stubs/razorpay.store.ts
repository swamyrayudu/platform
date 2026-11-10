// Google Play build: replaces services/razorpay.ts (metro.config.cjs).
// Play sells Pro only through Google Play Billing, so there is no other checkout here.
import type * as Real from '../services/razorpay';

const unavailable = async (): Promise<never> => { throw new Error('Not available in this app.'); };

export const canCheckout: typeof Real.canCheckout = false;
export const webPayments: typeof Real.webPayments = {
  coupon: unavailable,
  buy: unavailable,
  recover: unavailable,
  pending: async () => null,
};
