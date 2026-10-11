import type { ConfigContext, ExpoConfig } from 'expo/config';
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
  extra: {
    ...config.extra,
    distribution: process.env.RSD_DISTRIBUTION === 'direct' ? 'direct' : 'store',
    eas: {
      ...config.extra?.eas,
      projectId: 'e277917c-28a9-463f-91ec-2f6cace259ae',
    },
  },
});
