import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ListScreen, Card, Heading, Body, Button, Chips, ErrorState, Loading, EmptyState, Badge } from '@/components/ui';
import { practiceService } from '@/services/question-service';
import { analyticsService } from '@/services/analytics-service';
import { useProgressiveList } from '@/hooks/use-progressive-list';
export default function History() {
  const [kind,setKind]=useState('practice');
  const practice=useQuery({queryKey:['history'],queryFn:practiceService.history,enabled:kind==='practice'});
  const mocks=useQuery({queryKey:['performance'],queryFn:analyticsService.performance,enabled:kind==='mock'});
  const active=kind==='practice'?practice:mocks;
  const rows=useMemo(()=>kind==='practice' ? (practice.data?.history ?? []).map(item=>({id:item.id,title:item.subject,detail:`${item.medium} · ${item.mode.replaceAll('_',' ')} · ${Math.round(item.time_spent_seconds/60)} min · ${new Date(item.started_at).toLocaleDateString()}`,score:`${item.score}/${item.question_count}`,accuracy:item.accuracy_pct})) : (mocks.data?.recent_attempts ?? []).map(item=>({id:item.attempt_id,title:item.title,detail:`Rank ${item.rank??'pending'}`,score:`${item.score}/${item.total_marks}`,accuracy:item.accuracy_pct})),[kind,practice.data,mocks.data]);
  const feed=useProgressiveList(rows,kind);
  return <ListScreen key={kind} title="Your learning history" subtitle="Every attempt is a step forward."
    data={feed.items} keyExtractor={item=>item.id} onEndReached={feed.hasMore?feed.loadMore:undefined}
    refreshing={active.isRefetching} onRefresh={()=>void active.refetch()}
    header={<><Chips items={[{value:'practice',label:'Practice'},{value:'mock',label:'Mock papers'}]} selected={kind} onSelect={setKind}/>{active.error ? <ErrorState error={active.error} retry={()=>void active.refetch()}/> : null}</>}
    renderItem={({item})=><Card><Badge label={kind==='practice'?'PRACTICE SESSION':'MOCK ATTEMPT'}/><Heading>{item.title}</Heading><Body>{item.detail}</Body><Heading>{item.score} · {item.accuracy}% accuracy</Heading><Button secondary label="Review answers" icon="arrow-forward-outline" onPress={()=>router.push({pathname:'/result',params:{kind,id:item.id}})}/></Card>}
    empty={active.isPending ? <Loading/> : !active.error ? <EmptyState title="Your first chapter awaits" detail="Complete a practice session or mock paper to see your work here."/> : undefined}
    footer={<>{feed.hasMore ? <Button secondary label="Show more attempts" onPress={feed.loadMore}/> : null}{kind==='mock'&&rows.length ? <Body>Recent mock attempts from your account. Find the latest attempt for each paper in the mock library.</Body> : null}<Button secondary label="Back home" onPress={()=>router.replace('/')}/></>}/>;
}
