import { useState } from 'react';
import { Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Button, Chips, Input, ErrorState, Loading } from '@/components/ui';
import { practiceService } from '@/services/question-service';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
import type { PracticeFilterState, PracticeMode } from '@/types/practice';
const modes: {value:PracticeMode;label:string}[]=[{value:'balanced',label:'Balanced'},{value:'random',label:'Random'},{value:'weak_areas',label:'Weak areas'},{value:'previously_incorrect',label:'Previously incorrect'},{value:'new_questions',label:'New questions'}];
export default function Practice() {
  const {user}=useAuth();const params=useLocalSearchParams<{subject?:string;topic?:string}>();
  const [filter,setFilter]=useState<PracticeFilterState>({medium:user?.educationMedium||'english',subject:params.subject||'English',class_levels:[],topics:params.topic?[params.topic]:[],subtopics:[],difficulty:[],question_count:25,mode:'balanced',feedback_mode:'instant',has_timer:false,duration_minutes:30});
  const update=(patch:Partial<PracticeFilterState>)=>setFilter(x=>({...x,...patch}));
  const toggle=(field:'class_levels'|'topics'|'subtopics'|'difficulty',v:string)=>setFilter(x=>({...x,[field]:x[field].includes(v)?x[field].filter(a=>a!==v):[...x[field],v]}));
  const quota=useQuery({queryKey:['quota'],queryFn:practiceService.quota});
  const options=useQuery({queryKey:['filters',filter.medium,filter.subject,filter.class_levels,filter.topics,filter.subtopics,filter.difficulty],queryFn:()=>practiceService.filters(filter),staleTime:120000});
  const weak=useQuery({queryKey:['weak'],queryFn:practiceService.weak});
  const create=useMutation({mutationFn:()=>launchPractice(user!.id,()=>practiceService.create(filter)),onSuccess:data=>router.push({pathname:'/exam',params:{kind:'practice',id:data.session.id}})});
  const data=options.data?.data;
  return <Screen title="Smart practice" subtitle="Choose a subject. Let each question sharpen your preparation.">
    {quota.error&&<ErrorState error={quota.error} retry={()=>void quota.refetch()}/>} {quota.data&&!quota.data.canPractice&&<Card gold><Heading>Practice access</Heading><Body>{quota.data.reason}</Body><Button label="View Pro plans" onPress={()=>router.push('/subscription')}/></Card>}
    <Card><Heading>Study medium</Heading><Chips items={[{value:'english',label:'English'},{value:'telugu',label:'తెలుగు'}]} selected={filter.medium} onSelect={medium=>update({medium,topics:[],subtopics:[],class_levels:[],difficulty:[]})}/>
      <Heading>Subject</Heading>{options.isLoading&&<Loading/>}{options.error&&<ErrorState error={options.error} retry={()=>void options.refetch()}/>}<Chips items={(data?.available_subjects||[]).map(x=>({value:x.name,label:`${x.name} (${x.question_count})`}))} selected={filter.subject} onSelect={subject=>update({subject,topics:[],subtopics:[],class_levels:[],difficulty:[]})}/>
      <Body>{data?.total_matching_questions??0} matching questions</Body>
    </Card>
    {data&&<Card><Heading>Class / chapter level</Heading><Body>Leave selections empty to include all available content.</Body><Chips items={data.available_classes.map(value=>({value,label:value}))} selected={filter.class_levels} onSelect={value=>{toggle('class_levels',value);update({topics:[],subtopics:[]});}}/>
      <Heading>Topics</Heading>{quota.data?.isPremium?<><Chips items={data.available_topics.map(x=>({value:x.name,label:`${x.name} (${x.count})`}))} selected={filter.topics} onSelect={value=>{toggle('topics',value);update({subtopics:[]});}}/>
      <Heading>Subtopics</Heading><Chips items={[...new Set(data.available_topics.filter(t=>!filter.topics.length||filter.topics.includes(t.name)).flatMap(t=>t.subtopics))].map(value=>({value,label:value}))} selected={filter.subtopics} onSelect={value=>toggle('subtopics',value)}/></>:<Button secondary label="Unlock topic practice with Pro" onPress={()=>router.push('/subscription')}/>}
      <Heading>Difficulty</Heading><Chips items={data.available_difficulties.map(x=>({value:x.name,label:`${x.name} (${x.count})`}))} selected={filter.difficulty} onSelect={value=>toggle('difficulty',value)}/>
    </Card>}
    <Card><Heading>Practice mode</Heading><Chips items={modes} selected={filter.mode} onSelect={mode=>update({mode})}/><Heading>Answer feedback</Heading><Chips items={[{value:'instant',label:'After each answer'},{value:'end',label:'After submission'}]} selected={filter.feedback_mode} onSelect={feedback_mode=>update({feedback_mode})}/>
      <Input label={`Number of questions (5–${quota.data?.maxQuestions??25})`} numeric value={String(filter.question_count)} onChangeText={text=>update({question_count:Number(text)||0})}/>
      <Heading>Use a timer</Heading><Switch accessibilityLabel="Use a practice timer" value={filter.has_timer} onValueChange={has_timer=>update({has_timer})}/>{filter.has_timer&&<Input label="Duration in minutes" numeric value={String(filter.duration_minutes)} onChangeText={text=>update({duration_minutes:Number(text)||0})}/>}
    </Card>
    {create.error&&<ErrorState error={create.error}/>}<Button label="Start practice" busy={create.isPending} disabled={!quota.data?.canPractice||!data?.total_matching_questions||filter.question_count<5||filter.question_count>(quota.data?.maxQuestions??25)||(filter.has_timer&&filter.duration_minutes<1)} onPress={()=>create.mutate()}/>
    {(weak.data?.recommendations.length??0)>0&&<Card gold><Heading>Focus on your weak topics</Heading>{weak.data!.recommendations.slice(0,8).map(r=><Button key={r.subject+r.topic} secondary label={`${r.subject} · ${r.topic} · ${r.accuracy_pct}%`} onPress={()=>update({subject:r.subject,topics:quota.data?.isPremium?[r.topic]:[],subtopics:[],mode:'weak_areas'})}/>)}</Card>}
    <Button secondary label="Practice history" onPress={()=>router.push('/history')}/>
  </Screen>;
}
