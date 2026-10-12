import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { Screen, Card, Heading, Body, Bar, Loading, ErrorState, Button, EmptyState } from '@/components/ui';
import { ProgressOverview } from '@/components/progress-overview';
import { analyticsService } from '@/services/analytics-service';
import { practiceService } from '@/services/question-service';
import { progressFocus, progressPracticeSubject, progressSubjectLabel } from '@/utils/progress-summary';
import { resultNumber } from '@/utils/result-summary';
import { colors, subjectStyle } from '@/utils/theme';

export default function Performance() {
  const query=useQuery({queryKey:['performance'],queryFn:analyticsService.performance});
  const weak=useQuery({queryKey:['weak'],queryFn:practiceService.weak});
  const data=query.data;
  const focus=useMemo(()=>data?progressFocus(data,weak.data?.recommendations??[]):null,[data,weak.data]);
  const {refetch:refetchPerformance}=query;const {refetch:refetchTopics}=weak;
  const refresh=useCallback(()=>{void refetchPerformance({cancelRefetch:false});void refetchTopics({cancelRefetch:false});},[refetchPerformance,refetchTopics]);
  useFocusEffect(refresh);
  return <Screen title="Progress" pageHeader={<View style={styles.intro}><Heading style={styles.title}>Your progress</Heading><Text style={styles.subtitle}>Your learning, at a glance.</Text></View>}
    refreshing={query.isRefetching||weak.isRefetching} onRefresh={refresh}>
    {query.isPending?<Loading/>:null}
    {query.error?<ErrorState error={query.error} retry={()=>void query.refetch()}/>:null}
    {data?.has_data?<>
      <ProgressOverview data={data}/>
      <View style={styles.focus}>
        <View style={styles.sectionHeading}><View style={styles.focusIcon}><Ionicons name="locate-outline" size={21} color={colors.gold}/></View><Heading>Next practice</Heading></View>
        {focus?<><Heading style={styles.focusTitle}>{focus.topic||focus.label}</Heading>{focus.topic?<Text style={styles.subtitle}>{focus.label}</Text>:null}<Button icon="play-outline" label="Practise this" onPress={()=>router.push({pathname:'/practice',params:{subject:focus.subject,...(focus.topic?{topic:focus.topic}:{})}})}/></>:<>
          <Body>Keep practising to build your progress.</Body><Button icon="play-outline" label="Start practice" onPress={()=>router.push('/practice')}/>
        </>}
        {weak.error?<><Text style={styles.subtitle}>Topic suggestions could not load.</Text><Button secondary label="Retry suggestions" onPress={()=>void weak.refetch()}/></>:null}
      </View>
      <Card>
        <Heading>By subject</Heading><Text style={styles.subtitle}>Correct answers out of recorded questions.</Text>
        {data.subject_breakdown.length===0?<Body>No subject results yet.</Body>:null}
        {data.subject_breakdown.map(subject=>{
          const style=subjectStyle(subject.subject);
          const practiceSubject=progressPracticeSubject(subject.subject);
          const label=progressSubjectLabel(subject.subject);
          const content=<>
            <View style={styles.subjectHeader}><View style={[styles.subjectIcon,{backgroundColor:style.color+'15'}]}><Ionicons name={style.icon} size={18} color={style.color}/></View><Text style={styles.subjectTitle}>{label}</Text><Text style={styles.percent}>{resultNumber(subject.accuracy_pct)}%</Text></View>
            <Bar value={subject.accuracy_pct} color={style.color}/><Text style={styles.subtitle}>{subject.correct}/{subject.attempted} correct{practiceSubject?' · Tap to practise':''}</Text>
          </>;
          return practiceSubject?<Pressable key={subject.subject} accessibilityRole="button" accessibilityLabel={`${label}, ${resultNumber(subject.accuracy_pct)} percent, ${subject.correct} of ${subject.attempted} correct. Practise this subject`} onPress={()=>router.push({pathname:'/practice',params:{subject:practiceSubject}})} style={({pressed})=>[styles.subject,pressed&&{opacity:.7}]}>{content}</Pressable>:<View key={subject.subject} style={styles.subject}>{content}</View>;
        })}
      </Card>
      {data.mocks_completed>0?<Card>
        <View style={styles.mockHeading}><Heading>Recent mocks</Heading><Text style={styles.average}>Average {resultNumber(data.avg_mock_score)} marks</Text></View>
        {data.recent_attempts.length===0?<Body>No recent results available.</Body>:null}
        {data.recent_attempts.slice(0,3).map(attempt=><Pressable key={attempt.attempt_id} accessibilityRole="button" accessibilityLabel={`${attempt.title}, ${resultNumber(attempt.score)} of ${resultNumber(attempt.total_marks)} marks. View result`} onPress={()=>router.push({pathname:'/result',params:{kind:'mock',id:attempt.attempt_id}})} style={({pressed})=>[styles.attempt,pressed&&{opacity:.7}]}>
          <View style={styles.attemptText}><Text style={styles.attemptTitle}>{attempt.title}</Text><Text style={styles.subtitle}>{resultNumber(attempt.score)} / {resultNumber(attempt.total_marks)} marks</Text></View><Ionicons name="chevron-forward" size={19} color={colors.primary}/>
        </Pressable>)}
      </Card>:null}
      <Button secondary icon="time-outline" label="View attempt history" onPress={()=>router.push('/history')}/>
    </>:data?<><EmptyState title="Your progress starts here" detail="Complete practice or a mock test to see your chart and subject results." icon="pie-chart-outline"/><Button icon="play-outline" label="Start practice" onPress={()=>router.push('/practice')}/><Button secondary label="Browse mock tests" onPress={()=>router.push('/mocks')}/></>:null}
  </Screen>;
}
const styles=StyleSheet.create({
  intro:{gap:5},title:{},subtitle:{fontSize:12,lineHeight:20,color:colors.muted},
  focus:{padding:16,gap:10,borderRadius:20,borderWidth:1,borderColor:'#E4CFA9',backgroundColor:'#FAF5EB'},sectionHeading:{flexDirection:'row',alignItems:'center',gap:9},focusIcon:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft},focusTitle:{},
  subject:{paddingVertical:12,gap:7,borderTopWidth:1,borderTopColor:colors.border,minHeight:82},subjectHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},subjectIcon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center'},subjectTitle:{flex:1,minWidth:0,fontSize:14,lineHeight:23,fontWeight:'600',color:colors.ink},percent:{fontSize:14,lineHeight:23,fontWeight:'700',color:colors.primary},
  mockHeading:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:7},average:{fontSize:12,lineHeight:20,fontWeight:'600',color:colors.primary},attempt:{minHeight:66,paddingVertical:12,borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row',alignItems:'center',gap:10},attemptText:{flex:1,gap:3},attemptTitle:{fontSize:14,lineHeight:23,fontWeight:'600',color:colors.ink},
});
