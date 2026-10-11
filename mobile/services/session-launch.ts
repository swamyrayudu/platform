import { vault } from './vault';
import { practiceService } from './question-service';
import { examDrafts } from './exam-drafts';
import { examSubmission } from './exam-submission';
import type { ExamDraft } from '@/store/exam';

let launching = false;
async function finishPreviousPractice(userId:string,id:string) {
  const {saved,state:session}=await examDrafts.load(userId,'practice',id,async()=>(await practiceService.get(id)).session);
  if(saved){
    // Reuse durable submission: sync queued answers, reconcile server status,
    // grade and clear only this practice. Failed submissions remain retryable.
    await examSubmission.run(userId,'practice',id);
  }else{
    // A crash between creation and mounting the exam has no local answers.
    // Recheck server state on retries, including a lost submission response.
    if(session?.status==='in_progress')await practiceService.submit(id,session.time_spent_seconds);
    await examDrafts.clear(userId,'practice',id);
  }
}
// Guards native navigation and preserves the server-issued ID. Selection and
// creation rules still belong to the existing API, which has no creation key.
export async function launchPractice<T extends {session:{id:string}}>(userId:string, create:()=>Promise<T>):Promise<T> {
  if(launching)throw new Error('A practice session is already being started.');
  launching=true;
  try {
    const draft=await vault.read<ExamDraft>('active-exam');
    // A saved mock is independent of practice. Archive a legacy Home-only
    // draft before creating practice so its answers/timer remain resumable.
    if(draft?.userId===userId&&draft.kind==='mock')await examDrafts.read(userId,'mock',draft.id);
    const created=await vault.read<{id:string;userId:string}>('created-practice');
    if(draft?.userId===userId&&draft.kind==='practice')await finishPreviousPractice(userId,draft.id);
    if(created?.userId===userId){
      if(draft?.userId!==userId||draft.kind!=='practice'||draft.id!==created.id)await finishPreviousPractice(userId,created.id);
      await vault.remove('created-practice');
    }
    // Completing an old practice can temporarily change the Home shortcut.
    // Restore the authoritative saved mock, including any newer queued answers.
    if(draft?.userId===userId&&draft.kind==='mock'&&created?.userId===userId){
      const mock=await examDrafts.read(userId,'mock',draft.id);
      if(mock)await examDrafts.save(mock);
    }
    const result=await create();
    await vault.write('created-practice',{id:result.session.id,userId});
    return result;
  } finally {launching=false;}
}
