import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOfferUpdate, createAppUpdater, UPDATE_CHECK_INTERVAL } from '../services/app-updater';

function gate<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function setup(options: {
  enabled?: boolean; check?: () => Promise<string | null>; download?: () => Promise<string | null>;
  reload?: (canReload: () => boolean) => Promise<void>;
} = {}) {
  let time = 1000, checks = 0, downloads = 0, reloads = 0;
  const updater = createAppUpdater({
    enabled: options.enabled ?? true,
    now: () => time,
    check: async () => { checks++; return options.check ? options.check() : 'new'; },
    download: async () => { downloads++; return options.download ? options.download() : 'new'; },
    reload: async safe => { reloads++; if (options.reload) await options.reload(safe); },
  });
  updater.setSafe(true);
  return { updater, counts: () => ({ checks, downloads, reloads }), advance: () => { time += UPDATE_CHECK_INTERVAL; } };
}

test('only authenticated foreground main tabs can offer updates', () => {
  for (const route of ['index', 'practice', 'mocks', 'performance', 'profile']) {
    assert.equal(canOfferUpdate(['(tabs)', route], true, true), true);
  }
  for (const route of [['exam'], ['result'], ['mock', '[id]'], ['subscription'], ['login'], ['onboarding'], ['auth', 'callback']]) {
    assert.equal(canOfferUpdate(route, true, true), false);
  }
  assert.equal(canOfferUpdate(['(tabs)'], false, true), false);
  assert.equal(canOfferUpdate(['(tabs)'], true, false), false);
});

test('development mode and unsafe routes cannot check, download or reload', async () => {
  const disabled = setup({ enabled: false });
  await disabled.updater.check(); await disabled.updater.apply();
  assert.deepEqual(disabled.counts(), { checks: 0, downloads: 0, reloads: 0 });
  const exam = setup(); exam.updater.setSafe(false);
  await exam.updater.check(); await exam.updater.apply();
  assert.deepEqual(exam.counts(), { checks: 0, downloads: 0, reloads: 0 });
});

test('entering an exam during a download defers restart until returning to tabs', async () => {
  const download = gate<string | null>();
  const app = setup({ download: () => download.promise });
  const checking = app.updater.check();
  await Promise.resolve();
  app.updater.setSafe(false); download.resolve('new'); await checking;
  assert.equal(app.updater.getSnapshot().updateId, 'new');
  await app.updater.apply(); assert.equal(app.counts().reloads, 0);
  app.updater.setSafe(true); await app.updater.apply(); assert.equal(app.counts().reloads, 1);
});

test('concurrent checks share one download; duplicate Update now taps share one restart', async () => {
  const download = gate<string | null>(), reload = gate<void>();
  const app = setup({ download: () => download.promise, reload: () => reload.promise });
  const first = app.updater.check(); await app.updater.check();
  download.resolve('new'); await first;
  assert.deepEqual(app.counts(), { checks: 1, downloads: 1, reloads: 0 });
  const applying = app.updater.apply(); await app.updater.apply(); app.updater.dismiss();
  assert.equal(app.updater.getSnapshot().applying, true);
  assert.equal(app.updater.isVisible(), true);
  reload.resolve(); await applying;
  assert.equal(app.counts().reloads, 1);
});

test('Later hides the same update for this run, but a newer update can be offered', async () => {
  let next = 'first';
  const app = setup({ check: async () => next, download: async () => next });
  await app.updater.check(); app.updater.dismiss();
  assert.equal(app.updater.isVisible(), false);
  app.advance(); await app.updater.check(); assert.equal(app.counts().downloads, 1);
  next = 'second'; app.advance(); await app.updater.check();
  assert.equal(app.updater.isVisible(), true);
  assert.equal(app.updater.getSnapshot().updateId, 'second');
});

test('offline checks/downloads leave the app usable and retry without flooding requests', async () => {
  let offline = true;
  const app = setup({ download: async () => { if (offline) throw new Error('offline'); return 'new'; } });
  await app.updater.check(); await app.updater.check();
  assert.equal(app.updater.isVisible(), false);
  assert.deepEqual(app.counts(), { checks: 1, downloads: 1, reloads: 0 });
  assert.equal(app.updater.getSnapshot().error, null);
  offline = false; app.advance(); await app.updater.check();
  assert.equal(app.updater.isVisible(), true);
});

test('no available update never downloads or displays a popup', async () => {
  const app = setup({ check: async () => null });
  await app.updater.check(); await app.updater.apply();
  assert.equal(app.updater.isVisible(), false);
  assert.deepEqual(app.counts(), { checks: 1, downloads: 0, reloads: 0 });
});

test('restart failure offers retry and rechecks safety before native reload', async () => {
  let fail = true;
  const native = gate<void>();
  const app = setup({ reload: async safe => { await native.promise; if (!safe() || fail) throw new Error('cannot reload'); } });
  await app.updater.check(); const restarting = app.updater.apply();
  app.updater.setSafe(false); native.resolve(); await restarting;
  assert.equal(app.updater.getSnapshot().applying, false);
  assert.match(app.updater.getSnapshot().error ?? '', /Please try again/);
  app.updater.setSafe(true); fail = false; await app.updater.apply();
  assert.equal(app.counts().reloads, 2);
});

test('downloaded manifest wins a publish race, including rollback to embedded', async () => {
  const app = setup({ check: async () => 'old-candidate', download: async () => 'embedded' });
  await app.updater.check();
  assert.equal(app.updater.getSnapshot().updateId, 'embedded');
  assert.equal(app.updater.isVisible(), true);
});
