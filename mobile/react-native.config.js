// Native linking per distribution (read by Expo autolinking at build time).
//
// The Google Play build sells Pro only through Google Play Billing, so the
// Razorpay native SDK is left out of it entirely: no Razorpay code in the
// bundle Google reviews, and no way for any JavaScript update to open Razorpay
// checkout there (services/payment-service.ts checks the native module exists).
// The website APK (RSD_DISTRIBUTION=direct) links Razorpay as before.
//
// Local `npx expo run:android` builds without RSD_DISTRIBUTION are store builds;
// set RSD_DISTRIBUTION=direct to test Razorpay locally.
const store = process.env.RSD_DISTRIBUTION !== 'direct';

module.exports = {
  dependencies: store
    ? { 'react-native-razorpay': { platforms: { android: null, ios: null } } }
    : {},
};
