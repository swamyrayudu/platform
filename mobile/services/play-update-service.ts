import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { API_BASE_URL } from '@/utils/config';
import { parseRules, type PlayUpdateInfo, type UpdateRules } from '@/utils/play-update-policy';
import { vault } from './vault';

export type InstallState = {status: string; bytesDownloaded: number; totalBytes: number};
interface PlayUpdateModule {
  check(): Promise<PlayUpdateInfo>;
  start(type: 'immediate' | 'flexible'): Promise<'ok' | 'cancelled' | 'failed' | 'unavailable'>;
  complete(): Promise<boolean>;
  addListener(event: 'onInstallState', listener: (state: InstallState) => void): {remove(): void};
}

// Google Play in-app updates exist only in the Play build (the website APK is
// updated from the website). Builds made before modules/rsd-app-update have no
// native module, so this is simply off there.
const storeBuild = Constants.expoConfig?.extra?.distribution !== 'direct';
export const playUpdates = Platform.OS === 'android' && storeBuild && !isRunningInExpoGo()
  ? requireOptionalNativeModule<PlayUpdateModule>('RsdAppUpdate') : null;

const RULES_KEY = 'play-update-rules';
export const SNOOZE_KEY = 'play-update-snooze';

/** The admin's rules (/admin/app-updates). Offline: the last rules this phone saw. */
export async function loadUpdateRules(): Promise<UpdateRules> {
  try {
    // Plain fetch: public, and must work signed out (a required update blocks the login screen too).
    const response = await fetch(`${API_BASE_URL}/api/app/update-policy`, {signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error(String(response.status));
    const rules = parseRules(((await response.json()) as {android?: unknown}).android);
    void vault.write(RULES_KEY, rules).catch(() => {});
    return rules;
  } catch {
    return parseRules(await vault.read<UpdateRules>(RULES_KEY).catch(() => null));
  }
}

export function openPlayStore(packageName: string) {
  return Linking.openURL(`market://details?id=${packageName}`)
    .catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${packageName}`));
}
