import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSegments } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Heading } from '@/components/heading';
import { Button } from './ui';
import { AlertDialog } from './alert-dialog';
import { BrandMark } from './brand-mark';
import { loadUpdateRules, openPlayStore, playUpdates, SNOOZE_KEY } from '@/services/play-update-service';
import { vault } from '@/services/vault';
import { decidePlayUpdate, optionalSnoozed, type UpdateDecision } from '@/utils/play-update-policy';
import { colors } from '@/utils/theme';

/** How often to ask Google Play again when the app comes back to the front. */
const RECHECK_MS = 30 * 60 * 1000;

/**
 * Google Play in-app updates for the Play build (utils/play-update-policy.ts):
 *  - required: Play's full-screen update, and the app stays locked until done;
 *  - small: Play downloads it in the background, then we ask to restart.
 * Neither interrupts an exam in progress: they wait until the student leaves it.
 */
export function PlayAppUpdate() {
  return playUpdates ? <PlayAppUpdateFlow/> : null;
}

function PlayAppUpdateFlow() {
  const native = playUpdates!;
  const segments = useSegments();
  const inExam = segments[0] === 'exam';
  const onTabs = segments[0] === '(tabs)';
  const [decision, setDecision] = useState<UpdateDecision>({kind: 'none'});
  const [packageName, setPackageName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restartLater, setRestartLater] = useState(false);
  const checking = useRef(false);
  const lastCheck = useRef(0);
  const autoStarted = useRef(false);
  const decisionRef = useRef(decision);
  useEffect(() => { decisionRef.current = decision; }, [decision]);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    lastCheck.current = Date.now();
    try {
      const [info, rules] = await Promise.all([native.check(), loadUpdateRules()]);
      setPackageName(info.packageName);
      const next = decidePlayUpdate(info, rules);
      const snooze = await vault.read<{versionCode: number; at: number}>(SNOOZE_KEY).catch(() => null);
      setDecision(optionalSnoozed(next, snooze, Date.now()) ? {kind: 'none'} : next);
    } catch {
      // Offline, or not installed from Google Play: keep the app usable.
    } finally {
      checking.current = false;
    }
  }, [native]);

  useEffect(() => {
    // check() sets state only after awaiting Google Play and the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && (decisionRef.current.kind === 'required' || Date.now() - lastCheck.current > RECHECK_MS)) void check();
      // A downloaded small update installs quietly while the app is in the background.
      if (state === 'background' && decisionRef.current.kind === 'restart') void native.complete().catch(() => {});
    });
    const install = native.addListener('onInstallState', state => {
      if (state.status === 'downloaded') { setRestartLater(false); setDecision({kind: 'restart'}); }
    });
    return () => { subscription.remove(); install.remove(); };
  }, [check, native]);

  const startRequired = useCallback(async () => {
    if (decision.kind !== 'required') return;
    if (!decision.viaPlay) { if (packageName) await openPlayStore(packageName); return; }
    setBusy(true);
    setNotice(null);
    try {
      const result = await native.start('immediate');
      // On success Play restarts the app. Anything else: the lock stays.
      if (result === 'unavailable' && packageName) await openPlayStore(packageName);
      else if (result !== 'ok') setNotice('The update did not finish. Tap Update now to try again.');
    } catch {
      setNotice('Could not reach Google Play. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [decision, native, packageName]);

  // Open Play's update screen once by itself; after that the button does it.
  useEffect(() => {
    if (decision.kind !== 'required' || !decision.viaPlay || inExam || autoStarted.current) return;
    autoStarted.current = true;
    void startRequired();
  }, [decision, inExam, startRequired]);

  if (inExam) return null;

  if (decision.kind === 'required') return <View style={styles.lock} accessibilityViewIsModal>
    <View style={styles.panel}>
      <BrandMark size={72}/>
      <View style={styles.badge}><Ionicons name="arrow-up-circle" size={16} color={colors.gold}/><Text style={styles.badgeText}>Update required</Text></View>
      <Heading style={styles.title}>Please update RSD Education</Heading>
      <Text style={styles.text}>This version is no longer supported. Update from Google Play to keep practising. Your account and progress stay safe.</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.action}><Button icon="logo-google-playstore" label={decision.viaPlay ? 'Update now' : 'Open Google Play'} busy={busy} onPress={() => void startRequired()}/></View>
    </View>
  </View>;

  if (decision.kind === 'optional' && onTabs) return <AlertDialog icon="cloud-download-outline" title="Update available"
    description="A new version of RSD Education is on Google Play. It downloads in the background while you keep studying."
    cancelLabel="Later" confirmLabel="Update" busy={busy}
    onCancel={() => {
      void vault.write(SNOOZE_KEY, {versionCode: decision.versionCode, at: Date.now()}).catch(() => {});
      setDecision({kind: 'none'});
    }}
    onConfirm={() => {
      setBusy(true);
      void native.start('flexible').then(result => {
        if (result !== 'ok') void vault.write(SNOOZE_KEY, {versionCode: decision.versionCode, at: Date.now()}).catch(() => {});
      }).catch(() => {}).finally(() => { setBusy(false); setDecision({kind: 'none'}); });
    }}/>;

  if (decision.kind === 'restart' && onTabs && !restartLater) return <AlertDialog icon="refresh-outline" title="Update ready"
    description="Restart RSD Education to finish the update. It takes a few seconds."
    notice="Your account and saved progress stay safe."
    cancelLabel="Later" confirmLabel="Restart" busy={busy}
    onCancel={() => setRestartLater(true)}
    onConfirm={() => { setBusy(true); void native.complete().catch(() => setBusy(false)); }}/>;

  return null;
}

const styles = StyleSheet.create({
  lock: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 200, backgroundColor: '#FFFEFB', alignItems: 'center', justifyContent: 'center', padding: 24},
  panel: {width: '100%', maxWidth: 420, alignItems: 'center', gap: 12},
  badge: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FAF5EB'},
  badgeText: {fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.gold},
  title: {textAlign: 'center'},
  text: {fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center'},
  notice: {fontSize: 13, lineHeight: 20, color: colors.red, textAlign: 'center'},
  action: {alignSelf: 'stretch', marginTop: 4},
});
