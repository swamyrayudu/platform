import type { MockTestResultSummary } from '../types/mock-tests';
import type { PracticeResultSummary } from '../types/practice';
import type { ReviewQuestion } from './question-review';

export function resultSummary(result:MockTestResultSummary|PracticeResultSummary) {
  const mock='total_marks' in result;
  const answered=result.correct_count+result.incorrect_count;
  return {
    score:result.score,total:mock?result.total_marks:result.total_questions,
    scoreLabel:mock?'Marks':'Score',scorePercent:mock?result.percentage:null,
    correct:result.correct_count,wrong:result.incorrect_count,skipped:mock?result.unanswered_count:result.skipped_count,
    answeredAccuracy:answered?100*result.correct_count/answered:null,
    time:`${Math.floor(result.total_time_seconds/60)}m ${result.total_time_seconds%60}s`,
  };
}
export const resultNumber=(value:number)=>Number(value.toFixed(1)).toString();
export function reviewAnswerText(question:ReviewQuestion,option:string|null) {
  if(!option)return 'Not answered';
  const key=({A:'option_a',B:'option_b',C:'option_c',D:'option_d'} as const)[option as 'A'|'B'|'C'|'D'];
  return key?`${option}. ${question[key]}`:option;
}
