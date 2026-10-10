import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Screen, Card, Heading, Body, Button, Chips, ErrorState, Loading } from '@/components/ui';
import { practiceService } from '@/services/question-service';
import { analyticsService } from '@/services/analytics-service';
export default function History() {
  const [kind,setKind]=useState('practice');const practice=useQuery({queryKey:['history'],queryFn:practiceService.history});const mocks=useQuery({queryKey:['performance'],queryFn:analyticsService.performance});const active=kind==='practice'?practice:mocks;
  return <Screen title="Attempt history" subtitle="Revisit your work and learn from every attempt." refreshing={active.isRefetching} onRefresh={()=>void active.refetch()}><Chips items={[{value:'practice',label:'Practice'},{value:'mock',label:'Mock papers'}]} selected={kind} onSelect={setKind}/>
    {active.isLoading&&<Loading/>}{active.error&&<ErrorState error={active.error} retry={()=>void active.refetch()}/>}
    {kind==='practice'&&practice.data&&<>{!practice.data.history.length&&<Card><Body>No completed practice sessions yet.</Body></Card>}{practice.data.history.map(item=><Card key={item.id}><Heading>{item.subject}</Heading><Body>{item.medium} · {item.mode.replaceAll('_',' ')} · {new Date(item.started_at).toLocaleDateString()}</Body><Body>{item.score}/{item.question_count} · {item.accuracy_pct}% · {Math.round(item.time_spent_seconds/60)} min</Body><Button label="Review answers" onPress={()=>router.push({pathname:'/result',params:{kind:'practice',id:item.id}})}/></Card>)}</>}
    {kind==='mock'&&mocks.data&&<>{!mocks.data.recent_attempts.length&&<Card><Body>No completed mock papers yet.</Body></Card>}{mocks.data.recent_attempts.map(item=><Card key={item.attempt_id}><Heading>{item.title}</Heading><Body>{item.score}/{item.total_marks} · {item.accuracy_pct}% · Rank {item.rank??'pending'}</Body><Button label="Review results" onPress={()=>router.push({pathname:'/result',params:{kind:'mock',id:item.attempt_id}})}/></Card>)}<Body>Showing the server’s recent mock history. The library also shows your latest attempt per paper.</Body></>}
    <Button secondary label="Back home" onPress={()=>router.replace('/')}/>
  </Screen>;
}
