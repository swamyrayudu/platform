import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Card, Heading, Button, Loading, ErrorState } from '@/components/ui';
import { analyticsService } from '@/services/analytics-service';
import { useAuth } from '@/store/auth';
import { vault } from '@/services/vault';
import type { ExamDraft } from '@/store/exam';
import { examService } from '@/services/exam-service';
import { examDrafts } from '@/services/exam-drafts';
import { colors, subjectStyle } from '@/utils/theme';
import { resultCountLayout } from '@/utils/layout';
import { hasSubjectMethodology, methodologyLabel, websitePracticeSubject } from '@/utils/practice-subjects';
const sectionSubjects: Record<string,string>={gk:'GK & Current Affairs',perspectives:'Educational Psychology + Perspectives in Education',psychology:'Educational Psychology + Perspectives in Education',telugu:'Telugu',english:'English',mathematics:'Mathematics',science:'Science',social:'Social Studies'};
export default function Home() {
  const {user}=useAuth(); const data=useQuery({queryKey:['overview'],queryFn:analyticsService.overview});
  const {fontScale}=useWindowDimensions();const [factsWidth,setFactsWidth]=useState(0);
  const facts=resultCountLayout(factsWidth,fontScale);
  const [draft,setDraft]=useState<Pick<ExamDraft,'id'|'kind'>|null>(null);
  useFocusEffect(useCallback(()=>{
    let alive=true;
    void (async()=>{
      const active=await vault.read<ExamDraft>('active-exam');
      if(active?.kind==='mock'&&active.userId===user?.id){
        const {state}=await examDrafts.load(active.userId,'mock',active.id,async()=>({status:(await examService.get(active.id)).attempt.status}));
        if(!state||state.status==='in_progress'){if(alive)setDraft(active);return;}
      }
      if(alive)setDraft(null);
    })().catch(()=>{if(alive)setDraft(null);});
    return()=>{alive=false;};
  },[user?.id]));
  const syllabus=data.data?.syllabus;
  const stackedActions=factsWidth<280*Math.max(1,fontScale);
  return <Screen title="Home" pageHeader={<View style={styles.intro}><Text style={styles.eyebrow}>AP DSC / SGT</Text><Heading style={styles.title}>Exam syllabus</Heading><Text style={styles.detail}>Choose a subject to start practising.</Text></View>}
    refreshing={data.isRefetching} onRefresh={()=>void data.refetch()}>
    {draft ? <View style={styles.resume}><Heading>Saved mock test</Heading><Button icon="play-outline" label="Resume" onPress={()=>router.push({pathname:'/exam',params:{kind:'mock',id:draft.id}})}/></View> : null}
    {data.isPending ? <Loading/> : null}
    {data.error ? <ErrorState error={data.error} retry={()=>void data.refetch()}/> : null}
    {syllabus ? <>
      <View style={styles.facts} onLayout={event=>setFactsWidth(event.nativeEvent.layout.width)}>
        {[{label:'Questions',value:syllabus.total_questions},{label:'Marks',value:syllabus.total_marks},{label:'Minutes',value:syllabus.duration_minutes}].map(item=><View key={item.label} style={[styles.fact,factsWidth?{width:facts.itemWidth}:styles.unmeasured]}><Text style={styles.factValue}>{item.value}</Text><Text style={styles.factLabel}>{item.label}</Text></View>)}
      </View>
    </> : null}
    <View style={[styles.actions,{flexDirection:stackedActions?'column':'row'}]}>
      <View style={[styles.action,stackedActions&&styles.stackedAction]}><Button icon="book-outline" label="Practice" onPress={()=>router.push('/practice')}/></View>
      <View style={[styles.action,stackedActions&&styles.stackedAction]}><Button secondary icon="timer-outline" label="Mock Tests" onPress={()=>router.push('/mocks')}/></View>
    </View>
    {syllabus ? <Card>
      <Heading>Subjects</Heading>
      {syllabus.sections.length===0 ? <Text style={styles.detail}>Subjects will appear when the syllabus is available.</Text> : null}
      {syllabus.sections.map(section=>{
        const subject=Object.hasOwn(sectionSubjects,section.id)?sectionSubjects[section.id]:websitePracticeSubject(section.name);
        const style=subjectStyle(section.name);
        const methodology=hasSubjectMethodology(subject??undefined);
        const content=<><View style={[styles.icon,{backgroundColor:style.color+'15'}]}><Ionicons name={style.icon} size={19} color={style.color}/></View><View style={styles.subjectText}><Text style={styles.subjectName}>{section.name}</Text><Text style={styles.detail}>{section.questions} questions · {section.marks} marks</Text>{methodology?<Text style={styles.methodology}>{methodologyLabel()}</Text>:null}</View>{subject?<Ionicons name="chevron-forward" size={18} color={colors.muted}/>:null}</>;
        return subject?<Pressable key={section.id} accessibilityRole="button" accessibilityLabel={`${section.name}, ${section.questions} questions, ${section.marks} marks.${methodology?' Content and methodology.':''} Open practice`} onPress={()=>router.push({pathname:'/practice',params:{subject}})} style={({pressed})=>[styles.subject,pressed&&{opacity:.7}]}>{content}</Pressable>:<View key={section.id} style={styles.subject}>{content}</View>;
      })}
    </Card> : null}
  </Screen>;
}
const styles=StyleSheet.create({
  intro:{gap:5},eyebrow:{fontSize:11,lineHeight:18,fontWeight:'700',letterSpacing:.8,color:colors.gold},title:{},detail:{fontSize:12,lineHeight:20,color:colors.muted},
  resume:{padding:14,gap:10,borderRadius:18,borderWidth:1,borderColor:'#E4CFA9',backgroundColor:'#FAF5EB'},
  facts:{flexDirection:'row',flexWrap:'wrap',gap:8},fact:{minWidth:0,paddingHorizontal:8,paddingVertical:12,gap:3,alignItems:'center',borderRadius:14,backgroundColor:colors.primarySoft},unmeasured:{flex:1},factValue:{fontSize:24,lineHeight:33,fontWeight:'800',color:colors.primary},factLabel:{fontSize:12,lineHeight:19,fontWeight:'500',color:colors.muted,textAlign:'center'},
  actions:{gap:10},action:{flex:1,minWidth:0},stackedAction:{flex:0},
  subject:{minHeight:68,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:1,borderTopColor:colors.border},icon:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center'},subjectText:{flex:1,minWidth:0,gap:3},subjectName:{fontSize:14,lineHeight:23,fontWeight:'600',color:colors.ink},
  methodology:{fontSize:11,lineHeight:18,fontWeight:'600',color:colors.gold},
});
