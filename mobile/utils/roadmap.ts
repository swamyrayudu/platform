// Pure helpers for the Exam roadmap and My Tests screens.
import type { AnswerLetter, MyTestQuestion, RoadmapDay } from '@/types/learning';

export const DAY_MS = 86_400_000;

/** Midnight of the given time's local day. */
export function dayStart(time: number) { const d = new Date(time); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
/** YYYY-MM-DD in local time. */
export function isoDate(time: number) { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function parseIso(iso: string) { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d).getTime(); }
/** Plan day for `today`, 1 on the start date. Can be below 1 or above the plan's length. */
export function planDayNumber(startIso: string, today: number) { return Math.round((dayStart(today) - parseIso(startIso)) / DAY_MS) + 1; }
/** Shift a YYYY-MM-DD date by whole days. */
export function shiftIso(iso: string, days: number) { const d = new Date(parseIso(iso)); d.setDate(d.getDate()+days); return isoDate(d.getTime()); }
export function shortDate(time: number) { return new Date(time).toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short'}); }

export function weeksOf(days: readonly RoadmapDay[]) {
  const weeks: RoadmapDay[][] = [];
  for (const d of days) (weeks[d.week-1] ??= []).push(d);
  return weeks;
}

/** One character per question: A–D, or '-' when unanswered. */
export function answerString(answers: readonly (AnswerLetter | null)[]) { return answers.map(a => a ?? '-').join(''); }
export function gradeAnswers(answers: readonly (AnswerLetter | null)[], questions: readonly MyTestQuestion[]) {
  return questions.reduce((sum, q, i) => sum + (answers[i] === q.correct_answer ? 1 : 0), 0);
}
export function clockText(seconds: number) {
  const s = Math.max(0, Math.floor(seconds)); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const r = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}` : `${m}:${String(r).padStart(2,'0')}`;
}
export function sizeText(bytes: number) { return bytes >= 1024*1024 ? `${(bytes/(1024*1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes/1024))} KB`; }
