import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultSummary, resultNumber, reviewAnswerText } from '../utils/result-summary';
import type { MockTestResultSummary } from '../types/mock-tests';
import type { PracticeResultSummary } from '../types/practice';
import type { ReviewQuestion } from '../utils/question-review';
test('mock marks percentage and answer accuracy stay distinct, with server counts and fractional marks',()=>{
  const result={score:20.5,total_marks:80,percentage:25.625,total_questions:160,correct_count:41,incorrect_count:9,unanswered_count:110,total_time_seconds:153} as MockTestResultSummary;
  const summary=resultSummary(result);
  assert.equal(summary.score,20.5);assert.equal(summary.scorePercent,25.625);assert.equal(summary.answeredAccuracy,82);assert.equal(summary.skipped,110);assert.equal(summary.time,'2m 33s');assert.equal(resultNumber(summary.scorePercent!), '25.6');
});
test('unanswered papers have no invented accuracy and negative marks remain visible',()=>{
  const summary=resultSummary({score:-1,total_marks:80,percentage:-1.25,total_questions:160,correct_count:0,incorrect_count:0,unanswered_count:160,total_time_seconds:0} as MockTestResultSummary);
  assert.equal(summary.answeredAccuracy,null);assert.equal(summary.score,-1);assert.equal(summary.skipped,160);
});
test('practice results retain question-based score and actual skipped count',()=>{
  const summary=resultSummary({score:8,total_questions:20,correct_count:8,incorrect_count:2,skipped_count:10,total_time_seconds:600,accuracy_pct:40} as PracticeResultSummary);
  assert.equal(summary.scoreLabel,'Score');assert.equal(summary.total,20);assert.equal(summary.answeredAccuracy,80);assert.equal(summary.scorePercent,null);assert.equal(summary.skipped,10);
});
test('review shows full selected and correct answer text, including Telugu and skipped answers',()=>{
  const q={option_a:'First',option_b:'తెలుగు సమాధానం',option_c:'Third',option_d:'Fourth'} as ReviewQuestion;
  assert.equal(reviewAnswerText(q,'B'),'B. తెలుగు సమాధానం');assert.equal(reviewAnswerText(q,'C'),'C. Third');assert.equal(reviewAnswerText(q,null),'Not answered');
});
