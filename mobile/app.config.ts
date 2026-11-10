import type { ConfigContext, ExpoConfig } from 'expo/config';

const direct = process.env.RSD_DISTRIBUTION === 'direct';

// Android package (applicationId) per distribution:
//   Google Play build  → com.karthik.rsdeducation  (the Play Console app; Play Billing is tied to it)
//   direct APK (website download, dev builds) → com.rsdeducation.student, unchanged so people who
//   installed the website APK keep receiving updates over it.
// Each package needs its own Android OAuth client (package + signing SHA-1) for Google Sign-In;
// see docs/GOOGLE_SIGN_IN.md. The server allow-lists both in lib/mobile-google-bridge.ts.
export const PLAY_ANDROID_PACKAGE = 'com.karthik.rsdeducation';
export const DIRECT_ANDROID_PACKAGE = 'com.rsdeducation.student';

// R8 keep rules for code that is only reached by name at runtime.
// Razorpay's rules only in the website APK: the Play build has no Razorpay.
const RAZORPAY_RULES = `
# Razorpay checkout (react-native-razorpay README)
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** {*;}
-optimizations !method/inlining/
-keepclasseswithmembers class * {
  public void onPayment*(...);
}
`;
const PROGUARD_RULES = `${direct ? RAZORPAY_RULES : ''}
# Credential Manager finds its Play Services provider by class name (Android docs)
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** {
  *;
}
`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RSD Education',
  slug: 'rsd-education',
  owner: 'swamyrayudu',
  // Native changes require a version bump and a replacement APK.
  // The Play build gets its own runtime ("1.1.0-play"), so an over-the-air update
  // published with the other distribution's settings can never reach it: a
  // direct-APK update (Razorpay on, study files shown) is refused by Play
  // installs, and a Play update is refused by website APKs. The direct APK keeps
  // the plain app version so installs already out there keep getting updates.
  runtimeVersion: direct ? { policy: 'appVersion' } : `${config.version}-play`,
  updates: {
    ...config.updates,
    url: 'https://u.expo.dev/e277917c-28a9-463f-91ec-2f6cace259ae',
    enabled: true,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
  },
  android: {
    ...config.android,
    package: direct ? DIRECT_ANDROID_PACKAGE : PLAY_ANDROID_PACKAGE,
  },
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', {
      android: {
        // Strip unused Java/Kotlin code and resources from release builds.
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        extraProguardRules: PROGUARD_RULES,
        // The Play bundle keeps every CPU type: Play delivers only the one each phone needs.
        // The direct APK is a single file for every phone, so it leaves out the x86 types
        // (emulators only) and compresses native code to shrink the download.
        ...(process.env.RSD_COMPACT_APK === '1'
          ? { buildArchs: ['armeabi-v7a', 'arm64-v8a'], useLegacyPackaging: true }
          : {}),
      },
    }],
  ],
  extra: {
    ...config.extra,
    distribution: direct ? 'direct' : 'store',
    eas: {
      ...config.extra?.eas,
      projectId: 'e277917c-28a9-463f-91ec-2f6cace259ae',
    },
  },
});
