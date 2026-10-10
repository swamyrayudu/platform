import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RSD Education',
  slug: 'rsd-education',
  owner: 'swamyrayudu',
  extra: {
    ...config.extra,
    distribution: process.env.RSD_DISTRIBUTION === 'direct' ? 'direct' : 'store',
    eas: {
      ...config.extra?.eas,
      projectId: 'e277917c-28a9-463f-91ec-2f6cace259ae',
    },
  },
});
