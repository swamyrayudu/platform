import { elapsedSeconds } from '../store/exam';

export interface ExamClock {base:number;resumedAt:number;running:boolean;pausedAt?:number}
// pausedAt distinguishes an intentional confirmation/action pause from the
// existing background policy. Repeated Back taps must not reset that instant.
export function pauseExamClock(clock:ExamClock,duration:number,now:number):ExamClock {
  if(clock.pausedAt!==undefined)return clock;
  return {base:clock.running?elapsedSeconds(clock.base,clock.resumedAt,now,duration):clock.base,resumedAt:now,running:false,pausedAt:now};
}
export function resumeExamClock(clock:ExamClock,now:number):ExamClock {
  return {base:clock.base,resumedAt:now,running:true};
}
export function pausedQuestionTime(clock:ExamClock,now:number) {
  return clock.pausedAt===undefined?0:Math.max(0,now-clock.pausedAt);
}
