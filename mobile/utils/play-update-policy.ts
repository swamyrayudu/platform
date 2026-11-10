// What the Google Play app should do about a newer version on Google Play.
//
//   required  this install is older than the server's minimum version code
//             (set at /admin/app-updates), or Play marks the release urgent
//             (update priority 4–5). Play's full-screen "immediate" update; the
//             app stays locked until it is done.
//   optional  a newer version is on Play and small updates are on. Play's
//             "flexible" update downloads in the background, then the app asks
//             to restart. The student can choose Later.
//   restart   a flexible update finished downloading: ask to restart.
//   none      nothing to do.

export type PlayUpdateInfo = {
  availability: 'available' | 'in_progress' | 'not_available' | 'unknown';
  availableVersionCode: number;
  installedVersionCode: number;
  priority: number;
  stalenessDays: number | null;
  immediateAllowed: boolean;
  flexibleAllowed: boolean;
  installStatus: string;
  packageName: string;
};
export type UpdateRules = {minVersionCode: number; flexible: boolean};
export type UpdateDecision =
  | {kind: 'none'}
  | {kind: 'restart'}
  | {kind: 'optional'; versionCode: number}
  /** viaPlay false: Play cannot start the update here, so send the student to the Play Store page. */
  | {kind: 'required'; viaPlay: boolean};

/** Play's update priority runs 0–5; 4 and 5 mean urgent. */
export const URGENT_PRIORITY = 4;
/** After "Later" on a small update, ask again after this long. */
export const OPTIONAL_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export function decidePlayUpdate(info: PlayUpdateInfo, rules: UpdateRules): UpdateDecision {
  const onPlay = info.availability === 'available' || info.availability === 'in_progress';
  const required = info.installedVersionCode < rules.minVersionCode || (onPlay && info.priority >= URGENT_PRIORITY);
  if (required) return {kind: 'required', viaPlay: onPlay && info.immediateAllowed};
  if (info.installStatus === 'downloaded') return {kind: 'restart'};
  if (info.availability === 'available' && rules.flexible && info.flexibleAllowed && info.availableVersionCode > info.installedVersionCode) {
    return {kind: 'optional', versionCode: info.availableVersionCode};
  }
  return {kind: 'none'};
}

/** A small update dismissed with "Later" is offered again after the snooze, or at once for a newer version. */
export function optionalSnoozed(decision: UpdateDecision, snooze: {versionCode: number; at: number} | null, now: number) {
  return decision.kind === 'optional' && !!snooze && snooze.versionCode >= decision.versionCode && now - snooze.at < OPTIONAL_SNOOZE_MS;
}

/** Server rules arrive as JSON; anything odd falls back to "nothing required, small updates on". */
export function parseRules(value: unknown): UpdateRules {
  const v = (value ?? {}) as {minVersionCode?: unknown; flexible?: unknown};
  const min = Number(v.minVersionCode);
  return {minVersionCode: Number.isInteger(min) && min > 0 ? min : 0, flexible: v.flexible !== false};
}
