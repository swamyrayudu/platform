// Which changes may ship to the Google Play app as an over-the-air update.
//
// Google Play allows JavaScript updates outside the store for fixes, but changes
// to how the app is paid for, what content it shows, or new features must go
// through review in a new build. Native and config changes cannot ship over the
// air at all: the installed app would run JavaScript that expects native code it
// does not have. scripts/play-update.ts blocks `eas update` for any of these.

export type Change = {status: string; path: string};
export type Blocked = {path: string; reason: string};

/** Native code and build config: only a new build can carry these. */
const NEEDS_BUILD: [RegExp, string][] = [
  [/^modules\//, 'native module'],
  [/^(app\.config\.ts|app\.json|react-native\.config\.js|eas\.json)$/, 'build config'],
  [/^package(-lock)?\.json$/, 'dependencies (may add native code)'],
  [/^assets\/(icon|adaptive-icon|play-store-icon-512)\.png$/, 'app icon'],
];

/** Play policy areas: payments, hidden content, legal text. A reviewed build only. */
const NEEDS_REVIEW: [RegExp, string][] = [
  [/^services\/(payment-service|payment-flow|play-billing-service|play-billing-flow|razorpay)\.ts$/, 'payments'],
  [/^components\/razorpay-plans\.tsx$/, 'payments'],
  [/^stubs\//, 'payments (keeps Razorpay out of the Play build)'],
  [/^metro\.config\.cjs$/, 'build config (keeps Razorpay out of the Play build)'],
  [/^components\/(play-subscription-plans|play-purchase-sync|subscription-plan-card)\.tsx$/, 'payments'],
  [/^app\/subscription\.tsx$/, 'payments'],
  [/^services\/content-policy\.ts$/, 'content hidden in the Play build'],
  [/^utils\/legal\.ts$/, 'government disclaimer'],
  [/^utils\/play-update-rules\.ts$/, 'these update rules'],
];

/** Paths are relative to the mobile app folder. Returns the changes that must not go over the air. */
export function blockedForPlayUpdate(changes: Change[]): Blocked[] {
  const blocked: Blocked[] = [];
  for (const {status, path} of changes) {
    const p = path.replace(/\\/g, '/');
    const rule = [...NEEDS_BUILD, ...NEEDS_REVIEW].find(([pattern]) => pattern.test(p));
    if (rule) blocked.push({path: p, reason: rule[1]});
    // A new route file is a new screen: a new feature, not a fix.
    else if (/^(A|\?\?)/.test(status) && /^app\/.+\.tsx$/.test(p)) blocked.push({path: p, reason: 'new screen'});
  }
  return blocked;
}

/** Parses `git diff --name-status` lines (renames give old and new path; the new one counts). */
export function parseNameStatus(output: string): Change[] {
  return output.split(/\r?\n/).filter(Boolean).map(line => {
    const parts = line.split('\t');
    return {status: parts[0], path: parts[parts.length - 1]};
  });
}
