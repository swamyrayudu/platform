import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useSegments } from 'expo-router';
import { useIsMutating } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { canOfferUpdate, createAppUpdater, UPDATE_CHECK_INTERVAL } from '@/services/app-updater';
import { AlertDialog } from './alert-dialog';

export function AppUpdate() {
  const auth = useAuth();
  const segments = useSegments();
  const mutations = useIsMutating();
  const [appState, setAppState] = useState(AppState.currentState);
  const [updater] = useState(() => createAppUpdater({
    enabled: !__DEV__,
    check: async () => {
      // Existing development APKs may lack this new native module. Do not
      // import it until a configured release actually checks for updates.
      const updates = await import('expo-updates');
      if (!updates.isEnabled) return null;
      const result = await updates.checkForUpdateAsync();
      if (result.isRollBackToEmbedded) return 'embedded';
      return result.isAvailable ? result.manifest.id : null;
    },
    download: async () => {
      const updates = await import('expo-updates');
      const result = await updates.fetchUpdateAsync();
      if (result.isRollBackToEmbedded) return 'embedded';
      return result.isNew ? result.manifest.id : null;
    },
    reload: async canReload => {
      const updates = await import('expo-updates');
      if (!canReload()) throw new Error('Restart deferred until the app is idle.');
      await updates.reloadAsync();
    },
  }));
  const snapshot = useSyncExternalStore(updater.subscribe, updater.getSnapshot, updater.getSnapshot);
  const safe = canOfferUpdate(segments, appState === 'active', !!auth.user && !auth.loading && !auth.error && !auth.signingIn && mutations === 0);

  useLayoutEffect(() => {
    updater.setSafe(safe);
    return () => updater.setSafe(false);
  }, [safe, updater]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!safe || __DEV__) return;
    // Let the short opening animation finish; never delay navigation.
    const startup = setTimeout(() => { void updater.check(); }, 2000);
    const interval = setInterval(() => { void updater.check(); }, UPDATE_CHECK_INTERVAL);
    return () => { clearTimeout(startup); clearInterval(interval); };
  }, [safe, updater]);

  if (!safe || !updater.isVisible()) return null;
  return <AlertDialog title="Update available" description="A new version is ready. Restart the app to get the latest improvements." notice={snapshot.error ?? 'Your account and saved progress stay on this device.'}
    icon="cloud-download-outline" cancelLabel="Later" confirmLabel="Update now" busy={snapshot.applying}
    onCancel={() => updater.dismiss()} onConfirm={() => { void updater.apply(); }}/>;
}
