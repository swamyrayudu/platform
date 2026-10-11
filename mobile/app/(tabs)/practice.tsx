import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Screen, Body, Button, Input, ErrorState, Badge } from '@/components/ui';
import { TopicPicker } from '@/components/topic-picker';
import { PracticeMediumTabs, PracticeSubjects, PracticeDataStatus } from '@/components/practice-selectors';
import { PracticeChoices } from '@/components/practice-choices';
import { usePracticeFilters } from '@/hooks/use-practice-filters';
import { practiceService } from '@/services/question-service';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
import { colors } from '@/utils/theme';
import { hasSubjectMethodology, websitePracticeSubject } from '@/utils/practice-subjects';
import type { PracticeFilterState, PracticeMode } from '@/types/practice';
const modes: {value:PracticeMode;label:string;description:string;icon:'flash-outline'|'shuffle-outline'|'locate-outline'|'refresh-outline'|'sparkles-outline'}[]=[
  {value:'balanced',label:'Balanced',description:'Mix topics and difficulty.',icon:'flash-outline'},
  {value:'weak_areas',label:'Weak areas',description:'Focus on weaker topics.',icon:'locate-outline'},
  {value:'new_questions',label:'New questions',description:'Questions you have not tried.',icon:'sparkles-outline'},
  {value:'random',label:'Random',description:'Mix questions from your selection.',icon:'shuffle-outline'},
  {value:'previously_incorrect',label:'Retry mistakes',description:'Retry questions you missed.',icon:'refresh-outline'},
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
  const [customCount,setCustomCount]=useState(false);
  const [suggestionsOpen,setSuggestionsOpen]=useState(false);
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
  const footer=<Button icon={exhausted?'lock-closed-outline':'play-outline'} label={options.checking?'Checking questions…':exhausted?'View Pro plans':data?.total_matching_questions===0?'No questions available':`Start practice · ${filter.question_count}`} busy={create.isPending} disabled={!quota.data||!options.ready||invalidCount||(filter.has_timer&&filter.duration_minutes<1)} onPress={()=>exhausted?router.push('/subscription'):create.mutate()}/>;
  return <Screen title="DSC Practice Zone" pageHeader={null} footer={footer} footerSafeArea={false}>
    <View style={styles.intro}>
      <View style={styles.headingRow}>
        <View style={styles.titleRow}><Text accessibilityRole="header" style={styles.title}>DSC Practice Zone</Text>{premium?<Badge label="PRO" color={colors.gold}/>:null}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="Practice history" onPress={()=>router.push('/history')} style={({pressed})=>[styles.history,pressed&&styles.pressed]}><Ionicons name="time-outline" size={21} color={colors.primary}/></Pressable>
      </View>
      {quota.data ? <View style={[styles.quota,exhausted&&styles.quotaExhausted]}>
        <Text style={styles.quotaText}>{premium?'Unlimited practice':`${quota.data.completedSessions}/${quota.data.allowedSessions} sessions used · Up to ${maxQuestions} questions`}</Text>
        {!premium ? <Pressable accessibilityRole="button" accessibilityLabel="View Pro plans" onPress={()=>router.push('/subscription')} style={({pressed})=>[styles.plans,pressed&&styles.pressed]}><Ionicons name="ribbon-outline" size={16} color={colors.primary}/><Text style={styles.linkText}>Pro plans</Text><Ionicons name="chevron-forward" size={14} color={colors.primary}/></Pressable> : null}
      </View> : null}
      {exhausted&&quota.data?.reason ? <Text style={styles.hint}>{quota.data.reason}</Text> : null}
      <PracticeMediumTabs value={filter.medium} onChange={medium=>{if(medium===filter.medium)return;update({medium,subject:medium==='telugu'?'Telugu':'English',topics:[],subtopics:[],class_levels:[],difficulty:[]});setCustomTopics(false);}}/>
    </View>
    {quota.error ? <ErrorState error={quota.error} retry={()=>void quota.refetch()}/> : null}
    <PracticeSection step={1} title="Subject">
      <PracticeSubjects medium={filter.medium} selected={filter.subject} onSelect={subject=>{if(subject===filter.subject)return;update({subject,topics:[],subtopics:[],class_levels:[],difficulty:[]});setCustomTopics(false);}}/>
      {options.error?<View style={{gap:8}}><Body color={colors.red}>{options.error instanceof Error?options.error.message:'Could not load question availability.'}</Body><Button secondary label="Retry question loading" onPress={()=>void options.refetch()}/></View>:<PracticeDataStatus checking={options.checking} count={data?.total_matching_questions}/>}
      {options.ready&&data?.total_matching_questions===0?<Body color={colors.red}>Try another subject, medium or filter.</Body>:null}
    </PracticeSection>
    <PracticeSection step={2} title="Topics">
      {hasSubjectMethodology(filter.subject)?<Text style={styles.methodologyHint}>{filter.medium==='telugu'?'మెథడాలజీ అంటే ఈ విషయాన్ని బోధించే పద్ధతులు.':'Methodology means teaching methods for this subject.'}</Text>:null}
      <PracticeChoices compact columns={2} items={[{value:'all',label:'All topics'},{value:'custom',label:premium?'Choose topics':'Choose topics · Pro',accent:premium?undefined:'gold'}]} selected={premium&&customTopics?'custom':'all'} onSelect={value=>{if(value==='custom'&&!premium){router.push('/subscription');return;}setCustomTopics(value==='custom');if(value==='all')update({topics:[],subtopics:[]});}}/>
      {premium&&customTopics ? data?<TopicPicker key={`${filter.medium}:${filter.subject}`} topics={data.available_topics} selected={filter.topics} onToggle={topic=>toggle('topics',topic)} scope={`${filter.medium}:${filter.subject}:${filter.class_levels.join(',')}`}/>:<Text style={styles.hint}>Loading topics…</Text> : null}
    </PracticeSection>
    <PracticeSection step={3} title="Questions">
      <PracticeChoices compact items={[5,10,20,25,50,100].filter(count=>count<=maxQuestions).map(count=>({value:String(count),label:String(count)}))} selected={String(filter.question_count)} onSelect={value=>{update({question_count:Number(value)});setCustomCount(false);}}/>
      <PracticeDisclosure title={`Custom count${customCount?'':` · ${filter.question_count}`}`} open={customCount} onPress={()=>setCustomCount(value=>!value)}/>
      {customCount ? <Input label={`Questions (5–${maxQuestions})`} numeric value={String(filter.question_count)} onChangeText={text=>update({question_count:Number(text)||0})}/> : null}
      {options.ready&&data&&filter.question_count>data.total_matching_questions ? <Body color={colors.red}>Only {data.total_matching_questions} available. Reduce the count or change filters.</Body> : null}
    </PracticeSection>
    <PracticeSection step={4} title="Practice mode">
      <PracticeChoices compact columns={2} items={modes.map(mode=>({value:mode.value,label:mode.label}))} selected={filter.mode} onSelect={mode=>update({mode})}/>
      <Text style={styles.hint}>{modes.find(mode=>mode.value===filter.mode)?.description}</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}><Text style={styles.label}>Instant answers</Text><Text style={styles.hint}>{filter.feedback_mode==='instant'?'Answers & explanations after each question.':'Review answers at the end.'}</Text></View>
        <Switch accessibilityLabel="Instant answers and explanations" trackColor={{true:colors.primary}} value={filter.feedback_mode==='instant'} onValueChange={instant=>update({feedback_mode:instant?'instant':'end'})}/>
      </View>
    </PracticeSection>
    <View style={styles.panel}>
      <PracticeDisclosure title="More options" detail="Class, difficulty & timer" icon="options-outline" open={advanced} onPress={()=>setAdvanced(value=>!value)}/>
      {advanced&&data ? <View style={styles.options}>
      <Text accessibilityRole="header" style={styles.label}>Class / chapter</Text><PracticeChoices compact items={data.available_classes.map(value=>({value,label:value}))} selected={filter.class_levels} onSelect={value=>toggle('class_levels',value)}/>
      {premium&&customTopics ? <><Text accessibilityRole="header" style={styles.label}>Subtopics</Text><PracticeChoices items={[...new Set(data.available_topics.filter(topic=>!filter.topics.length||filter.topics.includes(topic.name)).flatMap(topic=>topic.subtopics))].map(value=>({value,label:value}))} selected={filter.subtopics} onSelect={value=>toggle('subtopics',value)}/></> : null}
      <Text accessibilityRole="header" style={styles.label}>Difficulty</Text><PracticeChoices compact items={data.available_difficulties.map(level=>({value:level.name,label:level.name,detail:`${level.count} questions`}))} selected={filter.difficulty} onSelect={value=>toggle('difficulty',value)}/>
      <View style={styles.switchRow}><Text style={[styles.label,styles.flex]}>Timer</Text><Switch accessibilityLabel="Use a practice timer" trackColor={{true:colors.primary}} value={filter.has_timer} onValueChange={has_timer=>update({has_timer})}/></View>
      {filter.has_timer ? <Input label="Duration in minutes" numeric value={String(filter.duration_minutes)} onChangeText={text=>update({duration_minutes:Number(text)||0})}/> : null}
      <Text style={styles.hint}>Leave filters empty to include all.</Text>
      </View> : advanced ? <Text style={styles.hint}>{options.error?'Filters unavailable. Retry above.':'Loading filters…'}</Text> : null}
    </View>
    {create.error ? <ErrorState error={create.error}/> : null}
    {weak.error ? <ErrorState error={weak.error} retry={()=>void weak.refetch()}/> : null}
    {recommendations.length ? <View style={styles.panel}>
      <PracticeDisclosure title="Suggested topics" icon="locate-outline" open={suggestionsOpen} onPress={()=>setSuggestionsOpen(value=>!value)}/>
      {suggestionsOpen ? <PracticeChoices items={recommendations.slice(0,8).map((recommendation,index)=>({value:String(index),label:recommendation.topic,detail:`${recommendation.subject} · ${recommendation.accuracy_pct}%`,icon:'locate-outline'}))} selected="" onSelect={value=>{const recommendation=recommendations[Number(value)];if(!recommendation)return;update({subject:recommendation.subject,topics:premium?[recommendation.topic]:[],subtopics:[],class_levels:[],difficulty:[],mode:'weak_areas'});setCustomTopics(premium);}}/> : null}
    </View> : null}
  </Screen>;
}

