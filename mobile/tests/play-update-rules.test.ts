import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockedForPlayUpdate, parseNameStatus } from '../utils/play-update-rules';

const reasons = (lines: string) => blockedForPlayUpdate(parseNameStatus(lines)).map(b => `${b.path}:${b.reason}`);

test('bug fixes in ordinary screens and services may ship over the air', () => {
  assert.deepEqual(reasons('M\tcomponents/result-summary.tsx\nM\tservices/exam-service.ts\nM\tapp/(tabs)/practice.tsx'), []);
});

test('payment, content-policy and legal changes need a reviewed build', () => {
  assert.deepEqual(reasons('M\tservices/payment-service.ts\nM\tcomponents/play-subscription-plans.tsx\nM\tapp/subscription.tsx\nM\tservices/content-policy.ts\nM\tutils/legal.ts'), [
    'services/payment-service.ts:payments', 'components/play-subscription-plans.tsx:payments', 'app/subscription.tsx:payments',
    'services/content-policy.ts:content hidden in the Play build', 'utils/legal.ts:government disclaimer',
  ]);
});

test('native code, build config and dependencies need a new build', () => {
  assert.deepEqual(reasons('M\tmodules/rsd-play-billing/android/build.gradle\nM\tapp.config.ts\nM\tpackage.json\nA\treact-native.config.js'), [
    'modules/rsd-play-billing/android/build.gradle:native module', 'app.config.ts:build config',
    'package.json:dependencies (may add native code)', 'react-native.config.js:build config',
  ]);
});

test('a new screen is a new feature, an edited one is not', () => {
  assert.deepEqual(blockedForPlayUpdate([{status: '??', path: 'app/leaderboard.tsx'}, {status: 'M', path: 'app/result.tsx'}]),
    [{path: 'app/leaderboard.tsx', reason: 'new screen'}]);
});

test('renames count by their new path', () => {
  assert.deepEqual(reasons('R100\tservices/old.ts\tservices/payment-flow.ts'), ['services/payment-flow.ts:payments']);
});
