import { Heading } from '@/components/heading';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Screen, Body, Button, ErrorState, Loading } from '@/components/ui';
import { examService } from '@/services/exam-service';
import { showsPlans } from '@/services/payment-service';
import { colors } from '@/utils/theme';
import { pageLayout, practiceChoiceLayout } from '@/utils/layout';

export default function MockInstructions() {
  const {id}=useLocalSearchParams<{id:string}>();
  const {width,height,fontScale}=useWindowDimensions();
  const insets=useSafeAreaInsets();
  const layout=pageLayout(width-insets.left-insets.right,height,fontScale);
  const summary=practiceChoiceLayout(layout.contentWidth-layout.padding*2-34,fontScale,true,3);
  const [detailsOpen,setDetailsOpen]=useState(false);
  const test=useQuery({queryKey:['mock',id],queryFn:()=>examService.metadata(id)});
  const start=useMutation({mutationFn:()=>examService.start(id),onSuccess:data=>router.push({pathname:'/exam',params:{kind:'mock',id:data.attempt_id}})});
  // Wait for the start response before allowing navigation away from this page.
  usePreventRemove(start.isPending,()=>{});
  const paper=test.data?.test;
  const back=()=>{if(!start.isPending)router.replace('/(tabs)/mocks');};
  return <Screen title={paper?.title||'Mock test'}
    pageHeader={<View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Mock Tests"
        accessibilityState={{disabled:start.isPending}} disabled={start.isPending} onPress={back}
        style={({pressed})=>[styles.back,pressed&&styles.pressed,start.isPending&&styles.disabled]}>
        <Ionicons name="arrow-back" size={21} color={colors.primary}/><Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.context}>Mock Test</Text>
    </View>}
    footer={paper ? <Button icon="play-outline" label="Start / resume" busy={start.isPending} onPress={()=>start.mutate()}/> : undefined}>
    {test.isLoading ? <Loading/> : null}
    {test.error ? <ErrorState error={test.error} retry={()=>void test.refetch()}/> : null}
    {paper ? <>
      <View style={styles.panel}>
        <View style={styles.badges}>
          {paper.module_number!=null ? <View style={styles.module}><Text style={styles.moduleText}>Module {String(paper.module_number).padStart(2,'0')}</Text></View> : null}
          <View style={[styles.access,!paper.is_free&&styles.pro]}><Text style={[styles.accessText,!paper.is_free&&styles.proText]}>{paper.is_free?'Free':'Pro'}</Text></View>
        </View>
        <Heading style={styles.title}>{paper.title}</Heading>
        <View style={styles.stats}>
          {[
            {label:'Questions',value:paper.total_questions},
            {label:'Time',value:`${paper.duration_minutes} min`},
            {label:'Marks',value:paper.total_marks},
          ].map(stat=><View key={stat.label} style={[styles.stat,{width:summary.itemWidth}]}>
            <Text style={styles.statValue}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text>
          </View>)}
        </View>
        <View style={styles.marking}>
          <Text style={styles.ruleText}>{paper.marks_per_question} marks / correct answer</Text>
          <Text style={styles.ruleText}>{paper.negative_marks===0?'No negative marking':`Negative marking: ${paper.negative_marks}`}</Text>
        </View>
      </View>
      <View style={styles.panel}>
        <Heading style={styles.sectionTitle}>Quick guide</Heading>
        <GuideRow icon="radio-button-on-outline" label="Choose one answer."/>
        <GuideRow icon="grid-outline" label="Use the grid to jump questions."/>
        <GuideRow icon="arrow-back" label="Back pauses and saves."/>
        <GuideRow icon="checkmark-circle-outline" label="Submit to see results."/>
      </View>
      {paper.description?.trim() ? <View style={styles.panel}>
        <Pressable accessibilityRole="button" accessibilityState={{expanded:detailsOpen}} onPress={()=>setDetailsOpen(value=>!value)} style={({pressed})=>[styles.detailToggle,pressed&&styles.pressed]}>
          <Heading style={styles.sectionTitle}>Details</Heading><Ionicons name={detailsOpen?'chevron-up':'chevron-down'} size={18} color={colors.muted}/>
        </Pressable>
        {detailsOpen ? <Body>{paper.description}</Body> : null}
      </View> : null}
      {!paper.is_free&&showsPlans ? <Pressable accessibilityRole="button" accessibilityLabel="View Pro plans"
        disabled={start.isPending} accessibilityState={{disabled:start.isPending}} onPress={()=>router.push('/subscription')}
        style={({pressed})=>[styles.plans,pressed&&styles.pressed,start.isPending&&styles.disabled]}>
        <Ionicons name="ribbon-outline" size={18} color={colors.gold}/><Text style={styles.planText}>Pro plans</Text><Ionicons name="chevron-forward" size={16} color={colors.gold}/>
      </Pressable> : null}
    </> : null}
    {start.error ? <ErrorState error={start.error}/> : null}
  </Screen>;
}

function GuideRow({icon,label}:{icon:'radio-button-on-outline'|'grid-outline'|'arrow-back'|'checkmark-circle-outline';label:string}) {
  return <View style={styles.guide}><Ionicons name={icon} size={18} color={colors.primary}/><Text style={styles.guideText}>{label}</Text></View>;
}
const styles=StyleSheet.create({
  topbar:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},back:{minHeight:44,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:8,paddingVertical:8,borderRadius:12},backText:{flexShrink:1,fontSize:14,lineHeight:21,fontWeight:'600',color:colors.primary},context:{fontSize:12,lineHeight:19,color:colors.muted},
  panel:{padding:16,borderWidth:1,borderColor:colors.border,borderRadius:20,backgroundColor:colors.card,gap:12},badges:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},module:{maxWidth:'100%',paddingHorizontal:8,paddingVertical:4,borderRadius:8,backgroundColor:colors.primarySoft},moduleText:{fontSize:12,lineHeight:18,fontWeight:'700',color:colors.primary},
  access:{maxWidth:'100%',paddingHorizontal:9,paddingVertical:4,borderRadius:10,backgroundColor:colors.greenSoft},accessText:{fontSize:11,lineHeight:17,fontWeight:'600',color:colors.green},pro:{backgroundColor:'#FCF4E6'},proText:{color:'#805717'},title:{},
  stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{paddingHorizontal:6,paddingVertical:12,borderRadius:12,backgroundColor:'#F7F6F3',alignItems:'center',justifyContent:'center',gap:4},statValue:{fontSize:18,lineHeight:26,fontWeight:'700',color:colors.ink,textAlign:'center'},statLabel:{fontSize:11,lineHeight:17,color:colors.muted,textAlign:'center'},
  marking:{borderTopWidth:1,borderTopColor:colors.border,paddingTop:12,gap:5},ruleText:{fontSize:12,lineHeight:19,color:colors.muted},sectionTitle:{flexShrink:1},guide:{flexDirection:'row',alignItems:'center',gap:9},guideText:{flex:1,minWidth:0,fontSize:13,lineHeight:20,color:colors.muted},detailToggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  plans:{maxWidth:'100%',minHeight:44,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,paddingVertical:8,paddingHorizontal:6},planText:{flexShrink:1,fontSize:13,lineHeight:20,fontWeight:'600',color:'#805717'},pressed:{opacity:.7},disabled:{opacity:.45},
});
