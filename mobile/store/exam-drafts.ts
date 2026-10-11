import type { ExamDraft, ExamKind } from './exam';
import { ApiError } from '../services/http';

interface Storage {
  read<T>(name:string):Promise<T|null>;
  write(name:string,data:unknown):Promise<void>;
  remove(name:string):Promise<void>;
}
const activeKey='active-exam';
const key=(userId:string,kind:ExamKind,id:string)=>`exam-draft:${encodeURIComponent(userId)}:${kind}:${encodeURIComponent(id)}`;
const matches=(draft:ExamDraft|null,userId:string,kind:ExamKind,id:string)=>draft?.userId===userId&&draft.kind===kind&&draft.id===id;

// The active record is a Home shortcut, not a lock on other papers. Keep each
// attempt separately so switching paper/medium never overwrites queued answers.
export function createExamDraftStore(storage:Storage) {
  let tail:Promise<unknown>=Promise.resolve();
  function serial<T>(operation:()=>Promise<T>):Promise<T> {
    const next=tail.catch(()=>{}).then(operation);tail=next;return next;
  }
  async function archive(draft:ExamDraft) {
    const name=key(draft.userId,draft.kind,draft.id);
    // Scoped saves are authoritative, including when updating the Home shortcut
    // failed. Never migrate an older shortcut over newer queued answers.
    if(!await storage.read<ExamDraft>(name))await storage.write(name,draft);
  }
  async function archiveActive() {
    const active=await storage.read<ExamDraft>(activeKey);
    if(active)await archive(active);
  }
  const store={
    read:(userId:string,kind:ExamKind,id:string)=>serial(async()=>{
      // Migrate the installed app's original single draft before replacing it.
      await archiveActive();
      return storage.read<ExamDraft>(key(userId,kind,id));
    }),
    save:(draft:ExamDraft)=>serial(async()=>{
      const active=await storage.read<ExamDraft>(activeKey);
      if(active&&!matches(active,draft.userId,draft.kind,draft.id))
        await archive(active);
      await storage.write(key(draft.userId,draft.kind,draft.id),draft);
      await storage.write(activeKey,draft);
    }),
    clear:(userId:string,kind:ExamKind,id:string)=>serial(async()=>{
      await storage.remove(key(userId,kind,id));
      const active=await storage.read<ExamDraft>(activeKey);
      if(matches(active,userId,kind,id))await storage.remove(activeKey);
    }),
    async load<T extends {status:string}>(userId:string,kind:ExamKind,id:string,getState:()=>Promise<T>) {
      const [saved,response]=await Promise.all([store.read(userId,kind,id),getState().then(state=>({state,error:null}),error=>({state:null,error}))]);
      if(response.error){
        if(saved&&response.error instanceof ApiError&&response.error.code==='NETWORK_ERROR')return {saved,state:null};
        throw response.error;
      }
      const state=response.state!;
      // A completed attempt on the website must not resume an old local draft.
      if(['completed','submitted','expired','abandoned'].includes(state.status)) {
        await store.clear(userId,kind,id);
        return {saved:null,state};
      }
      return {saved,state};
    },
  };
  return store;
}
