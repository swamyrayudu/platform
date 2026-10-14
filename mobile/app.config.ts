import type { ConfigContext, ExpoConfig } from 'expo/config';

const direct = process.env.RSD_DISTRIBUTION === 'direct';

// R8 keep rules for code that is only reached by name at runtime.
const PROGUARD_RULES = `
# Razorpay checkout (react-native-razorpay README)
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** {*;}
-optimizations !method/inlining/
-keepclasseswithmembers class * {
  public void onPayment*(...);
}
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
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    ...config.updates,
    url: 'https://u.expo.dev/e277917c-28a9-463f-91ec-2f6cace259ae',
    enabled: true,
    checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0,
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
