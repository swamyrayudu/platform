import { ExamJournal, type ExamDraft } from '@/store/exam';
import { examDrafts } from './exam-drafts';
import { examService } from './exam-service';
import { practiceService } from './question-service';

export function createExamJournal(draft:ExamDraft) {
  const {kind,id}=draft;
  return new ExamJournal(draft,{
    persist:next=>examDrafts.save(next),
    save:(q,a)=>kind==='practice'?practiceService.answer(id,{questionId:q.key,selectedAnswer:a.option,markedForReview:a.marked,timeTakenSeconds:a.seconds}):examService.answer(id,{questionId:q.key,questionNumber:q.number,selectedOption:a.option,markedForReview:a.marked,timeTakenSeconds:a.seconds}).then(()=>undefined),
    state:async()=>kind==='practice'?(await practiceService.get(id)).session.status:(await examService.get(id)).attempt.status,
    submit:async elapsed=>{if(kind==='practice')await practiceService.submit(id,elapsed);else await examService.submit(id,elapsed);},
  });
}