function PracticeSection({title,step,children}:{title:string;step:number;children:ReactNode}) {
  return <View style={styles.panel}>
    <View style={styles.sectionHeading}><View style={styles.step}><Text style={styles.stepText}>{step}</Text></View><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text></View>
    {children}
  </View>;
}
function PracticeDisclosure({title,detail,icon,open,onPress}:{title:string;detail?:string;icon?:'options-outline'|'locate-outline';open:boolean;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={onPress} style={({pressed})=>[styles.disclosure,pressed&&styles.pressed]}>
    {icon ? <Ionicons name={icon} size={19} color={colors.primary}/> : null}
    <View style={styles.switchCopy}><Text style={styles.label}>{title}</Text>{detail ? <Text style={styles.hint}>{detail}</Text> : null}</View>
    <Ionicons name={open?'chevron-up':'chevron-down'} size={17} color={colors.muted}/>
  </Pressable>;
}
const styles=StyleSheet.create({
  intro:{gap:12},headingRow:{flexDirection:'row',alignItems:'center',gap:10},titleRow:{flex:1,minWidth:0,flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},
  title:{minWidth:0,maxWidth:'100%',flexShrink:1,fontSize:20,lineHeight:28,fontWeight:'700',color:colors.ink},history:{width:44,minHeight:44,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'},
  quota:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,paddingHorizontal:12,paddingVertical:4,borderWidth:1,borderColor:colors.border,borderRadius:14,backgroundColor:colors.card},quotaExhausted:{backgroundColor:colors.soft},quotaText:{flexGrow:1,flexBasis:150,minWidth:0,fontSize:12,lineHeight:19,color:colors.muted,paddingVertical:6},
  plans:{minHeight:44,maxWidth:'100%',flexShrink:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6,paddingVertical:8},linkText:{flexShrink:1,fontSize:12,lineHeight:19,fontWeight:'700',color:colors.primary},
  panel:{padding:14,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:12},sectionHeading:{flexDirection:'row',alignItems:'center',gap:8},sectionTitle:{flex:1,fontSize:15,lineHeight:22,fontWeight:'700',color:colors.ink},
  step:{minWidth:23,minHeight:23,padding:3,borderRadius:8,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},stepText:{fontSize:11,lineHeight:16,fontWeight:'700',color:colors.primary},
  label:{fontSize:13,lineHeight:20,fontWeight:'600',color:colors.ink},hint:{fontSize:12,lineHeight:19,color:colors.muted},options:{gap:12},
  switchRow:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:12,borderTopWidth:1,borderTopColor:colors.border},switchCopy:{flex:1,minWidth:0,gap:3},flex:{flex:1,minWidth:0},
  disclosure:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},pressed:{opacity:.7},
  methodologyHint:{fontSize:12,lineHeight:20,color:'#805717',backgroundColor:'#FCF4E6',padding:10,borderRadius:12},
});
