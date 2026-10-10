import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ListScreen, Card, Heading, Body, Stats, Button, Chips, Loading, ErrorState, Bar, Badge, EmptyState } from '@/components/ui';
import { QuestionReviewCard } from '@/components/question-review-card';
import { examService } from '@/services/exam-service';
import { practiceService } from '@/services/question-service';
import { colors } from '@/utils/theme';
import { useAuth } from '@/store/auth';
import { launchPractice } from '@/services/session-launch';
import { useProgressiveList } from '@/hooks/use-progressive-list';
import { selectReviewQuestions, type ReviewFilter, type ReviewQuestion } from '@/utils/question-review';
export default function Result() {
  const {user}=useAuth();
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const [filter,setFilter]=useState<ReviewFilter>('all'); const [leaderboard,setLeaderboard]=useState(false); const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
  const practice=useQuery({queryKey:['practice-result',id],queryFn:()=>practiceService.results(id),enabled:kind==='practice'});
  const mock=useQuery({queryKey:['mock-result',id],queryFn:()=>examService.result(id),enabled:kind==='mock'});
  const next=useQuery({queryKey:['next',mock.data?.result.mock_test_id],queryFn:()=>examService.next(mock.data!.result.mock_test_id),enabled:!!mock.data});
  const ranks=useQuery({queryKey:['leaderboard',mock.data?.result.mock_test_id],queryFn:()=>examService.leaderboard(mock.data!.result.mock_test_id),enabled:leaderboard&&!!mock.data});
  const retry=useMutation({mutationFn:(topic?:string)=>launchPractice(user!.id,()=>practiceService.retry({fromSessionId:id,topic})),onSuccess:data=>router.replace({pathname:'/exam',params:{kind:'practice',id:data.session.id}})});
  const result=practice.data?.results||mock.data?.result; const active=kind==='mock'?mock:practice;
  const review=useMemo(()=>selectReviewQuestions<ReviewQuestion>(result?.questions_review??[],filter),[result,filter]);
  const feed=useProgressiveList(review,`${kind}:${id}:${filter}`,8);
  const toggle=(key:string)=>setExpanded(previous=>{const updated=new Set(previous);if(updated.has(key))updated.delete(key);else updated.add(key);return updated;});
  return <ListScreen key={`${kind}:${id}:${filter}`} title="Your results" subtitle="Celebrate your progress. Learn from every answer."
    data={feed.items} keyExtractor={row=>row.key} extraData={expanded} onEndReached={feed.hasMore?feed.loadMore:undefined}
    refreshing={active.isRefetching} onRefresh={()=>void active.refetch()}
    renderItem={({item})=><QuestionReviewCard question={item.question} number={item.number} expanded={expanded.has(item.key)} onToggle={()=>toggle(item.key)} kind={kind==='mock'?'mock':'practice'} testId={mock.data?.result.mock_test_id}/>}
    header={<>
      {active.error ? <ErrorState error={active.error} retry={()=>void active.refetch()}/> : null}
      {result ? <>
        <Card gold><Badge label="SESSION COMPLETE" color={colors.gold}/><Heading>{mock.data?.result.test_title||practice.data?.results.subject}</Heading>
          <Stats items={[{label:'Score',value:`${result.score}/${mock.data?.result.total_marks??result.total_questions}`},{label:'Accuracy',value:`${mock.data?.result.percentage??practice.data?.results.accuracy_pct}%`},{label:'Correct',value:result.correct_count},{label:'Incorrect',value:result.incorrect_count},{label:'Unanswered',value:mock.data?.result.unanswered_count??practice.data?.results.skipped_count??0},{label:'Time',value:`${Math.floor(result.total_time_seconds/60)} min ${result.total_time_seconds%60}s`}]}/>
          {mock.data ? <Body>Rank: {mock.data.result.rank??'calculating'} · Percentile: {mock.data.result.percentile??'calculating'}</Body> : null}
        </Card>
        <Card><Heading>{kind==='mock'?'Section':'Topic'} performance</Heading>
          {mock.data?.result.section_scores.map(section=><Body key={section.section_id}>{section.section_name} · {section.score}/{section.total_marks} · {section.correct}/{section.total} correct</Body>)}
          {practice.data?.results.topic_breakdown.map(topic=><Card key={topic.topic}><Heading>{topic.topic}</Heading><Body>{topic.correct}/{topic.total_questions} · {topic.accuracy_pct}% · {topic.is_weak?'Needs practice':topic.is_mastered?'Mastered':'Progressing'}</Body><Bar value={topic.accuracy_pct}/></Card>)}
        </Card>
        {practice.data ? <><Button icon="refresh-outline" label="Retry incorrect questions" busy={retry.isPending} onPress={()=>retry.mutate(undefined)}/>{practice.data.results.weak_recommendations.map(recommendation=><Button key={recommendation.topic} secondary label={recommendation.action_label} disabled={retry.isPending} onPress={()=>retry.mutate(recommendation.topic)}/>)}{retry.error ? <ErrorState error={retry.error}/> : null}</> : null}
        {mock.data ? <><Button secondary label={leaderboard?'Hide leaderboard':'View leaderboard'} onPress={()=>setLeaderboard(value=>!value)}/>
          {leaderboard ? <Card><Heading>Paper leaderboard</Heading>{ranks.isLoading ? <Loading/> : null}{ranks.error ? <ErrorState error={ranks.error} retry={()=>void ranks.refetch()}/> : null}{ranks.data?.leaderboard.length===0 ? <Body>No ranked attempts yet.</Body> : null}{ranks.data?.leaderboard.map(entry=><Body key={entry.attempt_id} color={entry.is_current_user?colors.primary:undefined}>#{entry.rank} {entry.user_name||'Learner'} · {entry.score} · {entry.percentage}% {entry.is_current_user?'(you)':''}</Body>)}</Card> : null}
          {next.data?.next_module ? <Button label="Next module" onPress={()=>router.replace({pathname:'/mock/[id]',params:{id:next.data!.next_module!.id}})}/> : null}
        </> : null}
        <Heading>Answer review</Heading><Body>{review.length} questions · Read each explanation when you are ready.</Body>
        <Chips items={[{value:'all',label:'All'},{value:'incorrect',label:'Incorrect'},{value:'skipped',label:'Unanswered'},{value:'marked',label:'For review'}]} selected={filter} onSelect={setFilter}/>
      </> : null}
    </>}
    empty={active.isPending ? <Loading/> : result ? <EmptyState title="Nothing to review here" detail="Try another answer filter." icon="checkmark-circle-outline"/> : undefined}
    footer={<>{feed.hasMore ? <Button secondary label="Show more answers" onPress={feed.loadMore}/> : review.length ? <Body>You have reached the end of this review.</Body> : null}<Button label="Back to dashboard" onPress={()=>router.replace('/')}/></>}/>;
}
