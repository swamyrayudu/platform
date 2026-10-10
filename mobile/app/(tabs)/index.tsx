import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Screen, Card, Heading, Body, Button, Stats, Loading, ErrorState, Bar } from '@/components/ui';
import { analyticsService } from '@/services/analytics-service';
import { useAuth } from '@/store/auth';
import { vault } from '@/services/vault';
import type { ExamDraft } from '@/store/exam';
import { practiceService } from '@/services/question-service';
export default function Home() {
  const {user}=useAuth(); const data=useQuery({queryKey:['overview'],queryFn:analyticsService.overview}); const [draft,setDraft]=useState<Pick<ExamDraft,'id'|'kind'>|null>(null);
  useFocusEffect(useCallback(()=>{
    let alive=true;
    void (async()=>{
      const active=await vault.read<ExamDraft>('active-exam');
      if(active?.userId===user?.id){if(alive)setDraft(active);return;}
      const created=await vault.read<{id:string;userId:string}>('created-practice');
      if(created?.userId===user?.id){const result=await practiceService.get(created!.id);if(alive)setDraft(result.session.status==='in_progress'?{id:created!.id,kind:'practice'}:null);}
      else if(alive)setDraft(null);
    })().catch(()=>{if(alive)setDraft(null);});
    return()=>{alive=false;};
  },[user?.id]));
  return <Screen title={`Hello, ${user?.name?.split(' ')[0] || 'learner'}`} subtitle="A little progress every day goes a long way." refreshing={data.isRefetching} onRefresh={()=>void data.refetch()}>
    <Card gold><Heading>AP DSC / SGT</Heading><Body>Andhra Pradesh · School Grade Teacher</Body><Button label="Practice a subject" onPress={()=>router.push('/practice')}/><Button secondary label="Explore mock papers" onPress={()=>router.push('/mocks')}/></Card>
    {draft&&<Card><Heading>Continue your {draft.kind==='mock'?'mock exam':'practice'}</Heading><Body>Your answers are saved on this device.</Body><Button label="Resume session" onPress={()=>router.push({pathname:'/exam',params:{kind:draft.kind,id:draft.id}})}/></Card>}
    {data.isLoading?<Loading/>:data.error?<ErrorState error={data.error} retry={()=>void data.refetch()}/>:data.data&&<>
      <Stats items={[{label:'Questions solved',value:data.data.summary.questions_solved},{label:'Accuracy',value:`${data.data.summary.avg_accuracy_pct}%`},{label:'Study streak',value:`${data.data.summary.study_streak_days} days`},{label:'Modules complete',value:`${data.data.summary.modules_completed}/${data.data.summary.modules_total}`}]}/>
      <Card><Heading>Your module journey</Heading><Bar value={100*data.data.summary.modules_completed/Math.max(1,data.data.summary.modules_total)}/><Body>{data.data.summary.modules_in_progress} modules in progress</Body></Card>
      <Card><Heading>Official exam structure</Heading><Body>{data.data.syllabus.total_questions} questions · {data.data.syllabus.total_marks} marks · {data.data.syllabus.duration_minutes} minutes</Body>{data.data.syllabus.sections.map(section=><Body key={section.id}>{section.name} · {section.questions} questions · {section.marks} marks</Body>)}</Card>
    </>}
    <Button secondary label="Attempt history" onPress={()=>router.push('/history')}/><Button secondary label="Your subscription" onPress={()=>router.push('/subscription')}/>
  </Screen>;
}
