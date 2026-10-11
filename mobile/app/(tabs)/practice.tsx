import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Button, Input, ErrorState, Badge, SectionHeading, s } from '@/components/ui';
import { TopicPicker } from '@/components/topic-picker';
import { PracticeMediumTabs, PracticeSubjects, PracticeDataStatus } from '@/components/practice-selectors';
import { PracticeChoices } from '@/components/practice-choices';
import { usePracticeFilters } from '@/hooks/use-practice-filters';
import { PracticeResume } from '@/components/practice-resume';
import { practiceService } from '@/services/question-service';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
import { colors } from '@/utils/theme';
import { websitePracticeSubject } from '@/utils/practice-subjects';
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
  const requestedSubject=websitePracticeSubject(params.subject);
  const requestedTopic=(!params.subject||requestedSubject)?params.topic:undefined;
  const [filter,setFilter]=useState<PracticeFilterState>({medium:user?.educationMedium||'english',subject:requestedSubject||(user?.educationMedium==='telugu'?'Telugu':'English'),class_levels:[],topics:requestedTopic?[requestedTopic]:[],subtopics:[],difficulty:[],question_count:25,mode:'balanced',feedback_mode:'instant',has_timer:false,duration_minutes:30});
  const [customTopics,setCustomTopics]=useState(!!requestedTopic); const [advanced,setAdvanced]=useState(false);
  const update=(patch:Partial<PracticeFilterState>)=>setFilter(x=>({...x,...patch}));
  const toggle=(field:'class_levels'|'topics'|'subtopics'|'difficulty',value:string)=>setFilter(x=>({...x,[field]:x[field].includes(value)?x[field].filter(a=>a!==value):[...x[field],value],...(field==='topics'?{subtopics:[]}:field==='class_levels'?{topics:[],subtopics:[]}: {})}));
  const quota=useQuery({queryKey:['quota'],queryFn:practiceService.quota});
  const premium=!!quota.data?.isPremium;
  const effectiveFilter={...filter,topics:premium&&customTopics?filter.topics:[],subtopics:premium&&customTopics?filter.subtopics:[]};
  const options=usePracticeFilters(effectiveFilter,!customTopics||!!quota.data);
  const weak=useQuery({queryKey:['weak'],queryFn:practiceService.weak,staleTime:120000});
  const recommendations=(weak.data?.recommendations??[]).flatMap(recommendation=>{
    const subject=websitePracticeSubject(recommendation.subject);
    return subject?[{...recommendation,subject,sourceSubject:recommendation.subject}]:[];
  });
  const create=useMutation({mutationFn:()=>launchPractice(user!.id,()=>practiceService.create(effectiveFilter)),onSuccess:data=>router.push({pathname:'/exam',params:{kind:'practice',id:data.session.id}})});
  const data=options.data?.data; const maxQuestions=quota.data?.maxQuestions??25;
  const invalidCount=filter.question_count<5||filter.question_count>maxQuestions||filter.question_count>(data?.total_matching_questions??0);
  const exhausted=!!quota.data&&!quota.data.canPractice;
  const footer=<Button icon={exhausted?'lock-closed-outline':'play-outline'} label={options.checking?'Checking questions…':data?.total_matching_questions===0?'No Questions Available Currently':`Start Practice (${filter.question_count} Qs)`} busy={create.isPending} disabled={!quota.data||!options.ready||invalidCount||(filter.has_timer&&filter.duration_minutes<1)} onPress={()=>exhausted?router.push('/subscription'):create.mutate()}/>;
  return <Screen title="DSC Practice Zone" pageHeader={null} footer={footer} footerSafeArea={false}>
    <Card>
      <View style={[s.inline,{alignItems:'flex-start'}]}><View style={s.iconBox}><Ionicons name="school-outline" size={21} color={colors.primary}/></View><View style={{flex:1,minWidth:0,gap:5}}><View style={s.row}><Heading>DSC Practice Zone</Heading>{premium?<Badge label="PRO" color={colors.gold}/>:null}</View><Text style={{fontSize:12,lineHeight:19,color:colors.muted}}>AP DSC / SGT · Smart Practice Engine</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Practice history" onPress={()=>router.push('/history')} style={[s.iconBox,{backgroundColor:colors.card,borderWidth:1,borderColor:colors.border}]}><Ionicons name="time-outline" size={19} color={colors.primary}/></Pressable></View>
      {quota.data ? <View style={{gap:7,padding:12,borderRadius:16,backgroundColor:exhausted?colors.soft:colors.primarySoft}}><Body>{premium?'Unlimited practice with DSC Pro':`${quota.data.completedSessions} of ${quota.data.allowedSessions} practice sessions used · Maximum ${maxQuestions} questions`}</Body>{exhausted&&quota.data.reason?<Body>{quota.data.reason}</Body>:null}{!premium?<Button secondary label={exhausted?'View Pro plans':'Unlock unlimited with Pro'} onPress={()=>router.push('/subscription')}/>:null}</View> : null}
      <PracticeMediumTabs value={filter.medium} onChange={medium=>{if(medium===filter.medium)return;update({medium,subject:medium==='telugu'?'Telugu':'English',topics:[],subtopics:[],class_levels:[],difficulty:[]});setCustomTopics(false);}}/>
    </Card>
    <PracticeResume userId={user?.id}/>
    {quota.error ? <ErrorState error={quota.error} retry={()=>void quota.refetch()}/> : null}
    <Card><SectionHeading step={1} title="Choose Subject"/>
      <PracticeSubjects selected={filter.subject} onSelect={subject=>{if(subject===filter.subject)return;update({subject,topics:[],subtopics:[],class_levels:[],difficulty:[]});setCustomTopics(false);}}/>
      {options.error?<View style={{gap:8}}><Body color={colors.red}>{options.error instanceof Error?options.error.message:'Could not load question availability.'}</Body><Button secondary label="Retry question loading" onPress={()=>void options.refetch()}/></View>:<PracticeDataStatus checking={options.checking} count={data?.total_matching_questions}/>}
      {options.ready&&data?.total_matching_questions===0?<Body color={colors.red}>No questions match this selection. Choose another subject, medium or set of filters.</Body>:null}
    </Card>
    <Card><SectionHeading step={2} title="Choose Topics" detail="Practise the full syllabus or focus on specific chapters."/>
      <PracticeChoices compact columns={2} items={[{value:'all',label:'All topics'},{value:'custom',label:premium?'Select topics':'Select topics · PRO'}]} selected={premium&&customTopics?'custom':'all'} onSelect={value=>{if(value==='custom'&&!premium){router.push('/subscription');return;}setCustomTopics(value==='custom');if(value==='all')update({topics:[],subtopics:[]});}}/>
      {premium&&customTopics ? data?<TopicPicker key={`${filter.medium}:${filter.subject}`} topics={data.available_topics} selected={filter.topics} onToggle={topic=>toggle('topics',topic)} scope={`${filter.medium}:${filter.subject}:${filter.class_levels.join(',')}`}/>:<Body>Topics will appear when this subject is ready.</Body> : <Body>{premium?'All available topics are included.':'All topics are included in free practice. Topic-wise selection is available with DSC Pro.'}</Body>}
    </Card>
    <Card><SectionHeading step={3} title="Question Count"/>
      <PracticeChoices compact items={[5,10,20,25,50,100].filter(count=>count<=maxQuestions).map(count=>({value:String(count),label:String(count),detail:'Questions'}))} selected={String(filter.question_count)} onSelect={value=>update({question_count:Number(value)})}/>
      <Input label={`Custom question count (5–${maxQuestions})`} numeric value={String(filter.question_count)} onChangeText={text=>update({question_count:Number(text)||0})}/>
      {options.ready&&data&&filter.question_count>data.total_matching_questions ? <Body color={colors.red}>Only {data.total_matching_questions} questions match these filters. Choose a smaller session or broaden your selection.</Body> : null}
    </Card>
    <Card><SectionHeading step={4} title="Practice Mode & Feedback"/>
      <PracticeChoices items={modes.slice(0,3).map(mode=>({value:mode.value,label:mode.label,detail:mode.description,icon:mode.icon}))} selected={filter.mode} onSelect={mode=>update({mode})}/>
      <View style={[s.inline,{padding:12,borderRadius:16,borderWidth:1,borderColor:colors.border}]}><View style={{flex:1,minWidth:0,gap:5}}><Heading>Instant Answer & Explanation</Heading><Body>{filter.feedback_mode==='instant'?'Show the correct answer and detailed explanation after each question.':'Complete your practice first, then review answers and explanations.'}</Body></View><Switch accessibilityLabel="Instant Answer and Explanation" trackColor={{true:colors.primary}} value={filter.feedback_mode==='instant'} onValueChange={instant=>update({feedback_mode:instant?'instant':'end'})}/></View>
    </Card>
    <Button secondary icon={advanced?'chevron-up-outline':'options-outline'} label={advanced?'Hide advanced filters':'Advanced filters · class, difficulty & timer'} onPress={()=>setAdvanced(value=>!value)}/>
    {advanced&&data ? <Card><Heading>Class / chapter level</Heading><PracticeChoices compact items={data.available_classes.map(value=>({value,label:value}))} selected={filter.class_levels} onSelect={value=>toggle('class_levels',value)}/>
      {premium&&customTopics ? <><Heading>Subtopics</Heading><PracticeChoices items={[...new Set(data.available_topics.filter(topic=>!filter.topics.length||filter.topics.includes(topic.name)).flatMap(topic=>topic.subtopics))].map(value=>({value,label:value}))} selected={filter.subtopics} onSelect={value=>toggle('subtopics',value)}/></> : null}
      <Heading>Difficulty</Heading><PracticeChoices compact items={data.available_difficulties.map(level=>({value:level.name,label:level.name,detail:`${level.count} questions`}))} selected={filter.difficulty} onSelect={value=>toggle('difficulty',value)}/>
      <Heading>More practice modes</Heading><PracticeChoices items={modes.map(mode=>({value:mode.value,label:mode.label}))} selected={filter.mode} onSelect={mode=>update({mode})}/>
      <View style={s.between}><Heading>Use a timer</Heading><Switch accessibilityLabel="Use a practice timer" trackColor={{true:colors.primary}} value={filter.has_timer} onValueChange={has_timer=>update({has_timer})}/></View>
      {filter.has_timer ? <Input label="Duration in minutes" numeric value={String(filter.duration_minutes)} onChangeText={text=>update({duration_minutes:Number(text)||0})}/> : null}
      <Body>Empty selections include all available content.</Body>
    </Card> : null}
    {create.error ? <ErrorState error={create.error}/> : null}
    {weak.error ? <ErrorState error={weak.error} retry={()=>void weak.refetch()}/> : null}
    {recommendations.length ? <Card gold><SectionHeading title="Turn weak topics into strengths"/><PracticeChoices items={recommendations.slice(0,8).map((recommendation,index)=>({value:String(index),label:recommendation.topic,detail:`${recommendation.subject} · ${recommendation.accuracy_pct}% accuracy`,icon:'locate-outline'}))} selected="" onSelect={value=>{const recommendation=recommendations[Number(value)];if(!recommendation)return;update({subject:recommendation.subject,topics:premium?[recommendation.topic]:[],subtopics:[],class_levels:[],difficulty:[],mode:'weak_areas'});setCustomTopics(premium);}}/></Card> : null}
  </Screen>;
}
