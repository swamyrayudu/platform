import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePlayUpdate, optionalSnoozed, parseRules, OPTIONAL_SNOOZE_MS, type PlayUpdateInfo } from '../utils/play-update-policy';

const info = (patch: Partial<PlayUpdateInfo> = {}): PlayUpdateInfo => ({
  availability: 'available', availableVersionCode: 12, installedVersionCode: 10, priority: 0, stalenessDays: 2,
  immediateAllowed: true, flexibleAllowed: true, installStatus: 'unknown', packageName: 'com.karthik.rsdeducation', ...patch,
});
const rules = {minVersionCode: 0, flexible: true};

test('a newer version on Play is a small update when nothing is required', () => {
  assert.deepEqual(decidePlayUpdate(info(), rules), {kind: 'optional', versionCode: 12});
});

test('an install below the admin minimum must update through Play', () => {
  assert.deepEqual(decidePlayUpdate(info(), {minVersionCode: 11, flexible: true}), {kind: 'required', viaPlay: true});
});

test('Play priority 4 or 5 makes the release required; lower priorities do not', () => {
  assert.deepEqual(decidePlayUpdate(info({priority: 4}), rules), {kind: 'required', viaPlay: true});
  assert.deepEqual(decidePlayUpdate(info({priority: 3}), rules), {kind: 'optional', versionCode: 12});
});

test('required but Play cannot run the update here: send the student to the Play Store page', () => {
  assert.deepEqual(decidePlayUpdate(info({availability: 'not_available'}), {minVersionCode: 11, flexible: true}), {kind: 'required', viaPlay: false});
  assert.deepEqual(decidePlayUpdate(info({immediateAllowed: false}), {minVersionCode: 11, flexible: true}), {kind: 'required', viaPlay: false});
});

test('an interrupted required update resumes', () => {
  assert.deepEqual(decidePlayUpdate(info({availability: 'in_progress'}), {minVersionCode: 11, flexible: true}), {kind: 'required', viaPlay: true});
});

test('a downloaded small update asks to restart', () => {
  assert.deepEqual(decidePlayUpdate(info({availability: 'not_available', installStatus: 'downloaded'}), rules), {kind: 'restart'});
});

test('small updates switched off, or none on Play: nothing to do', () => {
  assert.deepEqual(decidePlayUpdate(info(), {minVersionCode: 0, flexible: false}), {kind: 'none'});
  assert.deepEqual(decidePlayUpdate(info({availability: 'not_available'}), rules), {kind: 'none'});
  assert.deepEqual(decidePlayUpdate(info({flexibleAllowed: false}), rules), {kind: 'none'});
});

test('"Later" snoozes the same version for three days, but not a newer one', () => {
  const optional = {kind: 'optional', versionCode: 12} as const;
  const now = 1_000_000_000;
  assert.equal(optionalSnoozed(optional, {versionCode: 12, at: now - 1000}, now), true);
  assert.equal(optionalSnoozed(optional, {versionCode: 12, at: now - OPTIONAL_SNOOZE_MS - 1}, now), false);
  assert.equal(optionalSnoozed(optional, {versionCode: 11, at: now - 1000}, now), false);
  assert.equal(optionalSnoozed({kind: 'required', viaPlay: true}, {versionCode: 99, at: now}, now), false);
});

test('server rules: odd values fall back to nothing required, small updates on', () => {
  assert.deepEqual(parseRules(null), {minVersionCode: 0, flexible: true});
  assert.deepEqual(parseRules({minVersionCode: '7', flexible: false}), {minVersionCode: 7, flexible: false});
  assert.deepEqual(parseRules({minVersionCode: -3}), {minVersionCode: 0, flexible: true});
});
