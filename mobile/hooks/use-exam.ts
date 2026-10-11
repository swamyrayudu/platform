import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Href } from 'expo-router';
import { useAuth } from '@/store/auth';
import { elapsedSeconds, type ExamJournal, type ExamDraft, type ExamKind } from '@/store/exam';
import { vault } from '@/services/vault';
import { examDrafts } from '@/services/exam-drafts';
import { practiceService } from '@/services/question-service';
import { examService } from '@/services/exam-service';
import type { SelectedOption } from '@/types/mock-tests';
import { pauseExamClock, pausedQuestionTime, resumeExamClock, type ExamClock } from '@/utils/exam-clock';
import { createExamJournal } from '@/services/exam-journal';
import { examSubmission } from '@/services/exam-submission';
export function useExam(kind: ExamKind, id: string) {
  const {user}=useAuth();const journal=useRef<ExamJournal|undefined>(undefined);
  const clock=useRef<ExamClock>({base:0,resumedAt:Date.now(),running:true});const questionTime=useRef(Date.now());
  const confirmationOpen=useRef(false);
  const [draft,setDraft]=useState<ExamDraft>();const [error,setError]=useState<unknown>();const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true); const [reload,setReload]=useState(0);
  const [exitDestination,setExitDestination]=useState<Href>();const finishing=useRef(false);const checkingAnswer=useRef(false);
  const publish=useCallback(()=>{if(journal.current)setDraft({...journal.current.draft,answers:{...journal.current.draft.answers},pending:{...journal.current.draft.pending},feedback:{...journal.current.draft.feedback}});},[]);
  const checkpoint=useCallback(()=>{const j=journal.current;if(!j)return; j.draft.elapsed=clock.current.running?elapsedSeconds(clock.current.base,clock.current.resumedAt,Date.now(),j.draft.duration):clock.current.base;
    const elapsed=j.draft.elapsed;
    // A timer tick changes only time; preserve the drawer's data references.
    setDraft(current=>current&&current.elapsed!==elapsed?{...current,elapsed}:current);
  },[]);
  const resumeClock=useCallback(()=>{
    const now=Date.now();
    questionTime.current+=pausedQuestionTime(clock.current,now);
    clock.current=resumeExamClock(clock.current,now);
  },[]);
  const pauseForConfirmation=useCallback(()=>{
    const j=journal.current;
    if(!j||busy||finishing.current||checkingAnswer.current||confirmationOpen.current)return false;
    confirmationOpen.current=true;
    clock.current=pauseExamClock(clock.current,j.draft.duration,Date.now());checkpoint();
    return true;
  },[busy,checkpoint]);
  const endConfirmation=useCallback((resume=true)=>{
    if(!confirmationOpen.current)return;
    confirmationOpen.current=false;
    if(resume&&!finishing.current&&!journal.current?.draft.submitIntent)resumeClock();
  },[resumeClock]);
  useEffect(()=>{
    let cancelled=false;
    async function load() {
      setLoading(true);setError(undefined);setDraft(undefined);setExitDestination(undefined);journal.current=undefined;confirmationOpen.current=false;
      try {
        if(!user)return;
        let next:ExamDraft|null=null;
          if(kind==='practice') {
            const {saved,state:session}=await examDrafts.load(user.id,kind,id,async()=>(await practiceService.get(id)).session);
            if(cancelled)return;
            if(session?.status==='completed'){setExitDestination({pathname:'/result',params:{kind,id}});return;}
            if(session&&session.status!=='in_progress')throw new Error('This practice has ended. Choose a new practice from the library.');
            next=saved;
            if(!next){
            if(!session)throw new Error('Connect to RSD Education to load this practice.');
            next={userId:user!.id,kind,id,title:`${session.subject} practice`,duration:session.duration_seconds,elapsed:session.time_spent_seconds,index:0,feedbackMode:session.feedback_mode,questions:session.questions.map((q,i)=>({key:q.question_id||q.id,uid:q.question_uid,number:i+1,question:q.question,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,subject:q.subject,topic:q.topic})),answers:Object.fromEntries(Object.entries(session.user_answers).map(([key,a])=>[key,{option:a.selected_answer,marked:!!a.marked_for_review,seconds:a.time_taken_seconds||0,revision:0}])),pending:{},feedback:{},submitIntent:false,updatedAt:Date.now()};
            // Feedback already released by the server survives a fresh-device resume.
            if(session.feedback_mode==='instant')next.feedback=Object.fromEntries(Object.entries(session.user_answers)
              .filter(([,answer])=>answer.correct_answer&&typeof answer.is_correct==='boolean')
              .map(([key,answer])=>[key,{correct_answer:answer.correct_answer!,explanation:answer.explanation??null,is_correct:answer.is_correct!}]));
            }
          } else {
            const {saved,state:attempt}=await examDrafts.load(user.id,kind,id,async()=>(await examService.get(id)).attempt);
            if(cancelled)return;
            if(attempt?.status==='submitted'){setExitDestination({pathname:'/result',params:{kind,id}});return;}
            if(attempt&&attempt.status!=='in_progress')throw new Error('This paper has ended. Start or resume a paper from Mock Tests.');
            next=saved;
            if(next&&attempt){
              next.duration=attempt.duration_seconds;
              next.elapsed=Math.max(next.elapsed,attempt.time_spent_seconds);
            }else if(!next){
            if(!attempt)throw new Error('Connect to RSD Education to load this paper.');
            const [{test},questions]=await Promise.all([examService.metadata(attempt.mock_test_id),examService.questions(attempt.mock_test_id)]);
            next={userId:user!.id,kind,id,testId:attempt.mock_test_id,title:test.title,duration:attempt.duration_seconds,elapsed:attempt.time_spent_seconds,index:0,feedbackMode:'end',questions:questions.map(q=>({key:q.question_uid,uid:q.question_uid,number:q.question_number,question:q.question,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,subject:q.subject,topic:q.topic,section:q.section_name,sectionId:q.section_id})),answers:Object.fromEntries(Object.entries(attempt.existing_answers).map(([key,a])=>[key,{option:a.selected_option,marked:a.marked_for_review,seconds:0,revision:0}])),pending:{},feedback:{},submitIntent:false,updatedAt:Date.now()};
            }
          }
        if(cancelled)return;
        if(!next.questions.length)throw new Error('No questions were returned for this session.');
        clock.current={base:next.elapsed,resumedAt:Date.now(),running:true};questionTime.current=Date.now();
        if(next.submitIntent)clock.current=pauseExamClock(clock.current,next.duration,Date.now());
        const loaded=createExamJournal(next);
        await loaded.persist();
        if(cancelled)return;
        journal.current=loaded;
        if(kind==='practice') await vault.remove('created-practice');
        publish();
      }catch(e){if(!cancelled)setError(e);}finally{if(!cancelled)setLoading(false);}
    }
    void load();
    return()=>{cancelled=true;};
  },[kind,id,user,reload,publish]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      checkpoint();
      const j=journal.current;if(!j)return;
      if(!clock.current.running||finishing.current)return;
      if(j.draft.elapsed%10===0&&!finishing.current)void j.persist().catch(setError);
      if(j.draft.duration>0&&j.draft.elapsed>=j.draft.duration&&!j.draft.submitIntent)void submit();
    },1000);
    const subscription=AppState.addEventListener('change',state=>{
      const j=journal.current;if(!j||finishing.current)return;
      checkpoint();
      if(clock.current.pausedAt!==undefined){
        if(state!=='active')void j.persist().catch(setError);
        return;
      }
      if(state!=='active'){
        clock.current={base:j.draft.elapsed,resumedAt:Date.now(),running:kind==='practice'};
        void j.persist().catch(setError);
        if(kind==='mock')void examService.pause(id,j.draft.elapsed).catch(setError);
      }else{clock.current={base:clock.current.running?elapsedSeconds(clock.current.base,clock.current.resumedAt,Date.now(),j.draft.duration):clock.current.base,resumedAt:Date.now(),running:true};}
    });
    return()=>{clearInterval(timer);subscription.remove();};
  });
  async function select(option:SelectedOption,marked?:boolean) {
    const j=journal.current;if(!j||busy||finishing.current||checkingAnswer.current||confirmationOpen.current)return;setError(undefined);
    const instant=j.draft.feedbackMode==='instant';if(instant){checkingAnswer.current=true;setBusy(true);}
    const q=j.draft.questions[j.draft.index];const previous=j.draft.answers[q.key];
    try{
      const seconds=(previous?.seconds||0)+Math.max(0,Math.floor((Date.now()-questionTime.current)/1000));questionTime.current=Date.now();
      // The journal updates its in-memory answer synchronously. Show it now;
      // await the durable save before sending anything to the server.
      const saved=j.select(q.key,option,marked??previous?.marked??false,seconds);
      publish();
      await saved;
      await j.flush();publish();
    }catch(e){setError(e);publish();}finally{if(instant){checkingAnswer.current=false;setBusy(false);}}
  }
  async function sync() {setBusy(true);setError(undefined);try{await journal.current?.flush();publish();}catch(e){setError(e);}finally{setBusy(false);}}
  async function submit() {
    const j=journal.current;if(!j||busy||finishing.current)return;finishing.current=true;setBusy(true);setError(undefined);
    clock.current=pauseExamClock(clock.current,j.draft.duration,Date.now());checkpoint();
    j.draft.submitIntent=true;
    // Hand off before navigating. The result page joins this job and owns retry;
    // no storage, network or cache refresh must delay the route transition.
    void examSubmission.run(j.draft.userId,kind,id,j).catch(()=>{});
    journal.current=undefined;
    setExitDestination({pathname:'/result',params:{kind,id,submit:'1'}});
  }
  const move=useCallback(async(index:number)=>{
    const j=journal.current;if(!j||finishing.current||confirmationOpen.current)return; j.draft.index=index;questionTime.current=Date.now();publish();
    try{checkpoint();await j.persist();}catch(e){setError(e);}
  },[checkpoint,publish]);
  const leave=useCallback(async(abandon=false)=>{
    const j=journal.current;if(!j||finishing.current)return;finishing.current=true;setBusy(true);setError(undefined);
    // Retain the confirmation's paused time while waiting for saves and sync.
    clock.current=pauseExamClock(clock.current,j.draft.duration,Date.now());checkpoint();
    try{
      await j.prepareLeave(abandon,{
        abandon:()=>kind==='practice'?practiceService.abandon(id):examService.abandon(id),
        clear:()=>examDrafts.clear(j.draft.userId,kind,id),
        pause:elapsed=>examService.pause(id,elapsed),
      });
      journal.current=undefined;
      setExitDestination(kind==='mock'?'/(tabs)/mocks':'/(tabs)/practice');
    }catch(e){
      resumeClock();
      setError(e);
    }finally{finishing.current=false;setBusy(false);}
  },[checkpoint,kind,id,resumeClock]);
  return {draft,error,busy,loading,exitDestination,select,sync,submit,move,leave,pauseForConfirmation,endConfirmation,retry:()=>setReload(x=>x+1)};
}
