import { createSubmissionFlow } from './submission-flow';
import { createExamJournal } from './exam-journal';
import { examDrafts } from './exam-drafts';
import { examService } from './exam-service';
import { practiceService } from './question-service';

export const examSubmission=createSubmissionFlow({
  restore:async(userId,kind,id)=>{
    const saved=await examDrafts.read(userId,kind,id);
    return saved?createExamJournal(saved):null;
  },
  state:async(kind,id)=>kind==='mock'?(await examService.get(id)).attempt.status:(await practiceService.get(id)).session.status,
  clear:(userId,kind,id)=>examDrafts.clear(userId,kind,id),
});
