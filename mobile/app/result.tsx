import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListScreen, Card, Heading, Body, Button, Chips, Loading, ErrorState, Bar, EmptyState } from '@/components/ui';
import { QuestionReviewCard } from '@/components/question-review-card';
import { ResultSummary } from '@/components/result-summary';
import { ReviewPagination, ReviewSubjectPicker } from '@/components/review-controls';
import { examService } from '@/services/exam-service';
import { practiceService } from '@/services/question-service';
import { examSubmission } from '@/services/exam-submission';
import { colors } from '@/utils/theme';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
import { reviewPage, reviewSubjects, selectReviewQuestions, type ReviewFilter, type ReviewQuestion } from '@/utils/question-review';
import { resultNumber } from '@/utils/result-summary';
export default function Result() {
  const {user}=useAuth();const cache=useQueryClient();
  const { kind, id, submit } = useLocalSearchParams<{ kind: string; id: string; submit?:string }>();
  const examKind=kind==='mock'?'mock':'practice';
  const [filter,setFilter]=useState<ReviewFilter>('all');const [leaderboard,setLeaderboard]=useState(false);const [breakdown,setBreakdown]=useState(false);const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
  const [subject,setSubject]=useState('');
  const [pageState,setPageState]=useState({scope:'',page:1});
  const listRef=useRef<FlatList<ReturnType<typeof selectReviewQuestions<ReviewQuestion>>[number]>>(null);
  const headerHeight=useRef(0);const controlsHeight=useRef(0);const scrollRequested=useRef(false);
  const submission=useQuery({queryKey:['exam-submission',user?.id,examKind,id],queryFn:()=>examSubmission.run(user!.id,examKind,id),enabled:submit==='1'&&!!user,retry:false,staleTime:Infinity});
  const ready=submit!=='1'||submission.isSuccess;
  const submitting=submit==='1'&&!ready&&(submission.isPending||submission.isFetching);
  usePreventRemove(submitting,()=>{});
  useEffect(()=>{
    if(submit==='1'&&submission.isSuccess)void cache.invalidateQueries({predicate:query=>['mocks','overview','performance','history','quota','weak','next','leaderboard'].includes(String(query.queryKey[0])),refetchType:'none'});
  },[submit,submission.isSuccess,cache]);
  const practice=useQuery({queryKey:['practice-result',id],queryFn:()=>practiceService.results(id),enabled:ready&&kind==='practice',staleTime:0});
  const mock=useQuery({queryKey:['mock-result',id],queryFn:()=>examService.result(id),enabled:ready&&kind==='mock',staleTime:0});
  const next=useQuery({queryKey:['next',mock.data?.result.mock_test_id],queryFn:()=>examService.next(mock.data!.result.mock_test_id),enabled:ready&&!!mock.data});
  const ranks=useQuery({queryKey:['leaderboard',mock.data?.result.mock_test_id],queryFn:()=>examService.leaderboard(mock.data!.result.mock_test_id),enabled:ready&&leaderboard&&!!mock.data});
  const retry=useMutation({mutationFn:(topic?:string)=>launchPractice(user!.id,()=>practiceService.retry({fromSessionId:id,topic})),onSuccess:data=>router.replace({pathname:'/exam',params:{kind:'practice',id:data.session.id}})});
  const result=ready?(kind==='mock'?mock.data?.result:practice.data?.results):undefined; const active=kind==='mock'?mock:practice;
  const questions=result?.questions_review;
  const subjects=useMemo(()=>reviewSubjects(questions??[]),[questions]);
  const selectedSubject=subjects.some(item=>item.value===subject)?subject:'';
  const scope=JSON.stringify([kind,id,filter,selectedSubject]);
  const review=useMemo(()=>selectReviewQuestions<ReviewQuestion>(questions??[],filter,selectedSubject),[questions,filter,selectedSubject]);
  const page=useMemo(()=>reviewPage(review,pageState.scope===scope?pageState.page:1),[review,pageState,scope]);
  const changePage=(value:number)=>{scrollRequested.current=true;setPageState({scope,page:value});};
  const changeFilter=(value:ReviewFilter)=>{if(value!==filter){scrollRequested.current=true;setPageState({scope:'',page:1});setFilter(value);}};
  const changeSubject=(value:string)=>{if(value!==selectedSubject){scrollRequested.current=true;setPageState({scope:'',page:1});setSubject(value);}};
  useEffect(()=>{
    if(!scrollRequested.current)return;
    scrollRequested.current=false;
    const frame=requestAnimationFrame(()=>listRef.current?.scrollToOffset({offset:Math.max(0,headerHeight.current-controlsHeight.current),animated:false}));
    return ()=>cancelAnimationFrame(frame);
  },[scope,page.page]);
  const toggle=useCallback((key:string)=>setExpanded(previous=>{const updated=new Set(previous);if(updated.has(key))updated.delete(key);else updated.add(key);return updated;}),[]);
  const renderItem=useCallback(({item}:{item:(typeof review)[number]})=><QuestionReviewCard question={item.question} number={item.number} expanded={expanded.has(item.key)} onToggle={()=>toggle(item.key)} kind={examKind} testId={mock.data?.result.mock_test_id}/>,[expanded,toggle,examKind,mock.data?.result.mock_test_id]);
  const goBack=()=>router.replace(kind==='mock'?'/(tabs)/mocks':'/(tabs)/practice');
  return <ListScreen key={`${kind}:${id}`} listRef={listRef} onHeaderLayout={event=>{headerHeight.current=event.nativeEvent.layout.height;}} title="Results" batchSize={4} windowSize={5}
    pageHeader={<View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={kind==='mock'?'Back to Mock Tests':'Back to Practice'} accessibilityState={{disabled:submitting}} disabled={submitting} onPress={goBack} style={[styles.back,submitting&&{opacity:.4}]}><Ionicons name="arrow-back" size={22} color={colors.primary}/></Pressable><Text accessibilityRole="header" style={styles.heading}>{submitting?'Submitting':'Results'}</Text></View>}
    data={page.items} keyExtractor={row=>row.key} extraData={expanded}
    refreshing={ready&&active.isRefetching} onRefresh={ready?()=>void active.refetch():undefined}
    renderItem={renderItem}
    header={<>
      {!ready?<View style={styles.status}>
        {submitting?<><ActivityIndicator size="large" color={colors.primary}/><Text style={styles.statusTitle}>Submitting your answers…</Text><Text style={styles.statusText}>Your timer is stopped. Results will appear here when submission finishes.</Text></>:<>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.red}/><Text style={styles.statusTitle}>Submission needs a retry</Text><Text style={styles.statusText}>{submission.error instanceof Error?submission.error.message:'Could not finish submitting. Please try again.'}</Text><Button label="Retry submission" onPress={()=>void submission.refetch()}/><Button secondary label="Open saved exam" onPress={()=>router.replace({pathname:'/exam',params:{kind:examKind,id}})}/>
        </>}
      </View>:null}
      {ready&&active.error ? <ErrorState error={active.error} retry={()=>void active.refetch()}/> : null}
      {result ? <>
        <ResultSummary result={result} title={mock.data?.result.test_title||practice.data?.results.subject||'Completed test'}/>
        {mock.data&&next.data?.next_module ? <Button label="Next module" onPress={()=>router.replace({pathname:'/mock/[id]',params:{id:next.data!.next_module!.id}})}/> : null}
        {practice.data ? <Button icon="refresh-outline" label="Practice mistakes" busy={retry.isPending} disabled={practice.data.results.incorrect_count===0} onPress={()=>retry.mutate(undefined)}/> : null}
        {retry.error ? <ErrorState error={retry.error}/> : null}
        <Button secondary icon={breakdown?'chevron-up-outline':'chevron-down-outline'} label={kind==='mock'?'Section scores':'Topic scores'} onPress={()=>setBreakdown(value=>!value)}/>
        {breakdown?<View style={styles.breakdown}>
          {mock.data?.result.section_scores.map(section=><View key={section.section_id} style={styles.section}><Text style={styles.sectionTitle}>{section.section_name}</Text><Text style={styles.sectionDetail}>Marks {resultNumber(section.score)} / {resultNumber(section.total_marks)} · {section.correct}/{section.total} correct</Text><Bar value={section.total?100*section.correct/section.total:0}/></View>)}
          {practice.data?.results.topic_breakdown.map(topic=><View key={topic.topic} style={styles.section}><Text style={styles.sectionTitle}>{topic.topic}</Text><Text style={styles.sectionDetail}>{topic.correct}/{topic.total_questions} correct · {resultNumber(topic.accuracy_pct)}% · {topic.is_weak?'Needs practice':topic.is_mastered?'Mastered':'Progressing'}</Text><Bar value={topic.accuracy_pct}/></View>)}
          {practice.data?.results.weak_recommendations.map(recommendation=><Button key={recommendation.topic} secondary label={recommendation.action_label} disabled={retry.isPending} onPress={()=>retry.mutate(recommendation.topic)}/>)}
        </View>:null}
        {mock.data ? <><Button secondary icon={leaderboard?'chevron-up-outline':'chevron-down-outline'} label="Ranking" onPress={()=>setLeaderboard(value=>!value)}/>
          {leaderboard ? <Card><Heading>Your ranking</Heading><Body>{mock.data.result.rank===null?'Rank is not available yet.':`Rank #${mock.data.result.rank}`}{mock.data.result.percentile===null?'':` · Percentile ${resultNumber(mock.data.result.percentile)}`}</Body><Body>Percentile compares your result with other completed attempts.</Body>{ranks.isLoading ? <Loading/> : null}{ranks.error ? <ErrorState error={ranks.error} retry={()=>void ranks.refetch()}/> : null}{ranks.data?.leaderboard.length===0 ? <Body>No ranked attempts yet.</Body> : null}{ranks.data?.leaderboard.map(entry=><View key={entry.attempt_id} style={[styles.rankRow,entry.is_current_user&&{backgroundColor:colors.primarySoft}]}><Text style={styles.rankText}>#{entry.rank} · {entry.user_name||'Learner'}{entry.is_current_user?' (you)':''}</Text><Text style={styles.sectionDetail}>{resultNumber(entry.score)} marks · {resultNumber(entry.percentage)}%</Text></View>)}</Card> : null}
        </> : null}
        <View style={styles.reviewControls} onLayout={event=>{controlsHeight.current=event.nativeEvent.layout.height;}}>
          <Heading>Review answers</Heading>
          <ReviewSubjectPicker subjects={subjects} total={questions?.length??0} selected={selectedSubject} onSelect={changeSubject}/>
          <Chips items={[{value:'all',label:'All'},{value:'incorrect',label:'Wrong'},{value:'skipped',label:'Skipped'},{value:'marked',label:'Marked'}]} selected={filter} onSelect={changeFilter}/>
          <ReviewPagination {...page} onChange={changePage}/>
        </View>
      </> : null}
    </>}
    empty={ready&&active.isPending ? <Loading/> : result ? <EmptyState title="No questions in this filter" detail="Choose another filter to review your answers." icon="checkmark-circle-outline"/> : undefined}
    footer={result?<><ReviewPagination {...page} onChange={changePage}/><Button secondary label={kind==='mock'?'Back to Mock Tests':'Back to Practice'} onPress={goBack}/></>:undefined}/>;
}
const styles=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:8},back:{width:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:colors.card},heading:{flex:1,minWidth:0,fontSize:22,lineHeight:31,fontWeight:'700',color:colors.ink},
  status:{padding:22,gap:14,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},statusTitle:{fontSize:20,lineHeight:29,fontWeight:'700',color:colors.ink},statusText:{fontSize:14,lineHeight:23,color:colors.muted},
  breakdown:{padding:16,gap:16,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},section:{gap:6},sectionTitle:{fontSize:14,lineHeight:22,fontWeight:'600',color:colors.ink},sectionDetail:{fontSize:12,lineHeight:20,color:colors.muted},
  rankRow:{padding:10,gap:3,borderRadius:12,backgroundColor:'#F5F4F1'},rankText:{fontSize:13,lineHeight:21,fontWeight:'600',color:colors.primary},
  reviewControls:{gap:12},
});
