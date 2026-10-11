import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Card, Heading, Body, Button, Stats, Loading, ErrorState, Bar, Badge, ChoiceRow, SectionHeading, s } from '@/components/ui';
import { analyticsService } from '@/services/analytics-service';
import { useAuth } from '@/store/auth';
import { vault } from '@/services/vault';
import type { ExamDraft } from '@/store/exam';
import { practiceService } from '@/services/question-service';
import { examService } from '@/services/exam-service';
import { examDrafts } from '@/services/exam-drafts';
import { colors, subjectStyle } from '@/utils/theme';
const sectionSubjects: Record<string,string>={gk:'GK & Current Affairs',perspectives:'Educational Psychology + Perspectives in Education',psychology:'Educational Psychology + Perspectives in Education',telugu:'Telugu',english:'English',mathematics:'Mathematics',science:'Science',social:'Social Studies'};
export default function Home() {
  const {user}=useAuth(); const data=useQuery({queryKey:['overview'],queryFn:analyticsService.overview});
  const [draft,setDraft]=useState<Pick<ExamDraft,'id'|'kind'>|null>(null);
  useFocusEffect(useCallback(()=>{
    let alive=true;
    void (async()=>{
      const active=await vault.read<ExamDraft>('active-exam');
      if(active&&active.userId===user?.id){
        const {state}=await examDrafts.load(active.userId,active.kind,active.id,async()=>({status:active.kind==='mock'?(await examService.get(active.id)).attempt.status:(await practiceService.get(active.id)).session.status}));
        if(!state||state.status==='in_progress'){if(alive)setDraft(active);return;}
      }
      const created=await vault.read<{id:string;userId:string}>('created-practice');
      if(created?.userId===user?.id){const result=await practiceService.get(created!.id);if(alive)setDraft(result.session.status==='in_progress'?{id:created!.id,kind:'practice'}:null);}
      else if(alive)setDraft(null);
    })().catch(()=>{if(alive)setDraft(null);});
    return()=>{alive=false;};
  },[user?.id]));
  const summary=data.data?.summary; const syllabus=data.data?.syllabus;
  return <Screen title={`Namaste, ${user?.name?.split(' ')[0] || 'Candidate'}!`} subtitle="Ready to crack DSC / SGT? Let's make today count."
    action={<Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={()=>router.push('/profile')} style={s.iconBox}><Ionicons name="person-outline" size={22} color={colors.primary}/></Pressable>}
    refreshing={data.isRefetching} onRefresh={()=>void data.refetch()}>
    <View style={{padding:22,borderRadius:28,borderWidth:1,borderColor:'#D6D1E5',backgroundColor:colors.primarySoft,gap:16}}>
      <Badge label="AP DSC / SGT PREPARATION"/>
      <Text style={{fontSize:25,lineHeight:33,fontWeight:'800',color:colors.primary}}>Learn a little.{'\n'}Grow every day.</Text>
      <Body>Chapter-wise practice, clear explanations and full-length mock exams. Your next step starts here.</Body>
      <Button icon="book-outline" label="Continue practice" onPress={()=>router.push('/practice')}/>
      <Button secondary icon="timer-outline" label="Explore mock tests" onPress={()=>router.push('/mocks')}/>
    </View>
    {draft ? <Card gold><Badge label="PICK UP WHERE YOU LEFT OFF" color={colors.gold}/><Heading>Continue your {draft.kind==='mock'?'mock exam':'practice'}</Heading><Body>Your answers are saved on this device.</Body><Button icon="play-outline" label={draft.kind==='mock'?'Resume paper':'Resume practice'} onPress={()=>router.push({pathname:'/exam',params:{kind:draft.kind,id:draft.id}})}/></Card> : null}
    {data.isLoading ? <Loading/> : data.error ? <ErrorState error={data.error} retry={()=>void data.refetch()}/> : summary ? <>
      <SectionHeading title="Your preparation at a glance"/>
      <Stats items={[{label:'Questions solved',value:summary.questions_solved},{label:'Average accuracy',value:`${summary.avg_accuracy_pct}%`},{label:'Study streak',value:`${summary.study_streak_days} days`},{label:'Modules done',value:`${summary.modules_completed}/${summary.modules_total}`}]}/>
      <Card><View style={s.between}><Heading>Your module journey</Heading><Badge label={`${summary.modules_completed}/${summary.modules_total}`}/></View><Bar value={100*summary.modules_completed/Math.max(1,summary.modules_total)}/><Body>{summary.modules_in_progress} modules in progress</Body></Card>
    </> : null}
    <SectionHeading title="Core learning modules" detail="Everything you need for your next step."/>
    <ChoiceRow title="Smart practice" detail="Choose a subject, focus on topics, learn from each answer." icon="book-outline" color="#4F8B81" onPress={()=>router.push('/practice')}/>
    <ChoiceRow title="Grand mock exams" detail="Timed papers that follow the official exam structure." icon="timer-outline" color="#8B7FD0" onPress={()=>router.push('/mocks')}/>
    <ChoiceRow title="Performance & progress" detail="Discover strengths and the topics to practise next." icon="stats-chart-outline" color="#5878B8" onPress={()=>router.push('/performance')}/>
    <ChoiceRow title="Attempt history" detail="Revisit your answers and explanations." icon="time-outline" color="#BD7F52" onPress={()=>router.push('/history')}/>
    {syllabus ? <>
      <SectionHeading title="Explore the syllabus" detail={`${syllabus.total_questions} questions · ${syllabus.total_marks} marks · ${syllabus.duration_minutes} minutes`}/>
      {syllabus.sections.map(section=>{const subject=sectionSubjects[section.id]||section.name;const style=subjectStyle(subject);return <ChoiceRow key={section.id} title={section.name} detail={`${style.tag} · ${section.questions} questions · ${section.marks} marks`} icon={style.icon} color={style.color} onPress={()=>router.push({pathname:'/practice',params:{subject}})}/>;})}
    </> : null}
    <Card gold><Badge label={user?.accountType==='PREMIUM'?'DSC PRO':'GO FURTHER WITH DSC PRO'} color={colors.gold}/><Heading>Make your preparation count.</Heading><Body>View plans and the practice features available to your account.</Body><Button secondary label="View plans" onPress={()=>router.push('/subscription')}/></Card>
  </Screen>;
}
