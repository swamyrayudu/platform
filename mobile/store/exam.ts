import type { SelectedOption } from '@/types/mock-tests';
export type ExamKind = 'practice' | 'mock';
export interface ExamQuestion { key: string; uid?: string; number: number; question: string; option_a: string; option_b: string; option_c: string; option_d: string; subject: string; topic: string; section?: string }
export interface DraftAnswer { option: SelectedOption; marked: boolean; seconds: number; revision: number }
export interface ExamDraft {
  userId: string; kind: ExamKind; id: string; testId?: string; title: string;
  duration: number; elapsed: number; index: number; feedbackMode: 'instant' | 'end';
  questions: ExamQuestion[]; answers: Record<string,DraftAnswer>; pending: Record<string,number>;
  feedback: Record<string,{correct_answer: string | null; explanation: string | null; is_correct: boolean}>;
  submitIntent: boolean; updatedAt: number;
}
interface Ports {
  persist: (draft: ExamDraft) => Promise<void>;
  save: (question: ExamQuestion, answer: DraftAnswer) => Promise<ExamDraft['feedback'][string] | void>;
  state: () => Promise<string>;
  submit: (elapsed: number) => Promise<void>;
}
// No grading/selection logic here: this is only the durable transport journal.
export class ExamJournal {
  private persistTail: Promise<void> = Promise.resolve();
  private syncing?: Promise<void>;
  private submitting?: Promise<void>;
  constructor(public draft: ExamDraft, private ports: Ports) {}
  persist() {
    this.draft.updatedAt = Date.now();
    const snapshot = JSON.parse(JSON.stringify(this.draft)) as ExamDraft;
    const next = this.persistTail.catch(()=>{}).then(()=>this.ports.persist(snapshot));
    this.persistTail = next;
    return next;
  }
  async select(key: string, option: SelectedOption, marked: boolean, seconds: number) {
    if (this.draft.submitIntent) throw new Error('Submission is pending. Retry it before editing answers.');
    const previous = this.draft.answers[key];
    if (this.draft.feedbackMode === 'instant' && this.draft.feedback[key] && previous?.option !== option) {
      throw new Error('This answer has already been checked.');
    }
    const revision = (previous?.revision ?? 0) + 1;
    this.draft.answers[key] = {option,marked,seconds,revision};
    this.draft.pending[key] = revision;
    if (previous?.option !== option) delete this.draft.feedback[key];
    await this.persist();
  }
  async flush() {
    if (this.syncing) return this.syncing;
    this.syncing = (async()=>{
      await this.persistTail;
      while (Object.keys(this.draft.pending).length) {
        const key = Object.keys(this.draft.pending)[0];
        const answer = {...this.draft.answers[key]};
        const question = this.draft.questions.find(q=>q.key===key);
        if (!question) throw new Error('Saved answer has no matching question.');
        const feedback = await this.ports.save(question,answer);
        // A newer selection made during the request must remain queued.
        if (this.draft.pending[key] === answer.revision) {
          delete this.draft.pending[key];
          if (feedback) this.draft.feedback[key] = feedback;
        }
        await this.persist();
      }
    })().finally(()=>{this.syncing=undefined;});
    return this.syncing;
  }
  async submit() {
    if (this.submitting) return this.submitting;
    this.submitting = (async()=>{
      this.draft.submitIntent = true;
      await this.persist();
      // Reconcile a lost response before writing again. Network failure here
      // leaves the intent and answers intact instead of blindly re-submitting.
      const status = await this.ports.state();
      if (['completed','submitted'].includes(status)) return;
      if (status !== 'in_progress') throw new Error('This session is no longer active.');
      await this.flush();
      await this.ports.submit(this.draft.elapsed);
    })().finally(()=>{this.submitting=undefined;});
    return this.submitting;
  }
}
export function elapsedSeconds(base: number, resumedAt: number, now: number, duration: number) {
  const elapsed = base + Math.max(0,Math.floor((now-resumedAt)/1000));
  return duration > 0 ? Math.min(duration,elapsed) : elapsed;
}
