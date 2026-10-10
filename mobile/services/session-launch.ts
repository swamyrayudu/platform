import { vault } from './vault';
import { practiceService } from './question-service';
import type { ExamDraft } from '@/store/exam';

let launching = false;
// Guards native navigation and preserves the server-issued ID. Selection and
// creation rules still belong to the existing API, which has no creation key.
export async function launchPractice<T extends {session:{id:string}}>(userId:string, create:()=>Promise<T>):Promise<T> {
  if(launching)throw new Error('A practice session is already being started.');
  launching=true;
  try {
    const draft=await vault.read<ExamDraft>('active-exam');
    if(draft?.userId===userId)throw new Error('Resume or end your current exam from Home before starting another.');
    const created=await vault.read<{id:string;userId:string}>('created-practice');
    if(created?.userId===userId){
      const previous=await practiceService.get(created.id);
      if(previous.session.status==='in_progress')throw new Error('Resume the practice you already started from Home before creating another.');
      await vault.remove('created-practice');
    }
    const result=await create();
    await vault.write('created-practice',{id:result.session.id,userId});
    return result;
  } finally {launching=false;}
}
