import { createSubmissionFlow } from './submission-flow';
import { createExamJournal } from './exam-journal';
import { examDrafts } from './exam-drafts';
import { examService } from './exam-service';
import { practiceService } from './question-service';
import { vault } from './vault';

export const examSubmission=createSubmissionFlow({
  restore:async(userId,kind,id)=>{
    const saved=await examDrafts.read(userId,kind,id);
    return saved?createExamJournal(saved):null;
  },
  state:async(kind,id)=>kind==='mock'?(await examService.get(id)).attempt.status:(await practiceService.get(id)).session.status,
  clear:async(userId,kind,id)=>{
    await examDrafts.clear(userId,kind,id);
    if(kind==='practice'){
      const created=await vault.read<{id:string;userId:string}>('created-practice');
      if(created?.userId===userId&&created.id===id)await vault.remove('created-practice');
    }
  },
});
