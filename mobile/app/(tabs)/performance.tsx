import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Screen, Card, Heading, Body, Stats, Bar, Loading, ErrorState, Button } from '@/components/ui';
import { analyticsService } from '@/services/analytics-service';
import { practiceService } from '@/services/question-service';
export default function Performance() {
  const query=useQuery({queryKey:['performance'],queryFn:analyticsService.performance});const weak=useQuery({queryKey:['weak'],queryFn:practiceService.weak});const data=query.data;
  return <Screen title="Your progress" subtitle="Know your strengths. Find your next focus." refreshing={query.isRefetching} onRefresh={()=>{void query.refetch();void weak.refetch();}}>
    {query.isLoading&&<Loading/>}{query.error&&<ErrorState error={query.error} retry={()=>void query.refetch()}/>}
    {data&&<>{!data.has_data&&<Card><Heading>Every journey begins with one question.</Heading><Body>Complete a practice session or mock paper to see your performance here.</Body><Button label="Start practice" onPress={()=>router.push('/practice')}/></Card>}<Stats items={[{label:'Overall accuracy',value:`${data.overall_accuracy_pct}%`},{label:'Questions attempted',value:data.questions_attempted},{label:'Mocks completed',value:data.mocks_completed},{label:'Average mock score',value:`${data.avg_mock_score}/${data.mock_total_marks}`},{label:'Best rank',value:data.best_rank??'—'},{label:'Best percentile',value:data.best_percentile??'—'}]}/>{data.accuracy_delta_pct!==null&&<Body>Accuracy change: {data.accuracy_delta_pct>0?'+':''}{data.accuracy_delta_pct}%</Body>}
      <Card><Heading>Subject proficiency</Heading>{data.subject_breakdown.map(subject=><Card key={subject.subject}><Heading>{subject.subject}</Heading><Body>{subject.accuracy_pct}% · {subject.status} · {subject.attempted} attempted</Body><Bar value={subject.accuracy_pct}/></Card>)}</Card>
      <Card gold><Heading>Where to focus</Heading>{data.weak_areas.length===0?<Body>Complete more questions to discover focus areas.</Body>:data.weak_areas.map(x=><Body key={x.subject}>{x.subject} · {x.accuracy_pct}%</Body>)}</Card>
      <Card><Heading>Recent mock attempts</Heading>{!data.recent_attempts.length&&<Body>No completed mock papers yet.</Body>}{data.recent_attempts.map(item=><Button key={item.attempt_id} secondary label={`${item.title} · ${item.score}/${item.total_marks} · ${item.accuracy_pct}%`} onPress={()=>router.push({pathname:'/result',params:{kind:'mock',id:item.attempt_id}})}/>)}</Card>
    </>}
    {weak.error&&<ErrorState error={weak.error} retry={()=>void weak.refetch()}/>} {!!weak.data?.recommendations.length&&<Card><Heading>Weak topics</Heading>{weak.data.recommendations.map(r=><Button key={r.subject+r.topic} secondary label={`${r.topic} · ${r.accuracy_pct}%`} onPress={()=>router.push({pathname:'/practice',params:{subject:r.subject,topic:r.topic}})}/>)}</Card>}
    <Button secondary label="All attempt history" onPress={()=>router.push('/history')}/>
  </Screen>;
}
