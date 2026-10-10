import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { ExamJournal, elapsedSeconds, type ExamDraft, type ExamKind } from '@/store/exam';
import { vault } from '@/services/vault';
import { practiceService } from '@/services/question-service';
import { examService } from '@/services/exam-service';
import type { SelectedOption } from '@/types/mock-tests';
export function useExam(kind: ExamKind, id: string) {
  const {user}=useAuth();const cache=useQueryClient();const journal=useRef<ExamJournal|undefined>(undefined);
  const clock=useRef({base:0,resumedAt:Date.now(),running:true});const questionTime=useRef(Date.now());
  const [draft,setDraft]=useState<ExamDraft>();const [error,setError]=useState<unknown>();const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true); const [reload,setReload]=useState(0);
  const publish=()=>{if(journal.current)setDraft({...journal.current.draft,answers:{...journal.current.draft.answers},pending:{...journal.current.draft.pending},feedback:{...journal.current.draft.feedback}});};
  const checkpoint=()=>{const j=journal.current;if(!j)return; j.draft.elapsed=clock.current.running?elapsedSeconds(clock.current.base,clock.current.resumedAt,Date.now(),j.draft.duration):clock.current.base;publish();};
  useEffect(()=>{
    let cancelled=false;
    async function load() {
      setLoading(true);setError(undefined);
      try {
        const saved=await vault.read<ExamDraft>('active-exam');
        let next=saved?.id===id&&saved.kind===kind&&saved.userId===user?.id?saved:null;
        if(saved&&saved.userId===user?.id&&!next)throw new Error('Finish or leave your current exam before opening another.');
        if(!next) {
          if(kind==='practice') {
            const {session}=await practiceService.get(id);
            if(session.status==='completed'){router.replace({pathname:'/result',params:{kind,id}});return;}
            next={userId:user!.id,kind,id,title:`${session.subject} practice`,duration:session.duration_seconds,elapsed:session.time_spent_seconds,index:0,feedbackMode:session.feedback_mode,questions:session.questions.map((q,i)=>({key:q.question_id||q.id,uid:q.question_uid,number:i+1,question:q.question,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,subject:q.subject,topic:q.topic})),answers:Object.fromEntries(Object.entries(session.user_answers).map(([key,a])=>[key,{option:a.selected_answer,marked:!!a.marked_for_review,seconds:a.time_taken_seconds||0,revision:0}])),pending:{},feedback:{},submitIntent:false,updatedAt:Date.now()};
            // Feedback already released by the server survives a fresh-device resume.
            if(session.feedback_mode==='instant')next.feedback=Object.fromEntries(Object.entries(session.user_answers)
              .filter(([,answer])=>answer.correct_answer&&typeof answer.is_correct==='boolean')
              .map(([key,answer])=>[key,{correct_answer:answer.correct_answer!,explanation:answer.explanation??null,is_correct:answer.is_correct!}]));
          } else {
            const {attempt}=await examService.get(id);
            if(attempt.status==='submitted'){router.replace({pathname:'/result',params:{kind,id}});return;}
            const [{test},questions]=await Promise.all([examService.metadata(attempt.mock_test_id),examService.questions(attempt.mock_test_id)]);
            next={userId:user!.id,kind,id,testId:attempt.mock_test_id,title:test.title,duration:attempt.duration_seconds,elapsed:attempt.time_spent_seconds,index:0,feedbackMode:'end',questions:questions.map(q=>({key:q.question_uid,uid:q.question_uid,number:q.question_number,question:q.question,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,subject:q.subject,topic:q.topic,section:q.section_name})),answers:Object.fromEntries(Object.entries(attempt.existing_answers).map(([key,a])=>[key,{option:a.selected_option,marked:a.marked_for_review,seconds:0,revision:0}])),pending:{},feedback:{},submitIntent:false,updatedAt:Date.now()};
          }
        }
        if(cancelled)return;
        if(!next.questions.length)throw new Error('No questions were returned for this session.');
        clock.current={base:next.elapsed,resumedAt:Date.now(),running:true};questionTime.current=Date.now();
        journal.current=new ExamJournal(next,{
          persist:d=>vault.write('active-exam',d),
          save:(q,a)=>kind==='practice'?practiceService.answer(id,{questionId:q.key,selectedAnswer:a.option,markedForReview:a.marked,timeTakenSeconds:a.seconds}):examService.answer(id,{questionId:q.key,questionNumber:q.number,selectedOption:a.option,markedForReview:a.marked,timeTakenSeconds:a.seconds}).then(()=>undefined),
          state:async()=>kind==='practice'?(await practiceService.get(id)).session.status:(await examService.get(id)).attempt.status,
          submit:async elapsed=>{if(kind==='practice')await practiceService.submit(id,elapsed);else await examService.submit(id,elapsed);},
        });
        await journal.current.persist();
        if(kind==='practice') await vault.remove('created-practice');
        publish();
      }catch(e){if(!cancelled)setError(e);}finally{if(!cancelled)setLoading(false);}
    }
    void load();
    return()=>{cancelled=true;};
  },[kind,id,user,reload]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      checkpoint();
      const j=journal.current;if(!j)return;
      if(j.draft.elapsed%10===0)void j.persist().catch(setError);
      if(j.draft.duration>0&&j.draft.elapsed>=j.draft.duration&&!j.draft.submitIntent)void submit();
    },1000);
    const subscription=AppState.addEventListener('change',state=>{
      const j=journal.current;if(!j)return;
      checkpoint();
      if(state!=='active'){
        clock.current={base:j.draft.elapsed,resumedAt:Date.now(),running:kind==='practice'};
        void j.persist().catch(setError);
        if(kind==='mock')void examService.pause(id,j.draft.elapsed).catch(setError);
      }else{clock.current={base:clock.current.running?elapsedSeconds(clock.current.base,clock.current.resumedAt,Date.now(),j.draft.duration):clock.current.base,resumedAt:Date.now(),running:true};}
    });
    return()=>{clearInterval(timer);subscription.remove();};
  });
  async function select(option:SelectedOption,marked?:boolean) {
    const j=journal.current;if(!j)return;setError(undefined);
    const q=j.draft.questions[j.draft.index];const previous=j.draft.answers[q.key];
    try{
      const seconds=(previous?.seconds||0)+Math.max(0,Math.floor((Date.now()-questionTime.current)/1000));questionTime.current=Date.now();
      await j.select(q.key,option,marked??previous?.marked??false,seconds);publish();
      if(j.draft.feedbackMode==='end'){await j.flush();publish();}
    }catch(e){setError(e);publish();}
  }
  async function sync() {setBusy(true);setError(undefined);try{await journal.current?.flush();publish();}catch(e){setError(e);}finally{setBusy(false);}}
  async function submit() {
    const j=journal.current;if(!j||busy)return;checkpoint();setBusy(true);setError(undefined);
    try{await j.submit();await vault.remove('active-exam');await cache.invalidateQueries();router.replace({pathname:'/result',params:{kind,id}});}
    catch(e){setError(e);publish();}finally{setBusy(false);}
  }
  async function move(index:number) {
    const j=journal.current;if(!j)return; j.draft.index=index;questionTime.current=Date.now();publish();
    try{checkpoint();await j.persist();}catch(e){setError(e);}
  }
  async function leave(abandon=false) {
    const j=journal.current;if(!j)return;setBusy(true);setError(undefined);checkpoint();
    try{
      await j.persist();
      if(abandon){if(kind==='practice')await practiceService.abandon(id);else await examService.abandon(id);await vault.remove('active-exam');}
      else if(kind==='mock'){await j.flush();await examService.pause(id,j.draft.elapsed);}
      router.replace('/');
    }catch(e){setError(e);}finally{setBusy(false);}
  }
  return {draft,error,busy,loading,select,sync,submit,move,leave,retry:()=>setReload(x=>x+1)};
}
