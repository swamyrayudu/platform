import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Button, Chips, Input, ErrorState, Loading, Badge, SectionHeading, ChoiceRow, s } from '@/components/ui';
import { TopicPicker } from '@/components/topic-picker';
import { practiceService } from '@/services/question-service';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
import { colors, subjectStyle } from '@/utils/theme';
import type { PracticeFilterState, PracticeMode } from '@/types/practice';
const modes: {value:PracticeMode;label:string;description:string;icon:'flash-outline'|'shuffle-outline'|'locate-outline'|'refresh-outline'|'sparkles-outline'}[]=[
  {value:'balanced',label:'Smart balanced',description:'An even mix of topics and difficulty. Best for daily practice.',icon:'flash-outline'},
  {value:'weak_areas',label:'Weak areas',description:'Focus on the topics that need a little more practice.',icon:'locate-outline'},
  {value:'new_questions',label:'New questions',description:'Discover questions you have not attempted yet.',icon:'sparkles-outline'},
  {value:'random',label:'Random',description:'A fresh mix from your selected syllabus.',icon:'shuffle-outline'},
  {value:'previously_incorrect',label:'Previously incorrect',description:'Learn from questions you missed before.',icon:'refresh-outline'},
];
export default function Practice() {
  const params=useLocalSearchParams<{subject?:string;topic?:string}>();
  return <PracticeBuilder key={JSON.stringify([params.subject,params.topic])} params={params}/>;
}
function PracticeBuilder({params}:{params:{subject?:string;topic?:string}}) {
  const {user}=useAuth();
  const [filter,setFilter]=useState<PracticeFilterState>({medium:user?.educationMedium||'english',subject:params.subject||(user?.educationMedium==='telugu'?'Telugu':'English'),class_levels:[],topics:params.topic?[params.topic]:[],subtopics:[],difficulty:[],question_count:25,mode:'balanced',feedback_mode:'instant',has_timer:false,duration_minutes:30});
  const [customTopics,setCustomTopics]=useState(!!params.topic); const [advanced,setAdvanced]=useState(false);
  const update=(patch:Partial<PracticeFilterState>)=>setFilter(x=>({...x,...patch}));
  const toggle=(field:'class_levels'|'topics'|'subtopics'|'difficulty',value:string)=>setFilter(x=>({...x,[field]:x[field].includes(value)?x[field].filter(a=>a!==value):[...x[field],value],...(field==='topics'?{subtopics:[]}:field==='class_levels'?{topics:[],subtopics:[]}: {})}));
  const quota=useQuery({queryKey:['quota'],queryFn:practiceService.quota});
  const premium=!!quota.data?.isPremium;
  const effectiveFilter={...filter,topics:premium&&customTopics?filter.topics:[],subtopics:premium&&customTopics?filter.subtopics:[]};
  const options=useQuery({queryKey:['filters',filter.medium,filter.subject,filter.class_levels,effectiveFilter.topics,effectiveFilter.subtopics,filter.difficulty],queryFn:()=>practiceService.filters(effectiveFilter),staleTime:120000});
  const weak=useQuery({queryKey:['weak'],queryFn:practiceService.weak});
  const create=useMutation({mutationFn:()=>launchPractice(user!.id,()=>practiceService.create(effectiveFilter)),onSuccess:data=>router.push({pathname:'/exam',params:{kind:'practice',id:data.session.id}})});
  const data=options.data?.data; const maxQuestions=quota.data?.maxQuestions??25;
  const invalidCount=filter.question_count<5||filter.question_count>maxQuestions||filter.question_count>(data?.total_matching_questions??0);
  const footer=<><View style={s.between}><Heading>{filter.question_count} questions</Heading><Badge label={filter.has_timer?`${filter.duration_minutes} min`:'At your pace'}/></View><Button icon="play-outline" label="Start practice" busy={create.isPending} disabled={!quota.data?.canPractice||options.isFetching||!!options.error||invalidCount||(filter.has_timer&&filter.duration_minutes<1)} onPress={()=>create.mutate()}/></>;
  return <Screen title="Smart practice" subtitle="Your subject. Your pace. A little stronger with every question." footer={footer} footerSafeArea={false}>
    <Card gold><Badge label={premium?'DSC PRO':'DAILY PRACTICE'} color={colors.gold}/><Heading>Build your next session</Heading><Body>Choose a subject, select your topics and learn with explanations after each answer.</Body>{quota.data ? <Body>{quota.data.completedSessions} sessions completed · {quota.data.allowedSessions==='unlimited'?'Unlimited access':`${quota.data.allowedSessions} sessions available to your plan`}</Body> : null}</Card>
    {quota.error ? <ErrorState error={quota.error} retry={()=>void quota.refetch()}/> : null}
    {quota.data&&!quota.data.canPractice ? <Card><Heading>Practice access</Heading><Body>{quota.data.reason}</Body><Button label="View Pro plans" onPress={()=>router.push('/subscription')}/></Card> : null}
    <Chips items={[{value:'english',label:'English medium'},{value:'telugu',label:'తెలుగు మాధ్యమం'}]} selected={filter.medium} onSelect={medium=>{update({medium,subject:medium==='telugu'?'Telugu':'English',topics:[],subtopics:[],class_levels:[],difficulty:[]});setCustomTopics(false);}}/>
    <Card><SectionHeading step={1} title="Choose a subject" detail="Follow the same syllabus as the website."/>
      {options.isPending ? <Loading/> : null}{options.error ? <ErrorState error={options.error} retry={()=>void options.refetch()}/> : null}
      {(data?.available_subjects??[]).map(subject=>{const style=subjectStyle(subject.name);return <ChoiceRow key={subject.id} title={subject.name} detail={`${subject.teluguName!==subject.name?subject.teluguName+' · ':''}${style.tag}`} icon={style.icon} color={style.color} selected={filter.subject===subject.name} onPress={()=>{update({subject:subject.name,topics:[],subtopics:[],class_levels:[],difficulty:[]});setCustomTopics(false);}}/>;})}
      <Badge label={options.isFetching?'Updating questions…':`${data?.total_matching_questions??0} matching questions`}/>
    </Card>
    <Card><SectionHeading step={2} title="Choose topics & concepts" detail="Practise the full syllabus or focus on specific chapters."/>
      <Chips items={[{value:'all',label:'All topics'},{value:'custom',label:premium?'Select topics':'Select topics · PRO'}]} selected={premium&&customTopics?'custom':'all'} onSelect={value=>{if(value==='custom'&&!premium){router.push('/subscription');return;}setCustomTopics(value==='custom');if(value==='all')update({topics:[],subtopics:[]});}}/>
      {premium&&customTopics&&data ? <TopicPicker key={`${filter.medium}:${filter.subject}`} topics={data.available_topics} selected={filter.topics} onToggle={topic=>toggle('topics',topic)} scope={`${filter.medium}:${filter.subject}:${filter.class_levels.join(',')}`}/> : <Body>{premium?'All available topics are included.':'All topics are included in free practice. Topic-wise selection is available with DSC Pro.'}</Body>}
    </Card>
    <Card><SectionHeading step={3} title="How much would you like to practise?"/>
      <Chips items={[5,10,20,25,50,100].filter(count=>count<=maxQuestions).map(count=>({value:String(count),label:`${count} questions`}))} selected={String(filter.question_count)} onSelect={value=>update({question_count:Number(value)})}/>
      <Input label={`Custom question count (5–${maxQuestions})`} numeric value={String(filter.question_count)} onChangeText={text=>update({question_count:Number(text)||0})}/>
      {data&&filter.question_count>data.total_matching_questions ? <Body color={colors.red}>Only {data.total_matching_questions} questions match these filters. Choose a smaller session or broaden your selection.</Body> : null}
    </Card>
    <Card><SectionHeading step={4} title="Practice mode & feedback"/>
      {modes.slice(0,3).map(mode=><ChoiceRow key={mode.value} title={mode.label} detail={mode.description} icon={mode.icon} selected={filter.mode===mode.value} onPress={()=>update({mode:mode.value})}/>)}
      <Heading>When should answers appear?</Heading><Chips items={[{value:'instant',label:'After each answer'},{value:'end',label:'After submission'}]} selected={filter.feedback_mode} onSelect={feedback_mode=>update({feedback_mode})}/>
      <Body>{filter.feedback_mode==='instant'?'Check each answer and read its explanation as you go.':'Complete your session first, then review answers and explanations.'}</Body>
    </Card>
    <Button secondary icon={advanced?'chevron-up-outline':'options-outline'} label={advanced?'Hide advanced filters':'Advanced filters · class, difficulty & timer'} onPress={()=>setAdvanced(value=>!value)}/>
    {advanced&&data ? <Card><Heading>Class / chapter level</Heading><Chips items={data.available_classes.map(value=>({value,label:value}))} selected={filter.class_levels} onSelect={value=>toggle('class_levels',value)}/>
      {premium&&customTopics ? <><Heading>Subtopics</Heading><Chips items={[...new Set(data.available_topics.filter(topic=>!filter.topics.length||filter.topics.includes(topic.name)).flatMap(topic=>topic.subtopics))].map(value=>({value,label:value}))} selected={filter.subtopics} onSelect={value=>toggle('subtopics',value)}/></> : null}
      <Heading>Difficulty</Heading><Chips items={data.available_difficulties.map(level=>({value:level.name,label:`${level.name} (${level.count})`}))} selected={filter.difficulty} onSelect={value=>toggle('difficulty',value)}/>
      <Heading>More practice modes</Heading><Chips items={modes.map(mode=>({value:mode.value,label:mode.label}))} selected={filter.mode} onSelect={mode=>update({mode})}/>
      <View style={s.between}><Heading>Use a timer</Heading><Switch accessibilityLabel="Use a practice timer" trackColor={{true:colors.primary}} value={filter.has_timer} onValueChange={has_timer=>update({has_timer})}/></View>
      {filter.has_timer ? <Input label="Duration in minutes" numeric value={String(filter.duration_minutes)} onChangeText={text=>update({duration_minutes:Number(text)||0})}/> : null}
      <Body>Empty selections include all available content.</Body>
    </Card> : null}
    {create.error ? <ErrorState error={create.error}/> : null}
    {weak.error ? <ErrorState error={weak.error} retry={()=>void weak.refetch()}/> : null}
    {weak.data?.recommendations.length ? <Card gold><SectionHeading title="Turn weak topics into strengths"/>{weak.data.recommendations.slice(0,8).map(recommendation=><ChoiceRow key={`${recommendation.subject}:${recommendation.topic}`} title={recommendation.topic} detail={`${recommendation.subject} · ${recommendation.accuracy_pct}% accuracy`} icon="locate-outline" onPress={()=>{update({subject:recommendation.subject,topics:premium?[recommendation.topic]:[],subtopics:[],class_levels:[],difficulty:[],mode:'weak_areas'});setCustomTopics(premium);}}/>)}</Card> : null}
    <Button secondary icon="time-outline" label="Practice history" onPress={()=>router.push('/history')}/>
  </Screen>;
}
