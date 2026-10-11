import type { ExamJournal, ExamKind } from '../store/exam';

interface Ports {
  restore:(userId:string,kind:ExamKind,id:string)=>Promise<ExamJournal|null>;
  state:(kind:ExamKind,id:string)=>Promise<string>;
  clear:(userId:string,kind:ExamKind,id:string)=>Promise<void>;
}
interface Job {journal?:ExamJournal;pending?:Promise<true>;done?:boolean}
// The journal survives route unmount. Reloading the app recovers its encrypted
// draft and submit intent; server-state reconciliation remains in ExamJournal.
export function createSubmissionFlow(ports:Ports) {
  const jobs=new Map<string,Job>();
  return {
    run(userId:string,kind:ExamKind,id:string,journal?:ExamJournal):Promise<true> {
      const key=JSON.stringify([userId,kind,id]);
      const matches=(j:ExamJournal)=>j.draft.userId===userId&&j.draft.kind===kind&&j.draft.id===id;
      if(journal&&!matches(journal))return Promise.reject(new Error('This saved exam belongs to a different session.'));
      const job=jobs.get(key)??{};
      if(job.pending)return job.pending;
      if(job.done)return Promise.resolve(true);
      if(journal)job.journal=journal;
      const pending=Promise.resolve().then(async()=>{
        const active=job.journal??await ports.restore(userId,kind,id);
        if(active){
          if(!matches(active))throw new Error('This saved exam belongs to a different session.');
          job.journal=active;
          await active.submit();
          await ports.clear(userId,kind,id);
        }else{
          const state=await ports.state(kind,id);
          if(!['completed','submitted'].includes(state))throw new Error('Open this exam again to recover your answers, then submit.');
        }
        job.journal=undefined;job.done=true;
        // Retain only a small completed-job cache; never evict pending retries.
        for(const [oldKey,oldJob] of jobs)if(jobs.size>20&&oldKey!==key&&oldJob.done&&!oldJob.pending)jobs.delete(oldKey);
        return true as const;
      }).finally(()=>{job.pending=undefined;});
      job.pending=pending;jobs.set(key,job);
      return pending;
    },
  };
}
