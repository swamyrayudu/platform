import type { ConfigContext, ExpoConfig } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RSD Education',
  slug: 'rsd-education',
  extra: { ...config.extra, distribution: process.env.RSD_DISTRIBUTION === 'direct' ? 'direct' : 'store' },
});
