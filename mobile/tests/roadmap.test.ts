import test from 'node:test';
import assert from 'node:assert/strict';
import { answerString, clockText, gradeAnswers, isoDate, parseIso, planDayNumber, shiftIso, sizeText, weeksOf } from '../utils/roadmap';
import { tabLayout } from '../utils/layout';
import type { MyTestQuestion, RoadmapDay } from '../types/learning';

test('plan day numbers count from the start date in local days', () => {
  const start = '2026-10-03';
  assert.equal(planDayNumber(start, parseIso('2026-10-03')), 1);
  assert.equal(planDayNumber(start, parseIso('2026-10-14') + 15 * 3600 * 1000), 12);
  assert.equal(planDayNumber(start, parseIso('2026-10-01')), -1);
  assert.equal(isoDate(parseIso(start)), start);
});

test('shifting a start date crosses months and years', () => {
  assert.equal(shiftIso('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftIso('2027-01-01', -1), '2026-12-31');
});

test('days group into weeks by their week number', () => {
  const days = Array.from({length: 90}, (_, i) => ({day: i + 1, week: Math.ceil((i + 1) / 7)})) as RoadmapDay[];
  const weeks = weeksOf(days);
  assert.equal(weeks.length, 13);
  assert.equal(weeks[12].length, 6);
  assert.deepEqual(weeks[1].map(d => d.day), [8, 9, 10, 11, 12, 13, 14]);
});

test('answers grade against the key and serialise for the server', () => {
  const q = (correct_answer: MyTestQuestion['correct_answer']) => ({question: 'q', option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_answer, explanation: '', topic: '', difficulty: ''});
  const questions = [q('A'), q('B'), q('C')];
  assert.equal(gradeAnswers(['A', 'C', null], questions), 1);
  assert.equal(answerString(['A', 'C', null]), 'AC-');
});

test('clock and size text', () => {
  assert.equal(clockText(65), '1:05');
  assert.equal(clockText(3725), '1:02:05');
  assert.equal(sizeText(2 * 1024 * 1024), '2.0 MB');
  assert.equal(sizeText(300), '1 KB');
});

test('five tabs still fit one label line on a 360dp phone', () => {
  const bar = tabLayout(360, 1, 0, 5);
  assert.equal(bar.labelLines, 1);
  assert.equal(bar.tabWidth, 72);
});
