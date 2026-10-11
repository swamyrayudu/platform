export interface UpdateSnapshot {
  updateId: string | null;
  applying: boolean;
  error: string | null;
}
interface Ports {
  enabled: boolean;
  check: () => Promise<string | null>;
  download: () => Promise<string | null>;
  reload: (canReload: () => boolean) => Promise<void>;
  now?: () => number;
}
export const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;

// Only main tabs are safe: never cover OAuth, payments, exams or submission.
export function canOfferUpdate(segments: readonly string[], active: boolean, authenticated: boolean) {
  return active && authenticated && segments[0] === '(tabs)';
}

export function createAppUpdater(ports: Ports) {
  let snapshot: UpdateSnapshot = { updateId: null, applying: false, error: null };
  let safe = false;
  let checking = false;
  let nextCheck = 0;
  let dismissedId: string | null = null;
  const now = ports.now ?? Date.now;
  const listeners = new Set<() => void>();
  const publish = (next: UpdateSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const canReload = () => ports.enabled && safe;
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setSafe: (value: boolean) => { safe = value; },
    isVisible: () => !!snapshot.updateId && snapshot.updateId !== dismissedId,
    async check() {
      if (!canReload() || checking || snapshot.applying || now() < nextCheck) return;
      if (snapshot.updateId && snapshot.updateId !== dismissedId) return;
      checking = true;
      nextCheck = now() + UPDATE_CHECK_INTERVAL;
      try {
        const candidate = await ports.check();
        if (!candidate || candidate === dismissedId) return;
        const downloaded = await ports.download();
        // An update may change while it downloads. Trust the fetched manifest.
        if (downloaded) publish({ updateId: downloaded, applying: false, error: null });
      } catch {
        // Offline devices keep their working app. Retry at a later check.
      } finally {
        checking = false;
      }
    },
    dismiss() {
      if (snapshot.applying) return;
      dismissedId = snapshot.updateId;
      publish({ ...snapshot, error: null });
    },
    async apply() {
      if (!canReload() || !snapshot.updateId || snapshot.applying) return;
      publish({ ...snapshot, applying: true, error: null });
      try {
        // The native adapter checks safety again after resolving its module.
        await ports.reload(canReload);
      } catch {
        publish({ ...snapshot, applying: false, error: 'Could not restart the app. Please try again.' });
      }
    },
  };
}
